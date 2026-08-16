# Animation Reference v0.15 — imported Dark Elf

## Basis used in this pass

The supplied gameplay image package is treated as a **pose/timing reference**, never as an animation asset to copy. The useful observations are silhouette, weight transfer and sequencing at MMO camera distance.

## Caster / staff

The reference reads as an upright, planted caster rather than a melee fighter holding a stick. The staff is kept beside the body in locomotion, then the free hand becomes part of the spell gesture.

Implemented language:

`GUARD → PREPARE → GATHER → CHANNEL → RELEASE → FOLLOW → RECOVER`

- PREPARE: weight settles and both arms leave locomotion.
- GATHER: staff rises beside the shoulder; free hand opens toward the casting space.
- CHANNEL: planted legs, small chest tension, no repeated windmill motion.
- RELEASE: chest starts first, then shoulder/elbow, then the staff/free hand complete the gesture.
- Staff normal is deliberately smaller than a full spell: orient → pulse → recoil → guard.

## Archer / bow

The image sequence is readable because the bow arm and draw arm do different jobs. The shot is not a generic two-arm swing.

Implemented language:

`READY → RAISE → NOCK/DRAW → RELEASE → RECOIL → RECOVER`

- Left/bow arm becomes the stable line toward the target.
- Right elbow travels backward during DRAW.
- Bow-string visual tension grows before RELEASE and collapses after the authoritative impact marker.
- Power casts may hold a deeper draw but use the same readable grammar.

## Melee derivative

No melee reference frames were supplied in this package. The melee family is therefore an **original Arena derivative** built on the same imported rig:

- alternating horizontal/diagonal normal;
- thrust;
- heavy swing;
- kick;
- charge.

It uses torso-first kinetic chaining rather than copying the old procedural arm rotations.

## v0.14 defect and v0.15 rule

v0.14 decomposed world matrices from the procedural mannequin and pushed those quaternions into an unrelated AI-generated bind skeleton. The result could pass finite-matrix tests while looking broken: crossed legs, twisted shoulders and equipment penetrating the body.

v0.15 rule:

**The imported skeleton is animated only in its own local bind basis.** World position/yaw stay on the visual root. Every bone starts from its GLB bind quaternion and receives an additive local pose. No procedural clothing/equipment is rendered on the skinned path; only body + archetype weapon remain.
