#!/usr/bin/env python3
from pathlib import Path
from urllib.parse import urlparse, unquote
import mimetypes,json
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'docs'/'shots'/'v034-lite'; OUT.mkdir(parents=True,exist_ok=True)
ARGS=['--no-sandbox','--disable-dev-shm-usage','--disable-background-networking','--disable-component-update','--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--ignore-gpu-blocklist','--enable-unsafe-swiftshader']
def ct(p):return {'.js':'application/javascript','.css':'text/css','.glb':'model/gltf-binary','.json':'application/json','.png':'image/png'}.get(p.suffix.lower(),mimetypes.guess_type(str(p))[0] or 'application/octet-stream')
rep={'errors':[],'fails':[],'states':{}}
with sync_playwright() as pw:
 b=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=ARGS)
 page=b.new_page(viewport={'width':800,'height':450})
 page.on('pageerror',lambda e:rep['errors'].append(str(e)))
 page.on('requestfailed',lambda r:rep['fails'].append(r.url+' '+str(r.failure)) if 'ERR_ABORTED' not in str(r.failure) else None)
 def route(rr):
  u=urlparse(rr.request.url)
  if u.hostname!='arena.local': rr.abort(); return
  f=(ROOT/unquote(u.path.lstrip('/'))).resolve()
  try:f.relative_to(ROOT)
  except Exception: rr.fulfill(status=403,body='forbidden'); return
  if not f.is_file(): rr.fulfill(status=404,body='not found'); return
  rr.fulfill(status=200,path=str(f),content_type=ct(f),headers={'Access-Control-Allow-Origin':'*','Cache-Control':'no-store'})
 page.route('http://arena.local/**',route)
 html=(ROOT/'index.html').read_text().replace('<head>','<head><base href="http://arena.local/">',1)
 page.set_content(html,wait_until='domcontentloaded',timeout=30000)
 page.wait_for_function("() => window.Arena && Arena.Game && Arena.Game.renderer && Arena.Render && Arena.Render.animationSourceReport",timeout=60000)
 page.evaluate("() => {Arena.Game.renderer._pixelRatio=.35;Arena.Game.renderer._w=0;Arena.Game.renderer._h=0;}")
 page.evaluate("""()=>{const G=Arena.Game;G.playerClass='centinela';if(G.flow)G.flow.classId='centinela';G.flow.begin('training','centinela',0);G.buildScenario('duel');G._setBotsEnabled(false);const p=G.world.getPlayer();p.pos.x=p.pos.y=p.pos.z=0;p.prevPos.x=p.prevPos.y=p.prevPos.z=0;p.yaw=0;p.prevYaw=0;const es=G.world.entities.filter(e=>e.id!==p.id);es.forEach((e,i)=>{e.aiEnabled=false;e.pos.x=20+i;e.pos.z=20+i;});const t=es[0];if(t){t.pos.x=0;t.pos.z=3;t.godMode=true;p.targetId=t.id;G.renderer.selectedId=t.id;}G.renderer.syncVisuals(0);const c=G.renderer.camera;c.yaw=Math.PI;c.pitch=.15;c.distance=4.6;c.targetDistance=4.6;c.setFocus(0,.8,0);c.smoothFocus.x=0;c.smoothFocus.y=.8;c.smoothFocus.z=0;}""")
 page.wait_for_function("() => {const G=Arena.Game,p=G.world.getPlayer(),v=p&&G.renderer.visuals[p.id];return !!(v&&v.player&&v.animLib);}",timeout=30000)
 page.evaluate("() => {const G=Arena.Game,p=G.world.getPlayer(),v=G.renderer.visuals[p.id];v.update=function(){this.lastDt=0;};for(const id in G.renderer.visuals){if(String(id)!==String(p.id)){const x=G.renderer.visuals[id];if(x&&x.root)x.root.visible=false;}}}")
 def force(kind):
  return page.evaluate("""(kind)=>{const G=Arena.Game,p=G.world.getPlayer(),v=G.renderer.visuals[p.id],h=v.handle;h.intent=h.intent||{};Object.assign(h.intent,{classId:p.classId,archetype:'archer',hasTarget:true,combatMode:true,visualAction:null,speedBoosted:false,crowdControl:null});h.casting=false;h.cast=0;h.hurt=0;h.cc=null;h.ccBlend=0;Object.assign(h.loco,{moveSpeed:0,metersPerSecond:0,moveForward:0,moveRight:0,turnRate:0,airborne:false,jumpPhase:0,landingAmount:0});h.action={family:null,t:0,variant:0,isPower:false,react:{amount:0,front:0,side:0}};if(kind==='notch'){h.casting=true;h.cast=.7;h.castProgress=.7;h.intent.castProgress=.7;h.intent.visualAction='archerPower';}if(kind==='release'){h.action={family:'ranged',t:.56,duration:1,variant:0,isPower:false,weight:1,visualAction:'ranged',react:{amount:0,front:0,side:0}};}const s=Arena.Render.AnimationStateMachine.select(h,'archer'),res=v.animLib.resolveSelection(s);for(let i=0;i<3;i++){v.lastDt=1/60;v.applySkinnedPose(p,p.pos,p.yaw);}v.lastDt=0;v.applySkinnedPose(p,p.pos,p.yaw);v.skinnedRoot.updateMatrixWorld(true);function P(n){const o=v.skinnedRoot.getObjectByName(n),e=o.matrixWorld.elements;return [e[12],e[13],e[14]];}return {state:s.state,clip:s.clip,resolved:res&&res.name,flip:s.flipYOrientation||0,head:P('Head'),lh:P('hand_l'),rh:P('hand_r'),pelvis:P('pelvis')};}""",kind)
 for kind in ['ready','notch','release']:
  rep['states'][kind]=force(kind);page.wait_for_timeout(50);page.screenshot(path=str(OUT/(kind+'.png')))
 rep['boot']=page.evaluate("() => ({version:Arena.VERSION,build:Arena.BUILD})")
 b.close()
(OUT/'report.json').write_text(json.dumps(rep,indent=2))
print(json.dumps(rep,indent=2))
