# reading-list

## Framework rules

Claude Code reads this file instead of AGENTS.md, so the Next.js agent rules are imported here:
@AGENTS.md

## Commands

- Install: `pnpm install`
- Dev server: `pnpm dev`
- One test file: `pnpm vitest run path/to/file.test.ts`
- Tests related to changed files: `pnpm vitest related --run <files>`
- Typecheck: `pnpm typecheck` · Lint: `pnpm lint` · Unit: `pnpm test` · E2E: `pnpm test:e2e`

## Workflow rules

- Specs and tickets live in GitHub Issues (labels `type:spec`, `type:ticket`); see `docs/agents/issue-tracker.md`. Never put file paths or code in them.
- One branch per spec: `feat/<spec#>-<slug>`. One commit per ticket: `feat(#<ticket>): <summary>`.
- Never push to `main`, never merge PRs, never edit `.env*` or lockfiles. The human merges.
- A choice the spec and ADRs don't settle: hard to reverse → comment `NEEDS-DECISION: ...` on the ticket and stop; easy to reverse → pick the simplest option and comment `ASSUMPTION: ...`.
- "Done" means evidence: the exact command you ran and its output.
- Review with `/mattpocock-skills:code-review` (Standards and Spec axes) as well as the built-in `/code-review`.
- Language: issues, PRs, ADRs and `GLOSSARY.md` in Brazilian Portuguese; code, identifiers and commit messages in English.

## Gotchas

- Multi-line edits: use Edit/Write, not line-number `sed`/`head` splicing. Splicing misplaces code, and the format hook only fires on Edit/Write.
- Never pipe a check into another command before `&&` (`pnpm format:check | tail -3 && git commit`): the pipe hides the failing exit code.

<!-- Filled by /retro: only things Claude got wrong twice. -->

## Pointers

- Domain terms: `GLOSSARY.md` · Decisions: `docs/adr/` · Review standards: `CODING_STANDARDS.md`

## Agent skills

### Issue tracker

Specs and tickets live in GitHub Issues (`gh` CLI). See `docs/agents/issue-tracker.md`.

### Triage labels

Default five-role vocabulary (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: root `GLOSSARY.md` + `docs/adr/`. See `docs/agents/domain.md`.
