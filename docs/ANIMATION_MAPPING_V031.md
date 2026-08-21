# Animation Mapping v0.31

| Intent / event | Runtime clip | Notes |
|---|---|---|
| Normal idle | `Idle_Loop` | All classes |
| Walk forward | `Walk_Loop` | All classes |
| Run forward | `Jog_Fwd_Loop` | All classes |
| Speed-buff run | `Sprint_Loop` | Only when simulation reports positive `moveSpeedPct` |
| Jump start | `Jump_Start` | UAL1 |
| Jump air | `Jump_Loop` | UAL1 |
| Jump land | `Jump_Land` | UAL1 |
| Normal damage received | `Hit_Chest` | Upper body over current lower locomotion |
| Pure damage power received | `Hit_Head` | Suppressed when hard CC owns reaction |
| Knockdown start | `Slide_Start` | Full body |
| Knockdown hold | `Slide_Loop` | Full body loop |
| Knockdown recovery | `Slide_Exit` | Full body |
| Devastador combat idle | `Sword_Idle` | Latest user mapping |
| Guardian combat idle | `Idle_Shield_Loop` | Shield stance |
| Melee normal A | `Sword_Regular_A` | Both warrior subclasses |
| Melee normal A recovery | `Sword_Regular_A_Rec` | Native REC phase |
| Melee normal B | `Sword_Regular_B` | Both warrior subclasses |
| Melee normal B recovery | `Sword_Regular_B_Rec` | Native REC phase |
| Weapon-damage power | `Sword_Regular_C` | Cruz del Sur and equivalent weapon-damage actions |
| Guardian shield offensive power | `Shield_Dash_RM` | RM source; visual root X/Z locked |
| Guardian shield buff | `Shield_OneShot` | User-locked |
| Puntapié | `Arena_CMU_Kick` | 135_04 Front Kick-derived |
| Caster enter combat | `Spell_Simple_Enter` | Native Spell family |
| Caster combat/cast hold | `Spell_Simple_Idle_Loop` | Native Spell family |
| Caster release | `Spell_Simple_Shoot` | Normal/power release |
| Caster exit combat | `Spell_Simple_Exit` | Native Spell family |
| Archer ready/charge/shot/buff | `Arena_Archer_Default_*` | Explicit placeholders until video replacement |
