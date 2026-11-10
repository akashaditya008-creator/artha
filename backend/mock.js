// In-memory stand-ins for the Apps Script services, enough to run the backend's doPost end to end.
const fs=require('fs'),vm=require('vm'),crypto=require('crypto');
const chain=()=>new Proxy(function(){},{get:(t,k)=>k==='then'?undefined:chain(),apply:()=>chain()});
class Sheet{ constructor(n){this.name=n;this.rows=[];}
  getLastRow(){ let n=this.rows.length; while(n&&this.rows[n-1].every(v=>v===''||v==null)) n--; return n; }
  getMaxColumns(){return 26;} getSheetId(){return 1;} getName(){return this.name;}
  setColumnWidth(){} deleteColumns(){} setRowHeight(){} setFrozenRows(){}
  deleteRow(r){ this.rows.splice(r-1,1); }
  getRange(r,c,nr,nc){ const sh=this; if(typeof r==='string') return chain(); nr=nr||1; nc=nc||1;
    const api={ getValues(){ const o=[]; for(let i=0;i<nr;i++){ const row=sh.rows[r-1+i]||[]; const x=[]; for(let j=0;j<nc;j++) x.push(row[c-1+j]===undefined?'':row[c-1+j]); o.push(x);} return o; },
      setValues(v){ for(let i=0;i<nr;i++){ while(sh.rows.length<r+i) sh.rows.push([]); for(let j=0;j<nc;j++) sh.rows[r-1+i][c-1+j]=v[i][j]; } return api; },
      sort(spec){ const part=sh.rows.splice(r-1,nr); part.sort((a,b)=>{ for(const s of spec){ const x=a[s.column-1],y=b[s.column-1]; if(x<y) return -1; if(x>y) return 1; } return 0; }); sh.rows.splice(r-1,0,...part); return api; },
      setFontWeight(){return api;},setBackground(){return api;},setVerticalAlignment(){return api;},setNumberFormat(){return api;},setNote(){return api;} };
    return api; } }
class Book{ constructor(){this.sheets={};} getSheetByName(n){return this.sheets[n]||null;} insertSheet(n){return this.sheets[n]=new Sheet(n);} getSheets(){return Object.values(this.sheets);}
  getSpreadsheetTimeZone(){return 'Asia/Kolkata';} setSpreadsheetTimeZone(){} getUrl(){return 'https://docs.google.com/spreadsheets/d/X';} getId(){return 'SHEET';} deleteSheet(s){delete this.sheets[s.name];} }
module.exports=function load(file,props){ const book=new Book(), P=Object.assign({},props), cache={}, files=[];
  const pad=n=>String(n).padStart(2,'0');
  const ctx={ console, Logger:{log(){}} ,
    PropertiesService:{getScriptProperties:()=>({getProperty:k=>k in P?P[k]:null,setProperty:(k,v)=>{P[k]=String(v);},deleteProperty:k=>{delete P[k];},getProperties:()=>Object.assign({},P)})},
    CacheService:{getScriptCache:()=>({get:k=>k in cache?cache[k]:null,put:(k,v)=>{cache[k]=v;}})},
    LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})},
    SpreadsheetApp:{openById:()=>book,create:()=>book,flush(){}},
    ContentService:{createTextOutput:s=>({setMimeType(){return this;},text:s}),MimeType:{JSON:'json'}},
    Utilities:{ DigestAlgorithm:{SHA_256:1},Charset:{UTF_8:1},
      computeDigest:(a,s)=>[...crypto.createHash('sha256').update(String(s),'utf8').digest()].map(b=>b>127?b-256:b),
      formatDate:(d,tz,f)=>{ const t=new Date(d.getTime()+330*60000); return f.replace('yyyy',t.getUTCFullYear()).replace('MM',pad(t.getUTCMonth()+1)).replace('dd',pad(t.getUTCDate())).replace('HH',pad(t.getUTCHours())).replace('mm',pad(t.getUTCMinutes())); },
      parseDate:(s)=>new Date(s.slice(0,10)+'T00:00:00+05:30'), getUuid:()=>crypto.randomUUID(), base64Decode:b=>[...Buffer.from(b,'base64')], newBlob:(b,m,n)=>({b,m,n}) },
    UrlFetchApp:{fetch:(u)=>{ const tok=decodeURIComponent((u.split('id_token=')[1]||'')); const email=Buffer.from(tok.split('.')[1]||'','base64').toString();
      return {getResponseCode:()=>email?200:400,getContentText:()=>JSON.stringify({email,iss:'accounts.google.com',exp:String(Date.now()/1000+600),aud:ctx.CLIENT_ID_,email_verified:'true'})}; }},
    DriveApp:{ createFolder:n=>ctx.DriveApp.folder(n), getFolderById:()=>ctx.DriveApp.folder('root'),
      folder:n=>({getId:()=>'F'+n,getFoldersByName:()=>({hasNext:()=>false}),createFolder:m=>ctx.DriveApp.folder(m),createFile:b=>{ const f={name:b.n,getId:()=>'file'+files.length+'xxxxxxxxxxxx',getUrl:()=>'u',setDescription(){},getName:()=>b.n}; files.push(f); return f; }}),
      searchFiles:()=>({hasNext:()=>false}) },
    CalendarApp:{getDefaultCalendar:()=>({createEvent:()=>({removeAllReminders(){},addPopupReminder(){},getId:()=>'ev1'}),getEventById:()=>null})} };
  vm.createContext(ctx); vm.runInContext(fs.readFileSync(file,'utf8')+'\n;this.__doPost=doPost; this.CLIENT_ID_=CLIENT_ID; this.__api={setupFamily:typeof setupFamily==="function"?setupFamily:null};',ctx);
  const post=(body)=>JSON.parse(ctx.__doPost({postData:{contents:JSON.stringify(body)}}).text);
  const idToken=email=>'h.'+Buffer.from(email).toString('base64').replace(/=+$/,'').replace(/\+/g,'-').replace(/\//g,'_')+'.s';
  return {post,book,P,files,idToken,ctx}; };
