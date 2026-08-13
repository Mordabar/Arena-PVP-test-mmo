# ARENA_VERTICAL_SLICE_SPEC.md — Arena Ladder PvP Vertical Slice

## 1. Purpose

This specification defines the next **macro target** for Project Arena.

The goal is no longer a sequence of isolated Combat Lab improvements. The goal is a small but coherent **Arena Ladder PvP game slice** that demonstrates the final product's core promise.

The slice should be strong enough that a new player can launch it, understand the loop, choose a class, fight, win or lose, see a result/rating change and immediately want another match.

---

## 2. Product fantasy

Project Arena is a competitive fantasy PvP arena game built around the deliberate target-based timing language discussed throughout the project.

Primary combat inspiration: **Champions of Regnum / Regnum Online gameplay principles**, modernized for responsiveness.

We want:

- tactical stop-and-go combat;
- target selection;
- body-relative movement;
- manual facing;
- range and LoS;
- normal attacks as part of rotation rhythm;
- distinct relationships between normals and powers;
- cast commitment;
- movement cancellation before release;
- GCD and input queue;
- class counters;
- readable CC;
- positional teamplay.

We do NOT want:

- shooter free-aim combat;
- constant attacking while sprinting;
- universal auto-facing;
- animation-locked action-RPG combat;
- every damage skill behaving identically;
- visual spectacle that hides timing.

---

## 3. Current six-class roster

The vertical slice uses the existing six sub-classes.

### Devastador

Role: melee burst / initiation.

Identity:

- commits to melee range;
- strong normal/weapon-skill rhythm;
- knockdown/initiation;
- armor pressure;
- risky offensive windows.

### Guardián

Role: protection / peel.

Identity:

- deterministic defense;
- block;
- ally protection;
- reflect;
- damage redirection;
- tactical disruption.

### Centinela

Role: long-range physical damage.

Identity:

- stop-shot rhythm;
- normal arrow matters;
- normal → weave powers;
- positional range advantage;
- vulnerable if collapsed on.

### Rastreador

Role: tactical control / information.

Identity:

- stealth;
- traps;
- anti-heal;
- utility denial;
- information/reveal;
- opportunistic weapon skills.

### Arcanista

Role: magical burst / control / anti-support.

Identity:

- planted casts;
- cast → release → GCD chain;
- root/stasis/anti-buff;
- powerful timing windows;
- vulnerable to movement pressure and interrupts.

### Vinculador

Role: support / heal / counters.

Identity:

- direct heal;
- HoT;
- barriers;
- cleanse;
- Intervention;
- ally damage mitigation;
- resource-limited sustain.

---

## 4. Complete vertical-slice loop

The slice is not complete until this loop exists:

```text
BOOT
  ↓
TITLE / LOBBY
  ↓
PLAYER IDENTITY / LOCAL PROFILE
  ↓
CLASS SELECT
  ↓
OPTIONAL LOADOUT / QUICK EXPLANATION
  ↓
QUEUE / MATCH START
  ↓
ARENA INTRO
  ↓
ROUND / MATCH
  ↓
VICTORY / DEFEAT
  ↓
RESULTS
  ↓
RATING / LADDER FEEDBACK
  ↓
REMATCH / RETURN TO LOBBY
```

Production networking is not required for this slice. The flow may initially use bots/local matches and a local deterministic rating prototype, but it must be architecturally separated from future server authority.

---

## 5. Required modes

### 5.1 Training / Combat Lab

Keep the current lab as an expert/debug environment.

Required stations:

- normal timing;
- stop-shot;
- weave;
- replace-normal;
- cast cancellation;
- GCD chaining;
- facing/range/LoS;
- CC/counter testing.

### 5.2 Ladder Duel 1v1

Primary polished slice mode.

Requirements:

- class select;
- deterministic arena spawn;
- pre-round countdown;
- win condition;
- post-match summary;
- rating update;
- rematch.

### 5.3 2v2 Skirmish

Must exist at least as a functional prototype because support/peel classes require team context.

### 5.4 3v3 readiness

Architecture/data must not prevent 3v3. A fully polished 3v3 mode is optional for the first slice if performance/content time is better spent polishing 1v1/2v2.

---

## 6. Ladder prototype

The vertical slice needs a visible competitive progression loop even if the first implementation is local.

Minimum:

- rating number;
- placement/unranked state;
- simple rank tiers with original Arena naming/art direction;
- match result delta;
- wins/losses;
- recent-match summary;
- rematch button.

Do not fake production security. Clearly isolate local profile/rating code so it can later be replaced by an authoritative backend.

---

## 7. Arena environment target

Create at least one polished compact fantasy arena and one training variant.

### Main arena principles

- medium-small PvP scale;
- enough open space for long-range play;
- enough obstacles for LoS play;
- at least two meaningful lateral routes;
- central contested area;
- no clutter that blocks readability;
- no giant empty field;
- boundaries visually obvious;
- camera-safe geometry.

### Environment grammar

Use systems/factories for:

- trees;
- rocks;
- ruins;
- columns;
- banners;
- braziers;
- grass/ground clusters;
- path decals/geometry;
- arena boundary dressing.

Three.js may use low-poly generated/assembled content until real asset production begins.

### Visual direction

Stylized fantasy with restrained saturation, readable silhouettes and clean combat contrast. The arena should feel authored, not like random primitive scattering.

---

## 8. Character visual target

The web slice does not require final AAA meshes, but characters must stop reading as “debug mannequins”.

At MMO camera distance each class family needs:

- clear humanoid proportions;
- readable hands/feet/head;
- clear torso/pelvis hierarchy;
- class-specific silhouette;
- weapon silhouette;
- armor/clothing layers;
- differentiated material response;
- clean selection/target presentation.

### Archetype equipment

**Warrior:** armor plates, belt/faldón, shoulders, melee weapon, shield where applicable.

**Archer:** leather/cloth, quiver, bow, daggers for secondary identity.

**Mage:** robe/tunic, hat/hood variant, staff, magical focus details.

Do not spend the entire milestone creating microdetail from primitives. The architecture must remain ready for GLB/Unity skinned meshes.

---

## 9. Animation target

Read `docs/ANIMATION_REFERENCE_V07.md`.

The supplied Regnum screenshots establish reference principles for mage/archer body language. We reproduce **timing logic and readability**, not literal clips.

### Locomotion set

Every archetype must clearly support:

- idle;
- start forward;
- forward;
- forward-left/right;
- strafe left/right;
- backpedal;
- back-left/right;
- turn in place;
- stop;
- jump takeoff;
- airborne;
- landing;
- hit reaction;
- hard-CC body language;
- death/get-up where applicable.

### Mage

- shorter controlled stride;
- stable upper body;
- staff inertia;
- planted casting;
- free-hand magic gesture;
- staff normal distinct from spell;
- cast families must differ in silhouette, not only particle color.

### Archer

- lighter gait;
- bow carriage remains plausible while moving;
- draw sequence reads clearly;
- release marker matches authoritative normal/power release;
- weave power can blend over normal follow-through.

### Warrior

Original Arena animation grammar:

- normal horizontal;
- normal diagonal;
- kick;
- shield bash;
- charge;
- heavy weapon skill;
- block/guard;
- knockdown/get-up.

Actions must show a kinetic chain through pelvis/torso rather than rotating one limb.

---

## 10. Combat timing target

Current `docs/COMBAT_TIMING_MATRIX.md` is the baseline.

The slice must preserve:

### Normal attack

```text
READY → WINDUP → RELEASE → RECOVERY
```

- stationary requirement when specified;
- interval can become ready while moving;
- movement before release cancels windup;
- no damage before release;
- no phantom hit on cancellation.

### Cast

```text
READY → PREPARE → CASTING → RELEASE → GCD/RECOVERY
```

- resource/CD/GCD commit at release;
- movement/jump/manual cancel before release has no committed effect under current policy;
- enemy interrupt remains distinct and may cause school lockout;
- range/LoS/facing revalidate at release.

### Weaving

Examples of required behavior patterns:

- archer normal → weave power;
- archer normal → control/utility weave where data allows;
- warrior normal → kick-like tactical action;
- weapon skill before normal release may replace pending normal where metadata says so;
- released normal can never be erased retroactively;
- mage spell request outranks auto-starting staff normal.

---

## 11. Combat readability target

A spectator should be able to identify without reading the combat log:

- who is selected;
- who is casting;
- what phase the cast is in;
- release moment;
- projectile direction;
- normal attack release;
- root;
- stun/knockdown;
- silence;
- barrier;
- reflect;
- block;
- heal;
- anti-heal;
- anti-buff;
- death.

Do not solve readability by covering characters in huge effects.

---

## 12. VFX target

Build a reusable VFX grammar.

At minimum:

### Physical

- light melee impact;
- heavy melee impact;
- shield impact;
- charge impact;
- arrow release;
- arrow trail;
- arrow impact;
- trap trigger.

### Magic

- staff normal pulse;
- direct projectile;
- control spell;
- anti-heal/debuff;
- root;
- stasis;
- heal;
- HoT;
- barrier;
- reflect;
- Intervention;
- cleanse/purge;
- anti-buff.

Each family should expose parameters rather than duplicate full systems.

---

## 13. UI / UX target

The vertical slice needs a cohesive game UI, not only debug panels.

### Lobby

- title/identity;
- class cards;
- role description;
- ability preview;
- queue/start;
- ladder/rating summary.

### Match HUD

- player HP/resource;
- target frame;
- ability bar;
- cooldown numbers/radials;
- cast bar;
- selected-target marker;
- status icons;
- team frames in 2v2;
- round/match score;
- concise combat feedback.

### Results

- win/lose;
- rating delta;
- basic combat stats;
- rematch;
- return.

### Debug

F3/debug may expose weapon state, cast state, queue, AnimationIntent and timeline. Debug UI must remain separate from the clean player HUD.

---

## 14. Iconography target

Ability icons must communicate function at a glance.

Create a consistent original grammar:

- weapon/physical;
- control;
- defense;
- mobility;
- heal;
- barrier;
- magic damage;
- utility;
- counter.

Icons may be generated as SVG/data-driven placeholders, but they must look like one coherent set rather than arbitrary symbols.

---

## 15. Audio target

The first slice needs minimal but intentional combat audio.

Required event categories:

- UI select/confirm;
- round start;
- melee swing/release;
- physical impact;
- bow release;
- arrow impact;
- staff normal;
- spell prepare/release;
- heal/barrier;
- interrupt;
- block/reflect;
- crowd control;
- low-resource/invalid-action feedback;
- victory/defeat.

Use original/generated placeholders. Never use proprietary Regnum audio.

---

## 16. Bots target

Bots are product content and QA infrastructure.

Required profiles:

- simple melee pressure;
- ranged kiter;
- caster burst/control;
- support healer;
- defensive peel;
- ladder sparring opponent.

Bots must obey all player restrictions.

A bot that can cast through walls or auto-face illegally invalidates the test environment.

---

## 17. Content quantity for the slice

The goal is breadth without uncontrolled scope.

Required:

- six existing classes fully selectable;
- existing six-actives-plus-passive kit preserved;
- one polished main arena;
- one Timing/Training Lab;
- one polished 1v1 flow;
- functional 2v2 flow;
- ladder/rating prototype;
- complete VFX coverage for every currently used effect family;
- coherent icon set for every current ability;
- at least one readable low-poly visual family per archetype;
- sufficient bot profiles to exercise every class role.

Optional only after required scope is polished:

- second main arena theme;
- 3v3 polish;
- cosmetic palette selection;
- spectator camera.

---

## 18. Out of scope for this vertical slice

Unless explicitly promoted into scope:

- open world;
- quests;
- crafting;
- loot economy;
- large inventory system;
- monetization;
- guilds;
- production account backend;
- production matchmaking backend;
- persistent MMO zones;
- final AAA character assets.

The slice sells **combat**, not MMO breadth.

---

## 19. Performance target

Web slice target:

- responsive 60 FPS on a reasonable desktop browser;
- stable 30 Hz simulation;
- no visible input latency caused by presentation;
- pooled/reused VFX where appropriate;
- no per-frame geometry rebuilding in normal play;
- map expansion must not create dramatic frame-time spikes.

Measure integrated gameplay, not empty-scene FPS.

---

## 20. Definition of Done

The vertical slice is complete only when:

### Product loop

- [ ] lobby exists;
- [ ] all six classes selectable;
- [ ] 1v1 match starts and ends cleanly;
- [ ] 2v2 is functionally playable;
- [ ] results screen exists;
- [ ] rating/ladder feedback exists;
- [ ] rematch/return works.

### Combat

- [ ] tactical normal/power rhythm preserved;
- [ ] cast cancellation/release semantics preserved;
- [ ] facing/range/LoS preserved;
- [ ] CC/counters remain readable and correct;
- [ ] every current ability has valid timing metadata.

### Controls

- [ ] W/S/A/D correct;
- [ ] mouse steering 1:1;
- [ ] free-look body-independent;
- [ ] jump correct;
- [ ] no accidental click-drag selection/camera conflict.

### Animation

- [ ] mage locomotion/staff no longer reads as robotic;
- [ ] archer draw/release reads clearly;
- [ ] warrior normals/kick/heavy families read distinctly;
- [ ] foot sliding is acceptable at normal camera distance;
- [ ] visual release never precedes authoritative release.

### Presentation

- [ ] one polished arena;
- [ ] characters readable at gameplay distance;
- [ ] VFX cover all active effect families;
- [ ] icons form a coherent set;
- [ ] clean match HUD;
- [ ] lobby/results UI visually coherent;
- [ ] essential audio feedback present.

### QA

- [ ] all automated tests pass;
- [ ] arbiter passes;
- [ ] browser smoke passes where tooling permits;
- [ ] visual audit passes;
- [ ] performance budget passes;
- [ ] fresh reviewer has no critical open defects.

A build is not “done” merely because all checkboxes in code exist. The integrated loop must feel like a game rather than a collection of systems.
