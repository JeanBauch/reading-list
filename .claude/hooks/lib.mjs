// Shared helpers for the project hooks. Node only: no bash, jq or sleep, so hooks run the same on Windows.
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

/** Reads the hook payload Claude Code sends on stdin. */
export async function readStdinJson() {
  let raw = ''
  for await (const chunk of process.stdin) raw += chunk
  try {
    return raw.trim() ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

/** The git toplevel for `dir`, or null outside a repository. */
export function gitRoot(dir) {
  const r = spawnSync('git', ['rev-parse', '--show-toplevel'], { cwd: dir, encoding: 'utf8' })
  return r.status === 0 ? r.stdout.trim() : null
}

/** Path to a package's JS entry inside node_modules, or null when it is not installed. */
export function localBin(root, ...segments) {
  const file = join(root, 'node_modules', ...segments)
  return existsSync(file) ? file : null
}

/** Runs a JS bin with the current Node binary (no shell, no .cmd shims). */
export function runNode(bin, args, cwd, timeoutMs = 300_000) {
  const r = spawnSync(process.execPath, [bin, ...args], { cwd, encoding: 'utf8', timeout: timeoutMs, maxBuffer: 32 * 1024 * 1024 })
  return { code: r.status ?? 1, output: `${r.stdout ?? ''}${r.stderr ?? ''}`.trim() }
}

/** Keeps the end of long tool output, which is where compilers and test runners put the summary. */
export function tail(text, max = 6000) {
  return text.length <= max ? text : `…(${text.length - max} chars trimmed)…\n${text.slice(-max)}`
}
