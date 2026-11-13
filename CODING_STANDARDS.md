# Coding standards: reading-list

Read during review, not during implementation. Only judgement calls belong here: anything mechanical
(formatting, import order, banned APIs) belongs in lint, typecheck or a hook. Where this file and the
reviewer's code-smell baseline disagree, this file wins.

## Design

- Prefer deep modules: a small public interface hiding real behaviour. Avoid pass-through wrappers.
- No speculative generality: no options, layers or abstractions the spec does not need yet.
- Names use the terms in `GLOSSARY.md`; one concept, one name.

## Next.js and React

- Server Components by default. Add `"use client"` only for interactivity or browser APIs, as low in the tree as possible.
- Validate every external input (form data, route params, request bodies) at the boundary, before it reaches domain code.
- Data access lives behind a module interface, never inline in components.

## Errors

- No silent `catch`: handle the error, or let it propagate with context.
- Empty, loading and error states are explicit in the UI, not console output.

## Tests

- Test behaviour through public interfaces at the agreed seams; no tests of private functions or internal calls.
- Expected values come from the spec or a worked example, never recomputed the way the code computes them.
- A bug fix starts with a failing regression test.
