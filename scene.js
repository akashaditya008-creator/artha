/* Artha 2.0 — 3D layer: a living background on every screen, and the 3D allocation ring on home.
   Falls back silently (the app draws a flat ring) when WebGL or three.js isn't available. */
(function(){
"use strict";
const T=window.THREE;
const webgl=(()=>{ try{ const c=document.createElement("canvas"); return !!(T&&(c.getContext("webgl")||c.getContext("experimental-webgl"))); }catch(e){ return false; } })();
const RM=matchMedia("(prefers-reduced-motion: reduce)");
const S={ok:webgl, calm:()=>RM.matches||document.documentElement.classList.contains("calm")};
let FOCUS=null;
S.ringFocus=c=>{ FOCUS=c||null; };
S.setCalm=()=>{};
const THEME={home:0x3CF0D4,Stocks:0x5B8CFF,"Mutual Funds":0x2EE6B0,Bonds:0xFFB547,NPS:0xFF8A3D,ins:0xB18CFF,pol:0xB18CFF};
let tgtCol=new (T?T.Color:Object)(THEME.home);
const pointer={x:0,y:0,tx:0,ty:0}; let scrollK=0, tilt=null;
addEventListener("pointermove",e=>{ pointer.tx=(e.clientX/innerWidth-.5)*2; pointer.ty=(e.clientY/innerHeight-.5)*2; },{passive:true});
addEventListener("deviceorientation",e=>{ if(e.gamma==null) return; tilt={x:Math.max(-1,Math.min(1,e.gamma/35)),y:Math.max(-1,Math.min(1,(e.beta-45)/35))}; },{passive:true});
S.scroll=y=>{ scrollK=Math.min(1,y/900); };
S.theme=name=>{ if(!webgl) return; tgtCol=new T.Color(THEME[name]||THEME.home); };

/* ---------- background ---------- */
let BG=null;
S.initBg=function(canvas){
  if(!webgl){ canvas.remove(); return; }
  const r=new T.WebGLRenderer({canvas,antialias:false,alpha:true,powerPreference:"low-power"});
  r.setPixelRatio(Math.min(1.5,devicePixelRatio||1));
  const scene=new T.Scene(), cam=new T.PerspectiveCamera(58,1,.1,220);
  scene.fog=new T.FogExp2(0x04070c,.05); cam.position.set(0,1.6,9);
  const col=new T.Color(THEME.home);
  // neon floor grid that keeps flowing towards you
  const grid=new T.GridHelper(160,80,col,col); grid.material.transparent=true; grid.material.opacity=.16; grid.position.y=-3; scene.add(grid);
  const grid2=new T.GridHelper(160,80,col,col); grid2.material=grid.material; grid2.position.y=9; scene.add(grid2);
  // star dust
  const N=900, g=new T.BufferGeometry(), p=new Float32Array(N*3);
  for(let i=0;i<N;i++){ p[i*3]=(Math.random()-.5)*60; p[i*3+1]=(Math.random()-.4)*24; p[i*3+2]=-Math.random()*70+6; }
  g.setAttribute("position",new T.BufferAttribute(p,3));
  const dust=new T.Points(g,new T.PointsMaterial({color:col,size:.07,transparent:true,opacity:.75,blending:T.AdditiveBlending,depthWrite:false})); scene.add(dust);
  // drifting wireframe solids
  const solids=[]; [[T.IcosahedronGeometry,[1.1,0]],[T.OctahedronGeometry,[.8,0]],[T.TorusKnotGeometry,[.6,.16,64,8]],[T.IcosahedronGeometry,[.7,0]]].forEach(([G,a],i)=>{
    const m=new T.Mesh(new G(...a),new T.MeshBasicMaterial({color:col,wireframe:true,transparent:true,opacity:.22}));
    m.position.set([-5,5.5,-4,4.5][i],[2.5,-.5,-1.8,3.6][i],[-8,-10,-14,-18][i]); m.userData.s=.12+Math.random()*.2; scene.add(m); solids.push(m); });
  BG={r,scene,cam,grid,grid2,dust,solids,col};
  const size=()=>{ r.setSize(innerWidth,innerHeight,false); cam.aspect=innerWidth/innerHeight; cam.updateProjectionMatrix(); };
  size(); addEventListener("resize",size);
  let last=performance.now();
  const loop=now=>{ requestAnimationFrame(loop); if(document.hidden||document.documentElement.classList.contains("calm")) return;
    const dt=Math.min(.05,(now-last)/1000); last=now; const calm=S.calm(), sp=calm?0:1;
    BG.col.lerp(tgtCol,.04); grid.material.color.copy(BG.col); dust.material.color.copy(BG.col); solids.forEach(m=>m.material.color.copy(BG.col));
    grid.position.z=(grid.position.z+dt*.9*sp)%2; grid2.position.z=grid.position.z;
    dust.rotation.y+=dt*.012*sp; dust.position.z=(dust.position.z+dt*.6*sp)%20;
    solids.forEach((m,i)=>{ m.rotation.x+=dt*m.userData.s*sp; m.rotation.y+=dt*m.userData.s*.8*sp; m.position.y+=Math.sin(now/1600+i)*.002*sp; });
    const tx=tilt?tilt.x:pointer.tx, ty=tilt?tilt.y:pointer.ty;
    pointer.x+=(tx-pointer.x)*.04; pointer.y+=(ty-pointer.y)*.04;
    cam.position.x=pointer.x*.9; cam.position.y=1.6-pointer.y*.5-scrollK*2.2; cam.lookAt(0,-scrollK*1.5,-6);
    r.render(scene,cam); };
  requestAnimationFrame(loop);
};

/* ---------- 3D ring ---------- */
let RG=null;
function shapeFor(a0,a1,ri,ro){ const s=new T.Shape(), st=Math.max(4,Math.ceil((a1-a0)/(Math.PI/40)));
  for(let i=0;i<=st;i++){ const a=a0+(a1-a0)*i/st; const x=Math.cos(a)*ro, y=Math.sin(a)*ro; i?s.lineTo(x,y):s.moveTo(x,y); }
  for(let i=st;i>=0;i--){ const a=a0+(a1-a0)*i/st; s.lineTo(Math.cos(a)*ri,Math.sin(a)*ri); }
  s.closePath(); return s; }
S.ring=function(host,segs,onTap){
  if(!webgl) return false;
  if(!RG||RG.host!==host){
    if(RG){ RG.dead=true; RG.r.dispose(); }
    const c=document.createElement("canvas"); c.className="ring3d"; host.prepend(c);
    const r=new T.WebGLRenderer({canvas:c,antialias:true,alpha:true}); r.setPixelRatio(Math.min(2,devicePixelRatio||1));
    const scene=new T.Scene(), cam=new T.PerspectiveCamera(36,1,.1,50); cam.position.set(0,-.2,8.4);
    scene.add(new T.AmbientLight(0xffffff,.55));
    const k=new T.PointLight(0xffffff,1.1,40); k.position.set(3,4,6); scene.add(k);
    const rim=new T.PointLight(0x88ccff,.8,40); rim.position.set(-5,-3,2); scene.add(rim);
    const root=new T.Group(); root.rotation.x=-1.0; scene.add(root);
    const spin=new T.Group(); root.add(spin);
    // halo, orbit dots and base plate
    const halo=new T.Mesh(new T.TorusGeometry(2.55,.012,8,160),new T.MeshBasicMaterial({color:0x3CF0D4,transparent:true,opacity:.55})); root.add(halo);
    const halo2=new T.Mesh(new T.TorusGeometry(1.08,.008,8,120),new T.MeshBasicMaterial({color:0x3CF0D4,transparent:true,opacity:.35})); root.add(halo2);
    const og=new T.BufferGeometry(), on=60, op=new Float32Array(on*3); for(let i=0;i<on;i++){ const a=i/on*Math.PI*2; op[i*3]=Math.cos(a)*2.9; op[i*3+1]=Math.sin(a)*2.9; op[i*3+2]=(Math.random()-.5)*.25; }
    og.setAttribute("position",new T.BufferAttribute(op,3)); const orbit=new T.Points(og,new T.PointsMaterial({color:0x3CF0D4,size:.06,transparent:true,opacity:.8,blending:T.AdditiveBlending})); root.add(orbit);
    RG={host,c,r,scene,cam,root,spin,halo,halo2,orbit,meshes:[],key:"",vel:0,drag:null,t0:0,dead:false,onTap};
    const size=()=>{ const w=host.clientWidth||320, h=Math.round(w*.74); r.setSize(w,h,false); c.style.width=w+"px"; c.style.height=h+"px"; cam.aspect=w/h; cam.updateProjectionMatrix(); };
    size(); new ResizeObserver(size).observe(host);
    const ray=new T.Raycaster(), v2=new T.Vector2();
    const pick=e=>{ const b=c.getBoundingClientRect(); v2.set((e.clientX-b.left)/b.width*2-1,-(e.clientY-b.top)/b.height*2+1); ray.setFromCamera(v2,cam); const h=ray.intersectObjects(RG.meshes); return h[0]&&h[0].object; };
    c.addEventListener("pointerdown",e=>{ RG.drag={x:e.clientX,y:e.clientY,t:performance.now(),moved:0,last:e.clientX}; c.setPointerCapture(e.pointerId); });
    c.addEventListener("pointermove",e=>{ const d=RG.drag; if(!d) return; const dx=e.clientX-d.last; d.last=e.clientX; d.moved+=Math.abs(dx)+Math.abs(e.clientY-d.y)*0; RG.spin.rotation.z+=dx*.012; RG.vel=dx*.012; });
    c.addEventListener("pointerup",e=>{ const d=RG.drag; RG.drag=null; if(!d) return; if(d.moved<8&&performance.now()-d.t<500){ const m=pick(e); if(m){ RG.pop=m; m.userData.popT=performance.now(); setTimeout(()=>RG.onTap&&RG.onTap(m.userData.c),260); } } });
    c.addEventListener("pointercancel",()=>{ RG.drag=null; });
    let last=performance.now();
    const loop=now=>{ if(RG.dead) return; requestAnimationFrame(loop); if(document.hidden||!c.isConnected||!c.offsetParent) return;
      const dt=Math.min(.05,(now-last)/1000); last=now; const calm=S.calm();
      if(!RG.drag){ RG.vel*=.94; RG.spin.rotation.z+=RG.vel+(calm?0:dt*.12); }
      const tx=tilt?tilt.x:pointer.x, ty=tilt?tilt.y:pointer.y;
      RG.root.rotation.x=-1.0+ty*.12; RG.root.rotation.y=tx*.18;
      RG.orbit.rotation.z-=dt*.25*(calm?0:1); RG.halo2.rotation.z+=dt*.4;
      const age=(now-RG.t0)/1000;
      RG.meshes.forEach((m,i)=>{ const k=calm?1:Math.min(1,Math.max(0,(age-i*.12)/.7)), e=1-Math.pow(1-k,3);
        m.scale.set(.6+.4*e,.6+.4*e,Math.max(.001,e)); const pop=m.userData.popT?Math.max(0,1-(now-m.userData.popT)/600):0;
        const foc=FOCUS&&m.userData.c===FOCUS, dim=FOCUS&&!foc; m.userData.o=(m.userData.o==null?1:m.userData.o); m.userData.o+=((dim?.18:.96)-m.userData.o)*.15; m.userData.f=(m.userData.f||0)+((foc?.16:0)-(m.userData.f||0))*.15;
        const out=.12*Math.sin(Math.PI*Math.min(1,pop*1.0))+m.userData.f; m.position.set(Math.cos(m.userData.mid)*out,Math.sin(m.userData.mid)*out,m.userData.f*.6);
        m.material.opacity=m.userData.o; m.material.emissiveIntensity=.28+.25*Math.sin(now/900+i)*(calm?0:1)*.5+pop*.5+(foc?.25:0); });
      RG.r.render(RG.scene,RG.cam); };
    requestAnimationFrame(loop);
  }
  RG.onTap=onTap;
  const tot=segs.reduce((s,x)=>s+x.v,0), key=segs.map(s=>s.c+":"+Math.round(s.v/Math.max(1,tot)*1000)).join("|");
  if(key===RG.key) return true;
  RG.key=key; RG.meshes.forEach(m=>{ RG.spin.remove(m); m.geometry.dispose(); m.material.dispose(); }); RG.meshes=[];
  if(!tot) return true;
  let a=Math.PI/2; const gap=segs.length>1?.035:0;
  segs.forEach(s=>{ const sw=s.v/tot*Math.PI*2; if(sw<.01){ return; } const a0=a-sw+gap/2, a1=a-gap/2; a-=sw;
    const depth=.28+.55*(s.v/tot);
    const geo=new T.ExtrudeGeometry(shapeFor(a0,a1,1.42,2.18),{depth,bevelEnabled:true,bevelThickness:.04,bevelSize:.03,bevelSegments:2,curveSegments:24});
    const col=new T.Color(s.col);
    const m=new T.Mesh(geo,new T.MeshStandardMaterial({color:col,emissive:col,emissiveIntensity:.3,metalness:.45,roughness:.32,transparent:true,opacity:.96}));
    m.userData={c:s.c,mid:(a0+a1)/2}; RG.spin.add(m); RG.meshes.push(m); });
  RG.t0=performance.now();
  return true;
};
S.ringColor=hex=>{ if(RG&&webgl){ const c=new T.Color(hex); RG.halo.material.color=c; RG.halo2.material.color=c; RG.orbit.material.color=c; } };
window.Scene3D=S;
})();
