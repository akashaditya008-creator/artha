/* Artha 3.9 — investments + insurance. Data lives in the "Artha – My Investments" Google Sheet via the Apps Script API. */
(()=>{
"use strict";
const APP_VERSION="3.13.0";
/* Personal details (banks, platforms, the Claude project link) come from the backend after sign-in, so this public code holds none. */
const CFG=()=>(typeof DATA!=="undefined"&&DATA&&DATA.cfg)||{};
const PROJECT_URL=()=>{ const u=safeUrl(CFG().project); return u==="#"?"https://claude.ai/projects":u; };
const $=id=>document.getElementById(id);
const store={get(k,d){try{const v=localStorage.getItem("artha:"+k);return v==null?d:JSON.parse(v);}catch(e){return d;}},set(k,v){try{localStorage.setItem("artha:"+k,JSON.stringify(v));}catch(e){}}};
const esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
/* links from the sheet, Drive or Claude: only https:// is allowed (never javascript: or data:) */
const safeUrl=u=>{ if(!u) return "#"; try{ const x=new URL(String(u),location.href); if(x.protocol==="https:") return x.href; }catch(e){} return "#"; };
const SUM=(a,f)=>a.reduce((s,x)=>s+(f?f(x):x),0);
const splitPr=v=>{ const i=v.lastIndexOf("|"); return [v.slice(0,i),v.slice(i+1)]; };
const rid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,8);
/* 3D layer: three.js (600 KB) is loaded after the app itself has started, so it never delays the lock screen; until then a stub answers */
let S3={ok:false,stub:true,theme(){},scroll(){},initBg(){},ring(){return false;},ringColor(){},ringFocus(){},setCalm(){},pulse(){}};
let ready3D=null;
function load3D(){ if(ready3D) return ready3D; const one=(src,sri)=>new Promise(res=>{ const s=document.createElement("script"); s.src=src; if(sri) s.integrity=sri; s.onload=()=>res(true); s.onerror=()=>res(false); document.head.appendChild(s); });
  const sri=(document.querySelector('meta[name="three-sri"]')||{}).content||"";
  return ready3D=one("three.min.js",sri).then(()=>one("scene.js?v="+APP_VERSION)).then(()=>{ if(window.Scene3D) S3=window.Scene3D; else { const c=$("bg3d"); if(c) c.remove(); } return S3.ok; },()=>false); }
const soon3D=ms=>Promise.race([load3D(),new Promise(r=>setTimeout(r,ms))]);

/* ---------- endpoint (only from the private setup link) ---------- */
function takeLink(s){ const m=/[#&?]k=([\w-]{20,})/.exec(s||"")||/\/macros\/s\/([\w-]{20,})\//.exec(s||""); if(!m) return false; store.set("api","https://script.google.com/macros/s/"+m[1]+"/exec"); return true; }
if(takeLink(location.hash)) history.replaceState(null,"",location.pathname+location.search);
/* The backend address is built in, so a new phone needs no setup link: open Artha, sign in with Google, and the backend lets in
   only the allowed accounts. (A setup link still works and wins, for another family or a moved backend.) */
const HOME_API="https://script.google.com/macros/s/AKfycbyQ6Nj8b9icyxlT_Pk-dbPr9RnEJOPo4ZTDoDY9Z1WHbBxypIlq3sG8svOdq5w1WrA/exec";
const API=()=>store.get("api","")||HOME_API, PW=()=>store.get("tok","");
try{ localStorage.removeItem("artha:pass"); }catch(e){} // the old family passcode is no longer used
function call(action,extra){
  return fetch(API(),{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify(Object.assign({action,pass:PW()},extra||{}))})
    .then(r=>r.json(),()=>{ const x=new Error("Couldn't reach Google just now. Check your internet."); x.net=true; throw x; })
    .then(r=>{ if(r&&r.ok) return r.d; throw new Error((r&&r.m)||"Couldn't reach the sheet."); });
}

/* ---------- dates & money ---------- */
const pad2=n=>String(n).padStart(2,"0");
const isoOf=d=>`${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
const TODAY=()=>isoOf(new Date());
const dOf=s=>new Date(s+"T00:00:00");
const MON=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const fmtD=s=>{ if(!s) return "No date"; const d=dOf(s); return `${d.getDate()} ${MON[d.getMonth()]} ${d.getFullYear()}`; };
const fmtDs=s=>{ if(!s) return "No date"; const d=dOf(s); return `${d.getDate()} ${MON[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`; };
const days=(a,b)=>Math.round((dOf(b)-dOf(a))/864e5);
const addMonths=(s,n)=>{ const d=dOf(s); d.setMonth(d.getMonth()+n); return isoOf(d); };
const addDays=(s,n)=>{ const d=dOf(s); d.setDate(d.getDate()+n); return isoOf(d); };
let HIDE=store.get("hide",false), SHORT=store.get("amt","short")==="short";
function rs(n,short){ const a=Math.abs(n), s=n<0?"−":"";
  if(short||SHORT&&short!==false){ const f=(x,dp)=>String(parseFloat(x.toFixed(dp)));
    if(a>=1e7) return s+"₹"+f(a/1e7,2)+"Cr"; if(a>=1e5) return s+"₹"+f(a/1e5,a>=1e6?1:2)+"L"; if(a>=1e3) return s+"₹"+f(a/1e3,a>=1e4?0:1)+"K"; return s+"₹"+Math.round(a); }
  return s+"₹"+Math.round(a).toLocaleString("en-IN"); }
/* exact figure with paise when there are any (detail pages): 60.33, 24,132 */
const rsx=n=>{ const a=Math.abs(n), s=n<0?"−":"", f=Math.abs(a-Math.round(a))>=.005; return s+"₹"+a.toLocaleString("en-IN",{minimumFractionDigits:f?2:0,maximumFractionDigits:2}); };
const moneyX=n=>HIDE?'<span class="money">₹••••</span>':esc(rsx(n));
const money=(n,short)=>HIDE?'<span class="money">₹••••</span>':esc(rs(n,short));
const smoney=(n,short)=>HIDE?'<span class="money">₹••••</span>':esc((n>0?"+":"")+rs(n,short));
const pct=x=>x==null||!isFinite(x)?"—":(x>0?"+":"")+(x*100).toFixed(Math.abs(x)>=1?0:1)+"%";
const pctp=x=>x==null||!isFinite(x)?"—":(x*100).toFixed(x>=.995?0:1)+"%";
const cls=n=>n>0?"gain":n<0?"loss":"";
const qtyf=q=>(Math.round(q*1000)/1000).toLocaleString("en-IN");
const nice=v=>{ if(v<=0) return 1; const p=Math.pow(10,Math.floor(Math.log10(v))), m=v/p; return (m<=1?1:m<=2?2:m<=2.5?2.5:m<=5?5:10)*p; };
const numIn=v=>Number(String(v==null?"":v).replace(/[^\d.]/g,""))||0;

function xirr(flows){
  const f=flows.filter(x=>x[0]&&x[1]).sort((a,b)=>a[0]<b[0]?-1:a[0]>b[0]?1:0);
  if(f.length<2||!f.some(x=>x[1]>0)||!f.some(x=>x[1]<0)) return null;
  const t0=dOf(f[0][0]).getTime(), g=f.map(x=>[(dOf(x[0]).getTime()-t0)/864e5/365,x[1]]);
  if(g[g.length-1][0]<0.02) return null;
  const npv=r=>g.reduce((s,x)=>s+x[1]/Math.pow(1+r,x[0]),0);
  let lo=-0.9999,hi=10,flo=npv(lo),fhi=npv(hi);
  for(let k=0;k<60&&flo*fhi>0;k++){ hi*=2; fhi=npv(hi); if(hi>1e6) return null; }
  if(flo*fhi>0) return null;
  for(let k=0;k<200;k++){ const m=(lo+hi)/2,fm=npv(m); if(Math.abs(fm)<1e-7||hi-lo<1e-10) return m; if(fm*flo<0){hi=m;fhi=fm;} else {lo=m;flo=fm;} }
  return (lo+hi)/2;
}

/* ---------- icons ---------- */
const P={fd:"M3 9l9-5 9 5M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18",cash:"M3 7h18v10H3zM12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5M6 10v.01M18 14v.01",
  stocks:"M3 17l5-5 4 4 8-8M15 8h5v5",
  mf:"M12 3a9 9 0 1 0 9 9h-9zM15 3.5A9 9 0 0 1 20.5 9H15z",
  bond:"M6 3h12v18H6zM9 8h6M9 12h6M9 16h3.5",
  nps:"M3 18h18M7 18a5 5 0 0 1 10 0M12 8V5M5.6 11.6 3.8 9.8M18.4 11.6l1.8-1.8",
  term:"M12 3 20 6v6c0 4.5-3.4 8.2-8 9-4.6-.8-8-4.5-8-9V6l8-3zM9 12l2 2 4-4",
  shield:"M12 3 20 6v6c0 4.5-3.4 8.2-8 9-4.6-.8-8-4.5-8-9V6l8-3z",
  us:"M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z",
  elss:"M7 11V7a5 5 0 0 1 10 0v4M5 11h14v10H5zM12 15v2",
  bell:"M6 17V11a6 6 0 0 1 12 0v6l1.5 2h-15zM10 21h4",
  upload:"M12 16V4M7 9l5-5 5 5M4 16v4h16v-4",
  health:"M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10zM9 11h2V9h2v2h2v2h-2v2h-2v-2H9z",
  car:"M5 16h14M3 16v-3l2-5h14l2 5v3M6 16v2M18 16v2M7 13h.01M17 13h.01",
  scooter:"M6 18a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM18 18a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM8 16h6l3-8h2M14 8h-3M6 14l2-5h3",
  home:"M4 11 12 4l8 7v9H4zM10 20v-5h4v5",
  travel:"M3 13l18-7-7 18-2.5-7.5z",
  life:"M12 21s-8-5-8-11a5 5 0 0 1 8-4 5 5 0 0 1 8 4c0 6-8 11-8 11z",
  other:"M4 4h6.5v6.5H4zM13.5 4H20v6.5h-6.5zM4 13.5h6.5V20H4zM13.5 13.5H20V20h-6.5z",
  file:"M7 3h7l5 5v13H7zM14 3v5h5",
  spark:"M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z",
  cal:"M4 6h16v14H4zM4 10h16M8 3v5M16 3v5",
  edit:"M4 20h4L19 9l-4-4L4 16zM14 6l4 4",
  inbox:"M4 13h4l2 3h4l2-3h4M4 13l3-8h10l3 8v6H4z",
  check:"M5 12l5 5 9-10",
  plus:"M12 5v14M5 12h14"
};
const svgI=(k,col,sz)=>`<svg viewBox="0 0 24 24" style="stroke:${col}${sz?`;width:${sz}px;height:${sz}px`:""}"><path d="${P[k]||P.other}"/></svg>`;
const CLS={
  Stocks:{label:"Stocks",icon:"stocks",col:"#5B8CFF"},
  "Mutual Funds":{label:"Mutual funds",icon:"mf",col:"#2EE6B0"},
  Bonds:{label:"Bonds & FDs",icon:"bond",col:"#FFB547"},
  NPS:{label:"NPS",icon:"nps",col:"#FF8A3D"},
  Others:{label:"NPS",icon:"nps",col:"#FF8A3D"},
  Term:{label:"Term insurance",icon:"term",col:"#B18CFF"},
  Other:{label:"Other investments",icon:"other",col:"#E86CC8"}};
const HOME=["Stocks","Mutual Funds","Bonds","Other"];   // NPS and term insurance are never in a total
const AVC=["#5B8CFF","#2EE6B0","#FF6B8B","#8B7CFF","#FFB547","#35C4F0","#E86CC8","#7BDB5A","#D99A6C","#9A8CFF"];
const initials=s=>{ const w=String(s).replace(/\b(ltd|limited|fund|direct|growth|plan|the|of|india)\b/gi,"").trim().split(/\s+/).filter(Boolean); return w.length>1?(w[0][0]+w[1][0]).toUpperCase():(w[0]||"•").slice(0,2).toUpperCase(); };
const avColor=s=>{ let h=0; for(const ch of String(s)) h=(h*31+ch.charCodeAt(0))>>>0; return AVC[h%AVC.length]; };

/* ---------- model: one Ledger. Every entry = date · whose money · account · asset · type · name · qty · price · amount ---------- */
const WHOS=["Aditya","Spardha"], WHOC={Aditya:"#5B8CFF",Spardha:"#E86CC8"};
const ACCT0=()=>Array.isArray(CFG().acct0)?CFG().acct0.map(String):[];
const whoVia=(who,a)=>{ if(!/ · /.test(a||"")) return (who?who+" · ":"")+String(a||""); const h=holderOf(a), p=platOf(a); return !who||h===who?`${h} on ${p}`:`${who}'s money on ${h}'s ${p}`; },
prettyAcct=a=>/ · /.test(a||"")?String(a).replace(" · "," (")+")":String(a||""), holderOf=a=>/spardha/i.test(a)?"Spardha":"Aditya", platOf=a=>String(a||"").split(" · ")[0];
const keyName=s=>String(s).toLowerCase().replace(/[^a-z0-9 ]/g," ").split(/\s+/).filter(w=>w&&!/^(fund|direct|growth|plan|regular|option|the|idcw|ltd|limited)$/.test(w)).slice(0,4).join(" ");
const nkey=s=>String(s||"").toUpperCase().replace(/[^A-Z0-9]+/g," ").trim();
/* which home group an entry belongs to */
function homeOfRow(asset){ return asset==="Mutual Funds"?"Mutual Funds":asset==="Bonds"||asset==="FD"||asset==="Fixed income"?"Bonds":asset==="Other"?"Other":asset==="NPS"?"Others":asset==="Insurance"?"Term":"Stocks"; }
const OUTT=new Set(["Withdraw","Sell","Redeem","Payout","Charges"]);
let DATA=store.get("cache",null), CACHE_AT=store.get("cacheAt",0), OUT=store.get("outbox",[]), SNZ=store.get("snz",{});
let M=null, WHO=store.get("who","all"); if(!["all","Aditya","Spardha"].includes(WHO)) WHO="all";
const saveOut=()=>store.set("outbox",OUT);
const BANK_RE=/\s*\[bank ([^\]]+)\]/, FY_RE=/\s*\[fy (\d{4})\]/, DUE_RE=/\s*\[due (\d{4}-\d{2}-\d{2})\]/, TDS_RE=/\s*\[tds ([\d.]+)\]/, NET_RE=/\s*\[net ([\d.]+)\]/, PR_RE=/\s*\[p ([\d.]+)\]/;
const cleanNote=n=>String(n||"").replace(/\s*\[bal\]\s*/,"").replace(/\s*\[ca [^\]]+\]\s*/,"").replace(/\s*\[since [^\]]+\]\s*/,"").replace(BANK_RE,"").replace(FY_RE,"").replace(DUE_RE,"").replace(TDS_RE,"").replace(NET_RE,"").replace(PR_RE,"").trim();

/* records (insurance, bond schedules, inbox) — server copy + changes waiting to sync */
function recMap(){ const R=new Map(); ((DATA&&DATA.rec)||[]).forEach(r=>R.set(r[0],{id:r[0],kind:r[1],d:r[2]||{}}));
  OUT.filter(o=>o.kind==="rec").forEach(o=>o.ops.forEach(op=>{ if(op.del) R.delete(op.id); else R.set(op.id,{id:op.id,kind:op.kind,d:op.data,pending:1}); })); return R; }
const recs=kind=>[...M.rec.values()].filter(r=>r.kind===kind);

/* ---------- live NAVs (AMFI data via mfapi.in), refreshed once a day ---------- */
let NAV=store.get("nav",{}), NAVMAP=store.get("navmap",{}), NAVBUSY=false;
const MFAPI="https://api.mfapi.in/mf";
const navWords=s=>String(s||"").toLowerCase().replace(/[^a-z0-9& ]/g," ").split(/\s+/).filter(w=>w&&!/^(direct|growth|plan|fund|option|the|regular|idcw|ltd|limited|scheme)$/.test(w));
const isoNav=s=>{ const m=/^(\d{2})-(\d{2})-(\d{4})$/.exec(s||""); return m?`${m[3]}-${m[2]}-${m[1]}`:""; };
async function getJ(u){ const r=await fetch(u,{cache:"no-store"}); if(!r.ok) throw new Error("NAV service "+r.status); return r.json(); }
/* find the Direct · Growth scheme code for a fund name (cached on this phone) */
async function schemeOf(name){ const k=keyName(name); if(NAVMAP[k]) return NAVMAP[k];
  const want=navWords(name); let L=[];
  for(const n of [5,4,3]){ const q=want.slice(0,n).join(" "); if(!q) break; try{ L=await getJ(MFAPI+"/search?q="+encodeURIComponent(q)); }catch(e){ throw e; } if(L&&L.length) break; }
  const ok=(L||[]).filter(x=>/direct/i.test(x.schemeName)&&/growth/i.test(x.schemeName)&&!/idcw|dividend|bonus|payout|reinvest/i.test(x.schemeName));
  let best=null, bs=-1; ok.forEach(x=>{ const w=navWords(x.schemeName), hit=want.filter(t=>w.includes(t)).length, sc=hit-0.1*Math.max(0,w.length-hit); if(sc>bs){ bs=sc; best=x; } });
  if(!best||bs<Math.min(2,want.length)) return null;
  NAVMAP[k]={code:best.schemeCode,sn:best.schemeName}; store.set("navmap",NAVMAP); return NAVMAP[k]; }
/* latest NAV for every fund held; quiet on failure (the last known price stays) */
async function refreshNavs(force){ if(NAVBUSY||!M) return; const day=TODAY(), fresh=!force&&store.get("navDay","")===day;
  const F=[...new Map(M.hold.filter(h=>h.asset==="Mutual Funds").map(h=>[keyName(h.name),h.name])).entries()].filter(([k])=>!fresh||!NAV[k]); if(!F.length) return;
  NAVBUSY=true; let n=0;
  try{ for(let i=0;i<F.length;i+=5) await Promise.all(F.slice(i,i+5).map(async([k,name])=>{ try{ const s=await schemeOf(name); if(!s) return; const j=await getJ(MFAPI+"/"+s.code+"/latest"), e=j&&j.data&&j.data[0];
        if(e&&+e.nav>0){ NAV[k]={nav:+e.nav,d:isoNav(e.date)||day,code:s.code,sn:s.sn}; n++; } }catch(e){} }));
  } finally { NAVBUSY=false; }
  if(n){ store.set("nav",NAV); store.set("navDay",day); refresh(); } }
/* NAV on (or just before) a date — used when an order has no units */
async function navOn(name,iso){ const s=await schemeOf(name); if(!s) throw new Error("fund not found");
  const j=await getJ(MFAPI+"/"+s.code), D=(j&&j.data)||[]; for(const e of D){ const d=isoNav(e.date); if(d&&d<=iso&&+e.nav>0) return {nav:+e.nav,d}; }
  throw new Error("no NAV"); }
/* Groww equity delivery charges (estimate, used only when the net amount isn't typed) */
function estCharges(side,val){ if(!(val>0)) return 0; const brk=Math.max(5,Math.min(20,val*0.001)), stt=val*0.001, exc=val*0.0000297, sebi=val*1e-6, stamp=side==="B"?val*0.00015:0, gst=0.18*(brk+exc+sebi), dp=side==="S"?15.93:0;
  return Math.round((brk+stt+exc+sebi+stamp+gst+dp)*100)/100; }
const r2=x=>Math.round(x*100)/100, r4=x=>Math.round(x*10000)/10000;

/* ---------- holdings, and corporate actions (demerger, merger, name change, split) ----------
   A corporate action is a pair of rows paid via "Switch" with a "[ca <id>]" note tag: a Sell that takes shares and/or cost out of
   the old holding and a Buy that puts them into the new one. Quantity and cost move exactly; price is never touched; no money moves. */
const CA_RE=/\[ca ([^\]]+)\]/, SINCE_RE=/\[since (\d{4}-\d{2}-\d{2})\]/;
const isCA=r=>r.via==="Switch"&&(r.asset==="Stocks"||r.asset==="US Stocks")&&(r.type==="Buy"||r.type==="Sell");
const holdKey=r=>r.acct+"|"+r.who+"|"+r.asset+"|"+(r.asset==="Mutual Funds"?keyName(r.name):nkey(r.name));
function holdMap(rows,until){ const hm=new Map();
  rows.filter(r=>(r.asset==="Stocks"||r.asset==="US Stocks"||r.asset==="Mutual Funds")&&(!until||r.date<=until)).forEach(r=>{
    const k=holdKey(r); let h=hm.get(k);
    if(!h){ h={key:k,who:r.who,acct:r.acct,plat:r.acct,asset:r.asset,a:homeOfRow(r.asset),tab:r.acct+"|"+r.who+"|"+homeOfRow(r.asset),name:r.name,isin:r.code,qty:0,inv:0,px:0,pxd:"",date:r.date,upd:r.date,since:"",ca:0,us:r.asset==="US Stocks"}; hm.set(k,h); }
    if(r.type==="Value"){ if(r.price&&r.date>=h.pxd){ h.px=r.price; h.pxd=r.date; } return; }
    if(isCA(r)){ const sn=(SINCE_RE.exec(r.note||"")||[])[1]; h.ca++;
      if(r.type==="Buy"){ if(h.qty<1e-6&&!h.inv) h.since=""; h.qty+=r.qty; h.inv+=r.amount; if(sn&&(!h.since||sn<h.since)) h.since=sn; }
      else { h.qty=Math.max(0,h.qty-r.qty); h.inv=Math.max(0,h.inv-r.amount); } }
    else if(r.type==="Buy"){ if(h.qty<1e-6) h.since=""; h.qty+=r.qty; h.inv+=r.amount; if(!h.since) h.since=r.date; if(r.qty&&r.date>=h.pxd){ h.px=r.amount/r.qty; h.pxd=r.date; } }
    else if(r.type==="Bonus"){ h.qty+=r.qty; if(!h.since) h.since=r.date; }
    else if(r.type==="Sell"||r.type==="Redeem"){ const q=r.qty||(h.px?r.amount/h.px:0), fr=h.qty>0?Math.min(1,q/h.qty):1; h.inv-=h.inv*fr; h.qty=Math.max(0,h.qty-q); if(r.qty&&r.date>=h.pxd){ h.px=r.amount/r.qty; h.pxd=r.date; } }
    else return;
    h.upd=r.date; if(r.name&&r.name.length>h.name.length&&r.asset!=="Mutual Funds") h.name=r.name; if(r.code) h.isin=r.code; });
  return hm; }

function build(){
  const D=(DATA&&DATA.v===3)?DATA:{led:[],rec:[]}, today=TODAY(), rec=recMap();
  let rows=D.led.map(r=>({id:r[0],date:r[1],who:r[2]||"Aditya",acct:r[3],asset:r[4],type:r[5],name:r[6],code:r[7],qty:+r[8]||0,price:+r[9]||0,amount:+r[10]||0,via:r[11],note:r[12],row:r[13]}));
  const dels=new Set(), edits=new Map();
  OUT.forEach(o=>{ if(o.kind==="add") o.rows.forEach((p,k)=>rows.push({id:"new-"+o.rid+"-"+k,date:p.date,who:p.who,acct:p.acct,asset:p.asset,type:p.type,name:p.name||"",code:p.code||"",qty:+p.qty||0,price:+p.price||0,amount:+p.amt||0,via:p.via||"",note:p.note||"",row:0,pending:1}));
    else if(o.kind==="del") dels.add(o.id); else if(o.kind==="edit") edits.set(o.id,o.row); });
  rows=rows.filter(r=>!dels.has(r.id)).map(r=>{ const e=edits.get(r.id); return e?Object.assign({},r,{date:e.date,who:e.who,acct:e.acct,asset:e.asset,type:e.type,name:e.name||"",code:e.code||"",qty:+e.qty||0,price:+e.price||0,amount:+e.amt||0,via:e.via||"",note:e.note||"",pending:1}):r; });
  rows.sort((a,b)=>a.date<b.date?-1:a.date>b.date?1:0);
  /* entries as the screens see them. amt = money into (+) or out of (−) that investment from the bank; show = what the entry itself moved */
  const tx=[], units=new Map(), U=(acct,who,h)=>{ const k=acct+"|"+who+"|"+h; if(!units.has(k)) units.set(k,{tab:k,acct,who,h,a:h,T:[],inv:0,out:0,net:0,cur:0,cash:0,valued:false,gain:null,x:null,flows:null,asof:"",src:"",V:[]}); return units.get(k); };
  const push=(r,h,amt,extra)=>{ const t=Object.assign({i:tx.length,id:r.id,cat:r.acct+"|"+r.who+"|"+h,date:r.date,who:r.who,acct:r.acct,p:prettyAcct(r.acct),p0:platOf(r.acct),a:h,h,type:r.type,asset:r.asset,name:r.name,code:r.code,qty:r.qty,price:r.price,show:r.amount,amt,via:r.via,
      note:r.note,note2:cleanNote(r.note),row:r.row,pending:r.pending,src:r},extra||{});
    if(isCA(r)){ t.ca=(CA_RE.exec(r.note||"")||[])[1]||"action"; t.type=r.type==="Buy"?"CA in":"CA out"; }
    else if((r.asset==="Stocks"||r.asset==="US Stocks")&&(r.type==="Buy"||r.type==="Sell")&&r.qty) t.trade={side:r.type==="Buy"?"B":"S",qty:r.qty,price:r.price||(r.qty?r.amount/r.qty:0)};
    if(r.asset==="Mutual Funds"&&r.qty) t.units=r.qty;
    t.bank=(BANK_RE.exec(r.note||"")||[])[1]||""; t.fy=(FY_RE.exec(r.note||"")||[])[1]||"";
    t.due=(DUE_RE.exec(r.note||"")||[])[1]||""; t.tds=+((TDS_RE.exec(r.note||"")||[])[1]||0); t.net=+((NET_RE.exec(r.note||"")||[])[1]||0); t.pr=+((PR_RE.exec(r.note||"")||[])[1]||0);
    tx.push(t); const u=U(r.acct,r.who,h); u.T.push(t); return t; };
  const term=[];
  rows.forEach(r=>{ const h=homeOfRow(r.asset), A=r.amount;
    if(r.type==="Value"){ const u=U(r.acct,r.who,h); u.V.push(r); return; }
    if(h==="Term"){ term.push(push(r,"Term",A)); return; }
    let f=0;
    if(r.type==="Add money") f=A; else if(r.type==="Withdraw") f=-A;
    else if(r.type==="Buy"){ if(r.via==="Bank") f=A; else if(r.via==="Balance"&&h!=="Stocks"){ f=A; push(r,"Stocks",-A,{internal:1,show:A,name:r.name,type:"Moved"}); } }
    else if(r.type==="Redeem"||r.type==="Sell"){ if(h!=="Stocks"&&r.via!=="Switch"){ f=-A; if(r.via==="Balance") push(r,"Stocks",A,{internal:1,show:A,type:"Moved in"}); } }
    else if(r.type==="Payout") f=-A;
    else if(r.type==="Premium") f=0;
    push(r,h,f);
    /* cash left in a broker account (Groww balance, INDmoney wallet) */
    if(r.via==="Balance"||r.asset==="Cash"||r.asset==="F&O"){ const u=U(r.acct,r.who,"Stocks"), s={"Add money":1,"Sell":1,"Redeem":1,"Dividend":1,"Other income":1,"F&O result":1,"Withdraw":-1,"Buy":-1,"Charges":-1}[r.type]||0; u.cash+=s*A; }
  });
  /* holdings: quantity from buys, sells and bonuses; price from the latest valuation or trade */
  const hm=holdMap(rows);
  for(const h of hm.values()){ if(h.asset!=="Mutual Funds") continue; const n=NAV[keyName(h.name)]; if(n&&n.d>=h.pxd){ h.px=n.nav; h.pxd=n.d; h.nav=n; } }
  const hold=[...hm.values()].filter(h=>h.qty>1e-6).map(h=>Object.assign(h,{cur:h.qty*h.px,avg:h.qty?h.inv/h.qty:0,date:h.pxd||h.upd,moved:h.upd>h.pxd}));
  ["Stocks","Mutual Funds"].forEach(a=>hold.filter(h=>h.a===a).sort((x,y)=>y.cur-x.cur).forEach((h,k)=>h.col=AVC[k%AVC.length]));
  hold.forEach((h,i)=>{ h.i=i; h.gain=h.cur-h.inv; });
  /* bonds and FDs: buys + payouts in the ledger, schedule in Records */
  const B=new Map(), bk=t=>t.acct+"|"+t.name;
  tx.filter(t=>t.a==="Bonds"&&t.type==="Buy").forEach(t=>{ let b=B.get(bk(t)); if(!b){ b={key:bk(t),cat:t.cat,acct:t.acct,name:t.name||"Bond",who:t.who,plat:t.p0,platL:prettyAcct(t.acct),fd:t.asset==="FD"||t.asset==="Fixed income",rows:[],reps:[],cost:0,date:t.date}; B.set(b.key,b); }
    b.rows.push(t); b.cost+=t.show; if(t.date<b.date) b.date=t.date; });
  tx.filter(t=>t.a==="Bonds"&&t.type==="Payout").forEach(t=>{ const b=B.get(bk(t)); if(b) b.reps.push(t); });
  for(const b of B.values()){
    const R=rec.get("bond:"+b.key); b.info=R?R.d:{};
    let S=(b.info.sched||[]).map(e=>({d:e.d,p:+e.p||0,i:+e.i||0,a:(+e.p||0)+(+e.i||0),tds:+e.tds||0})).sort((x,y)=>x.d<y.d?-1:1);
    const dset=new Set(S.map(e=>e.d)); let untok=0; const tok=new Map(); b.reps.forEach(r=>{ if(r.due&&dset.has(r.due)) tok.set(r.due,r); else untok++; });
    S.forEach(e=>{ if(tok.has(e.d)){ e.done=true; e.row=tok.get(e.d); } else if(untok>0){ untok--; e.done=true; } });
    b.sched=S; b.repaid=SUM(b.reps,r=>r.show); b.tds=SUM(b.reps,r=>r.tds); b.prin=SUM(b.reps,r=>r.pr); b.open=S.filter(e=>!e.done);
    b.closed=S.length?b.open.length===0:b.reps.length>0; b.next=b.open[0]||null; b.exp=SUM(S,e=>e.a||0); b.mat=S.length?S[S.length-1].d:"";
    b.note=b.rows.map(r=>r.note2).filter(Boolean).join(" · "); b.egain=b.exp?b.exp-b.cost:null;
    b.left=b.closed?0:Math.max(0,b.cost-(b.prin||0)); }
  const bonds=[...B.values()];
  /* each unit = account + whose money + group. value = holdings + cash (brokers), principal still out (bonds), or last value + money since (NPS) */
  for(const u of units.values()){
    u.T.forEach(t=>{ if(t.amt>0) u.inv+=t.amt; else u.out-=t.amt; }); u.net=u.inv-u.out;
    if(u.h==="Stocks"||u.h==="Mutual Funds"){ const H=hold.filter(x=>x.tab===u.tab); u.cur=SUM(H,x=>x.cur)+(u.h==="Stocks"?Math.max(0,u.cash):0);
      if(H.length||u.cash){ u.valued=true; u.src="holdings"; u.asof=H.map(x=>x.date).sort().pop()||today; } }
    else if(u.h==="Bonds") u.cur=SUM(bonds.filter(b=>b.cat===u.tab&&!b.closed),b=>b.left);
    else if(u.h==="Other"&&!u.V.length){ /* rate-based items grow on their own; the rest stay at cost until a value is added */
      let cur=0, rated=false; othItemsOf(u,rec,today).forEach(it=>{ cur+=it.cur; if(it.rate) rated=true; });
      u.cur=Math.max(0,cur); if(rated){ u.valued=true; u.asof=today; u.src="accrued"; } }
    else { u.cur=Math.max(0,u.net); const lv=u.V[u.V.length-1]; if(lv){ const since=SUM(u.T.filter(t=>t.date>lv.date),t=>t.amt); u.cur=Math.max(0,lv.amount+since); u.valued=true; u.asof=lv.date; u.src="value"; u.lv=lv; } }
    if(u.valued){ u.gain=u.cur-u.net; u.flows=u.T.filter(t=>t.date&&t.amt).map(t=>[t.date,-t.amt]).concat([[today,u.cur]]); u.x=xirr(u.flows); }
  }
  const ul=[...units.values()].filter(u=>u.h!=="Term"&&(u.T.length||u.V.length));
  const accts=[...new Set(ACCT0().concat(rows.map(r=>r.acct)).filter(a=>a&&a!=="Insurance"))];
  M={units:ul,tx,hold,bonds,today,rec,accts,url:D.url||"",gid:D.gid||0,files:D.files||"",term:term.length?{name:"Term plan",T:term}:null,v3:D===DATA,rows};
}

/* "Other" items inside one unit, each with its own rate from its record */
function othItemsOf(u,rec,today){ const m=new Map(); u.T.forEach(t=>{ const k=t.name||"Other"; if(!m.has(k)) m.set(k,[]); m.get(k).push(t); });
  return [...m.entries()].map(([name,L])=>{ const R=rec.get("oth:"+u.acct+"|"+name), d=R?R.d:{}, end=d.end&&d.end<today?d.end:today, r=(+d.rate||0)/100, n={y:1,q:4,m:12,s:0}[d.comp||"y"];
    let cur=0, put=0, back=0; L.forEach(t=>{ if(t.amt>0) put+=t.amt; else back-=t.amt; if(t.type==="Payout") return;
      const yrs=t.date?Math.max(0,days(t.date,end))/365:0, g=r>0?(n?Math.pow(1+r/n,n*yrs):1+r*yrs):1; cur+=t.amt*g; });
    return {name,acct:u.acct,who:u.who,T:L,put,back,cur:Math.max(0,cur),rate:+d.rate||0,comp:d.comp,end:d.end||"",ret:d.ret||"",first:first(L)}; }); }
const okWho=(w,who)=>!who||who==="all"||w===who;
function agg(h,who){
  const U=M.units.filter(u=>u.h===h&&okWho(u.who,who));
  const r={h,who,U,cur:SUM(U,u=>u.cur),inv:SUM(U,u=>u.inv),out:SUM(U,u=>u.out),net:SUM(U,u=>u.net),gain:null,x:null,asof:"",n:SUM(U,u=>u.T.length)};
  const V=U.filter(u=>u.valued);
  if(V.length){ r.gain=SUM(V,u=>u.gain); r.x=xirr([].concat(...V.map(u=>u.flows))); r.asof=V.map(u=>u.asof).sort().pop(); r.src=V.some(u=>u.src==="holdings")?"holdings":"value"; r.vnet=SUM(V,u=>u.net); }
  r.put=h==="Bonds"?r.cur:Math.max(0,r.net);
  if(h==="Bonds"){ const Bs=bondsFor(who), cl=Bs.filter(b=>b.closed), act=Bs.filter(b=>!b.closed);
    r.gain=cl.length?SUM(cl,b=>b.repaid-b.cost):null; r.recv=SUM(Bs,b=>b.repaid); r.egain=SUM(act,b=>b.egain||0); r.asof="";
    const f=[]; Bs.forEach(b=>{ b.rows.concat(b.reps).forEach(t=>{ if(t.date) f.push([t.date,-t.amt]); }); b.open.forEach(e=>{ if(e.a>0) f.push([e.d>M.today?e.d:M.today,e.a]); }); }); r.x=xirr(f); }
  r.base=r.gain!=null&&h!=="Bonds"?r.vnet:null;
  return r;
}
const bondsFor=who=>M.bonds.filter(b=>okWho(b.who,who));
const holdFor=(a,who)=>M.hold.filter(h=>h.a===a&&okWho(h.who,who));
const txFor=(h,who)=>M.tx.filter(t=>t.h===h&&okWho(t.who,who));
function dueItems(who){ const L=[]; bondsFor(who).filter(b=>!b.closed).forEach(b=>b.open.forEach(e=>{ if(e.d<=M.today&&!((SNZ[b.key+"|"+e.d]||"")>M.today)) L.push({b,e}); }));
  return L.sort((x,y)=>x.e.d<y.e.d?-1:1); }
function soonItems(who,n){ const L=[], lim=addDays(M.today,n); bondsFor(who).filter(b=>!b.closed).forEach(b=>b.open.forEach(e=>{ if(e.d>M.today&&e.d<=lim) L.push({b,e}); })); return L.sort((x,y)=>x.e.d<y.e.d?-1:1); }
function nextPremium(c){
  const paid=c.T.filter(t=>t.date).sort((a,b)=>a.date<b.date?-1:1), lp=paid[paid.length-1]; if(!lp) return null;
  const y=+lp.date.slice(0,4), cand=[`${y-1}-08-01`,`${y}-02-01`,`${y}-08-01`,`${y+1}-02-01`];
  const due=cand.reduce((b,d)=>Math.abs(days(d,lp.date))<Math.abs(days(b,lp.date))?d:b,cand[0]);
  return {date:addMonths(due,6),amt:c.T[c.T.length-1].amt,left:60-c.T.length};
}
const first=T=>T.filter(t=>t.date).reduce((m,t)=>!m||t.date<m?t.date:m,"");
const fyOf=s=>{ const y=+s.slice(0,4),m=+s.slice(5,7); return m>=4?y:y-1; };

/* ---------- overlays + back button ---------- */
function vanish(el){ if(el.hidden) return; el.classList.add("bye"); clearTimeout(el._vt); el._vt=setTimeout(()=>{ if(el.classList.contains("bye")){ el.hidden=true; el.classList.remove("bye"); } },200); }
const ov={stack:[],
  open(el,close){ clearTimeout(el._vt); el.classList.remove("bye"); el.hidden=false; this.stack.push({el,close}); history.pushState({ov:this.stack.length},""); },
  back(){ history.back(); },
  pop(){ const o=this.stack.pop(); if(o) o.close(); }};
addEventListener("popstate",()=>ov.pop());
const isOpen=el=>!el.hidden&&!el.classList.contains("bye");

/* ---------- HOME ---------- */
let VIEW=store.get("view","chart"), OPENC=new Set(), FACE=0, SCOPE="all", RANGE=store.get("range","All"), FLOWG=store.get("flowg","FY");
const calm=()=>document.documentElement.classList.contains("calm");
function homeGroups(who){ return HOME.map(h=>({h,r:agg(h,who||WHO)})).filter(x=>x.r.cur>0||x.r.U.length); }
function totals(who){ const G=homeGroups(who), R=G.map(x=>x.r);
  const put=SUM(R,r=>r.put), cur=SUM(R,r=>r.cur), gs=R.filter(r=>r.gain!=null), gain=SUM(gs,r=>r.gain);
  const f=[]; R.forEach(r=>{ if(r.h==="Bonds"){ bondsFor(who||WHO).forEach(b=>{ b.rows.concat(b.reps).forEach(t=>{ if(t.date) f.push([t.date,-t.amt]); }); b.open.forEach(e=>{ if(e.a>0) f.push([e.d>M.today?e.d:M.today,e.a]); }); }); }
    else r.U.forEach(u=>{ if(u.valued) f.push(...u.flows); }); });
  return {G,put,cur,gain,has:gs.length>0,x:xirr(f),egain:SUM(R,r=>r.egain||0)}; }
const SCOPEL={all:"Overall",Stocks:"Stocks","Mutual Funds":"Mutual Funds",Bonds:"Bonds",Other:"Other"}, SCOPEF={all:"Overall",Stocks:"Stocks","Mutual Funds":"Mutual Funds",Bonds:"Bonds",Other:"Other investments"};
/* whole-number shares that always add up to 100 (largest remainder) */
function pct100(vals){ const tot=vals.reduce((a,v)=>a+Math.max(0,v),0); if(!tot) return vals.map(()=>0); const raw=vals.map(v=>Math.max(0,v)/tot*100), fl=raw.map(Math.floor); let left=100-fl.reduce((a,b)=>a+b,0);
  raw.map((r,i)=>[r-fl[i],i]).sort((a,b)=>b[0]-a[0]).forEach(([,i])=>{ if(left>0&&raw[i]>0){ fl[i]++; left--; } }); return fl; }
function figOf(T,sc){ if(sc==="all") return {put:T.put,cur:T.cur,gain:T.gain,has:T.has,x:T.x};
  const g=T.G.find(x=>x.h===sc); if(!g) return {put:0,cur:0,gain:0,has:false,x:null}; const r=g.r, bond=sc==="Bonds";
  return {put:r.put,cur:r.cur,gain:bond?(r.egain||0):(r.gain||0),has:bond||r.gain!=null,x:r.x,bond}; }
const LAST={};
function tween(el,key,to,fmt){ const from=key in LAST?LAST[key]:to; LAST[key]=to; if(HIDE||calm()||Math.abs(from-to)<1){ el.innerHTML=fmt(to); return; }
  el.classList.remove("flash"); void el.offsetWidth; el.classList.add("flash");
  const t0=performance.now(), d=600; const step=now=>{ const k=Math.min(1,(now-t0)/d), e=1-Math.pow(1-k,3); el.innerHTML=fmt(from+(to-from)*e); if(k<1&&el.isConnected) requestAnimationFrame(step); }; requestAnimationFrame(step); }
function paintHero(){ const T=totals(); if(SCOPE!=="all"&&!T.G.some(x=>x.h===SCOPE)) SCOPE="all";
  const f=figOf(T,SCOPE), nm=SCOPE==="all"?"":SCOPEF[SCOPE]+" · ", whose=WHO==="all"?"Total":WHO+"'s";
  $("f0").innerHTML=`<small>${nm}Invested</small><b class="num" id="fv0"></b><i>${DATA?(WHO==="all"?"Total money put in together":`${whose} money put in`):"Loading…"}</i>`;
  $("f1").innerHTML=`<small>${nm}Value today</small><b class="num" id="fv1"></b><i>${f.has?"What it's worth now":"Shown at cost until you add a value"}</i>`;
  $("f2").innerHTML=`<small>${nm}${f.bond?"Expected profit":"Profit"}</small><b class="num ${cls(f.gain)}" id="fv2"></b><i>${f.x!=null?"Growing about "+pct(f.x).replace("+","")+" a year":f.bond?"Interest still to come":"Add today's value to see it"}</i>`;
  const plain=n=>HIDE?"₹••••":esc(rs(n,false)), signed=n=>HIDE?"₹••••":esc((n>0?"+":"")+rs(n,false));
  [f.put,f.cur,f.gain].forEach((v,i)=>{ const el=$("fv"+i); el.classList.toggle("s",rs(v,false).length>10); tween(el,"fv"+i,v,i===2?signed:plain); });
  showFace(); }
function showFace(){ document.querySelectorAll("#faces .fc").forEach((el,k)=>{ el.className="fc "+(k===FACE?"on":k<FACE?"l":"r"); });
  $("meas").querySelectorAll("button").forEach((b,k)=>b.setAttribute("aria-pressed",String(k===FACE))); }
function setFace(i){ const n=(i+3)%3; if(n===FACE) return; FACE=n; showFace(); drawTiles(); }
function setScope(s){ if(s===SCOPE&&s!=="all"){ openScr(s); return; } SCOPE=s; paintHero(); drawTiles(); ringFocus(); }
function ringPop(c){ SCOPE=c||"all"; paintHero(); drawTiles(); }
function ringFocus(){ if(S3.ringFocus) S3.ringFocus(SCOPE==="all"?null:SCOPE); document.querySelectorAll("#stage svg.flat [data-c]").forEach(n=>n.style.opacity=SCOPE==="all"||n.dataset.c===SCOPE?1:.22); }
function drawTiles(){ const T=totals(), keys=["all"].concat(T.G.map(g=>g.h)), cols=`repeat(${keys.length},minmax(0,1fr))`, base=FACE===0?T.put:T.cur;
  const colOf=k=>k==="all"?"#C9D3E0":CLS[k].col; /* Overall: neutral silver, so no slice shares its colour */
  $("scope").style.gridTemplateColumns=cols; $("legend").style.gridTemplateColumns=cols;
  $("scope").innerHTML=keys.map(k=>`<button data-s="${k}" aria-pressed="${SCOPE===k}" style="--c:${colOf(k)}" aria-label="${SCOPEL[k]}"></button>`).join("");
  const P=pct100(keys.slice(1).map(k=>{ const f=figOf(T,k); return FACE===0?f.put:f.cur; }));
  $("legend").innerHTML=keys.map((k,ki)=>{ const f=figOf(T,k), v=FACE===0?f.put:FACE===1?f.cur:f.gain, share=k==="all"?(FACE===2?"":"100%"):FACE===2?(f.bond?"expected":""):base?P[ki-1]+"%":"";
    return `<button class="lg" data-s="${k}" aria-pressed="${SCOPE===k}" style="--c:${colOf(k)}"><small>${SCOPEL[k]}</small><b class="num ${FACE===2?cls(v):""}">${FACE===2?smoney(v,true):money(v,true)}</b><i>${share||"&nbsp;"}</i></button>`; }).join("");
  document.querySelectorAll("#legend [data-s],#scope [data-s]").forEach(b=>b.onclick=()=>setScope(b.dataset.s)); ringLabels(T); }
function flatRing(G){ const tot=SUM(G,x=>x.r.cur)||1, R=72, C=2*Math.PI*R; let off=0;
  return `<svg class="flat" viewBox="0 0 220 170" aria-hidden="true"><circle cx="110" cy="85" r="${R}" fill="none" stroke="rgba(255,255,255,.06)" stroke-width="22"/>${G.map(({h,r})=>{ const L=r.cur/tot*C; const s=`<circle cx="110" cy="85" r="${R}" fill="none" stroke="${CLS[h].col}" stroke-width="22" stroke-dasharray="${Math.max(0,L-2)} ${C}" stroke-dashoffset="${-off}" transform="rotate(-90 110 85)" data-c="${h}" style="cursor:pointer;transition:opacity .3s"/>`; off+=L; return s; }).join("")}</svg>`; }
function ringSegs(T){ const G=T.G.filter(x=>x.r.cur>0), base=G.map(({h})=>{ const f=figOf(T,h); return FACE===0?f.put:f.cur; }), P=pct100(base);
  return G.map(({h},i)=>{ const f=figOf(T,h), v=FACE===0?f.put:FACE===1?f.cur:f.gain;
    return {c:h,v:base[i],col:CLS[h].col,name:esc(SCOPEL[h]),val:FACE===2?smoney(v,true):money(v,true),share:FACE===2?(f.x!=null?pct(f.x)+" a yr":""):P[i]+"%"}; }); }
/* the hero figure follows a sideways drag (on the number or the ring); null puts it back */
function dragFace(dx){ const fc=$("faces"); fc.querySelectorAll(".fc").forEach(el=>{ el.style.transition=""; el.style.transform=""; el.style.opacity=""; });
  if(dx==null) return; const on=fc.querySelector(".fc.on"); if(on){ on.style.transition="none"; on.style.transform=`translateX(${dx*.6}px)`; on.style.opacity=String(Math.max(.25,1-Math.abs(dx)/260)); } }
const RINGCB={onPop:c=>ringPop(c),onOpen:c=>openScr(c),onSwipe:d=>setFace(FACE+d),onSwipeMove:dx=>dragFace(dx)};
function ringLabels(T){ const st=$("stage"); if(S3.ok&&!calm()&&st.querySelector("canvas.ring3d")) S3.ring(st,ringSegs(T||totals()),RINGCB); }
function drawRing(){ const T=totals(), st=$("stage"), G=T.G.filter(x=>x.r.cur>0);
  const use3d=S3.ok&&!calm(); st.classList.toggle("flatmode",!use3d);
  const fl=st.querySelector("svg.flat"); if(fl) fl.remove();
  if(use3d) S3.ring(st,ringSegs(T),RINGCB);
  else { st.insertAdjacentHTML("beforeend",flatRing(G)); st.querySelectorAll("svg.flat [data-c]").forEach(n=>n.onclick=()=>openScr(n.dataset.c)); }
  paintHero(); drawTiles(); ringFocus(); }
function catLines(h,who,max){
  if(h==="Stocks"||h==="Mutual Funds"){ const H=holdFor(h,who).slice().sort((a,b)=>b.cur-a.cur); if(H.length) return {n:H.length,html:H.slice(0,max).map(holdRow).join("")};
    const F=fundsFromOrders(who,h); return {n:F.length,html:F.slice(0,max).map(fundOrderRow).join("")}; }
  const L2=bondsFor(who).filter(b=>!b.closed); return {n:L2.length,html:L2.slice(0,max).map(bondRow).join("")}; }
function drawList(){
  const el=$("ledger"), G=homeGroups(), tot=SUM(G,x=>x.r.cur);
  if(!G.length){ el.innerHTML=`<div class="empty">${DATA?"Nothing here yet.":"Loading your investments…"}</div>`; return; }
  const W=WHOS.map(w=>({w,v:SUM(HOME,h=>agg(h,w).cur)})), wt=SUM(W,x=>x.v)||1, WP=pct100(W.map(x=>x.v)), GP=pct100(G.map(x=>x.r.cur));
  let h=`<div class="grp">`+(WHO==="all"?`<div class="splits"><div class="split"><div class="lab">${W.map(x=>`<span>${x.w} <b class="num">${money(x.v,true)}</b> · ${WP[WHOS.indexOf(x.w)]}%</span>`).join("")}</div>
    <div class="bar">${W.map(x=>`<i style="width:${x.v/wt*100}%;background:${WHOC[x.w]}"></i>`).join("")}</div></div></div>`:"");
  G.forEach(({h:k,r},gi)=>{ const c=CLS[k], open=OPENC.has(k), L2=catLines(k,WHO,5), gp=r.gain!=null&&r.base>0?r.gain/r.base:null;
    h+=`<div class="cat" data-c="${k}" aria-expanded="${open}"><button aria-expanded="${open}"><svg class="chev" viewBox="0 0 14 14"><path d="M3 5l4 4 4-4"/></svg><span class="cic">${svgI(c.icon,c.col)}</span>
      <span class="cname"><span>${c.label}<span class="sub">${money(r.put,true)} put in · ${tot?GP[gi]:0}% of value</span></span>${L2.n?`<span class="badge num">${L2.n}</span>`:""}</span>
      <span class="amt num">${money(r.cur,true)}${r.gain!=null?`<small class="${cls(r.gain)}">${smoney(r.gain,true)}${gp!=null?" · "+pct(gp):""}</small>`:""}</span></button>
      ${open?`<div style="padding-left:14px">${L2.html}<button class="more" data-open="${k}">Open ${c.label} ›</button></div>`:""}</div>`; });
  el.innerHTML=h+`</div>`;
  el.querySelectorAll(".cat>button").forEach(b=>b.onclick=()=>{ const k=b.parentElement.dataset.c; OPENC.has(k)?OPENC.delete(k):OPENC.add(k); drawList(); });
  el.querySelectorAll("[data-open]").forEach(b=>b.onclick=()=>openScr(b.dataset.open));
  bindRows(el);
}
function renderHome(){
  document.body.classList.toggle("mask",HIDE);
  $("whos").querySelectorAll("button").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.w===WHO)));
  const list=VIEW==="list"; $("homeRing").hidden=list; $("ledger").hidden=!list;
  $("viewList").setAttribute("aria-pressed",String(list)); $("viewRing").setAttribute("aria-pressed",String(!list));
  fitHome(); if(list) drawList(); else drawRing(); paintBell();
}
/* the 3D home is one screen: no page scroll, the ring takes whatever height is left */
function fitHome(){ const on=!$("viewInv").hidden&&VIEW!=="list", v=$("viewInv"); document.documentElement.classList.toggle("homefit",on);
  if(!on){ v.style.height=""; return; } scrollTo(0,0);
  /* measured, not guessed: the home ends just above the + button / tab bar, whatever the phone's bars and safe areas are */
  requestAnimationFrame(()=>{ const top=v.getBoundingClientRect().top, lim=Math.min($("addBtn").getBoundingClientRect().top,document.querySelector(".tabbar").getBoundingClientRect().top)-8;
    v.style.height=Math.max(320,Math.floor(lim-top))+"px"; }); }
addEventListener("resize",()=>{ if(document.documentElement.classList.contains("homefit")) fitHome(); });
if(window.visualViewport) visualViewport.addEventListener("resize",()=>{ if(document.documentElement.classList.contains("homefit")) fitHome(); });
$("segv").onclick=e=>{ const b=e.target.closest("button"); if(!b) return; VIEW=b.id==="viewList"?"list":"chart"; store.set("view",VIEW); renderHome(); };
(()=>{ const h=$("hero"), fc=$("faces"); let x0=null,y0=null,sw=0;
  /* the figure follows the finger, then snaps to the next one */
  h.addEventListener("pointerdown",e=>{ if(e.target.closest("#meas")) return; x0=e.clientX; y0=e.clientY; });
  /* sideways = within 30° of horizontal */
  const side=(dx,dy)=>Math.abs(dy)<=Math.abs(dx)*.577;
  h.addEventListener("pointermove",e=>{ if(x0==null) return; const dx=e.clientX-x0, dy=e.clientY-y0; if(Math.abs(dx)>8&&side(dx,dy)) dragFace(dx); else dragFace(null); });
  const end=e=>{ if(x0==null) return; const dx=e.clientX-x0, dy=e.clientY-y0; x0=null; dragFace(null);
    if(Math.abs(dx)>40&&side(dx,dy)){ sw=Date.now(); setFace(FACE+(dx<0?1:-1)); } };
  h.addEventListener("pointerup",end); h.addEventListener("pointercancel",()=>{ x0=null; dragFace(null); });
  $("faces").onclick=()=>{ if(Date.now()-sw<500) return; setFace(FACE+1); };
  $("meas").querySelectorAll("button").forEach((b,k)=>b.onclick=()=>setFace(k)); })();
$("whos").querySelectorAll("button").forEach(b=>b.onclick=()=>setWho(b.dataset.w));
function setWho(w){ if(w===WHO) return; WHO=w; store.set("who",w); refresh(); }

/* ---------- rows used everywhere ---------- */
function holdRow(h,k){ const gp=h.inv>0?h.gain/h.inv:null, isMF=h.a==="Mutual Funds";
  const meta=[h.qty?(isMF?qtyf(h.qty)+" units":qtyf(h.qty)+" shares"):"", h.avg&&!isMF?"avg "+rs(h.avg,false):"", WHO==="all"?h.who:"", h.moved?"updated "+fmtDs(h.upd):""].filter(Boolean).join(" · ")||esc(h.plat);
  return `<button class="hl" data-hold="${h.i}" style="--k:${k||0}"><span class="av" style="background:${h.col||avColor(h.name)}">${esc(initials(h.name))}</span><div style="min-width:0"><div class="n">${esc(h.name)}</div><div class="m">${esc(meta)}</div></div>
    <div class="r"><b class="num">${money(h.cur,true)}</b><small class="${cls(h.gain)}">${h.inv?smoney(h.gain,true)+(gp!=null?" · "+pct(gp):""):""}</small></div></button>`; }
function fundsFromOrders(who,h){ const m=new Map(); txFor(h||"Mutual Funds",who).forEach(t=>{ const nm=t.name||"Mutual fund", id=t.who+"|"+nm; const f=m.get(id)||{id,name:nm,who:t.who,T:[],net:0,n:0}; f.T.push(t); f.net+=t.amt; if(t.amt>0) f.n++; m.set(id,f); });
  return [...m.values()].filter(f=>f.net>1&&f.name!=="Mutual fund").sort((a,b)=>b.net-a.net); }
const fundOrderRow=(f,k)=>`<button class="hl" data-fund="${esc(f.id)}" style="--k:${k||0}"><span class="av" style="background:${avColor(f.name)}">${esc(initials(f.name))}</span><div style="min-width:0"><div class="n">${esc(f.name)}</div><div class="m">${f.n} order${f.n===1?"":"s"}${WHO==="all"?" · "+esc(f.who):""}</div></div><div class="r"><b class="num">${money(f.net,true)}</b><small>invested</small></div></button>`;
function bondRow(b){ const pr=b.exp>0?Math.min(1,b.repaid/b.exp):(b.closed?1:0), due=b.next&&b.next.d<=M.today;
  return `<button class="brow" data-bond="${esc(b.key)}"><div class="a"><span class="n">${esc(b.name)}</span><span class="v num">${money(b.cost,true)}</span></div>
    <div class="m"><span>${esc(whoVia(b.who,b.acct))}</span><span>${b.closed?`<span class="tag ok">Repaid</span>`:due?`<span class="tag due">Due ${fmtDs(b.next.d)}</span>`:b.next?"Next "+fmtDs(b.next.d)+(b.next.a?" · "+money(b.next.a,true):""):"No date"}</span></div>
    <div class="prog"><i style="width:${(pr*100).toFixed(1)}%;background:${b.closed?"var(--ok)":CLS.Bonds.col};box-shadow:0 0 10px ${b.closed?"var(--ok)":CLS.Bonds.col}"></i></div></button>`; }
const TXT={"Add money":"Money added","Withdraw":"Money taken out","Buy":"Bought","Sell":"Sold","Bonus":"Bonus / split shares","Redeem":"Redeemed","Payout":"Money back","Dividend":"Dividend","Other income":"Other income","Charges":"Charges","F&O result":"F&O result","Premium":"Premium paid","Moved":"Paid from balance","Moved in":"Back to balance"};
function txTitle(t){ if(t.type==="Premium") return "Term premium";
  if(t.ca){ const k=caKind(t.ca); return (t.type==="CA in"?k+" · in ":k+" · out of ")+(t.name||""); } if(t.type==="Add money"||t.type==="Withdraw") return t.a==="Others"?(t.type==="Add money"?"NPS contribution":"NPS withdrawal"):TXT[t.type]+" · "+t.p0;
  if(t.type==="Moved") return "Paid for "+(t.name||"a fund"); if(t.type==="Moved in") return "Back to balance · "+(t.name||"");
  if(t.type==="F&O result") return t.show<0?"F&O loss":"F&O profit"; if(t.type==="Charges") return t.note2||"Charges";
  return (TXT[t.type]||t.type)+(t.name?" "+t.name:""); }
const txNeg=t=>OUTT.has(t.type)||t.type==="Moved"||(t.type==="F&O result"&&t.show<0);
const BACKT=new Set(["Withdraw","Sell","Redeem","Payout"]);
function txRow(t,k,no){ const neg=txNeg(t), v=Math.abs(t.show), back=BACKT.has(t.type);
  return `<button class="tx" data-tx="${t.i}" style="--k:${Math.min(k||0,12)}"><span class="n">${no?`<i class="sn num">${no}</i>`:""}${esc(txTitle(t))}</span><span class="amt num ${t.ca?"":back?"gain":neg?"loss":""}">${t.ca?(t.qty?(t.type==="CA in"?"+":"−")+qtyf(t.qty)+" sh · ":"")+"cost "+money(v,true):t.type==="Bonus"?"+"+qtyf(t.qty):(back?"↩ ":neg?"−":"")+money(v)}</span>
    <span class="m"><span>${[fmtDs(t.date),t.acct?whoVia(t.who,t.acct):t.who,t.trade?qtyf(t.trade.qty)+" @ "+rsx(t.trade.price):""].filter(Boolean).map(esc).join(" · ")}</span>${t.pending?`<span class="chip sync">Syncing…</span>`:""}</span></button>`; }
function bindRows(el){
  el.querySelectorAll("[data-hold]").forEach(b=>b.onclick=()=>holdSheet(M.hold[+b.dataset.hold]));
  el.querySelectorAll("[data-fund]").forEach(b=>b.onclick=()=>fundSheet(b.dataset.fund));
  el.querySelectorAll("[data-bond]").forEach(b=>b.onclick=()=>bondSheet(b.dataset.bond));
  el.querySelectorAll("[data-tx]").forEach(b=>b.onclick=()=>txSheet(M.tx[+b.dataset.tx]));
  el.querySelectorAll("[data-pr]").forEach(b=>b.onclick=()=>{ const [k,d]=splitPr(b.dataset.pr), bd=M.bonds.find(y=>y.key===k), e=bd&&bd.open.find(y=>y.d===d); if(bd&&e) openPrompt(bd,e); });
  el.querySelectorAll("[data-pol]").forEach(b=>b.onclick=()=>openPolicy(b.dataset.pol));
  el.querySelectorAll("[data-ib]").forEach(b=>b.onclick=()=>openInboxItem(b.dataset.ib));
}

/* ---------- category screens (header scrolls with the page) ---------- */
let SC=null; const ACT=new Set();
const TABS3={Stocks:["Holdings","Balance","Growth","Charges","History"],"Mutual Funds":["Holdings","Growth","History"],Bonds:["Bonds","Payouts","TDS","History"],NPS:["Growth","History"],Other:["Items","Growth","History"]};
const scrHead=(t,sub)=>`<div class="hd"><button class="ib" data-back aria-label="Back"><svg viewBox="0 0 24 24"><path d="M19 12H5M11 6l-6 6 6 6"/></svg></button><h2>${esc(t)}</h2>${sub||""}</div>`;
function openScr(h,opts){ SC=Object.assign({h,tab:(TABS3[h]||[])[0]||"",sort:"value"},opts||{}); ACT.clear(); S3.theme(h==="pol"?"ins":h); renderScr();
  if(!isOpen($("scr"))) ov.open($("scr"),()=>{ vanish($("scr")); SC=null; S3.theme(TAB_NOW==="ins"?"ins":"home"); upCheck(); }); else { const b=$("scrBody"); b.classList.remove("swap"); void b.offsetWidth; b.classList.add("swap"); }
  $("scrBody").scrollTop=0; upCheck(); }
function sumCard(h,r){ const col=CLS[h].col;
  if(h==="Bonds") return `<div class="sumc tilt" style="--c:${col}"><div class="l">Money in active bonds</div><div class="v num">${money(r.cur,false)}</div><div class="s">Expected gain ${smoney(r.egain||0,true)} · XIRR ${pct(r.x)} incl. repayments to come</div>
    <div class="kv3"><div><small>Invested</small><b class="num">${money(r.inv,true)}</b></div><div><small>Got back</small><b class="num">${money(r.recv||0,true)}</b></div><div><small>Gain so far</small><b class="num ${cls(r.gain)}">${r.gain==null?"—":smoney(r.gain,true)}</b></div></div></div>`;
  const gp=r.gain!=null&&r.base>0?r.gain/r.base:null;
  const lab=r.asof?`Value today · last update ${fmtDs(r.asof)}${r.src==="holdings"?" (Groww)":""}`:"No value yet · shown at cost";
  return `<div class="sumc tilt" style="--c:${col}"><div class="l">${esc(lab)}</div><div class="v num">${money(r.cur,false)}</div><div class="s">Invested ${money(r.net,true)}${r.asof&&r.asof<M.today?" · carried forward with money added since":""}</div>
    <div class="kv3"><div><small>Gain</small><b class="num ${cls(r.gain)}">${r.gain==null?"—":smoney(r.gain,true)}</b></div><div><small>Return</small><b class="num ${cls(gp)}">${pct(gp)}</b></div><div><small>XIRR · yearly</small><b class="num ${cls(r.x)}">${pct(r.x)}</b></div></div></div>`;
}
function renderScr(){
  if(!SC) return; const h=SC.h, B=$("scrBody"), dk=$("scrDock");
  if(h==="pol"){ renderPolicy(); return; }
  const c=CLS[h]; let x=scrHead(c.label);
  x+=`<div class="whos" id="sWho">${[["all","Together"],["Aditya","Aditya"],["Spardha","Spardha"]].map(([k,l])=>`<button data-w="${k}" aria-pressed="${WHO===k}">${l}</button>`).join("")}</div>`;
  const T3=TABS3[h]||[], key=h==="NPS"?"Others":h, r=agg(key,WHO); x+=sumCard(h,r);
  if(T3.length>1) x+=`<div class="tabs3" id="sTabs">${T3.map(t=>`<button data-t="${t}" aria-pressed="${SC.tab===t}">${t}</button>`).join("")}</div>`;
  const T=[].concat(...r.U.map(u=>u.T));
  if(SC.tab==="Holdings") x+=holdBody(h);
  else if(SC.tab==="Growth") x+=`<div id="gChart"></div><div id="fChart"></div>`;
  else if(SC.tab==="History") x+=actBody(T,h);
  else if(SC.tab==="Bonds") x+=bondsBody();
  else if(SC.tab==="Payouts") x+=`<div id="pChart"></div>`+payoutList();
  else if(SC.tab==="Items") x+=itemsBody();
  else if(SC.tab==="Charges") x+=chargesBody();
  else if(SC.tab==="Balance") x+=balanceBody();
  else if(SC.tab==="TDS") x+=tdsBody();
  dk.innerHTML=h==="Bonds"?`<div class="in"><button class="btn2" data-act="bell">Repayments</button><button class="btn1" data-act="add">Add bond</button></div>`
    :h==="NPS"?`<div class="in"><button class="btn2" data-act="npsval">Update value</button><button class="btn1" data-act="add">Add contribution</button></div>`
    :h==="Other"?`<div class="in"><button class="btn2" data-act="vals">Update value</button><button class="btn1" data-act="add">Add</button></div>`
    :`<div class="in"><button class="btn2" data-act="vals">Update value</button><button class="btn1" data-act="add">${h==="Stocks"?"Buy or sell":"Add"}</button></div>`;
  B.style.setProperty("--c",c.col); B.innerHTML=x; bindScr(B);
  if(SC.tab==="Growth"){ growthChart($("gChart"),r.U,c.col); flowChart($("fChart"),T); }
  if(SC.tab==="Payouts") payoutChart($("pChart"));
}
function bindScr(B){ const dk=$("scrDock");
  B.querySelectorAll("[data-back]").forEach(b=>b.onclick=()=>ov.back());
  B.querySelectorAll("#sWho [data-w]").forEach(b=>b.onclick=()=>setWho(b.dataset.w));
  B.querySelectorAll("#sTabs [data-t]").forEach(b=>b.onclick=()=>{ SC.tab=b.dataset.t; const top=$("scrBody").scrollTop; renderScr(); $("scrBody").scrollTop=Math.min(top,$("sTabs")?$("sTabs").offsetTop-6:0); });
  B.querySelectorAll("[data-sort]").forEach(b=>b.onclick=()=>{ SC.sort=b.dataset.sort; renderScr(); });
  const keepTop=fn=>{ const t=$("scrBody").scrollTop; fn(); renderScr(); $("scrBody").scrollTop=t; };
  B.querySelectorAll("[data-bseg]").forEach(b=>b.onclick=()=>keepTop(()=>SC.bseg=b.dataset.bseg));
  B.querySelectorAll("[data-pmode]").forEach(b=>b.onclick=()=>keepTop(()=>SC.pmode=b.dataset.pmode));
  B.querySelectorAll("[data-pcol]").forEach(b=>b.onclick=()=>keepTop(()=>{ const k=b.dataset.pcol; SC.pcol.has(k)?SC.pcol.delete(k):SC.pcol.add(k); }));
  B.querySelectorAll("[data-yr]").forEach(b=>b.onclick=()=>{ const y=b.dataset.yr; ACT.has(y)?ACT.delete(y):ACT.add(y); renderScr(); });
  B.querySelectorAll("[data-act]").forEach(b=>b.onclick=()=>doAct(b.dataset.act,b));
  B.querySelectorAll("[data-tds]").forEach(b=>b.onclick=()=>{ const [fy,p2]=b.dataset.tds.split("|"); tdsUpload(+fy,p2); });
  dk.querySelectorAll("[data-act]").forEach(b=>b.onclick=()=>doAct(b.dataset.act,b));
  bindRows(B); tiltAll(B); }
function doAct(a,el){
  const h=SC&&SC.h, inv=WHO==="all"?null:WHO;
  if(a==="add") openAdd("in",h==="NPS"?{type:"nps",inv:"Aditya"}:{a:h,inv});
  else if(a==="npsval") openValues("NPS");
  else if(a==="vals") openValues(h);
  else if(a==="bell") openBell();
  else if(a==="chg-up") chargesUpload();
  else if(a==="bal-fix") fixBalance(el.dataset.u);
  else if(a==="bal-all"){ SC.balAll=1; renderScr(); }
  else if(a==="pol-renew") policyUpload(SC.id,"renew");
  else if(a==="pol-doc") policyUpload(SC.id,"doc");
  else if(a==="pol-read") policyRead(SC.id,el&&el.dataset.term);
  else if(a==="pol-edit") editPolicy(SC.id,el&&el.dataset.term);
  else if(a==="term-prem") openAdd("in",{type:"term",inv:"Aditya"});
}
/* 3D tilt on the summary cards */
function tiltAll(root){ root.querySelectorAll(".tilt").forEach(el=>{ if(el._t) return; el._t=1;
  el.addEventListener("pointermove",e=>{ const b=el.getBoundingClientRect(), x=(e.clientX-b.left)/b.width-.5, y=(e.clientY-b.top)/b.height-.5; el.style.transform=`perspective(800px) rotateY(${x*10}deg) rotateX(${-y*10}deg)`; });
  el.addEventListener("pointerleave",()=>{ el.style.transform=""; }); }); }
/* holdings tab: what is held today (Groww snapshot + what you recorded since) */
function holdBody(h){
  let H=holdFor(h,WHO);
  if(!H.length){ const F=h==="Mutual Funds"?fundsFromOrders(WHO):[];
    return `<div class="emptyc">${svgI("spark","var(--neon)")}<b>Holdings are being set up</b><p>Your Groww holdings are loaded once from your accounts. After that, every buy, sell and fund order you add here keeps this list up to date.</p></div>`
      +(F.length?`<div class="gh"><span>Funds you have bought</span><b class="num">${F.length}</b></div><div class="grp">${F.map(fundOrderRow).join("")}</div>`:""); }
  const tot=SUM(H,x=>x.cur)||1, by=SC.sort;
  H=H.slice().sort(by==="gain"?(a,b)=>(b.inv?b.gain/b.inv:0)-(a.inv?a.gain/a.inv:0):by==="name"?(a,b)=>a.name.localeCompare(b.name):(a,b)=>b.cur-a.cur);
  const top=H.slice().sort((a,b)=>b.cur-a.cur), seg=top.slice(0,6), rest=SUM(top.slice(6),x=>x.cur);
  const snapD=[...new Set(H.filter(x=>!x.derived).map(x=>x.date))].sort().pop();
  return `<div class="gh"><span>${H.length} ${h==="Stocks"?"stocks":"funds"} held</span><b class="num">${money(tot,true)}</b></div>
    <div class="alloc">${seg.map(x=>`<i style="width:${x.cur/tot*100}%;background:${x.col||avColor(x.name)}"></i>`).join("")}${rest>0?`<i style="width:${rest/tot*100}%;background:var(--dim)"></i>`:""}</div>
    <div class="akey">${seg.map(x=>`<span><i style="background:${x.col||avColor(x.name)}"></i>${esc(x.name.split(" ").slice(0,2).join(" "))} ${Math.round(x.cur/tot*100)}%</span>`).join("")}${rest>0?`<span><i style="background:var(--dim)"></i>Others ${Math.round(rest/tot*100)}%</span>`:""}</div>
    <div class="sortc">${[["value","Biggest"],["gain","Best return"],["name","A–Z"]].map(([k,l])=>`<button data-sort="${k}" aria-pressed="${by===k}">${l}</button>`).join("")}</div>
    <div class="grp">${H.map(holdRow).join("")}</div><p class="hint">Prices as of the Groww snapshot${snapD?" ("+fmtDs(snapD)+")":""} or your latest trade. New trades update this list.</p>`;
}
/* History = the trades themselves. On Stocks, charges live in the Charges tab and money added/taken out lives in the Balance tab. */
const HIST_SKIP={Stocks:new Set(["Charges","Add money","Withdraw","Moved","Moved in"])};
const HIST_LBL={Stocks:["Bought","Sold"],"Mutual Funds":["Invested","Redeemed"],Bonds:["Invested","Got back"]};
function yearList(L,pre,lbl){
  if(!L.length) return `<div class="empty">No entries yet.</div>`;
  const ys=[...new Set(L.map(t=>t.date?t.date.slice(0,4):"No date"))];
  if(!SC["init"+pre]){ SC["init"+pre]=1; ys.slice(0,1).forEach(y=>ACT.add(pre+y)); }
  const done=L.filter(t=>!t.pending); let no=done.length; const NO=new Map(done.map(t=>[t,no--]));
  return ys.map(y=>{ const R=L.filter(t=>(t.date?t.date.slice(0,4):"No date")===y), open=ACT.has(pre+y), ab=t=>Math.abs(t.show||0);
    /* what went in (bought / invested) and what came back (sold / redeemed / repaid), as shown on the rows */
    const inn=SUM(R.filter(t=>!BACKT.has(t.type)&&!txNeg(t)&&t.type!=="Bonus"&&!t.ca),ab), out=SUM(R.filter(t=>BACKT.has(t.type)),ab);
    const sum=lbl?[inn?`${lbl[0]} ${money(inn,true)}`:"",out?`<span class="gain">${lbl[1]} ${money(out,true)}</span>`:""].filter(Boolean).join(" · "):money(SUM(R,ab),true);
    return `<button class="gh" data-yr="${pre+y}" aria-expanded="${open}" style="width:100%"><span>${open?"▾":"▸"} ${y} · ${R.length}</span><b class="num">${sum}</b></button>${open?`<div class="grp">${R.map((t,k)=>txRow(t,k,NO.get(t))).join("")}</div>`:""}`; }).join("")
    +`<p class="hint">Tap an entry to see, edit or delete it</p>`; }
const byNewest=T=>T.slice().sort((a,b)=>(b.date||"")<(a.date||"")?-1:(b.date||"")>(a.date||"")?1:b.i-a.i);
function actBody(T,h){ const sk=HIST_SKIP[h]; return yearList(byNewest(sk?T.filter(t=>!sk.has(t.type)):T),"h",HIST_LBL[h]||["Invested","Taken out"]); }
function bondsBody(){
  const Bs=bondsFor(WHO), act=Bs.filter(b=>!b.closed).sort((x,y)=>(x.next?x.next.d:"9")<(y.next?y.next.d:"9")?-1:1), done=Bs.filter(b=>b.closed).sort((x,y)=>(y.mat||"")<(x.mat||"")?-1:1), due=dueItems(WHO);
  const seg=SC.bseg==="repaid"&&done.length?"repaid":"active", L=seg==="active"?act:done;
  return (due.length?`<button class="banner" data-act="bell">${svgI("bell","var(--accent)")}<span><b>${due.length} repayment${due.length>1?"s":""} to confirm</b><small>${due.map(x=>esc(x.b.name)).join(", ")}</small></span><span class="go2">Check ›</span></button>`:"")
    +`<div class="pick2" role="group"><button data-bseg="active" aria-pressed="${seg==="active"}"><small>Active</small><b>${act.length}</b><i class="num">${money(SUM(act,b=>b.cost),true)} in</i></button>
      <button data-bseg="repaid" aria-pressed="${seg==="repaid"}"${done.length?"":" disabled"}><small>Repaid</small><b>${done.length}</b><i class="num">${money(SUM(done,b=>b.repaid),true)} back</i></button></div>`
    +`<div class="grp nlist">${L.map((b,k)=>bondRow(b).replace('<button class="brow"',`<button class="brow" style="--n:'${k+1}'"`)).join("")||`<div class="empty">${seg==="active"?"No active bonds.":"None repaid yet."}</div>`}</div>`;
}
const fmtDy=s=>{ const d=dOf(s); return `${d.getDate()} ${MON[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`; };
function payRow({b,e},n,showName){ const due=e.d<=M.today;
  return `<button class="prow" ${due?`data-pr="${esc(b.key)}|${esc(e.d)}"`:`data-bond="${esc(b.key)}"`}><span class="no num">${n}</span>
    <div style="min-width:0"><div class="n">${esc(showName?b.name:(e.i&&e.a&&e.a-e.i>1?"Principal + interest":"Interest"))}</div><div class="m">${e.i?"interest "+money(e.i,true)+(e.est?" (est.)":""):""}${e.a&&e.i&&e.a-e.i>1?" · principal "+money(e.a-e.i,true):""}${showName?"":""}${due?" · tap to confirm":""}</div></div>
    <div class="r"><b class="num">${e.a?money(e.a,false):"—"}</b><span class="dchip ${due?"due":""}">${fmtDy(e.d)}</span></div></button>`; }
function payoutList(){ const Bs=bondsFor(WHO).filter(b=>b.open.length), L=[]; Bs.forEach(b=>b.open.forEach(e=>L.push({b,e}))); L.sort((x,y)=>x.e.d<y.e.d?-1:x.e.d>y.e.d?1:0);
  const mode=SC.pmode==="bond"?"bond":"date", col=SC.pcol||(SC.pcol=new Set()), tog=(k,open)=>`<span class="fold" aria-hidden="true">${open?"▴":"▾"}</span>`;
  let h=`<div class="gh"><span>Coming back to you · ${L.length}</span><b class="num">${money(SUM(L,x=>x.e.a),true)}</b></div>
    <div class="pick2 sm" role="group"><button data-pmode="date" aria-pressed="${mode==="date"}">By date</button><button data-pmode="bond" aria-pressed="${mode==="bond"}">By bond</button></div>`;
  if(!L.length) return h+`<div class="empty">Nothing to come.</div>`;
  if(mode==="date"){ let n=0; const ys=[...new Set(L.map(x=>x.e.d.slice(0,4)))];
    ys.forEach((y,yi)=>{ const Y=L.filter(x=>x.e.d.slice(0,4)===y), yk="y"+y, yOpen=SC.pcolInit?!col.has(yk):(yi===0||(col.add(yk),false));
      h+=`<button class="fyh" data-pcol="${yk}"><span>${y}</span><small>${Y.length} · ${money(SUM(Y,x=>x.e.a),true)}</small>${tog(yk,yOpen)}</button>`;
      const ms=[...new Set(Y.map(x=>x.e.d.slice(0,7)))];
      if(!yOpen){ n+=Y.length; return; }
      ms.forEach(m=>{ const Mx=Y.filter(x=>x.e.d.slice(0,7)===m), mk="m"+m, mOpen=!col.has(mk);
        h+=`<button class="fmh" data-pcol="${mk}"><span>${MON[+m.slice(5)-1]} ${y}</span><small>${Mx.length} · ${money(SUM(Mx,x=>x.e.a),true)}</small>${tog(mk,mOpen)}</button>`;
        if(mOpen) h+=`<div class="grp nlist">${Mx.map(x=>payRow(x,++n,true)).join("")}</div>`; else n+=Mx.length; }); });
    SC.pcolInit=1; }
  else { const B2=Bs.slice().sort((x,y)=>x.open[0].d<y.open[0].d?-1:1);
    B2.forEach((b,bi)=>{ const bk="b"+b.key, open=SC.pcolInit2?!col.has(bk):(bi===0||(col.add(bk),false)), left=SUM(b.open,e=>e.a||0), paid=b.sched.length-b.open.length;
      h+=`<button class="fyh bnd" data-pcol="${esc(bk)}"><span class="no num">${bi+1}</span><span>${esc(b.name)}<small class="sub2">${paid} of ${b.sched.length} paid · ${esc(whoVia(b.who,b.acct))}</small></span><small class="num">${money(left,true)}</small>${tog(bk,open)}</button>`;
      if(open) h+=`<div class="grp nlist">${b.open.map((e,k)=>payRow({b,e},paid+k+1,false)).join("")}</div>`; });
    SC.pcolInit2=1; }
  return h; }
/* ---------- charts ---------- */
function unitHist(u){ const m=new Map(); (u.V||[]).forEach(v=>m.set(v.date,(m.get(v.date)||0)+v.amount)); return [...m.entries()].map(([d,v])=>({d,v})).sort((a,b)=>a.d<b.d?-1:1); }
function series(U){
  const T=[].concat(...U.map(u=>u.T)).filter(t=>t.date).sort((a,b)=>a.date<b.date?-1:1);
  const inv=[]; let c=0; T.forEach(t=>{ c+=t.amt; if(inv.length&&inv[inv.length-1].d===t.date) inv[inv.length-1].v=c; else inv.push({d:t.date,v:c}); });
  const hs=U.map(u=>({u,H:unitHist(u)})), dates=[...new Set([].concat(...hs.map(x=>x.H.map(p=>p.d))))].sort();
  const netAt=(u,D)=>SUM(u.T.filter(t=>t.date&&t.date<=D),t=>t.amt);
  const val=dates.map(D=>({d:D,v:SUM(hs,({u,H})=>{ const p=H.filter(q=>q.d<=D).pop(); return p?p.v+SUM(u.T.filter(t=>t.date&&t.date>p.d&&t.date<=D),t=>t.amt):Math.max(0,netAt(u,D)); })}));
  if(val.length){ const cur=SUM(U,u=>u.cur); if(val[val.length-1].d<M.today) val.push({d:M.today,v:cur,now:1}); }
  return {T,inv,val};
}
function growthChart(el,U,col){
  const S=series(U); if(!S.inv.length){ el.innerHTML=""; return; }
  const today=M.today, yrs={"1Y":1,"3Y":3,"5Y":5}[RANGE], start=yrs?addMonths(today,-12*yrs):S.inv[0].d;
  const t0=dOf(start).getTime(), t1=dOf(today).getTime(), W=340,H=200,pl=6,pr=6,pt=18,pb=22;
  const invAt=D=>{ let v=0; for(const p of S.inv){ if(p.d<=D) v=p.v; else break; } return v; };
  const valAt=D=>{ const V=S.val; if(!V.length||D<V[0].d) return null; for(let i=0;i<V.length;i++){ if(V[i].d===D) return {v:V[i].v,exact:1}; if(V[i].d>D){ const a=V[i-1],b=V[i],k=(dOf(D)-dOf(a.d))/(dOf(b.d)-dOf(a.d)); return {v:a.v+(b.v-a.v)*k,exact:0}; } } return {v:V[V.length-1].v,exact:0}; };
  const ipts=[{d:start,v:invAt(start)}].concat(S.inv.filter(p=>p.d>start)), vpts=S.val.filter(p=>p.d>=start);
  const prevV=S.val.filter(p=>p.d<start).pop(); if(prevV&&vpts.length) vpts.unshift({d:start,v:valAt(start).v});
  const ymax=nice(Math.max(1,...ipts.map(p=>p.v),...vpts.map(p=>p.v))), ymin=Math.min(0,...ipts.map(p=>p.v));
  const X=d=>pl+(dOf(d).getTime()-t0)/Math.max(1,t1-t0)*(W-pl-pr), Y=v=>pt+(ymax-v)/((ymax-ymin)||1)*(H-pt-pb);
  let ip=`M${X(ipts[0].d).toFixed(1)},${Y(ipts[0].v).toFixed(1)}`; ipts.forEach(p=>{ ip+=`H${X(p.d).toFixed(1)}V${Y(p.v).toFixed(1)}`; }); ip+=`H${W-pr}`;
  let vp="", va=""; if(vpts.length){ vp=vpts.map((p,i)=>(i?"L":"M")+X(p.d).toFixed(1)+","+Y(p.v).toFixed(1)).join(""); va=vp+`L${X(vpts[vpts.length-1].d).toFixed(1)},${Y(Math.max(0,ymin)).toFixed(1)}L${X(vpts[0].d).toFixed(1)},${Y(Math.max(0,ymin)).toFixed(1)}Z`; }
  const gid="g"+Math.random().toString(36).slice(2,7);
  let s=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Value and money invested over time"><defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${col}" stop-opacity=".28"/><stop offset="1" stop-color="${col}" stop-opacity="0"/></linearGradient></defs>`;
  [ymax,ymax/2].forEach(v=>{ s+=`<line class="gl" x1="${pl}" x2="${W-pr}" y1="${Y(v)}" y2="${Y(v)}"/><text x="${pl+2}" y="${Y(v)-4}">${HIDE?"":esc(rs(v,true))}</text>`; });
  s+=`<line class="gl" x1="${pl}" x2="${W-pr}" y1="${Y(Math.max(0,ymin))}" y2="${Y(Math.max(0,ymin))}"/>`;
  const y0=+start.slice(0,4), y1=+today.slice(0,4), stp=Math.max(1,Math.ceil((y1-y0+1)/6));
  for(let yr=y0+1;yr<=y1;yr+=stp){ const xx=X(yr+"-01-01"); if(xx>pl+14&&xx<W-pr-14) s+=`<text x="${xx}" y="${H-6}" text-anchor="middle">${yr}</text>`; }
  if(va) s+=`<path d="${va}" fill="url(#${gid})"/>`;
  s+=`<path d="${ip}" fill="none" stroke="var(--muted)" stroke-width="1.6" stroke-dasharray="4 3"/>`;
  if(vp) s+=`<path d="${vp}" fill="none" stroke="${col}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>`+vpts.filter(p=>!p.now&&p.d!==start).map(p=>`<circle cx="${X(p.d)}" cy="${Y(p.v)}" r="3.5" fill="${col}" stroke="var(--surface)" stroke-width="1.5"/>`).join("");
  s+=`<line class="cursor" id="${gid}c" x1="0" x2="0" y1="${pt}" y2="${H-pb}" visibility="hidden"/><circle id="${gid}d" r="5" fill="${col}" stroke="var(--surface)" stroke-width="2" visibility="hidden"/></svg>`;
  el.innerHTML=`<div class="chartc"><h4>How it grew</h4><p class="cs">Drag across the chart to see any date${S.val.length&&S.val[0].d>start?" · value line starts at your first update, "+fmtDs(S.val[0].d):""}${!S.val.length?" · add a value to see the value line":""}</p><div class="rng">${["1Y","3Y","5Y","All"].map(k=>`<button data-r="${k}" aria-pressed="${RANGE===k}">${k}</button>`).join("")}</div>${s}
    <div class="leg"><span><i style="background:${col}"></i>Value</span><span><i style="background:var(--muted)"></i>Money put in</span></div><div class="readout" id="${gid}r"></div></div>`;
  const ro=$(gid+"r"), cur=$(gid+"c"), dt=$(gid+"d");
  const show=D=>{ const iv=invAt(D), vv=valAt(D), g=vv?vv.v-iv:null;
    ro.innerHTML=`<span class="dt">${D===today?"Today":fmtD(D)}${vv&&!vv.exact&&D!==today?" · value estimated between your updates":""}</span><div><small>Value</small><b class="num">${vv?money(vv.v,true):"—"}</b></div><div><small>Put in</small><b class="num">${money(iv,true)}</b></div><div><small>Gain</small><b class="num ${cls(g)}">${g==null?"—":smoney(g,true)}</b></div>`; return vv; };
  show(today);
  const sv=el.querySelector("svg"), hit=e=>{ const r=sv.getBoundingClientRect(), px=(e.clientX-r.left)*(W/r.width); const k=Math.max(0,Math.min(1,(px-pl)/(W-pl-pr))); const D=isoOf(new Date(t0+k*(t1-t0)));
    const vv=show(D); cur.setAttribute("x1",X(D)); cur.setAttribute("x2",X(D)); cur.setAttribute("visibility","visible");
    if(vv){ dt.setAttribute("cx",X(D)); dt.setAttribute("cy",Y(vv.v)); dt.setAttribute("visibility","visible"); } else dt.setAttribute("visibility","hidden"); };
  sv.addEventListener("pointerdown",hit); sv.addEventListener("pointermove",e=>{ if(e.pointerType==="mouse"||e.buttons) hit(e); });
  sv.addEventListener("pointerleave",()=>{ cur.setAttribute("visibility","hidden"); dt.setAttribute("visibility","hidden"); show(today); });
  el.querySelectorAll("[data-r]").forEach(b=>b.onclick=()=>{ RANGE=b.dataset.r; store.set("range",RANGE); growthChart(el,U,col); });
}
function pkey(s,g){ const y=+s.slice(0,4),m=+s.slice(5,7); if(g==="M") return s.slice(0,7); if(g==="Y") return String(y); return "FY"+fyOf(s); }
function plabel(k,g,short){ if(g==="M"){ const [y,m]=k.split("-"); return short?`${MON[+m-1]}${+m===1?" '"+y.slice(2):""}`:`${MON[+m-1]} ${y}`; } if(g==="Y") return short?"'"+k.slice(2):k;
  const fy=+k.slice(2,6); return short?`FY${String(fy+1).slice(2)}`:`FY ${fy}–${String(fy+1).slice(2)} (Apr–Mar)`; }
function flowChart(el,T){
  const D=T.filter(t=>t.date); if(!D.length){ el.innerHTML=""; return; }
  const g=FLOWG, keys=[]; let d=D.reduce((m,t)=>t.date<m?t.date:m,D[0].date).slice(0,7)+"-01"; while(d<=M.today){ const k=pkey(d,g); if(keys[keys.length-1]!==k) keys.push(k); d=addMonths(d,1); }
  const ks=g==="M"?keys.slice(-18):keys, P=ks.map(k=>({k,inn:0,out:0,T:[]})), map=new Map(P.map(p=>[p.k,p]));
  D.forEach(t=>{ const p=map.get(pkey(t.date,g)); if(!p) return; p.T.push(t); if(t.amt>0) p.inn+=t.amt; else p.out-=t.amt; });
  const W=340,H=180,pl=6,pr=6,pt=20,pb=22,n=P.length, up=nice(Math.max(1,...P.map(p=>p.inn))), dn=Math.max(...P.map(p=>p.out))>0?nice(Math.max(...P.map(p=>p.out))):0;
  const span=up+dn, Y=v=>pt+(up-v)/span*(H-pt-pb), sw=(W-pl-pr)/n, bw=Math.max(4,Math.min(26,sw*.64)), every=Math.ceil(n/7);
  let s=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Money put in and taken out per period">`;
  s+=`<line class="gl" x1="${pl}" x2="${W-pr}" y1="${Y(up)}" y2="${Y(up)}"/><text x="${pl+2}" y="${Y(up)-4}">${HIDE?"":esc(rs(up,true))}</text><line x1="${pl}" x2="${W-pr}" y1="${Y(0)}" y2="${Y(0)}" stroke="var(--muted)" stroke-width="1" opacity=".5"/>`;
  P.forEach((p,i)=>{ const cx=pl+sw*(i+.5), x=cx-bw/2;
    if(p.inn) s+=`<rect x="${x}" y="${Y(p.inn)}" width="${bw}" height="${Math.max(1,Y(0)-Y(p.inn))}" rx="3" fill="var(--tint)"/>`;
    if(p.out) s+=`<rect x="${x}" y="${Y(0)}" width="${bw}" height="${Math.max(1,Y(-p.out)-Y(0))}" rx="3" fill="var(--spend)" opacity=".85"/>`;
    if(i%every===0||i===n-1) s+=`<text x="${cx}" y="${H-6}" text-anchor="middle">${esc(plabel(p.k,g,true))}</text>`;
    s+=`<rect class="bar-hit" data-i="${i}" x="${pl+sw*i}" y="0" width="${sw}" height="${H}" fill="transparent"/>`; });
  s+=`</svg>`;
  el.innerHTML=`<div class="chartc"><h4>Money in and out</h4><p class="cs">Tap a bar to see every entry in it</p><div class="rng">${[["M","Month"],["FY","Fin. year"],["Y","Year"]].map(([k,l])=>`<button data-g="${k}" aria-pressed="${g===k}">${l}</button>`).join("")}</div>${s}
    <div class="leg"><span><i class="blk" style="background:var(--tint)"></i>Put in</span><span><i class="blk" style="background:var(--spend)"></i>Taken out</span></div></div>`;
  el.querySelectorAll("[data-g]").forEach(b=>b.onclick=()=>{ FLOWG=b.dataset.g; store.set("flowg",FLOWG); flowChart(el,T); });
  el.querySelectorAll(".bar-hit").forEach(b=>b.addEventListener("click",()=>{ const p=P[+b.dataset.i]; periodSheet(plabel(p.k,g,false),p); }));
}
function payoutChart(el){
  const Bs=bondsFor(WHO), items=[]; Bs.forEach(b=>{ b.open.forEach(e=>items.push({b,d:e.d,a:e.a||0,st:e.d<=M.today?"due":"exp",e})); b.reps.forEach(t=>items.push({b,d:t.date,a:-t.amt,st:"got",t})); });
  if(!items.length){ el.innerHTML=""; return; }
  const last=items.reduce((m,x)=>x.d>m?x.d:m,M.today), startM=addMonths(M.today,-12).slice(0,7), endM=(last>addMonths(M.today,12)?last:addMonths(M.today,12)).slice(0,7);
  const ms=[]; let d=startM+"-01"; while(d.slice(0,7)<=endM&&ms.length<36){ ms.push(d.slice(0,7)); d=addMonths(d,1); }
  const P=ms.map(k=>({k,got:0,exp:0,due:0,L:[]})), map=new Map(P.map(p=>[p.k,p])); items.forEach(x=>{ const p=map.get(x.d.slice(0,7)); if(!p) return; p[x.st]+=x.a; p.L.push(x); });
  const W=340,H=180,pl=6,pr=6,pt=20,pb=22,n=P.length, up=nice(Math.max(1,...P.map(p=>p.got+p.exp+p.due))), Y=v=>pt+(up-v)/up*(H-pt-pb), sw=(W-pl-pr)/n, bw=Math.max(3,sw*.64);
  const nowX=pl+sw*(ms.indexOf(M.today.slice(0,7))+.5);
  let s=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Bond money coming back by month"><line class="gl" x1="${pl}" x2="${W-pr}" y1="${Y(up)}" y2="${Y(up)}"/><text x="${pl+2}" y="${Y(up)-4}">${HIDE?"":esc(rs(up,true))}</text>`;
  s+=`<line x1="${nowX}" x2="${nowX}" y1="${pt-6}" y2="${H-pb}" stroke="var(--muted)" stroke-dasharray="3 3"/><text x="${nowX+3}" y="${pt-8}">Today</text>`;
  P.forEach((p,i)=>{ const cx=pl+sw*(i+.5), x=cx-bw/2; let y=Y(0);
    [["got","var(--ok)"],["due","var(--accent)"],["exp",CLS.Bonds.col]].forEach(([k,c])=>{ if(!p[k]) return; const h=Math.max(2,Y(0)-Y(p[k])); y-=h; s+=`<rect x="${x}" y="${y}" width="${bw}" height="${h}" rx="2" fill="${c}" ${k==="exp"?'opacity=".55"':""}/>`; });
    if(+p.k.slice(5)===1||(i===0&&+p.k.slice(5)<=10)) s+=`<text x="${cx}" y="${H-6}" text-anchor="middle">${MON[+p.k.slice(5)-1]} '${p.k.slice(2,4)}</text>`;
    if(p.L.length) s+=`<rect class="bar-hit" data-i="${i}" x="${pl+sw*i}" y="0" width="${sw}" height="${H}" fill="transparent"/>`; });
  el.innerHTML=`<div class="chartc"><h4>Money coming back</h4><p class="cs">Repayments by month · tap a bar for details</p>${s}</svg>
    <div class="leg"><span><i class="blk" style="background:var(--ok)"></i>Received</span><span><i class="blk" style="background:var(--accent)"></i>Due, not confirmed</span><span><i class="blk" style="background:${CLS.Bonds.col};opacity:.55"></i>Expected</span></div></div>`;
  el.querySelectorAll(".bar-hit").forEach(b=>b.addEventListener("click",()=>{ const p=P[+b.dataset.i]; monthPayoutSheet(p); }));
}

/* ---------- bottom sheets ---------- */
function openE(html){ $("eBox").innerHTML=html; if(!isOpen($("eSheet"))) ov.open($("eSheet"),()=>{ vanish($("eSheet")); }); else { const b=$("eBox"); b.classList.remove("swap"); void b.offsetWidth; b.classList.add("swap"); } $("eBox").scrollTop=0;
  $("eBox").querySelectorAll("[data-close]").forEach(x=>x.onclick=()=>ov.back()); bindRows($("eBox")); }
$("eSheet").addEventListener("click",e=>{ if(e.target===$("eSheet")) ov.back(); });
const dl=F=>`<dl class="elist">${F.filter(Boolean).map(([k,v])=>`<dt>${esc(k)}</dt><dd>${v}</dd>`).join("")}</dl>`;
const closeBtn=`<button class="x" type="button" data-close>Close</button>`;
function holdSheet(h){ if(!h) return; const isMF=h.a==="Mutual Funds", all=holdFor(h.a,"all"), share=SUM(all,x=>x.cur)?h.cur/SUM(all,x=>x.cur):null, gp=h.inv?h.gain/h.inv:null;
  const orders=M.tx.filter(t=>t.a===h.a&&t.cat===h.tab&&t.name&&keyName(t.name)===keyName(h.name));
  const fl=orders.filter(t=>t.date&&["Buy","Sell","Redeem"].includes(t.type)).map(t=>[t.date,t.type==="Buy"?-t.show:t.show]); if(h.cur>0) fl.push([M.today,h.cur]); const hx=h.ca?null:xirr(fl);
  openE(`<div class="eamt num" style="color:var(--ink)">${money(h.cur,false)}</div><div class="t">${esc(h.name)}</div>
    ${dl([["Gain",`<span class="${cls(h.gain)}">${smoney(h.gain)}${gp!=null?" ("+pct(gp)+")":""}</span>`],["Invested",money(h.inv,false)],hx!=null?["Return a year (XIRR)",`<span class="${cls(hx)}">${pct(hx)}</span>`]:null,[isMF?"Units":"Quantity",h.qty?qtyf(h.qty):"—"],!isMF&&h.avg?["Average buy price",money(h.avg,false)]:null,h.since?["Held since",fmtD(h.since)+(h.ca?" (incl. the company it came from)":"")]:null,
      !isMF&&h.qty?["Last price",money(h.cur/h.qty,false)]:null,isMF&&h.qty?[h.nav?"NAV · "+fmtDs(h.nav.d):"NAV (last known)",HIDE?"••":"₹"+(h.cur/h.qty).toFixed(4)]:null,h.nav?["Scheme (AMFI)",esc(h.nav.sn)]:null,["Investor",esc(h.who)],["Platform",esc(h.plat)],
      share!=null?["Share of all "+(isMF?"funds":"stocks"),pctp(share)]:null,h.isin?["ISIN",esc(h.isin)]:null,["As of",fmtD(h.upd||h.date)]])}
    ${orders.length?`<div class="gh"><span>Your entries · ${orders.length}</span><b class="num">${money(SUM(orders,t=>t.type==="Buy"?t.show:t.type==="Sell"||t.type==="Redeem"?-t.show:0),true)}</b></div><div class="list">${orders.slice().sort((a,b)=>a.date<b.date?1:-1).map(txRow).join("")}</div>`:""}
    <div class="btns"><button class="x" type="button" id="hSell">${isMF?"Redeem":"Sell"}</button><button class="go" type="button" id="hBuy">${isMF?"Invest more":"Buy more"}</button></div>
    ${isMF?"":`<button class="x" type="button" id="hCA">Demerger, merger, split or name change…</button>`}${closeBtn}`);
  if($("hCA")) $("hCA").onclick=()=>caSheet(h);
  const pre={a:h.a,inv:h.who,acct:h.acct,name:h.name,type:h.us?"us":h.a==="Mutual Funds"?"mf":"stocks"}; $("hBuy").onclick=()=>{ ov.back(); setTimeout(()=>openAdd("in",pre),80); }; $("hSell").onclick=()=>{ ov.back(); setTimeout(()=>openAdd("out",pre),80); }; }
function fundSheet(id){ const f=fundsFromOrders("all").find(x=>x.id===id); if(!f) return;
  openE(`<div class="eamt num" style="color:var(--ink)">${money(f.net,false)}</div><div class="t">${esc(f.name)}</div>
    ${dl([["Investor",esc(f.who)],["Platform",esc([...new Set(f.T.map(t=>t.p))].join(", "))],["Orders",String(f.n)],["First order",fmtD(first(f.T))]])}
    <div class="list">${f.T.slice().sort((a,b)=>a.date<b.date?1:-1).map(txRow).join("")}</div>${closeBtn}`); }
function txSheet(t){ if(!t) return; const r=t.src||{}, link=M.url&&t.row?safeUrl(`${M.url}#gid=${encodeURIComponent(M.gid)}&range=A${Number(t.row)||1}`):"", neg=txNeg(t);
  openE(`<div class="eamt num" style="color:${neg?"var(--spend)":"var(--ink)"}">${t.type==="Bonus"?"+"+qtyf(t.qty)+" shares":moneyX(Math.abs(t.show))}</div><div class="t">${esc(txTitle(t))}</div>
    ${dl([["Date",fmtD(t.date)],["Whose money",esc(t.who)],["Account",esc(t.acct)],t.name?["Name",esc(t.name)]:null,t.qty?[t.asset==="Mutual Funds"?"Units":"Quantity",qtyf(t.qty)]:null,t.price?["Price",moneyX(t.price)]:null,
      ["Type",esc(t.ca?"Corporate action ("+caKind(t.ca).toLowerCase()+")":t.type)],t.via?["Paid via",esc(t.via==="Balance"?"Account balance":t.via)]:null,t.bank?["Bank",esc(t.bank)]:null,t.tds?["TDS deducted (your income, paid as tax)",moneyX(t.tds)]:null,t.pr?["Principal part",moneyX(t.pr)]:null,t.net?["Reached the bank",moneyX(t.net)]:null,t.note2?["Note",esc(t.note2)]:null,t.id&&!t.pending?["Entry",esc(t.id)]:null])}
    <div class="s">${t.pending?"Waiting to sync":link?`<a href="${esc(link)}" target="_blank" rel="noopener">Open in the sheet</a>`:""}</div>
    ${t.internal?"":`<div class="btns"><button class="x" type="button" id="tDel">Delete entry</button></div>`}${closeBtn}`);
  const del=$("tDel"); if(del) del.onclick=()=>confirmSheet("Delete this entry?",`${txTitle(t)} · ${fmtD(t.date)}. It is removed from the Ledger in your sheet.`,"Delete",()=>{
    if(String(t.id).startsWith("new-")){ const rid0=String(t.id).slice(4).replace(/-\d+$/,""); OUT=OUT.filter(o=>!(o.kind==="add"&&o.rid===rid0)); }
    else OUT.push({kind:"del",id:t.id,rid:rid()}); saveOut(); refresh(); showToast("Entry deleted"); flush(); }); }
function periodSheet(label,p){ openE(`<div class="eamt num" style="color:var(--ink)">${money(p.inn-p.out,false)}</div><div class="t">Net put in · ${esc(label)}</div>
    ${dl([["Put in",money(p.inn,false)],["Taken out",p.out?`<span class="loss">${money(-p.out,false)}</span>`:"—"],["Entries",String(p.T.length)]])}
    <div class="list">${p.T.slice().sort((a,b)=>a.date<b.date?1:-1).map(txRow).join("")||`<div class="empty">Nothing in this period.</div>`}</div>${closeBtn}`); }
function monthPayoutSheet(p){ const [y,m]=p.k.split("-");
  openE(`<div class="eamt num" style="color:var(--ink)">${money(p.got+p.exp+p.due,false)}</div><div class="t">Bond money · ${MON[+m-1]} ${y}</div>
    <div class="list">${p.L.map(x=>`<button class="hl" ${x.st==="due"?`data-pr="${esc(x.b.key)}|${esc(x.d)}"`:`data-bond="${esc(x.b.key)}"`}><span class="av" style="background:${x.st==="got"?"var(--ok)":x.st==="due"?"var(--accent)":CLS.Bonds.col};color:#111">${dOf(x.d).getDate()}</span><div style="min-width:0"><div class="n">${esc(x.b.name)}</div><div class="m">${fmtD(x.d)}</div></div><div class="r"><b class="num">${x.a?money(x.a,true):"—"}</b><small>${x.st==="got"?`<span class="tag ok">Received</span>`:x.st==="due"?`<span class="tag due">Confirm</span>`:"expected"}</small></div></button>`).join("")}</div>${closeBtn}`); }
function bondSheet(key){ const b=M.bonds.find(x=>x.key===key); if(!b) return; const today=M.today, gain=b.closed?b.repaid-b.cost:b.egain, info=b.info||{};
  const sch=b.sched.map(e=>{ const snz=(SNZ[b.key+"|"+e.d]||"")>today, due=!e.done&&e.d<=today&&!snz, amt=e.done&&e.row?-e.row.amt:e.a;
    return `<button class="hl" ${!e.done?`data-pr="${esc(b.key)}|${esc(e.d)}"`:""}><span class="av" style="background:${e.done?"var(--ok)":due?"var(--accent)":CLS.Bonds.col};color:#111">${dOf(e.d).getDate()}</span><div style="min-width:0"><div class="n">${fmtD(e.d)}</div><div class="m">${e.done?"Received"+(e.row&&e.row.tds?" · TDS "+rs(e.row.tds,false):""):snz?"Snoozed to "+fmtDs(SNZ[b.key+"|"+e.d]):due?"Tap to confirm":"Principal "+rs(e.p||0,true)+" · interest "+rs(e.i||0,true)+(e.est?" (est.)":"")}</div></div><div class="r"><b class="num">${amt?money(amt,true):"—"}</b><small>${e.done?`<span class="tag ok">Done</span>`:due?`<span class="tag due">Due</span>`:""}</small></div></button>`; }).join("");
  openE(`<div class="eamt num" style="color:var(--ink)">${money(b.cost,false)}</div><div class="t">${esc(b.name)}</div>
    ${dl([["Status",b.closed?"Repaid":b.next?(b.next.d<=today?"Repayment due":"Active"):"Active"],["Investor",esc(b.who)],["Platform",esc(b.platL)],["Bought",fmtD(b.date)],info.ytm||info.rate?["Yield",esc(info.ytm?info.ytm+"% a year":info.rate)]:null,b.exp?["Expected back (before TDS)",money(b.exp,false)]:null,["Received so far",money(b.repaid,false)],
      b.tds?["TDS deducted so far",money(b.tds,false)]:null,gain==null?null:[b.closed?"Gain":"Expected gain",`<span class="${cls(gain)}">${smoney(gain)}</span>`],b.mat?["Ends",fmtD(b.mat)]:null,b.note?["Note",esc(b.note)]:null,info.src?["Schedule from",esc(info.src)]:null])}
    ${sch?`<div class="gh"><span>Repayment dates</span><b class="num">${b.sched.filter(e=>e.done).length}/${b.sched.length}</b></div><div class="list">${sch}</div>`:""}
    ${b.closed?"":`<button class="x" type="button" id="bCalT">${svgI("cal","var(--neon)",15)} ${info.remind==="cal"?"Google Calendar alerts are on · turn off":"Add Google Calendar alerts for these dates"}</button>`}
    <div class="btns"><button class="x" type="button" id="bShot">Read dates from screenshots</button><button class="go" type="button" id="bRec">Record repayment</button></div>${closeBtn}`);
  const ct=$("bCalT"); if(ct) ct.onclick=()=>{ ov.back(); setBondRemind(b,info.remind!=="cal"); };
  $("bRec").onclick=()=>openPrompt(b,b.next||{d:today,a:0,p:0,i:0},true);
  $("bShot").onclick=()=>pickFiles("image/*,application/pdf",files=>sendInbox("bond",{bondKey:b.key,name:b.name,acct:b.acct,who:b.who,platform:b.plat,amount:b.cost,date:b.date,existing:true},files,"Schedule for "+b.name)); }
function openGain(){ const R=HOME.map(h=>agg(h,WHO)).filter(r=>r.U.length);
  openE(`<div class="eamt num" style="color:var(--ink)">${smoney(SUM(R.filter(r=>r.gain!=null),r=>r.gain))}</div><div class="t">Returns${WHO!=="all"?" · "+WHO:""}</div>
    <div class="list">${R.map(r=>{ const gp=r.gain!=null&&r.base>0?r.gain/r.base:null; return `<button class="hl" data-cat="${r.h}"><span class="av" style="background:${CLS[r.h].col}">${svgI(CLS[r.h].icon,"#fff",18)}</span><div style="min-width:0"><div class="n">${CLS[r.h].label}</div><div class="m">XIRR ${pct(r.x)}${r.asof?" · value "+fmtDs(r.asof):""}</div></div><div class="r"><b class="num ${cls(r.gain)}">${r.gain==null?"—":smoney(r.gain,true)}</b><small>${pct(gp)}</small></div></button>`; }).join("")}</div>
    <div class="s">Gain = value today minus money put in. Bonds count gain once repaid. NPS and insurance are not counted.</div>${closeBtn}`);
  $("eBox").querySelectorAll("[data-cat]").forEach(b=>b.onclick=()=>{ ov.back(); setTimeout(()=>openScr(b.dataset.cat),80); }); }

/* ---------- the bell: everything that needs you ---------- */
function bellItems(){ const due=dueItems("all"), soon=soonItems("all",30), ib=recs("inbox").filter(r=>r.d.status==="new"||r.d.status==="ready"), ren=renewals(45);
  const chg=chargeYears("all").filter(x=>x.open), tds=tdsYears("all").filter(x=>x.due||x.status==="mismatch");
  const dc=CHECKS(), ca=caPending();
  return {due,soon,ib,ren,chg,tds,dc,ca,n:ca.length+dc.length+due.length+ib.filter(r=>r.d.status==="ready").length+ren.filter(x=>x.left<=30).length+chg.filter(x=>x.ended).length+tds.length}; }
function paintBell(){ if(!M) return; const B=bellItems(); $("bellN").hidden=!B.n; $("bellN").textContent=B.n>9?"9+":B.n; $("bellBtn").classList.toggle("ring",B.n>0);
  $("dInboxS").innerHTML=recs("inbox").some(r=>r.d.status==="new")?`<span class="tag due">${recs("inbox").filter(r=>r.d.status==="new").length} waiting</span>`:"›"; }
function openBell(){ const B=bellItems(), wait=B.ib.filter(r=>r.d.status==="new"), ready=B.ib.filter(r=>r.d.status==="ready");
  const row=(x,tag)=>`<button class="hl" data-pr="${esc(x.b.key)}|${esc(x.e.d)}"><span class="av" style="background:${tag==="due"?"var(--accent)":CLS.Bonds.col};color:#111">${dOf(x.e.d).getDate()}</span><div style="min-width:0"><div class="n">${esc(x.b.name)}</div><div class="m">${tag==="due"?"Due "+fmtD(x.e.d)+" · did it arrive?":"Due "+fmtD(x.e.d)}</div></div><div class="r"><b class="num">${x.e.a?money(x.e.a,true):"—"}</b><small>${tag==="due"?`<span class="tag due">Confirm</span>`:"expected"}</small></div></button>`;
  let h=`<div class="t big">Needs attention</div>`;
  if(B.dc.length) h+=`<div class="gh"><span>Data checks · phone vs sheet</span><b class="num">${B.dc.length}</b></div><div class="list">${B.dc.map(x=>`<button class="hl" data-dc="${esc(x.id)}"><span class="av" style="background:${x.sev==="bad"?"#FF5D73":"var(--accent)"};color:#111">${svgI("check","#111",18)}</span><div style="min-width:0"><div class="n">${esc(x.title)}</div><div class="m">${esc(x.sub)}</div></div><div class="r"><small><span class="tag ${x.sev==="bad"?"bad":"due"}">${x.sev==="bad"?"Fix":"Check"}</span></small></div></button>`).join("")}</div>`;
  if(B.ca.length) h+=`<div class="gh"><span>Corporate actions to apply</span><b class="num">${B.ca.length}</b></div><button class="ai" id="bCA">${svgI("spark","var(--neon2)")}<span><b>${esc([...new Set(B.ca.map(x=>CA_KIND[x.a.kind]+" · "+x.a.to))].join(", "))}</b><small>${B.ca.length} holding${B.ca.length>1?"s":""} · moves the purchase cost as announced</small></span></button>`;
  if(ready.length) h+=`<div class="gh"><span>Claude has read · review</span><b class="num">${ready.length}</b></div><div class="list">${ready.map(inboxRow).join("")}</div>`;
  if(B.due.length) h+=`<div class="gh"><span>Repayments to confirm</span><b class="num">${B.due.length}</b></div><div class="list">${B.due.map(x=>row(x,"due")).join("")}</div>`;
  if(B.ren.length) h+=`<div class="gh"><span>Insurance renewals</span><b class="num">${B.ren.length}</b></div><div class="list">${B.ren.map(x=>`<button class="hl" data-pol="${esc(x.pol.id)}"><span class="av" style="background:${polCol(x.pol)}">${svgI(polIcon(x.pol),"#fff",20)}</span><div style="min-width:0"><div class="n">${esc(x.pol.d.title)}</div><div class="m">${x.left<0?"Expired "+fmtD(x.end):"Ends "+fmtD(x.end)}</div></div><div class="r"><b class="num">${x.left<0?"—":x.left+"d"}</b><small><span class="tag ${x.left<0?"bad":"due"}">${x.left<0?"Expired":"Renew"}</span></small></div></button>`).join("")}</div>`;
  if(B.tds.length) h+=`<div class="gh"><span>TDS to verify · before filing ITR</span><b class="num">${B.tds.length}</b></div><div class="list">${B.tds.map(x=>`<button class="hl" data-tdsb="${x.fy}|${esc(x.person)}"><span class="av" style="background:var(--accent);color:#111">${svgI("check","#111",18)}</span><div style="min-width:0"><div class="n">${fyL(x.fy)} · ${esc(x.person)}'s 26AS</div><div class="m">${x.status==="mismatch"?"Differs from 26AS · follow up":"Upload 26AS / AIS · Claude matches it"}</div></div><div class="r"><b class="num">${money(x.tds,true)}</b><small><span class="tag ${x.status==="mismatch"?"bad":"due"}">${x.status==="mismatch"?"Check":"Verify"}</span></small></div></button>`).join("")}</div>`;
  if(B.chg.length) h+=`<div class="gh"><span>Charges to make exact</span><b class="num">${B.chg.length}</b></div><div class="list">${B.chg.map(x=>`<button class="hl" data-chgb="${esc(x.acct)}|${x.fy}"><span class="av" style="background:${CLS.Stocks.col}">${svgI("file","#fff",18)}</span><div style="min-width:0"><div class="n">${fyL(x.fy)} · ${esc(x.acct)}</div><div class="m">${x.ended?"Upload Groww's P&L + ledger for the year":"Estimated so far · upload after the year ends"}</div></div><div class="r"><b class="num">${money(x.est,true)}</b><small><span class="tag ${x.ended?"due":"neo"}">${x.ended?"Upload":"Later"}</span></small></div></button>`).join("")}</div>`;
  if(wait.length) h+=`<div class="gh"><span>Waiting for Claude</span><b class="num">${wait.length}</b></div><div class="list">${wait.map(inboxRow).join("")}</div><button class="ai" id="bProc">${svgI("spark","var(--neon2)")}<span><b>Process now</b><small>Opens a new chat in your Artha project; send the message that's copied for you</small></span></button>`;
  if(B.soon.length) h+=`<div class="gh"><span>Coming up · 30 days</span><b class="num">${money(SUM(B.soon,x=>x.e.a),true)}</b></div><div class="list">${B.soon.map(x=>row(x,"soon")).join("")}</div>`;
  if(!B.dc.length&&!B.due.length&&!B.ib.length&&!B.ren.length&&!B.soon.length&&!B.tds.length&&!B.chg.length) h+=`<div class="empty">All clear. Nothing needs you right now.</div>`;
  h+=closeBtn;
  openE(h); const pb=$("bProc"); if(pb) pb.onclick=processNow; const bca=$("bCA"); if(bca) bca.onclick=caKnownSheet;
  $("eBox").querySelectorAll("[data-dc]").forEach(b=>b.onclick=()=>openCheck(b.dataset.dc));
  $("eBox").querySelectorAll("[data-tdsb]").forEach(b=>b.onclick=()=>{ const [fy,p2]=b.dataset.tdsb.split("|"); tdsUpload(+fy,p2); });
  $("eBox").querySelectorAll("[data-chgb]").forEach(b=>b.onclick=()=>{ const i=b.dataset.chgb.lastIndexOf("|"); chargesUpload({acct:b.dataset.chgb.slice(0,i),fy:+b.dataset.chgb.slice(i+1)}); }); }
$("bellBtn").onclick=openBell;

/* ---------- repayments: amount that reached the bank + 10% TDS on the interest part ---------- */
function splitOf(b,e){ let p=e.p, i=e.i; if(p==null||i==null||(!p&&!i&&e.a)){ const ex=b.exp||e.a||0; p=ex>0?b.cost*(e.a||0)/ex:0; i=Math.max(0,(e.a||0)-p); } return {p:+p||0,i:+i||0}; }
function tdsFor(net,P){ const I=Math.max(0,(net-P)/0.9), tds=Math.round(I*0.1); return {gross:net+tds,tds,I:Math.round(I)}; }
function openPrompt(b,e,manual){ const today=M.today, sp=splitOf(b,e), expNet=Math.round(sp.p+sp.i*0.9);
  openE(`<div class="t big">${manual?"Record a repayment":"Did this repayment arrive?"}</div><div class="s" style="text-align:left">${esc(b.name)}${manual?"":" · due "+fmtD(e.d)}${e.a?` · expected ${esc(rs(e.a,false))} before TDS`:""}</div>
    <label class="fld"><span>Amount that reached your bank (₹)</span><input id="rAmt" inputmode="numeric" value="${e.a?expNet:""}" autocomplete="off"></label>
    <label class="fld"><span>Principal in this repayment (₹)</span><input id="rP" inputmode="numeric" value="${Math.round(sp.p)||""}" autocomplete="off"></label>
    <div class="calc" id="rCalc"></div>
    <label class="fld"><span>Received on</span><input id="rDate" type="date" value="${e.d<=today?e.d:today}" max="${today}"></label><div class="err" id="rErr" role="alert"></div>
    <button class="go" type="button" id="rOk">${manual?"Save repayment":"Yes, it arrived"}</button>
    ${manual?"":`<div class="fld"><span>Not yet? Ask again in</span><div class="snz"><button data-n="1">1 day</button><button data-n="2">2 days</button><button data-n="7">1 week</button><input id="snzN" inputmode="numeric" placeholder="Days" style="width:84px;padding:9px 12px;font-size:14px"><button id="snzGo">Snooze</button></div></div>`}${closeBtn}`);
  const calc=()=>{ const net=numIn($("rAmt").value), P=numIn($("rP").value), r=tdsFor(net,P);
    $("rCalc").innerHTML=net?`<div><span>Interest (gross)</span><span>${esc(rs(r.I,false))}</span></div><div><span>TDS 10% on interest, added back</span><b>+${esc(rs(r.tds,false))}</b></div><div><span>Recorded as received</span><b>${esc(rs(r.gross,false))}</b></div>`:"<div><span>Type what reached your bank; Artha adds back the 10% TDS on the interest part.</span></div>"; };
  $("rAmt").oninput=calc; $("rP").oninput=calc; calc();
  const snooze=n=>{ n=Math.max(1,Math.min(365,Math.round(n))); SNZ[b.key+"|"+e.d]=addDays(today,n); store.set("snz",SNZ); ov.back(); refresh(); showToast(`I'll ask again in ${n} day${n>1?"s":""}`); };
  $("eBox").querySelectorAll("[data-n]").forEach(x=>x.onclick=()=>snooze(+x.dataset.n));
  const sg=$("snzGo"); if(sg) sg.onclick=()=>{ const n=Number($("snzN").value); if(n>0) snooze(n); else $("rErr").textContent="Type the number of days."; };
  $("rOk").onclick=()=>{ const net=numIn($("rAmt").value), P=numIn($("rP").value), dt=$("rDate").value;
    if(!(net>0)){ $("rErr").textContent="Enter the amount that reached your bank."; return; } if(!dt||dt>today){ $("rErr").textContent="Pick the date it came in."; return; }
    const r=tdsFor(net,P);
    OUT.push({kind:"add",rows:[{date:dt,who:b.who,acct:b.acct,asset:b.fd?"FD":"Bonds",type:"Payout",name:b.name,amt:r.gross,via:"Bank",note:`Received${manual?"":" [due "+e.d+"]"} [p ${Math.round(P*100)/100}]${r.tds?" [tds "+r.tds+"]":""} [net ${net}]`}],rid:rid()});
    if(!manual) OUT.push({kind:"cal",ops:[{key:"rp:"+b.key+"|"+e.d,del:true}]});
    saveOut(); ov.back(); refresh(); showToast(`${rs(r.gross,false)} recorded for ${b.name}${r.tds?" (incl. "+rs(r.tds,false)+" TDS)":""}`); flush(); }; }

/* ---------- reminders: asked when a bond or policy is added ---------- */
function bondCal(key,name,plat,S){ return S.filter(e=>e.d>=M.today).map(e=>({key:"rp:"+key+"|"+e.d,title:`Bond repayment: ${name}`,date:e.d,desc:`${name}${plat?" ("+plat+")":""} should pay about ${rs(e.a||((e.p||0)+(e.i||0)),false)} before TDS.`})); }
function queueCal(ops){ for(let i=0;i<ops.length;i+=15) OUT.push({kind:"cal",ops:ops.slice(i,i+15),rid:rid()}); }
const remindPref=()=>store.get("remind","cal");
function remindSeg(id,cur,label){ return `<div class="fld"><span>${label||"Remind me on these dates"}</span><div class="seg sm" id="${id}"><button type="button" data-v="cal" aria-pressed="${cur==="cal"}">${svgI("cal","currentColor",14)} Google Calendar alert</button><button type="button" data-v="app" aria-pressed="${cur!=="cal"}">Only in Artha</button></div></div>`; }
function bindRemind(id,set){ const el=$(id); if(!el) return; el.querySelectorAll("[data-v]").forEach(b=>b.onclick=()=>{ el.querySelectorAll("[data-v]").forEach(x=>x.setAttribute("aria-pressed",String(x===b))); set(b.dataset.v); store.set("remind",b.dataset.v); }); }
function setBondRemind(b,on){ const R=M.rec.get("bond:"+b.key), d=Object.assign({},R?R.d:{},{remind:on?"cal":"app"});
  OUT.push({kind:"rec",ops:[{id:"bond:"+b.key,kind:"bond",title:b.name,data:d}],rid:rid()});
  queueCal(on?bondCal(b.key,b.name,b.platL,b.open):b.open.map(e=>({key:"rp:"+b.key+"|"+e.d,del:true}))); saveOut(); flush(); refresh();
  showToast(on?"Google Calendar alerts added for the repayment dates":"Calendar alerts removed"); }
function polCal(pid,title,end,on){ if(!end) return []; const d=addDays(end,-15)<M.today?M.today:addDays(end,-15);
  return [on?{key:"ins:"+pid,title:`Renew insurance: ${title}`,date:d,desc:`${title} ends on ${fmtD(end)}.`}:{key:"ins:"+pid,del:true}]; }

/* ---------- values ---------- */
function npsValue(){ openValues("NPS"); }
function unitLabel(u){ return [u.h==="Others"?"NPS":CLS[u.h].label, u.acct+(holderOf(u.acct)!==u.who?" · "+u.who+"'s money":"")]; }
const navAuto=u=>{ if(u.h!=="Mutual Funds") return false; const H=M.hold.filter(x=>x.tab===u.tab); return H.length>0&&H.every(x=>x.nav); };
function openValues(h){ const key=h==="NPS"?"Others":h, U0=M.units.filter(u=>u.h!=="Bonds"&&(!key||u.h===key)&&(u.cur>0||u.V.length)), U=U0.filter(u=>!navAuto(u)).sort((a,b)=>b.cur-a.cur), nAuto=U0.length-U.length, vals={};
  openE(`<div class="t big">Update today's values</div><div class="s" style="text-align:left">Open the app for each account and type what it shows as the current value. Leave a box empty to keep the last value.${nAuto?" Mutual funds update by themselves from each fund's latest NAV.":""}</div>
    <div class="vcards">${U.map((u,k)=>{ const [t,sub]=unitLabel(u), cl=u.h==="Others"?"NPS":u.h, col=CLS[cl].col;
      return `<label class="vcard" style="--c:${col};--k:${k}"><span class="av" style="background:${col}">${svgI(CLS[cl].icon,"#fff",18)}</span><span class="vt"><b>${esc(t)}</b><small>${esc(sub)}</small><small class="num">${u.valued?`Now ${money(u.cur,true)} · ${fmtDs(u.asof)}`:"No value yet"}</small></span><span class="vin"><i>₹</i><input inputmode="numeric" data-vc="${esc(u.tab)}" placeholder="Today"></span></label>`; }).join("")||`<div class="empty">Nothing to value here.</div>`}</div>
    <div class="err" id="vErr"></div><button class="go" type="button" id="vOk">Save values</button>${closeBtn}`);
  $("eBox").querySelectorAll("[data-vc]").forEach(i=>i.oninput=()=>{ const raw=i.value.replace(/[^\d]/g,"").slice(0,11); vals[i.dataset.vc]=raw; i.value=raw?Number(raw).toLocaleString("en-IN"):""; });
  $("vOk").onclick=()=>{ const L2=Object.entries(vals).filter(([,v])=>v); if(!L2.length){ $("vErr").textContent="Type at least one value."; return; }
    const rows=[];
    L2.forEach(([tab,v])=>{ const u=M.units.find(x=>x.tab===tab); if(!u) return; v=Number(v);
      const H=M.hold.filter(x=>x.tab===tab);
      if(H.length){ const tot=SUM(H,x=>x.cur)||1, k=Math.max(0,v-Math.max(0,u.cash||0))/tot;
        H.forEach(x=>rows.push({date:M.today,who:u.who,acct:u.acct,asset:x.asset,type:"Value",name:x.name,code:x.isin||"",qty:Math.round(x.qty*10000)/10000,price:Math.round(x.px*k*100)/100,amt:Math.round(x.cur*k*100)/100,note:"From the account total you typed"})); }
      else { const t=u.T[0]||{}; rows.push({date:M.today,who:u.who,acct:u.acct,asset:t.asset||"NPS",type:"Value",name:t.name||"Value",amt:v,note:"Value typed in Artha"}); } });
    for(let i=0;i<rows.length;i+=40) OUT.push({kind:"add",rows:rows.slice(i,i+40),rid:rid()});
    saveOut(); ov.back(); refresh(); showToast(`Saved ${L2.length} value${L2.length>1?"s":""}`); flush(); }; }
/* ---------- files → Drive, and the Claude inbox ---------- */
function pickFiles(accept,cb,multi){ const fi=$("fileIn"); fi.accept=accept; fi.multiple=multi!==false; fi.value=""; fi.onchange=()=>{ const F=[...fi.files]; if(F.length) cb(F); }; fi.click(); }
function fileB64(f){ return new Promise((ok,bad)=>{
  const read=blob=>{ const r=new FileReader(); r.onload=()=>ok({b64:String(r.result).split(",")[1],mime:blob.type||f.type||"application/octet-stream"}); r.onerror=()=>bad(new Error("Couldn't read "+f.name)); r.readAsDataURL(blob); };
  if(/^image\//.test(f.type)&&f.size>1200000){ const img=new Image(), u=URL.createObjectURL(f); img.onload=()=>{ const k=Math.min(1,2200/Math.max(img.width,img.height)), c=document.createElement("canvas"); c.width=Math.round(img.width*k); c.height=Math.round(img.height*k);
      c.getContext("2d").drawImage(img,0,0,c.width,c.height); URL.revokeObjectURL(u); c.toBlob(b=>read(b||f),"image/jpeg",.88); }; img.onerror=()=>read(f); img.src=u; }
  else read(f); }); }
const extOf=(f,mime)=>{ const m=/\.(\w{2,5})$/.exec(f.name||""); return m?m[1].toLowerCase():/pdf/.test(mime)?"pdf":/png/.test(mime)?"png":"jpg"; };
async function uploadFiles(files,path,nameFn){ if(!navigator.onLine) throw new Error("You're offline. Uploads need the internet.");
  if(!M.v3) throw new Error("Update the Artha backend first (paste the new Code.gs and redeploy).");
  const out=[]; for(let i=0;i<files.length;i++){ const f=files[i]; busy(`Uploading ${i+1} of ${files.length}…`); const {b64,mime}=await fileB64(f);
    const name=nameFn?nameFn(f,i,mime):(f.name||("file-"+(i+1)+"."+extOf(f,mime)));
    const r=await call("upload",{e:{name,mime,b64,path}}); out.push({id:r.file.id,name:r.file.name,url:r.file.url,mime:r.file.mime,size:r.file.size,at:M.today}); }
  return out; }
function busy(msg){ openE(`<div class="t big"><span class="spinr"></span> ${esc(msg)}</div><div class="s" style="text-align:left">Keep Artha open until this finishes.</div>`); }
const ibId=()=>"ib-"+rid();
async function sendInbox(kind,ctx,files,title,already){
  try{ const id=ibId(), up=already||await uploadFiles(files,kind==="bond"?"Inbox/Bonds":"Inbox/Documents",(f,i,mime)=>`${kind}-${M.today}-${id.slice(3,9)}-${i+1}.${extOf(f,mime)}`);
    const brief={id,kind,title,created:M.today,context:ctx,files:up.map(f=>({id:f.id,name:f.name,mime:f.mime})),answer_as:"artha-result-"+id+".json (see the project doc claude/artha-inbox.md)"};
    busy("Handing over to Claude…");
    await call("upload",{e:{name:`artha-inbox-${id}-context.txt`,mime:"text/plain",b64:btoa(unescape(encodeURIComponent(JSON.stringify(brief,null,1)))),path:"Inbox"}});
    OUT.push({kind:"rec",ops:[{id,kind:"inbox",title,data:{kind,title,ctx,files:up,status:"new",at:new Date().toISOString().slice(0,16)}}],rid:rid()}); saveOut(); refresh(); flush();
    openE(`<div class="t big">${svgI("spark","var(--neon2)",20)} Ready for Claude</div><div class="s" style="text-align:left">${esc(title)} · ${up.length} file${up.length>1?"s":""} saved to Drive. Tap Process now, then send the message that's already copied. When Claude is done, it shows up in the bell to review.</div>
      <button class="go" type="button" id="pNow">Process now</button><button class="x" type="button" data-close>Later</button>`); $("pNow").onclick=processNow; return id;
  }catch(x){ openE(`<div class="t big">Couldn't upload</div><div class="s">${esc(x.message||x)}</div>${closeBtn}`); return null; } }
function processNow(){ const n=recs("inbox").filter(r=>r.d.status==="new").length, msg=`Process my Artha inbox (${n||1} item${n>1?"s":""} waiting).`;
  try{ navigator.clipboard&&navigator.clipboard.writeText(msg); }catch(e){}
  showToast("Copied: “"+msg+"” — paste it in the new chat",5000); setTimeout(()=>window.open(PROJECT_URL(),"_blank","noopener"),350); }
function inboxRow(r){ const d=r.d, ready=d.status==="ready";
  return `<button class="hl" data-ib="${esc(r.id)}"><span class="av" style="background:linear-gradient(135deg,var(--neon2),var(--neon))">${svgI(d.kind==="bond"?"bond":d.kind==="charges"?"stocks":d.kind==="tds"?"check":"file","#04110f",20)}</span><div style="min-width:0"><div class="n">${esc(d.title||"Document")}</div><div class="m">${(d.files||[]).length} file${(d.files||[]).length===1?"":"s"} · ${esc(String(d.at||"").slice(0,10))}</div></div><div class="r"><small><span class="tag ${ready?"neo":"due"}">${ready?"Review":"Waiting"}</span></small></div></button>`; }
function openInboxItem(id){ const r=M.rec.get(id); if(!r) return; const d=r.d;
  if(d.status==="ready"){ if(d.kind==="bond") return reviewBond(r); if(d.kind==="entry") return reviewEntry(r); if(d.kind==="charges") return reviewCharges(r); if(d.kind==="tds") return reviewTds(r); return reviewPolicy(r); }
  openE(`<div class="t big">${esc(d.title)}</div><div class="s" style="text-align:left">Waiting for Claude to read ${(d.files||[]).length} file${(d.files||[]).length===1?"":"s"}.</div>
    <div class="list" style="padding:0 14px">${(d.files||[]).map(f=>`<a class="doc" href="${esc(safeUrl(f.url))}" target="_blank" rel="noopener noreferrer">${svgI("file","var(--neon)")}<span>${esc(f.name)}</span></a>`).join("")}</div>
    <button class="go" type="button" id="iNow">Process now</button><div class="btns"><button class="x" type="button" id="iDel">Remove from inbox</button>${closeBtn}</div>`);
  $("iNow").onclick=processNow; $("iDel").onclick=()=>{ inboxDone(id,"removed"); ov.back(); refresh(); }; }
function inboxDone(id,st){ const r=M.rec.get(id); if(!r) return; OUT.push({kind:"rec",ops:[{id,kind:"inbox",title:r.d.title,data:Object.assign({},r.d,{status:st||"done",doneAt:M.today})}],rid:rid()}); saveOut(); flush(); }

/* bond read from screenshots → review → saved with its repayment schedule */
function reviewBond(r){ const d=r.d, x=d.res||{}, c=d.ctx||{}, S=(x.sched||[]).map(e=>({d:e.d,p:+e.p||0,i:+e.i||0})).filter(e=>/^\d{4}-\d{2}-\d{2}$/.test(e.d)).sort((a,b)=>a.d<b.d?-1:1);
  const amt=+x.amount||+c.amount||0, P=SUM(S,e=>e.p), I=SUM(S,e=>e.i), gain=(P+I)-amt;
  openE(`<div class="t big">${svgI("spark","var(--neon2)",20)} Check what Claude read</div>
    <label class="fld"><span>Bond name</span><input id="bN" value="${esc(x.name||c.name||"")}"></label>
    <div class="btns"><label class="fld"><span>Invested (₹)</span><input id="bA" inputmode="numeric" value="${amt||""}" ${c.existing?"disabled":""}></label><label class="fld"><span>On</span><input id="bD" type="date" value="${esc(x.investedOn||c.date||M.today)}" ${c.existing?"disabled":""}></label></div>
    ${dl([["Platform",esc(x.platform||c.platform||"—")],x.rate?["Rate",esc(x.rate)]:null,x.bondId?["Bond ID",esc(x.bondId)]:null,["Repayments",String(S.length)],["Principal back",money(P,false)],["Interest (before TDS)",money(I,false)],["Expected gain",`<span class="${cls(gain)}">${smoney(gain)}</span>`],["TDS at 10% of interest",money(I*.1,false)]])}
    <div class="list" style="max-height:34vh">${S.map(e=>`<div class="hl"><span class="av" style="background:${CLS.Bonds.col};color:#111">${dOf(e.d).getDate()}</span><div><div class="n">${fmtD(e.d)}</div><div class="m">Principal ${esc(rs(e.p,false))} · interest ${esc(rs(e.i,false))}</div></div><div class="r"><b class="num">${money(e.p+e.i,true)}</b></div></div>`).join("")||`<div class="empty">No dates were found. Remove this and try clearer screenshots.</div>`}</div>
    ${x.notes?`<div class="s" style="text-align:left">${esc(x.notes)}</div>`:""}${remindSeg("bRem",remindPref(),"Remind me on the repayment dates")}<div class="err" id="bErr"></div>
    <button class="go" type="button" id="bOk">${c.existing?"Save this schedule":"Save the bond"}</button><div class="btns"><button class="x" type="button" id="bDel">Discard</button>${closeBtn}</div>`);
  let rem=remindPref(); bindRemind("bRem",v=>rem=v);
  $("bDel").onclick=()=>{ inboxDone(r.id,"removed"); ov.back(); refresh(); };
  $("bOk").onclick=()=>{ const name=$("bN").value.trim(), A=numIn($("bA").value), D=$("bD").value;
    if(!name){ $("bErr").textContent="Type the bond's name."; return; } if(!S.length){ $("bErr").textContent="There are no repayment dates to save."; return; }
    const acct=c.acct||c.cat||"Wint · Aditya", key=c.existing?c.bondKey:acct+"|"+name;
    if(!c.existing){ if(!(A>0)){ $("bErr").textContent="Type the amount invested."; return; }
      OUT.push({kind:"add",rows:[{date:D,who:c.who||"Aditya",acct,asset:"Bonds",type:"Buy",name,code:x.bondId||"",amt:A,via:"Bank",note:x.rate?String(x.rate):""}],rid:rid()}); }
    OUT.push({kind:"rec",ops:[{id:"bond:"+key,kind:"bond",title:name,data:{sched:S,rate:x.rate||"",bondId:x.bondId||"",acct,who:c.who||"Aditya",name,platform:platOf(acct),src:"Claude · screenshots "+M.today,gain:Math.round(gain),remind:rem}}],rid:rid()});
    if(rem==="cal") queueCal(bondCal(key,name,acct,S.map(e=>({d:e.d,a:e.p+e.i}))));
    inboxDone(r.id); saveOut(); ov.back(); refresh(); flush(); showToast(`${name} saved with ${S.length} repayment dates`); }; }

/* ---------- Other investments: one row per item ---------- */
function othItems(who){ return [].concat(...M.units.filter(u=>u.h==="Other"&&okWho(u.who,who)).map(u=>othItemsOf(u,M.rec,M.today).map(it=>Object.assign(it,{unitV:u.V.length?u:null})))); }
function itemsBody(){ const L=othItems(WHO).sort((a,b)=>b.cur-a.cur);
  if(!L.length) return `<div class="emptyc">${svgI("other","var(--neon)")}<b>Nothing here yet</b><p>Add PPF, post office schemes, P2P, gold, chit funds or anything else with + → Other.</p></div>`;
  return `<div class="grp">${L.map(it=>{ const g=it.cur-(it.put-it.back); return `<div class="hl"><span class="av" style="background:${avColor(it.name)}">${esc(initials(it.name))}</span><div style="min-width:0"><div class="n">${esc(it.name)}</div><div class="m">${esc(it.acct)} · since ${fmtDs(it.first)}${it.rate?` · ${it.rate}% a year`:it.unitV?" · your value":" · at cost"}${it.end?` · till ${fmtDs(it.end)}`:it.rate?" · till withdrawn":""}</div></div><div class="r"><b class="num">${money(it.cur,true)}</b><small class="${cls(g)}">${it.rate?smoney(g,true):money(it.put-it.back,true)+" in"}</small></div></div>`; }).join("")}</div>
    <p class="hint">Rate-based items grow by their rate every day. Others show what you put in until you update the value. Fixed-date items live under Bonds & FDs with payout reminders.</p>`; }

/* ---------- charges: what the ledger holds vs. Groww's own statement, per financial year ---------- */
const fyL=fy=>`FY ${fy}-${String(+fy+1).slice(2)}`;
const fyEnd=fy=>`${+fy+1}-03-31`;
function chargeYears(who){ const m=new Map();
  M.tx.filter(t=>t.type==="Charges"&&t.date&&okWho(t.who,who)).forEach(t=>{ const fy=t.fy?+t.fy:fyOf(t.date), k=t.acct+"|"+fy; let x=m.get(k);
    if(!x){ x={k,acct:t.acct,who:t.who,fy,tot:0,est:0,n:0,adj:null}; m.set(k,x); }
    x.tot+=t.show; x.n++; if(/estimated/i.test(t.note||"")) x.est+=t.show; if(t.fy) x.adj=t; });
  for(const x of m.values()){ const R=M.rec.get("chg:"+x.k); x.rec=R?R.d:null; x.ended=M.today>fyEnd(x.fy); x.open=x.est>0&&!x.rec; }
  return [...m.values()].sort((a,b)=>b.fy-a.fy||a.acct.localeCompare(b.acct)); }
const CHL=[["brokerage","Brokerage"],["stt","STT"],["exchange","Exchange"],["sebi","SEBI"],["stamp","Stamp duty"],["gst","GST"],["dp","DP charges"],["ipft","IPFT"],["other","Other"]];
function chargesBody(){ const Y=chargeYears(WHO), tot=SUM(Y,x=>x.tot);
  return `<div class="gh"><span>Brokerage, taxes and fees</span><b class="num">${money(tot,true)}</b></div>`
    +(Y.length?Y.map(x=>`<div class="fyrow"><span class="k">${fyL(x.fy)} · ${esc(x.acct)}</span><b>${money(x.tot,false)}</b>
      <span class="m">${x.rec?`<span class="tag neo">Reconciled</span> with Groww statement · ${esc(x.rec.at||"")}`:x.est?`<span class="tag due">Estimated ${esc(rs(x.est,false))}</span> · upload the ${fyL(x.fy)} statements to make it exact`:`From Groww's ledger · ${x.n} entries`}</span>
      ${x.rec&&x.rec.items?`<div class="brk">${CHL.filter(([k])=>+x.rec.items[k]).map(([k,l])=>`<span>${l}<b>${esc(rs(+x.rec.items[k],false))}</b></span>`).join("")}</div>`:""}</div>`).join(""):`<div class="empty">No charges recorded yet.</div>`)
    +`<button class="ai" data-act="chg-up">${svgI("spark","var(--neon2)")}<span><b>Reconcile with Groww statements</b><small>Upload the FY's Stocks P&L report and ledger statement · Claude works out the exact charges</small></span></button>
    <p class="hint">New trades use Groww's published rates as an estimate; the statement replaces that with the real figure for the year (one adjusting entry per year).</p>`
    +`<div class="gh" style="margin-top:18px"><span>Every charge</span></div>`+yearList(byNewest(M.tx.filter(t=>t.type==="Charges"&&t.date&&okWho(t.who,WHO))),"c",null); }
/* ---------- broker balance ledger: every rupee in and out of the Groww balance, with a running total ---------- */
const BALSG={"Add money":1,"Sell":1,"Redeem":1,"Dividend":1,"Other income":1,"F&O result":1,"Withdraw":-1,"Buy":-1,"Charges":-1};
function balLedger(u){ const seen=new Set(), L=[];
  M.tx.forEach(t=>{ const r=t.src; if(t.internal||!r||seen.has(t.id)||r.acct!==u.acct||r.who!==u.who) return;
    if(!(r.via==="Balance"||r.asset==="Cash"||r.asset==="F&O")) return; const sg=BALSG[r.type]||0; if(!sg||!r.amount) return; seen.add(t.id); L.push({t,v:sg*r.amount}); });
  L.sort((a,b)=>(a.t.date||"")<(b.t.date||"")?-1:(a.t.date||"")>(b.t.date||"")?1:a.t.i-b.t.i); let b=0; L.forEach(x=>{ b+=x.v; x.b=r2(b); }); return L; }
const balUnits0=()=>(M.units||[]).filter(u=>u.h==="Stocks").map(u=>({u,L:balLedger(u)})).filter(x=>x.L.length);
const balUnits=()=>(M.units||[]).filter(u=>u.h==="Stocks"&&(WHO==="all"||u.who===WHO)).map(u=>({u,L:balLedger(u)})).filter(x=>x.L.length);
function balTitle(t){ const r=t.src, n=r.name?" "+r.name:"", bal=/\[bal\]/.test(r.note||"");
  if(bal) return "Balance corrected";
  return {"Add money":"Added from bank"+(t.bank?" · "+t.bank:""),"Withdraw":"Taken out to bank"+(t.bank?" · "+t.bank:""),"Buy":(r.asset==="Mutual Funds"?"Fund bought":"Bought")+n,"Sell":"Sold"+n,"Redeem":"Redeemed"+n,
    "Charges":r.note&&/\[fy /.test(r.note)?"Charges · exact for the year":"Charges"+(/buy |sale /.test(r.note||"")?" · "+(r.note.split(" · ").pop()):""),"Dividend":"Dividend"+n,"Other income":"Other income"+n,"F&O result":"F&O result"}[r.type]||r.type; }
function balanceBody(){ const X=balUnits();
  if(!X.length) return `<div class="empty">No money in or out of a broker balance yet.</div>`;
  return X.map(({u,L},ui)=>{ const R=L.slice().reverse(), show=SC.balAll?R:R.slice(0,40), cur=L[L.length-1].b, k=u.acct+"|"+u.who;
    return `<div class="balc"><div class="l">${esc(u.acct)}${u.who!==holderOf(u.acct)?` · ${esc(u.who)}'s money`:""}</div><div class="v num ${cur<0?"loss":""}">${money(cur,false)}</div>
      <div class="s">Cash in the balance by Artha's count · charges on new trades are estimates</div><button class="btn2" data-act="bal-fix" data-u="${esc(k)}">Correct to ${esc(platOf(u.acct)||"the app")}'s figure</button></div>
      <div class="grp">${show.map(({t,v,b})=>`<button class="tx" data-tx="${t.i}"><span class="n">${esc(balTitle(t))}</span><span class="amt num ${v<0?"loss":""}">${v<0?"−":"+"}${money(Math.abs(v),false)}</span>
        <span class="m"><span>${esc(fmtDs(t.date))}${t.trade?" · "+esc(qtyf(t.trade.qty)+" @ "+rsx(t.trade.price)):""}</span><span class="num">Balance ${money(b,false)}</span>${t.pending?`<span class="chip sync">Syncing…</span>`:""}</span></button>`).join("")}</div>
      ${R.length>show.length?`<button class="more" data-act="bal-all">Show all ${R.length} entries ›</button>`:""}`; }).join("")
    +`<p class="hint">Tap an entry to edit or delete it</p>`; }
function fixBalance(k){ const x=balUnits().find(y=>y.u.acct+"|"+y.u.who===k)||balUnits()[0]; if(!x) return; const {u,L}=x, cur=L[L.length-1].b, pl=platOf(u.acct)||"the app";
  openE(`<div class="t big">Correct the ${esc(platOf(u.acct)||"broker")} balance</div><div class="s" style="text-align:left">${esc(u.acct)} · ${esc(u.who)}'s money<br>Artha's count today: <b>${esc(rs(cur,false))}</b></div>
    <label class="fld"><span>Balance ${esc(platOf(u.acct)||"the app")} shows right now ₹</span><input id="bAct" inputmode="decimal" autocomplete="off" placeholder="e.g. 869.40"></label>
    <div class="s" id="bDiff" style="text-align:left">The difference is saved as one dated entry (a charges adjustment if Groww shows less), so the history stays intact and the year-end statement upload still squares it.</div>
    <button class="go" type="button" id="bOk" disabled>Save correction</button>${closeBtn}`);
  const inp=$("bAct"), go=$("bOk"); setTimeout(()=>inp.focus(),60);
  const diffOf=()=>{ const a=numIn(inp.value); return inp.value.trim()===""||isNaN(a)?null:r2(cur-a); };
  inp.oninput=()=>{ const d=diffOf(); go.disabled=d==null||Math.abs(d)<.01;
    $("bDiff").innerHTML=d==null?"Enter what Groww shows.":Math.abs(d)<.01?"Matches — nothing to correct.":d>0?`${esc(pl)} has <b>${esc(rs(d,false))}</b> less. Saved as a charges adjustment of ${esc(rs(d,false))} today.`:`${esc(pl)} has <b>${esc(rs(-d,false))}</b> more. Saved as other income of ${esc(rs(-d,false))} today.`; };
  go.onclick=()=>{ const d=diffOf(); if(d==null||Math.abs(d)<.01) return; const a=r2(cur-d);
    OUT.push({kind:"add",rows:[{date:M.today,who:u.who,acct:u.acct,asset:"Cash",type:d>0?"Charges":"Other income",name:"",code:"",qty:"",price:"",amt:Math.abs(d),via:"Balance",note:`[bal] Balance set to ${rs(a,false)} as shown in ${pl} (was ${rs(cur,false)} in Artha)`}],rid:rid()});
    saveOut(); ov.back(); refresh(); flush(); celebrate("Balance corrected",`${u.acct} · now ${rs(a,false)}`); }; }
function chargesUpload(pre){ const accts=M.accts.filter(a=>/groww/i.test(a)); const Y=chargeYears("all"); const fys=[...new Set([fyOf(M.today)].concat(Y.map(x=>x.fy)))].sort((a,b)=>b-a);
  let acct=pre&&pre.acct||accts[0]||"Groww · Aditya", fy=pre&&pre.fy||(Y.find(x=>x.open)||{}).fy||fyOf(M.today)-1;
  const draw=()=>{ openE(`<div class="t big">${svgI("spark","var(--neon2)",20)} Exact charges for a year</div>
    <div class="fld"><span>Account</span><div class="seg sm wrap" id="cA">${accts.map(a=>`<button type="button" data-v="${esc(a)}" aria-pressed="${a===acct}">${esc(a)}</button>`).join("")}</div></div>
    <div class="fld"><span>Financial year</span><div class="seg sm wrap" id="cF">${fys.map(f=>`<button type="button" data-v="${f}" aria-pressed="${+f===+fy}">${fyL(f)}</button>`).join("")}</div></div>
    <div class="s" style="text-align:left">From Groww (web: Profile › Reports) for <b>${fyL(fy)}</b>, upload both:<br>1. <b>Stocks P&L report</b> — totals for brokerage, STT, exchange, SEBI, stamp duty, GST.<br>2. <b>Ledger statement</b> — DP charges and their dates.<br>PDF, Excel or screenshots all work. More files are fine.</div>
    <button class="go" type="button" id="cGo">Choose files</button>${closeBtn}`);
    $("eBox").querySelectorAll("#cA [data-v]").forEach(b=>b.onclick=()=>{ acct=b.dataset.v; draw(); });
    $("eBox").querySelectorAll("#cF [data-v]").forEach(b=>b.onclick=()=>{ fy=+b.dataset.v; draw(); });
    $("cGo").onclick=()=>pickFiles("application/pdf,image/*,.xlsx,.xls,.csv",files=>{ const x=Y.find(y=>y.acct===acct&&+y.fy===+fy), owner=(M.tx.find(t=>t.acct===acct&&t.trade)||{}).who||holderOf(acct);
      sendInbox("charges",{acct,who:owner,fy:+fy,fyLabel:fyL(fy),from:`${fy}-04-01`,to:fyEnd(fy),recorded:x?r2(x.tot):0,estimated:x?r2(x.est):0},files,`Charges · ${acct} · ${fyL(fy)}`); }); };
  draw(); }
function reviewCharges(r){ const d=r.d, x=d.res||{}, c=d.ctx||{}, acct=x.acct||c.acct, who=c.who||holderOf(acct);
  const F=(x.fys||[]).map(f=>({...f,fy:+f.fy,total:+f.total||SUM(CHL,([k])=>+f[k]||0)})).filter(f=>f.fy>2000);
  const rows=F.map(f=>{ const have=SUM(M.tx.filter(t=>t.type==="Charges"&&t.acct===acct&&t.date&&(t.fy?+t.fy:fyOf(t.date))===f.fy&&!t.fy),t=>t.show), adj=M.tx.find(t=>t.type==="Charges"&&t.acct===acct&&+t.fy===f.fy);
    return {f,have:r2(have),diff:r2(f.total-have),adj}; });
  openE(`<div class="t big">${svgI("spark","var(--neon2)",20)} Charges Claude found</div><div class="s" style="text-align:left">${esc(acct)} · ${esc(who)}'s money</div>
    ${rows.map(({f,have,diff})=>`<div class="fyrow"><span class="k">${fyL(f.fy)}</span><b>${esc(rs(f.total,false))}</b><div class="brk">${CHL.filter(([k])=>+f[k]).map(([k,l])=>`<span>${l}<b>${esc(rs(+f[k],false))}</b></span>`).join("")}</div>
      <span class="m">Recorded so far ${esc(rs(have,false))} · ${Math.abs(diff)<.01?"matches":`one adjusting entry of ${esc((diff>0?"+":"−")+rs(Math.abs(diff),false))}`}</span></div>`).join("")||`<div class="empty">No yearly totals were found. Discard and upload the P&L report.</div>`}
    ${x.notes?`<div class="s" style="text-align:left">${esc(x.notes)}</div>`:""}
    <button class="go" type="button" id="kOk" ${rows.length?"":"disabled"}>Save exact charges</button><div class="btns"><button class="x" type="button" id="kDel">Discard</button>${closeBtn}</div>`);
  $("kDel").onclick=()=>{ inboxDone(r.id,"removed"); ov.back(); refresh(); };
  $("kOk").onclick=()=>{ const add=[], recs2=[];
    rows.forEach(({f,diff,adj})=>{ const date=fyEnd(f.fy)<M.today?fyEnd(f.fy):M.today, note=`Reconciled with Groww statement ${fyL(f.fy)} (total ${rs(f.total,false)}) [fy ${f.fy}]`;
      const row={date,who,acct,asset:"Cash",type:"Charges",name:"",code:"",qty:"",price:"",amt:diff,via:"Balance",note};
      if(adj) OUT.push({kind:"edit",id:adj.id,row,rid:rid()}); else if(Math.abs(diff)>=.01) add.push(row);
      const items={}; CHL.forEach(([k])=>{ if(+f[k]) items[k]=r2(+f[k]); });
      recs2.push({id:"chg:"+acct+"|"+f.fy,kind:"chg",title:`${acct} ${fyL(f.fy)}`,data:{acct,who,fy:f.fy,items,total:r2(f.total),at:M.today,src:"Claude · Groww statements"}}); });
    if(add.length) OUT.push({kind:"add",rows:add,rid:rid()}); if(recs2.length) OUT.push({kind:"rec",ops:recs2,rid:rid()});
    inboxDone(r.id); saveOut(); ov.back(); refresh(); flush(); celebrate("Charges reconciled",`${rows.length} year${rows.length>1?"s":""} · ${acct}`); }; }

/* ---------- TDS: counted as your earning (payouts are recorded gross), then checked against 26AS / AIS after the year ---------- */
function tdsYears(who){ const m=new Map();
  M.tx.filter(t=>t.a==="Bonds"&&t.type==="Payout"&&t.tds>0&&t.date).forEach(t=>{ const person=holderOf(t.acct); if(who&&who!=="all"&&person!==who&&t.who!==who) return;
    const fy=fyOf(t.date), k=fy+"|"+person; let x=m.get(k); if(!x){ x={k,fy,person,tds:0,gross:0,n:0,by:new Map()}; m.set(k,x); }
    x.tds+=t.tds; x.gross+=t.show; x.n++; const nm=t.name||t.p0; const b=x.by.get(nm)||{name:nm,plat:t.p0,tds:0,gross:0,n:0}; b.tds+=t.tds; b.gross+=t.show; b.n++; x.by.set(nm,b); });
  for(const x of m.values()){ x.tds=r2(x.tds); x.list=[...x.by.values()].map(b=>({...b,tds:r2(b.tds),gross:r2(b.gross)})); const R=M.rec.get("tds:"+x.k); x.rec=R?R.d:null;
    x.from=`${x.fy+1}-06-15`; x.due=!x.rec&&M.today>=x.from; x.status=x.rec?x.rec.status:M.today>fyEnd(x.fy)?"due":"open"; }
  return [...m.values()].sort((a,b)=>b.fy-a.fy||a.person.localeCompare(b.person)); }
function tdsBody(){ const Y=tdsYears(WHO);
  return `<div class="gh"><span>TDS deducted · counted in your gain</span><b class="num">${money(SUM(Y,x=>x.tds),true)}</b></div>`
    +(Y.length?Y.map(x=>`<div class="fyrow"><span class="k">${fyL(x.fy)} · ${esc(x.person)}'s PAN</span><b>${money(x.tds,false)}</b>
      <span class="m">${x.status==="verified"?`<span class="tag neo">Matches 26AS</span> · checked ${esc(x.rec.at||"")}`:x.status==="mismatch"?`<span class="tag bad">Differs from 26AS</span> · ${esc(x.rec.note||"")}`:x.status==="due"?(x.due?`<span class="tag due">Verify now</span> in 26AS / AIS`:`Verify from ${fmtD(x.from)} (TDS returns settle by then)`):"Year still running"} · on ${esc(rs(x.gross,false))} paid out</span>
      <div class="brk">${x.list.map(b=>`<span>${esc(b.name)}<b>${esc(rs(b.tds,false))}</b></span>`).join("")}</div>
      ${x.status!=="open"?`<button class="addr" data-tds="${x.fy}|${esc(x.person)}" style="grid-column:1/-1;justify-self:start">${x.rec?"Check again":"Verify with 26AS / AIS"} ›</button>`:""}</div>`).join(""):`<div class="empty">No TDS on payouts yet.</div>`)
    +`<p class="hint">Bond and FD payouts are saved gross: the TDS is your income already paid as tax, so it counts in your gain. After each year, match it with Form 26AS / AIS before filing your return so you can claim it.</p>`; }
function tdsUpload(fy,person){ const x=tdsYears("all").find(y=>y.fy===+fy&&y.person===person); if(!x) return;
  openE(`<div class="t big">${svgI("spark","var(--neon2)",20)} Verify TDS · ${fyL(fy)}</div>
    ${dl([["PAN holder",esc(person)],["TDS in Artha",money(x.tds,false)],["Payouts",String(x.n)]])}
    <div class="s" style="text-align:left">On incometax.gov.in (${esc(person)}'s login): e-File › Income Tax Returns › <b>View Form 26AS</b> (or <b>AIS</b>) for assessment year ${+fy+1}-${String(+fy+2).slice(2)}. Download the PDF or take screenshots of the TDS part (Part A).<br>The 26AS PDF is locked with the date of birth (DDMMYYYY); open it once and save an unlocked copy, or use screenshots.</div>
    <button class="go" type="button" id="tGo">Choose files</button>${closeBtn}`);
  $("tGo").onclick=()=>pickFiles("application/pdf,image/*",files=>sendInbox("tds",{fy:+fy,fyLabel:fyL(fy),ay:`${+fy+1}-${String(+fy+2).slice(2)}`,person,total:x.tds,expected:x.list.map(b=>({name:b.name,platform:b.plat,tds:b.tds,gross:b.gross,payouts:b.n}))},files,`TDS check · ${person} · ${fyL(fy)}`)); }
const nameHit=(a,b)=>{ const A2=keyName(a).split(" ").filter(w=>w.length>2), B2=keyName(b); return A2.some(w=>B2.includes(w)); };
function reviewTds(r){ const d=r.d, x=d.res||{}, c=d.ctx||{}, E=(c.expected||[]), F=(x.entries||[]).map(e=>({...e,tds:+e.tds||0,paid:+e.paid||0}));
  const rows=E.map(e=>{ const hits=F.filter(f=>nameHit(e.name,f.deductor||"")||nameHit(f.deductor||"",e.name)); return {e,found:r2(SUM(hits,f=>f.tds)),hits}; });
  const found=r2(SUM(rows,y=>y.found)), extra=F.filter(f=>!rows.some(y=>y.hits.includes(f))), diff=r2(found-(+c.total||0)), ok=Math.abs(diff)<=1;
  openE(`<div class="t big">${svgI("spark","var(--neon2)",20)} TDS · ${esc(c.fyLabel||"")} · ${esc(c.person||"")}</div>
    <div class="list">${rows.map(y=>`<div class="hl"><span class="av" style="background:${Math.abs(y.found-y.e.tds)<=1?"var(--ok)":"var(--accent)"};color:#111">${Math.abs(y.found-y.e.tds)<=1?"✓":"!"}</span><div style="min-width:0"><div class="n">${esc(y.e.name)}</div><div class="m">Artha ${esc(rs(y.e.tds,false))} · 26AS ${esc(rs(y.found,false))}</div></div></div>`).join("")}</div>
    ${extra.length?`<div class="gh"><span>Also in 26AS (not from these payouts)</span><b class="num">${extra.length}</b></div><div class="list">${extra.slice(0,12).map(f=>`<div class="hl"><div style="min-width:0"><div class="n">${esc(f.deductor||"Deductor")}</div><div class="m">${esc(f.section||"")} · paid ${esc(rs(f.paid,false))}</div></div><div class="r"><b class="num">${esc(rs(f.tds,false))}</b></div></div>`).join("")}</div>`:""}
    ${dl([["TDS in Artha",money(+c.total||0,false)],["Matched in 26AS",money(found,false)],["Difference",`<span class="${ok?"gain":"loss"}">${smoney(diff)}</span>`]])}
    ${x.notes?`<div class="s" style="text-align:left">${esc(x.notes)}</div>`:""}
    <button class="go" type="button" id="tOk">${ok?"Mark as verified":"Save as a difference to follow up"}</button><div class="btns"><button class="x" type="button" id="tDel">Discard</button>${closeBtn}</div>`);
  $("tDel").onclick=()=>{ inboxDone(r.id,"removed"); ov.back(); refresh(); };
  $("tOk").onclick=()=>{ OUT.push({kind:"rec",ops:[{id:`tds:${c.fy}|${c.person}`,kind:"tds",title:`TDS ${c.fyLabel} ${c.person}`,data:{fy:c.fy,person:c.person,status:ok?"verified":"mismatch",found,expected:+c.total||0,diff,note:ok?"":`26AS shows ${rs(found,false)} vs ${rs(+c.total||0,false)} in Artha`,at:M.today,entries:F.slice(0,60)}}],rid:rid()});
    inboxDone(r.id); saveOut(); ov.back(); refresh(); flush(); if(ok) celebrate("TDS verified",`${c.fyLabel} · ${c.person} · ${rs(found,false)}`); else showToast("Saved. Follow up with the deductor for the difference.",4000); }; }

/* ---------- any entry read from a document ---------- */
const OKTYPE=new Set(["Add money","Withdraw","Buy","Sell","Bonus","Redeem","Payout","Dividend","Other income","Charges","Premium","Value"]);
function reviewEntry(r){ const d=r.d, x=d.res||{}, c=d.ctx||{};
  const R=(x.rows||[]).map(e=>({date:e.date||c.date,who:e.who||c.who,acct:e.acct||c.acct,asset:e.asset||typeOf(c.type||"stocks")[3],type:e.type,name:e.name||c.name||"",code:e.code||"",qty:+e.qty||"",price:+e.price||"",amt:+e.amt||+e.amount||0,via:e.via||(c.via==="Balance"?"Balance":"Bank"),note:((e.note||"")+bankTag(e.bank||c.bank||"")).trim()}))
    .filter(e=>/^\d{4}-\d{2}-\d{2}$/.test(e.date)&&OKTYPE.has(e.type)&&e.acct);
  openE(`<div class="t big">${svgI("spark","var(--neon2)",20)} Check what Claude read</div><div class="s" style="text-align:left">${esc(d.title||"")}</div>
    <div class="list">${R.map(e=>`<div class="hl"><span class="av" style="background:${TCOL[c.type]||"var(--neon)"};color:#111">${dOf(e.date).getDate()}</span><div style="min-width:0"><div class="n">${esc(e.type)}${e.name?" · "+esc(e.name):""}</div><div class="m">${fmtD(e.date)} · ${esc(e.who)} · ${esc(e.acct)}${e.qty?` · ${qtyf(e.qty)} @ ₹${e.price}`:""}${BANK_RE.test(e.note)?" · "+esc(BANK_RE.exec(e.note)[1]):""}</div></div><div class="r"><b class="num">${money(e.amt,false)}</b></div></div>`).join("")||`<div class="empty">Nothing usable was found. Discard and add it by hand.</div>`}</div>
    ${x.notes?`<div class="s" style="text-align:left">${esc(x.notes)}</div>`:""}
    <button class="go" type="button" id="eOk" ${R.length?"":"disabled"}>Save ${R.length} entr${R.length===1?"y":"ies"}</button><div class="btns"><button class="x" type="button" id="eDel">Discard</button>${closeBtn}</div>`);
  $("eDel").onclick=()=>{ inboxDone(r.id,"removed"); ov.back(); refresh(); };
  $("eOk").onclick=()=>{ OUT.push({kind:"add",rows:R,rid:rid()});
    const S=(x.sched||[]).filter(e=>/^\d{4}-\d{2}-\d{2}$/.test(e.d)).map(e=>({d:e.d,p:+e.p||0,i:+e.i||0}));
    if(S.length){ const b=R.find(e=>e.type==="Buy")||R[0]; OUT.push({kind:"rec",ops:[{id:"bond:"+b.acct+"|"+b.name,kind:"bond",title:b.name,data:{sched:S,acct:b.acct,who:b.who,name:b.name,platform:platOf(b.acct),fd:b.asset==="Bonds"?undefined:1,remind:remindPref(),src:"Claude · document "+M.today}}],rid:rid()}); }
    inboxDone(r.id); saveOut(); ov.back(); refresh(); flush(); celebrate("Saved from your document",`${R.length} entr${R.length===1?"y":"ies"} · ${rs(SUM(R,e=>e.amt),false)}`); }; }

/* ---------- INSURANCE ---------- */
const LBL0={ins_title:"Insurance",sec_current:"This year's policy",sec_covered:"What's covered",sec_not:"Not covered",sec_excl:"Exclusions",sec_high:"Key points",sec_extra:"More details",sec_docs:"Documents",sec_hist:"Previous years",sec_prem:"Premiums",
  f_insurer:"Insurer",f_policyNo:"Policy number",f_start:"Starts",f_end:"Ends",f_premium:"Premium",f_insured:"Insured",f_holder:"Policyholder",
  cover_health:"Sum insured",cover_car:"IDV",cover_bike:"IDV",cover_life:"Sum assured",cover_home:"Sum insured",cover_travel:"Cover",cover_other:"Cover",
  t_health:"Health",t_car:"Car",t_bike:"Two-wheeler",t_life:"Life / term",t_home:"Home",t_travel:"Travel",t_other:"Other"};
const EXTRA0={health:["Members covered","Room rent limit","Co-pay","Waiting periods","No-claim bonus","Network hospitals"],car:["Vehicle","Registration no.","NCB","Add-ons","Deductible"],bike:["Vehicle","Registration no.","NCB","Add-ons"],life:["Nominee","Policy term","Premium mode"],home:["Address"],travel:["Trip"],other:[]};
const PTYPES=["health","car","bike","life","home","travel","other"], PICON={health:"health",car:"car",bike:"scooter",life:"life",home:"home",travel:"travel",other:"shield"}, PCOL={health:"#FF6B8B",car:"#5B8CFF",bike:"#35C4F0",life:"#B18CFF",home:"#7BDB5A",travel:"#FFB547",other:"#9AA8B5"};
const labels=()=>{ const r=M&&M.rec.get("labels"); return r?r.d:{}; };
const L=k=>{ const v=(labels().t||{})[k]; return v&&String(v).trim()?v:LBL0[k]||k; };
const extraFor=t=>{ const e=(labels().extra||{})[t]; return Array.isArray(e)?e:EXTRA0[t]||[]; };
/* what a policy looks like from its own words (IDV / registration number = a vehicle, room rent / co-pay = health…); "" when unsure */
function guessPolType(texts){ const t=texts.filter(Boolean).join(" · ").toLowerCase(); if(!t) return "";
  const veh=/\bidv\b|insured declared value|registration n|\bregn?\b|chassis|engine n|own damage|third[- ]party|\bncb\b|no claim bonus|motor (policy|insurance)|\b[a-z]{2}[ -]?\d{1,2}[ -]?[a-z]{1,3}[ -]?\d{4}\b/.test(t);
  if(veh) return /two[- ]?wheeler|scooter|scooty|\bbike\b|motor ?cycle|activa|\bola s1|jupiter|splendor|pulsar|royal enfield/.test(t)?"bike":"car";
  if(/room rent|co-?pay|hospital|mediclaim|cashless|pre-existing|sum insured.*(member|family)|floater/.test(t)) return "health";
  if(/sum assured|death benefit|term (plan|life|insurance)|life cover|nominee.*(death|life)/.test(t)) return "life";
  if(/trip|travel|baggage|passport|schengen/.test(t)) return "travel";
  if(/\bhome\b|building|contents|burglary|householder/.test(t)) return "home";
  return ""; }
const polTexts=p=>{ const a=[p.d.title,p.d.insured]; termsOf(p.id).forEach(t=>{ a.push(t.d.policyNo); Object.entries(t.d.fields||{}).forEach(([k,v])=>a.push(k+" "+v)); (t.d.highlights||[]).slice(0,6).forEach(h=>a.push(h)); }); return a; };
/* policies filed under one type whose own details say another: asked once each in the bell, never changed silently */
const polMisfiled=()=>policies().filter(p=>!p.d.typeOk).map(p=>({p,g:guessPolType(polTexts(p))})).filter(x=>x.g&&x.g!==p_type(x.p)&&!(x.g==="car"&&p_type(x.p)==="bike"&&!/car\b/i.test(x.p.d.title)));
const p_type=p=>PTYPES.includes(p.d.type)?p.d.type:"other";
function setPolType(p,type,ok){ const data=Object.assign({},p.d,ok?{typeOk:M.today}:{type,typeOk:M.today}); OUT.push({kind:"rec",ops:[{id:p.id,kind:"pol",title:p.d.title,data}],rid:rid()}); saveOut(); flush(); refresh(); }
const polIcon=p=>PICON[p.d.type]||"shield", polCol=p=>PCOL[p.d.type]||PCOL.other;
function policies(){ const P=recs("pol").filter(p=>!p.d.archived);
  if(M.term&&M.term.T.length&&!M.rec.has("pol-term")) P.push({id:"pol-term",kind:"pol",synthetic:1,d:{title:"Term life",type:"life",insured:"Aditya",holder:"Aditya",link:"term"}});
  return P; }
function termsOf(pid){ return recs("pterm").filter(t=>t.d.pol===pid).sort((a,b)=>(b.d.start||b.d.created||"")<(a.d.start||a.d.created||"")?-1:1); }
function currentTerm(pid){ const T=termsOf(pid); return T.find(t=>t.d.start&&t.d.start<=M.today&&(!t.d.end||t.d.end>=M.today))||T[0]||null; }
function polEnd(p){ if(p.d.link==="term"){ const np=nextPremium(M.term); return np?np.date:""; } const c=currentTerm(p.id); return c&&c.d.end||""; }
function renewals(n){ return policies().map(p=>{ const end=p.d.link==="term"?"":polEnd(p); return end?{pol:p,end,left:days(M.today,end)}:null; }).filter(x=>x&&x.left<=n).sort((a,b)=>a.left-b.left); }
let INSF=store.get("insf","all");
function dring(left,total,col){ const k=total>0?Math.max(0,Math.min(1,left/total)):0, R=19, C=2*Math.PI*R;
  return `<svg class="dring" viewBox="0 0 46 46"><circle cx="23" cy="23" r="${R}" stroke="rgba(255,255,255,.08)"/><circle cx="23" cy="23" r="${R}" stroke="${col}" stroke-dasharray="${C*k} ${C}" transform="rotate(-90 23 23)" stroke-linecap="round" style="filter:drop-shadow(0 0 4px ${col})"/><text x="23" y="27" text-anchor="middle">${left<0?"!":left>999?"∞":left}</text></svg>`; }
function renderIns(){ const el=$("viewIns"); if(!M) return; const P=policies();
  const rows=P.map(p=>{ const c=p.d.link==="term"?null:currentTerm(p.id), end=polEnd(p), left=end?days(M.today,end):null, total=c&&c.d.start&&c.d.end?days(c.d.start,c.d.end):365;
    return {p,c,end,left,total,cover:c?+c.d.cover||0:0,prem:c?+c.d.premium||0:0}; }).sort((a,b)=>(a.left==null?9e9:a.left)-(b.left==null?9e9:b.left));
  const act=rows.filter(x=>x.left==null||x.left>=0), types=[...new Set(P.map(p=>p.d.type))], F=INSF!=="all"&&types.includes(INSF)?rows.filter(x=>x.p.d.type===INSF):rows;
  const next=act.filter(x=>x.left!=null)[0], termP=M.term?nextPremium(M.term):null;
  const yearly=SUM(act,x=>x.prem)+(termP?termP.amt*2:0);
  let h=`<div class="sumc tilt insHero" style="--c:#B18CFF"><div class="l">${esc(L("ins_title"))} · ${act.length} active</div><div class="v num">${money(SUM(act,x=>x.cover),true)}</div><div class="s">Total cover · not counted in your worth</div>
    <div class="kv3"><div><small>Premiums / yr</small><b class="num">${money(yearly,true)}</b></div><div><small>Next renewal</small><b>${next?fmtDs(next.end):"—"}</b></div><div><small>Policies</small><b>${P.length}</b></div></div></div>`;
  const wait=recs("inbox").filter(r=>r.d.status==="new"&&r.d.kind==="policy").length; if(wait) h+=`<button class="ai" id="insProc">${svgI("spark","var(--neon2)")}<span><b>${wait} document${wait>1?"s":""} waiting for Claude</b><small>Tap to process now</small></span></button>`;
  if(types.length>1) h+=`<div class="chips" id="insChips">${[["all","All"]].concat(types.map(t=>[t,L("t_"+t)])).map(([k,l])=>`<button data-f="${k}" aria-pressed="${INSF===k||(k==="all"&&!types.includes(INSF))}">${esc(l)}</button>`).join("")}</div>`;
  h+=F.map((x,k)=>{ const col=polCol(x.p), st=x.left==null?"":x.left<0?`<span class="tag bad">Expired</span>`:x.left<=30?`<span class="tag due">Renew soon</span>`:`<span class="tag ok">Active</span>`;
    const meta=x.p.d.link==="term"?`${M.term.T.length} of 60 premiums paid${termP?" · next "+fmtDs(termP.date):""}`:[x.c&&x.c.d.insurer,x.p.d.insured,x.end?"ends "+fmtDs(x.end):"add this year's policy"].filter(Boolean).join(" · ");
    return `<button class="pcard" data-pol="${esc(x.p.id)}" style="--c:${col};--k:${k}"><span class="pi">${svgI(polIcon(x.p),col)}</span><div style="min-width:0"><div class="n">${esc(x.p.d.title)}</div><div class="m">${esc(meta)}</div><div class="m">${st} ${x.cover?`<span class="num" style="color:var(--ink)">${money(x.cover,true)}</span> ${esc(L("cover_"+x.p.d.type))}`:""}</div></div><div class="r">${x.left!=null?dring(x.left,x.total,col):""}</div></button>`; }).join("")
    ||`<div class="emptyc">${svgI("shield","var(--neon)")}<b>Add your first policy</b><p>Health, car, scooter, your father's car — upload the policy and Claude reads the dates, cover and exclusions for you.</p></div>`;
  h+=`<div class="dock2" style="position:static;background:none;padding:14px 0 0"><div class="in one"><button class="btn1" id="insAdd">+ Add a policy</button></div></div>`;
  el.innerHTML=h; tiltAll(el); bindRows(el);
  const pr=$("insProc"); if(pr) pr.onclick=processNow;
  el.querySelectorAll("#insChips [data-f]").forEach(b=>b.onclick=()=>{ INSF=b.dataset.f; store.set("insf",INSF); renderIns(); });
  $("insAdd").onclick=()=>addPolicy(); }
function openPolicy(id){ if(!policies().some(x=>x.id===id)){ showToast("That policy is still syncing. Try again in a moment."); return; } openScr("pol",{id}); }
function renderPolicy(){ const p=policies().find(x=>x.id===SC.id); const B=$("scrBody"), dk=$("scrDock"); if(!p){ if(isOpen($("scr"))) ov.back(); return; }
  const col=polCol(p), cur=p.d.link==="term"?null:currentTerm(p.id), T=termsOf(p.id), hist=T.filter(t=>t!==cur), d=cur?cur.d:{};
  let x=scrHead(p.d.title,`<button class="ib" data-act="pol-edit" data-term="${cur?esc(cur.id):""}" aria-label="Edit">${svgI("edit","var(--neon)")}</button>`);
  if(p.d.link==="term"){ const tc=M.term, np=nextPremium(tc), paid=SUM(tc.T,t=>t.amt), n=tc.T.length;
    x+=`<div class="sumc tilt" style="--c:${col}"><div class="l">${esc(L("sec_prem"))} · not part of your worth</div><div class="v num">${money(paid,false)}</div><div class="prog"><i style="width:${n/60*100}%;background:${col};box-shadow:0 0 10px ${col}"></i></div>
      <div class="kv3"><div><small>Paid</small><b>${n} of 60</b></div><div><small>Left</small><b>${np?np.left:"—"}</b></div><div><small>Next due</small><b>${np?fmtDs(np.date):"—"}</b></div></div></div>`;
    x+=`<div class="gh"><span>${esc(L("sec_prem"))}</span><b class="num">${n}</b></div><div class="grp">${tc.T.slice().sort((a,b)=>(b.date||"")<(a.date||"")?-1:1).map(txRow).join("")}</div>`; }
  else { const left=d.end?days(M.today,d.end):null;
    x+=`<div class="sumc tilt" style="--c:${col}"><div class="l">${esc(L("sec_current"))}${d.start?" · "+fmtDs(d.start)+" → "+fmtDs(d.end):""}</div><div class="v num">${d.cover?money(+d.cover,false):"—"}</div><div class="s">${esc(L("cover_"+p.d.type))}${left!=null?` · ${left<0?"expired "+(-left)+" days ago":left+" days left"}`:""}</div>
      <div class="kv3"><div><small>${esc(L("f_premium"))}</small><b class="num">${d.premium?money(+d.premium,true):"—"}</b></div><div><small>${esc(L("f_insured"))}</small><b>${esc(p.d.insured||"—")}</b></div><div><small>${esc(L("f_holder"))}</small><b>${esc(p.d.holder||"—")}</b></div></div></div>`; }
  if(cur&&cur.d.status==="reading") x+=`<button class="ai" id="pProc">${svgI("spark","var(--neon2)")}<span><b>Waiting for Claude to read this policy</b><small>Tap to process now</small></span></button>`;
  else if(cur&&(cur.d.docs||[]).length&&!cur.d.read) x+=`<button class="ai" data-act="pol-read" data-term="${esc(cur.id)}">${svgI("spark","var(--neon2)")}<span><b>Read with Claude</b><small>Fill dates, cover, what's covered and exclusions from the policy</small></span></button>`;
  const list=(k,arr,c)=>arr&&arr.length?`<div class="sect" style="--c:${c}"><h5>${esc(L(k))}<span class="num">${arr.length}</span></h5><ul class="${k==="sec_covered"?"lyes":k==="sec_high"?"":"lno"}">${arr.map(s=>`<li>${esc(s)}</li>`).join("")}</ul></div>`:"";
  if(cur){ x+=list("sec_high",d.highlights,"var(--neon)")+list("sec_covered",d.covered,"var(--ok)")+list("sec_not",d.notCovered,"var(--spend)")+list("sec_excl",d.exclusions,"var(--accent)");
    const kv=[[L("f_insurer"),d.insurer],[L("f_policyNo"),d.policyNo],[L("f_start"),d.start?fmtD(d.start):""],[L("f_end"),d.end?fmtD(d.end):""]].concat(extraFor(p.d.type).map(f=>[f,(d.fields||{})[f]])).concat(Object.entries(d.fields||{}).filter(([k])=>!extraFor(p.d.type).includes(k)));
    x+=`<div class="sect"><h5>${esc(L("sec_extra"))}<button class="edl" data-act="pol-edit" data-term="${esc(cur.id)}">Edit</button></h5><dl class="kvs">${kv.filter(([,v])=>v).map(([k,v])=>`<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("")||`<dt>Nothing yet</dt><dd></dd>`}</dl></div>`;
    x+=`<div class="sect"><h5>${esc(L("sec_docs"))} · ${esc(yearOf(cur))}<button class="edl" data-act="pol-doc">Add</button></h5>${(d.docs||[]).map(docRow).join("")||`<div class="s">No documents yet.</div>`}</div>`; }
  if(hist.length) x+=`<div class="gh"><span>${esc(L("sec_hist"))}</span><b class="num">${hist.length}</b></div>`+hist.map(t=>`<div class="sect"><h5>${esc(yearOf(t))}<button class="edl" data-act="pol-edit" data-term="${esc(t.id)}">Edit</button></h5><dl class="kvs">${[[L("f_insurer"),t.d.insurer],[L("f_premium"),t.d.premium?rs(+t.d.premium,false):""],[L("cover_"+p.d.type),t.d.cover?rs(+t.d.cover,false):""]].filter(([,v])=>v).map(([k,v])=>`<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("")}</dl>${(t.d.docs||[]).map(docRow).join("")}</div>`).join("");
  B.innerHTML=x; dk.innerHTML=p.d.link==="term"?`<div class="in"><button class="btn2" data-act="pol-doc">Add document</button><button class="btn1" data-act="term-prem">Add premium</button></div>`:`<div class="in"><button class="btn2" data-act="pol-doc">Add document</button><button class="btn1" data-act="pol-renew">${cur?"Add next year's policy":"Add this year's policy"}</button></div>`;
  bindScr(B); const pp=$("pProc"); if(pp) pp.onclick=processNow; }
const yearOf=t=>t.d.start?`${t.d.start.slice(0,4)}–${(t.d.end||"").slice(2,4)||"?"}`:t.d.created?"Added "+fmtDs(t.d.created):"Undated";
const docRow=f=>`<a class="doc" href="${esc(safeUrl(f.url))}" target="_blank" rel="noopener noreferrer">${svgI("file","var(--neon)")}<span>${esc(f.label||f.name)}</span><small>${f.size?Math.max(1,Math.round(f.size/1024))+" KB":""}</small></a>`;
/* one simple form for adding, renewing and editing a policy */
function addPolicy(){ policyForm(null,null,{}); }
function editPolicy(pid,tid){ policyForm(pid,tid||"",{}); }
function policyForm(pid,tid,opt){ const p=pid?policies().find(x=>x.id===pid):null, t=tid?M.rec.get(tid):null, prev=p&&!t&&opt.renew?currentTerm(pid):null, d=t?t.d:{};
  const st={type:p?p.d.type:"",title:p?p.d.title:"",holder:p?p.d.holder||"Aditya":"Aditya",insured:p?p.d.insured||"":"",insurer:d.insurer||(prev&&prev.d.insurer)||"",policyNo:d.policyNo||"",
    premium:d.premium||"",cover:d.cover||(prev&&prev.d.cover)||"",start:d.start||(prev&&prev.d.end?addDays(prev.d.end,1):""),end:d.end||"",extra:Object.entries(d.fields||{}).map(([k,v])=>({k,v})),
    hi:(d.highlights||[]).join("\n"),co:(d.covered||[]).join("\n"),no:(d.notCovered||[]).join("\n"),ex:(d.exclusions||[]).join("\n"),files:[],read:true,remind:p&&p.d.remind?p.d.remind:remindPref()};
  const term=p&&p.d.link==="term";
  const coverL={health:"Cover (sum insured)",car:"Cover (IDV, the car's insured value)",bike:"Cover (IDV, the vehicle's insured value)",life:"Cover (sum assured)",home:"Cover (sum insured)",travel:"Cover",other:"Cover amount"};
  const nameEg={health:"Family health",car:"Creta car",bike:"Activa scooter",life:"Term life",home:"Home",travel:"Europe trip",other:"Policy name"};
  const keep=()=>{ const g=id=>$(id)?$(id).value:null; [["fN","title"],["fI","insured"],["fCo","insurer"],["fPn","policyNo"],["fSt","start"],["fEn","end"],["fHi","hi"],["fCv2","co"],["fNo","no"],["fEx","ex"],["fHo","holderO"]].forEach(([i,k])=>{ const v=g(i); if(v!=null) st[k]=v; });
    const pr=g("fPr"), cv=g("fCv"); if(pr!=null) st.premium=numIn(pr)||""; if(cv!=null) st.cover=numIn(cv)||"";
    st.extra=[...document.querySelectorAll("#fX .rr")].map(r=>({k:r.querySelector("[data-k]").value,v:r.querySelector("[data-v]").value})); const rd=$("fRead"); if(rd) st.read=rd.checked; };
  const draw=()=>{ const head=!p?"Add a policy":opt.renew?`Next year · ${p.d.title}`:`Edit · ${p.d.title}`;
    const pick=`<div class="fld"><span>What is insured?</span><div class="tgrid" id="fT">${PTYPES.map(k=>`<button type="button" data-v="${k}" aria-pressed="${st.type===k}" style="--c:${PCOL[k]}">${svgI(PICON[k],PCOL[k],22)}<span>${esc(LBL0["t_"+k])}</span></button>`).join("")}</div></div>`;
    /* a new policy: choose what it is first, the rest of the form follows */
    if(!p&&!st.type){ openE(`<div class="t big">${esc(head)}</div>${pick}${closeBtn}`); $("fT").querySelectorAll("[data-v]").forEach(b=>b.onclick=()=>{ st.type=b.dataset.v; draw(); }); return; }
    openE(`<div class="t big">${esc(head)}</div>
    ${!opt.renew?pick:""}
    ${opt.renew?"":`<label class="fld"><span>Give it a name</span><input id="fN" value="${esc(st.title)}" placeholder="${esc(nameEg[st.type])}"></label>
    <div class="fld"><span>Whose policy</span><div class="seg sm" id="fH">${["Aditya","Spardha","Father","Other"].map(v=>`<button type="button" data-v="${v}" aria-pressed="${st.holder===v||(v==="Other"&&!["Aditya","Spardha","Father"].includes(st.holder))}">${v}</button>`).join("")}</div>${!["Aditya","Spardha","Father"].includes(st.holder)?`<input id="fHo" value="${esc(st.holder==="Other"?"":st.holder)}" placeholder="Name">`:""}</div>
    <label class="fld"><span>${st.type==="car"||st.type==="bike"?"Vehicle (model and number)":"Who is covered"}</span><input id="fI" value="${esc(st.insured)}" placeholder="${st.type==="car"||st.type==="bike"?"Activa · KA03 AB 1234":"Aditya, Spardha"}"></label>`}
    ${term?"":`<div class="btns"><label class="fld"><span>Insurance company</span><input id="fCo" value="${esc(st.insurer)}" placeholder="ICICI Lombard"></label><label class="fld"><span>Policy number</span><input id="fPn" value="${esc(st.policyNo)}"></label></div>
    <div class="btns"><label class="fld"><span>Premium paid (₹)</span><input id="fPr" inputmode="numeric" value="${esc(st.premium)}"></label><label class="fld"><span>${esc(coverL[st.type])}</span><input id="fCv" inputmode="numeric" value="${esc(st.cover)}"></label></div>
    <div class="btns"><label class="fld"><span>Starts on</span><input id="fSt" type="date" value="${esc(st.start)}"></label><label class="fld"><span>Ends on</span><input id="fEn" type="date" value="${esc(st.end)}"></label></div>
    <div class="fld"><span>Other details (optional)</span><div id="fX" style="display:grid;gap:8px">${st.extra.map((x,i)=>`<div class="rr"><input data-k value="${esc(x.k)}" placeholder="e.g. Room rent limit"><input data-v value="${esc(x.v)}" placeholder="Value"><button type="button" data-rm="${i}" aria-label="Remove">×</button></div>`).join("")}</div><button type="button" class="addr" id="fXa">+ Add a detail</button></div>
    <details class="more2"${st.hi||st.co||st.no||st.ex?" open":""}><summary>What's covered and what isn't (optional)</summary>
      <label class="fld"><span>Key points · one per line</span><textarea id="fHi" rows="2">${esc(st.hi)}</textarea></label>
      <label class="fld"><span>Covered · one per line</span><textarea id="fCv2" rows="3">${esc(st.co)}</textarea></label>
      <label class="fld"><span>Not covered · one per line</span><textarea id="fNo" rows="2">${esc(st.no)}</textarea></label>
      <label class="fld"><span>Exclusions and waiting periods · one per line</span><textarea id="fEx" rows="2">${esc(st.ex)}</textarea></label></details>
    <div class="fld"><span>Policy document (PDF or photo)</span><button type="button" class="btn2" id="fF">${st.files.length?`${st.files.length} file${st.files.length>1?"s":""} chosen · change`:"Choose file"}</button>
      ${st.files.length?`<label class="chk"><input type="checkbox" id="fRead" ${st.read?"checked":""}> Let Claude read it and fill in what's covered, exclusions and dates</label>`:""}</div>
    ${remindSeg("fR",st.remind,"Remind me 15 days before it ends")}`}
    <div class="err" id="fE"></div><button class="go" type="button" id="fOk">${p&&!opt.renew?"Save changes":"Save policy"}</button>
    ${p&&!opt.renew?`<div class="btns"><button class="x" type="button" id="fDel">${t?"Delete this year":"Remove policy"}</button>${closeBtn}</div>`:closeBtn}`);
    const ft=$("fT"); if(ft) ft.querySelectorAll("[data-v]").forEach(b=>b.onclick=()=>{ keep(); st.type=b.dataset.v; draw(); });
    const fh=$("fH"); if(fh) fh.querySelectorAll("[data-v]").forEach(b=>b.onclick=()=>{ keep(); st.holder=b.dataset.v; draw(); });
    const fs=$("fSt"); if(fs) fs.onchange=()=>{ if(fs.value&&!$("fEn").value) $("fEn").value=addDays(addMonths(fs.value,12),-1); };
    const xa=$("fXa"); if(xa) xa.onclick=()=>{ keep(); st.extra.push({k:"",v:""}); draw(); setTimeout(()=>{ const r=[...document.querySelectorAll("#fX [data-k]")].pop(); r&&r.focus(); },50); };
    document.querySelectorAll("#fX [data-rm]").forEach(b=>b.onclick=()=>{ keep(); st.extra.splice(+b.dataset.rm,1); draw(); });
    const ff=$("fF"); if(ff) ff.onclick=()=>{ keep(); pickFiles("application/pdf,image/*",F=>{ st.files=F; draw(); }); };
    bindRemind("fR",v=>st.remind=v);
    const del=$("fDel"); if(del) del.onclick=()=>confirmSheet(t?"Delete this policy year?":"Remove this policy?",t?"Its documents stay in Google Drive.":"It disappears from the list. Its records and documents stay in the sheet and Drive.",t?"Delete year":"Remove",()=>{
      if(t) OUT.push({kind:"rec",ops:[{id:t.id,del:true}],rid:rid()}); else { OUT.push({kind:"rec",ops:[{id:pid,kind:"pol",title:p.d.title,data:Object.assign({},p.d,{archived:M.today})}],rid:rid()}); queueCal(polCal(pid,p.d.title,polEnd(p),false)); }
      saveOut(); flush(); ov.back(); if(!t) setTimeout(()=>{ if(SC&&SC.h==="pol") ov.back(); },260); refresh(); });
    $("fOk").onclick=async()=>{ keep(); const holder=st.holder==="Other"||!["Aditya","Spardha","Father"].includes(st.holder)?(st.holderO||"").trim()||"Other":st.holder;
      if(!PTYPES.includes(st.type)){ $("fE").textContent="Choose what is insured."; return; }
      if(!opt.renew&&!st.title.trim()){ $("fE").textContent="Give the policy a name."; return; }
      if(st.start&&st.end&&st.end<st.start){ $("fE").textContent="The end date is before the start date."; return; }
      const id=pid||"pol-"+rid(), title=(opt.renew?p.d.title:st.title.trim()), lines=s=>String(s||"").split("\n").map(x=>x.trim()).filter(Boolean), fields={};
      st.extra.forEach(x=>{ if(x.k.trim()&&x.v.trim()) fields[x.k.trim()]=x.v.trim(); });
      const pd=Object.assign({},p?p.d:{created:M.today},(!p||p.d.type!==st.type)?{typeOk:M.today}:{},{title,type:st.type,insured:(st.insured||"").trim(),holder,remind:st.remind}); delete pd.link; if(term) pd.link="term";
      const ops=[{id,kind:"pol",title,data:pd}]; let tidN=null;
      if(!term){ tidN=t?t.id:"pt-"+rid(); ops.push({id:tidN,kind:"pterm",title,data:Object.assign({},d,{pol:id,created:d.created||M.today,insurer:st.insurer.trim(),policyNo:st.policyNo.trim(),start:st.start,end:st.end,premium:st.premium,cover:st.cover,fields,
        highlights:lines(st.hi),covered:lines(st.co),notCovered:lines(st.no),exclusions:lines(st.ex),docs:d.docs||[]})}); }
      OUT.push({kind:"rec",ops,rid:rid()}); if(!term) queueCal(polCal(id,title,st.end,st.remind==="cal")); saveOut(); build();
      if(st.files.length&&tidN){ try{ const up=await uploadFiles(st.files,`Insurance/${title}/${st.start?st.start.slice(0,4):M.today}`,(f,i,mime)=>f.name||`${title}-${i+1}.${extOf(f,mime)}`);
          const cur=M.rec.get(tidN); OUT.push({kind:"rec",ops:[{id:tidN,kind:"pterm",title,data:Object.assign({},cur.d,{docs:(cur.d.docs||[]).concat(up),status:st.read?"reading":""})}],rid:rid()}); saveOut(); build();
          if(st.read){ await sendInbox("policy",{pol:id,term:tidN,title,type:st.type,insured:pd.insured,holder,extraFields:EXTRA0[st.type]||[],coverLabel:coverL[st.type]},null,title+" policy",up); flush(); refresh(); return; } }
        catch(x){ showToast("Saved, but the file didn't upload: "+(x.message||x),6000); } }
      flush(); ov.back(); refresh(); showToast("Policy saved"); if(!p) setTimeout(()=>{ setTab("ins"); openPolicy(id); },300); }; };
  draw(); }
function confirmSheet(title,msg,yes,fn){ openE(`<div class="t big">${esc(title)}</div><div class="s" style="text-align:left">${esc(msg)}</div><button class="go danger" type="button" id="cfY">${esc(yes)}</button><button class="x" type="button" id="cfN">Cancel</button>`);
  $("cfY").onclick=fn; $("cfN").onclick=()=>ov.back(); }
function ensurePol(pid){ const p=policies().find(x=>x.id===pid); if(p&&p.synthetic){ OUT.push({kind:"rec",ops:[{id:pid,kind:"pol",title:p.d.title,data:Object.assign({},p.d,{created:M.today})}],rid:rid()}); saveOut(); } return p; }
function policyUpload(pid,mode){ if(mode==="renew"&&pid!=="pol-term"){ const p0=policies().find(x=>x.id===pid); if(p0) return policyForm(pid,null,currentTerm(pid)?{renew:true}:{}); } const p=ensurePol(pid); if(!p) return;
  pickFiles("application/pdf,image/*",async files=>{
    try{ const cur=currentTerm(pid), folder=`Insurance/${p.d.title}/${mode==="doc"&&cur?yearOf(cur):M.today}`;
      const up=await uploadFiles(files,folder,(f,i,mime)=>f.name||`${p.d.title}-${M.today}-${i+1}.${extOf(f,mime)}`);
      if(mode==="doc"&&cur){ OUT.push({kind:"rec",ops:[{id:cur.id,kind:"pterm",title:p.d.title,data:Object.assign({},cur.d,{docs:(cur.d.docs||[]).concat(up)})}],rid:rid()}); saveOut(); flush(); ov.back(); refresh(); showToast(`${up.length} document${up.length>1?"s":""} added`); return; }
      const tid="pt-"+rid(); OUT.push({kind:"rec",ops:[{id:tid,kind:"pterm",title:p.d.title,data:{pol:pid,created:M.today,docs:up,status:"reading"}}],rid:rid()}); saveOut();
      await sendInbox("policy",{pol:pid,term:tid,title:p.d.title,type:p.d.type,insured:p.d.insured,holder:p.d.holder,extraFields:extraFor(p.d.type),coverLabel:L("cover_"+p.d.type)},null,p.d.title+" policy",up);
      if(!SC||SC.h!=="pol") openPolicy(pid); else renderScr();
    }catch(x){ openE(`<div class="t big">Couldn't upload</div><div class="s">${esc(x.message||x)}</div>${closeBtn}`); } }); }
function policyRead(pid,tid){ const p=policies().find(x=>x.id===pid), t=tid&&M.rec.get(tid); if(!p||!t) return;
  OUT.push({kind:"rec",ops:[{id:t.id,kind:"pterm",title:p.d.title,data:Object.assign({},t.d,{status:"reading"})}],rid:rid()}); saveOut();
  sendInbox("policy",{pol:pid,term:t.id,title:p.d.title,type:p.d.type,insured:p.d.insured,holder:p.d.holder,extraFields:extraFor(p.d.type),coverLabel:L("cover_"+p.d.type)},null,p.d.title+" policy",t.d.docs||[]); }
function reviewPolicy(r){ const d=r.d, x=d.res||{}, c=d.ctx||{}, p=policies().find(q=>q.id===c.pol), t=c.term&&M.rec.get(c.term);
  if(!p||!t){ openE(`<div class="t big">${esc(d.title)}</div><div class="s">The policy for this document was removed.</div><button class="go" id="rpDel">Clear it</button>${closeBtn}`); $("rpDel").onclick=()=>{ inboxDone(r.id,"removed"); ov.back(); refresh(); }; return; }
  const F=Object.assign({},x.fields||{}); const li=a=>Array.isArray(a)?a.filter(Boolean):[];
  const seen=PTYPES.includes(x.type)?x.type:guessPolType([x.insured].concat(Object.entries(F).map(([k,v])=>k+" "+v),li(x.highlights).slice(0,6))); let useType=seen&&seen!==p.d.type?seen:p.d.type;
  openE(`<div class="t big">${svgI("spark","var(--neon2)",20)} ${esc(p.d.title)} · check and save</div>
    ${seen&&seen!==p.d.type?`<div class="fld"><span>This reads like a ${esc(LBL0["t_"+seen])} policy, but it is filed under ${esc(L("t_"+p.d.type))}. File it under</span><div class="seg sm" id="rpT"><button type="button" data-v="${seen}" aria-pressed="true">${esc(LBL0["t_"+seen])}</button><button type="button" data-v="${esc(p.d.type)}" aria-pressed="false">${esc(L("t_"+p.d.type))}</button></div></div>`:""}
    ${dl([[L("f_insurer"),esc(x.insurer||"—")],[L("f_policyNo"),esc(x.policyNo||"—")],[L("f_start"),x.start?fmtD(x.start):"—"],[L("f_end"),x.end?fmtD(x.end):"—"],[L("f_premium"),x.premium?money(+x.premium,false):"—"],[L("cover_"+p.d.type),x.cover?money(+x.cover,false):"—"]].concat(Object.entries(F).slice(0,10).map(([k,v])=>[k,esc(v)])))}
    ${li(x.highlights).length?`<div class="sect"><h5>${esc(L("sec_high"))}</h5><ul>${li(x.highlights).map(s=>`<li>${esc(s)}</li>`).join("")}</ul></div>`:""}
    <div class="s" style="text-align:left">${li(x.covered).length} covered · ${li(x.notCovered).length} not covered · ${li(x.exclusions).length} exclusions. You can edit everything after saving.</div>
    <button class="go" type="button" id="rpOk">Save to ${esc(p.d.title)}</button><div class="btns"><button class="x" type="button" id="rpDel">Discard</button>${closeBtn}</div>`);
  const rt=$("rpT"); if(rt) rt.querySelectorAll("[data-v]").forEach(b=>b.onclick=()=>{ useType=b.dataset.v; rt.querySelectorAll("[data-v]").forEach(z=>z.setAttribute("aria-pressed",String(z===b))); });
  $("rpDel").onclick=()=>{ inboxDone(r.id,"removed"); OUT.push({kind:"rec",ops:[{id:t.id,kind:"pterm",title:p.d.title,data:Object.assign({},t.d,{status:""})}],rid:rid()}); saveOut(); ov.back(); refresh(); };
  $("rpOk").onclick=()=>{ const nd=Object.assign({},t.d,{status:"",read:M.today,src:"Claude",insurer:x.insurer||t.d.insurer||"",policyNo:x.policyNo||t.d.policyNo||"",start:x.start||t.d.start||"",end:x.end||t.d.end||"",premium:+x.premium||t.d.premium||"",cover:+x.cover||t.d.cover||"",
      fields:Object.assign({},t.d.fields||{},F),covered:li(x.covered),notCovered:li(x.notCovered),exclusions:li(x.exclusions),highlights:li(x.highlights)});
    const ops=[{id:t.id,kind:"pterm",title:p.d.title,data:nd}], pd2=Object.assign({},p.d); if(x.insured&&!p.d.insured) pd2.insured=x.insured; if(seen&&seen!==p.d.type){ pd2.type=useType; pd2.typeOk=M.today; }
    if(pd2.insured!==p.d.insured||pd2.type!==p.d.type||pd2.typeOk!==p.d.typeOk) ops.push({id:p.id,kind:"pol",title:p.d.title,data:pd2});
    OUT.push({kind:"rec",ops,rid:rid()}); queueCal(polCal(p.id,p.d.title,nd.end,(p.d.remind||remindPref())==="cal")); inboxDone(r.id); saveOut(); ov.back(); refresh(); flush(); showToast("Policy details saved"); setTimeout(()=>openPolicy(p.id),100); }; }
/* ---------- search ---------- */
function openSearch(){ $("q").value=""; doSearch(); ov.open($("sheet"),()=>{ vanish($("sheet")); }); setTimeout(()=>$("q").focus(),60); }
function doSearch(){ const q=$("q").value.trim().toLowerCase();
  const H=M.hold.filter(h=>!q||[h.name,h.isin,h.who,h.plat].join(" ").toLowerCase().includes(q)).sort((a,b)=>b.cur-a.cur);
  const Bd=M.bonds.filter(b=>!q||[b.name,b.platL,b.who].join(" ").toLowerCase().includes(q));
  const Po=policies().filter(p=>!q||[p.d.title,p.d.insured,p.d.holder,L("t_"+p.d.type)].concat(termsOf(p.id).map(t=>[t.d.insurer,t.d.policyNo].join(" "))).join(" ").toLowerCase().includes(q));
  const T=M.tx.filter(t=>!q||[t.name,t.note2,t.p,t.type,t.who,CLS[t.a]&&CLS[t.a].label,t.bid].join(" ").toLowerCase().includes(q)).sort((a,b)=>(b.date||"")<(a.date||"")?-1:1);
  $("res").innerHTML=(Po.length&&q?`<div class="sum">Insurance · ${Po.length}</div><div class="grp">${Po.map(p=>`<button class="hl" data-pol="${esc(p.id)}"><span class="av" style="background:${polCol(p)}">${svgI(polIcon(p),"#fff",20)}</span><div style="min-width:0"><div class="n">${esc(p.d.title)}</div><div class="m">${esc([L("t_"+p.d.type),p.d.insured].filter(Boolean).join(" · "))}</div></div><div class="r"></div></button>`).join("")}</div>`:"")
    +(H.length?`<div class="sum">Holdings · ${H.length}</div><div class="grp">${H.slice(0,40).map(holdRow).join("")}</div>`:"")
    +(Bd.length&&q?`<div class="sum">Bonds · ${Bd.length}</div><div class="grp">${Bd.map(bondRow).join("")}</div>`:"")
    +`<div class="sum">Entries · ${T.length}</div><div class="grp">${T.slice(0,150).map(txRow).join("")||`<div class="empty">No entries match.</div>`}</div>`;
  bindRows($("res")); $("res").querySelectorAll("[data-pol]").forEach(b=>b.onclick=()=>{ ov.back(); setTimeout(()=>{ setTab("ins"); openPolicy(b.dataset.pol); },80); }); }
$("q").addEventListener("input",doSearch);
$("closeSearch").onclick=()=>ov.back();
$("searchBtn").onclick=openSearch;

/* ---------- ADD: amount → what → details. Writes plain Ledger rows. ---------- */
const TYPES=[["stocks","Stocks","stocks","Stocks"],["mf","Mutual fund","mf","Mutual Funds"],["bond","Bond","bond","Bonds"],["fd","Fixed deposit","fd","FD"],
  ["us","US stocks","us","US Stocks"],["cash","Money in / out","cash","Cash"],["nps","NPS","nps","NPS"],["term","Term premium","term","Insurance"],["other","Other","other","Other"]];
const TCOL={stocks:CLS.Stocks.col,us:CLS.Stocks.col,cash:CLS.Stocks.col,mf:CLS["Mutual Funds"].col,bond:CLS.Bonds.col,fd:CLS.Bonds.col,nps:CLS.NPS.col,term:CLS.Term.col,other:CLS.Other.col};
/* bank accounts: money always leaves from / lands in the account holder's own bank */
const BANKS_=()=>{ const b=CFG().banks; return b&&typeof b==="object"&&Object.keys(b).length?b:{Aditya:[["Bank","","#7E8A88"]]}; };
const bankList=acct=>{ const B=BANKS_(); return B[holderOf(acct)]||B[Object.keys(B)[0]]; };
/* the other person's banks, labelled with whose bank it is (e.g. Aditya's money paid from Spardha's HDFC) */
const otherBanks=acct=>{ const BANKS=BANKS_(), h=BANKS[holderOf(acct)]?holderOf(acct):Object.keys(BANKS)[0]; return Object.keys(BANKS).filter(p=>p!==h).flatMap(p=>BANKS[p].map(([b,,c])=>[b+" · "+p,"",c])); };
const bankPick=acct=>{ const L=bankList(acct).concat(otherBanks(acct)), b=store.get("bank:"+acct,""); return L.some(x=>x[0]===b)?b:L[0][0]; };
const A={mode:"in",digits:"",date:"",who:"Aditya",pre:{},step:"cats",type:null,det:{}};
const amtNum=()=>Number(A.digits||0);
const typeOf=id=>TYPES.find(t=>t[0]===id)||TYPES[0];
const groupOfType=id=>homeOfRow(typeOf(id)[3]);
/* stocks and funds start with the name; the rest start with the amount */
const TRADE=["stocks","us","mf"];
const PADFIRST=t=>!TRADE.includes(t)&&t!=="other";
function typesNow(){ let L2=TYPES.slice();
  if(A.mode==="out") L2=L2.filter(t=>!["term","fd"].includes(t[0]));
  if(A.pre.type) return L2.filter(t=>t[0]===A.pre.type);
  if(A.pre.a) L2=L2.filter(t=>groupOfType(t[0])===A.pre.a||(A.pre.a==="Stocks"&&t[0]==="cash"));
  return L2; }
/* accounts that make sense for a type, most-used first */
function acctsFor(type){ const fit={stocks:/groww|zerodha|upstox|angel|kite/i,us:/indmoney|vested|groww/i,cash:/groww|indmoney|zerodha|upstox/i,mf:/groww|kuvera|coin|zerodha/i,bond:/wint|grip|stable|golden|altifi|indmoney/i,fd:/bank|stable|fd|sbi|hdfc|icici|axis|kotak|canara|ujjivan|pnb/i,nps:/nps/i,term:/insurance/i,other:/^(?!groww|wint|grip|stable money|indmoney|nps)/i}[type]||/./;
  const used=new Map(); M.tx.forEach(t=>{ if(t.acct) used.set(t.acct,(used.get(t.acct)||0)+1); });
  const L2=M.accts.filter(a=>fit.test(a)); return L2.sort((x,y)=>(used.get(y)||0)-(used.get(x)||0)); }
function openAdd(mode,pre){ A.mode=mode==="out"?"out":"in"; A.digits=""; A.date=TODAY(); A.pre=pre||{}; A.det={name:A.pre.name||undefined,acct:A.pre.acct}; A.type=null;
  A.who=A.pre.inv||(WHO!=="all"?WHO:"Aditya");
  $("aErr").textContent=""; showAmt(); showDate(); paintMode(); paintWho();
  if(!isOpen($("addSheet"))) ov.open($("addSheet"),()=>{ vanish($("addSheet")); });
  const L2=typesNow(); if(L2.length===1) pickType(L2[0][0]); else { drawCats(); setStep("cats"); } }
function paintMode(){ $("aMode").querySelectorAll("button").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.m===A.mode)));
  const c=A.pre.a&&CLS[A.pre.a]?CLS[A.pre.a].label.toLowerCase():"";
  $("addTitle").textContent=A.pre.name?(A.mode==="out"?"Sell · ":"Buy · ")+A.pre.name:A.pre.type==="term"?"Term premium":A.mode==="out"?(c?"Take out of "+c:"Withdraw or sell"):(c?"Add to "+c:"New entry"); }
function paintWho(){ $("aWho").textContent=A.who; $("aWhoBtn").disabled=!!A.pre.inv||A.pre.type==="term"; }
function setStep(s){ A.step=s; $("aPad").hidden=s!=="pad"; $("aCats").hidden=s!=="cats"; $("aDet").hidden=s!=="det"; $("catHint").hidden=s!=="cats"; $("aPanel").hidden=s!=="pad"; $("aMode").hidden=s!=="cats"||A.pre.type==="term";
  $("aChoose").textContent="Next"; }
function showAmt(){ const n=amtNum(); $("aVal").textContent=n?n.toLocaleString("en-IN"):"0"; $("aVal").classList.toggle("long",String(n).length>8); }
function showDate(){ $("aDate").value=A.date; $("aDateTxt").textContent=A.date===TODAY()?"Today":fmtD(A.date); }
$("aDate").addEventListener("change",()=>{ A.date=$("aDate").value||TODAY(); showDate(); if(A.step==="det") drawDet(); });
$("aMode").querySelectorAll("button").forEach(b=>b.onclick=()=>{ A.mode=b.dataset.m; paintMode(); drawCats(); });
$("aWhoBtn").onclick=()=>{ if($("aWhoBtn").disabled) return; A.who=A.who==="Aditya"?"Spardha":"Aditya"; paintWho(); };
$("aBack").onclick=()=>{ A.digits=A.digits.slice(0,-1); showAmt(); };
$("aPad").querySelectorAll("[data-k]").forEach(b=>b.onclick=()=>{ const k=b.dataset.k; $("aErr").textContent=""; if(k==="back") A.digits=A.digits.slice(0,-1); else if(A.digits.length<11) A.digits=(A.digits+k).replace(/^0+/,""); showAmt(); if(navigator.vibrate) navigator.vibrate(6); });
addEventListener("keydown",e=>{ if(!isOpen($("addSheet"))||A.step!=="pad"||/INPUT|TEXTAREA/.test(document.activeElement.tagName)) return;
  if(/^\d$/.test(e.key)){ A.digits=(A.digits+e.key).replace(/^0+/,"").slice(0,11); showAmt(); } else if(e.key==="Backspace"){ A.digits=A.digits.slice(0,-1); showAmt(); } else if(e.key==="Enter") $("aChoose").click(); });
$("aChoose").onclick=()=>{ if(!amtNum()){ $("aErr").textContent="Enter the amount first."; return; } $("aErr").textContent=""; drawDet(); setStep("det"); };
$("closeAdd").onclick=()=>{ const many=typesNow().length>1;
  if(A.step==="det"){ if(PADFIRST(A.type)) setStep("pad"); else if(many){ drawCats(); setStep("cats"); } else ov.back(); }
  else if(A.step==="pad"){ if(many){ drawCats(); setStep("cats"); } else ov.back(); } else ov.back(); };
function drawCats(){ const L2=typesNow();
  $("aCats").innerHTML=`<div class="fld" style="grid-column:1/-1"><div class="seg sm" id="cWho">${WHOS.map(w=>`<button type="button" data-v="${w}" aria-pressed="${A.who===w}">${w}'s money</button>`).join("")}</div></div>`
    +L2.map(t=>`<button type="button" class="card" data-t="${t[0]}" style="color:${TCOL[t[0]]}">${svgI(t[2],TCOL[t[0]])}<span style="color:var(--ink)">${t[1]}</span></button>`).join("");
  $("aCats").querySelectorAll("#cWho [data-v]").forEach(b=>b.onclick=()=>{ if(A.pre.inv) return; A.who=b.dataset.v; paintWho(); drawCats(); });
  $("aCats").querySelectorAll("[data-t]").forEach(b=>b.onclick=()=>pickType(b.dataset.t)); }
function pickType(t){ A.type=t; const keepAcct=A.pre.acct; A.det={name:A.pre.name||undefined,acct:keepAcct||store.get("acct:"+t,"")}; if(t==="term") A.who="Aditya";
  if(PADFIRST(t)&&!amtNum()){ showAmt(); setStep("pad"); return; } drawDet(); setStep("det"); }
function recentOf(f,filter){ const seen=[]; M.tx.filter(t=>t[f]&&(!filter||filter(t))).sort((a,b)=>(b.date||"")<(a.date||"")?-1:1).forEach(t=>{ if(!seen.includes(t[f])) seen.push(t[f]); }); return seen; }
function fdSched(P,rate,start,end,pay,comp){ const r=rate/100, S=[]; if(!(P>0&&r>0&&end>start)) return S; const n={y:1,q:4,m:12,s:0}[comp||"q"];
  if(pay==="end"){ const yrs=days(start,end)/365, amt=n?P*Math.pow(1+r/n,n*yrs):P*(1+r*yrs); S.push({d:end,p:P,i:Math.round((amt-P)*100)/100}); return S; }
  const step=pay==="m"?1:pay==="y"?12:3; let d=addMonths(start,step), prev=start;
  while(d<end){ S.push({d,p:0,i:Math.round(P*r*days(prev,d)/365*100)/100}); prev=d; d=addMonths(d,step); }
  S.push({d:end,p:P,i:Math.round(P*r*days(prev,end)/365*100)/100}); return S; }
/* the money source / destination row: bank chips (+ the broker balance for stocks) */
function bankRow(d,acct,opt){ const O=otherBanks(acct), extra=opt.extra||[], cur=d.via==="Balance"?"__bal":d.bank, more=d.bankMore||O.some(x=>x[0]===cur);
  const L=bankList(acct).concat(more?O:[]), who2=[...new Set(O.map(x=>x[0].split(" · ")[1]))].join(" / ");
  return `<div class="fld"><span>${esc(opt.label)}</span><div class="banks" id="dBank">${extra.map(([v,l])=>`<button type="button" data-v="${v}" aria-pressed="${cur===v}"><i style="--bc:var(--neon)"></i>${esc(l)}</button>`).join("")}
    ${L.map(([b,tag,c])=>`<button type="button" data-v="${esc(b)}" aria-pressed="${cur===b}"><i style="--bc:${esc(c)}"></i>${esc(b)}${tag?` <small>${esc(tag)}</small>`:""}</button>`).join("")}${(more||!O.length?"":`<button type="button" data-v="__more" aria-pressed="false" class="bmore">+ ${esc(who2)}'s bank</button>`)}</div>${opt.hint?`<small class="hint" style="display:block;margin-top:6px">${esc(opt.hint)}</small>`:""}</div>`; }
/* cash sitting in a broker balance for one account + whose money */
function cashOf(acct,who){ const u=(M.units||[]).find(x=>x.acct===acct&&x.who===who&&x.h==="Stocks"); return u?r2(u.cash):0; }
const MFSTAMP=0.00005; // stamp duty on mutual fund purchases (0.005%)
function drawDet(){
  const d=A.det, type=A.type, inv=A.mode==="in", T=typeOf(type), label=T[1];
  const isBond=type==="bond", fd=type==="fd", term=type==="term", nps=type==="nps", cash=type==="cash", stock=type==="stocks"||type==="us", mf=type==="mf", oth=type==="other";
  const AC=acctsFor(type); if(term) d.acct="Insurance"; if(nps&&!d.acct) d.acct="NPS · "+A.who;
  if(!d.acct&&!oth) d.acct=AC.find(a=>holderOf(a)===A.who)||AC[0]||""; const showA=[...new Set([d.acct].concat(AC))].filter(Boolean).slice(0,8);
  if(oth&&!d.acct&&!AC.length) d.acctOther=1;
  /* where the money came from / went: stocks default to the broker balance; everything else is a bank */
  if(d.via==null){ const last=store.get("via:"+type+":"+A.mode,""); d.via=stock?(last||"Balance"):"Bank"; }
  if(!d.bank) d.bank=bankPick(d.acct);
  const held=stock||mf?M.hold.filter(h=>h.acct===d.acct&&h.asset===T[3]).map(h=>h.name):[];
  const heldH=(stock||mf)&&!inv?M.hold.filter(h=>h.acct===d.acct&&h.who===A.who&&h.asset===T[3]).sort((a,b)=>b.cur-a.cur):[];
  if(heldH.length&&!heldH.some(h=>h.name===d.name)){ const m=d.name&&heldH.find(h=>keyName(h.name)===keyName(d.name)); d.name=(m||heldH[0]).name; }
  const hsel=heldH.find(h=>h.name===d.name)||null;
  if(d.amt==null) d.amt=amtNum()?String(amtNum()):""; if(d.net==null) d.net="";
  const bondsHere=(isBond||fd)&&!inv?M.bonds.filter(b=>!b.closed&&b.acct===d.acct).map(b=>b.name):[];
  /* fund quick picks: funds held now (any account), this account + whose money first; ELSS left out (no new money goes there) */
  const mfPicks=mf&&inv?(()=>{ const m=new Map(); M.hold.filter(h=>h.asset==="Mutual Funds"&&h.qty>0&&h.name&&!/elss|tax ?saver/i.test(h.name)).forEach(h=>{ const k=keyName(h.name), sc=(h.acct===d.acct&&h.who===A.who?3e9:h.acct===d.acct?2e9:1e9)+(h.cur||0), o=m.get(k); if(!o||sc>o.sc) m.set(k,{name:h.name,sc}); });
    return [...m.values()].sort((a,b)=>b.sc-a.sc).map(x=>x.name); })():[];
  const names=[...new Set(held.concat(bondsHere,recentOf("name",t=>t.acct===d.acct&&t.asset===T[3])))], nameL=isBond?"Bond name":fd?"Bank / FD name":mf?"Fund":oth?"What is it":"Stock";
  if(!d.reps) d.reps=[{d:"",a:""}]; if(d.remind==null) d.remind=remindPref(); if(!d.fdPay) d.fdPay="end"; if(!d.comp) d.comp=fd?"q":"y"; if(!d.ret) d.ret="rate"; if(!d.till) d.till="date";
  const keep=()=>{ const g=id=>$(id)?$(id).value:undefined; ["name","note","qty","rate","end","amt","net","px","exp"].forEach(k=>{ const v=g("d"+k[0].toUpperCase()+k.slice(1)); if(v!==undefined) d[k]=v; }); const o=g("dAcctO"); if(o!==undefined) d.acct=o.trim();
    const rr=[...document.querySelectorAll("#dReps .rr")]; if(rr.length) d.reps=rr.map(r=>({d:r.querySelector("input[type=date]").value,a:r.querySelector("input[inputmode]").value})); };
  const verb=inv?(term?"Premium":stock?"Buying":cash?"Adding to account":"Investing"):stock?"Selling":isBond?"Money back":cash?"Taking out":"Taking out";
  const plat=platOf(d.acct)||"broker", balNow=cashOf(d.acct,A.who);
  const viaRow=stock?bankRow(d,d.acct,{label:inv?"Paid from":"Money went to",extra:[["__bal",inv?plat+" balance":"Stayed in "+plat]],hint:inv?(d.via==="Balance"?`Uses cash already in ${esc(A.who)}'s ${esc(plat)} balance (${esc(rs(balNow,false))} now). That cash was counted as money put in when you added it, so this only moves it into the shares. Stocks › Balance shows every move.`:"Counts as new money put in: saved as money added to "+esc(plat)+" + the buy."):(d.via==="Balance"?"Still invested: it waits in the balance.":"Comes off what you've put in.")})
    :mf?bankRow(d,d.acct,{label:inv?"Paid from bank":"Money went to bank"})
    :term?bankRow(d,"Insurance",{label:"Paid from"})
    :bankRow(d,d.acct||A.who,{label:inv?(cash?"From bank":"Paid from"):(cash?"To bank":"Received in")});
  const sumAmt=TRADE.includes(type)||oth?"":`₹${amtNum().toLocaleString("en-IN")}`;
  $("aDet").innerHTML=`<div class="sumline"><span><small style="display:block;color:var(--muted);font-size:12px">${esc(label)} · ${A.date===TODAY()?"today":fmtD(A.date)}</small>${verb}</span><b class="num" id="dSum">${sumAmt}</b></div>
    <button class="ai sm" id="dDoc" type="button">${svgI("spark","var(--neon2)")}<span><b>${isBond&&inv?"Fill from screenshots":"Upload a document or screenshot"}</b><small>${isBond&&inv?"Claude reads the name, repayment dates, principal and interest":"Claude reads it and fills this entry for you to check"}</small></span></button>
    ${stock||mf||oth?`<label class="fld"><span>${heldH.length?nameL+" · from your holdings":nameL}</span>${heldH.length?`<select id="dName">${heldH.map(h=>`<option value="${esc(h.name)}"${h.name===d.name?" selected":""}>${esc(h.name)} · ${qtyf(h.qty)} ${mf?"units":"shares"} · ${esc(rs(h.cur,false))}</option>`).join("")}</select>`
      :`<input id="dName" list="dNames" value="${esc(d.name||"")}" maxlength="120" autocomplete="off" placeholder="${oth?"e.g. PPF, Post office MIS, P2P, gold, chit fund":""}">${mfPicks.length?"":`<datalist id="dNames">${names.map(n=>`<option value="${esc(n)}">`).join("")}</datalist>`}`}</label>${mfPicks.length&&!heldH.length?`<div class="seg sm wrap picks" id="dPick">${mfPicks.map(n=>`<button type="button" data-n="${esc(n)}" aria-pressed="${keyName(n)===keyName(d.name||"")}">${esc(n)}</button>`).join("")}</div>`:""}`:""}
    ${stock?`<div class="btns"><label class="fld"><span>Number of shares</span><input id="dQty" inputmode="decimal" value="${esc(d.qty||"")}" autocomplete="off"></label><label class="fld"><span>${inv?"Cost":"Price"} per share ₹</span><input id="dPx" inputmode="decimal" value="${esc(d.px||"")}" autocomplete="off"></label></div>
      ${hsel?`<button type="button" class="addr" id="dAll">Sell all ${qtyf(hsel.qty)} shares</button>`:""}
      ${!inv?`<label class="fld"><span>Received after charges (optional)</span><input id="dNet" inputmode="decimal" value="${esc(d.net||"")}" placeholder="From the contract note" autocomplete="off"></label>`:""}<div class="calc" id="dCalc"></div>`:""}
    ${mf?`<label class="fld"><span>${inv?"Amount paid ₹":"Amount received ₹ (optional)"}</span><input id="dAmt" inputmode="decimal" value="${esc(d.amt||"")}" autocomplete="off"></label>
      <label class="fld"><span>${inv?"Units (optional, from the order)":"Units to redeem"}</span><input id="dQty" inputmode="decimal" value="${esc(d.qty||"")}" autocomplete="off"></label>
      ${hsel?`<button type="button" class="addr" id="dAll">Redeem all ${qtyf(hsel.qty)} units</button>`:""}<div class="calc" id="dCalc"></div>`:""}
    ${term?"":`<div class="fld"><span>Whose money</span><div class="seg sm" id="dWho">${WHOS.map(w=>`<button type="button" data-v="${esc(w)}" aria-pressed="${A.who===w}">${esc(w)}</button>`).join("")}</div></div>`}
    ${term?"":`<div class="fld"><span>${oth?"Where (bank, post office, platform…)":"Account"}</span><div class="seg sm wrap" id="dAcct">${showA.map(a=>`<button type="button" data-v="${esc(a)}" aria-pressed="${!d.acctOther&&a===d.acct}">${esc(a)}</button>`).join("")}<button type="button" data-v="__o" aria-pressed="${!!d.acctOther}">New${showA.length?" account":""}</button></div>${d.acctOther?`<input id="dAcctO" value="${esc(d.acct||"")}" maxlength="50" placeholder="e.g. ${oth?"Post office":"HDFC Bank"} · ${esc(A.who)}">`:""}${d.acct&&holderOf(d.acct)!==A.who&&!nps?`<small class="hint" style="display:block;margin-top:6px">${esc(A.who)}'s money in ${esc(holderOf(d.acct))}'s account — tracked as ${esc(A.who)}'s.</small>`:""}</div>`}
    ${viaRow}
    ${oth&&inv?othFields(d):""}${oth&&!inv?`<label class="fld"><span>Amount taken out ₹</span><input id="dAmt" inputmode="decimal" value="${esc(d.amt||"")}" autocomplete="off"></label><div class="fld"><span>What was it</span><div class="seg sm" id="dKind"><button type="button" data-v="w" aria-pressed="${d.kind!=="i"}">Withdrawal / closed</button><button type="button" data-v="i" aria-pressed="${d.kind==="i"}">Interest / payout</button></div></div>`:""}
    ${fd?`<div class="btns"><label class="fld"><span>Interest rate (% a year)</span><input id="dRate" inputmode="decimal" value="${esc(d.rate||"")}"></label><label class="fld"><span>Matures on</span><input id="dEnd" type="date" value="${esc(d.end||"")}" min="${esc(A.date)}"></label></div>
      <div class="fld"><span>Interest is paid</span><div class="seg sm" id="dFdPay"><button type="button" data-v="end" aria-pressed="${d.fdPay==="end"}">At maturity</button><button type="button" data-v="q" aria-pressed="${d.fdPay==="q"}">Every quarter</button><button type="button" data-v="m" aria-pressed="${d.fdPay==="m"}">Every month</button></div></div>
      <div class="calc" id="dFdC"></div>${remindSeg("dRem",d.remind,"Remind me when money is due")}`:""}
    ${isBond&&inv?`<div class="fld"><span>Repayment dates · amount back each time (before TDS)</span><div id="dReps" style="display:grid;gap:8px">${d.reps.map((r,i)=>`<div class="rr"><input type="date" value="${esc(r.d)}" aria-label="Repayment date ${i+1}"><input inputmode="numeric" placeholder="₹ amount" value="${esc(r.a)}" aria-label="Amount ${i+1}"><button type="button" data-rm="${i}" aria-label="Remove">×</button></div>`).join("")}</div>${d.reps.length<60?`<button type="button" class="addr" id="dAddR">+ Add another date</button>`:""}</div>
      ${remindSeg("dRem",d.remind,"Remind me on the repayment dates")}`:""}
    ${(isBond||fd)&&!inv?`<label class="fld"><span>TDS deducted ₹ (optional)</span><input id="dNet" inputmode="decimal" value="${esc(d.net||"")}" placeholder="Counted as your earning; checked against 26AS"></label>`:""}
    <label class="fld"><span>${inv?"Note (optional)":"Reason (optional)"}</span><textarea id="dNote" rows="2" maxlength="250">${esc(d.note||"")}</textarea></label>
    <div class="err" id="dErr" role="alert"></div><button type="button" class="btn1" id="dSave">${inv?(term?"Save premium":isBond?"Save bond":fd?"Save FD":stock?"Save buy":"Save"):stock?"Save sale":isBond?"Save payout":"Save withdrawal"}</button>`;
  const seg=(id,fn)=>{ const el=$(id); if(el) el.querySelectorAll("[data-v]").forEach(b=>b.onclick=()=>{ keep(); fn(b.dataset.v); drawDet(); }); };
  seg("dWho",v=>{ if(!WHOS.includes(v)) return; A.who=v; paintWho(); if(nps) d.acct="NPS · "+v;
    else if(!d.acctPicked&&!d.acctOther&&holderOf(d.acct)!==v){ const tw=AC.find(a=>platOf(a)===platOf(d.acct)&&holderOf(a)===v); if(tw){ d.acct=tw; d.bank=bankPick(tw); } } });
  seg("dAcct",v=>{ if(v==="__o"){ d.acctOther=1; d.acct=""; setTimeout(()=>$("dAcctO")&&$("dAcctO").focus(),30); } else { d.acctOther=0; d.acct=v; d.acctPicked=1; d.bank=bankPick(v); } });
  seg("dBank",v=>{ if(v==="__more"){ d.bankMore=1; return; } if(v==="__bal") d.via="Balance"; else { d.via="Bank"; d.bank=v; } });
  seg("dFdPay",v=>d.fdPay=v); seg("dRet",v=>d.ret=v); seg("dTill",v=>d.till=v); seg("dComp",v=>d.comp=v); seg("dOPay",v=>d.fdPay=v); seg("dKind",v=>d.kind=v);
  const nm=$("dName"); if(nm&&nm.tagName==="SELECT") nm.onchange=()=>{ keep(); d.qty=""; drawDet(); };
  const pk=$("dPick"); if(pk&&nm){ const bs=[...pk.querySelectorAll("[data-n]")], flt=()=>{ const q=keyName(nm.value), ex=bs.find(b=>b.dataset.n===nm.value); bs.forEach(b=>{ b.setAttribute("aria-pressed",b===ex?"true":"false"); b.hidden=!!q&&!ex&&!keyName(b.dataset.n).includes(q)&&!b.dataset.n.toLowerCase().includes(nm.value.trim().toLowerCase()); }); };
    bs.forEach(b=>b.onclick=()=>{ nm.value=b.dataset.n; d.name=nm.value; flt(); nm.blur(); }); nm.addEventListener("input",flt); flt(); }
  const all=$("dAll"); if(all) all.onclick=()=>{ keep(); d.qty=String(r4(hsel.qty)); drawDet(); };
  const calc=()=>{ const el=$("dCalc"); if(!el) return; const v=id=>numIn($(id)?$(id).value:""), sum=$("dSum");
    if(stock){ const T2=tradeCalc(inv,v("dQty"),v("dPx"),v("dNet"),d.acct,type==="us");
      el.innerHTML=T2.val?`<div><span>Trade value</span><b>${esc(rs(T2.val,false))}</b></div><div><span>Charges${T2.est?" (estimated)":T2.ch?"":" (none)"}</span><b>${esc(T2.ch?"₹"+T2.ch.toLocaleString("en-IN"):"₹0")}</b></div><div><span>${inv?"Total paid":"You receive"}</span><b>${esc(rs(T2.net,false))}</b></div>${d.via==="Balance"?`<div><span>${esc(plat)} balance after</span><b class="${inv&&balNow-T2.net<0?"loss":""}">${esc(rs(balNow+(inv?-T2.net:T2.net),false))}</b></div>`:""}`
        :"<div><span>Shares × cost per share gives the trade value. Charges are added as their own entry.</span></div>";
      if(sum) sum.textContent=T2.net?rs(T2.net,false):""; }
    else if(mf){ const a=v("dAmt"), u=v("dQty"), px=hsel&&hsel.qty?hsel.cur/hsel.qty:0;
      el.innerHTML=(hsel?`<div><span>You hold</span><b>${qtyf(hsel.qty)} units</b></div>`+(px?`<div><span>NAV${hsel.nav?" · "+fmtDs(hsel.nav.d):""}</span><b>₹${px.toFixed(4)}</b></div>`:"")+(u&&px?`<div><span>≈ value of these units</span><b>${esc(rs(u*px,false))}</b></div>`:""):"")
        +((!u&&a)||(u&&!a&&!inv)?`<div><span>${!u?`Units = (amount − 0.005% stamp duty) ÷ NAV of ${A.date===TODAY()?"today":fmtDs(A.date)} (AMFI), worked out when you save. Within about 1% unless the order missed the 3 pm cut-off; units from the order make it exact.`:"Amount = units × NAV of the date, worked out when you save"}</span></div>`:"")||"<div><span>Units from the order confirmation keep this fund's value exact.</span></div>";
      if(sum) sum.textContent=a?rs(a,false):u&&px?"≈"+rs(u*px,false):""; }
    else if(oth){ const a=v("dAmt"); if(sum) sum.textContent=a?rs(a,false):""; } };
  ["dQty","dPx","dNet","dAmt"].forEach(id=>{ const el=$(id); if(el) el.addEventListener("input",calc); }); calc();
  const fdc=()=>{ const el=$("dFdC"); if(!el) return; const S=fdSched(amtNum(),numIn($("dRate").value),A.date,$("dEnd").value,d.fdPay), I=SUM(S,e=>e.i);
    el.innerHTML=S.length?`<div><span>${S.length} payment${S.length>1?"s":""} · interest before TDS</span><b>${esc(rs(I,false))}</b></div><div><span>Back at maturity</span><b>${esc(rs(S[S.length-1].p+S[S.length-1].i,false))}</b></div>`:"<div><span>Type the rate and the maturity date.</span></div>"; };
  if(fd){ $("dRate").oninput=fdc; $("dEnd").onchange=fdc; fdc(); }
  const oc=()=>othCalc(d); if(oth&&inv){ ["dAmt","dRate","dEnd","dExp"].forEach(id=>{ const el=$(id); if(el){ el.addEventListener("input",()=>{ keep(); oc(); }); el.addEventListener("change",()=>{ keep(); oc(); }); } }); oc(); }
  const ar=$("dAddR"); if(ar) ar.onclick=()=>{ keep(); d.reps.push({d:"",a:""}); drawDet(); };
  document.querySelectorAll("#dReps [data-rm]").forEach(b=>b.onclick=()=>{ keep(); d.reps.splice(+b.dataset.rm,1); if(!d.reps.length) d.reps=[{d:"",a:""}]; drawDet(); });
  $("dDoc").onclick=()=>{ keep(); pickFiles("image/*,application/pdf",files=>{ const amt=amtNum()||numIn(d.amt), ctx={type,mode:A.mode,acct:d.acct,who:A.who,platform:platOf(d.acct),amount:amt,date:A.date,name:(d.name||"").trim(),bank:d.via==="Balance"?"":d.bank,via:d.via};
    ov.back(); setTimeout(()=>{ if(isBond&&inv) sendInbox("bond",ctx,files,`New bond · ${rs(amt,false)}${ctx.name?" · "+ctx.name:""}`);
      else sendInbox("entry",ctx,files,`${inv?"New":"Withdraw"} · ${label}${ctx.name?" · "+ctx.name:""}`); },120); }); };
  bindRemind("dRem",v=>d.remind=v);
  $("dSave").onclick=()=>{ keep(); saveEntry(); };
}
/* "Other": anything that doesn't fit — fixed rate, a fixed sum on a date, or whatever it's worth on the day */
function othFields(d){ const dated=d.till==="date";
  return `<label class="fld"><span>Amount put in ₹</span><input id="dAmt" inputmode="decimal" value="${esc(d.amt||"")}" autocomplete="off"></label>
    <div class="fld"><span>How it earns</span><div class="seg sm wrap" id="dRet"><button type="button" data-v="rate" aria-pressed="${d.ret==="rate"}">Fixed rate (ROI)</button><button type="button" data-v="sum" aria-pressed="${d.ret==="sum"}">Fixed amount on a date</button><button type="button" data-v="mkt" aria-pressed="${d.ret==="mkt"}">Varies (market)</button><button type="button" data-v="none" aria-pressed="${d.ret==="none"}">No return</button></div></div>
    ${d.ret==="rate"?`<div class="btns"><label class="fld"><span>Rate % a year</span><input id="dRate" inputmode="decimal" value="${esc(d.rate||"")}"></label><div class="fld"><span>Compounds</span><div class="seg sm" id="dComp">${[["y","Yearly"],["q","Quarterly"],["m","Monthly"],["s","Simple"]].map(([k,l])=>`<button type="button" data-v="${k}" aria-pressed="${d.comp===k}">${l}</button>`).join("")}</div></div></div>`:""}
    ${d.ret!=="sum"?`<div class="fld"><span>Runs</span><div class="seg sm" id="dTill"><button type="button" data-v="date" aria-pressed="${dated}">Until a fixed date</button><button type="button" data-v="open" aria-pressed="${!dated}">Till I withdraw</button></div></div>`:""}
    ${dated||d.ret==="sum"?`<label class="fld"><span>${d.ret==="sum"?"You get the amount on":"Fixed return date (maturity)"}</span><input id="dEnd" type="date" value="${esc(d.end||"")}" min="${esc(A.date)}"></label>`:""}
    ${d.ret==="sum"?`<label class="fld"><span>Amount you get back ₹</span><input id="dExp" inputmode="decimal" value="${esc(d.exp||"")}"></label>`:""}
    ${d.ret==="rate"&&dated?`<div class="fld"><span>Interest is paid</span><div class="seg sm" id="dOPay">${[["end","At the end"],["m","Monthly"],["q","Quarterly"],["y","Yearly"]].map(([k,l])=>`<button type="button" data-v="${k}" aria-pressed="${d.fdPay===k}">${l}</button>`).join("")}</div></div>`:""}
    <div class="calc" id="dOthC"></div>${(d.ret==="rate"&&dated)||d.ret==="sum"?remindSeg("dRem",d.remind,"Remind me when money is due"):""}`; }
function othCalc(d){ const el=$("dOthC"); if(!el) return; const a=numIn(d.amt), r=numIn(d.rate), dated=d.till==="date";
  if(d.ret==="rate"&&dated){ const S=fdSched(a,r,A.date,d.end||"",d.fdPay,d.comp), I=SUM(S,e=>e.i);
    el.innerHTML=S.length?`<div><span>${S.length} payment${S.length>1?"s":""} · interest before TDS</span><b>${esc(rs(I,false))}</b></div><div><span>Back on ${fmtDs(d.end)}</span><b>${esc(rs(S[S.length-1].p+S[S.length-1].i,false))}</b></div><div><span>Kept with your bonds & FDs, with payout reminders.</span></div>`:"<div><span>Type the amount, rate and the date.</span></div>"; }
  else if(d.ret==="sum"){ const e=numIn(d.exp), y=d.end>A.date?days(A.date,d.end)/365:0, x=a>0&&e>0&&y>0?Math.pow(e/a,1/y)-1:null;
    el.innerHTML=x!=null?`<div><span>Gain</span><b>${esc(rs(e-a,false))}</b></div><div><span>Works out to</span><b>${pct(x)} a year</b></div>`:"<div><span>Type what you put in, what you get back and the date.</span></div>"; }
  else if(d.ret==="rate") el.innerHTML=`<div><span>Value grows at ${r||"—"}% a year (${({y:"compounded yearly",q:"compounded quarterly",m:"compounded monthly",s:"simple interest"})[d.comp]}) until you withdraw.</span></div>`;
  else el.innerHTML=`<div><span>${d.ret==="mkt"?"Shown at cost until you update its value (Menu › Update values).":"Kept at the amount you put in."}</span></div>`; }
function tradeCalc(inv,q,px,net,acct,us){ const val=r2(q*px); if(!(val>0)) return {val:0,ch:0,net:0,est:false};
  let ch=0, est=false; if(!inv&&net>0) ch=Math.max(0,r2(val-net)); else if(!us&&/groww/i.test(acct||"")){ ch=estCharges(inv?"B":"S",val); est=true; }
  return {val,ch,est,net:r2(inv?val+ch:val-ch)}; }
const bankTag=b=>b?` [bank ${b}]`:"";
function saveEntry(){ const d=A.det, type=A.type, T=typeOf(type), inv=A.mode==="in", amt=amtNum(), name=(d.name||"").trim(), note=(d.note||"").trim(), err=m=>{ $("dErr").textContent=m; };
  const acct=(d.acct||"").trim(); if(!acct) return err(type==="other"?"Type where it's held (e.g. Post office · "+A.who+").":"Pick an account, or type a new one."); if(PADFIRST(type)&&!(amt>0)) return err("Go back and enter the amount.");
  const bank=d.via==="Balance"?"":(d.bank||bankPick(acct)); store.set("bank:"+acct,bank||store.get("bank:"+acct,"")); store.set("via:"+type+":"+A.mode,d.via);
  const bt=bankTag(bank), base={date:A.date,who:A.who,acct,asset:T[3],name,note:(note+bt).trim(),via:""}, rows=[]; let recOp=null, cal=[];
  const hq=!inv?SUM(M.hold.filter(h=>h.acct===acct&&h.who===A.who&&h.asset===T[3]&&keyName(h.name)===keyName(name)),h=>h.qty):0;
  if(type==="stocks"||type==="us"){ const q=numIn(d.qty); let px=numIn(d.px); const nt=inv?0:numIn(d.net); if(!name) return err("Pick or type the stock."); if(!(q>0)) return err("Type the number of shares.");
    if(!inv&&hq&&q>hq*1.0001) return err(`Only ${qtyf(hq)} shares held here.`);
    if(!(px>0)&&nt>0) px=r2(nt/q); if(!(px>0)) return err(inv?"Type the cost per share.":"Type the price per share.");
    const C=tradeCalc(inv,q,px,nt,acct,type==="us"), chNote=C.est?"Brokerage, STT & charges (estimated)":"Brokerage, STT & charges";
    const b2={...base,note:note};
    if(inv&&d.via==="Bank") rows.push({...b2,asset:"Cash",type:"Add money",name:"",amt:C.net,via:"Bank",note:(`${bank||"Bank"} → ${acct}`+bt).trim()});
    rows.push({...b2,type:inv?"Buy":"Sell",qty:q,price:px,amt:C.val,via:"Balance"});
    if(C.ch>0) rows.push({...b2,asset:"Cash",type:"Charges",amt:C.ch,via:"Balance",note:chNote+" · "+(inv?"buy ":"sale ")+name});
    if(!inv&&d.via==="Bank") rows.push({...b2,asset:"Cash",type:"Withdraw",name:"",amt:C.net,via:"Bank",note:(`${acct} → ${bank||"bank"}`+bt).trim()});
    return commit(rows,C.net,null,[],type,acct,{t:inv?"Bought":"Sold",s:`${qtyf(q)} ${name} · ${rs(C.net,false)}`}); }
  else if(type==="mf"){ if(!name) return err(inv?"Type the fund's name.":"Pick the fund."); let q=numIn(d.qty), a=numIn(d.amt);
    if(inv&&!a) return err("Type the amount paid."); if(!inv&&!q&&!a) return err("Type the units or the amount.");
    if(!inv&&hq&&q>hq*1.0001) return err(`Only ${qtyf(hq)} units held here.`);
    const done=(nv)=>{ let n2=base.note; if(nv){ if(!q) q=r4(a*(inv?1-MFSTAMP:1)/nv.nav); else if(!a) a=r2(q*nv.nav); n2=(n2+` · ${!numIn(d.qty)?"units":"amount"} from NAV ₹${nv.nav} of ${fmtD(nv.d)}${inv&&!numIn(d.qty)?" less 0.005% stamp duty":""}`).replace(/^ · /,""); }
      rows.push({...base,note:n2,type:inv?"Buy":"Redeem",qty:q||"",price:q&&a?r4(a/q):"",amt:a,via:"Bank"}); commit(rows,a,null,[],type,acct,{t:inv?"Invested":"Redeemed",s:`${name} · ${rs(a,false)}`}); };
    if(q&&a) return done(null);
    const btn=$("dSave"); btn.disabled=true; btn.textContent="Getting the NAV…";
    navOn(name,A.date).then(done,()=>{ btn.disabled=false; btn.textContent=inv?"Save":"Save withdrawal"; if(!a) return err("Couldn't get the NAV just now. Type the amount received."); done(null); });
    return; }
  else if(type==="cash") rows.push({...base,type:inv?"Add money":"Withdraw",amt,via:"Bank"});
  else if(type==="nps") rows.push({...base,name:"NPS Tier I",type:inv?"Add money":"Withdraw",amt,via:"Bank"});
  else if(type==="term") rows.push({...base,who:"Aditya",acct:"Insurance",name:"Term plan",type:"Premium",amt,via:"Bank"});
  else if((type==="bond"||type==="fd")&&!inv){ if(!name) return err("Pick the bond."); const tds=numIn(d.net);
    rows.push({...base,type:"Payout",amt:r2(amt+tds),via:"Bank",note:(base.note+` [p 0] [tds ${tds}]`+(tds?` [net ${amt}]`:"")).trim()}); }
  else if(type==="bond"||type==="fd"){ if(!name) return err(type==="fd"?"Type the bank or FD name.":"Type the bond's name.");
    let S;
    if(type==="fd"){ const r=numIn(d.rate); if(!(r>0)) return err("Type the interest rate."); if(!d.end||d.end<=A.date) return err("Pick the maturity date."); S=fdSched(amt,r,A.date,d.end,d.fdPay); }
    else { const R=(d.reps||[]).filter(r=>r.d).map(r=>({d:r.d,a:numIn(r.a)})).sort((x,y)=>x.d<y.d?-1:1);
      if(!R.length) return err("Add at least one repayment date, or fill from screenshots."); if(R.some(r=>r.d<=A.date)) return err("Repayment dates should be after the purchase date.");
      const ex=SUM(R,r=>r.a); S=R.map((r,k)=>({d:r.d,p:k===R.length-1?Math.min(amt,r.a):0,i:k===R.length-1?Math.max(0,r.a-amt):r.a})); if(ex<amt) S=R.map(r=>({d:r.d,p:ex?amt*r.a/ex:0,i:0})); }
    rows.push({...base,type:"Buy",amt,via:"Bank",note:(base.note+(type==="fd"?` ${numIn(d.rate)}% · matures ${fmtD(d.end)}`:"")).trim()});
    const key=acct+"|"+name; recOp={id:"bond:"+key,kind:"bond",title:name,data:{sched:S,remind:d.remind,acct,who:A.who,name,platform:platOf(acct),ytm:type==="fd"?numIn(d.rate):undefined,fd:type==="fd"?1:undefined}};
    if(d.remind==="cal") cal=bondCal(key,name,acct,S.map(e=>({d:e.d,a:e.p+e.i}))); }
  else if(type==="other"){ if(!name) return err("Type what it is."); const a=numIn(d.amt); if(!(a>0)) return err(inv?"Type the amount put in.":"Type the amount taken out.");
    if(!inv){ rows.push({...base,type:d.kind==="i"?"Payout":"Withdraw",amt:a,via:"Bank"}); return commit(rows,a,null,[],type,acct,{t:"Saved",s:`${name} · ${rs(a,false)} out`}); }
    const dated=d.till==="date"||d.ret==="sum";
    if(dated&&(!d.end||d.end<=A.date)) return err("Pick the date the money comes back.");
    if(d.ret==="rate"&&!(numIn(d.rate)>0)) return err("Type the rate (% a year).");
    if(d.ret==="sum"&&!(numIn(d.exp)>0)) return err("Type the amount you get back.");
    if(dated&&(d.ret==="rate"||d.ret==="sum")){ /* fixed income with a date → tracked with bonds & FDs, payouts confirmed from the bell */
      const S=d.ret==="sum"?[{d:d.end,p:a,i:Math.max(0,r2(numIn(d.exp)-a))}]:fdSched(a,numIn(d.rate),A.date,d.end,d.fdPay,d.comp);
      rows.push({...base,asset:"Fixed income",type:"Buy",amt:a,via:"Bank",note:(base.note+(d.ret==="rate"?` ${numIn(d.rate)}%`:"")+` · returns ${fmtD(d.end)}`).trim()});
      const key=acct+"|"+name; recOp={id:"bond:"+key,kind:"bond",title:name,data:{sched:S,remind:d.remind,acct,who:A.who,name,platform:platOf(acct),ytm:d.ret==="rate"?numIn(d.rate):undefined,fd:1,other:1}};
      if(d.remind==="cal") cal=bondCal(key,name,acct,S.map(e=>({d:e.d,a:e.p+e.i})));
      return commit(rows,a,recOp,cal,type,acct,{t:"Saved",s:`${name} · ${rs(a,false)} · back ${fmtDs(d.end)}`}); }
    rows.push({...base,type:"Buy",amt:a,via:"Bank"});
    recOp={id:"oth:"+acct+"|"+name,kind:"oth",title:name,data:{acct,who:A.who,name,ret:d.ret,rate:d.ret==="rate"?numIn(d.rate):0,comp:d.comp,till:d.till,end:d.till==="date"?d.end:""}};
    return commit(rows,a,recOp,[],type,acct,{t:"Saved",s:`${name} · ${rs(a,false)}`}); }
  commit(rows,amt,recOp,cal,type,acct); }
const ADDED={stocks:"Stocks",us:"US Stocks",mf:"Mutual Funds",bond:"Bonds",fd:"Fixed Deposits",cash:"your balance",nps:"NPS",other:"Other investments"};
const lakhs=n=>n>=100?(n/100).toFixed(n%100?2:0).replace(/\.?0+$/,"")+" crore":n+" lakh";
/* one line of encouragement when there is something real to say: a lakh crossed, a fund bought month after month, a busy month */
function milestone(rows,t0,t1){ try{
  if(t0!=null&&t1!=null&&t1>t0&&Math.floor(t1/1e5)>Math.floor(t0/1e5)) return "Crossed ₹"+lakhs(Math.floor(t1/1e5))+" put in";
  const r=rows.find(x=>x.type==="Buy"); if(!r) return "";
  const led=(DATA&&DATA.led)||[], mo=d=>String(d||"").slice(0,7), prev=m=>{ const y=+m.slice(0,4), k=+m.slice(5,7); return k===1?(y-1)+"-12":y+"-"+pad2(k-1); };
  if(r.asset==="Mutual Funds"&&r.name){ const has=new Set(led.filter(x=>x[4]==="Mutual Funds"&&x[5]==="Buy"&&x[6]===r.name).map(x=>mo(x[1]))); let m=mo(r.date), n=1; while(has.has(m=prev(m))) n++;
    if(n>=2) return "Month "+n+" in a row for this fund"; }
  const n=led.filter(x=>x[5]==="Buy"&&mo(x[1])===mo(r.date)&&x[12]!=="nps").length+rows.filter(x=>x.type==="Buy").length;
  return n>=2?["","","2nd","3rd"][n]||n+"th":""; }catch(e){ return ""; } }
function commit(rows,amt,recOp,cal,type,acct,yay){
  const out=A.mode==="out", t0=M?totals("all").put:null;
  if(recOp) OUT.push({kind:"rec",ops:[recOp],rid:rid()}); if(cal.length) queueCal(cal);
  store.set("acct:"+type,acct);
  OUT.push({kind:"add",rows,rid:rid()}); saveOut(); ov.back(); refresh();
  const t1=M?totals("all").put:null, grew=t0!=null&&t1!=null&&t1>t0+.5; let mile=out?"":milestone(rows,t0,grew?t1:null); if(/^\d+(nd|rd|th)$/.test(mile)) mile+=" investment this month";
  const title=yay?yay.t:out?"Recorded":type==="term"?"Premium recorded":"Added to "+(ADDED[type]||"Artha");
  celebrate(title,yay?yay.s:(out?rs(amt,false)+" taken out":"Saved to your sheet"),{amt:out||type==="term"?0:amt,out,t0:grew?t0:null,t1:grew?t1:null,mile}); flush(); }
/* a small win: tick + confetti burst on every saved entry */
const CHEERS=["Nicely done.","Every rupee counted.","Your future self says thanks.","Building, one entry at a time.","That's tracked.","Steady wins."];
/* numbers roll up to their new value */
function countUp(el,a,b,ms,fmt){ if(!el) return; if(calm()){ el.textContent=fmt(b); return; } const t0=performance.now();
  const step=now=>{ const k=Math.min(1,(now-t0)/ms), e=1-Math.pow(1-k,3); el.textContent=fmt(a+(b-a)*e); if(k<1&&el.isConnected) requestAnimationFrame(step); }; requestAnimationFrame(step); }
/* the new money flies from the + button into the ring */
function flyCoin(){ const f=$("addBtn"), st=$("stage"); if(!f||!f.animate) return; const a=f.getBoundingClientRect(), s=st&&st.offsetHeight&&!isOpen($("scr"))?st.getBoundingClientRect():null;
  const x0=a.left+a.width/2, y0=a.top+a.height/2, x1=s?s.left+s.width/2:innerWidth/2, y1=s?s.top+s.height*.52:innerHeight*.32;
  [0,90,180].forEach((d,i)=>{ const c=document.createElement("i"); c.className="coin"; c.textContent="₹"; c.setAttribute("aria-hidden","true"); c.style.left=x0+"px"; c.style.top=y0+"px"; document.body.appendChild(c);
    const mx=(x1-x0)*.5+(i-1)*46, my=(y1-y0)-70-i*18;
    c.animate([{transform:"translate(-50%,-50%) scale(.6)",opacity:0},{transform:"translate(-50%,-50%) scale(1.1)",opacity:1,offset:.12},{transform:`translate(calc(-50% + ${mx}px),calc(-50% + ${my}px)) scale(1.2) rotateY(360deg)`,opacity:1,offset:.6},{transform:`translate(calc(-50% + ${x1-x0}px),calc(-50% + ${y1-y0}px)) scale(.25) rotateY(720deg)`,opacity:0}],{duration:950,delay:d,easing:"cubic-bezier(.3,.7,.3,1)",fill:"both"}).onfinish=()=>c.remove(); }); }
/* after a save: a tick, the amount rolling up, what it was added to, the new total and (when earned) a milestone.
   It never blocks: touches pass straight through it, and the next touch anywhere sends it away. A withdrawal gets a quiet tick only. */
function celebrate(title,sub,o){ o=o||{}; const quiet=!!o.out, big=!quiet&&o.amt>0;
  if(navigator.vibrate) navigator.vibrate(quiet?[8]:big?[10,40,18,70,26]:[10,40,18]);
  document.querySelectorAll(".yay").forEach(n=>n.remove());
  const y=document.createElement("div"); y.className="yay"+(quiet?" quiet":"")+(big?" big":"");
  y.innerHTML=`<span class="tick"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></span>${big?`<b class="yamt num" id="yAmt">${HIDE?"+₹••••":esc("+"+rs(0,false))}</b>`:""}<b>${esc(title)}</b><small>${esc(sub)}</small>${big&&o.t1!=null?`<small class="ytot">Total put in <span class="num" id="yTot">${HIDE?"₹••••":esc(rs(o.t0,false))}</span></small>`:""}${o.mile&&!quiet?`<span class="ymile">${esc(o.mile)}</span>`:""}${quiet?"":`<small style="color:var(--neon)">${esc(CHEERS[Math.floor(Math.random()*CHEERS.length)])}</small>`}`;
  document.body.appendChild(y);
  let gone=false; const bye=()=>{ if(gone) return; gone=true; removeEventListener("pointerdown",bye,true); y.classList.add("bye"); setTimeout(()=>y.remove(),400); };
  setTimeout(bye,quiet?1500:big?2800:1900); setTimeout(()=>{ if(!gone) addEventListener("pointerdown",bye,true); },450);
  if(big&&!HIDE){ countUp($("yAmt"),0,o.amt,750,v=>"+"+rs(v,false)); if(o.t1!=null) setTimeout(()=>countUp($("yTot"),o.t0,o.t1,950,v=>rs(v,false)),550); }
  if(quiet) return;
  if(!calm()){ S3.pulse&&S3.pulse(big?2.2:1.2); if(big){ flyCoin(); const st=$("stage"); if(st){ st.classList.remove("swell"); void st.offsetWidth; st.classList.add("swell"); } } }
  if(calm()) return;
  const c=document.createElement("canvas"); c.className="cele"; document.body.appendChild(c); const dpr=Math.min(2,devicePixelRatio||1); c.width=innerWidth*dpr; c.height=innerHeight*dpr; const g=c.getContext("2d"); g.scale(dpr,dpr);
  const cols=["#3CF0D4","#8B7CFF","#FFB547","#5B8CFF","#2EE6B0","#FF6FA8"], ox=innerWidth/2, oy=innerHeight*.38;
  const P=Array.from({length:110},(_,i)=>{ const a=-Math.PI/2+(Math.random()-.5)*Math.PI*1.25, v=7+Math.random()*9; return {x:ox,y:oy,vx:Math.cos(a)*v,vy:Math.sin(a)*v,r:Math.random()*Math.PI,vr:(Math.random()-.5)*.4,w:5+Math.random()*6,h:3+Math.random()*4,c:cols[i%cols.length],s:i%4===0}; });
  let t0=performance.now(); const step=now=>{ const k=(now-t0)/1000; g.clearRect(0,0,innerWidth,innerHeight);
    P.forEach(p=>{ p.vy+=.32; p.vx*=.985; p.vy*=.985; p.x+=p.vx; p.y+=p.vy; p.r+=p.vr; g.save(); g.globalAlpha=Math.max(0,1-k/2.2); g.translate(p.x,p.y); g.rotate(p.r); g.fillStyle=p.c;
      if(p.s){ g.beginPath(); g.arc(0,0,p.h*.7,0,Math.PI*2); g.fill(); } else g.fillRect(-p.w/2,-p.h/2,p.w,p.h); g.restore(); });
    if(k<2.3) requestAnimationFrame(step); else c.remove(); }; requestAnimationFrame(step); }

/* ---------- sync ---------- */
let loading=false, flushing=false, PAINTED=false;
function setSync(kind,txt){ $("syncLine").className=kind||""; $("syncTxt").textContent=txt; }
const fmtWhen=t=>{ if(!t) return "never"; const m=Math.round((Date.now()-t)/6e4); return m<1?"just now":m<60?m+" min ago":m<1440?Math.round(m/60)+" h ago":new Date(t).toLocaleDateString("en-IN",{day:"numeric",month:"short"}); };
const liveLine=()=>`Synced ${fmtWhen(CACHE_AT)}`+(OUT.length?` · ${OUT.length} waiting`:"")+(FAILED.length?` · ${FAILED.length} not saved`:"")+(CHECKS().length?" · check the bell":"");
/* the sheet copy is compared with the one already on screen (ignoring only the time it was sent), so an unchanged sync redraws nothing */
const dataKey=d=>{ try{ return JSON.stringify(d,(k,v)=>k==="at"?undefined:v); }catch(e){ return ""; } };
const sameData=(a,b)=>!!(a&&b&&PAINTED&&dataKey(a)===dataKey(b));
function applyData(d){ if(!d) return;
  if(d.same){ if(!DATA) return; CACHE_AT=Date.now(); store.set("cacheAt",CACHE_AT); setSync(OUT.length||FAILED.length?"warn":"live",liveLine()); return; }
  if(d.v!==3){ DATA=d; refresh(); setSync("warn","Paste the new Artha backend (v3) and run setupV3() to see your data"); return; }
  const prev=DATA, same=sameData(prev,d); DATA=d; CACHE_AT=Date.now(); store.set("cacheAt",CACHE_AT); if(!same){ store.set("cache",d); refresh(); } setSync(OUT.length||FAILED.length?"warn":"live",liveLine()); refreshNavs();
  reconcile(d,prev).catch(()=>{}); }
function errText(e){ const m=String(e&&e.message||e||"");
  if(/SIGNIN/.test(m)){ store.set("tok",""); askPass(m.replace(/^SIGNIN:\s*/,"")); return "Please sign in."; }
  if(/Locked/.test(m)){ if(!$("gate").hidden) $("gErr").textContent=m; return m; } return m||"Couldn't reach Google just now."; }
const ACTION={add:"add",edit:"edit",del:"del",rec:"rec",cal:"cal"};
function flush(){ if(flushing||!PW()||!API()||!OUT.length) return;
  if(DATA&&DATA.v!==3){ setSync("warn","Waiting for the Artha backend update · "+OUT.length+" saved on this phone"); return; }
  const it=OUT[0]; if(!ACTION[it.kind]){ OUT.shift(); saveOut(); flush(); return; }
  flushing=true;
  const e=it.kind==="add"?{rows:it.rows,rid:it.rid}:it.kind==="del"?{id:it.id,rid:it.rid}:it.kind==="edit"?{id:it.id,row:it.row,rid:it.rid}:{ops:it.ops,rid:it.rid};
  if(!it.at){ it.at=Date.now(); saveOut(); }
  call(ACTION[it.kind],{e}).then(d=>{ flushing=false; OUT.splice(OUT.indexOf(it),1); saveOut(); verifyWrite(it,d); applyData(d); flush(); },x=>{ flushing=false; const m=String(x&&x.message||x);
    if(x&&x.net){ setSync("warn",`Offline · ${OUT.length} waiting to sync`); return; } if(/SIGNIN|Locked/.test(m)){ setSync("warn",errText(x)); return; }
    if(/Unknown action/i.test(m)){ setSync("warn","Waiting for the Artha backend update · "+OUT.length+" saved on this phone"); return; }
    /* the sheet refused it: keep it on this phone (bell › Data checks) instead of losing it */
    OUT.splice(OUT.indexOf(it),1); saveOut(); FAILED.push(Object.assign({},it,{err:m,failedAt:Date.now()})); saveFailed(); refresh(); showToast(`Not saved: ${m} · kept in the bell to retry`,7000); flush(); }); }

addEventListener("online",()=>{ flush(); pull(); });
function pull(){ if(loading) return Promise.resolve(); if(!API()){ askPass(null,true); return Promise.resolve(); } if(!PW()){ askPass(); return Promise.resolve(); } flush(); loading=true;
  setSync("busy",DATA?`Synced ${fmtWhen(CACHE_AT)} · updating…`:"Loading your sheet…");
  /* the backend answers with a few bytes ("same") when nothing changed since the copy this phone holds */
  return call("get",{e:{stamp:(DATA&&DATA.stamp)||""}}).then(d=>{ loading=false; applyData(d); flush(); },e=>{ loading=false; const m=errText(e);
    setSync("warn",e&&e.net&&DATA?`Offline · copy from ${fmtWhen(CACHE_AT)}`:m); }); }
/* ---------- sign in with Google: the backend checks the account and gives this phone its own session key ---------- */
const CLIENT_ID="816088287548-9r600bocno2f00uf2p319cdg0f8bcov7.apps.googleusercontent.com";
let gsi=null;
function loadGSI(){ return gsi||(gsi=new Promise((ok,bad)=>{ const s=document.createElement("script"); s.src="https://accounts.google.com/gsi/client"; s.async=true; s.onload=ok; s.onerror=()=>{ gsi=null; bad(); }; document.head.appendChild(s); })); }
function askPass(msg,needLink){ const need=needLink||!API(); $("gLink").hidden=!need;
  $("gMsg").textContent=need?"Open the private setup link once (or paste it here), then sign in with Google.":"Sign in with your Google account (once on this phone).";
  $("gErr").textContent=msg||""; $("gate").hidden=false; $("gGo").hidden=!need;
  if(need){ setTimeout(()=>$("gLink").focus(),50); $("gBtn").innerHTML=""; return; }
  loadGSI().then(()=>{ google.accounts.id.initialize({client_id:CLIENT_ID,callback:onCred,ux_mode:"popup",auto_select:true,itp_support:true});
    const b=$("gBtn"); b.innerHTML=""; google.accounts.id.renderButton(b,{theme:"filled_blue",size:"large",shape:"pill",text:"signin_with",width:260}); })
  .catch(()=>{ $("gErr").textContent="Couldn't load Google sign-in. Check your internet and reopen Artha."; }); }
function onCred(resp){ $("gErr").textContent="Signing in…";
  call("login",{e:{idToken:resp.credential}}).then(d=>{ store.set("tok",d.tok); store.set("me",d.name); store.set("email",d.email);
      $("gErr").textContent=""; $("gate").hidden=true; LOCK.unlock(); showToast(`Signed in as ${d.name}`); pull(); if(LOCK.can()&&!store.get("bioId","")&&!store.get("bioAsked",false)) setTimeout(offerLock,900); },
    e=>{ const m=String(e&&e.message||e);
      if(/Unknown action/i.test(m)){ $("gErr").textContent="Google sign-in isn't switched on in the backend yet."; return; }
      $("gErr").textContent=m.replace(/^SIGNIN:\s*/,""); }); }
$("gForm").addEventListener("submit",e=>{ e.preventDefault();
  if(!$("gLink").hidden){ if(!takeLink($("gLink").value)){ $("gErr").textContent="That doesn't look like the Artha setup link."; return; } $("gLink").value=""; askPass(); } });

/* ---------- app lock: the phone's own fingerprint / face check (WebAuthn, nothing leaves the phone) ---------- */
const b64u=b=>btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
const ub64=s=>Uint8Array.from(atob(s.replace(/-/g,"+").replace(/_/g,"/")),c=>c.charCodeAt(0));
const LOCK={ locked:false, hiddenAt:0, AFTER:60000,
  can:()=>!!(window.PublicKeyCredential&&navigator.credentials&&window.isSecureContext),
  on:()=>!!store.get("bioId",""),
  show(){ if(!LOCK.on()) return; LOCK.locked=true; document.documentElement.classList.remove("prelock"); LOCK.seen(0); document.documentElement.classList.add("locked"); $("lock").hidden=false; $("lockErr").textContent="";
    /* clear the figures from the page itself (not just cover them); they are drawn again after the fingerprint check */
    ["legend","ledger","viewIns","scrBody","res"].forEach(id=>{ const n=$(id); if(n) n.innerHTML=""; });
    ["f0","f1","f2"].forEach(id=>{ const n=$(id); if(n) n.querySelectorAll(".num,b,strong").forEach(x=>{ x.textContent="••••"; }); }); },
  /* a pull-to-refresh or reload in the same session, within a minute of last use, does not ask again; a fresh open always does */
  seen(t){ try{ if(t) sessionStorage.setItem("arthaSeen",String(t)); else sessionStorage.removeItem("arthaSeen"); }catch(e){} },
  recent(){ try{ const t=+sessionStorage.getItem("arthaSeen")||0; return t>0&&Date.now()-t<LOCK.AFTER; }catch(e){ return false; } },
  unlock(){ const was=LOCK.locked; LOCK.locked=false; LOCK.seen(Date.now()); document.documentElement.classList.remove("locked","veil","prelock"); $("lock").hidden=true; if(!PAINTED) soon3D(700).then(firstPaint); else if(was&&DATA) refresh(); } };
async function bioCreate(){ const cred=await navigator.credentials.create({publicKey:{challenge:crypto.getRandomValues(new Uint8Array(32)),rp:{name:"Artha"},
  user:{id:crypto.getRandomValues(new Uint8Array(16)),name:store.get("email","")||"artha",displayName:"Artha · "+(store.get("me","")||"me")},
  pubKeyCredParams:[{type:"public-key",alg:-7},{type:"public-key",alg:-257}],
  authenticatorSelection:{authenticatorAttachment:"platform",userVerification:"required",residentKey:"discouraged"},timeout:60000,attestation:"none"}});
  if(!cred) throw new Error("Not set up"); store.set("bioId",b64u(cred.rawId)); }
async function bioCheck(){ const a=await navigator.credentials.get({publicKey:{challenge:crypto.getRandomValues(new Uint8Array(32)),allowCredentials:[{type:"public-key",id:ub64(store.get("bioId",""))}],userVerification:"required",timeout:60000}});
  const fl=a?new Uint8Array(a.response.authenticatorData)[32]:0; if((fl&0x05)!==0x05) throw new Error("Fingerprint or face wasn't confirmed."); } // user present + user verified
async function unlockNow(){ $("lockErr").textContent=""; try{ await bioCheck(); LOCK.unlock(); if(Date.now()-CACHE_AT>60000) pull(); }catch(e){ $("lockErr").textContent=e&&e.name==="NotAllowedError"?"Cancelled. Tap Unlock to try again.":String(e&&e.message||e); } }
$("lockBtn").onclick=unlockNow;
$("lockAlt").onclick=()=>{ store.set("tok",""); $("lock").hidden=true; askPass("Sign in with Google to open Artha."); };
function lockOnStart(){ if(LOCK.on()&&!LOCK.recent()){ LOCK.show(); setTimeout(unlockNow,60); return true; } if(LOCK.on()) LOCK.seen(Date.now()); document.documentElement.classList.remove("locked","prelock"); return false; }
addEventListener("pagehide",()=>{ if(!LOCK.locked&&LOCK.on()&&document.visibilityState==="visible") LOCK.seen(Date.now()); }); // only a reload while in use, not a page dropped in the background
function offerLock(){ store.set("bioAsked",true);
  openE(`<div class="t big">Lock Artha with your fingerprint?</div><div class="s" style="text-align:left">Artha will ask for your fingerprint or face each time you open it, and after a minute in the background. You can turn it off in the menu.</div><button class="go" type="button" id="olY">Turn on</button><button class="x" type="button" id="olN">Not now</button>`);
  $("olY").onclick=async()=>{ try{ await bioCreate(); ov.back(); showToast("Fingerprint lock is on"); buildDrawer&&isOpen($("drawer"))&&buildDrawer(); }catch(e){ showToast(e&&e.name==="NotAllowedError"?"Cancelled":"This phone couldn't set up the lock: "+(e&&e.message||e),5000); } };
  $("olN").onclick=()=>ov.back(); }
async function setLock(on){ if(on){ if(!LOCK.can()){ showToast("This browser can't use the fingerprint lock."); return; } try{ await bioCreate(); showToast("Fingerprint lock is on"); }catch(e){ showToast(e&&e.name==="NotAllowedError"?"Cancelled":"Couldn't set it up: "+(e&&e.message||e),5000); } }
  else { try{ await bioCheck(); store.set("bioId",""); showToast("Fingerprint lock is off"); }catch(e){ showToast("Confirm with your fingerprint to turn the lock off.",4000); } }
  buildDrawer(); }
/* amounts are veiled the moment Artha goes to the background (app switcher), and it locks after a minute away */
document.addEventListener("visibilitychange",()=>{ if(document.visibilityState==="hidden"){ LOCK.hiddenAt=Date.now(); if(!LOCK.locked&&LOCK.on()) LOCK.seen(LOCK.hiddenAt); if(LOCK.on()) document.documentElement.classList.add("veil"); }
  else { if(LOCK.on()&&LOCK.hiddenAt&&Date.now()-LOCK.hiddenAt>LOCK.AFTER){ LOCK.show(); setTimeout(unlockNow,300); } else if(!LOCK.locked) document.documentElement.classList.remove("veil"); } });

/* ---------- saves that the sheet refused: kept here until retried or discarded ---------- */
let FAILED=store.get("failed",[]); const saveFailed=()=>store.set("failed",FAILED);
let ISSUES=store.get("issues",[]); const saveIssues=()=>store.set("issues",ISSUES.slice(-80));
function issue(x){ if(ISSUES.some(i=>i.key===x.key)) return; ISSUES.push(Object.assign({id:rid(),at:Date.now()},x)); saveIssues(); }
const descRow=r=>r?`${r.type||r[5]} · ${r.name||r[6]||r.asset||r[4]||""} · ₹${Number(r.amt!=null?r.amt:r[10]||0).toLocaleString("en-IN")} · ${r.date||r[1]||"no date"} · ${r.acct||r[3]||""}`:"";
/* everything the bell shows under "Data checks" */
function CHECKS(){ const L=[];
  FAILED.forEach(f=>L.push({id:"f:"+f.rid,sev:"bad",title:"Not saved to the sheet",sub:`${f.kind==="add"?(f.rows||[]).map(descRow).join("; "):f.kind+" "+(f.id||"")} · ${f.err}`}));
  OUT.filter(o=>o.at&&Date.now()-o.at>864e5).forEach(o=>L.push({id:"o:"+o.rid,sev:"due",title:"Waiting to sync for over a day",sub:o.kind==="add"?(o.rows||[]).map(descRow).join("; "):o.kind}));
  ISSUES.forEach(i=>L.push({id:"i:"+i.id,sev:i.sev||"due",title:i.title,sub:i.sub}));
  if(M) polMisfiled().forEach(x=>L.push({id:"p:"+x.p.id,sev:"due",title:`${x.p.d.title}: is this a ${LBL0["t_"+x.g]} policy?`,sub:`It is filed under ${LBL0["t_"+p_type(x.p)]}, but its details read like ${LBL0["t_"+x.g]} · tap to choose`}));
  ((DATA&&DATA.chk)||[]).forEach(c=>L.push({id:"c:"+c[0],sev:"due",title:`Sheet row ${c[1]} (${c[0]}) needs fixing`,sub:c[2]+" · fix it in the sheet; Artha may count it wrongly until then"}));
  return L; }
function openCheck(cid){ const x=CHECKS().find(c=>c.id===cid); if(!x) return; const k=cid.slice(0,2);
  let btns=`<button class="x" type="button" data-close>Close</button>`;
  if(k==="f:") btns=`<button class="go" type="button" id="ckRetry">Try saving again</button><button class="x danger" type="button" id="ckDrop">Discard this change</button>`+btns;
  if(k==="i:") btns=`<button class="go" type="button" id="ckOk">I've checked it · dismiss</button>`+btns;
  const mis=k==="p:"?polMisfiled().find(z=>"p:"+z.p.id===cid):null;
  if(mis) btns=`<button class="go" type="button" id="ckMove">Move to ${esc(LBL0["t_"+mis.g])}</button><button class="x" type="button" id="ckKeep">Keep under ${esc(LBL0["t_"+p_type(mis.p)])}</button>`+btns;
  if(k==="c:"&&M&&M.url) btns=`<a class="go" href="${esc(safeUrl(M.url))}" target="_blank" rel="noopener noreferrer">Open the sheet</a>`+btns;
  const it=k==="i:"?ISSUES.find(i=>"i:"+i.id===cid):null;
  openE(`<div class="t big">${esc(x.title)}</div><div class="s" style="text-align:left;white-space:pre-wrap">${esc(it&&it.detail||x.sub)}</div>${btns}`);
  if(mis){ $("ckMove").onclick=()=>{ ov.back(); setPolType(mis.p,mis.g,false); showToast(`Moved to ${LBL0["t_"+mis.g]}`); }; $("ckKeep").onclick=()=>{ ov.back(); setPolType(mis.p,"",true); }; }
  const r=$("ckRetry"); if(r) r.onclick=()=>{ const f=FAILED.find(f=>"f:"+f.rid===cid); FAILED=FAILED.filter(z=>z!==f); saveFailed(); if(f){ delete f.err; delete f.failedAt; f.rid=rid(); OUT.push(f); saveOut(); } ov.back(); refresh(); flush(); };
  const dr=$("ckDrop"); if(dr) dr.onclick=()=>confirmSheet("Discard this change?","It was never saved to the sheet. Discarding removes it from this phone too.","Discard",()=>{ FAILED=FAILED.filter(f=>"f:"+f.rid!==cid); saveFailed(); ov.back(); ov.back(); refresh(); });
  const ok=$("ckOk"); if(ok) ok.onclick=()=>{ ISSUES=ISSUES.filter(i=>"i:"+i.id!==cid); saveIssues(); ov.back(); refresh(); }; }

/* ---------- confirm every save: the sheet's copy must match what this phone sent ---------- */
const same=(a,b)=>Math.abs((+a||0)-(+b||0))<0.005;
function verifyWrite(it,d){ if(!d||!d.led) return; const byId=new Map(d.led.map(r=>[r[0],r]));
  const bad=(title,detail)=>issue({key:"v:"+it.rid,sev:"bad",title,sub:"Saved, but the sheet's copy differs · tap to see",detail});
  if(it.kind==="add"&&Array.isArray(d.added)){ const rows=it.rows||[];
    if(d.added.length!==rows.length) return bad("Some entries may not have saved",`Sent ${rows.length}, the sheet confirmed ${d.added.length}.\n`+rows.map(descRow).join("\n"));
    const off=rows.map((r,i)=>{ const s=byId.get(d.added[i]); return !s?`${d.added[i]}: missing in the sheet`:(!same(s[10],r.amt)||s[1]!==r.date||s[5]!==r.type||s[3]!==r.acct)?`${d.added[i]}: sent ${descRow(r)} · sheet has ${descRow(s)}`:""; }).filter(Boolean);
    if(off.length) bad("A saved entry doesn't match",off.join("\n")); }
  if(it.kind==="edit"&&it.row){ const s=byId.get(it.id); if(!s) bad("An edited entry is missing",`${it.id} isn't in the sheet after the edit.`);
    else if(!same(s[10],it.row.amt)||s[1]!==it.row.date||s[5]!==it.row.type) bad("An edit doesn't match",`${it.id}: sent ${descRow(it.row)} · sheet has ${descRow(s)}`); }
  if(it.kind==="del"&&byId.has(it.id)) bad("A deleted entry is still in the sheet",`${it.id}: ${descRow(byId.get(it.id))}`);
  if(it.kind==="rec"){ const ids=new Set((d.rec||[]).map(r=>r[0])); const miss=(it.ops||[]).filter(o=>!o.del&&!ids.has(o.id)); if(miss.length) bad("A record didn't save",miss.map(o=>o.title||o.id).join("\n")); } }

/* ---------- reconciliation on every sync ----------
   1. fingerprints: the phone recomputes the sheet's per-account count, total and SHA-256 from the rows it received;
      any difference means the copy on this phone is incomplete or damaged.
   2. outside edits: rows that changed since the last sync with no matching entry in the backend's Audit log
      were changed directly in the sheet (or by something other than the app), so they are listed for a look. */
async function sha16(s){ const b=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(s)); return Array.from(new Uint8Array(b)).map(x=>x.toString(16).padStart(2,"0")).join("").slice(0,16); }
const canon=r=>r.slice(0,13).map(v=>v===""||v==null?"":String(v)).join("\u001f");
async function reconcile(d,prev){ if(!d.fp||!crypto.subtle) return;
  const led=d.led.slice().sort((a,b)=>a[0]<b[0]?-1:a[0]>b[0]?1:0), U={}, all=[];
  led.forEach(r=>{ const k=r[3]+"|"+r[2], c=canon(r); all.push(c); (U[k]||(U[k]={n:0,s:0,c:[]})); U[k].n++; U[k].s+=Number(r[10])||0; U[k].c.push(c); });
  const diffs=[]; if(all.length!==d.fp.n||await sha16(all.join("\u001e"))!==d.fp.h){
    const keys=new Set(Object.keys(U).concat(Object.keys(d.fp.u||{})));
    for(const k of keys){ const a=U[k], b=(d.fp.u||{})[k]; const h=a?await sha16(a.c.join("\u001e")):"";
      if(!a||!b||a.n!==b.n||!same(Math.round(a.s*100)/100,b.s)||h!==b.h) diffs.push(`${k.split("|").join(" · ")}: phone ${a?a.n:0} rows ₹${a?Math.round(a.s).toLocaleString("en-IN"):0} · sheet ${b?b.n:0} rows ₹${b?Math.round(b.s).toLocaleString("en-IN"):0}`); } }
  ISSUES=ISSUES.filter(i=>i.key!=="fp"); if(diffs.length) issue({key:"fp",sev:"bad",title:"Phone and sheet don't agree",sub:"Pull to refresh; if it stays, tap for details",detail:diffs.join("\n")}); saveIssues();
  /* outside edits */
  const snap=store.get("snap",null), now={}; led.forEach(r=>now[r[0]]=canon(r));
  if(snap&&snap.rows&&Array.isArray(d.audit)){ const since=Date.parse(snap.at||0)-5*60000, seen=new Set(d.audit.filter(a=>Date.parse(a[0])>=since).map(a=>a[3]));
    const prevRow=new Map(((prev&&prev.led)||[]).map(r=>[r[0],r])), ch=[];
    Object.keys(now).forEach(id=>{ if(snap.rows[id]!==now[id]&&!seen.has(id)) ch.push(snap.rows[id]==null?`Added ${id}: ${descRow(d.led.find(r=>r[0]===id))}`:`Changed ${id}: was ${descRow(prevRow.get(id))||"?"} · now ${descRow(d.led.find(r=>r[0]===id))}`); });
    Object.keys(snap.rows).forEach(id=>{ if(now[id]==null&&!seen.has(id)) ch.push(`Removed ${id}: ${descRow(prevRow.get(id))||"(details not on this phone)"}`); });
    if(ch.length) issue({key:"x:"+d.at,sev:"due",title:`${ch.length} entr${ch.length===1?"y":"ies"} changed outside the app`,sub:"Edited straight in the sheet · tap to check they're right",detail:ch.slice(0,40).join("\n")+(ch.length>40?`\n…and ${ch.length-40} more`:"")}); }
  store.set("snap",{at:d.at,rows:now}); paintBell(); setSync(OUT.length||FAILED.length?"warn":"live",liveLine()); }

/* ---------- chrome: tabs, header, scroll, pull to refresh, drawer ---------- */
let tt; function showToast(t,ms){ const el=$("toast"); el.textContent=t; el.hidden=false; el.style.animation="none"; void el.offsetWidth; el.style.animation=""; clearTimeout(tt); tt=setTimeout(()=>el.hidden=true,ms||2800); }
let TAB_NOW=store.get("tab","inv"); if(!["inv","ins"].includes(TAB_NOW)) TAB_NOW="inv";
function setTab(t){ TAB_NOW=t; store.set("tab",t); $("viewInv").hidden=t!=="inv"; $("viewIns").hidden=t!=="ins"; fitHome(); $("tabInv").setAttribute("aria-pressed",String(t==="inv")); $("tabIns").setAttribute("aria-pressed",String(t==="ins"));
  S3.theme(t==="ins"?"ins":"home"); if(t==="ins") renderIns(); else renderHome(); scrollTo({top:0}); }
$("tabInv").onclick=()=>setTab("inv"); $("tabIns").onclick=()=>setTab("ins");
$("addBtn").onclick=()=>{ if(SC&&isOpen($("scr"))&&SC.h==="pol") return policyUpload(SC.id,"renew"); if(TAB_NOW==="ins"&&!(SC&&isOpen($("scr")))) return addPolicy(); openAdd("in",SC&&isOpen($("scr"))&&SC.h!=="pol"?(SC.h==="NPS"?{type:"nps"}:{a:SC.h}):{}); };
function upCheck(){ const inScr=isOpen($("scr")), y=inScr?$("scrBody").scrollTop:scrollY; S3.scroll(y); }
addEventListener("scroll",upCheck,{passive:true}); $("scrBody").addEventListener("scroll",upCheck,{passive:true});

(()=>{ let y0=null, pulling=false, dist=0; const ptr=$("ptr");
  addEventListener("touchstart",e=>{ if(scrollY<=0&&!isOpen($("scr"))&&!isOpen($("addSheet"))&&!isOpen($("eSheet"))&&!isOpen($("sheet"))&&!isOpen($("drawer"))&&!e.target.closest(".stage")){ y0=e.touches[0].clientY; pulling=true; dist=0; } },{passive:true});
  addEventListener("touchmove",e=>{ if(!pulling) return; dist=Math.max(0,e.touches[0].clientY-y0); if(scrollY>0){ pulling=false; dist=0; } const h=Math.min(64,dist*.45); ptr.style.height=h+"px"; ptr.querySelector(".spin").style.setProperty("--r",(dist*2)+"deg"); $("ptrTxt").textContent=dist>130?"Release to refresh":"Pull to refresh"; },{passive:true});
  addEventListener("touchend",()=>{ if(!pulling) return; pulling=false; if(dist>130){ ptr.classList.add("go"); ptr.style.height="44px"; $("ptrTxt").textContent="Syncing with your sheet…"; Promise.all([pull(),refreshNavs(true)]).finally(()=>setTimeout(()=>{ ptr.classList.remove("go"); ptr.style.height="0"; },400)); } else ptr.style.height="0"; dist=0; }); })();
const ACC=[["","Cyan","#3CF0D4"],["violet","Violet","#A98BFF"],["amber","Amber","#FFB547"],["rose","Rose","#FF6FA8"],["ice","Ice","#7CC8FF"]];
function segs(id,opts,cur,on){ const el=$(id); el.innerHTML=opts.map(([k,l])=>`<button type="button" data-k="${k}" aria-pressed="${k===cur}">${l}</button>`).join(""); el.querySelectorAll("button").forEach(b=>b.onclick=()=>{ on(b.dataset.k); buildDrawer(); }); }
function setCalm(on){ store.set("calm",on); document.documentElement.classList.toggle("calm",on); if(S3.setCalm) S3.setCalm(on); refresh(); }
/* ---------- corporate actions ----------
   CA_KNOWN: public, announced actions with the official cost split, so Artha can offer them by itself (bell + holding sheet).
   Add new ones here: id (unique), kind, date (record date), from (old name words), to (new name), ratio (new shares per share held),
   cost (% of the old cost that moves to the new company; demerger only), src. Anything not listed can be entered by hand. */
const CA_KNOWN=[
  {id:"tatamotors-2025",kind:"demerger",date:"2025-10-14",from:"TATA MOTORS",fromNot:"",to:"Tata Motors Limited",ratio:1,cost:31.15,
   src:"Tata Motors filing to NSE/BSE, 12 Nov 2025: 68.85% of cost stays with Tata Motors Passenger Vehicles, 31.15% goes to Tata Motors Ltd (commercial vehicles)",
   match:h=>/TATA MOTORS PASS/.test(nkey(h.name))||(/^TATA MOTORS/.test(nkey(h.name))&&!/LIMITED$/.test(nkey(h.name)))}
];
const CA_KIND={demerger:"Demerger",merger:"Merger",rename:"Name change",split:"Split / consolidation"};
const caKind=id=>{ const k=CA_KNOWN.find(x=>x.id===id); if(k) return CA_KIND[k.kind]; const m=/^(demerger|merger|rename|split)/.exec(id||""); return m?CA_KIND[m[1]]:"Corporate action"; };
const caDone=(id,acct,who)=>M.rows.some(r=>r.acct===acct&&r.who===who&&(CA_RE.exec(r.note||"")||[])[1]===id);
/* rows for one action on one holding (account + whose money). Old holding as it stood on the action date. */
function caRows(a,par){ const st=[...holdMap(M.rows,a.date).values()], old=st.find(h=>h.key===par.key)||null; if(!old||old.qty<1e-6) return {err:"No shares of "+par.name+" on "+fmtD(a.date)+"."};
  const same=a.kind==="split", toName=same?par.name:a.to.trim(); if(!toName) return {err:"Enter the new company's name."};
  const tk=par.acct+"|"+par.who+"|"+par.asset+"|"+nkey(toName), have=same?0:(holdMap(M.rows).get(tk)||{qty:0}).qty;
  const mv=a.kind==="demerger"?r2(old.inv*(+a.cost||0)/100):r2(old.inv), outQ=a.kind==="demerger"?0:old.qty;
  const want=r4(old.qty*(+a.ratio||0)), inQ=same?want:Math.max(0,r4(want-have));
  if(!(+a.ratio>0)) return {err:"Enter how many new shares you got for each share."};
  if(a.kind==="demerger"&&!(+a.cost>0&&+a.cost<100)) return {err:"Enter the % of cost that moves to the new company."};
  const tag=`[ca ${a.id}] [since ${old.since||old.date}]`, base={date:a.date,who:par.who,acct:par.acct,asset:par.asset,code:"",price:"",via:"Switch"};
  const L=[]; if(mv>0||outQ) L.push({...base,type:"Sell",name:old.name,qty:outQ||"",amt:mv,note:`${tag} ${CA_KIND[a.kind]}: ${outQ?qtyf(outQ)+" shares and ":""}${a.kind==="demerger"?a.cost+"% of cost":"cost"} moved to ${toName}`});
  if(mv>0||inQ) L.push({...base,type:"Buy",name:toName,qty:inQ||"",amt:mv,note:`${tag} ${CA_KIND[a.kind]}: ${inQ?qtyf(inQ)+" shares and ":""}cost from ${old.name}${have&&!same?` (${qtyf(have)} shares were already in Artha)`:""}`});
  return {rows:L.filter(r=>r.amt>0),old,mv,inQ,outQ,have,toName}; }
function caPending(){ if(!M) return []; const L=[]; CA_KNOWN.forEach(a=>{ const seen=new Set();
  [...holdMap(M.rows,a.date).values()].filter(h=>(h.asset==="Stocks")&&h.qty>1e-6&&a.match(h)).forEach(h=>{ const k=h.acct+"|"+h.who; if(seen.has(k)||caDone(a.id,h.acct,h.who)) return; seen.add(k); L.push({a,h}); }); }); return L; }
function caApply(L){ let n=0; L.forEach(({a,h})=>{ const R=caRows(a,h); if(R.rows&&R.rows.length){ OUT.push({kind:"add",rows:R.rows,rid:rid()}); n++; } });
  if(n){ saveOut(); refresh(); flush(); } return n; }
function caKnownSheet(){ const L=caPending(); if(!L.length){ showToast("Nothing to apply."); return; }
  openE(`<div class="t big">Corporate actions to apply</div><div class="s" style="text-align:left">Artha moves the shares and the purchase cost exactly as announced. No money moves and your totals don't change; only the split between the two stocks does.</div>
    ${L.map(({a,h})=>{ const R=caRows(a,h); return `<div class="sect"><b>${esc(CA_KIND[a.kind])} · ${esc(h.name)} → ${esc(a.to)}</b><div class="s" style="text-align:left;margin-top:6px">${esc(whoVia(h.who,h.acct))} · ${fmtD(a.date)}<br>${R.err?esc(R.err):`Cost moved: ${moneyX(R.mv)} of ${moneyX(R.old.inv)}${R.inQ?` · new shares ${qtyf(R.inQ)}`:R.have?` · ${qtyf(R.have)} new shares already in Artha`:""}`}<br><small>${esc(a.src)}</small></div></div>`; }).join("")}
    <button class="go" type="button" id="caGo">Apply</button>${closeBtn}`);
  $("caGo").onclick=()=>{ const n=caApply(L); ov.back(); if(n) celebrate("Applied",`${n} holding${n>1?"s":""} updated`); }; }
/* by hand, from a holding: demerger, merger, name change, split or consolidation */
function caSheet(h){ const kn=CA_KNOWN.filter(a=>a.match(h)&&!caDone(a.id,h.acct,h.who)); let kind="demerger";
  const draw=()=>{ const dem=kind==="demerger", spl=kind==="split";
    openE(`<div class="t big">${esc(h.name)}</div><div class="s" style="text-align:left">${esc(whoVia(h.who,h.acct))}</div>
      ${kn.length?`<button class="ai" id="caKn">${svgI("spark","var(--neon2)")}<span><b>Apply ${esc(CA_KIND[kn[0].kind].toLowerCase())} into ${esc(kn[0].to)}</b><small>Announced cost split ${kn[0].cost?kn[0].cost+"% to the new company":""} · ${fmtD(kn[0].date)}</small></span></button>`:""}
      <div class="fld"><span>What happened</span><div class="seg sm wrap" id="caK">${Object.entries(CA_KIND).map(([k,l])=>`<button type="button" data-v="${k}" aria-pressed="${k===kind}">${l}</button>`).join("")}</div></div>
      <label class="fld"><span>Record date</span><input id="caD" type="date" max="${M.today}" value=""></label>
      ${spl?"":`<label class="fld"><span>${dem?"New company you got shares of":"New name / company"}</span><input id="caTo" autocomplete="off" placeholder="As your broker shows it"></label>`}
      <label class="fld"><span>${spl?"New shares for each old share (2-for-1 split = 2; 1-for-10 = 0.1)":dem?"New shares for each share you held":"New shares for each old share (name change = 1)"}</span><input id="caR" inputmode="decimal" value="${kind==="rename"?1:""}"></label>
      ${dem?`<label class="fld"><span>% of your cost that moves to the new company</span><input id="caC" inputmode="decimal" placeholder="From the company's filing, e.g. 31.15"></label>`:""}
      <div class="s" id="caP" style="text-align:left"></div>
      <button class="go" type="button" id="caOk" disabled>Save</button>${closeBtn}`);
    $("caK").onclick=e=>{ const b=e.target.closest("button"); if(b){ kind=b.dataset.v; draw(); } };
    const kb=$("caKn"); if(kb) kb.onclick=()=>{ const n=caApply([{a:kn[0],h}]); ov.back(); if(n) celebrate("Applied",kn[0].to); };
    let R=null; const calc=()=>{ const d=$("caD").value; const a={id:kind+"-"+(d||"").replace(/-/g,"")+"-"+nkey(h.name).split(" ")[0].toLowerCase(),kind:kind==="rename"?"merger":kind,date:d,to:spl?h.name:($("caTo")||{}).value||"",ratio:numIn($("caR").value),cost:dem?numIn($("caC").value):0};
      if(kind==="rename") a.id=a.id.replace(/^merger/,"rename");
      R=d?caRows(a,h):{err:"Pick the record date."}; $("caOk").disabled=!!R.err||!R.rows.length;
      $("caP").innerHTML=R.err?esc(R.err):spl?`On ${fmtD(d)} you held ${qtyf(R.old.qty)} shares costing ${moneyX(R.old.inv)}. They become ${qtyf(R.inQ)} shares; the cost stays the same. No money moves.`:`On ${fmtD(d)} you held ${qtyf(R.old.qty)} shares costing ${moneyX(R.old.inv)}.<br>${R.outQ?`${qtyf(R.outQ)} shares and `:""}${moneyX(R.mv)} of cost move to ${esc(R.toName)}${R.inQ?` (${qtyf(R.inQ)} new shares)`:R.have?` (${qtyf(R.have)} shares already in Artha)`:""}. No money moves.`; };
    $("eBox").querySelectorAll("#caD,#caTo,#caR,#caC").forEach(x=>x.oninput=calc);
    $("caOk").onclick=()=>{ if(!R||R.err) return; OUT.push({kind:"add",rows:R.rows,rid:rid()}); saveOut(); ov.back(); refresh(); flush(); celebrate("Saved",CA_KIND[kind]); }; };
  draw(); }
/* ---------- menu tools: returns by account, winners & losers, upcoming money ---------- */
const whoAcct=u=>u.acct+(u.who!==holderOf(u.acct)?` · ${u.who}'s money`:"");
function toolReturns(){ const U=M.units.filter(u=>u.h!=="Others"&&u.h!=="Term"&&(u.cur>0||u.net>0)&&okWho(u.who,WHO)).sort((a,b)=>(b.x??-9)-(a.x??-9));
  const G=["Stocks","Mutual Funds","Bonds","Other"].filter(h=>U.some(u=>u.h===h));
  openE(`<div class="t big">Returns by account</div><div class="s" style="text-align:left">XIRR is the yearly return on your own money, counting when each rupee went in and came out.</div>
    ${G.map(h=>{ const r=agg(h,WHO); return `<div class="tlbl"><span>${esc(CLS[h].label)}</span><b class="num ${cls(r.x)}">XIRR ${pct(r.x)}</b></div><div class="list tlist">${U.filter(u=>u.h===h).map(u=>{ const g=u.gain!=null&&u.net>0?u.gain/u.net:null;
      return `<div class="hl"><span class="av" style="background:${CLS[h].col}">${svgI(CLS[h].icon,"#fff",18)}</span><div style="min-width:0"><div class="n">${esc(whoAcct(u))}</div><div class="m">Put in ${money(u.net)} · now ${money(u.cur)}</div></div><div class="r"><b class="num ${cls(u.x)}">${pct(u.x)}</b><small class="${cls(u.gain)}">${u.gain==null?"—":smoney(u.gain,true)}${g!=null?" · "+pct(g):""}</small></div></div>`; }).join("")}</div>`; }).join("")}
    <p class="hint">Bonds: XIRR counts repayments still to come.</p>${closeBtn}`); }
function toolMovers(){ let sort=store.get("mvSort","loss"), grp=store.get("mvGrp","Stocks");
  const draw=()=>{ const H=M.hold.filter(h=>h.a===grp&&okWho(h.who,WHO)&&h.inv>0).map(h=>({h,g:h.gain,p:h.gain/h.inv,since:h.since||""}));
    H.sort((a,b)=>sort==="loss"?a.p-b.p:sort==="gain"?b.p-a.p:b.g-a.g);
    const tg=SUM(H,x=>x.g);
    openE(`<div class="t big">Winners and losers</div>
      <div class="seg sm" id="mvG">${["Stocks","Mutual Funds"].map(g=>`<button type="button" data-v="${g}" aria-pressed="${g===grp}">${esc(CLS[g].label)}</button>`).join("")}</div>
      <div class="seg sm" id="mvS">${[["loss","Worst first"],["gain","Best first"],["amt","Biggest ₹"]].map(([v,l])=>`<button type="button" data-v="${v}" aria-pressed="${v===sort}">${l}</button>`).join("")}</div>
      <div class="s" style="text-align:left">${H.length} holdings · ${H.filter(x=>x.g<0).length} below cost · total ${smoney(tg,true)}</div>
      <div class="list">${H.map(({h,g,p,since})=>{ const y=since?days(since,M.today)/365:0;
        return `<div class="hl"><span class="av" style="background:${h.col||CLS[grp].col}">${esc((h.name||"?")[0])}</span><div style="min-width:0"><div class="n">${esc(h.name)}</div><div class="m">${esc(whoAcct(h).replace(/^Groww · /,"Groww "))} · cost ${money(h.inv,true)}${since?` · held ${y>=1?y.toFixed(1)+" yr":Math.round(y*12)+" mo"}${grp==="Stocks"?(y>=1?" · LT":" · ST"):""}`:""}</div></div><div class="r"><b class="num ${cls(g)}">${smoney(g,true)}</b><small class="${cls(p)}">${pct(p)}</small></div></div>`; }).join("")||`<div class="empty">No holdings.</div>`}</div>
      <p class="hint">Prices from the latest value or trade in Artha${grp==="Mutual Funds"?" (NAVs refresh daily)":""}. LT = held over a year.</p>${closeBtn}`);
    $("mvG").onclick=e=>{ const b=e.target.closest("button"); if(b){ grp=b.dataset.v; store.set("mvGrp",grp); draw(); } };
    $("mvS").onclick=e=>{ const b=e.target.closest("button"); if(b){ sort=b.dataset.v; store.set("mvSort",sort); draw(); } }; };
  draw(); }
function upcomingList(n){ const lim=addDays(M.today,n), L=[];
  bondsFor(WHO).filter(b=>!b.closed).forEach(b=>b.open.forEach(e=>{ if(e.d<=lim) L.push({d:e.d,k:"in",t:b.name,s:`${e.p>0?"Principal + interest":"Interest"} · ${whoAcct(b)}`,a:e.a,late:e.d<M.today}); }));
  /* SIPs: a fund bought in each of the last two months → next one a month after the last */
  const F=new Map(); M.tx.filter(t=>t.asset==="Mutual Funds"&&t.type==="Buy"&&t.date&&t.date>=addDays(M.today,-70)&&okWho(t.who,WHO)).forEach(t=>{ const k=t.acct+"|"+t.who+"|"+keyName(t.name); if(!F.has(k)) F.set(k,[]); F.get(k).push(t); });
  for(const T of F.values()){ T.sort((a,b)=>a.date<b.date?-1:1); const months=new Set(T.map(t=>t.date.slice(0,7))); if(months.size<2) continue; const lt=T[T.length-1]; let nd=addMonths(lt.date,1);
    while(nd<M.today) nd=addMonths(nd,1); for(;nd<=lim;nd=addMonths(nd,1)) L.push({d:nd,k:"out",t:lt.name,s:`SIP (expected) · ${whoAcct(lt)}`,a:lt.show}); }
  /* ELSS 3-year lock-in ends */
  M.tx.filter(t=>t.asset==="Mutual Funds"&&t.type==="Buy"&&/elss|tax saver/i.test(t.name||"")&&t.date&&okWho(t.who,WHO)).forEach(t=>{ const d=addMonths(t.date,36); if(d>=M.today&&d<=lim) L.push({d,k:"free",t:t.name,s:`ELSS lock-in ends · bought ${fmtDs(t.date)}`,a:t.show}); });
  if(M.term&&okWho("Aditya",WHO)){ const np=nextPremium(M.term); if(np&&np.date<=lim) L.push({d:np.date,k:"out",t:"Term premium",s:`${np.left} left after this`,a:np.amt,late:np.date<M.today}); }
  renewals(n).forEach(x=>L.push({d:x.end,k:"out",t:(x.pol.d.title||"Policy")+" renewal",s:x.pol.d.insured||"",a:0,late:x.left<0}));
  return L.sort((a,b)=>a.d<b.d?-1:1); }
function toolUpcoming(){ let n=store.get("upN",90);
  const draw=()=>{ const L=upcomingList(n), tin=SUM(L.filter(x=>x.k==="in"),x=>x.a), tout=SUM(L.filter(x=>x.k==="out"),x=>x.a), lab={in:"Money in",out:"Money out",free:"Unlocks"}, col={in:"var(--gain,#2BD99F)",out:"#FFB547",free:"#5B8CFF"};
    openE(`<div class="t big">Upcoming money</div>
      <div class="seg sm" id="upN">${[30,90,365].map(v=>`<button type="button" data-v="${v}" aria-pressed="${v===n}">${v===365?"1 year":v+" days"}</button>`).join("")}</div>
      <div class="s" style="text-align:left">Coming in ${money(tin,true)} · going out ${money(tout,true)}</div>
      <div class="list">${L.map(x=>`<div class="hl"><span class="av" style="background:${col[x.k]}">${esc(fmtDs(x.d).split(" ")[0])}</span><div style="min-width:0"><div class="n">${esc(x.t)}</div><div class="m">${x.late?'<span class="loss">Due</span> · ':""}${esc(fmtDs(x.d))} · ${esc(x.s)}</div></div><div class="r"><b class="num">${x.a?(x.k==="out"?"−":"")+money(x.a,true):"—"}</b><small>${lab[x.k]}</small></div></div>`).join("")||`<div class="empty">Nothing in this window.</div>`}</div>
      <p class="hint">SIPs are guessed from the last two months of buys.</p>${closeBtn}`);
    $("upN").onclick=e=>{ const b=e.target.closest("button"); if(b){ n=+b.dataset.v; store.set("upN",n); draw(); } }; };
  draw(); }
function buildDrawer(){
  const nps=M?agg("Others","all"):null, wait=M?recs("inbox").filter(r=>r.d.status==="new").length:0, ready=M?recs("inbox").filter(r=>r.d.status==="ready").length:0;
  $("dNpsS").textContent=nps&&nps.U.length?money(nps.cur,true).replace(/<[^>]+>/g,"")+" · not in totals":"Not set up";
  $("dInboxS").textContent=ready?`${ready} ready to check`:wait?`${wait} waiting`:"Nothing waiting";
  const bx=M?balUnits0().filter(x=>/groww/i.test(x.u.acct)):[];
  $("dBalS").textContent=bx.length?bx.map(x=>(x.u.acct.split(" · ")[1]||x.u.acct)+" "+rsx(x.L[x.L.length-1].b)).join(" · "):"No balance yet";
  if(M){ const r=agg("Stocks",WHO), up=upcomingList(30); $("dRetS").textContent="Stocks XIRR "+pct(r.x); $("dUpS").textContent=up.length?`${up.length} in the next 30 days`:"Nothing in 30 days";
    const lo=M.hold.filter(h=>okWho(h.who,WHO)&&h.inv>0&&h.gain<0).length; $("dMovS").textContent=`${lo} below cost`; }
  $("dInsS").textContent=M?`${policies().length} polic${policies().length===1?"y":"ies"}`:"";
  { const dn=$("dNow"); if(dn){ if(!M) dn.innerHTML=""; else { const B=bellItems(), nx=upcomingList(30).filter(u=>u.k==="in").sort((a,b)=>a.d<b.d?-1:1)[0], mon=M.today.slice(0,7);
      const put=SUM(((DATA&&DATA.led)||[]).filter(r=>String(r[1]).slice(0,7)===mon&&r[5]==="Buy"&&r[12]!=="nps"&&(WHO==="all"||r[2]===WHO)),r=>+r[10]||0);
      dn.innerHTML=`<button type="button" class="dn" id="dnBell" style="--c:${B.n?"var(--accent)":"var(--ok)"}"><b>${B.n?B.n+" to check":"All clear"}</b><small>${B.n?"Open what needs you":"Nothing needs you"}</small></button>
        <button type="button" class="dn" id="dnUp" style="--c:#FFB547"><b class="num">${nx?money(nx.a,true):"None due"}</b><small>${nx?esc("Next money in · "+fmtDs(nx.d)):"No money in 30 days"}</small></button>
        <div class="dn" style="--c:var(--neon)"><b class="num">${money(put,true)}</b><small>Invested this month</small></div>`;
      $("dnBell").onclick=fromDrawer(openBell); $("dnUp").onclick=fromDrawer(toolUpcoming); } } }
  segs("fAmt",[["short","Short ₹12.3L"],["full","Full ₹12,34,567"]],SHORT?"short":"full",v=>{ SHORT=v==="short"; store.set("amt",v); refresh(); });
  segs("fMotion",[["full","3D and motion"],["calm","Simple and still"]],store.get("calm",false)?"calm":"full",v=>setCalm(v==="calm"));
  segs("fLock",[["on","Fingerprint"],["off","Off"]],LOCK.on()?"on":"off",v=>{ if((v==="on")!==LOCK.on()) setLock(v==="on"); });
  $("fLockHint").textContent=LOCK.can()?(LOCK.on()?"Asks when you open Artha and after a minute away.":"Turn on to ask for your fingerprint or face when Artha opens."):"Not available in this browser.";
  const cur=store.get("acc",""); $("fAcc").innerHTML=ACC.map(([k,n,c])=>`<button type="button" aria-pressed="${cur===k}" data-k="${k}"><span class="sw" style="--a:${c}"></span>${n}</button>`).join("");
  $("fAcc").querySelectorAll("button").forEach(b=>b.onclick=()=>{ store.set("acc",b.dataset.k); if(b.dataset.k) document.documentElement.setAttribute("data-acc",b.dataset.k); else document.documentElement.removeAttribute("data-acc"); S3.ringColor(ACC.find(a=>a[0]===b.dataset.k)[2]); buildDrawer(); });
  $("sheetLink").href=safeUrl(M&&M.url); $("filesLink").href=safeUrl(M&&M.files); $("filesLink").hidden=!(M&&M.files);
}
const openDrawer=()=>{ buildDrawer(); $("scrim").hidden=false; ov.open($("drawer"),()=>{ vanish($("drawer")); vanish($("scrim")); }); };
const fromDrawer=fn=>()=>{ ov.back(); setTimeout(fn,240); };
$("menuBtn").onclick=openDrawer; $("drawerDone").onclick=()=>ov.back(); $("scrim").onclick=()=>ov.back();
$("dVals").onclick=fromDrawer(()=>openValues());
$("dTds").onclick=fromDrawer(()=>openScr("Bonds",{tab:"TDS"}));
$("dBal").onclick=fromDrawer(()=>openScr("Stocks",{tab:"Balance"}));
$("dRet").onclick=fromDrawer(toolReturns); $("dMov").onclick=fromDrawer(toolMovers); $("dUp").onclick=fromDrawer(toolUpcoming);
$("dChg").onclick=fromDrawer(()=>openScr("Stocks",{tab:"Charges"}));
$("dNps").onclick=fromDrawer(()=>{ if(agg("Others","all").U.length) openScr("NPS"); else showToast("No NPS entries yet. Add one with the + button."); });
$("dIns").onclick=fromDrawer(()=>setTab("ins"));
$("dInbox").onclick=fromDrawer(()=>{ const L2=recs("inbox").filter(r=>r.d.status==="new"||r.d.status==="ready");
  openE(`<div class="t big">Claude inbox</div><div class="s" style="text-align:left">Bond screenshots and policies you upload wait here until Claude reads them. Tap Process now, paste the copied message in the chat that opens, and send it.</div>${L2.length?`<div class="list">${L2.map(inboxRow).join("")}</div><button class="go" type="button" id="iAll">Process now</button>`:`<div class="empty">Nothing waiting.</div>`}${closeBtn}`);
  const b=$("iAll"); if(b) b.onclick=processNow; });
$("forgetBtn").onclick=fromDrawer(()=>{ if(OUT.length){ showToast("Some changes are still waiting to sync. Go online first, then try again.",4500); return; }
  confirmSheet("Forget this phone?","Artha will sign out here and forget its saved copy and fingerprint lock. You'll need the private setup link and Google sign-in to open it again. Nothing in your sheet is deleted.","Forget this phone",()=>{
    const done=()=>{ ["api","pass","tok","me","email","bioId","bioAsked","cache","cacheAt","outbox","failed","issues","snap"].forEach(k=>{ try{localStorage.removeItem("artha:"+k);}catch(e){} }); location.reload(); };
    if(store.get("tok","")) call("logout").then(done,done); else done(); }); });
function eye(){ $("eyeP").setAttribute("d",HIDE?"M3 3l18 18M10.6 6.1A9.8 9.8 0 0 1 12 6c6.4 0 10 6 10 6a17 17 0 0 1-3.2 3.9M6.6 6.6C3.9 8.3 2 12 2 12s3.6 6 10 6c1.6 0 3-.3 4.3-.9":"M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"); $("eyeBtn").setAttribute("aria-label",HIDE?"Show amounts":"Hide amounts"); }
$("eyeBtn").onclick=()=>{ HIDE=!HIDE; store.set("hide",HIDE); eye(); refresh(); }; eye();
function refresh(){ if(!PAINTED||document.documentElement.classList.contains("locked")) return; build(); if(TAB_NOW==="ins") renderIns(); else renderHome(); paintBell(); if(isOpen($("drawer"))) buildDrawer(); if(SC&&isOpen($("scr"))) renderScr(); if(isOpen($("sheet"))) doSearch(); }
/* every tap answers: the control tilts toward the finger, a ring of light spreads from the touch, and the 3D background leans in */
(()=>{ const rip=document.createElement("i"); rip.className="rip"; rip.setAttribute("aria-hidden","true"); document.body.appendChild(rip); let cur=null, t=0;
  const SEL="button,a,[role=button],.tile,.pcard,.hl,.dt,.dn,.vcard,label.adate";
  addEventListener("pointerdown",e=>{ if(calm()||document.documentElement.classList.contains("locked")) return; const el=e.target.closest&&e.target.closest(SEL); if(!el||el.disabled) return;
    rip.style.left=e.clientX+"px"; rip.style.top=e.clientY+"px"; rip.classList.remove("go"); void rip.offsetWidth; rip.classList.add("go");
    if(el.closest("#stage")||getComputedStyle(el).transform!=="none") return;   // already placed by a transform: leave its position alone
    const r=el.getBoundingClientRect(); el.style.setProperty("--tx",(((e.clientX-r.left)/Math.max(1,r.width)-.5)*2).toFixed(2)); el.style.setProperty("--ty",(((e.clientY-r.top)/Math.max(1,r.height)-.5)*2).toFixed(2));
    el.style.setProperty("--tk",r.width>220?"3":r.width>110?"7":"12");
    clearTimeout(t); if(cur&&cur!==el) cur.classList.remove("tapd"); cur=el; el.classList.add("tapd"); },{passive:true});
  const up=()=>{ const el=cur; cur=null; if(el) t=setTimeout(()=>el.classList.remove("tapd"),150); };
  addEventListener("pointerup",up,{passive:true}); addEventListener("pointercancel",up,{passive:true}); })();
$("verTxt").textContent="Version "+APP_VERSION;
/* update card: never pops over an open screen or entry; waits until you're back on Home */
let UPD=null, updT=0;
const updShort=n=>{ n=(n||"").trim(); const f=n.split(/,\s*/); return f.length>2?f.slice(0,2).join(", ")+" and more":n; };
function showUpd(){ clearTimeout(updT); if(!UPD) return;
  if(ov.stack.length||document.activeElement?.matches?.("input,textarea,select")){ updT=setTimeout(showUpd,3000); return; }
  $("updTitle").textContent=`Artha ${UPD.v} is ready`; $("updTxt").textContent=updShort(UPD.note); $("updBtn").textContent="Update now"; $("upd").hidden=false; }
async function checkUpdate(manual){ try{ const j=await (await fetch("version.json?t="+Date.now(),{cache:"no-store"})).json();
    if(j.v&&j.v!==APP_VERSION){ UPD=j; if(manual||store.get("updLater")!==j.v) showUpd(); } else if(manual) showToast("You're on the latest version"); }
  catch(e){ if(manual) showToast("Couldn't check, you seem to be offline"); } }
/* update = drop the old worker and every cached copy, then load fresh from the network (with a cache-busting address) */
async function doUpdate(){ $("updBtn").textContent="Updating…"; try{ const regs=await navigator.serviceWorker?.getRegistrations?.()||[]; await Promise.all(regs.map(r=>r.scope===new URL("./",location.href).href?r.unregister():null)); const ks=await caches.keys(); await Promise.all(ks.filter(k=>k.startsWith("artha-")&&k!=="artha-good").map(k=>caches.delete(k))); try{ sessionStorage.removeItem("arthaRolled"); }catch(e){} }catch(e){} location.replace(location.pathname+"?u="+Date.now()+location.hash); }
$("updBtn").onclick=doUpdate; $("updLater").onclick=()=>{ if(UPD) store.set("updLater",UPD.v); clearTimeout(updT); $("upd").hidden=true; showToast("OK. Menu › Check for updates whenever you're ready"); };
$("verBtn").onclick=()=>checkUpdate(true); setTimeout(checkUpdate,2500);
let DAY_SEEN=new Date().toDateString();
document.addEventListener("visibilitychange",()=>{ if(document.visibilityState==="visible"){ checkUpdate(); const day=new Date().toDateString(); if(day!==DAY_SEEN){ DAY_SEEN=day; refresh(); } /* a new day changes "due" items; otherwise nothing on screen is stale */ if(Date.now()-CACHE_AT>60000) pull(); } });
if("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(()=>{});
/* start-up order: the lock is decided first (index.html has already hidden the app if it will lock), the 3D layer loads meanwhile,
   and the home is drawn exactly once: after the fingerprint when locked, straight away otherwise */
function firstPaint(){ if(PAINTED) return; PAINTED=true; if(!S3.stub){ S3.initBg($("bg3d")); const a=ACC.find(x=>x[0]===store.get("acc","")); if(a) setTimeout(()=>S3.ringColor(a[2]),50); }
  build(); setTab(TAB_NOW); if(DATA) setSync(OUT.length||FAILED.length?"warn":"",liveLine());
  /* 3D arrived late (slow phone or first install): bring it in once, quietly */
  if(S3.stub) load3D().then(ok=>{ if(!S3.stub){ S3.initBg($("bg3d")); if(ok) refresh(); } }); }
load3D(); if(!lockOnStart()) soon3D(900).then(firstPaint); pull(); setTimeout(()=>refreshNavs(),1500);
/* started fine: tell the boot guard (index.html), and let the worker keep this version as the last good one */
window.__arthaOK=1; setTimeout(()=>{ try{ const c=navigator.serviceWorker&&navigator.serviceWorker.controller; if(c&&$("legend")&&$("app").offsetHeight) c.postMessage({t:"good",v:APP_VERSION}); }catch(e){} },4000);
{ const rb=store.get("rolled",null); if(rb!=null){ try{ localStorage.removeItem("artha:rolled"); }catch(e){} setTimeout(()=>showToast("The newest version didn't start, so Artha opened the last one that worked. Your data is fine.",7000),1200); } }
})();
