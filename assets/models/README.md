# assets/models · v0.14

`dark-elf-base-rigged-50k.glb` is now the **primary body** for all six subclasses in the Three.js renderer.

- 50,000 triangles.
- 76,070 vertices.
- Embedded PBR textures (base color, metallic/roughness, normal).
- 17-joint humanoid skin.
- Four normalized influences per vertex.
- Origin at feet, Y-up, front toward +Z.
- No root-motion clips: world position remains simulation-authoritative.

The procedural body remains in `render/characterVisual.js` as a technical fallback and as the source of the verified animation pivots. In the primary Three.js path those body pieces are hidden, while procedural class armor/weapons continue to render on top of the skinned dark elf.

## Rig names

`Hips`, `Spine`, `Chest`, `Neck`, `Head`,
`LeftUpperArm`, `LeftLowerArm`, `LeftHand`,
`RightUpperArm`, `RightLowerArm`, `RightHand`,
`LeftUpperLeg`, `LeftLowerLeg`, `LeftFoot`,
`RightUpperLeg`, `RightLowerLeg`, `RightFoot`.

The generation/optimization pipeline is in `tools/model_pipeline/rig_optimize_dark_elf.py`.
