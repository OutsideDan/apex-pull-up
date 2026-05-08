# Adaptive Coaching Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three adaptive coaching signals (de-load, hold-steady, recalibrate) that react to logged session performance, in priority order above the existing 2-workout level-up rule.

**Architecture:** Four pure signal functions (`checkDeload`, `checkHold`, `checkLevelUp` existing, `checkRecalibrate`) composed at render time in `renderHome()`. Priority enforced in one place via nullish coalescing. A new `recommendDeload()` function extends `recommendLoadout()` with triple-band enumeration and a tier-shift toward heavier assistance.

**Tech Stack:** Vanilla JS, single-file app (`index.html`). No test framework — tests are console snippets run in the browser's devtools after opening the file locally.

---

## File Map

| File | Change |
|---|---|
| `/Users/dlucas/Documents/Claude/ApexPullUp/index.html` | Add `recommendDeload()`, `checkDeload()`, `checkHold()`, `checkRecalibrate()`; rewrite suggestion-box block in `renderHome()` |

All changes are in one file. Insert new functions near their related existing functions (near line 579 for `recommendDeload`, near line 598 for signal checkers).

---

## Task 1: Add `recommendDeload()`

**Files:**
- Modify: `index.html` after line 579 (after closing `}` of `recommendLoadout`)

- [ ] **Step 1: Insert `recommendDeload()` after `recommendLoadout()`**

Find the closing `}` of `recommendLoadout` (currently line 579) and insert immediately after:

```js
function recommendDeload(currentRepBucket, weight, loopPosition) {
  const tierDown = { '12-15': '10-12', '10-12': '8-10', '8-10': '5-8', '5-8': '0-5', '0-5': '0-5' };
  const bucket = tierDown[currentRepBucket] ?? '0-5';
  const targets = { '0-5': 0.55, '5-8': 0.40, '8-10': 0.28, '10-12': 0.18, '12-15': 0.08 };
  const mult = LOOP_MULT[loopPosition ?? 'knee'];
  const targetAssist = (targets[bucket] ?? 0.55) * weight;
  const keys = Object.keys(BANDS);
  const adj = k => BANDS[k].mid * mult;
  const singles  = keys.map(k => ({ bands: [k], mid: adj(k) }));
  const pairs = [];
  for (let i = 0; i < keys.length; i++)
    for (let j = i + 1; j < keys.length; j++)
      pairs.push({ bands: [keys[i], keys[j]], mid: adj(keys[i]) + adj(keys[j]) });
  const triples = [];
  for (let i = 0; i < keys.length; i++)
    for (let j = i + 1; j < keys.length; j++)
      for (let l = j + 1; l < keys.length; l++)
        triples.push({ bands: [keys[i], keys[j], keys[l]], mid: adj(keys[i]) + adj(keys[j]) + adj(keys[l]) });
  const all = [...singles, ...pairs, ...triples];
  all.forEach(c => { c.score = Math.abs(c.mid - targetAssist) + (c.bands.length - 1) * 4; });
  all.sort((a, b) => a.score - b.score);
  const best = all[0];
  const currentRec = recommendLoadout(weight, currentRepBucket);
  if (best.mid <= currentRec.assist) return null;
  return {
    bands: best.bands,
    assist: best.mid,
    detail: `${LOOP_LABEL[loopPosition ?? 'knee']} · ~${Math.round(best.mid)} lb assist`,
    targetSets: TARGET_SETS,
    targetReps: TARGET_REPS,
  };
}
```

- [ ] **Step 2: Open `index.html` in a browser and run console test**

Open `file:///Users/dlucas/Documents/Claude/ApexPullUp/index.html`, sign in, then paste in devtools console:

```js
// Test 1: tier shift produces heavier recommendation
const r1 = recommendDeload('12-15', 172, 'knee');
console.assert(r1 !== null, 'should return a recommendation for 12-15 bucket');
console.assert(r1.assist > recommendLoadout(172, '12-15').assist, 'deload must be heavier than current');

// Test 2: same-tier floor (0-5 stays 0-5) still returns heavier via triples if possible
const r2 = recommendDeload('0-5', 172, 'knee');
// May return null if already at maximum assist — that's correct
console.log('0-5 deload result:', r2);

// Test 3: output shape matches recommendLoadout
if (r1) {
  console.assert(Array.isArray(r1.bands), 'bands is array');
  console.assert(typeof r1.assist === 'number', 'assist is number');
  console.assert(r1.targetSets === 3, 'targetSets is 3');
  console.assert(r1.targetReps === 8, 'targetReps is 8');
}
console.log('Task 1 tests passed');
```

Expected output: assertions pass, no errors, `Task 1 tests passed` logged.

- [ ] **Step 3: Commit**

```bash
cd /Users/dlucas/Documents/Claude/ApexPullUp
git add index.html
git commit -m "feat: add recommendDeload with triple-band enumeration and tier shift"
```

---

## Task 2: Add `checkDeload(sessions)`

**Files:**
- Modify: `index.html` after the closing `}` of `checkLevelUp` (currently ~line 598)

- [ ] **Step 1: Insert `checkDeload()` after `checkLevelUp()`**

Find the comment `// ── 2-Workout rule` and the closing `}` of `checkLevelUp`. Insert immediately after:

```js
function checkDeload(sessions) {
  if (sessions.length < 3) return null;
  const recent = sessions.slice(-3);
  const allReps = recent.flatMap(s => s.reps);
  const avg = allReps.reduce((a, r) => a + r, 0) / allReps.length;
  if (avg >= 6) return null;
  const rec = recommendDeload(state.profile.repBucket, state.profile.weight, state.profile.loopPosition);
  if (!rec) return null;
  return { type: 'deload', rec, avg: Math.round(avg * 10) / 10 };
}
```

- [ ] **Step 2: Open browser and run console test**

```js
// Mock sessions
const mockBands = ['R'];

// Test 1: fewer than 3 sessions → null
console.assert(checkDeload([]) === null, 'empty → null');
console.assert(checkDeload([
  { bands: mockBands, reps: [5, 5] }
]) === null, '1 session → null');
console.assert(checkDeload([
  { bands: mockBands, reps: [5, 5] },
  { bands: mockBands, reps: [5, 5] }
]) === null, '2 sessions → null');

// Test 2: avg >= 6 → null
console.assert(checkDeload([
  { bands: mockBands, reps: [8, 8, 8] },
  { bands: mockBands, reps: [6, 6, 6] },
  { bands: mockBands, reps: [6, 6, 6] }
]) === null, 'avg 6.67 → null');

// Test 3: avg < 6 → deload signal (requires state.profile set)
const result = checkDeload([
  { bands: mockBands, reps: [3, 3, 3] },
  { bands: mockBands, reps: [4, 4, 4] },
  { bands: mockBands, reps: [5, 5, 5] }
]);
// avg = (3+3+3+4+4+4+5+5+5)/9 = 4.0
if (result !== null) {
  console.assert(result.type === 'deload', 'type is deload');
  console.assert(result.avg < 6, 'avg < 6');
  console.assert(Array.isArray(result.rec.bands), 'rec has bands');
  console.log('checkDeload result:', result);
}
console.log('Task 2 tests passed');
```

Expected: all assertions pass. `result` may be `null` if `recommendDeload` sanity check fires (deload assist ≤ current) — log the result and verify manually.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: add checkDeload signal (avg < 6 reps/set across last 3 sessions)"
```

---

## Task 3: Add `checkHold(sessions)`

**Files:**
- Modify: `index.html` after `checkDeload`

- [ ] **Step 1: Insert `checkHold()` after `checkDeload()`**

```js
function checkHold(sessions) {
  if (sessions.length < 2) return null;
  const recent = sessions.slice(-2);
  if (JSON.stringify([...recent[0].bands].sort()) !== JSON.stringify([...recent[1].bands].sort())) return null;
  const bothClear = recent.every(s => Array.isArray(s.reps) && s.reps.length >= TARGET_SETS && s.reps.every(r => r >= TARGET_REPS));
  if (bothClear) return null;
  return { type: 'hold', bands: recent[0].bands };
}
```

- [ ] **Step 2: Open browser and run console test**

```js
const bR = ['R'];
const bB = ['B'];

// Test 1: fewer than 2 sessions → null
console.assert(checkHold([]) === null, 'empty → null');
console.assert(checkHold([{ bands: bR, reps: [5,5,5] }]) === null, '1 session → null');

// Test 2: different bands → null (stale hold)
console.assert(checkHold([
  { bands: bR, reps: [5, 5, 5] },
  { bands: bB, reps: [5, 5, 5] }
]) === null, 'band mismatch → null');

// Test 3: both sessions cleared gate → null (level-up fires instead)
console.assert(checkHold([
  { bands: bR, reps: [8, 8, 8] },
  { bands: bR, reps: [8, 8, 8] }
]) === null, 'both cleared → null');

// Test 4: same bands, one session missed → hold
const h = checkHold([
  { bands: bR, reps: [8, 8, 8] },
  { bands: bR, reps: [5, 5, 5] }
]);
console.assert(h !== null, 'missed gate → hold signal');
console.assert(h.type === 'hold', 'type is hold');
console.assert(JSON.stringify(h.bands) === JSON.stringify(bR), 'bands match');

// Test 5: fewer than TARGET_SETS sets → hold
const h2 = checkHold([
  { bands: bR, reps: [8, 8] },
  { bands: bR, reps: [8, 8] }
]);
console.assert(h2 !== null, 'fewer sets → hold');
console.log('Task 3 tests passed');
```

Expected: all assertions pass.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: add checkHold signal (same bands, missed 3x8 gate)"
```

---

## Task 4: Add `checkRecalibrate(sessions)`

**Files:**
- Modify: `index.html` after `checkHold`

- [ ] **Step 1: Insert `checkRecalibrate()` after `checkHold()`**

```js
function checkRecalibrate(sessions) {
  if (sessions.length < 1) return null;
  const last = sessions[sessions.length - 1];
  if (last.bands.length !== 0) return null;
  if (!last.reps.some(r => r > 0)) return null;
  return { type: 'recalibrate', currentBucket: state.profile.repBucket };
}
```

- [ ] **Step 2: Open browser and run console test**

```js
// Test 1: empty sessions → null
console.assert(checkRecalibrate([]) === null, 'empty → null');

// Test 2: last session has bands → null
console.assert(checkRecalibrate([
  { bands: ['R'], reps: [8, 8, 8] }
]) === null, 'has bands → null');

// Test 3: no bands, all zero reps → null (accidental empty log)
console.assert(checkRecalibrate([
  { bands: [], reps: [0, 0] }
]) === null, 'zero reps → null');

// Test 4: no bands, reps > 0 → recalibrate
const rc = checkRecalibrate([
  { bands: ['R'], reps: [5, 5] },
  { bands: [], reps: [3, 2] }
]);
console.assert(rc !== null, 'unassisted reps → recalibrate');
console.assert(rc.type === 'recalibrate', 'type is recalibrate');
console.assert(typeof rc.currentBucket === 'string', 'currentBucket is string');
console.log('Task 4 tests passed');
```

Expected: all assertions pass.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: add checkRecalibrate signal (unassisted reps detected)"
```

---

## Task 5: Rewrite suggestion-box block in `renderHome()`

**Files:**
- Modify: `index.html` lines ~634–642 (the `suggestion-box` block in `renderHome`)

- [ ] **Step 1: Replace the existing suggestion-box block**

Find and replace this exact block in `renderHome()`:

```js
  const sb = document.getElementById('suggestion-box');
  const suggestion = checkLevelUp();
  if (suggestion?.done) {
    sb.innerHTML = '<div class="suggestion"><span class="lbl">Milestone</span>You\'ve cleared the lightest band. Try unassisted.</div>';
  } else if (suggestion) {
    sb.innerHTML = `<div class="suggestion"><span class="lbl">2-Workout Rule</span>Two clean ${TARGET_SETS}×${TARGET_REPS} at ${suggestion.from.map(k => BANDS[k].name).join(' + ')}. Suggested next loadout: <b>${suggestion.to.map(k => BANDS[k].name).join(' + ')}</b>.</div>`;
  } else {
    sb.innerHTML = '';
  }
```

Replace with:

```js
  const sb = document.getElementById('suggestion-box');
  const deload  = checkDeload(state.sessions);
  const hold    = checkHold(state.sessions);
  const levelUp = checkLevelUp();
  const recal   = checkRecalibrate(state.sessions);

  if (deload) {
    sb.innerHTML = `<div class="suggestion"><span class="lbl">Struggling</span>Last 3 sessions averaged ${deload.avg} reps/set. Suggested loadout: <b>${deload.rec.bands.map(k => BANDS[k].name).join(' + ')}</b>.</div>`;
  } else if (hold) {
    sb.innerHTML = `<div class="suggestion"><span class="lbl">Hold Steady</span>Last 2 sessions on ${hold.bands.map(k => BANDS[k].name).join(' + ')} didn't clear ${TARGET_SETS}×${TARGET_REPS}. Stay here.</div>`;
  } else if (levelUp?.done) {
    sb.innerHTML = '<div class="suggestion"><span class="lbl">Milestone</span>You\'ve cleared the lightest band. Try unassisted.</div>';
  } else if (levelUp) {
    sb.innerHTML = `<div class="suggestion"><span class="lbl">2-Workout Rule</span>Two clean ${TARGET_SETS}×${TARGET_REPS} at ${levelUp.from.map(k => BANDS[k].name).join(' + ')}. Suggested next loadout: <b>${levelUp.to.map(k => BANDS[k].name).join(' + ')}</b>.</div>`;
  } else if (recal) {
    sb.innerHTML = `<div class="suggestion"><span class="lbl">Unassisted Rep Logged</span>You logged reps without bands. <button class="btn btn-outline" style="margin-top:8px;width:100%" onclick="prefillSetup();showView('setup')">Update Starting Point</button></div>`;
  } else {
    sb.innerHTML = '';
  }
```

- [ ] **Step 2: Run priority verification in browser console**

After sign-in, paste this to inject mock sessions and verify priority:

```js
// Inject sessions satisfying both deload AND hold conditions
// De-load should win
const saved = state.sessions;
state.sessions = [
  { bands: ['R'], reps: [3, 3, 3], assist: 27, volume: 270 },
  { bands: ['R'], reps: [4, 4, 4], assist: 27, volume: 360 },
  { bands: ['R'], reps: [5, 5, 5], assist: 27, volume: 450 }
];
// avg = (3+3+3+4+4+4+5+5+5)/9 = 4.0 → deload fires
// last 2 same bands, missed gate → hold also fires
// deload must win

const deload  = checkDeload(state.sessions);
const hold    = checkHold(state.sessions);
console.assert(deload !== null, 'deload fires');
console.assert(hold !== null, 'hold also fires');
// Priority: deload rendered
renderHome();
const sbText = document.getElementById('suggestion-box').textContent;
console.assert(sbText.includes('Struggling'), 'de-load wins over hold: ' + sbText);
console.log('Priority test passed');

// Restore
state.sessions = saved;
renderHome();
```

Expected: `Priority test passed`, suggestion-box shows "Struggling".

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: wire adaptive coaching signals into renderHome priority block"
```

---

## Task 6: End-to-End Verification

**Files:** none — browser verification only

- [ ] **Step 1: Run full scenario table in browser console**

Paste the complete verification script:

```js
const saved = state.sessions;
let passed = 0;
let failed = 0;

function check(label, sessions, expectedLabel) {
  state.sessions = sessions.map(s => ({ id: 'test', date: new Date().toISOString(), assist: 27, volume: 100, ...s }));
  renderHome();
  const text = document.getElementById('suggestion-box').textContent;
  const ok = expectedLabel === '' ? text === '' : text.includes(expectedLabel);
  if (ok) { passed++; console.log('✓', label); }
  else { failed++; console.error('✗', label, '| got:', text); }
}

// < 3 sessions → no signal
check('< 3 sessions', [
  { bands: ['R'], reps: [3,3,3] }
], '');

// De-load: avg < 6
check('de-load fires (avg 4)', [
  { bands: ['R'], reps: [3,3,3] },
  { bands: ['R'], reps: [4,4,4] },
  { bands: ['R'], reps: [5,5,5] }
], 'Struggling');

// Hold: same bands, missed gate
check('hold fires', [
  { bands: ['R'], reps: [8,8,8] },
  { bands: ['R'], reps: [5,5,5] }
], 'Hold Steady');

// Hold suppressed: band mismatch
check('hold suppressed (band mismatch)', [
  { bands: ['R'], reps: [5,5,5] },
  { bands: ['B'], reps: [5,5,5] }
], '');

// Level-up: both 3x8
check('level-up fires', [
  { bands: ['R'], reps: [8,8,8] },
  { bands: ['R'], reps: [8,8,8] }
], '2-Workout Rule');

// Recalibrate: no bands, reps > 0
check('recalibrate fires', [
  { bands: ['R'], reps: [8,8,8] },
  { bands: [], reps: [3,2] }
], 'Unassisted Rep Logged');

// Recalibrate suppressed: no bands, zero reps
check('recalibrate suppressed (zero reps)', [
  { bands: [], reps: [0,0] }
], '');

// No sessions → cleared
check('no sessions → cleared', [], '');

console.log(`\n${passed} passed, ${failed} failed`);
state.sessions = saved;
renderHome();
```

Expected: `8 passed, 0 failed`.

- [ ] **Step 2: Manual check — Recalibrate button**

Manually inject a no-band session, verify the "Update Starting Point" button appears in the suggestion-box, tap it, confirm it navigates to the Setup tab with fields pre-filled.

---

## Task 7: Pre-Deploy Checks + Push

**Files:** none

- [ ] **Step 1: Run pre-deploy lint**

```bash
cd /Users/dlucas/Documents/Claude/ApexPullUp
npm run deploy
```

Expected: lint passes (no stray `console.log`, file size < 500 KB, input labels present). Lint is configured to gate on failure — if it passes, deploy continues automatically.

- [ ] **Step 2: Update BACKLOG.md Phase 2 status**

In `/Users/dlucas/Documents/Claude/ApexPullUp/BACKLOG.md`, change:

```markdown
**Status:** stub — not started
```

To:

```markdown
**Status:** complete — shipped 2026-05-08
```

- [ ] **Step 3: Commit and push**

```bash
git add BACKLOG.md docs/
git commit -m "chore: mark adaptive coaching complete, add implementation plan"
git push origin main
```

Expected: GitHub Pages redeploys to `outsidedan.github.io/apex-pull-up/`.
