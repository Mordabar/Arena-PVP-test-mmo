#!/usr/bin/env node
'use strict';const fs=require('fs'),path=require('path'),R=path.join(__dirname,'../..');let f=0;const s=fs.readFileSync(path.join(R,'js/render/three/threeRetarget.js'),'utf8');function g(x,n){console.log((x?'✓ ':'✗ ')+n);if(!x)f++;}
const map=(/const SOURCE_FOR_TARGET = \{([\s\S]*?)\};/.exec(s)||[])[1]||'';g((map.match(/:/g)||[]).length===17,'retarget declara 17 cadenas humanoides');
g(/getWorldQuaternion/.test(s)&&/sourceBind/.test(s)&&/targetBindWorld/.test(s),'retarget trabaja por delta world desde bind');
g(/targetBindLocalQuat/.test(s)&&/slerp/.test(s),'salida vuelve al bind local del Elfo');
g(!/entity\.pos|entity\.yaw|\.hp\s*=|cooldown|gcdUntil/.test(s),'retarget no puede escribir simulación');
g(/hipsLift=Math\.max\(-0\.11,Math\.min\(0\.11/.test(s),'traslación pélvica visual acotada');process.exit(f?1:0);
