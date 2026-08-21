# Current Build State — Project Arena v0.34

Baseline: `warrior-ual-literal-speed-facing-v034`.

Warrior clip mapping is user-locked and technically verified. Normal A/B use `Sword_Regular_A/B` plus their real `_Rec` clips; weapon damage powers use `Sword_Regular_C`; Guardian shield actions use `Shield_Dash_RM` and `Shield_OneShot`; damage/knockdown reactions are literal UAL clips.

The excessive-speed complaint is addressed primarily by removing authoritative compression from A/B recovery and applying conservative presentation rates to REC/hit/jump/buff/idle states while keeping RELEASE and gameplay timing authoritative.

Caster retains the complete Standard `Spell_Simple_*` family in natural roles.

Archer remains video-derived/provisional. v0.34 fixes the reported backwards aiming through world-forward hand IK driven by simulation yaw, not a blind pelvis flip. Final moving visual approval remains `MANUAL_GPU_REQUIRED` until tested on user hardware.

QA: 383/383 tests; 11/11 specialized auditors; deploy/payload/source/syntax gates PASS; arbiter technically APPROVED.
