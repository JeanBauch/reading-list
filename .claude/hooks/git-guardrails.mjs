#!/usr/bin/env node
// PreToolUse (Bash) hook: blocks destructive git/gh commands that permission rules can miss
// (flag variants, `git -C dir`, chained commands). Exit 2 = blocked; stderr goes back to Claude.
// Pushing itself is not blocked here: `git push` is an "ask" permission, so the human approves it.
import { spawnSync } from 'node:child_process'
import { basename, resolve } from 'node:path'
import { readStdinJson } from './lib.mjs'

const PROTECTED_BRANCHES = new Set(['main', 'master'])

/** Splits a shell command into segments of words, honouring quotes and operators (; & | && || newlines). */
export function segmentsOf(command) {
  const segments = []
  let words = []
  let word = ''
  let inWord = false
  let quote = null
  const endWord = () => {
    if (inWord) words.push(word)
    word = ''
    inWord = false
  }
  const endSegment = () => {
    endWord()
    if (words.length) segments.push(words)
    words = []
  }
  for (let i = 0; i < command.length; i++) {
    const c = command[i]
    if (quote) {
      if (c === quote) quote = null
      else if (c === '\\' && quote === '"' && i + 1 < command.length) word += command[++i]
      else word += c
      continue
    }
    if (c === '"' || c === "'") {
      quote = c
      inWord = true
    } else if (c === '\\' && i + 1 < command.length) {
      word += command[++i]
      inWord = true
    } else if (c === '\n' || c === ';' || c === '|' || c === '&' || c === '(' || c === ')') {
      endSegment()
    } else if (/\s/.test(c)) {
      endWord()
    } else {
      word += c
      inWord = true
    }
  }
  endSegment()
  return segments
}

const programOf = (word) => basename(word).toLowerCase().replace(/\.(exe|cmd)$/, '')
const hasShortFlag = (args, letter) => args.some((a) => /^-[a-zA-Z]+$/.test(a) && a.slice(1).includes(letter))
const isProtectedRef = (ref) => {
  const target = ref.includes(':') ? ref.slice(ref.lastIndexOf(':') + 1) : ref
  const name = target.replace(/^\+/, '').replace(/^refs\/heads\//, '')
  return PROTECTED_BRANCHES.has(name)
}

function currentBranch(dir) {
  const r = spawnSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: dir, encoding: 'utf8' })
  return r.status === 0 ? r.stdout.trim() : null
}

/** Returns a reason string when the git invocation must be blocked, otherwise null. */
function checkGit(args, cwd) {
  let dir = cwd
  let i = 0
  // global options before the subcommand
  while (i < args.length && args[i].startsWith('-')) {
    const opt = args[i]
    if (opt === '-C') dir = resolve(dir, args[++i] ?? '.')
    else if (opt === '-c' || opt === '--git-dir' || opt === '--work-tree' || opt === '--namespace') i++
    i++
  }
  const sub = args[i]
  const rest = args.slice(i + 1)
  const flags = rest.filter((a) => a.startsWith('-'))
  const positional = rest.filter((a) => !a.startsWith('-'))

  switch (sub) {
    case 'push': {
      if (flags.some((f) => f === '--force' || f.startsWith('--force-with-lease') || f === '--force-if-includes') || hasShortFlag(flags, 'f'))
        return 'force push rewrites remote history'
      if (flags.includes('--mirror')) return 'mirror push can delete remote branches'
      if (flags.includes('--delete') || hasShortFlag(flags, 'd')) return 'deleting remote branches'
      const refspecs = positional.slice(1)
      if (refspecs.some((r) => r.startsWith('+'))) return 'forced refspec (+ref) rewrites remote history'
      if (refspecs.some(isProtectedRef)) return 'pushing to a protected branch (main/master); open a PR instead'
      if (refspecs.length === 0 && PROTECTED_BRANCHES.has(currentBranch(dir) ?? ''))
        return 'pushing from main/master; work on a feature branch and open a PR'
      return null
    }
    case 'reset':
      return flags.includes('--hard') ? 'reset --hard discards uncommitted work' : null
    case 'clean':
      return flags.includes('--force') || hasShortFlag(flags, 'f') ? 'clean -f deletes untracked files' : null
    case 'checkout':
      return rest.includes('.') ? 'checkout . discards all unstaged changes' : null
    case 'restore': {
      const stagedOnly = flags.includes('--staged') && !flags.includes('--worktree') && !hasShortFlag(flags, 'W')
      return rest.includes('.') && !stagedOnly ? 'restore . discards all unstaged changes' : null
    }
    case 'branch': {
      if (hasShortFlag(flags, 'D')) return 'branch -D force-deletes a branch that may hold unmerged work'
      const deleting = flags.includes('--delete') || hasShortFlag(flags, 'd')
      return deleting && positional.some((b) => PROTECTED_BRANCHES.has(b)) ? 'deleting a protected branch' : null
    }
    default:
      return null
  }
}

function checkGh(args) {
  const [group, action] = args.filter((a) => !a.startsWith('-'))
  if (group === 'pr' && action === 'merge') return 'merging pull requests is reserved for the human'
  if (group === 'repo' && action === 'delete') return 'deleting repositories'
  return null
}

/** Returns the first blocking reason for a full command line, or null. */
export function blockReason(command, cwd) {
  for (const words of segmentsOf(command)) {
    let i = 0
    while (i < words.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(words[i])) i++ // env assignments
    if (words[i] === 'sudo' || words[i] === 'command' || words[i] === 'env') i++
    const program = words[i] ? programOf(words[i]) : ''
    const args = words.slice(i + 1)
    const reason = program === 'git' ? checkGit(args, cwd) : program === 'gh' ? checkGh(args) : null
    if (reason) return { segment: words.join(' '), reason }
  }
  return null
}

const input = await readStdinJson()
if (input.tool_name === 'Bash' && typeof input.tool_input?.command === 'string') {
  const hit = blockReason(input.tool_input.command, input.cwd ?? process.cwd())
  if (hit) {
    process.stderr.write(
      `git-guardrails: blocked \`${hit.segment}\`: ${hit.reason}. ` +
        'Do not retry or work around it. If it is genuinely needed, stop and ask the user to run it.\n',
    )
    process.exit(2)
  }
}
process.exit(0)
