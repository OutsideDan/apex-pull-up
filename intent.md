# Intent — Apex Pull-Up Tracker

## Outcomes
- Dan graduates from banded pull-ups to unassisted using the HAPBEAR resistance band protocol
- Every session is logged; progression is automatic (2-workout rule enforced by the app)

## Scope
- Workout logging (sets × reps × band configuration)
- Loadout recommendation (which bands to use based on current level)
- 2-workout progression rule (auto-advance after two successful sessions)
- 90-second rest timer
- Resistance floor chart
- Markdown export

## Out of scope
- Multi-user
- Social or sharing features
- Exercise variety beyond pull-ups

## Embedded tests
Each feature's check lives in `scripts/pre-deploy.js`.
- Login/auth: input labels present (a11y check, blocks deploy on miss)
- File size: under 500 KB hard limit (Apex tracker is ~62 KB — well within budget)
- No leftover console.log statements (hygiene check, blocks deploy)
- Firestore wiring: verified manually at first deploy by logging a workout and reloading
