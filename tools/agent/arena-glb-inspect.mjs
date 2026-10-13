#!/usr/bin/env node
// Decode GLB JSON chunks to inventory animations/skins/nodes. No third-party dependencies.
import fs from 'node:fs';import path from 'node:path';
const root=process.cwd();
const argv=process.argv.slice(2);
const paths=argv.length?argv: ['assets/animations/ual1-arena-runtime.glb','assets/animations/ual2-melee-runtime.glb','assets/animations/ual2-rm-runtime.glb'];
function readGLB(file){
  const b=fs.readFileSync(file);
  if(b.length<20||b.readUInt32LE(0)!==0x46546c67||b.readUInt32LE(4)!==2)throw Error('GLB inválido o versión distinta a 2');
  if(b.readUInt32LE(8)!==b.length) throw Error('Longitud de GLB inválida');
  let ptr=12,json=null;
  while(ptr+8<=b.length){const n=b.readUInt32LE(ptr),typ=b.readUInt32LE(ptr+4);ptr+=8;
    if(ptr+n>b.length)throw Error('Chunk inválido');
    if(typ===0x4e4f534a)json=JSON.parse(b.subarray(ptr,ptr+n).toString('utf8').trim());ptr+=n;
  }
  if(!json)throw Error('Sin chunk JSON');return json;
}
let failed=0;
for(const rel of paths){
  const file=path.resolve(root,rel); if(!file.startsWith(root+path.sep)){console.error('Fuera del repositorio: '+rel);failed++;continue;}
  try{
    const g=readGLB(file),nodes=g.nodes||[],skins=g.skins||[],anims=g.animations||[],accessors=g.accessors||[];
    console.log('\n### '+rel);
    console.log('nodos:',nodes.length,'skins:',skins.length,'joints por skin:',skins.map(s=>(s.joints||[]).length).join(',')||'n/a','animaciones:',anims.length);
    for(const a of anims){
      const tracks=a.channels||[], paths=[...new Set(tracks.map(c=>c.target?.path))];let duration=0;
      for(const s of a.samplers||[]){let accessor=accessors[s.input];const max=accessor?.max?.[0];if(Number.isFinite(max)) duration=Math.max(duration,max);}
      const missing=tracks.filter(c=>c.target?.node>=nodes.length || !c.target?.path).length;
      console.log(' - '+(a.name||'[sin nombre]')+'\t'+tracks.length+' canales\t'+paths.join('/')+'\t'+duration.toFixed(3)+'s'+(missing?' [CANAL INVÁLIDO '+missing+']':''));
      if(missing)failed++;
    }
    const boneNames = skins.length ? [...new Set(skins.flatMap(s=>(s.joints||[]).map(i=>nodes[i]?.name||'[anónimo]')))] : [];
    console.log('  Joints nombrados:', boneNames.length);
    if(boneNames.length)console.log('  Primeros:',boneNames.slice(0,15).join(', '));
    if(anims.length===0)console.warn('  AVISO: No contiene clips; podría ser modelo estático.');
  }catch(e){console.error('ERROR '+rel+': '+e.message);failed++;}
}
process.exitCode=failed?1:0;
