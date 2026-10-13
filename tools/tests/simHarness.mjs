import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export function loadArena(options={}) {
  const sourceRoot=options.root||root;
  const ctx = {console:options.console||console, Math, performance, setTimeout, clearTimeout};
  if(options.main){ctx.window=ctx;ctx.ARENA_DEFER_BOOT=true;ctx.document={readyState:'complete'};}
  vm.createContext(ctx);
  const html=fs.readFileSync(path.join(sourceRoot,'index.html'),'utf8');
  const files=[...html.matchAll(/<script src="([^"?]+)[^\"]*"/g)].map(m=>m[1]);
  for(const f of files){
    if(f==='js/main.js'&&!options.main) continue;
    vm.runInContext(fs.readFileSync(path.join(sourceRoot,f),'utf8'),ctx,{filename:f});
  }
  return ctx.Arena;
}
