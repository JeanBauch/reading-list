#!/usr/bin/env node
// Stop / SubagentStop hook: the turn cannot end while changed code fails typecheck or its related tests.
// Exit 2 sends stderr back to Claude and keeps it working (Claude Code caps consecutive blocks at 8).
// Turns that changed no code (grilling, specs, reviews) exit immediately.
// Escape hatch for one session: SDD_VERIFY_GATE=off claude
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { gitRoot, localBin, readStdinJson, runNode, tail } from './lib.mjs'

const CODE_FILE = /\.(ts|tsx|mts|cts|js|jsx|mjs|cjs)$/

/** Changed code files from `git status --porcelain`, split into existing and deleted. */
export function changedCodeFiles(root) {
  const r = spawnSync('git', ['status', '--porcelain=v1', '--untracked-files=all'], { cwd: root, encoding: 'utf8' })
  if (r.status !== 0) return { existing: [], deleted: [] }
  const existing = []
  const deleted = []
  for (const line of r.stdout.split('\n')) {
    if (line.length < 4) continue
    const status = line.slice(0, 2)
    let path = line.slice(3)
    if (path.includes(' -> ')) path = path.slice(path.indexOf(' -> ') + 4)
    path = path.replace(/^"|"$/g, '')
    if (!CODE_FILE.test(path) || path.startsWith('.claude/') || path.includes('node_modules/')) continue
    if (status.includes('D') || !existsSync(join(root, path))) deleted.push(path)
    else existing.push(path)
  }
  return { existing, deleted }
}

const input = await readStdinJson()
if ((process.env.SDD_VERIFY_GATE ?? '').toLowerCase() === 'off') process.exit(0)

const root = gitRoot(input.cwd ?? process.cwd())
if (!root) process.exit(0)

const { existing, deleted } = changedCodeFiles(root)
if (existing.length === 0 && deleted.length === 0) process.exit(0)

const failures = []

const tsc = localBin(root, 'typescript', 'bin', 'tsc')
if (tsc && existsSync(join(root, 'tsconfig.json'))) {
  const r = runNode(tsc, ['--noEmit'], root)
  if (r.code !== 0) failures.push(`Typecheck failed (tsc --noEmit):\n${tail(r.output)}`)
}

const vitest = localBin(root, 'vitest', 'vitest.mjs')
if (vitest && existing.length > 0) {
  const r = runNode(vitest, ['related', '--run', '--passWithNoTests', ...existing], root)
  if (r.code !== 0) failures.push(`Related tests failed (vitest related --run ${existing.join(' ')}):\n${tail(r.output)}`)
}

if (failures.length > 0) {
  process.stderr.write(
    `verify-gate: changed code is not green yet. Fix it before finishing, and show the passing command output as evidence.\n\n${failures.join('\n\n')}\n`,
  )
  process.exit(2)
}
process.exit(0)
