"""Inspección CPU, NO captura de navegador. Pillow es sólo herramienta de QA."""
import json,sys
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
root=Path(__file__).resolve().parents[2]
source=Path(sys.argv[1]);before=Path(sys.argv[2]) if len(sys.argv)>2 else None
classes=['devastador','guardian','centinela','rastreador','arcanista','vinculador']
states=['idle','attack','cast','hitWhileCasting','back','knockdown','death']
labels=['Reposo','Ataque','Casteo','Daño + casteo','Retroceso','Noqueo','Muerte']
font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',14)
def render(path,w=230,h=225):
 im=Image.new('RGB',(w,h),'#1d2b31');d=ImageDraw.Draw(im)
 triangles=json.loads(path.read_text())
 for t in sorted(triangles,key=lambda t:sum(p[2] for p in t['p']),reverse=True):
  if any(abs(p[0])>5 or abs(p[1])>5 for p in t['p']):continue
  p=[((v[0]+1)*w/2,(1-v[1])*h/2) for v in t['p']]
  d.polygon(p,fill=tuple(t['c']))
 return im
atlas=Image.new('RGB',(1690,1555),'#0a171f');d=ImageDraw.Draw(atlas)
d.text((25,16),'v0.38 · Proyección CPU del rig real · estados forzados · NO es captura del juego',font=font,fill='#d9c397')
for j,l in enumerate(labels):d.text((65+j*230,46),l,font=font,fill='#a8bbc2')
for i,c in enumerate(classes):
 y=80+i*240;d.text((20,y),c.upper(),font=font,fill='#d9c397')
 for j,s in enumerate(states):atlas.paste(render(source/(c+'-'+s+'.json')),(60+j*230,y+19))
 render(source/(c+'-attack.json'),500,500).save(root/'qa'/(c+'-pose-CPU.png'))
atlas.save(root/'qa/matriz-poses-CPU.png')
if before:
 compare=Image.new('RGB',(930,835),'#0a171f');d=ImageDraw.Draw(compare)
 d.text((24,15),'Comparación CPU con idéntico encuadre · NO captura de navegador',font=font,fill='#d9c397')
 for col,label in enumerate(['v0.37 · base','v0.38 · corrección']):d.text((45+col*450,43),label,font=font,fill='#b9cbd2')
 for i,(c,s)in enumerate([('arcanista','death'),('guardian','death'),('arcanista','knockdown')]):
  y=75+i*250;d.text((24,y),c+' · '+s,font=font,fill='#d9c397')
  compare.paste(render(before/(c+'-'+s+'.json'),440,225),(20,y+20))
  compare.paste(render(source/(c+'-'+s+'.json'),440,225),(470,y+20))
 compare.save(root/'qa/comparacion-CPU-v037-v038.png')
