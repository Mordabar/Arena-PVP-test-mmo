# Project Arena v0.14 — Skinned Dark Elf Integration

## Scope
- AI-generated dark elf becomes the primary body for all six subclasses in the Three.js renderer.
- Humanoid rig: 17 weighted joints.
- Skinning: 4 influences per vertex, normalized.
- Geometry optimized from 120,000 to exactly 50,000 triangles while preserving embedded PBR textures/UVs.
- Existing procedural locomotion/combat remains the animation authority; its joint pivots drive the GLB rig.
- Procedural body remains only as technical fallback; procedural armor/weapons remain layered on top.

## Model artifact
`assets/models/dark-elf-base-rigged-50k.glb`

## Validation
See `docs/QA_MODEL_GLTF_V014.txt`, `docs/QA_SKINNING_V014.txt`, `docs/QA_TESTS_V014.txt`, and `docs/QA_ARBITER_MODEL_V014.txt`.

## Adversarial findings/fixes
The first 50k reduction attempt used `vtkQuadricDecimation + AttributeErrorMetric` with UV weighting. A static offscreen preview exposed catastrophic long triangles because texture attributes pulled geometry out of body space. That build was rejected. The pipeline was replaced with topology-preserving `vtkDecimatePro`; the final bounds remain within the source silhouette and the preview is stored at `docs/dark-elf-50k-preview.png`.

## Three.js loader validation
The final GLB was parsed with the vendored Three.js r160 `GLTFLoader` in a Node harness: **1 SkinnedMesh, 17 Bones, PASS**. See `docs/QA_THREE_GLTFLOADER_V014.txt`.

## Runtime integration
`bootstrap.js` preloads the GLB before `Arena.Game.boot()`. `threeCharacter.js` creates an independent cloned Skeleton per entity, hides the old procedural body pieces, preserves procedural armor/weapons, and transfers verified `CharacterVisual.rigPose` rotations to the GLB bones. Simulation authority is unchanged.
