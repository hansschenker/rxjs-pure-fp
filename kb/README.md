# Knowledge base

Auto-curated by a Claude Code `SessionEnd` hook (`~/.claude/hooks/session-end-kb.mjs`):
when an interactive session ends, a detached headless Claude summarizes it here.
Subagent, summarizer, and trivial/one-shot automation sessions are filtered out.

## Layout

- `sessions/YYYY-MM.md` — one file per month, one short entry per session
  (deduped by session id embedded in an HTML comment).
- `my_patterns.md` — durable personal patterns: how Hans works, conventions,
  preferences, recurring workflows. Curated, not a log.

## Curation rules (for humans and agents)

- Session entries: 5–12 bullets max. Outcomes, decisions + why, gotchas.
  No code dumps, no file lists, nothing derivable from `git log`.
- `my_patterns.md`: merge, don't append — sharpen or replace existing bullets
  instead of adding near-duplicates; delete superseded ones. Hard cap 150 lines.
- When in doubt, leave it out. An entry that says nothing costs more than no entry.

## Knobs (env vars, read by the hook)

- `CLAUDE_KB_SKIP=1` — set in any automation that should never be summarized.
- `CLAUDE_KB_MODEL` — summarizer model (default `claude-sonnet-5`).
- `CLAUDE_KB_DIR` — override the KB location.
- Log: `~/.claude/hooks/session-end-kb.log`.
