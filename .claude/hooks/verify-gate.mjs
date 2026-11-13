#!/usr/bin/env node
// Stop / SubagentStop hook: the turn cannot end while changed files fail formatting, typecheck or related tests.
// "Changed" = uncommitted changes plus, on a feature branch, everything committed since it left main,
// so committing each ticket before the turn ends does not skip the gate.
// Exit 2 sends stderr back to Claude and keeps it working (Claude Code caps consecutive blocks at 8).
// A green state is remembered, so turns that change nothing (grilling, specs, reviews) exit immediately.
// Escape hatch for one session: SDD_VERIFY_GATE=off claude
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { gitRoot, localBin, readStdinJson, runNode, tail } from './lib.mjs'

const CODE_FILE = /\.(ts|tsx|mts|cts|js|jsx|mjs|cjs)$/
const BASE_BRANCHES = ['main', 'master', 'origin/main', 'origin/master']

const git = (root, ...args) => spawnSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
const ignored = (path) => path.startsWith('.claude/') || path.includes('node_modules/')

/** Where the current branch left main, or null on main itself (its history is already checked by CI). */
function branchBase(root) {
  const branch = git(root, 'rev-parse', '--abbrev-ref', 'HEAD').stdout.trim()
  if (BASE_BRANCHES.includes(branch)) return null
  for (const candidate of BASE_BRANCHES) {
    const r = git(root, 'merge-base', 'HEAD', candidate)
    if (r.status === 0) return r.stdout.trim()
  }
  return null
}

/** Changed paths from `git status` and, on a feature branch, from the commits since its base. */
export function changedFiles(root) {
  const status = git(root, 'status', '--porcelain=v1', '--untracked-files=all')
  if (status.status !== 0) return { existing: [], deleted: [], untracked: [], porcelain: '' }
  const paths = new Set()
  const untracked = []
  for (const line of status.stdout.split('\n')) {
    if (line.length < 4) continue
    let path = line.slice(3)
    if (path.includes(' -> ')) path = path.slice(path.indexOf(' -> ') + 4)
    path = path.replace(/^"|"$/g, '')
    paths.add(path)
    if (line.startsWith('??')) untracked.push(path)
  }
  const base = branchBase(root)
  if (base) {
    const diff = git(root, 'diff', '--name-only', '-z', base, 'HEAD')
    if (diff.status === 0) for (const path of diff.stdout.split('\0')) if (path) paths.add(path)
  }
  const existing = []
  const deleted = []
  for (const path of paths) {
    if (ignored(path)) continue
    if (existsSync(join(root, path))) existing.push(path)
    else deleted.push(path)
  }
  return { existing, deleted, untracked, porcelain: status.stdout }
}

/** Fingerprint of the working state: HEAD, the uncommitted diff and the content of untracked files. */
function stateKey(root, { untracked, porcelain }) {
  const hash = createHash('sha256')
  hash.update(git(root, 'rev-parse', 'HEAD').stdout)
  hash.update(porcelain)
  hash.update(git(root, 'diff', 'HEAD', '--binary').stdout)
  for (const path of untracked) {
    const full = join(root, path)
    if (existsSync(full)) hash.update(path).update(readFileSync(full))
  }
  return hash.digest('hex')
}

const input = await readStdinJson()
if ((process.env.SDD_VERIFY_GATE ?? '').toLowerCase() === 'off') process.exit(0)

const root = gitRoot(input.cwd ?? process.cwd())
if (!root) process.exit(0)

const changed = changedFiles(root)
const { existing, deleted } = changed
if (existing.length === 0 && deleted.length === 0) process.exit(0)

// Per worktree, inside .git, so it never shows up in `git status`.
const gitDir = git(root, 'rev-parse', '--absolute-git-dir').stdout.trim()
const stateFile = gitDir ? join(gitDir, 'sdd-verify-gate.json') : null
const key = stateKey(root, changed)
try {
  if (stateFile && JSON.parse(readFileSync(stateFile, 'utf8')).green === key) process.exit(0)
} catch {
  // no remembered state yet: verify
}

const failures = []
const code = existing.filter((path) => CODE_FILE.test(path))
const codeChanged = code.length > 0 || deleted.some((path) => CODE_FILE.test(path))

const prettier = localBin(root, 'prettier', 'bin', 'prettier.cjs')
if (prettier && existing.length > 0) {
  const r = runNode(prettier, ['--check', '--ignore-unknown', ...existing], root)
  if (r.code !== 0) failures.push(`Formatting failed (prettier --check). Run prettier --write on these files:\n${tail(r.output)}`)
}

const tsc = localBin(root, 'typescript', 'bin', 'tsc')
if (codeChanged && tsc && existsSync(join(root, 'tsconfig.json'))) {
  const r = runNode(tsc, ['--noEmit'], root)
  if (r.code !== 0) failures.push(`Typecheck failed (tsc --noEmit):\n${tail(r.output)}`)
}

const vitest = localBin(root, 'vitest', 'vitest.mjs')
if (vitest && code.length > 0) {
  const r = runNode(vitest, ['related', '--run', '--passWithNoTests', ...code], root)
  if (r.code !== 0) failures.push(`Related tests failed (vitest related --run ${code.join(' ')}):\n${tail(r.output)}`)
}

if (failures.length > 0) {
  process.stderr.write(
    `verify-gate: changed files are not green yet. Fix them before finishing, and show the passing command output as evidence.\n\n${failures.join('\n\n')}\n`,
  )
  process.exit(2)
}
if (stateFile) {
  try {
    writeFileSync(stateFile, JSON.stringify({ green: key }))
  } catch {
    // remembering is an optimisation; failing to write only means the next stop re-checks
  }
}
process.exit(0)
