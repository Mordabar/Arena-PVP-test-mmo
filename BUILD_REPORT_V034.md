# Project Arena v0.34 · Warrior UAL Literal + Natural Timing + Facing

Date: 2026-08-20

## Scope

This wave keeps the latest user mapping as authority, focuses on Devastador/Guardian, preserves the Spell family for caster, and corrects the user-reported archer wrong-facing placeholder without rotating simulation yaw.

## Source integrity

The supplied Standard packs match the authoring binaries already inside the project byte-for-byte. UAL1 Standard contains 43 clips, UAL2 Standard 43 clips, UAL2 RM 43 clips, and the native humanoid uses 65 joints.

## Main corrections

- Exact warrior mapping: Idle/Walk/Jog/Sprint/Jump, Hit Chest/Head, Sword Idle, Shield Idle, Sword Regular A/B + REC, Sword Regular C, Shield Dash RM, Shield OneShot, Slide triplet.
- A/B REC clips are no longer authoritative-sync compressed; recovery plays at a natural 0.72 presentation rate.
- Damage reactions and selected transitions are slightly slowed without altering simulation truth.
- `threeDirectAnim.js` sanitizes names, removes external root motion, supports an optional per-clip 180° Y quaternion correction and uses dynamic combat/locomotion crossfades.
- Current custom archer does not use the blind 180° correction. World-forward two-bone IK derives hand targets from the simulation-owned character yaw, directly addressing the hardware screenshot where the bow was aimed backwards.
- Cache tokens were rolled to v0.34 so Hostinger/browser caches cannot silently keep v0.33 modules.

## Verification

- 383/383 regression tests PASS.
- 142/142 JavaScript syntax PASS at final audit time.
- 11/11 specialized executable adversarial auditors PASS.
- Animation source/state audit PASS.
- CMU directional/kick regression PASS.
- Damage/CC reaction audit PASS.
- Runtime animation payload: ~5.09 MiB.
- Deploy audit PASS; one classic bundle and only runtime animation assets included.
- Arbiter: technically APPROVED.

## Honest visual gate

The managed Chromium/SwiftShader environment could not complete the full Three.js scene within the available runtime budget, and localhost is blocked by the browser policy. Therefore the moving visual result is **MANUAL_GPU_REQUIRED**, not falsely declared visually final. The user hardware screenshot is retained in `docs/reference/archer_wrong_facing_20260820.png` as defect evidence and the next hardware video should verify the world-forward correction and final animation cadence.
