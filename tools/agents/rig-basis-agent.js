#!/usr/bin/env node
'use strict';const fs=require('fs'),path=require('path');const R=path.join(__dirname,'../..');let f=0;const s=fs.readFileSync(path.join(R,'js/render/three/threeCharacter.js'),'utf8');function g(x,n){console.log((x?'✓ ':'✗ ')+n);if(!x)f++;}
g(!/prototype\.applyRigPose/.test(s),'v0.14 matrix bridge eliminado');
g(/rigBindQuat/.test(s)&&/quaternion\.copy\(this\.rigBindQuat/.test(s),'cada frame parte del bind local del GLB');
g(/this\.root\.position\.set\(pos\.x, pos\.y, pos\.z\)/.test(s),'traslación mundial vive en root visual');
g(/this\.root\.rotation\.set\(a\.rootPitch, yaw, a\.rootRoll\)/.test(s),'yaw autoritativo se copia a root sin resolver combate');
g(/cloneSkinnedScene/.test(s),'cada entidad conserva skeleton independiente');process.exit(f?1:0);
