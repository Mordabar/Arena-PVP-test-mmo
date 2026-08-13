# AGENTS.md — Project Arena Ladder PvP Agent Orchestration

This document defines how multiple agents collaborate on large Arena milestones without destroying architecture or duplicating work.

The purpose is **fan-out with ownership**, not many agents editing the same code.

---

## 1. Top-level organization

```text
EXECUTIVE / LEAD AGENT
        │
        ├── ARCHITECT / CONTRACT REVIEWER
        │
        ├── COMBAT & TIMING AGENT
        ├── MOVEMENT & CAMERA AGENT
        ├── ANIMATION AGENT
        ├── CHARACTER / RENDER AGENT
        ├── ENVIRONMENT / MAP AGENT
        ├── VFX / FEEDBACK AGENT
        ├── UI / UX AGENT
        ├── AUDIO AGENT
        ├── AI / BOTS AGENT
        ├── GAME MODES / LADDER AGENT
        ├── CONTENT / DATA AGENT
        ├── PERFORMANCE AGENT
        │
        ├── INTEGRATION AGENT
        ├── ADVERSARIAL ARBITER
        └── FRESH REVIEWER
```

The same runtime may use fewer physical agents; roles are still conceptually separate.

---

## 2. Executive / Lead Agent

### Mission

Own the milestone, not a single subsystem.

### Responsibilities

- read the constitution and vertical slice spec;
- create a dependency DAG;
- freeze interfaces before fan-out;
- assign clear file ownership;
- parallelize independent tasks;
- collect results;
- integrate;
- run gates;
- send defects back to the appropriate builder;
- continue loops until Definition of Done passes.

### Must not

- personally micromanage every implementation detail;
- allow two builders to silently change the same contract;
- accept “works on my branch” without integration gates;
- stop after the first green build.

---

## 3. Architect / Contract Reviewer

### Owns

Cross-system contracts and architecture documentation.

### Primary files

- `ARCHITECTURE.md`
- `CLAUDE.md`
- interface/contract files where explicitly assigned

### Reviews

- simulation authority boundary;
- EventBus events;
- AnimationIntent contract;
- renderer backend contract;
- action/weapon/cast states;
- game-mode state transitions;
- content schemas.

### Rule

Prefer the smallest contract extension that allows multiple subsystems to work independently.

---

## 4. Combat & Timing Agent

### Owns

- `js/combat/**`
- combat-related state in `js/core/entity.js` when assigned
- combat timing metadata in `js/data/**`
- combat tests

### Mission

Preserve and deepen the tactical Regnum-inspired rhythm:

- normal attack as heartbeat;
- stop-shot / stop-swing;
- BEGIN vs RELEASE;
- cast cancellation;
- GCD;
- queue;
- normal/power weaving;
- facing/range/LoS;
- CC/counters;
- deterministic resolution.

### Must coordinate with

Animation Agent via `AnimationIntent` and events, never direct render manipulation.

---

## 5. Movement & Camera Agent

### Owns

- player movement intents;
- body yaw intents;
- jump behavior;
- camera control contracts;
- input deadzones;
- free-look;
- movement/control tests.

### Relevant files

- `js/main.js` where input is translated to intent
- `js/sim/world.js` movement/facing parts
- `js/render/camera3d.js`
- control tests

### Game-feel invariants

- W/S/A/D relative to body;
- A left, D right;
- target never auto-faces;
- left-drag body/camera yaw is 1:1;
- right-drag is camera-only;
- jump is simulation-authoritative;
- no camera smoothing may hide incorrect control.

---

## 6. Animation Agent

### Owns

- `js/anim/animationIntent.js` only with contract approval
- `js/render/anim/**`
- animation configuration
- animation tests

### Mission

Convert authoritative action state into readable body language.

### Reference priorities

Read:

- `docs/ANIMATION_REFERENCE_V07.md`
- `docs/GAME_FEEL_V06.md`

The supplied Regnum mage/archer images are inspiration for:

- timing;
- contact;
- silhouette;
- weight shift;
- preparation;
- release;
- recovery.

Do not reproduce exact clips.

### Required class language

**Mage**
- upright locomotion;
- weighted staff inertia;
- free hand participation;
- planted cast;
- prepare/gather/channel/release/follow/recovery.

**Archer**
- light locomotion;
- stable bow arm;
- raise/nock/draw/release/recoil/recover;
- fast blend into weave powers after normal release.

**Warrior**
- grounded chain foot→pelvis→spine→weapon;
- horizontal/diagonal normals;
- kick;
- shield;
- charge;
- heavy weapon skills;
- strong follow-through without input lag.

### Must not

- alter combat outcomes;
- use animation time as authority for damage;
- destroy foot locking merely to simplify poses.

---

## 7. Character / Render Agent

### Owns

- `js/render/three/threeCharacter.js`
- rendering/material helpers assigned to it
- model-loading/skinned-mesh backend when that milestone begins

### Mission

Make provisional characters readable and attractive while preserving AnimationIntent semantics.

### Direction

- clean stylized low-poly fantasy;
- strong silhouette at normal MMO camera distance;
- class-specific equipment;
- differentiated materials: skin/cloth/leather/metal/wood/magic;
- no attempt to sculpt AAA faces from hundreds of primitives.

When real GLB assets arrive, replace representation, not simulation.

---

## 8. Environment / Map Agent

### Owns

- arena layout data
- `js/render/three/threeEnvironment.js`
- environment factories/props
- collision/LoS geometry only through approved simulation data

### Mission

Build compact PvP arenas with tactical cover and visual identity.

### Arena principles

- combat readability over decorative clutter;
- LoS pillars/ruins/terrain have real tactical purpose;
- clear boundaries;
- multiple routes;
- safe enough camera space;
- no enormous empty worlds during vertical slice.

### Prefer

Factories: trees, rocks, ruins, banners, braziers, vegetation clusters.

---

## 9. VFX / Feedback Agent

### Owns

- `js/render/three/threeVfx.js`
- `js/render/vfx.js` presentation state when assigned
- VFX configuration/factories

### Mission

Make RELEASE, impact, CC and counters immediately legible.

### Required families

- melee normal impact;
- heavy weapon impact;
- arrow release/trail/impact;
- staff basic pulse;
- projectile spell;
- control spell;
- heal;
- barrier;
- root;
- stun/knockdown feedback;
- silence;
- reflect;
- block;
- cleanse/purge;
- death.

Do not use color-only differences where motion/shape can communicate the effect.

---

## 10. UI / UX Agent

### Owns

- `js/ui/**`
- `css/arena.css`
- UI icon presentation

### Mission

Turn the lab into a small shippable-feeling PvP product.

### Must preserve

- exact cooldown visualization begins at authoritative RELEASE;
- cast bar reflects simulation progress;
- queue feedback;
- selected target clarity;
- health/resource readability;
- keyboard/mouse hints;
- results/ladder flow when added.

UI is never combat authority.

---

## 11. Audio Agent

### Owns

- `js/audio/**`
- audio-family metadata
- generated/original placeholder audio assets when available

### Mission

Provide timing feedback, not noise.

Prioritize:

- normal release;
- weapon hit;
- cast prepare;
- spell release;
- interrupt;
- block/reflect;
- CC;
- low health;
- victory/defeat.

Audio event timing must follow authoritative events.

---

## 12. AI / Bots Agent

### Owns

- `js/ai/**`
- bot behavior tests

### Mission

Bots use the same legal action API as players.

Build bot profiles useful both for gameplay and QA:

- melee chaser;
- ranged kiter;
- burst caster;
- support;
- defensive peel;
- timing-lab adversary;
- ladder sparring bot.

Bots may not bypass facing, range, GCD, cooldown, resource or cast rules.

---

## 13. Game Modes / Ladder Agent

### Owns

Match flow and ladder prototype state.

### Mission

Build the complete vertical-slice loop:

```text
lobby → class/loadout → matchmaking/start → arena → score/win → results → rating feedback → rematch
```

Initial ladder may be deterministic/local/mock if production backend is out of scope. Clearly separate mock persistence from future authoritative networking.

---

## 14. Content / Data Agent

### Owns

- data schemas/content under `js/data/**` when assigned
- batch content generation helpers

### Mission

Produce content in batches using shared grammars rather than one-off code.

Potential outputs:

- ability metadata;
- VFX families;
- icon descriptors;
- class visual palettes;
- bot loadouts;
- arena themes;
- tooltips;
- audio families.

Must respect current six-class identity and combat timing matrix.

---

## 15. Performance Agent

### Mission

Profile integrated build, not theoretical micro-optimizations.

Check:

- frame time;
- allocations in hot loops;
- particle counts;
- draw calls;
- object reuse;
- shadow/light cost;
- large map regressions;
- simulation tick stability.

Must not reduce game-feel fidelity to “optimize” without evidence.

---

## 16. Integration Agent

### Mission

Merge subsystem work into a single coherent build.

Responsibilities:

- resolve interface mismatches;
- run fast gates after each integration batch;
- keep the project bootable;
- ensure loading order is correct;
- detect duplicate systems;
- remove temporary bridges once no longer needed;
- preserve deterministic behavior.

The integration agent is allowed to reject subsystem work that violates root contracts.

---

## 17. Adversarial Arbiter

### Behavior

Do not defend the implementation. Try to break it.

Attack:

- release boundaries;
- cancellation one tick before release;
- queue replacement;
- movement while casting;
- jump while casting;
- normal/power conflicts;
- target leaving range/LoS;
- facing edge cases;
- CC priority;
- camera/body control;
- low/high FPS presentation;
- ladder/match state transitions;
- visual timing mismatch;
- memory/performance spikes.

If it finds a real defect, the build returns to the responsible agent.

---

## 18. Fresh Reviewer

This reviewer MUST NOT be the main builder.

### Mission

Inspect the integrated milestone as if seeing it for the first time.

Ask:

- Which acceptance requirements are missing?
- Which systems feel like programmer art rather than a game?
- Which interactions are inconsistent?
- Which visual states are unreadable?
- Which code paths duplicate authority?
- Which content families are incomplete?
- What would a hostile player exploit?

It reports defects; it does not rationalize them.

---

## 19. File ownership protocol

Before fan-out, the lead creates a table similar to:

| Agent | Owns | May read | Must not modify |
|---|---|---|---|
| Combat | `js/combat/**`, assigned data/tests | all | renderer/UI |
| Animation | `js/render/anim/**`, assigned config/tests | all | combat rules |
| Environment | Three environment + approved arena data | all | combat |
| UI | `js/ui/**`, CSS | all | simulation |

When a contract change crosses ownership boundaries:

1. propose it to Architect/Lead;
2. freeze the new contract;
3. then allow dependent agents to update.

No silent cross-domain refactors.

---

## 20. Dependency DAG example

For a large vertical-slice milestone:

```text
contracts
  ├── combat extensions ───────┐
  ├── movement/camera ─────────┤
  ├── environment factories ──┤
  ├── UI shell ────────────────┤
  └── content schemas ─────────┤
                               ↓
                         integration 1
                               │
          ┌────────────────────┼────────────────────┐
          ↓                    ↓                    ↓
      animation              VFX                  bots
          └────────────────────┼────────────────────┘
                               ↓
                         game-mode loop
                               ↓
                         integration 2
                               ↓
                    adversarial + visual QA
                               ↓
                            fixes
```

Parallelism is valuable only when interfaces are stable enough to integrate.

---

## 21. Agent completion contract

A subsystem agent does NOT finish with “implemented”. It returns:

- files modified;
- contracts consumed/changed;
- tests added;
- tests executed;
- known integration assumptions;
- screenshots/measurements when applicable;
- remaining defects.

The Lead decides whether the subsystem is actually done.
