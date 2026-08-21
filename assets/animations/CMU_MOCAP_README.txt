Project Arena v0.30 uses a small set of offline-retargeted quaternion-only presentation clips derived from the CMU Motion Capture Database via the RancidMilk Anims_Only_FBX_V1 conversion.

Original data: mocap.cs.cmu.edu
Acknowledgement requested by the source dataset:
"The data used in this project was obtained from mocap.cs.cmu.edu. The database was created with funding from NSF EIA-0196217."

Arena runtime policy:
- Raw FBX files are NOT shipped.
- Only selected retargeted quaternion tracks are shipped in arena-cmu-v030.json.
- Root/world translation is stripped. Game simulation owns movement, yaw, RELEASE, damage and all combat truth.
- Rejected source candidates are not distributed in the runtime payload.

See CMU_MOCAP_LICENSE.txt and docs/CMU_MOCAP_INTEGRATION_V030.md in SOURCE.
