# Project Arena v0.34 · Animation Mapping

## Warrior mapping — user locked

| Intent | Runtime clip | Policy |
|---|---|---|
| Normal idle | `Idle_Loop` | exact UAL1 |
| Walk forward | `Walk_Loop` | exact UAL1 |
| Jog/run forward | `Jog_Fwd_Loop` | exact UAL1 |
| Speed-buff sprint | `Sprint_Loop` | exact UAL1 |
| Jump start | `Jump_Start` | exact UAL1 |
| Jump air | `Jump_Loop` | exact UAL1 |
| Jump land | `Jump_Land` | exact UAL1 |
| Normal hit received | `Hit_Chest` | exact UAL1 |
| Pure damage power received | `Hit_Head` | exact UAL1; hard CC wins instead |
| Devastador combat idle | `Sword_Idle` | exact UAL1 |
| Guardian combat idle | `Idle_Shield_Loop` | exact UAL2 |
| Melee normal A | `Sword_Regular_A` | exact UAL2 |
| Normal A recovery | `Sword_Regular_A_Rec` | exact UAL2; presentation rate 0.72 |
| Melee normal B | `Sword_Regular_B` | exact UAL2 |
| Normal B recovery | `Sword_Regular_B_Rec` | exact UAL2; presentation rate 0.72 |
| Weapon damage power | `Sword_Regular_C` | exact UAL2 |
| Shield offensive power | `Shield_Dash_RM` | exact UAL2 RM source; X/Z root locked |
| Shield buff | `Shield_OneShot` | exact UAL2 |
| Knockdown enter | `Slide_Start` | exact UAL2 |
| Knockdown hold | `Slide_Loop` | exact UAL2 |
| Knockdown recovery | `Slide_Exit` | exact UAL2 |
| Puntapié | `Arena_CMU_Kick` | retargeted CMU front kick |

`Sword_Regular_C_Rec` does not exist in the supplied Standard pack and is not invented.

## Caster mapping

`Spell_Simple_Enter` -> enter combat mode.

`Spell_Simple_Idle_Loop` -> combat idle and cast hold.

`Spell_Simple_Shoot` -> normal/power release body gesture.

`Spell_Simple_Exit` -> leave combat mode.

## Archer correction

The current archer remains an Arena-authored/video-derived placeholder. The user hardware screenshot showed it aiming into the wrong hemisphere. v0.34 does **not** blindly rotate the pelvis 180 degrees because binary inspection of the UAL `Pistol_Aim_Neutral` scaffold shows its bow-side arm already extends toward native +Z.

Instead, both hand IK targets are rebuilt from the simulation-owned character yaw each frame (`WORLD_FORWARD_IK`). The optional `flipYOrientation` clip sanitation path remains available only for future external clips that are genuinely authored facing -Z.

## Timing

Release/contact remains simulation-authoritative. To correct movements that looked excessively fast, the dedicated A/B REC clips are no longer squeezed into the remaining normalized action tail; they play as natural presentation recovery at rate 0.72. Hit reactions, jump start/land, shield buff and combat idle also receive conservative presentation rates without changing gameplay duration or damage timing.
