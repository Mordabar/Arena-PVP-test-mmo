# CLAUDE.md — Project Arena Ladder PvP Constitution

> **READ THIS FILE FIRST.** This is the root contract for every coding agent, sub-agent, reviewer and integrator working on Project Arena.
>
> The goal is not to produce isolated improvements. The goal is to autonomously advance the **Arena Ladder PvP vertical slice** in large, integrated milestones while preserving the validated combat feel.

---

## 1. Product mission

Build a third-person 3D fantasy PvP arena game whose combat language is inspired by the **timing, positional commitment and target-based tactical feel of Champions of Regnum / Regnum Online**, while remaining an original game with its own classes, names, abilities, models, VFX, maps, UI, audio and balance.

The intended feel is:

> **RESPONSIVE IN THE HANDS. TACTICAL IN THE HEAD.**

The player should immediately understand that:

- movement has consequences;
- stopping has consequences;
- facing matters;
- range and line of sight matter;
- attack interval matters;
- the normal attack matters;
- the relationship between a power and the normal attack matters;
- RELEASE is the irreversible moment of an action;
- GCD matters;
- input queue matters;
- crowd control and counters matter;
- the character must still feel responsive and under direct control.

This is **not** a shooter, Souls-like, hack-and-slash or free-aim action RPG. It is a **target-based 3D MMORPG-style PvP combat system** with deliberate stop-and-go rhythm and modern input responsiveness.

### Reference boundary

Champions of Regnum is a **behavioral reference only**. NEVER copy:

- proprietary assets;
- exact animations;
- maps;
- icons;
- audio;
- lore;
- protected names;
- characters;
- exact numerical balance.

We extract principles: timing, commitment, positional play, normal/power weaving, cast cancellation, role identity, body language and readable combat states. Project Arena must remain visually and mechanically original.

---

## 2. Current validated baseline

Current project baseline: **Animation Reference Pass v0.7**.

Validated at handoff:

- `node tools/run-tests.js` → **206/206 passed**
- `node tools/arbiter.js` → **ARBITER: APROBADO**

The current build already contains:

- fixed-tick simulation at 30 Hz;
- deterministic RNG;
- EventBus;
- six PvP sub-classes;
- AbilitySystem / StatusSystem / Resolver;
- normal attack timeline with READY/WINDUP/RELEASE/RECOVERY;
- BEGIN vs RELEASE semantics;
- cast cancellation before RELEASE without phantom cost/CD/GCD;
- data-driven normal/power weaving policies;
- 200 ms input queue;
- line of sight, range and collision;
- jump in fixed tick;
- mouse steer and free-look;
- AnimationIntent;
- procedural locomotion with foot locking and two-bone IK;
- Three.js presentation plus native WebGL fallback;
- VFX, icons, HUD, combat log;
- Timing Lab;
- adversarial arbiter;
- visual audit tooling.

**Preserve this baseline unless a deliberate design change is documented and tested.**

---

## 3. Authority rule — NEVER violate

The game is organized as:

```text
INPUT
  → COMMAND / INTENT
  → VALIDATION
  → ACTION STATE
  → RELEASE
  → RESOLUTION
  → EVENTS
  → PRESENTATION
```

### Simulation is the only authority

NO file under `js/render/**`, `js/ui/**`, Three.js code, animation code, VFX code or camera code may EVER directly decide or mutate:

- HP;
- resource;
- cooldown;
- GCD;
- status result;
- damage result;
- healing result;
- cast success;
- attack success;
- authoritative position;
- authoritative yaw;
- authoritative jump state;
- target legality;
- projectile outcome.

Presentation reads simulation and events. It never owns combat truth.

### RELEASE is irreversible

Before RELEASE an action may be:

- cancelled;
- replaced;
- queued behind another action;
- invalidated;
- interrupted.

After RELEASE the action already happened. Never retroactively delete its damage, projectile, committed resource, cooldown or event.

---

## 4. Core game-feel laws

### 4.1 Movement

- `W`: forward relative to character yaw.
- `S`: backpedal; never auto-turn.
- `A`: strafe left.
- `D`: strafe right.
- `Q/E`: body turn when keyboard turning is used.
- Diagonal movement is normalized.
- Camera direction never replaces character forward.

### 4.2 Left mouse direct body control

Short left click selects.

Left drag after the deadzone means direct control:

```text
horizontal mouse delta
  → camera yaw delta
  → exact same body yaw delta
```

For mouse steering:

```text
deltaYawCharacter === deltaYawCamera
```

No TURN_SPEED cap, follow lag or heavy smoothing. Mouse movement is the authority for the requested body rotation; simulation still applies the resulting intent.

### 4.3 Right mouse free-look

Right drag rotates camera only. It must not change body yaw. Releasing it causes no snap.

### 4.4 Target does not auto-face

Selecting or attacking a target never magically rotates the player. Targeted offensive actions validate facing.

### 4.5 Normal attack is a separate subsystem

Normal attacks are NOT ordinary abilities.

```text
READY → WINDUP → RELEASE → RECOVERY → READY
```

The weapon interval may become ready while moving. Movement blocks/cancels the windup before RELEASE; it must not make the player wait a fresh full weapon interval after stopping.

This is the desired tactical rhythm:

```text
move → stop → normal → power → move
```

### 4.6 Powers declare their relation to the normal attack

EVERY ability must declare combat timing metadata. Never infer behavior merely because an ability deals damage.

Supported concepts include:

- `independent`
- `weaveAfterNormal`
- `replacesNormal`
- `blocksNormal`

and weapon interval policies such as:

- `ignore`
- `respectReady`
- `consume`
- `reset`

### 4.7 Casts commit at RELEASE

A stationary spell begins as a pending cast. At BEGIN it must not permanently consume its resource, cooldown or GCD.

At successful RELEASE:

1. revalidate target;
2. revalidate range;
3. revalidate LoS;
4. revalidate facing when applicable;
5. confirm resource;
6. consume resource;
7. start cooldown;
8. start GCD;
9. emit release event;
10. create/resolve projectile/effect.

Movement, jump, manual cancel, hard control, death or invalidation before RELEASE cancel according to policy.

### 4.8 GCD and weapon interval are separate clocks

GCD blocks powers. It does not automatically freeze weapon readiness. A requested spell has deterministic priority over auto-starting a staff normal when both become legal.

### 4.9 Queue

Keep at most one future meaningful action. Default policy: **latest valid input wins**. Queue near GCD/normal RELEASE should preserve responsiveness without becoming an action buffer of many abilities.

---

## 5. Class identity

The current six sub-classes are the canonical prototype roles:

- **Devastador** — melee burst / initiation.
- **Guardián** — protection / peel.
- **Centinela** — long-range physical damage.
- **Rastreador** — tactical control / information.
- **Arcanista** — magical burst / control / anti-support.
- **Vinculador** — healing / barriers / counters.

Do not homogenize these classes to simplify implementation. Their game feel, attack cadence, body language, control options and counterplay must remain distinct.

---

## 6. Animation language — derived from the supplied references

The user supplied image sequences from Regnum for mage and archer movement/casting plus a derived original warrior language. These images are reference for **pose readability and timing principles**, not for literal clip copying.

Read `docs/ANIMATION_REFERENCE_V07.md` before touching character motion.

### Mage

Target language:

- upright but combat-ready locomotion;
- shorter controlled stride;
- staff visibly has mass and inertia;
- shoulder → elbow → wrist → staff chain;
- free hand participates in magic;
- planted casts;
- distinct `PREPARE → GATHER → CHANNEL → RELEASE → FOLLOW → RECOVERY`;
- basic staff pulse must remain visually distinct from a full spell cast.

The staff must NEVER look welded to the hand.

### Archer

Target language:

- lighter center of mass;
- slightly more forward intent than caster;
- stable bow arm;
- clear `RAISE → NOCK → DRAW → RELEASE → RECOIL → RECOVER`;
- strafe/backpedal must not look like forward walk rotated sideways;
- powers may begin blending immediately after a normal RELEASE when weaving allows it.

### Warrior — original Arena language

No literal source animation is being copied. Use an original grounded kinetic chain:

```text
foot → pelvis → spine → chest → shoulder → arm → weapon
```

Required families:

- normal horizontal slash;
- normal diagonal slash;
- kick / tactical CC;
- shield bash;
- charge;
- heavy weapon skill;
- block/guard;
- hit reaction;
- knockdown and get-up.

Weight comes from anticipation and follow-through, not input lag.

---

## 7. Long-horizon autonomous workflow

Every macro task is executed as a loop:

```text
PLAN
  → FAN OUT
  → BUILD
  → INTEGRATE
  → RUN FAST GATES
  → PLAY / CAPTURE
  → ADVERSARIAL REVIEW
  → FIX
  → REPEAT
  → FULL QA GATE
```

### Do not stop after one pass

Do NOT return merely because:

- code compiles;
- one screenshot looks acceptable;
- unit tests are green;
- a subsystem exists in a minimal form.

Continue until the requested milestone meets its Definition of Done and `QA_GATE.md` passes.

### Autonomy

Do not ask the user for approval after every file or pass.

You are authorized to:

- make reasonable implementation decisions;
- create internal helpers;
- refactor locally when needed;
- create data factories;
- add tests;
- add debug instrumentation;
- run multiple correction loops.

Only stop for a genuine external blocker or a product decision that cannot be inferred from this constitution/specification.

Put non-blocking uncertainties in `FUTURE_DECISIONS.md` rather than stopping the build.

---

## 8. Fan-out rules

Read `AGENTS.md`.

The lead/integrator should parallelize independent work aggressively. Examples:

- combat timing and bot AI may proceed independently;
- environment and icon generation may proceed independently;
- animation implementation and UI polish may proceed independently if interfaces are frozen;
- tests can be written in parallel with implementation.

Do not parallelize two agents into the same unstable files without explicit ownership.

The parent/lead retains responsibility for:

- contracts;
- integration;
- conflict resolution;
- regression testing;
- final quality.

---

## 9. Build systems, not one-off assets

Prefer factories/data-driven systems over hand-authoring isolated content.

Examples:

- `TreeFactory` rather than five hard-coded trees;
- `RockFactory` rather than one rock mesh;
- `VFXFamily` rather than a bespoke particle block per spell;
- ability icon grammar/factory rather than thirty unrelated icons;
- animation families + variants rather than one hard-coded pose per ability ID.

This is essential for producing substantial progress per autonomous run.

---

## 10. Data-driven content rule

EVERY repeatable design behavior that can vary by class/ability should be data-driven when practical.

Avoid:

```js
if (ability.id === 'specific_ability') { ... }
```

when the behavior can be represented by metadata such as:

- action type;
- cast family;
- visual action;
- normal interaction;
- weapon interval policy;
- stationary flag;
- movement policy;
- facing policy;
- VFX family;
- audio family;
- icon grammar.

---

## 11. Current technical constraints

Current web vertical slice:

- HTML/CSS/JavaScript;
- Three.js 0.160 vendored in `vendor/`;
- no npm requirement;
- no build step required;
- Hostinger-compatible static deployment;
- native WebGL fallback remains valuable;
- fixed 30 Hz simulation.

Do not introduce a mandatory package manager/build pipeline during the web vertical-slice milestone without an explicit architectural reason.

Future rendering backends may include Unity or a skinned-mesh Three.js backend. The combat core must remain portable.

---

## 12. Vertical slice target

Read `ARENA_VERTICAL_SLICE_SPEC.md`.

The target is not “a prettier Combat Lab”. It is an **Arena Ladder PvP vertical slice** that demonstrates a complete loop:

```text
boot
→ lobby
→ choose class/loadout
→ queue/start match
→ enter arena
→ tactical PvP combat
→ win/lose
→ results
→ ladder/rating feedback
→ replay/rematch
```

This may initially use bots/local simulation rather than production networking, but the loop must feel like a small real game.

---

## 13. Testing and QA

Read `QA_GATE.md`.

During implementation use fast targeted checks. Before declaring a milestone complete run the full gates.

Mandatory baseline gates include:

```bash
node tools/run-tests.js
node tools/arbiter.js
```

Browser/visual checks are also required whenever the environment supports them.

Tests are necessary but not sufficient. A build with green tests and visibly poor locomotion, VFX timing, UI readability or camera behavior is **not finished**.

---

## 14. Performance budgets for the web slice

Initial targets, not excuses for premature optimization:

- desktop target: 60 FPS;
- fixed simulation: 30 Hz;
- no new geometry/material allocation every frame in hot paths;
- reuse geometries/materials where practical;
- keep dynamic lights restrained;
- particle pools/factories preferred over uncontrolled allocations;
- arena-scale draw-call count must remain reasonable;
- no expensive visual system may compromise input responsiveness.

If a new system materially degrades frame pacing, fix it before expanding content.

---

## 15. Explicit anti-patterns

Reject any implementation that:

- lets renderer/UI determine combat truth;
- auto-faces the player to targets;
- attacks normally while running;
- applies damage before RELEASE;
- starts cooldown/GCD at cast BEGIN when the current rule requires RELEASE;
- consumes cast resource permanently on voluntary pre-release cancellation;
- uses frame-rate timers for combat;
- uses animation callbacks as authoritative hit logic;
- treats all damaging abilities as the same weapon interaction;
- destroys foot locking to hide locomotion problems;
- adds smoothing to hide incorrect mouse control;
- hard-codes a growing list of ability IDs into render/combat logic;
- replaces the working architecture with a framework rewrite merely for convenience;
- copies protected Regnum content.

---

## 16. Completion report format

At the end of a macro milestone report:

1. **Diagnosis** — what prevented the requested experience.
2. **Architecture** — contracts/states added or changed.
3. **Implemented scope** — substantial features, not file-by-file trivia.
4. **Files changed** — concise list.
5. **Tests** — exact counts/results.
6. **Arbiter findings** — what it broke and what was corrected.
7. **Visual/gameplay audit** — what was inspected and remaining defects.
8. **Performance** — relevant measurements.
9. **Known limitations** — only genuine remaining scope.
10. **Next macro milestone** — one recommended next step, not a list of tiny chores.

Never claim a visual/browser gate passed if it could not actually be executed.

---

## 17. First action for every new agent

Before coding:

1. read this file;
2. read `ARCHITECTURE.md`;
3. read `AGENTS.md`;
4. read `ARENA_VERTICAL_SLICE_SPEC.md`;
5. read `QA_GATE.md`;
6. read `docs/GAME_FEEL_V06.md`;
7. read `docs/ANIMATION_REFERENCE_V07.md`;
8. run the baseline tests;
9. inspect the exact subsystem it owns;
10. only then modify code.

The guiding rule is simple:

> **Preserve validated tactical feel, then expand breadth aggressively through clear architecture, parallel ownership, executable gates and adversarial review.**
