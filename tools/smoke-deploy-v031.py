#!/usr/bin/env python3
from pathlib import Path
from urllib.parse import urlparse,unquote
import json,mimetypes,sys
from playwright.sync_api import sync_playwright
ROOT=(Path(__file__).resolve().parents[1]/'dist-v031').resolve()
ARGS=['--no-sandbox','--disable-dev-shm-usage','--disable-background-networking','--disable-component-update','--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--ignore-gpu-blocklist','--enable-unsafe-swiftshader']
def ct(p):return {'.js':'application/javascript','.css':'text/css','.glb':'model/gltf-binary','.json':'application/json','.png':'image/png'}.get(p.suffix.lower(),mimetypes.guess_type(str(p))[0] or 'application/octet-stream')
rep={'errors':[],'requestFailures':[]};bad=0
with sync_playwright() as pw:
 b=pw.chromium.launch(headless=False,executable_path='/usr/bin/chromium',args=ARGS);page=b.new_page(viewport={'width':800,'height':450})
 page.on('pageerror',lambda e:rep['errors'].append(str(e)))
 page.on('requestfailed',lambda r:rep['requestFailures'].append(r.url+' :: '+str(r.failure)) if 'ERR_ABORTED' not in str(r.failure) else None)
 def route(rr):
  u=urlparse(rr.request.url)
  if u.hostname!='arena.local':rr.abort();return
  f=(ROOT/unquote(u.path.lstrip('/') or 'index.html')).resolve()
  try:f.relative_to(ROOT)
  except Exception:rr.fulfill(status=403,body='forbidden');return
  if not f.exists():rr.fulfill(status=404,body='missing');return
  rr.fulfill(status=200,path=str(f),content_type=ct(f),headers={'Access-Control-Allow-Origin':'*','Cache-Control':'no-store'})
 page.route('http://arena.local/**',route)
 html=(ROOT/'index.html').read_text().replace('<head>','<head><base href="http://arena.local/">',1)
 page.set_content(html,wait_until='domcontentloaded',timeout=30000)
 page.wait_for_function("() => window.Arena && Arena.Game && Arena.Game.renderer && Arena.Render && Arena.Render.animationSourceReport",timeout=60000)
 page.wait_for_timeout(600)
 rep['boot']=page.evaluate("() => ({version:Arena.VERSION,build:Arena.BUILD,three:!!(Arena.Game.renderer&&Arena.Game.renderer.three),payload:Arena.Render.animationSourceReport})")
 if rep['boot']['version']!='0.31.0' or not rep['boot']['three'] or rep['errors'] or rep['requestFailures']:bad+=1
 b.close()
OUT=(Path(__file__).resolve().parents[1]/'docs'/'shots'/'v031-final'/'deploy-smoke-report.json');OUT.parent.mkdir(parents=True,exist_ok=True);OUT.write_text(json.dumps(rep,indent=2,ensure_ascii=False),encoding='utf-8');print(json.dumps(rep,indent=2,ensure_ascii=False));print('saved:',OUT);print('DEPLOY_SMOKE_V031:', 'PASS' if bad==0 else 'FAIL');sys.exit(0 if bad==0 else 1)
