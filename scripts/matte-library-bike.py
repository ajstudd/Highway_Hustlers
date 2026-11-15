"""Offline alpha extraction for approved studio bike renders; no RGB synthesis.

Use an isolated Python environment with rembg[cpu], pymatting and OpenCV.
U2Net proposes only a mask. Closed-form matting refines it against the source.
Opaque pixels remain factory RGB; only partial-alpha edge pixels are unmixed
from their studio background. The website does not import any of these packages.
Usage: python matte-library-bike.py <cache directory> [model cache directory]
Input: 00.source ...; output: 00.png ... at unchanged source dimensions.
"""
import os,sys
from pathlib import Path
os.environ.setdefault('OMP_NUM_THREADS','2')
if len(sys.argv)>2:os.environ['U2NET_HOME']=sys.argv[2]
wheel_region_start=float(sys.argv[3]) if len(sys.argv)>3 else .60
import cv2
import numpy as np
from PIL import Image
from rembg import new_session,remove
from pymatting import estimate_alpha_cf

cv2.setNumThreads(1)
session=new_session('u2net',providers=['CPUExecutionProvider'])
for path in sorted(Path(sys.argv[1]).glob('*.source')):
    output=path.with_suffix('.png')
    if output.exists():continue
    rgb=np.array(Image.open(path).convert('RGB'));h,w=rgb.shape[:2]
    mask=np.array(remove(Image.fromarray(rgb),session=session,only_mask=True))
    # Object segmentation fills enclosed wheel/spoke openings. Seed substantial
    # enclosed studio-colour islands in the lower wheel region as background;
    # small reflective details, lettering and upper painted panels stay intact.
    studio=np.median(np.concatenate([rgb[:,:32],rgb[:,-32:]],axis=1),axis=1)[:,None,:]
    studio_like=(np.max(np.abs(rgb.astype(float)-studio),axis=2)<10)&(np.min(rgb,axis=2)>225)
    count,labels,stats,centres=cv2.connectedComponentsWithStats(studio_like.astype('uint8'),8)
    wheel_openings=np.zeros((h,w),bool)
    for label in range(1,count):
        x,y,cw,ch,area=stats[label]
        if x==0 or y==0 or x+cw==w or y+ch==h:continue
        if area>w*h*.00018 and centres[label][1]>h*wheel_region_start and ch>h*.008:
            wheel_openings[labels==label]=True
    mask[wheel_openings]=0
    fg=cv2.erode((mask>245).astype('uint8'),np.ones((3,3),np.uint8))>0
    bg=cv2.erode((mask<10).astype('uint8'),np.ones((3,3),np.uint8))>0
    trimap=np.full((h,w),.5);trimap[bg]=0;trimap[fg]=1
    alpha=estimate_alpha_cf(rgb.astype(float)/255,trimap)
    alpha[alpha<.015]=0;alpha[alpha>.995]=1
    # Estimate each studio row using the outer margins, far from the bike.
    background=np.median(np.concatenate([rgb[:,:32],rgb[:,-32:]],axis=1),axis=1)[:,None,:]
    edge=(alpha>0)&(alpha<1)
    unmixed=np.clip((rgb.astype(float)-(1-alpha[:,:,None])*background)/np.maximum(alpha[:,:,None],.01),0,255)
    result=rgb.copy();result[edge]=np.uint8(np.rint(unmixed[edge]))
    Image.fromarray(np.dstack([result,np.uint8(np.rint(alpha*255))])).save(output)
    print(path.name,'→',output.name,flush=True)
