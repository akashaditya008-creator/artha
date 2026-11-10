/* Artha 3.8 — 3D layer: a living background on every screen, and the 3D allocation ring on home.
   Ring physics: a flywheel on a viscous bearing (drag to spin, flick and it keeps turning, friction slows it),
   tilt on a damped spring (push it up or down, it settles back with a small wobble).
   Falls back silently (the app draws a flat ring) when WebGL or three.js isn't available. */
(function(){
"use strict";
const T=window.THREE;
const webgl=(()=>{ try{ const c=document.createElement("canvas"); return !!(T&&(c.getContext("webgl")||c.getContext("experimental-webgl"))); }catch(e){ return false; } })();
const RM=matchMedia("(prefers-reduced-motion: reduce)");
const S={ok:webgl, calm:()=>RM.matches||document.documentElement.classList.contains("calm")};
S.setCalm=()=>{};
const THEME={home:0x3CF0D4,Stocks:0x5B8CFF,"Mutual Funds":0x2EE6B0,Bonds:0xFFB547,Other:0xE86CC8,NPS:0xFF8A3D,ins:0xB18CFF,pol:0xB18CFF};
let tgtCol=new (T?T.Color:Object)(THEME.home);
const pointer={x:0,y:0,tx:0,ty:0}; let scrollK=0, tilt=null;
addEventListener("pointermove",e=>{ pointer.tx=(e.clientX/innerWidth-.5)*2; pointer.ty=(e.clientY/innerHeight-.5)*2; },{passive:true});
addEventListener("deviceorientation",e=>{ if(e.gamma==null) return; tilt={x:Math.max(-1,Math.min(1,e.gamma/35)),y:Math.max(-1,Math.min(1,(e.beta-45)/35))}; },{passive:true});
S.scroll=y=>{ scrollK=Math.min(1,y/900); };
/* the background leans toward every tap and rushes forward for a moment (more on a save or a new screen) */
let boost=0; S.pulse=k=>{ boost=Math.min(2.4,boost+(k||1)); };
addEventListener("pointerdown",e=>{ pointer.tx=(e.clientX/innerWidth-.5)*2; pointer.ty=(e.clientY/innerHeight-.5)*2; boost=Math.min(2.4,boost+.18); },{passive:true});
S.theme=name=>{ if(typeof hexOf==="function") bgHex=hexOf(THEME[name]||THEME.home); if(webgl) tgtCol=new T.Color(THEME[name]||THEME.home); };

/* ---------- background: line-art at three depths over a floor grid. Plain 2D canvas, about 30 frames a second, asleep when the
   app is hidden or in "Simple and still". (The full WebGL scene that was here made every screen heavy on phones.) ---------- */
const hexOf=n=>"#"+("00000"+n.toString(16)).slice(-6); let bgHex=hexOf(THEME.home), bgOn=false;
S.initBg=function(c){ if(bgOn||!c||!c.getContext) return; const g=c.getContext("2d"); if(!g){ c.remove(); return; } bgOn=true;
  let W=0,H=0,last=0,z0=0,clear=false;
  const KIND=["coin","ring","cube","bars","rupee","tri","candle","ring","coin","cube","planet"], O=Array.from({length:24},(_,i)=>({k:KIND[i%KIND.length],x:(i*0.618)%1,y:(i*0.377+.08)%1,d:.35+((i*7)%10)/10*.9,r:i*1.3,vr:(((i*5)%7)-3)*.05,vx:(((i*3)%5)-2)*.004,vy:(((i*11)%7)-3)*.003,ph:i*1.7}));
  const ST=Array.from({length:80},(_,i)=>({x:(i*0.731)%1,y:(i*0.419)%1,d:.3+((i*13)%10)/10}));
  const size=()=>{ const dpr=Math.min(1.5,devicePixelRatio||1); W=innerWidth; H=innerHeight; c.width=W*dpr; c.height=H*dpr; g.setTransform(dpr,0,0,dpr,0,0); };
  function shape(o,s){ g.beginPath();
    if(o.k==="coin"){ g.ellipse(0,0,s,s*.42,0,0,6.283); g.moveTo(-s,0); g.lineTo(-s,s*.3); g.ellipse(0,s*.3,s,s*.42,0,3.1416,0,true); g.lineTo(s,0); }
    else if(o.k==="ring"){ g.arc(0,0,s,0,6.283); g.moveTo(s*.6,0); g.arc(0,0,s*.6,0,6.283); }
    else if(o.k==="cube"){ const a=s*.8; g.rect(-a,-a,a*1.6,a*1.6); g.moveTo(-a,-a); g.lineTo(-a*.4,-a*1.5); g.lineTo(a*1.2,-a*1.5); g.lineTo(a*.6,-a); g.moveTo(a*1.2,-a*1.5); g.lineTo(a*1.2,a*.1); g.lineTo(a*.6,a*.6); }
    else if(o.k==="bars"){ [.5,.9,.7,1.25].forEach((h,i)=>g.rect(-s+i*s*.55,s-h*s*1.4,s*.34,h*s*1.4)); }
    else if(o.k==="rupee"){ g.arc(0,0,s,0,6.283); g.moveTo(-s*.4,-s*.5); g.lineTo(s*.42,-s*.5); g.moveTo(-s*.4,-s*.2); g.lineTo(s*.42,-s*.2); g.moveTo(-s*.25,-s*.5); g.bezierCurveTo(s*.5,-s*.5,s*.5,s*.1,-s*.25,s*.1); g.lineTo(s*.3,s*.6); }
    else if(o.k==="tri"){ g.moveTo(0,-s); g.lineTo(s*.95,s*.7); g.lineTo(-s*.95,s*.7); g.closePath(); }
    else if(o.k==="planet"){ g.arc(0,0,s*.6,0,6.283); g.moveTo(s*1.3,0); g.ellipse(0,0,s*1.3,s*.34,0,0,6.283); }
    else { [[-.7,.2,.5],[-.2,-.3,.7],[.3,0,.4],[.8,-.6,.6]].forEach(([x,y,h])=>{ g.moveTo(x*s,(y-h)*s); g.lineTo(x*s,(y+h)*s); g.rect(x*s-s*.14,(y-h*.5)*s,s*.28,h*s); }); }
    g.stroke(); }
  const loop=now=>{ requestAnimationFrame(loop); if(document.hidden||document.documentElement.classList.contains("calm")||document.documentElement.classList.contains("locked")){ if(!clear){ g.clearRect(0,0,W,H); clear=true; } return; }
    if(now-last<32) return; const dt=Math.min(.06,(now-last)/1000); last=now; clear=false;
    boost*=Math.pow(.03,dt); if(boost<.004) boost=0;
    const tx=tilt?tilt.x:pointer.tx, ty=tilt?tilt.y:pointer.ty; pointer.x+=(tx-pointer.x)*.08; pointer.y+=(ty-pointer.y)*.08; const px=pointer.x, py=pointer.y;
    g.clearRect(0,0,W,H); g.strokeStyle=bgHex; g.fillStyle=bgHex; g.lineJoin="round"; g.lineCap="round";
    const hz=H*.56-scrollK*60, vx=W/2+px*26; z0=(z0+dt*(.2+boost*1.6))%1; g.lineWidth=1; g.globalAlpha=.14+Math.min(.14,boost*.09);
    g.beginPath(); for(let i=-9;i<=9;i++){ g.moveTo(vx+i*14,hz); g.lineTo(vx+i*W*.42,H+10); }
    for(let k=0;k<9;k++){ const t=(k+z0)/9, y=hz+(H-hz)*t*t; g.moveTo(0,y); g.lineTo(W,y); } g.stroke();
    ST.forEach(s=>{ g.globalAlpha=.25+.45*s.d; g.fillRect((s.x*W+px*18*s.d+W)%W,s.y*hz*1.05,1.4*s.d,1.4*s.d); });
    O.forEach(o=>{ o.x=(o.x+o.vx*dt*(1+boost*3)+1)%1; o.y=(o.y+o.vy*dt+1)%1; o.r+=o.vr*dt;
      const s=9+o.d*14, x=o.x*(W+80)-40+px*34*o.d, y=o.y*(H*.92)+Math.sin(now/2400+o.ph)*5-py*20*o.d;
      g.save(); g.translate(x,y); g.rotate(o.r); g.globalAlpha=(.13+.15*o.d)*(1+Math.min(.8,boost*.5)); g.lineWidth=1+o.d*.8; shape(o,s); g.restore(); });
    g.globalAlpha=1; };
  size(); addEventListener("resize",size); requestAnimationFrame(loop); };

/* ---------- 3D ring ---------- */
let RG=null;
const RI=1.42, RO=2.18, TILT0=-1.0, TMIN=-1.52, TMAX=-.12;
function shapeFor(a0,a1,ri,ro){ const s=new T.Shape(), st=Math.max(4,Math.ceil((a1-a0)/(Math.PI/40)));
  for(let i=0;i<=st;i++){ const a=a0+(a1-a0)*i/st; const x=Math.cos(a)*ro, y=Math.sin(a)*ro; i?s.lineTo(x,y):s.moveTo(x,y); }
  for(let i=st;i>=0;i--){ const a=a0+(a1-a0)*i/st; s.lineTo(Math.cos(a)*ri,Math.sin(a)*ri); }
  s.closePath(); return s; }
const wrapPi=a=>{ a=(a+Math.PI)%(2*Math.PI); if(a<0) a+=2*Math.PI; return a-Math.PI; };
/* segs: [{c, v, col, name, val, share}] · cb: {onPop(c|null), onOpen(c), onSwipe(dir)} */
S.ring=function(host,segs,cb){
  if(!webgl) return false;
  if(!RG||RG.host!==host){
    if(RG){ RG.dead=true; RG.r.dispose(); RG.c.remove(); RG.lab.remove(); RG.rst.remove(); }
    const c=document.createElement("canvas"); c.className="ring3d"; host.prepend(c);
    const lab=document.createElement("div"); lab.className="rlabs"; host.appendChild(lab);
    /* the ring stays where the user leaves it; this button brings back the default angle and the slow drift */
    const rst=document.createElement("button"); rst.type="button"; rst.className="rreset"; rst.hidden=true; rst.setAttribute("aria-label","Reset ring view");
    rst.innerHTML='<svg viewBox="0 0 24 24"><path d="M4 12a8 8 0 1 0 2.4-5.7M4 4v4.5h4.5"/></svg>'; host.appendChild(rst);
    const r=new T.WebGLRenderer({canvas:c,antialias:true,alpha:true}); r.setPixelRatio(Math.min(2,devicePixelRatio||1));
    const scene=new T.Scene(), cam=new T.PerspectiveCamera(36,1,.1,50); cam.position.set(0,-.2,8.4);
    scene.add(new T.AmbientLight(0xffffff,.55));
    const k=new T.PointLight(0xffffff,1.1,40); k.position.set(3,4,6); scene.add(k);
    const rim=new T.PointLight(0x88ccff,.8,40); rim.position.set(-5,-3,2); scene.add(rim);
    const root=new T.Group(); root.rotation.x=TILT0; scene.add(root);
    const spin=new T.Group(); root.add(spin);
    const halo=new T.Mesh(new T.TorusGeometry(2.55,.012,8,160),new T.MeshBasicMaterial({color:0x3CF0D4,transparent:true,opacity:.55})); root.add(halo);
    const halo2=new T.Mesh(new T.TorusGeometry(1.08,.008,8,120),new T.MeshBasicMaterial({color:0x3CF0D4,transparent:true,opacity:.35})); root.add(halo2);
    const og=new T.BufferGeometry(), on=60, op=new Float32Array(on*3); for(let i=0;i<on;i++){ const a=i/on*Math.PI*2; op[i*3]=Math.cos(a)*2.9; op[i*3+1]=Math.sin(a)*2.9; op[i*3+2]=(Math.random()-.5)*.25; }
    og.setAttribute("position",new T.BufferAttribute(op,3)); const orbit=new T.Points(og,new T.PointsMaterial({color:0x3CF0D4,size:.06,transparent:true,opacity:.8,blending:T.AdditiveBlending})); root.add(orbit); halo.visible=halo2.visible=orbit.visible=false;   // the thin outline circles around and inside the ring are gone
    RG={host,c,lab,rst,r,scene,cam,root,spin,halo,halo2,orbit,meshes:[],labs:new Map(),key:"",dead:false,cb:cb||{},
      th:0,w:.12,ph:TILT0,pv:0,rest:TILT0,user:false,yaw:0,drag:null,pop:null,zoom:0,t0:0,W:320,H:236};
    const size=()=>{ const w=host.clientWidth||320, hh=host.clientHeight, h=hh>120?hh:Math.round(w*.8); RG.W=w; RG.H=h; r.setSize(w,h,false); c.style.width=w+"px"; c.style.height=h+"px"; cam.aspect=w/h; cam.updateProjectionMatrix(); RG.dist=Math.max(8.4,3.15/(Math.tan(18*Math.PI/180)*cam.aspect)); };
    size(); new ResizeObserver(size).observe(host);
    const ray=new T.Raycaster(), v2=new T.Vector2();
    const pick=e=>{ const b=c.getBoundingClientRect(); v2.set((e.clientX-b.left)/b.width*2-1,-(e.clientY-b.top)/b.height*2+1); ray.setFromCamera(v2,cam); const h=ray.intersectObjects(RG.meshes); return h[0]&&h[0].object; };
    const centre=()=>{ const v=new T.Vector3(); RG.root.getWorldPosition(v); v.project(cam); return {x:(v.x+1)/2*RG.W,y:(1-v.y)/2*RG.H}; };
    /* screen-space radius of the inner hole (for "swipe the centre to change the figure") */
    const holeR=()=>{ const a=new T.Vector3(RI*.92,0,0), o=new T.Vector3(); RG.root.localToWorld(a); RG.root.getWorldPosition(o); a.project(cam); o.project(cam); return Math.abs(a.x-o.x)/2*RG.W; };
    c.addEventListener("pointerdown",e=>{ const b=c.getBoundingClientRect(), x=e.clientX-b.left, y=e.clientY-b.top, ce=centre(), dx=x-ce.x, dy=(y-ce.y)/Math.max(.25,Math.abs(Math.cos(RG.ph)));
      RG.drag={x0:e.clientX,y0:e.clientY,lx:e.clientX,ly:e.clientY,lt:performance.now(),t:performance.now(),moved:0,mode:"",hole:Math.hypot(dx,dy)<holeR(),vw:0,vp:0};
      c.setPointerCapture(e.pointerId); });
    c.addEventListener("pointermove",e=>{ const d=RG.drag; if(!d) return; const now=performance.now(), dt=Math.max(1,now-d.lt)/1000, dx=e.clientX-d.lx, dy=e.clientY-d.ly;
      d.lx=e.clientX; d.ly=e.clientY; d.lt=now; d.moved+=Math.abs(dx)+Math.abs(dy);
      /* within 30° of horizontal = a swipe between Invested / Value / Profit; any steeper angle turns and tilts the ring */
      if(!d.mode&&d.moved>10){ const ax=Math.abs(e.clientX-d.x0), ay=Math.abs(e.clientY-d.y0); d.mode=ay<=ax*.577?"swipe":"turn"; if(d.mode==="turn"&&RG.pop) setPop(null,true); }
      if(d.mode==="swipe"){ RG.cb.onSwipeMove&&RG.cb.onSwipeMove(e.clientX-d.x0); return; }
      if(d.mode!=="turn") return;
      /* the finger grabs the near rim: arc length dx on a rim of radius R (px) turns the wheel dx/R radians */
      const Rpx=Math.max(60,holeR()/(RI*.92)*RO), dth=dx/Rpx;
      RG.th+=dth; d.vw=d.vw*.6+(dth/dt)*.4;
      /* up / down tilts the ring; past the stops it resists like rubber */
      let np=RG.ph+dy*.0065; if(np<TMIN) np=TMIN-(TMIN-np)*.35; if(np>TMAX) np=TMAX+(np-TMAX)*.35; d.vp=d.vp*.6+((np-RG.ph)/dt)*.4; RG.ph=np; });
    const up=e=>{ const d=RG.drag; RG.drag=null; if(!d) return;
      if(d.mode==="turn"){ RG.w=Math.max(-24,Math.min(24,d.vw)); RG.pv=d.vp; RG.rest=Math.max(TMIN,Math.min(TMAX,RG.ph)); RG.user=true; RG.rst.hidden=false; return; }
      if(d.mode==="swipe"){ const dx=e.clientX-d.x0; RG.cb.onSwipeMove&&RG.cb.onSwipeMove(null); if(Math.abs(dx)>40&&RG.cb.onSwipe) RG.cb.onSwipe(dx<0?1:-1); return; }
      if(d.moved<10&&performance.now()-d.t<600){ const m=pick(e);
        if(!m){ if(RG.pop) setPop(null,true); else if(d.hole&&RG.cb.onSwipe) RG.cb.onSwipe(1); return; }
        const cc=m.userData.c; if(RG.pop===cc){ RG.cb.onOpen&&RG.cb.onOpen(cc); } else setPop(cc,true); } };
    c.addEventListener("pointerup",up);
    c.addEventListener("pointercancel",()=>{ if(RG.drag&&RG.drag.mode==="swipe"&&RG.cb.onSwipeMove) RG.cb.onSwipeMove(null); RG.drag=null; });
    rst.addEventListener("click",()=>{ RG.rest=TILT0; RG.user=false; RG.rst.hidden=true; RG.w=.12; if(RG.pop) setPop(null,true); });
    lab.addEventListener("click",e=>{ const b=e.target.closest("[data-c]"); if(!b) return; const cc=b.dataset.c; if(RG.pop===cc) RG.cb.onOpen&&RG.cb.onOpen(cc); else setPop(cc,true); });
    let last=performance.now();
    const loop=now=>{ if(RG.dead) return; requestAnimationFrame(loop); if(document.hidden||!c.isConnected||!c.offsetParent) return;
      const dt=Math.min(.05,(now-last)/1000); last=now; const calm=S.calm();
      if(!RG.drag){
        if(RG.pop){ /* turn the chosen slice to the front: critically damped spring on the angle */
          const m=RG.meshes.find(x=>x.userData.c===RG.pop); if(m){ const err=wrapPi(RG.th-(-Math.PI/2-m.userData.mid)), k=34;
            RG.w+=(-k*err-2*Math.sqrt(k)*RG.w)*dt; RG.th+=RG.w*dt; } }
        else { /* flywheel: viscous bearing pulls the speed toward a slow idle drift (none in calm mode) */
          const w0=0, c0=RG.user?1.6:.9; RG.w=w0+(RG.w-w0)*Math.exp(-c0*dt); if(Math.abs(RG.w-w0)<.002) RG.w=w0; RG.th+=RG.w*dt; }
        /* tilt: damped spring back to rest, a touch under-damped so a push wobbles once */
        const kt=38, ct=7.2; RG.pv+=(-kt*(RG.ph-RG.rest)-ct*RG.pv)*dt; RG.ph+=RG.pv*dt; }
      RG.spin.rotation.z=RG.th;
      const tx=tilt?tilt.x:pointer.x, ty=tilt?tilt.y:pointer.y;
      RG.root.rotation.x=RG.ph+ty*.08; RG.root.rotation.y=tx*.14;
      RG.orbit.rotation.z-=dt*.25*(calm?0:1); RG.halo2.rotation.z+=dt*.4;
      /* zoom toward the chosen slice */
      RG.zoom+=((RG.pop?1:0)-RG.zoom)*(1-Math.exp(-6*dt));
      const z=RG.zoom; RG.cam.position.set(0,-.2-.45*z,(RG.dist||8.4)-1.0*z); RG.cam.lookAt(0,-.3*z,0);
      const age=(now-RG.t0)/1000;
      RG.meshes.forEach((m,i)=>{ const u=m.userData, kk=calm?1:Math.min(1,Math.max(0,(age-i*.12)/.7)), e=1-Math.pow(1-kk,3);
        const on=RG.pop===u.c, dim=RG.pop&&!on;
        u.o+=((dim?.22:.96)-u.o)*(1-Math.exp(-8*dt)); u.f+=((on?1:0)-u.f)*(1-Math.exp(-7*dt));
        const out=.42*u.f, s=(.6+.4*e)*(1+.05*u.f);
        m.scale.set(s,s,Math.max(.001,e)*(1+.35*u.f)); m.position.set(Math.cos(u.mid)*out,Math.sin(u.mid)*out,.28*u.f);
        m.material.opacity=u.o; m.material.emissiveIntensity=.3+.45*u.f; });
      /* draw only when the ring has moved (it rests when untouched, so an idle screen costs nothing) */
      const sig=RG.th.toFixed(3)+"|"+RG.root.rotation.x.toFixed(2)+"|"+RG.root.rotation.y.toFixed(2)+"|"+z.toFixed(3)+"|"+RG.meshes.map(m=>m.userData.f.toFixed(2)+m.userData.o.toFixed(2)+m.scale.z.toFixed(2)).join("")+"|"+c.clientWidth;
      if(sig===RG.sig&&now-(RG.lr||0)<1500) return; RG.sig=sig; RG.lr=now;
      RG.r.render(RG.scene,RG.cam);
      placeLabels(); };
    requestAnimationFrame(loop);
  }
  RG.cb=cb||RG.cb;
  const tot=segs.reduce((s,x)=>s+Math.max(0,x.v),0), key=segs.map(s=>s.c+":"+Math.round(Math.max(0,s.v)/Math.max(1,tot)*1000)).join("|");
  /* labels: one per slice, always rewritten so the figure follows invested / value / profit */
  const seen=new Set();
  segs.forEach(s=>{ seen.add(s.c); let el=RG.labs.get(s.c); if(!el){ el=document.createElement("button"); el.type="button"; el.className="rlab"; el.dataset.c=s.c; RG.lab.appendChild(el); RG.labs.set(s.c,el); }
    el.style.setProperty("--c",s.col); el.innerHTML=`<b class="num">${s.val}</b>${s.share?`<i>${s.share}</i>`:""}`; el.setAttribute("aria-label",`${s.name}, open`); });
  [...RG.labs.keys()].forEach(k=>{ if(!seen.has(k)){ RG.labs.get(k).remove(); RG.labs.delete(k); } });
  if(key===RG.key) return true;
  RG.key=key; RG.meshes.forEach(m=>{ RG.spin.remove(m); m.geometry.dispose(); m.material.dispose(); }); RG.meshes=[];
  if(!tot) return true;
  let a=Math.PI/2; const gap=segs.length>1?.035:0;
  segs.forEach(s=>{ const sw=Math.max(0,s.v)/tot*Math.PI*2; if(sw<.01){ return; } const a0=a-sw+gap/2, a1=a-gap/2; a-=sw;
    const depth=.28+.55*(Math.max(0,s.v)/tot);
    const geo=new T.ExtrudeGeometry(shapeFor(a0,a1,RI,RO),{depth,bevelEnabled:true,bevelThickness:.04,bevelSize:.03,bevelSegments:2,curveSegments:24});
    const col=new T.Color(s.col);
    const m=new T.Mesh(geo,new T.MeshStandardMaterial({color:col,emissive:col,emissiveIntensity:.3,metalness:.45,roughness:.32,transparent:true,opacity:.96}));
    m.userData={c:s.c,mid:(a0+a1)/2,depth,o:1,f:0}; RG.spin.add(m); RG.meshes.push(m); });
  RG.t0=performance.now();
  return true;
};
function setPop(c,user){ if(!RG) return; RG.pop=c||null; RG.labs.forEach((el,k)=>{ el.classList.toggle("on",k===RG.pop); el.classList.toggle("dim",!!RG.pop&&k!==RG.pop); });
  if(user&&RG.cb.onPop) RG.cb.onPop(RG.pop); }
/* the app can pop a slice too (tapping a tile below the ring) */
S.ringFocus=c=>{ if(RG&&RG.pop!==(c||null)) setPop(c||null,false); };
const _v=webgl?new T.Vector3():null;
function placeLabels(){ if(!RG||!RG.labs.size) return; const W=RG.W, H=RG.H, half=W/2;
  RG.meshes.forEach(m=>{ const el=RG.labs.get(m.userData.c); if(!el) return; const u=m.userData, rr=(RI+RO)/2+.42*u.f; /* sits on the slice's top face, middle of the band */
    _v.set(Math.cos(u.mid)*rr,Math.sin(u.mid)*rr,u.depth*(1+.35*u.f)+.28*u.f+.06); m.parent.localToWorld(_v); _v.project(RG.cam);
    let x=(_v.x+1)/2*W, y=(1-_v.y)/2*H; /* scale lives in the transform (a CSS "scale" would also scale the translate and push the label past the ring) */
    const k=1+.22*u.f, w=(el.offsetWidth||80)*k, hh=(el.offsetHeight||50)*k; x=Math.max(w/2+2,Math.min(W-w/2-2,x)); y=Math.max(hh/2+2,Math.min(H-hh/2-4,y));
    el.style.transform=`translate(${x.toFixed(1)}px,${y.toFixed(1)}px) translate(-50%,-50%) scale(${k.toFixed(3)})`; el.style.zIndex=String(Math.round(100-_v.z*50)); });
  void half; }
S.ringColor=hex=>{ if(RG&&webgl){ const c=new T.Color(hex); RG.halo.material.color=c; RG.halo2.material.color=c; RG.orbit.material.color=c; } };
window.Scene3D=S;
})();
