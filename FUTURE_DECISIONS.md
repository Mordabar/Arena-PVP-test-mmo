# FUTURE DECISIONS — Project Arena v0.28+

## 1. Source animation files — external blocker

The chosen definitive animation map references clips that are not present in the supplied Standard GLBs. Do not recreate them with legacy Arena procedural clips merely to turn a gate green. Integrate the exact Source animations when the user supplies the Source package/files.

## 2. Final production character art

The Quaternius UAL native humanoid is now the canonical animation/rig baseline because it follows the animation libraries without runtime retargeting. Final art can later replace the mannequin only if it uses the same compatible rig contract or can be proven to retarget cleanly without regressing the animation gates.

## 3. Archer combat stance

Do not finalize a hand-authored archer stance before `BowNotch` and `BowShoot` arrive. The neutral bow socket is only a temporary readable hold.

## 4. Mage stance

The complete `Spell_Simple_Idle_Loop` was visually rejected. `Spell_Simple_Enter/Exit` may be used as cropped transitions; `Idle_Loop` remains a stable provisional combat idle. A later authored caster stance must be visually reviewed before promotion.

## 5. Performance / real hardware

The reset removes runtime retarget bake, Dark Elf assets, old armor mesh upload and load-time derived directional clips. Fine GPU frame pacing, 60 FPS and hardware-specific artifacts still require playtest on the user's actual laptop/GPU.
