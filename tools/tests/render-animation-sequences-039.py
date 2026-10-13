"""CPU triangle projection QA only; this is not browser gameplay footage."""
import json,sys
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
root=Path(__file__).resolve().parents[2]
source=Path(sys.argv[1]) if len(sys.argv)>1 else root/'qa/sequences-039'
report=json.loads((source/'report.json').read_text())
font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',16)
cases=[('devastador','left'),('devastador','right'),('devastador','back'),('devastador','kick'),('centinela','draw'),('centinela','release'),('arcanista','cast')]
w,h=240,230
atlas=Image.new('RGB',(w*6+45,h*7+100),'#0a171f');d=ImageDraw.Draw(atlas)
d.text((20,14),'v0.39 · Secuencias CPU del rig real · NO es captura de navegador',font=font,fill='#d9c397')
for j,p in enumerate([0,.2,.4,.6,.8,1]):d.text((j*w+30,44),f'Fase {p:.1f}',font=font,fill='#a8bbc2')
for i,(cid,state) in enumerate(cases):
 y=80+i*h;d.text((15,y),cid+' / '+state,font=font,fill='#d9c397')
 for j,frame in enumerate([0,24,48,72,96,120]):
  im=Image.new('RGB',(w,h-25),'#1d2b31');draw=ImageDraw.Draw(im)
  for t in sorted(json.loads((source/f'{cid}-{state}-{frame}.json').read_text()),key=lambda t:sum(p[2] for p in t['p']),reverse=True):
   if any(abs(p[0])>5 or abs(p[1])>5 for p in t['p']):continue
   draw.polygon([((v[0]+1)*w/2,(1-v[1])*(h-25)/2) for v in t['p']],fill=tuple(t['c']))
  atlas.paste(im,(20+j*w,y+24))
atlas.save(root/'qa/animation-sequences-039-CPU.png')
