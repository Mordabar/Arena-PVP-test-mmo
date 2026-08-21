#!/usr/bin/env python3
from pathlib import Path
from urllib.parse import urlparse, unquote
import mimetypes, json, sys
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'docs'/'shots'/'ual-source-audit'
ARGS=['--no-sandbox','--disable-dev-shm-usage','--disable-background-networking','--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--ignore-gpu-blocklist','--enable-unsafe-swiftshader']

def ctype(p): return {'.js':'application/javascript','.glb':'model/gltf-binary','.png':'image/png'}.get(p.suffix.lower(),mimetypes.guess_type(str(p))[0] or 'application/octet-stream')
HTML='''<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:#38495b}canvas{display:block}</style><script type="importmap">{"imports":{"three":"/vendor/three-0.160.0/three.module.js","three/addons/":"/vendor/three-0.160.0/examples/jsm/"}}</script></head><body><script type="module">
import * as THREE from 'three'; import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
const scene=new THREE.Scene();scene.background=new THREE.Color(0x5f88a3);const cam=new THREE.PerspectiveCamera(36,1100/760,.01,100);cam.position.set(2.8,1.55,4.1);cam.lookAt(0,1.0,0);const r=new THREE.WebGLRenderer({antialias:true});r.setSize(1100,760);r.shadowMap.enabled=true;document.body.appendChild(r.domElement);scene.add(new THREE.HemisphereLight(0xffffff,0x26311f,2.2));const dl=new THREE.DirectionalLight(0xffffff,3);dl.position.set(3,6,4);dl.castShadow=true;scene.add(dl);const ground=new THREE.Mesh(new THREE.PlaneGeometry(10,10),new THREE.MeshStandardMaterial({color:0x80765c,roughness:1}));ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;scene.add(ground);
const loader=new GLTFLoader();const gltf=await loader.loadAsync('/assets/animations/ual1-standard.glb');const root=gltf.scene;root.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true; if(o.material){o.material=o.material.clone();o.material.color?.set(0xb6a18d);o.material.roughness=.72;}}});scene.add(root);const mixer=new THREE.AnimationMixer(root);const clips=Object.fromEntries(gltf.animations.map(c=>[c.name,c]));let act=null;window.__UAL={clips:Object.keys(clips),set:(n,u)=>{mixer.stopAllAction();root.position.set(0,0,0);root.rotation.set(0,0,0);const c=clips[n];if(!c)throw new Error(n);act=mixer.clipAction(c);act.enabled=true;act.setLoop(THREE.LoopOnce,1);act.clampWhenFinished=true;act.reset().play();mixer.setTime(Math.max(0,Math.min(c.duration,c.duration*u)));return {name:n,duration:c.duration,time:c.duration*u};},view:(side)=>{if(side==='front')cam.position.set(0,1.25,4.4);if(side==='three')cam.position.set(2.8,1.45,3.8);if(side==='side')cam.position.set(4.4,1.25,0);cam.lookAt(0,1.0,0)}};
function loop(){requestAnimationFrame(loop);r.render(scene,cam)}loop();window.__READY=true;
</script></body></html>'''

def main():
 OUT.mkdir(parents=True,exist_ok=True); rep={'shots':[],'errors':[]}
 with sync_playwright() as pw:
  b=pw.chromium.launch(headless=False,executable_path='/usr/bin/chromium',args=ARGS);p=b.new_page(viewport={'width':1100,'height':760});p.on('pageerror',lambda e:(rep['errors'].append(str(e)),print('PAGEERR',e))); p.on('console',lambda m:print('CONSOLE',m.type,m.text)); p.on('requestfailed',lambda r:print('REQFAIL',r.url,r.failure))
  def route(rt):
   u=urlparse(rt.request.url)
   if u.hostname!='ual.local': rt.abort(); return
   if u.path=='/' or u.path=='/index.html': rt.fulfill(status=200,body=HTML,content_type='text/html'); return
   f=(ROOT/unquote(u.path.lstrip('/'))).resolve()
   try:f.relative_to(ROOT)
   except:rt.fulfill(status=403,body='x');return
   if not f.is_file():rt.fulfill(status=404,body='x');return
   rt.fulfill(status=200,path=str(f),content_type=ctype(f),headers={'Access-Control-Allow-Origin':'*','Cache-Control':'no-store'})
  p.route('http://ual.local/**',route); html=HTML.replace('<head>','<head><base href="http://ual.local/">',1); p.set_content(html,wait_until='load',timeout=30000); p.wait_for_function('window.__READY===true',timeout=30000)
  clips=['Idle_Loop','Walk_Loop','Jog_Fwd_Loop','Sprint_Loop','Sword_Idle','Sword_Attack','Death01','Hit_Chest','Jump_Start','Jump_Loop','Jump_Land']
  phases=[.0,.2,.4,.6,.8,1.0]
  for c in clips:
   for u in phases:
    p.evaluate("([n,u])=>__UAL.set(n,u)",[c,u]);p.wait_for_timeout(35);fn=f'{c}_{int(u*100):03d}.png';p.screenshot(path=str(OUT/fn));rep['shots'].append(fn)
  b.close()
 (OUT/'report.json').write_text(json.dumps(rep,indent=2));print(json.dumps(rep,indent=2));sys.exit(0 if not rep['errors'] else 1)
if __name__=='__main__':main()
