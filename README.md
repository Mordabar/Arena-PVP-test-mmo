# Project Arena

> v0.34 current baseline: warrior UAL literal mapping + natural timing + world-forward archer facing correction. · v0.33 Archer Video Refinement

v0.33 keeps the v0.32 explicit **NORMAL vs COMBAT** architecture and the v0.31 literal warrior mapping, but rebuilds the archer's stationary combat pose from the two user-supplied video references.

The key correction is structural: bow combat-ready is now a **full-body stance**, while stationary notch/release preserve the same combat lower body instead of layering a twisted bow upper pose over neutral `Idle_Loop`. A presentation-only two-bone IK layer places the bow hand, draw hand and elbow into a readable archery silhouette without changing simulation authority.

The adversarial visual loop rejected the first v0.33 attempt because the release collapsed the stance. The final build locks the ready lower-body pose through ready → notch → release and passes the targeted Chromium geometry gate.

Run the current verification stack with:

```bash
node tools/run-gates.js
```

See `BUILD_REPORT_V033.md`, `docs/ARCHER_VIDEO_REFINEMENT_V033.md` and `docs/shots/v033-final/runtime-report.json`.
