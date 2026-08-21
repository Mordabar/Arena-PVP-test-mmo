# Quaternius Universal Animation Library · Project Arena v0.28

The source/authoring GLBs in this folder come from the user-supplied Quaternius UAL Standard packages. Their included license files are preserved beside them.

- `ual1-standard.glb` / `ual2-standard.glb`: authoring and binary-audit sources; not shipped in production deploy.
- `ual1-arena-runtime.glb`: trimmed runtime body + required UAL1 clips.
- `ual2-melee-runtime.glb`: trimmed runtime UAL2 action set.

Project Arena uses the native 65-joint UAL skeleton directly. Animation remains presentation-only; simulation owns position, yaw, RELEASE, damage, CC, cooldown and GCD. Missing exact-contract clips remain explicit blockers and are not synthesized from unrelated Standard clips.
