// Artha app shell (3.12).
// · Saved copy first, so Artha opens at once; the files are refreshed in the background for the next open.
// · Every downloaded app file is checked (size + a marker) before it is used or saved, so a broken or empty
//   file from the server is never shown: the last good copy is served instead.
// · "artha-good" keeps the last version that started properly on this phone. If a new version fails to start,
//   the page asks for a rollback and this worker serves that copy until the next update.
const C="artha-v30", G="artha-good", META="artha-meta";
const F=["./","index.html","app.css","app.js","scene.js","three.min.js","manifest.webmanifest","icon-192.png","icon-512.png"];
const MIN={"./":4000,"index.html":4000,"app.js":60000,"app.css":20000,"scene.js":8000,"three.min.js":100000};
const MARK={"./":'src="app.js',"index.html":'src="app.js',"app.js":"__arthaOK","scene.js":"Scene3D"};
let MODE=null;
const getMode=()=>MODE!=null?Promise.resolve(MODE):caches.open(META).then(c=>c.match("mode")).then(r=>r?r.text():"live").then(m=>MODE=m).catch(()=>MODE="live");
const setMode=m=>{ MODE=m; return caches.open(META).then(c=>c.put("mode",new Response(m))); };
const keyOf=u=>u.pathname.endsWith("/")?"./":u.pathname.replace(/^.*\//,"");
/* resolves to a Response only if it looks like a real copy of that file */
function good(key,r){ if(!r||!r.ok) return Promise.resolve(null); if(!MIN[key]) return Promise.resolve(r);
  return r.clone().text().then(t=>t.length>=MIN[key]&&(!MARK[key]||t.indexOf(MARK[key])>=0)?r:null,()=>null); }
self.addEventListener("install",e=>{ e.waitUntil(caches.open(C).then(c=>Promise.all(F.map(k=>fetch(new Request(k,{cache:"reload"})).then(r=>good(k,r)).then(r=>r?c.put(k,r):null).catch(()=>null)))).then(()=>self.skipWaiting())); });
self.addEventListener("activate",e=>{ e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k.startsWith("artha-")&&k!==C&&k!==G&&k!==META).map(k=>caches.delete(k)))).then(()=>self.clients.claim())); });
self.addEventListener("message",e=>{ if(e.origin&&e.origin!==location.origin) return; const d=e.data||{};
  /* only a version running live is promoted; while rolled back, the saved copy stays as it is */
  if(d.t==="good") e.waitUntil(getMode().then(m=>m==="good"?null:Promise.all([caches.open(C),caches.open(G)]).then(([c,g])=>Promise.all(F.map(k=>c.match(k).then(r=>r?g.put(k,r):null))))));
  if(d.t==="rollback") e.waitUntil(caches.open(G).then(g=>g.match("index.html")).then(r=>r?setMode("good"):null));
  if(d.t==="live") e.waitUntil(setMode("live"));
});
self.addEventListener("fetch",e=>{ const u=new URL(e.request.url); if(e.request.method!=="GET"||u.origin!==location.origin||u.pathname.endsWith("version.json")||u.pathname.endsWith("sw.js")) return;
  const key=keyOf(u); if(F.indexOf(key)<0) return;
  const fromC=()=>caches.match(key,{cacheName:C,ignoreSearch:true}), fromG=()=>caches.open(G).then(g=>g.match(key,{ignoreSearch:true}));
  const saved=()=>fromC().then(m=>m||fromG()).then(m=>m||(key==="./"?caches.match("index.html",{ignoreSearch:true}):null));
  /* Open from the saved copy at once (no waiting on the network). The whole set is refreshed in the background and kept only if
     every file arrived whole, so the app never runs a mix of two versions; the new set is used from the next open, and
     "Update now" in the app applies it straight away. */
  e.respondWith(getMode().then(mode=>{
    if(mode==="good") return fromG().then(m=>m||saved()).then(m=>m||fetch(u.href));
    return saved().then(m=>{ if(m){ if(key==="./"||key==="index.html") e.waitUntil(refreshAll()); return m; }
      return fetch(u.href,{cache:"no-store"}).then(r=>good(key,r).then(ok=>{ if(ok){ const cp=ok.clone(); caches.open(C).then(c=>c.put(key,cp)); return ok; } return r; })); });
  })); });
let refreshedAt=0;
function refreshAll(){ if(Date.now()-refreshedAt<60000) return Promise.resolve(); refreshedAt=Date.now();
  const L=F.filter(k=>k!=="three.min.js"&&k!=="./");
  return Promise.all(L.map(k=>fetch(new Request(k,{cache:"no-store"})).then(r=>good(k,r)).then(r=>r?[k,r]:null,()=>null)))
    .then(rs=>rs.every(Boolean)?caches.open(C).then(c=>Promise.all(rs.map(([k,r])=>k==="index.html"?Promise.all([c.put(k,r.clone()),c.put("./",r)]):c.put(k,r)))):null).catch(()=>null); }
self.addEventListener("notificationclick",e=>{ e.notification.close(); e.waitUntil(self.clients.matchAll({type:"window"}).then(cs=>cs.length?cs[0].focus():self.clients.openWindow("./"))); });
