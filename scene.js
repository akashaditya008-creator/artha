/* Artha 3.3 — 3D layer: a living background on every screen, and the 3D allocation ring on home.
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
S.theme=name=>{ if(!webgl) return; tgtCol=new T.Color(THEME[name]||THEME.home); };

/* ---------- floating line-art: space and markets ---------- */
function art(kind){ const c=document.createElement("canvas"); c.width=c.height=256; const g=c.getContext("2d");
  g.strokeStyle="#fff"; g.fillStyle="#fff"; g.lineWidth=5; g.lineCap="round"; g.lineJoin="round";
  const ring=(x,y,r)=>{ g.beginPath(); g.arc(x,y,r,0,Math.PI*2); g.stroke(); };
  if(kind==="planet"){ ring(128,128,52); g.save(); g.translate(128,128); g.rotate(-.35); g.beginPath(); g.ellipse(0,0,108,26,0,Math.PI*.06,Math.PI*.94,true); g.stroke(); g.restore();
    g.globalAlpha=.5; g.beginPath(); g.arc(128,128,36,Math.PI*1.1,Math.PI*1.6); g.stroke(); }
  else if(kind==="moon"){ g.beginPath(); g.arc(128,128,70,Math.PI*.5,Math.PI*1.5); g.arc(150,128,58,Math.PI*1.38,Math.PI*.62,true); g.closePath(); g.stroke();
    g.globalAlpha=.6; [[118,96,7],[100,150,10],[132,176,5]].forEach(([x,y,r])=>ring(x,y,r)); }
  else if(kind==="galaxy"){ g.lineWidth=0; for(let i=0;i<520;i++){ const arm=i%2, t=Math.random()*3.4, r=8+t*30, a=t*1.9+arm*Math.PI+(Math.random()-.5)*.55;
      g.globalAlpha=.25+Math.random()*.75*(1-t/3.6); g.beginPath(); g.arc(128+Math.cos(a)*r,128+Math.sin(a)*r*.62,Math.random()*2.4+.6,0,Math.PI*2); g.fill(); }
    g.globalAlpha=1; g.beginPath(); g.arc(128,128,9,0,Math.PI*2); g.fill(); }
  else if(kind==="comet"){ const gr=g.createLinearGradient(30,210,190,60); gr.addColorStop(0,"rgba(255,255,255,0)"); gr.addColorStop(1,"#fff"); g.strokeStyle=gr;
    [-10,0,10].forEach(o=>{ g.beginPath(); g.moveTo(40+o,214-o); g.lineTo(184,72); g.stroke(); }); g.beginPath(); g.arc(190,66,14,0,Math.PI*2); g.fill(); }
  else if(kind==="stars"){ const P=[[40,190],[86,132],[132,150],[176,92],[214,60],[150,206]]; g.lineWidth=3; g.globalAlpha=.7; g.beginPath(); P.slice(0,5).forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y)); g.moveTo(132,150); g.lineTo(150,206); g.stroke();
    g.globalAlpha=1; P.forEach(([x,y],i)=>{ g.beginPath(); g.arc(x,y,i===3?9:6,0,Math.PI*2); g.fill(); }); }
  else if(kind==="candles"){ const C=[[30,150,120,170,100],[70,130,100,160,80],[110,120,70,140,60],[150,90,60,120,40],[190,70,30,90,20],[230,50,20,70,10]];
    C.forEach(([x,o,c,lo,hi],i)=>{ g.globalAlpha=i===2?.55:1; g.beginPath(); g.moveTo(x,hi+20); g.lineTo(x,lo+50); g.stroke(); const y0=Math.min(o,c)+30, h=Math.abs(o-c)+10; i===2?g.strokeRect(x-12,y0,24,h):g.fillRect(x-12,y0,24,h); }); }
  else if(kind==="trend"){ g.lineWidth=6; g.beginPath(); [[20,210],[70,170],[105,186],[150,120],[180,138],[226,60]].forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y)); g.stroke();
    g.beginPath(); g.moveTo(196,58); g.lineTo(228,56); g.lineTo(224,90); g.stroke(); g.globalAlpha=.35; g.lineWidth=3; g.beginPath(); g.moveTo(16,232); g.lineTo(240,232); g.moveTo(16,232); g.lineTo(16,30); g.stroke(); }
  else if(kind==="bars"){ [70,110,95,150,185].forEach((h,i)=>{ g.globalAlpha=.45+i*.13; g.fillRect(34+i*40,226-h,24,h); }); }
  else if(kind==="rupee"){ ring(128,128,96); g.lineWidth=12; g.beginPath(); g.moveTo(84,74); g.lineTo(172,74); g.moveTo(84,104); g.lineTo(172,104); g.moveTo(98,74);
    g.bezierCurveTo(176,74,176,136,98,136); g.lineTo(160,190); g.stroke(); }
  else if(kind==="pie"){ ring(128,128,84); g.beginPath(); g.moveTo(128,128); g.lineTo(128,44); g.moveTo(128,128); g.lineTo(200,170); g.moveTo(128,128); g.lineTo(52,166); g.stroke();
    g.globalAlpha=.4; g.beginPath(); g.moveTo(128,128); g.arc(128,128,84,-Math.PI/2,Math.PI*.17); g.closePath(); g.fill(); }
  const t=new T.CanvasTexture(c); t.needsUpdate=true; return t; }

/* ---------- background ---------- */
let BG=null;
S.initBg=function(canvas){
  if(!webgl){ canvas.remove(); return; }
  const r=new T.WebGLRenderer({canvas,antialias:false,alpha:true,powerPreference:"low-power"});
  r.setPixelRatio(Math.min(1.5,devicePixelRatio||1));
  const scene=new T.Scene(), cam=new T.PerspectiveCamera(58,1,.1,220);
  scene.fog=new T.FogExp2(0x04070c,.05); cam.position.set(0,1.6,9);
  const col=new T.Color(THEME.home);
  const grid=new T.GridHelper(160,80,col,col); grid.material.transparent=true; grid.material.opacity=.16; grid.position.y=-3; scene.add(grid);
  const grid2=new T.GridHelper(160,80,col,col); grid2.material=grid.material; grid2.position.y=9; scene.add(grid2);
  const N=900, g=new T.BufferGeometry(), p=new Float32Array(N*3);
  for(let i=0;i<N;i++){ p[i*3]=(Math.random()-.5)*60; p[i*3+1]=(Math.random()-.4)*24; p[i*3+2]=-Math.random()*70+6; }
  g.setAttribute("position",new T.BufferAttribute(p,3));
  const dust=new T.Points(g,new T.PointsMaterial({color:col,size:.07,transparent:true,opacity:.75,blending:T.AdditiveBlending,depthWrite:false})); scene.add(dust);
  const solids=[]; [[T.IcosahedronGeometry,[1.1,0]],[T.OctahedronGeometry,[.8,0]],[T.TorusKnotGeometry,[.6,.16,64,8]],[T.IcosahedronGeometry,[.7,0]]].forEach(([G,a],i)=>{
    const m=new T.Mesh(new G(...a),new T.MeshBasicMaterial({color:col,wireframe:true,transparent:true,opacity:.22}));
    m.position.set([-5,5.5,-4,4.5][i],[2.5,-.5,-1.8,3.6][i],[-8,-10,-14,-18][i]); m.userData.s=.12+Math.random()*.2; scene.add(m); solids.push(m); });
  /* drifting space + market line-art, kept faint so the numbers stay readable */
  const KINDS=["planet","candles","galaxy","trend","moon","rupee","stars","bars","comet","pie","planet","trend"], arts=[];
  KINDS.forEach((k,i)=>{ const mat=new T.SpriteMaterial({map:art(k),color:col,transparent:true,opacity:0,depthWrite:false,blending:T.AdditiveBlending});
    const s=new T.Sprite(mat), z=-7-((i*7.3)%24), sz=1.6+((i*1.37)%1.8);
    s.position.set(((i*5.1)%18)-9,((i*3.7)%9)-2.4,z); s.scale.set(sz,sz,1);
    s.userData={vx:(((i*13)%7)-3)*.035,vy:(((i*11)%5)-2)*.02,vr:(((i*17)%9)-4)*.012,o:.09+((i*7)%5)*.022,ph:i*1.3};
    scene.add(s); arts.push(s); });
  BG={r,scene,cam,grid,grid2,dust,solids,arts,col};
  const size=()=>{ r.setSize(innerWidth,innerHeight,false); cam.aspect=innerWidth/innerHeight; cam.updateProjectionMatrix(); };
  size(); addEventListener("resize",size);
  let last=performance.now();
  const loop=now=>{ requestAnimationFrame(loop); if(document.hidden||document.documentElement.classList.contains("calm")) return;
    const dt=Math.min(.05,(now-last)/1000); last=now; const calm=S.calm(), sp=calm?0:1;
    BG.col.lerp(tgtCol,.04); grid.material.color.copy(BG.col); dust.material.color.copy(BG.col); solids.forEach(m=>m.material.color.copy(BG.col));
    grid.position.z=(grid.position.z+dt*.9*sp)%2; grid2.position.z=grid.position.z;
    dust.rotation.y+=dt*.012*sp; dust.position.z=(dust.position.z+dt*.6*sp)%20;
    solids.forEach((m,i)=>{ m.rotation.x+=dt*m.userData.s*sp; m.rotation.y+=dt*m.userData.s*.8*sp; m.position.y+=Math.sin(now/1600+i)*.002*sp; });
    arts.forEach(s=>{ const u=s.userData; s.material.color.copy(BG.col);
      s.position.x+=u.vx*dt*sp; s.position.y+=(u.vy*dt+Math.sin(now/2600+u.ph)*.0016)*sp; s.material.rotation+=u.vr*dt*sp;
      if(s.position.x>11) s.position.x=-11; if(s.position.x<-11) s.position.x=11; if(s.position.y>7) s.position.y=-3; if(s.position.y<-3.2) s.position.y=7;
      const tw=u.o*(.75+.25*Math.sin(now/3200+u.ph)); s.material.opacity+=(tw-s.material.opacity)*.02; });
    const tx=tilt?tilt.x:pointer.tx, ty=tilt?tilt.y:pointer.ty;
    pointer.x+=(tx-pointer.x)*.04; pointer.y+=(ty-pointer.y)*.04;
    cam.position.x=pointer.x*.9; cam.position.y=1.6-pointer.y*.5-scrollK*2.2; cam.lookAt(0,-scrollK*1.5,-6);
    r.render(scene,cam); };
  requestAnimationFrame(loop);
};

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
    if(RG){ RG.dead=true; RG.r.dispose(); RG.c.remove(); RG.lab.remove(); }
    const c=document.createElement("canvas"); c.className="ring3d"; host.prepend(c);
    const lab=document.createElement("div"); lab.className="rlabs"; host.appendChild(lab);
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
    og.setAttribute("position",new T.BufferAttribute(op,3)); const orbit=new T.Points(og,new T.PointsMaterial({color:0x3CF0D4,size:.06,transparent:true,opacity:.8,blending:T.AdditiveBlending})); root.add(orbit);
    RG={host,c,lab,r,scene,cam,root,spin,halo,halo2,orbit,meshes:[],labs:new Map(),key:"",dead:false,cb:cb||{},
      th:0,w:.12,ph:TILT0,pv:0,yaw:0,drag:null,pop:null,zoom:0,t0:0,W:320,H:236};
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
      if(d.mode==="turn"){ RG.w=Math.max(-24,Math.min(24,d.vw)); RG.pv=d.vp; return; }
      if(d.mode==="swipe"){ const dx=e.clientX-d.x0; RG.cb.onSwipeMove&&RG.cb.onSwipeMove(null); if(Math.abs(dx)>40&&RG.cb.onSwipe) RG.cb.onSwipe(dx<0?1:-1); return; }
      if(d.moved<10&&performance.now()-d.t<600){ const m=pick(e);
        if(!m){ if(RG.pop) setPop(null,true); else if(d.hole&&RG.cb.onSwipe) RG.cb.onSwipe(1); return; }
        const cc=m.userData.c; if(RG.pop===cc){ RG.cb.onOpen&&RG.cb.onOpen(cc); } else setPop(cc,true); } };
    c.addEventListener("pointerup",up);
    c.addEventListener("pointercancel",()=>{ if(RG.drag&&RG.drag.mode==="swipe"&&RG.cb.onSwipeMove) RG.cb.onSwipeMove(null); RG.drag=null; });
    lab.addEventListener("click",e=>{ const b=e.target.closest("[data-c]"); if(!b) return; const cc=b.dataset.c; if(RG.pop===cc) RG.cb.onOpen&&RG.cb.onOpen(cc); else setPop(cc,true); });
    let last=performance.now();
    const loop=now=>{ if(RG.dead) return; requestAnimationFrame(loop); if(document.hidden||!c.isConnected||!c.offsetParent) return;
      const dt=Math.min(.05,(now-last)/1000); last=now; const calm=S.calm();
      if(!RG.drag){
        if(RG.pop){ /* turn the chosen slice to the front: critically damped spring on the angle */
          const m=RG.meshes.find(x=>x.userData.c===RG.pop); if(m){ const err=wrapPi(RG.th-(-Math.PI/2-m.userData.mid)), k=34;
            RG.w+=(-k*err-2*Math.sqrt(k)*RG.w)*dt; RG.th+=RG.w*dt; } }
        else { /* flywheel: viscous bearing pulls the speed toward a slow idle drift (none in calm mode) */
          const w0=calm?0:.12, c0=.55; RG.w=w0+(RG.w-w0)*Math.exp(-c0*dt); if(Math.abs(RG.w-w0)<.002) RG.w=w0; RG.th+=RG.w*dt; }
        /* tilt: damped spring back to rest, a touch under-damped so a push wobbles once */
        const kt=38, ct=7.2; RG.pv+=(-kt*(RG.ph-TILT0)-ct*RG.pv)*dt; RG.ph+=RG.pv*dt; }
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
        m.material.opacity=u.o; m.material.emissiveIntensity=.28+(calm?0:.12*Math.sin(now/900+i))+.45*u.f; });
      RG.r.render(RG.scene,RG.cam);
      placeLabels(); };
    requestAnimationFrame(loop);
  }
  RG.cb=cb||RG.cb;
  const tot=segs.reduce((s,x)=>s+Math.max(0,x.v),0), key=segs.map(s=>s.c+":"+Math.round(Math.max(0,s.v)/Math.max(1,tot)*1000)).join("|");
  /* labels: one per slice, always rewritten so the figure follows invested / value / profit */
  const seen=new Set();
  segs.forEach(s=>{ seen.add(s.c); let el=RG.labs.get(s.c); if(!el){ el=document.createElement("button"); el.type="button"; el.className="rlab"; el.dataset.c=s.c; RG.lab.appendChild(el); RG.labs.set(s.c,el); }
    el.style.setProperty("--c",s.col); el.innerHTML=`<small>${s.name}</small><b class="num">${s.val}</b>${s.share?`<i>${s.share}</i>`:""}`; el.setAttribute("aria-label",`${s.name}, open`); });
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
  RG.meshes.forEach(m=>{ const el=RG.labs.get(m.userData.c); if(!el) return; const u=m.userData, rr=RO+.42+.5*u.f;
    _v.set(Math.cos(u.mid)*rr,Math.sin(u.mid)*rr,u.depth*.5+.28*u.f); m.parent.localToWorld(_v); _v.project(RG.cam);
    let x=(_v.x+1)/2*W, y=(1-_v.y)/2*H; /* scale lives in the transform (a CSS "scale" would also scale the translate and push the label past the ring) */
    const k=1+.22*u.f, w=(el.offsetWidth||80)*k, hh=(el.offsetHeight||50)*k; x=Math.max(w/2+2,Math.min(W-w/2-2,x)); y=Math.max(hh/2+2,Math.min(H-hh/2-4,y));
    el.style.transform=`translate(${x.toFixed(1)}px,${y.toFixed(1)}px) translate(-50%,-50%) scale(${k.toFixed(3)})`; el.style.zIndex=String(Math.round(100-_v.z*50)); });
  void half; }
S.ringColor=hex=>{ if(RG&&webgl){ const c=new T.Color(hex); RG.halo.material.color=c; RG.halo2.material.color=c; RG.orbit.material.color=c; } };
window.Scene3D=S;
})();
