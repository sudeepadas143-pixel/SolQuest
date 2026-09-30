import os, sys
from PIL import Image, ImageDraw
root='public/assets/sprites'
out=sys.argv[1]; sub=sys.argv[2]; scale=int(sys.argv[3]) if len(sys.argv)>3 else 3
files=sorted(f for f in os.listdir(os.path.join(root,sub)) if f.endswith('.png'))
ims=[(f,Image.open(os.path.join(root,sub,f)).convert('RGBA')) for f in files]
ims=[(f,im.resize((im.width*scale,im.height*scale),Image.NEAREST)) for f,im in ims]
cols=6; cw=max(i.width for _,i in ims)+10; ch=max(i.height for _,i in ims)+24
rows=(len(ims)+cols-1)//cols
sheet=Image.new('RGBA',(cols*cw,rows*ch),(0,0,0,255))
# checkerboard
d=ImageDraw.Draw(sheet)
for y in range(0,sheet.height,12):
    for x in range(0,sheet.width,12):
        d.rectangle([x,y,x+11,y+11],fill=(200,200,200) if (x//12+y//12)%2 else (150,150,150))
for i,(f,im) in enumerate(ims):
    x=(i%cols)*cw; y=(i//cols)*ch
    sheet.alpha_composite(im,(x+5,y+20)); d.text((x+5,y+4),f,fill=(0,0,0))
sheet.save(out)
