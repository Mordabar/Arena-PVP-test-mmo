#!/usr/bin/env python3
from pathlib import Path
from urllib.parse import urlparse, unquote
import json,mimetypes,sys
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'docs'/'shots'/'v031-final';OUT.mkdir(parents=True,exist_ok=True)
ARGS=['--no-sandbox','--disable-dev-shm-usage','--disable-background-networking','--disable-component-update','--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--ignore-gpu-blocklist','--enable-unsafe-swiftshader']
def ct(p):return {'.js':'application/javascript','.css':'text/css','.glb':'model/gltf-binary','.json':'application/json','.png':'image/png'}.get(p.suffix.lower(),mimetypes.guess_type(str(p))[0] or 'application/octet-stream')
only=(sys.argv[1] if len(sys.argv)>1 else 'guardian')
report={'tool':'visual-contract-v031-'+only,'captures':[],'states':{},'errors':[],'requestFailures':[]};bad=0
print('stage: playwright',flush=True)
with sync_playwright() as pw:
 print('stage: launch',flush=True)
 b=pw.chromium.launch(headless=False,executable_path='/usr/bin/chromium',args=ARGS)
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
 print('stage: set_content',flush=True)
 page.set_content(html,wait_until='domcontentloaded',timeout=30000)
 print('stage: wait report',flush=True)
 page.wait_for_function("() => window.Arena && Arena.Game && Arena.Render && Arena.Render.animationSourceReport",timeout=45000)
 print('stage: report ready',flush=True)
 page.wait_for_function("() => Arena.Game && Arena.Game.flow && Arena.Game.renderer && Arena.Game.world",timeout=45000)
 page.wait_for_timeout(900)
 report['boot']=page.evaluate("() => ({version:Arena.VERSION,build:Arena.BUILD,three:!!(Arena.Game.renderer&&Arena.Game.renderer.three),payload:Arena.Render.animationSourceReport})")
 if report['boot']['version']!='0.31.0' or not report['boot']['three']:bad+=1
 page.evaluate("() => {if(Arena.Game.renderer){Arena.Game.renderer._pixelRatio=.5;Arena.Game.renderer._w=0;Arena.Game.renderer._h=0;}}")
 def setup(cls):
  page.evaluate("""(cls)=>{const G=Arena.Game;G.playerClass=cls;if(G.flow)G.flow.classId=cls;G.flow.begin('training',cls,0);G.buildScenario('duel');G._setBotsEnabled(false);const p=G.world.getPlayer();p.pos.x=p.pos.y=p.pos.z=0;p.prevPos.x=p.prevPos.y=p.prevPos.z=0;const es=G.world.entities.filter(e=>e.id!==p.id);es.forEach((e,i)=>{e.aiEnabled=false;e.pos.x=25+i*2;e.pos.z=25+i*2;});const t=es[0];if(t){t.pos.x=.8;t.pos.z=3.0;t.godMode=true;p.targetId=t.id;G.renderer.selectedId=t.id;p.yaw=Math.atan2(t.pos.x,t.pos.z);p.prevYaw=p.yaw;}G.renderer.syncVisuals(0);const c=G.renderer.camera;c.yaw=0;c.pitch=.10;c.distance=4.8;c.targetDistance=4.8;c.setFocus(0,.82,0);c.smoothFocus.x=0;c.smoothFocus.y=.82;c.smoothFocus.z=0;}""",cls)
  page.wait_for_timeout(400)
  page.wait_for_function("() => {const G=Arena.Game,p=G.world.getPlayer(),v=p&&G.renderer.visuals[p.id];return !!(v&&v.player&&v.animLib);}",timeout=20000)
  page.evaluate("() => {const G=Arena.Game,p=G.world.getPlayer(),pv=G.renderer.visuals[p.id];if(pv)pv.update=function(){this.lastDt=0;};for(const id in G.renderer.visuals){if(String(id)!==String(p.id)){const v=G.renderer.visuals[id];if(v&&v.root){v.root.visible=false;v.update=function(){this.root.visible=false;};}}}}")
 def force(family=None,t=.5,variant=0,visual=None,hasTarget=True,move=None,boost=False,hurt=None,cc=None,jump=None):
  return page.evaluate("""([family,t,variant,visual,hasTarget,move,boost,hurt,cc,jump])=>{const G=Arena.Game,p=G.world.getPlayer(),v=G.renderer.visuals[p.id],h=v.handle,a=Arena.Data.archetypeOf(p.classId);h.intent=h.intent||{};h.intent.classId=p.classId;h.intent.archetype=a;h.intent.hasTarget=!!hasTarget;h.intent.visualAction=visual;h.intent.speedBoosted=!!boost;h.intent.crowdControl=cc&&cc.kind||null;h.casting=false;h.cast=0;h.hurt=0;h.hurtReaction='chest';h.cc=null;h.ccBlend=0;h.loco.moveSpeed=0;h.loco.metersPerSecond=0;h.loco.moveForward=0;h.loco.moveRight=0;h.loco.turnRate=0;h.loco.airborne=false;h.loco.jumpPhase=0;h.loco.landingAmount=0;h.action={family:null,t:0,variant:0,visualAction:null,isPower:false,react:{amount:0,front:0,side:0}};if(move){h.loco.moveSpeed=move.speed;h.loco.metersPerSecond=move.mps;h.loco.moveForward=move.f||0;h.loco.moveRight=move.r||0;}if(hurt){h.hurt=.8;h.hurtReaction=hurt;}if(cc){h.ccBlend=cc.blend;h.cc={rootPitch:cc.rootPitch||1};}if(jump!==null&&jump!==undefined){h.loco.airborne=true;h.loco.jumpPhase=jump;}if(family){h.action={family:family,t:t,duration:1,variant:variant,isPower:family!=='light',weight:1,visualAction:visual,react:{amount:0,front:0,side:0}};}const s=Arena.Render.AnimationStateMachine.select(h,a),res=v.animLib.resolveSelection(s);for(let i=0;i<16;i++){v.lastDt=1/60;v.applySkinnedPose(p,p.pos,p.yaw);}v.lastDt=0;v.applySkinnedPose(p,p.pos,p.yaw);return {classId:p.classId,state:s.state,clip:s.clip||null,resolved:res&&res.name||null,mask:s.mask||null,semanticSlot:s.semanticSlot||null,normalStage:s.normalStage||null,syncProgress:s.syncProgress,directUpperBase:s.directUpperBase||null,actual:v.player&&v.player.actual||null};}""",[family,t,variant,visual,hasTarget,move,boost,hurt,cc,jump])
 def cap(name,**kwargs):
  report['states'][name]=force(**kwargs);page.wait_for_timeout(120);page.screenshot(path=str(OUT/(name+'.png')));report['captures'].append(name+'.png')
 if only=='guardian':
  print('stage: setup guardian',flush=True); setup('guardian'); print('stage: guardian ready',flush=True)
  cap('guardian_combat_idle')
  impact=page.evaluate("() => Arena.Game.renderer.visuals[Arena.Game.world.getPlayer().id].handle.cfg.phases.light.impact")
  cap('guardian_normal_a',family='light',t=impact,variant=0)
  cap('guardian_normal_a_rec',family='light',t=.92,variant=0)
  cap('guardian_normal_b',family='light',t=impact,variant=1)
  cap('guardian_weapon_power_c',family='heavy',t=.5,variant=0,visual='heavy')
  cap('guardian_shield_dash_rm',family='shield',t=.45,variant=0,visual='shield')
  cap('guardian_shield_buff',family='cry',t=.45,variant=0,visual='guardBuff')
  cap('guardian_hit_chest',hurt='chest')
  cap('guardian_hit_head',hurt='head')
  cap('guardian_knockdown_loop',cc={'kind':'KNOCKDOWN','blend':.9,'rootPitch':1})
  cap('guardian_sprint',move={'speed':1,'mps':4,'f':1,'r':0},boost=True)
  cap('guardian_jump_air',jump=.5)
 elif only=='devastador':
  setup('devastador')
  cap('devastador_combat_idle')
  impact=page.evaluate("() => Arena.Game.renderer.visuals[Arena.Game.world.getPlayer().id].handle.cfg.phases.light.impact")
  cap('devastador_normal_a',family='light',t=impact,variant=0)
  cap('devastador_normal_b',family='light',t=impact,variant=1)
  cap('devastador_weapon_power_c',family='heavy',t=.5,variant=0,visual='heavy')
  cap('devastador_kick',family='kick',t=.5,variant=0,visual='kick')
  cap('devastador_sprint',move={'speed':1,'mps':4,'f':1,'r':0},boost=True)
 else: bad+=1
 # exact semantic gates
 for k,v in report['states'].items():
  if v.get('resolved') is None: bad+=1
 exp={
  'guardian_combat_idle':'Idle_Shield_Loop','guardian_normal_a':'Sword_Regular_A','guardian_normal_a_rec':'Sword_Regular_A_Rec','guardian_normal_b':'Sword_Regular_B','guardian_weapon_power_c':'Sword_Regular_C','guardian_shield_dash_rm':'Shield_Dash_RM','guardian_shield_buff':'Shield_OneShot','guardian_hit_chest':'Hit_Chest','guardian_hit_head':'Hit_Head','guardian_knockdown_loop':'Slide_Loop','guardian_sprint':'Sprint_Loop','guardian_jump_air':'Jump_Loop',
  'devastador_combat_idle':'Sword_Idle','devastador_normal_a':'Sword_Regular_A','devastador_normal_b':'Sword_Regular_B','devastador_weapon_power_c':'Sword_Regular_C','devastador_kick':'Arena_CMU_Kick','devastador_sprint':'Sprint_Loop'}
 for k,want in exp.items():
  if k in report['states'] and report['states'][k].get('resolved')!=want: bad+=1
 if report['errors'] or report['requestFailures']:bad+=1
 b.close()
(OUT/('runtime-report-'+only+'.json')).write_text(json.dumps(report,indent=2,ensure_ascii=False))
print(json.dumps(report,indent=2,ensure_ascii=False))
print('VISUAL_CONTRACT_V031:', 'PASS' if bad==0 else 'FAIL','issues='+str(bad))
sys.exit(0 if bad==0 else 1)
