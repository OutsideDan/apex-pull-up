# CLAUDE.md — Apex Pull-Up Tracker

This repo follows the **personal-webapp-template** pattern. Read `intent.md` and the SOP at `workbench/wiki/reference/personal-webapp-deploy.md` before making changes.

## What this app is
Coaches Dan from banded pull-ups to unassisted using the HAPBEAR resistance band protocol. Used on an iPad in the basement gym.

## Stack
- Single-file static webapp served from GitHub Pages (`main` branch root, no build)
- Firestore: project `sendit-67c81` (shared with SendIt)
- Auth: same `accounts/{username}` doc + SHA-256 PIN as SendIt
- Pull-up sessions: `accounts/{username}/pullups` subcollection
- Pull-up profile: `pullupProfile` field on the account doc

## Loop position
Knee loop selected by default (short basement ceiling). Multiplier: 0.60 of rated band assist.

## Deploy
```
npm run check    # lint without deploying
npm run deploy   # lint + git push → live within ~30s
```

## Embedded test rule
Every new feature requires a check in `scripts/pre-deploy.js` before merge.

## Behavior
- Read this file and `intent.md` before any task
- Concise responses, bullets over prose
- Present a plan before structural changes
