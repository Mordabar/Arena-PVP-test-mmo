# QA_GATE.md — Project Arena Ladder PvP Quality Gates

This file defines the executable and human/adversarial gates required before any macro milestone may be declared complete.

Green unit tests alone are necessary but insufficient.

---

## 1. Gate hierarchy

Use two levels during development.

### FAST GATE — frequent

Run after a subsystem change or integration batch.

Minimum:

```bash
node tools/run-tests.js
```

When applicable also run targeted browser/syntax checks.

### FULL GATE — milestone completion

Run only after integrated implementation is feature-complete:

```bash
node tools/run-tests.js
node tools/arbiter.js
node tools/browser.js smoke
```

Then run visual, gameplay and performance review.

If browser tooling is unavailable in the environment, state that explicitly. Do not report a pass that was not executed.

---

## 2. Baseline regression rule

At the v0.7 handoff:

- automated suite: **206 tests passed**;
- arbiter: **APROBADO**.

A future milestone may legitimately change expected behavior only when:

1. the design change is documented;
2. tests are updated intentionally;
3. the new behavior still respects `CLAUDE.md` and the vertical slice spec.

Never reduce coverage simply to obtain green output.

---

## 3. Simulation authority gate

FAIL immediately if any presentation subsystem becomes authoritative.

Audit for writes from:

- `js/render/**`
- `js/ui/**`
- camera code
- VFX code
- animation code

into authoritative combat state.

Required invariants:

- renderer cannot set HP;
- renderer cannot commit cooldown;
- animation cannot deal damage;
- camera cannot directly own yaw outcome;
- UI cannot resolve abilities;
- VFX cannot spawn authoritative projectiles.

---

## 4. Combat timing gate

### Normal attack

Required tests/inspection:

- movement prevents normal RELEASE;
- stopping with weapon ready allows fast windup;
- movement during windup cancels;
- cancelled windup produces no damage;
- damage/projectile begins at RELEASE;
- normal validates facing;
- normal validates range;
- normal validates LoS;
- normal cannot release while active cast blocks it;
- normal cannot release illegally while airborne.

### Cast

Required:

- BEGIN does not permanently commit cooldown;
- BEGIN does not permanently commit GCD;
- BEGIN does not permanently consume resource;
- movement before release cancels according to policy;
- jump before release cancels stationary cast;
- manual cancel before release is clean;
- successful release commits resource/CD/GCD exactly once;
- target/range/LoS/facing revalidate before release;
- post-release projectile survives later caster movement/death according to projectile rules;
- enemy interrupt remains distinct from voluntary cancellation.

---

## 5. Weaving / action-conflict gate

Required behavior families:

### Archer

- normal → permitted weave produces normal + power;
- queued weave inside window executes after normal release;
- last valid queued input replaces earlier one;
- a replace-normal weapon skill prevents phantom normal damage.

### Warrior

- normal → kick-like utility preserves released normal;
- heavy weapon skill before normal release can replace when metadata says so;
- heavy weapon skill after released normal cannot erase that hit;
- interval policy is respected afterward.

### Mage

- requested spell takes deterministic priority over an auto-ready staff normal;
- cast A → release → GCD → queued B begins immediately when legal;
- moving during B before release cancels without phantom cost under current policy.

---

## 6. Movement/control gate

Required:

- W moves forward relative to body yaw;
- S backpedals without auto-turn;
- A moves left;
- D moves right;
- A/D do not turn;
- Q/E keyboard turn works according to configured policy;
- diagonal speed is normalized;
- target selection does not rotate body;
- offensive ability does not auto-face;
- stun prevents illegal body rotation;
- root does not incorrectly behave as stun.

### Mouse

Left click below deadzone:

- selection works;
- camera yaw delta = 0;
- body yaw delta = 0.

Left drag after deadzone:

```text
cameraYawDelta == bodyYawDelta
```

No TURN_SPEED cap applies to mouse steering.

Right drag:

- camera moves;
- body yaw does not;
- release causes no snap.

---

## 7. FPS / determinism gate

Combat outcome must remain coherent with presentation running at representative rates:

- 30 FPS;
- 60 FPS;
- 120 FPS;
- 144 FPS.

Simulation remains fixed tick.

Mouse deltas may arrive more frequently but must be consumed once, not duplicated or lost.

Never use `Date.now()` or DOM timers for authoritative combat timing.

---

## 8. Animation gate

Tests protect invariants; visual review protects quality.

### General

- foot locking remains functional;
- feet do not moonwalk noticeably at normal camera distance;
- pelvis/torso react to direction changes;
- backpedal is not forward animation played backward/rotated;
- strafe has its own body language;
- start/stop transitions are blended;
- jump has takeoff/air/landing;
- hit reaction is additive when gameplay allows locomotion;
- CC poses remain distinct.

### Mage

Adversarial visual checklist:

- staff does not look welded to hand;
- shoulder/elbow/wrist chain is visible;
- locomotion does not swing staff like a pendulum disconnected from body;
- cast plants the body;
- free hand contributes;
- prepare/gather/channel/release/recovery can be visually distinguished;
- staff normal does not look like a full spell cast;
- release VFX starts at release, not before.

### Archer

- bow arm stable;
- string/draw arm clearly pulls back;
- normal reads raise/nock/draw/release/recoil;
- power weave can begin without waiting for all visual follow-through;
- arrow originates at correct weapon location.

### Warrior

- horizontal and diagonal normals are distinct;
- pelvis/torso lead the weapon;
- kick is not a reskinned swing;
- shield bash uses shield body mechanics;
- charge reads as forward commitment;
- heavy weapon skill has stronger anticipation/follow-through;
- weight comes from pose timing, not delayed input.

---

## 9. VFX gate

For each gameplay effect family verify three things:

1. **start event** is correct;
2. **world attachment/origin** is correct;
3. **impact/result timing** matches simulation.

Required visual families:

- normal melee;
- heavy melee;
- bow release;
- arrow trail/impact;
- staff normal;
- magical projectile;
- heal;
- barrier;
- root;
- knockdown/stun feedback;
- silence;
- reflect;
- block;
- cleanse/purge;
- anti-heal;
- anti-buff;
- death.

FAIL if the only difference between important effect families is arbitrary color when shape/motion should differ.

---

## 10. UI gate

### Match HUD

Verify:

- player HP/resource are readable;
- target frame is clear;
- cast bar timing equals simulation;
- cooldown begins at authoritative commit/release;
- status icons are not visually ambiguous;
- ability icons remain legible at gameplay scale;
- team frames work in 2v2;
- debug information can be hidden;
- HUD does not obscure center combat space.

### Lobby/results

Verify:

- class role is understandable;
- start/queue action is obvious;
- ladder/rating is visible but not dominant;
- result and rating delta are unambiguous;
- rematch/return controls work.

---

## 11. Arena/map gate

A main arena fails if it is merely larger or prettier without supporting PvP.

Check:

- spawn points do not create immediate unfair LoS;
- ranged classes have usable long sightlines;
- melee classes have routes/cover to close distance;
- center is contestable;
- obstacles have collision matching visuals;
- LoS blockers are understandable;
- no invisible collision traps;
- no camera clipping hotspots that materially affect combat;
- props do not hide telegraphs/status readability;
- boundaries are obvious;
- pathing for bots is viable.

---

## 12. Ladder/match-state gate

For every match mode test:

```text
LOBBY
→ COUNTDOWN
→ ACTIVE
→ ROUND/MATCH END
→ RESULTS
→ REMATCH/RETURN
```

Adversarial cases:

- player dies during simultaneous final hit;
- both teams die same tick;
- player presses rematch repeatedly;
- class change during illegal phase;
- result event emitted twice;
- rating applied twice;
- reset leaves old statuses/projectiles;
- new round inherits stale cooldown/queue/action state.

Match flow must be deterministic and idempotent where appropriate.

---

## 13. Bot legality gate

Bots must never use privileged shortcuts.

Audit that bots obey:

- facing;
- LoS;
- range;
- movement restrictions;
- cast cancellation;
- GCD;
- cooldown;
- resource;
- targetability;
- CC.

A bot may react faster than a human profile if intentionally configured, but it may not violate rules.

---

## 14. Performance gate

Measure integrated combat, not an empty scene.

Target:

- smooth 60 FPS on a reasonable desktop browser;
- no frame stalls when several VFX overlap;
- stable fixed tick;
- no geometry/material creation in per-frame hot paths unless justified;
- particle systems bounded;
- no runaway object accumulation after repeated matches/resets.

### Leak/reset test

Run repeated match/reset cycles and verify:

- entity count returns to expected level;
- projectiles/zones clear;
- VFX pools return/reuse;
- event listeners do not multiply;
- DOM UI nodes do not grow unbounded;
- Three.js objects/materials are disposed or reused appropriately when destroyed.

---

## 15. Adversarial arbiter expansion

`tools/arbiter.js` should progressively cover:

### Timing

- movement one tick before release;
- movement on release tick according to defined order;
- weave one tick before normal release;
- replace one tick before normal release;
- power one tick after release;
- GCD and weapon interval ending same tick;
- target range/LoS invalidation one tick before release;
- queue replacement;
- simulated input latency.

### Control

- click deadzone edge;
- very large mouse delta;
- opposite-direction mouse deltas in adjacent frames;
- stun during mouse steer;
- free-look release while moving;
- jump during cast.

### Match flow

- simultaneous deaths;
- repeated rematch/reset;
- stale projectiles between rounds;
- rating double-commit.

---

## 16. Visual critic protocol

Use a separate critic from the primary builder whenever possible.

The critic receives screenshots/video/state captures and is instructed:

> Do not defend the implementation. Find everything that looks unfinished, unclear, stiff, inconsistent, cheap, visually noisy or mechanically misleading.

Score 1–5:

- locomotion;
- character silhouette;
- attack readability;
- cast readability;
- VFX timing;
- arena composition;
- UI hierarchy;
- visual cohesion;
- camera feel;
- overall “real game” impression.

Any category below **4/5** requires another correction pass before final acceptance unless the limitation is explicitly out of scope.

“Awwwards/AAA” is a quality aspiration for polish and cohesion, not permission to prioritize decoration over gameplay readability.

---

## 17. Fresh-review gate

Before final completion, use a reviewer that did not perform the implementation.

It must search for:

- omitted acceptance criteria;
- duplicated systems;
- hidden authority violations;
- missing VFX/audio/icon families;
- inconsistent timing;
- dead-end UI flows;
- broken class identity;
- visual states that cannot be read;
- exploitable edge cases;
- untested reset paths.

Critical findings return the build to the fix loop.

---

## 18. Milestone acceptance report

A final QA report must state exact results:

### Automated

```text
run-tests: X/X passed
arbiter: APPROVED / FAILED
browser smoke: PASSED / NOT RUN / FAILED
```

### Visual

- screenshots/capture inspected;
- critic score by category;
- issues fixed;
- remaining known limitations.

### Performance

- measured environment;
- FPS/frame-time observation;
- stress case used.

### Product flow

- lobby → match → results → rematch verified;
- modes verified;
- ladder/rating verified.

Never write “all good” without evidence.
