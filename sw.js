// Artha app shell: network first (so a new version shows the moment it is published), the cached copy only when offline.
const C="artha-v17",F=["./","index.html","app.css","app.js","scene.js","three.min.js","manifest.webmanifest","icon-192.png","icon-512.png"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(F.map(u=>new Request(u,{cache:"reload"})))).then(()=>self.skipWaiting()));});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k.startsWith("artha-")&&k!==C).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener("fetch",e=>{ const u=new URL(e.request.url); if(e.request.method!=="GET"||u.origin!==location.origin||u.pathname.endsWith("version.json")) return;
  const key=u.pathname.endsWith("/")?"./":u.pathname.replace(/^.*\//,"");
  const big=key==="three.min.js";
  const fromCache=()=>caches.match(key,{ignoreSearch:true}).then(m=>m||caches.match("index.html"));
  if(big){ e.respondWith(caches.match(key,{ignoreSearch:true}).then(m=>m||fetch(u.href))); return; }
  e.respondWith(Promise.race([
    fetch(u.href,{cache:"no-store"}).then(r=>{ if(r.ok){ const cp=r.clone(); caches.open(C).then(c=>c.put(key,cp)); return r; } return fromCache().then(m=>m||r); }),
    new Promise(res=>setTimeout(()=>res(null),4000))
  ]).then(r=>r||fromCache()).catch(fromCache)); });
self.addEventListener("notificationclick",e=>{ e.notification.close(); e.waitUntil(self.clients.matchAll({type:"window"}).then(cs=>cs.length?cs[0].focus():self.clients.openWindow("./"))); });
