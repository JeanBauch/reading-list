#!/usr/bin/env node
// PreToolUse (Edit|Write|NotebookEdit) hook: secrets and lockfiles are never edited by hand.
// Lockfiles change only through the package manager (`pnpm add/remove/install`).
import { basename } from 'node:path'
import { readStdinJson } from './lib.mjs'

const ENV_FILE = /^\.env(\..+)?$/
const ENV_ALLOWED = new Set(['.env.example', '.env.sample', '.env.template'])
const LOCKFILES = new Set(['pnpm-lock.yaml', 'package-lock.json', 'yarn.lock', 'bun.lock', 'bun.lockb', 'npm-shrinkwrap.json'])

export function blockReason(filePath) {
  const name = basename(filePath.replace(/\\/g, '/'))
  if (ENV_FILE.test(name) && !ENV_ALLOWED.has(name)) return `${name} may hold secrets; edit .env.example and ask the user to update their env file`
  if (LOCKFILES.has(name)) return `${name} is generated; change dependencies with the package manager instead`
  return null
}

const input = await readStdinJson()
const filePath = input.tool_input?.file_path ?? input.tool_input?.notebook_path
if (typeof filePath === 'string') {
  const reason = blockReason(filePath)
  if (reason) {
    process.stderr.write(`protect-paths: blocked edit to ${filePath}: ${reason}.\n`)
    process.exit(2)
  }
}
process.exit(0)
