import sys, json, math, struct, re
import os; sys.path.insert(0,os.path.dirname(__file__))
import numpy as np
from lidar import *
src=open(os.path.join(os.path.dirname(__file__),'..','src','data','candidates.js')).read()
cands=[dict(id=m[0],lat=float(m[1]),lng=float(m[2])) for m in re.findall(r"id: '([^']+)'.*?lat: ([\d.-]+), lng: ([\d.-]+)",src)]
R=100; out=os.path.join(os.path.dirname(__file__),'..','public','lidar')+'/'
import os; os.makedirs(out,exist_ok=True)
a=math.radians(28.9); AV=np.array([math.sin(a),math.cos(a)]); AC=np.array([math.cos(a),-math.sin(a)])
meta={}
for c in cands:
    k=1/math.cos(math.radians(c['lat'])); cx,cy=merc(c['lat'],c['lng']); r=R*k*1.45
    keys=collect((cx-r,cy-r,cx+r,cy+r),10)
    with ThreadPoolExecutor(16) as ex: P=np.vstack(list(ex.map(fetch,keys)))
    P=P[(P[:,3]!=7)&(P[:,3]!=18)]
    E=(P[:,0]-cx)/k; N=(P[:,1]-cy)/k
    u=E*AV[0]+N*AV[1]; v=E*AC[0]+N*AC[1]
    g=P[:,3]==2
    zg=np.median(P[g&(np.hypot(E,N)<60)][:,2]); Z=P[:,2]-zg
    # find street side: nearest across-avenue distance where most points are near ground (z<2.5)
    best=None
    for s in (1,-1):
        for d in np.arange(0,45,0.5):
            m=(abs(u)<8)&(s*v>=d)&(s*v<d+1)
            if m.sum()<20: continue
            if (Z[m]>8).mean()<0.2:
                if best is None or d<best[1]: best=(s,d)
                break
    s,d=best
    # room frame: x along avenue, z away from street (into building), origin at street face
    X=u*s*-1 if False else u; Zr=s*(d - s*v)  # distance from street face into building
    Zr=d - s*v
    keep=(abs(X)<R)&(abs(Zr)<R)
    X,Zr,Y,cls=X[keep],Zr[keep],Z[keep],P[keep][:,3]
    if len(X)>220000:
        idx=np.random.default_rng(0).choice(len(X),220000,replace=False); X,Zr,Y,cls=X[idx],Zr[idx],Y[idx],cls[idx]
    q=lambda a:np.clip(np.round(a*10),-32767,32767).astype(np.int16)
    with open(out+c['id']+'.bin','wb') as f:
        f.write(struct.pack('<I',len(X))); f.write(np.vstack([q(X),q(Y),q(Zr)]).T.copy().tobytes()); f.write(cls.astype(np.uint8).tobytes())
    meta[c['id']]=dict(points=int(len(X)),streetSide='east' if s>0 else 'west',streetFaceM=float(d),groundElevM=round(float(zg),2))
    print(c['id'],len(X),meta[c['id']],file=sys.stderr)
json.dump(dict(source='USGS 3DEP LiDAR, NY_NewYorkCity (2017), EPT on AWS Open Data: s3://usgs-lidar-public/NY_NewYorkCity',radiusM=R,quant=0.1,frame='x along avenue (Manhattan grid 28.9° east of north), y up from local ground median, z from the street-facing wall into the block',sites=meta),open(out+'meta.json','w'),indent=1)
