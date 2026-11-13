#!/usr/bin/env node
// PostToolUse (Edit|Write) hook: formats the edited file with the project's Prettier. Never blocks.
import { dirname } from 'node:path'
import { gitRoot, localBin, readStdinJson, runNode } from './lib.mjs'

const FORMATTABLE = /\.(ts|tsx|mts|cts|js|jsx|mjs|cjs|json|css|scss|md|mdx|yml|yaml|html)$/

const input = await readStdinJson()
const filePath = input.tool_input?.file_path
if (typeof filePath === 'string' && FORMATTABLE.test(filePath)) {
  const root = gitRoot(input.cwd ?? dirname(filePath)) ?? input.cwd
  const prettier = root ? localBin(root, 'prettier', 'bin', 'prettier.cjs') : null
  if (prettier) runNode(prettier, ['--write', '--ignore-unknown', filePath], root, 60_000)
}
process.exit(0)
