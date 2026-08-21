# Build Ledger

## Milestone v0.30 · CMU Mocap Integration
- Audited the uploaded `Anims_Only_FBX_V1.zip` (~2.5k FBX motions) offline; raw FBX is not copied into Project Arena.
- Built an offline CMU→UAL retarget pipeline using 19 mapped body joints and WORLD_DELTA quaternion retargeting.
- Stripped source root/world translation so simulation remains authoritative.
- Added a compact `arena-cmu-v030.json` runtime library containing only accepted derived clips.
- Accepted directional locomotion: back, strafe L/R, forward diagonals, backward diagonals, turn L/R.
- Replaced the old kick with CMU `135_04` Front Kick.
- Added caster charge/normal/power gestures from CMU `120_03`, upper-body composed over stable lower-body idle.
- Rejected `02_07/02_08/02_09` swordplay for Devastador 2H after secondary grip visual review failed.
- Trialed CMU `79_86` bow-and-arrow, then rejected it after Chromium showed non-convincing bow/hand alignment; all archer action slots remain blank instead of shipping bad motion.
- Reduced CMU runtime payload to 13 clips / ~380 KiB after rejected archery was removed.
- Rebuilt v0.30 tests, source/state auditors, specialized adversarial reviewers, production deploy builder and arbiter.

## v0.31 — Warrior UAL Literal Mapping (2026-08-19)
- Latest user-provided clip mapping is now the authoritative presentation contract for Devastador/Guardian.
- Melee normals: Sword_Regular_A/B with native A_Rec/B_Rec recovery; weapon-damage powers: Sword_Regular_C.
- Guardian: Idle_Shield_Loop, Shield_Dash_RM and Shield_OneShot.
- Damage reactions: Hit_Chest for normal attacks, Hit_Head for damage powers without hard CC.
- Knockdown: Slide_Start/Loop/Exit; jump: Jump_Start/Loop/Land; speed-buff run: Sprint_Loop.
- Native Spell Simple family restored for caster; old archer proxies removed in favor of explicit default placeholders.
- 368 tests, 10/10 adversarial auditors, targeted Chromium warrior runtime and production deploy gates pass.

## v0.32 — 2026-08-19 — NORMAL/COMBAT + Archer Video Poses
- Separated target selection from combat stance with explicit `combatMode` animation intent.
- Auto-attack remains the simulation authority that toggles combat mode.
- Fixed Guardian normal idle incorrectly inheriting shield combat pose.
- Added exact archer video contract: Bow_Aim_Neutral / Bow_Notch / Bow_Shoot / Bow_RapidShoot.
- Added explicitly named video-derived fallbacks while exact Source clips remain unavailable in Standard.
- Preserved warrior v0.31 mapping and simulation authority.
- 373/373 tests, 10/10 adversarial agents, Chromium visual PASS, packaged deploy smoke PASS.

## v0.33 · Archer Video Refinement

- Registered `19.08.2026_20.55.49_REC.mp4` as the latest archer gameplay evidence.
- Rejected upper-only-on-neutral bow stance as the source of visible torso twist.
- Rebuilt stationary combat-ready as full-body stance.
- Added presentation-only two-bone bow/string arm IK.
- Added ready lower-body cache/lock across notch and release after adversarial review found release foot collapse.
- Final targeted geometry: notch hand-head 0.148 m, bow reach 0.539 m, elbow flare 0.253 m, stable 0.538 m stance.
- 378/378 tests; 10/10 specialized reviewers; 139/139 syntax; deploy smoke PASS; ARBITER APPROVED.
