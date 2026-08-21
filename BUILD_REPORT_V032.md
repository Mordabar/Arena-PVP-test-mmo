# Project Arena v0.32 · NORMAL/COMBAT + Archer Video Poses

## Scope
This wave fixes a structural animation bug: target selection is not combat stance. `entity.combatMode` is now transported as an explicit animation intent and is the sole stance authority. Auto-attack toggling continues to set `combatMode`, therefore starting normal attacks moves the character into COMBAT and stopping normal attacks returns it to NORMAL.

## Stance contract
- NORMAL: `Idle_Loop`; selecting a target alone does not change pose.
- COMBAT Devastador: `Sword_Idle`.
- COMBAT Guardián: `Idle_Shield_Loop`.
- COMBAT Archer: requested `Bow_Aim_Neutral`; Standard fallback `Arena_Archer_VideoReady`.
- COMBAT Caster: `Spell_Simple_Idle_Loop`.
- Combat locomotion layers the archetype upper-body guard over the locomotion lower body; NORMAL locomotion remains ordinary full-body locomotion.

## Archer video contract
The supplied 19.08.2026 video was reviewed frame-by-frame. It exposes the intended UAL2 Source family: `Bow_Aim_Neutral`, `Bow_Notch`, `Bow_RapidShoot`, and `Bow_Shoot`. Those exact Source clips are not present in the Standard GLBs, so v0.32 keeps the exact names at the state-machine boundary and uses explicitly named video-derived fallbacks on the same 65-joint UAL rig:
- `Bow_Aim_Neutral` -> `Arena_Archer_VideoReady`
- `Bow_Notch` -> `Arena_Archer_VideoNotch`
- `Bow_Shoot` -> `Arena_Archer_VideoShoot`
- `Bow_RapidShoot` -> `Arena_Archer_VideoShoot`

The fallback builder uses two same-rig UAL1 samples only as authoring scaffolds (`Pistol_Aim_Neutral`, `Pistol_Reload`). `Pistol_Shoot` is not loaded or selectable, and no fallback is presented as the missing exact Bow Source clip.

## Warrior regression
The v0.31 user-locked warrior mapping remains unchanged: Sword Regular A/B + REC, Sword Regular C for weapon powers, Shield Dash RM, Shield OneShot, Hit Chest/Head, Slide knockdown, UAL1 jump and sprint.

## QA
- 373/373 regression tests PASS.
- 10/10 specialized adversarial agents PASS.
- 138/138 JavaScript syntax PASS.
- Animation/source audit PASS.
- Payload audit PASS: 5.09 MiB animation runtime payload.
- Chromium visual contract PASS for Archer and Guardian NORMAL/COMBAT states.
- Packaged deploy smoke PASS: Three.js active, 0 JS errors, 0 request failures.
- ARBITER v0.32 APPROVED.

## Honest art gate
The normal/combat state architecture is approved. The archer fallback is video-derived and playable, but remains provisional until the exact UAL2 Source Bow clips or an authored Regnum-reference animation set is available.
