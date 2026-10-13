#!/usr/bin/env python3
"""Simple contact sheet for preview PNGs. Optional dependency: pillow.
Run: py tools/agent/arena-contact-sheet.py qa/anim-devastador --out agent-qa/mosaico.png
"""
import argparse
from pathlib import Path
try:
    from PIL import Image,ImageDraw,ImageOps
except ImportError:
    raise SystemExit('Falta Pillow: py -m pip install pillow (opcional).')
p=argparse.ArgumentParser();p.add_argument('folder');p.add_argument('--out',default='agent-qa/contact-sheet.png');p.add_argument('--columns',type=int,default=3);a=p.parse_args()
root=Path(a.folder);images=sorted(root.glob('*.png'))
if not images:raise SystemExit('Sin imágenes PNG en '+str(root))
cols=max(1,min(8,a.columns));width=430;height=286;rows=(len(images)+cols-1)//cols
sheet=Image.new('RGB',(cols*width,rows*height),(30,31,36));d=ImageDraw.Draw(sheet)
for i,item in enumerate(images):
    with Image.open(item) as img: thumb=ImageOps.contain(img.convert('RGB'),(width-12,height-48))
    x=(i%cols)*width; y=(i//cols)*height
    sheet.paste(thumb,(x+(width-thumb.width)//2,y+4))
    d.text((x+9,y+height-37),item.stem[:63],fill='white')
out=Path(a.out);out.parent.mkdir(parents=True,exist_ok=True);sheet.save(out)
print('Mosaico:',out,'imágenes:',len(images),'NO es prueba de calidad temporal por sí sola')
