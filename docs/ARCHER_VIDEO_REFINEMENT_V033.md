# Archer Video Refinement v0.33

## State contract

`NORMAL`
→ `Idle_Loop`

`COMBAT READY`
→ semantic `Bow_Aim_Neutral`
→ runtime fallback `Arena_Archer_VideoReady`
→ full body when stationary

`NOTCH / DRAW`
→ semantic `Bow_Notch`
→ runtime fallback `Arena_Archer_VideoNotch`
→ upper action + `Arena_Archer_VideoReady` lower body

`RELEASE`
→ semantic `Bow_Shoot`
→ runtime fallback `Arena_Archer_VideoShoot`
→ upper action + `Arena_Archer_VideoReady` lower body

`RECOVER`
→ returns to COMBAT READY while combat mode remains active.

Leaving combat mode returns to NORMAL. Target selection alone never activates the bow guard.

## Reference-driven pose targets

The two supplied videos establish the intended silhouette:

- stable staggered base;
- pelvis and chest do not over-twist;
- bow arm extends toward target;
- string hand reaches cheek/head region during draw;
- string elbow is visibly open;
- bow stays vertically readable;
- release is a hand/arm recovery, not a whole-body snap.

## Runtime constraints

- Presentation-only two-bone IK on both arm chains.
- Lower-body ready pose cached during stationary combat and restored through charge/release.
- Bow orientation constraint maintains readable long axis.
- Bow string deformation remains change-driven.
- No animation writes authoritative entity position.
- RELEASE remains simulation-owned.

## Chromium geometry gate

| Phase | Hand→head | Bow-hand forward | Draw elbow out | Stance |
|---|---:|---:|---:|---:|
| Ready | 0.156 m | 0.539 m | 0.252 m | 0.538 m |
| Notch | 0.148 m | 0.539 m | 0.253 m | 0.538 m |
| Release | 0.286 m | 0.550 m | 0.217 m | 0.538 m |

The notch reads as draw and the release moves the string hand away while retaining the same planted lower stance.
