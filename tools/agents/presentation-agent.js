#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path');const R=path.join(__dirname,'../..');let f=0;
function read(x){return fs.readFileSync(path.join(R,x),'utf8')} function g(ok,n,d){console.log((ok?'✓ ':'✗ ')+n+(d?' — '+d:''));if(!ok)f++;}
const html=read('index.html'),css=read('css/arena.css'),book=read('js/ui/powerBook.js'),bar=read('js/ui/actionBarState.js'),hud=read('js/ui/hud.js'),icons=read('js/ui/abilityIcons.js');
g(/v0\.15/.test(html)&&/powerLibrary\.js/.test(html)&&/powerBook\.js/.test(html),'Entrypoint v0.15 carga catálogo fuente completo');
g(/\.power-book/.test(css)&&/\.power-grid/.test(css)&&/\.bar-tab/.test(css),'Libro y barras tienen sistema visual propio');
g(/sigilFor/.test(icons)&&/sourceDerived/.test(icons),'Iconos derivados reciben firma única');
const present=book+'\n'+bar+'\n'+hud; const forbidden=[/\.hp\s*=/,/\.resource\s*=/,/DamageSystem\./,/Resolver\.resolveHit/,/cooldowns\s*\[/];g(forbidden.every(rx=>!rx.test(present)),'UI no escribe autoridad de combate');
process.exit(f?1:0);
