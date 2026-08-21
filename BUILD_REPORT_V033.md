# Project Arena v0.33 · Archer Video Refinement

## Scope

Refine the video-derived archer combat pose from v0.32 using the user's gameplay capture `19.08.2026_20.55.49_REC.mp4` together with the previous bow reference capture `19.08.2026_20.18.59_REC.mp4`. No gameplay authority, warrior mapping, damage reactions, or locomotion contracts were redesigned in this wave.

## Visual diagnosis

The v0.32 bow state was semantically correct but visually twisted because a bow upper-body pose was being layered over a neutral lower-body/torso base. During release the lower body could also drift toward a narrower stance while the upper body stayed in draw orientation, forcing the spine to compensate.

Reference observations used for the correction:

- bow remains vertically readable;
- bow arm extends clearly toward the target;
- string hand approaches the cheek/head zone;
- string elbow flares away from the torso;
- stance remains planted and stable through ready, draw and release;
- release moves the string hand away from the face without moving the simulated entity.

## Implementation

### Full-body combat ready

`Bow_Aim_Neutral` remains the semantic source slot, resolving to `Arena_Archer_VideoReady` while the exact Source clip is unavailable. The fallback now owns the full body in stationary COMBAT idle rather than being an upper-body overlay on `Idle_Loop`.

### Stable lower body during bow actions

Stationary `Bow_Notch` and `Bow_Shoot` use their action upper body over the same `Arena_Archer_VideoReady` lower-body pose. A lower-pose cache protects hips, legs, feet and toes through charge/release so the base does not collapse under the torso.

### Bow-arm IK presentation

A two-bone IK presentation layer was added for the two arm chains. It does not affect gameplay/simulation.

At the 70% notch evidence frame:

- string hand to head: ~0.148 m;
- bow-hand forward reach: ~0.539 m;
- string elbow lateral flare: ~0.253 m.

The release moves the string hand away from the cheek while the planted stance remains unchanged.

### Bow orientation

The bow remains attached to `LeftHand`, but its long axis is constrained for vertical readability instead of inheriting an unsuitable wrist roll.

## Adversarial rejection inside this wave

The first v0.33 implementation improved the upper body but allowed the release stance to collapse. That visual result was rejected. The lower-body stance lock was then added and the Chromium evidence was rerun.

Final planar stance:

- ready: 0.5381 m;
- notch: 0.5381 m;
- release: 0.5381 m.

Release stance delta from ready: effectively 0.0000 m in the targeted evidence.

## QA

- Regression suite: **378/378 PASS**.
- Specialized adversarial agents: **10/10 PASS**.
- JavaScript syntax: **139/139 PASS**.
- UAL Standard inventory: **43 + 43 source clips** unchanged.
- Chromium/Three.js targeted ready/notch/release: **PASS**.
- Browser errors: **0**.
- Request failures: **0**.
- Packaged production deploy smoke: **PASS**.
- Animation runtime payload: **~5.09 MiB**.
- Production deploy: **~8.40 MiB uncompressed**.
- Arbiter: **APPROVED**.

## Art gate

The geometry/twist correction is approved. The bow family remains `VIDEO-DERIVED / PROVISIONAL` because the exact Quaternius Source `Bow_*` clips are not present in the Standard binaries and the final animation is still being reconstructed from user video rather than imported from the original source animation.
