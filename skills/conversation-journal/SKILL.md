---
name: conversation-journal
description: Maintain rolling chat notes by appending turn-level summaries to memory/YYYY-MM-DD.md with per-session headings. Use whenever conversation context needs to persist across /new resets or a long-running day.
---

# Conversation Journal Skill

Keep a lightweight, append-only log of each exchange so `/new` resets never wipe the working memory. The workflow centers on adding bullet summaries to the current day's memory file, grouped by session.

## Folder Layout

- `memory/YYYY-MM-DD.md` — Daily log. Each session gets its own `## Session N (HH:MM UTC start)` heading; entries are bullets with timestamps + speaker tag.
- `scripts/log_conversation.py` — Helper to append entries safely, creating files/headings on demand.

## Usage

1. **Choose/declare the active session heading** when a new `/new` (or major context shift) happens. Example: `Session 2 (03:44 UTC start)`.
2. **Summarize each message or short batch** in one bullet (keep it concise: intent + key facts/decisions). Mention whether it was the user or assistant via `--speaker`.
3. **Append via script:**
   ```bash
   python skills/conversation-journal/scripts/log_conversation.py \
     --session "Session 1 (03:35 UTC start)" \
     --speaker user \
     "Asked whether GLM endpoint is OpenAI-compatible and if sharing API key is acceptable."
   ```
   - Omit `--date` to default to today (UTC) or set explicitly for backfilling.
   - `--timestamp` defaults to current `HH:MM UTC`. Override if logging older turns.
4. **Repeat per turn.** The script ensures the file, session header, and bullet formatting exist. Entries stay chronologically ordered in the file.
5. **Review anytime** by opening `memory/<date>.md`. Since the log is plain Markdown in the workspace, it can be versioned with git.

## Tips

- Batch low-signal turns together to avoid noise; the goal is a readable digest, not a verbatim transcript.
- If two sessions happen on the same day, just run the script with a new `--session` label; bullets will collect under the new heading automatically.
- Pair this skill with heartbeat/cron summaries when you need higher-level rollups (e.g., end-of-day recap) by reading the same memory file.
