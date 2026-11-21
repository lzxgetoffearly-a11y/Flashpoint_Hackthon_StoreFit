import json, math, sys, io, urllib.request, struct
import numpy as np, laspy
from concurrent.futures import ThreadPoolExecutor
BASE='https://s3-us-west-2.amazonaws.com/usgs-lidar-public/NY_NewYorkCity/'
ept=json.load(urllib.request.urlopen(BASE+'ept.json'))
B=ept['bounds']
def merc(lat,lng):
    x=lng*math.pi/180*6378137; y=math.log(math.tan(math.pi/4+lat*math.pi/360))*6378137; return x,y
hier_cache={}
def hier(key):
    if key not in hier_cache: hier_cache[key]=json.load(urllib.request.urlopen(BASE+'ept-hierarchy/'+key+'.json'))
    return hier_cache[key]
def nbounds(d,x,y,z):
    w=(B[3]-B[0])/2**d; h=(B[4]-B[1])/2**d; t=(B[5]-B[2])/2**d
    return B[0]+x*w,B[1]+y*h,B[2]+z*t,B[0]+(x+1)*w,B[1]+(y+1)*h,B[2]+(z+1)*t
def collect(bx,maxd):
    out=[]
    def walk(d,x,y,z,hkey):
        key=f'{d}-{x}-{y}-{z}'
        h=hier(hkey)
        if key not in h: return
        n=h[key]
        if n==-1: hkey=key; h=hier(key); n=h.get(key,0)
        nb=nbounds(d,x,y,z)
        if nb[3]<bx[0] or nb[0]>bx[2] or nb[4]<bx[1] or nb[1]>bx[3]: return
        if n>0: out.append(key)
        if d<maxd:
            for dx in (0,1):
                for dy in (0,1):
                    for dz in (0,1): walk(d+1,2*x+dx,2*y+dy,2*z+dz,hkey)
    walk(0,0,0,0,'0-0-0-0'); return out
def fetch(key):
    data=urllib.request.urlopen(BASE+'ept-data/'+key+'.laz').read()
    las=laspy.read(io.BytesIO(data))
    return np.vstack([las.x,las.y,las.z,las.classification,las.red>>8,las.green>>8,las.blue>>8]).T
if __name__=='__main__':
    lat,lng,R,maxd,name=float(sys.argv[1]),float(sys.argv[2]),float(sys.argv[3]),int(sys.argv[4]),sys.argv[5]
    k=1/math.cos(lat*math.pi/180)  # mercator scale
    cx,cy=merc(lat,lng); r=R*k
    keys=collect((cx-r,cy-r,cx+r,cy+r),maxd)
    print(len(keys),'nodes',file=sys.stderr)
    with ThreadPoolExecutor(16) as ex: arrs=list(ex.map(fetch,keys))
    P=np.vstack(arrs)
    m=(abs(P[:,0]-cx)<r)&(abs(P[:,1]-cy)<r)&(P[:,3]!=7)&(P[:,3]!=18)
    P=P[m]
    ex_=(P[:,0]-cx)/k; ny=(P[:,1]-cy)/k
    zg=np.percentile(P[P[:,3]==2][:,2],50) if (P[:,3]==2).any() else P[:,2].min()
    z=P[:,2]-zg
    print(len(P),'points; ground z',zg,file=sys.stderr)
    xyz=np.vstack([ex_,z,-ny]).T.astype(np.float32)  # three.js: x east, y up, z south
    rgb=P[:,4:7].astype(np.uint8); cls=P[:,3].astype(np.uint8)
    with open(name,'wb') as f:
        f.write(struct.pack('<I',len(P))); f.write(xyz.tobytes()); f.write(rgb.tobytes()); f.write(cls.tobytes())
    print('wrote',name,file=sys.stderr)
