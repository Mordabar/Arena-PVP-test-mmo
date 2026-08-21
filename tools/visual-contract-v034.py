#!/usr/bin/env python3
from pathlib import Path
from urllib.parse import urlparse, unquote
import json,mimetypes,math
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'docs'/'shots'/'v034-final';OUT.mkdir(parents=True,exist_ok=True)
ARGS=['--no-sandbox','--disable-dev-shm-usage','--disable-background-networking','--disable-component-update','--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--ignore-gpu-blocklist','--enable-unsafe-swiftshader']
def ct(p):return {'.js':'application/javascript','.css':'text/css','.glb':'model/gltf-binary','.json':'application/json','.png':'image/png'}.get(p.suffix.lower(),mimetypes.guess_type(str(p))[0] or 'application/octet-stream')
report={'tool':'visual-contract-v034','captures':[],'states':{},'metrics':{},'errors':[],'requestFailures':[]};bad=0
with sync_playwright() as pw:
 b=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=ARGS)
 page=b.new_page(viewport={'width':900,'height':506},device_scale_factor=1)
 page.on('pageerror',lambda e:report['errors'].append(str(e)))
 page.on('requestfailed',lambda r:report['requestFailures'].append(r.url+' :: '+str(r.failure)) if 'ERR_ABORTED' not in str(r.failure) else None)
 def route(rr):
  u=urlparse(rr.request.url)
  if u.hostname!='arena.local':rr.abort();return
  f=(ROOT/unquote(u.path.lstrip('/'))).resolve()
  try:f.relative_to(ROOT)
  except Exception:rr.fulfill(status=403,body='forbidden');return
  if not f.exists() or not f.is_file():rr.fulfill(status=404,body='not found');return
  rr.fulfill(status=200,path=str(f),content_type=ct(f),headers={'Access-Control-Allow-Origin':'*','Cache-Control':'no-store'})
 page.route('http://arena.local/**',route)
 html=(ROOT/'index.html').read_text().replace('<head>','<head><base href="http://arena.local/">',1)
 page.set_content(html,wait_until='domcontentloaded',timeout=30000)
 page.wait_for_function("() => window.Arena && Arena.Game && Arena.Render && Arena.Render.animationSourceReport",timeout=45000)
 page.wait_for_function("() => Arena.Game && Arena.Game.flow && Arena.Game.renderer && Arena.Game.world",timeout=45000)
 page.wait_for_timeout(700)
 report['boot']=page.evaluate("() => ({version:Arena.VERSION,build:Arena.BUILD,three:!!(Arena.Game.renderer&&Arena.Game.renderer.three),payload:Arena.Render.animationSourceReport})")
 if report['boot']['version']!='0.34.0' or report['boot']['build']!='warrior-ual-literal-speed-facing-v034' or not report['boot']['three']:bad+=1
 page.evaluate("() => {if(Arena.Game.renderer){Arena.Game.renderer._pixelRatio=.5;Arena.Game.renderer._w=0;Arena.Game.renderer._h=0;}}")
 page.evaluate("""()=>{const G=Arena.Game;G.playerClass='centinela';if(G.flow)G.flow.classId='centinela';G.flow.begin('training','centinela',0);G.buildScenario('duel');G._setBotsEnabled(false);const p=G.world.getPlayer();p.pos.x=p.pos.y=p.pos.z=0;p.prevPos.x=p.prevPos.y=p.prevPos.z=0;const es=G.world.entities.filter(e=>e.id!==p.id);es.forEach((e,i)=>{e.aiEnabled=false;e.pos.x=25+i*2;e.pos.z=25+i*2;});const t=es[0];if(t){t.pos.x=0;t.pos.z=3;t.godMode=true;p.targetId=t.id;G.renderer.selectedId=t.id;p.yaw=0;p.prevYaw=0;}G.renderer.syncVisuals(0);const c=G.renderer.camera;c.yaw=0;c.pitch=.10;c.distance=4.8;c.targetDistance=4.8;c.setFocus(0,.82,0);c.smoothFocus.x=0;c.smoothFocus.y=.82;c.smoothFocus.z=0;}""")
 page.wait_for_timeout(300)
 page.wait_for_function("() => {const G=Arena.Game,p=G.world.getPlayer(),v=p&&G.renderer.visuals[p.id];return !!(v&&v.player&&v.animLib);}",timeout=20000)
 page.evaluate("() => {const G=Arena.Game,p=G.world.getPlayer(),pv=G.renderer.visuals[p.id];if(pv)pv.update=function(){this.lastDt=0;};for(const id in G.renderer.visuals){if(String(id)!==String(p.id)){const v=G.renderer.visuals[id];if(v&&v.root){v.root.visible=false;v.update=function(){this.root.visible=false;};}}}}")
 def force(kind):
  return page.evaluate("""(kind)=>{const G=Arena.Game,p=G.world.getPlayer(),v=G.renderer.visuals[p.id],h=v.handle;h.intent=h.intent||{};h.intent.classId=p.classId;h.intent.archetype='archer';h.intent.hasTarget=true;h.intent.combatMode=true;p.combatMode=true;h.intent.visualAction=null;h.intent.speedBoosted=false;h.intent.crowdControl=null;h.casting=false;h.cast=0;h.castProgress=0;h.hurt=0;h.cc=null;h.ccBlend=0;h.loco.moveSpeed=0;h.loco.metersPerSecond=0;h.loco.moveForward=0;h.loco.moveRight=0;h.loco.turnRate=0;h.loco.airborne=false;h.loco.jumpPhase=0;h.loco.landingAmount=0;h.action={family:null,t:0,variant:0,visualAction:null,isPower:false,react:{amount:0,front:0,side:0}};if(kind==='notch'){h.casting=true;h.cast=.70;h.castProgress=.70;h.intent.castProgress=.70;h.intent.visualAction='archerPower';}if(kind==='release'){h.action={family:'ranged',t:.56,duration:1,variant:0,isPower:false,weight:1,visualAction:'ranged',react:{amount:0,front:0,side:0}};}const s=Arena.Render.AnimationStateMachine.select(h,'archer'),res=v.animLib.resolveSelection(s);for(let i=0;i<18;i++){v.lastDt=1/60;v.applySkinnedPose(p,p.pos,p.yaw);}v.lastDt=0;v.applySkinnedPose(p,p.pos,p.yaw);v.skinnedRoot.updateMatrixWorld(true);function P(n){const o=v.skinnedRoot.getObjectByName(n),e=o.matrixWorld.elements;return [e[12],e[13],e[14]];}function D(a,b){const dx=a[0]-b[0],dy=a[1]-b[1],dz=a[2]-b[2];return Math.hypot(dx,dy,dz);}const ul=P('upperarm_l'),ll=P('lowerarm_l'),hl=P('hand_l'),ur=P('upperarm_r'),lr=P('lowerarm_r'),hr=P('hand_r'),head=P('Head'),fl=P('foot_l'),fr=P('foot_r');return {state:s.state,clip:s.clip||null,resolved:res&&res.name||null,mask:s.mask||null,syncProgress:s.syncProgress,actual:v.player.actual||null,metrics:{rightHandHead:D(hr,head),leftHandForward:hl[2]-ul[2],rightElbowOut:Math.abs(lr[0]-hr[0]),stancePlanar:Math.hypot(fl[0]-fr[0],fl[2]-fr[2]),finite:[...ul,...ll,...hl,...ur,...lr,...hr,...head,...fl,...fr].every(Number.isFinite)}};}""",kind)
 def camera(yaw):
  page.evaluate("""(yaw)=>{const G=Arena.Game,c=G.renderer.camera;c.yaw=yaw;c.pitch=.10;c.distance=4.8;c.targetDistance=4.8;c.setFocus(0,.82,0);c.smoothFocus.x=0;c.smoothFocus.y=.82;c.smoothFocus.z=0;}""",yaw)
 for kind in ['ready','notch','release']:
  st=force(kind);report['states'][kind]={k:v for k,v in st.items() if k!='metrics'};report['metrics'][kind]=st['metrics']
  for view,yaw in [('front',0),('rear',math.pi)]:
   camera(yaw);page.wait_for_timeout(100);name=f'centinela_{kind}_{view}.png';page.screenshot(path=str(OUT/name));report['captures'].append(name)
 # adversarial posture gates derived from the reference video, not from clip names
 m=report['metrics']
 for k in ('ready','notch','release'):
  if not m[k]['finite']:bad+=1
  if m[k]['leftHandForward']<0.34:bad+=1
  if m[k]['stancePlanar']<0.35:bad+=1
 if m['notch']['rightHandHead']>0.24:bad+=1
 if m['notch']['rightElbowOut']<0.15:bad+=1
 if report['states']['ready']['mask']!='full' or report['states']['notch']['mask']!='upper' or report['states']['release']['mask']!='upper':bad+=1
 if report['states']['ready']['resolved']!='Arena_Archer_VideoReady' or report['states']['notch']['resolved']!='Arena_Archer_VideoNotch' or report['states']['release']['resolved']!='Arena_Archer_VideoShoot':bad+=1
 if report['errors'] or report['requestFailures']:bad+=1
 b.close()
(OUT/'runtime-report.json').write_text(json.dumps(report,indent=2,ensure_ascii=False))
print(json.dumps(report,indent=2,ensure_ascii=False))
print('VISUAL_CONTRACT_V034:', 'PASS' if bad==0 else 'FAIL','issues='+str(bad))
raise SystemExit(0 if bad==0 else 1)
