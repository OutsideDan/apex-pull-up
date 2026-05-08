# Backlog — Apex Pull-Up Tracker

---

## Phase 2: Adaptive Coaching

**Status:** stub — not started

Extend the tracker from a static HAPBEAR protocol to one that adapts based on logged performance.

Ideas to define when scoping:
- Detect when Dan is consistently hitting the top of a rep range and surface a prompt to advance
- Detect stalled progress (no rep increase across N sessions) and suggest a deload or form cue
- Session-level feedback prompt ("felt easy / on target / hard") to feed the adaptation model
- Weekly summary: sessions completed, volume trend, recommendation for next week

**Out of scope for Phase 2:** multi-user, AI/LLM calls, anything requiring a backend beyond Firestore.

**Prerequisite:** enough logged data to make adaptation meaningful (~4–6 weeks of sessions).
