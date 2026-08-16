#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path'),cp=require('child_process');const R=path.join(__dirname,'../..');let f=0;
const read=x=>fs.readFileSync(path.join(R,x),'utf8'); const g=(ok,n,d)=>{console.log((ok?'✓ ':'✗ ')+n+(d?' — '+d:''));if(!ok)f++;};
const p=read('js/data/powerLibrary.js'), r=JSON.parse(read('docs/POWER_LIBRARY_REPORT_V012.json')), a=read('js/combat/abilitySystem.js'), res=read('js/combat/resolver.js');
g(r.source_entries===320&&r.valid_named_powers===290&&r.excluded_placeholders===30&&r.class_assignments===410,'Cobertura fuente 320 → 290 reales → 410 asignaciones');
g((p.match(/"sourceMechanics":/g)||[]).length===410,'Cada asignación conserva auditoría sourceMechanics');
g(/sourceConstraints/.test(p)&&/incompatibleSourceIndices|onExpireLockouts|exclusiveGroup/.test(p),'Restricciones cruzadas fuente se convierten a datos');
g(/possessCompanion/.test(p)&&/possessCompanion/.test(res),'Mecánicas especiales no quedan como texto muerto');
g(/sourcePowerLockouts/.test(a)&&/preventAoEAbilities/.test(a),'AbilitySystem respeta lockouts y restricciones globales');
try{const o=cp.execFileSync(process.execPath,[path.join(R,'tools/run-tests.js'),'v0.13 · Documento Maestro como fuente única'],{encoding:'utf8'});g(/7\/7/.test(o)||/TODO OK/.test(o),'Gate v0.13 de paridad source en verde');}catch(e){g(false,'Gate v0.13 ejecutable');}
process.exit(f?1:0);
