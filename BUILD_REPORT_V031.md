# Project Arena v0.31 · Warrior UAL Literal Mapping — Build Report

## Scope
This wave treats the user's latest animation-name assignment as the authoritative presentation contract. When an attack mapping was repeated, the last instruction wins. The focus is Devastador and Guardian; caster and archer were only cleaned to the requested baseline.

## Literal warrior mapping
- `Hit_Chest`: damage from normal attacks.
- `Hit_Head`: damaging powers without hard CC.
- `Idle_Loop`: normal standing pose.
- `Walk_Loop`: walking forward.
- `Jog_Fwd_Loop`: normal forward run.
- `Sprint_Loop`: forward run while a real movement-speed buff is active.
- `Jump_Start → Jump_Loop → Jump_Land`: jump lifecycle.
- `Sword_Idle`: Devastador/general warrior combat stance.
- `Idle_Shield_Loop`: Guardian combat stance.
- `Sword_Regular_A → Sword_Regular_A_Rec`: normal variant A + native recovery.
- `Sword_Regular_B → Sword_Regular_B_Rec`: normal variant B + native recovery.
- `Sword_Regular_C`: weapon-damage power family, including Cruz del Sur-style releases.
- `Shield_Dash_RM`: Guardian shield offensive power.
- `Shield_OneShot`: Guardian shield buff.
- `Slide_Start → Slide_Loop → Slide_Exit`: knockdown / floor / recovery.

`Sword_Attack` is no longer shipped in the runtime selection because the user's later A/B/C mapping supersedes the earlier instruction.

## RM authority
The full UAL2 Standard RM source is authoring-only. Deployment contains a 1-clip runtime GLB where `Shield_Dash` is renamed `Shield_Dash_RM`. Three.js locks visual root X/Z after sampling, so RM cannot move the simulation entity or change collision/RELEASE timing.

## Reactions
`DamageApplied` classifies presentation reaction from the actual packet:
- `auto_attack` → chest.
- damaging ability without hard-control status → head.
- knockdown/stun/sourceDaze/stasis → no competing hit reaction; the corresponding CC animation owns the body.

## Caster and archer
- Caster CMU `120_03` gestures were removed from runtime. Native Spell Simple family is used according to role.
- Archer pistol and rejected bow proxies remain removed. Four intentionally simple Arena placeholder poses cover ready/charge/shoot/buff until Regnum video is supplied.

## QA
- Regression: 368/368 PASS.
- 10/10 specialized executable adversarial auditors PASS.
- Binary source/runtime audit: PASS (UAL1 43, UAL2 43, UAL2 RM 43 source clips; 15+13+1 runtime clips).
- CMU quaternion/runtime audit: PASS, 10 retained clips.
- Reaction routing audit: PASS.
- Runtime animation payload: ~4.87 MiB.
- Deploy audit: PASS, ~8.17 MiB uncompressed.
- Chromium Guardián evidence: PASS; exact A/B/REC/C, shield RM, shield buff, chest/head, slide, sprint and jump resolved; 0 JS errors / failed requests.
- Chromium Devastador evidence: PASS; Sword idle, A/B/C, kick and sprint resolved; 0 JS errors / failed requests.
- Packed deploy boot: PASS, Arena 0.31.0, Three.js active, 39 merged runtime clips.
