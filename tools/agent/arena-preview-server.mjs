#!/usr/bin/env node
// Static local-only server. Zero npm dependencies. Execute from repository root.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = process.cwd();
const INDEX = path.join(ROOT, 'index.html');
if (!fs.existsSync(INDEX)) { console.error('No veo index.html: ejecuta este script desde la raíz de Project Arena.'); process.exit(2); }
const args=process.argv.slice(2);
const at=args.indexOf('--port'); const port=Number(at>=0 ? args[at+1] : process.env.ARENA_PORT||4173);
if (!Number.isInteger(port)||port<1||port>65535) {console.error('Puerto inválido');process.exit(2);}
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.glb':'model/gltf-binary','.gltf':'model/gltf+json','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.woff2':'font/woff2','.mp3':'audio/mpeg','.wav':'audio/wav'};
const forbidden=['.env','.git','.claude','.agents','.arena-agent-backup'];
const server=http.createServer((req,res)=>{
  if (req.method!=='GET' && req.method!=='HEAD'){res.writeHead(405).end('Método no permitido');return;}
  let url;
  try { url=new URL(req.url,'http://localhost'); } catch {res.writeHead(400).end('URL inválida');return;}
  let rel;
  try {rel=decodeURIComponent(url.pathname);}catch{res.writeHead(400).end('URL inválida');return;}
  const segments=rel.replace(/\\/g,'/').split('/').filter(Boolean);
  if (segments.some(x=>x==='..'||forbidden.includes(x))){res.writeHead(403).end('Prohibido');return;}
  const candidate=path.resolve(ROOT,...segments);
  if (candidate!==ROOT&&!candidate.startsWith(ROOT+path.sep)){res.writeHead(403).end('Prohibido');return;}
  let file=candidate;
  try {if(fs.statSync(file).isDirectory())file=path.join(file,'index.html');const real=fs.realpathSync(file);const rootReal=fs.realpathSync(ROOT);if(real!==rootReal&&!real.startsWith(rootReal+path.sep)){res.writeHead(403).end('Prohibido');return;}}
  catch{res.writeHead(404).end('No encontrado');return;}
  res.setHeader('Cache-Control','no-store');
  res.setHeader('Content-Type',types[path.extname(file).toLowerCase()]||'application/octet-stream');
  if(req.method==='HEAD'){res.writeHead(200).end();return;}
  const stream=fs.createReadStream(file);
  stream.on('error',()=>{if(!res.headersSent)res.writeHead(500);res.end('Error de lectura');});
  stream.pipe(res);
});
server.listen(port,'127.0.0.1',()=>{console.log(`Project Arena: http://127.0.0.1:${port}/`);console.log('Ctrl+C para detener. Servidor solo local, sin acceso público.');});
