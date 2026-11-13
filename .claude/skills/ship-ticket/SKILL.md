---
name: ship-ticket
description: "Ship one ticket end to end: branch, implement, review, PR, green CI. Stops before the merge. Usage: /ship-ticket [ticket#]"
disable-model-invocation: true
---

Ship one ticket from `main` to a PR with green CI. The human merges. You orchestrate: the `implementer` subagent writes the code, and you verify, review and publish.

Everything a human reads (issue comments, PR body, your final report) is in Brazilian Portuguese.

## 1. Select the ticket

- With an argument, use that ticket.
- Without one, find the open `type:ticket` issues whose `blockedBy` are all closed (`gh issue list --label type:ticket --state open`, then `gh issue view <n> --json title,labels,parent,blockedBy`). Propose the lowest-numbered one and wait for the human to confirm.

Done when one ticket number is confirmed.

## 2. Preflight

Check each of these. If any fails, stop and say which one:

- `git status --porcelain` is empty.
- `git switch main` and `git pull --ff-only` succeed.
- The ticket is open and labelled `type:ticket`, and every `blockedBy` issue is closed.
- Its parent spec has `ready-for-agent`.

Note whether the ticket has the `model:opus` label.

## 3. Branch

`git switch -c feat/<n>-<slug>`, where the slug is the ticket title in kebab-case ASCII, at most five words.

## 4. Implement

Call the Agent tool with `subagent_type: "implementer"`. Pass `model: "opus"` when the ticket has `model:opus`; otherwise leave `model` out so the agent's Sonnet default applies. Prompt: `Ticket #<n>, spec #<spec>. Branch feat/<n>-<slug> is checked out.`

Read the report's `Status`:

- `needs-decision`: relay the question to the human and stop.
- `stuck`: go to step 7 (escalation).
- `done`: go on.

## 5. Verify

Run `pnpm lint`, `pnpm typecheck` and `pnpm test` yourself, each on its own. `git log main..HEAD --oneline` must show at least one `feat(#<n>)` commit.

Done when all three exit 0. Their output is the PR's evidence.

## 6. Review

Run the Skill tool with `code-review` (args `main`), then with `mattpocock-skills:code-review` (args `main`).

Give every finding a verdict:

- **fix**: correctness bugs are always fixed, unless the spec explicitly requires the behaviour.
- **accept**: a real issue you choose to carry. Give the reason.
- **reject**: false positive, or contradicts the spec. Give the reason.

Send all the **fix** findings to a new `implementer` call in fix mode, listing each finding with its file and failure scenario. Use the same model as step 4, or Opus if step 7 escalated. Then repeat step 5.

Done when every finding has a verdict, the fixes are committed, and step 5 is green again.

## 7. Escalation to Opus

Escalate when either is true: the implementer returned `stuck`, or the Sonnet run's review produced at least one **fix** correctness bug.

Rerun the pending work (step 4, or the fix call in step 6) with `model: "opus"`, and comment on the ticket: `Escalado para Opus: <motivo>`.

Escalate once per ticket. If Opus also returns `stuck`, stop and hand the failing output to the human.

## 8. Pull request

1. Write the body with the Skill tool `mattpocock-skills:pr`. Include:
   - `Closes #<n>`, and `Closes #<spec>` when this is the spec's last open ticket;
   - the step 5 evidence;
   - a findings table (finding, verdict, reason);
   - the model used and whether it escalated.
2. `git push -u origin feat/<n>-<slug>`. The human approves the push.
3. `gh pr create --base main --title "feat(#<n>): <ticket title>" --body-file <file>`

## 9. CI

`gh pr checks <pr> --watch`. When it goes red:

1. Read the failure with `gh run view <run-id> --log-failed`.
2. Fix it through the implementer in fix mode.
3. Push, and watch again.

Allow at most two red rounds, then stop and report.

Done when every check passes.

## 10. Report

Comment on the ticket with one line:

`Métricas: modelo=<sonnet|opus|sonnet→opus> · findings=<fix>/<accept>/<reject> · assumptions=<n> · ci-vermelho=<n>`

Then tell the human:

- the PR URL;
- that CI is green;
- the same metrics;
- and finally: "Pronto para o seu merge. Depois: `/clear` e `/ship-ticket`."
