const load=require('./mock.js'); let fail=0; const ok=(c,m)=>{ console.log((c?'PASS ':'FAIL ')+m); if(!c) fail++; };
const FAMILY={id:'parents',label:'Mom & Dad',people:['Mom','Dad'],users:{'adi@x.com':{name:'Aditya',role:'admin'},'mom@x.com':{name:'Mom',role:'editor'},'dad@x.com':{name:'Dad',role:'viewer'}},acct0:['Groww · Mom'],features:{simple:true}};
const B=load('./family-Code.gs',{FAMILY:JSON.stringify(FAMILY)}); B.ctx.__api.setupFamily();
const login=e=>B.post({action:'login',e:{idToken:B.idToken(e)}});
const adi=login('adi@x.com'), mom=login('mom@x.com'), dad=login('dad@x.com'), bad=login('stranger@x.com');
ok(adi.ok&&adi.d.role==='admin'&&adi.d.fam==='parents'&&/^[0-9a-f]{64}$/.test(adi.d.tok),'admin signs in and gets a session key');
ok(!bad.ok&&/not allowed/.test(bad.m)&&!/stranger/.test(bad.m),'an account outside the family is refused (and its email is not echoed)');
const row={date:'2026-11-01',who:'Mom',acct:'Groww · Mom',asset:'Mutual Funds',type:'Buy',name:'Nifty 50 Index',amt:5000,via:'Bank'};
let r=B.post({action:'add',pass:adi.d.tok,e:{rows:[row],rid:'r1'}});
ok(r.ok&&r.d.led.length===1&&r.d.added[0]==='L0001'&&r.d.cfg.people.join()==='Mom,Dad','admin adds an entry for Mom');
r=B.post({action:'add',pass:adi.d.tok,e:{rows:[row],rid:'r1'}}); ok(r.ok&&r.d.led.length===1&&r.d.added[0]==='L0001','the same request retried is not written twice');
for(const k of Object.keys(B.ctx)) {} 
// a retry after the 6-hour cache has gone: the Audit tab still knows the request id
const B2=B; const cacheGone=B.ctx.CacheService.getScriptCache; B.ctx.CacheService.getScriptCache=()=>({get:()=>null,put(){}});
r=B.post({action:'add',pass:adi.d.tok,e:{rows:[row],rid:'r1'}}); ok(r.ok&&r.d.led.length===1,'a retry days later (cache expired) is still not written twice');
B.ctx.CacheService.getScriptCache=cacheGone;
r=B.post({action:'add',pass:dad.d.tok,e:{rows:[row],rid:'r2'}}); ok(!r.ok&&/^VIEWONLY/.test(r.m),'a viewer trying to add is refused by the server');
r=B.post({action:'del',pass:dad.d.tok,e:{id:'L0001',rid:'r3'}}); ok(!r.ok&&/^VIEWONLY/.test(r.m),'a viewer trying to delete is refused by the server');
r=B.post({action:'rec',pass:dad.d.tok,e:{ops:[{id:'x',kind:'bond',data:{}}]}}); ok(!r.ok&&/^VIEWONLY/.test(r.m),'a viewer trying to save a record is refused');
r=B.post({action:'upload',pass:dad.d.tok,e:{b64:'aGk=',name:'a.pdf'}}); ok(!r.ok&&/^VIEWONLY/.test(r.m),'a viewer upload is refused unless switched on');
r=B.post({action:'get',pass:dad.d.tok,e:{}}); ok(r.ok&&r.d.led.length===1&&r.d.url===''&&r.d.cfg.role==='viewer'&&!JSON.stringify(r.d).includes('@x.com'),'a viewer can read; no sheet link and no email addresses are sent');
const stamp=r.d.stamp; r=B.post({action:'get',pass:dad.d.tok,e:{stamp}}); ok(r.ok&&r.d.same===true&&!r.d.led,'unchanged data gets the short "same" answer');
r=B.post({action:'add',pass:mom.d.tok,e:{rows:[Object.assign({},row,{who:'Dad',amt:700})],rid:'r4'}}); ok(r.ok&&r.d.led.length===2&&r.d.added[0]==='L0002','an editor (Mom) can add');
r=B.post({action:'get',pass:dad.d.tok,e:{stamp}}); ok(r.ok&&!r.d.same&&r.d.led.length===2,'after a change the full data is sent again');
r=B.post({action:'add',pass:adi.d.tok,e:{rows:[Object.assign({},row,{who:'Aditya'})],rid:'r5'}}); ok(!r.ok&&/whose money/i.test(r.m),'an entry for someone outside this family is refused');
r=B.post({action:'add',pass:adi.d.tok,e:{rows:[Object.assign({},row,{name:'=IMPORTXML("http://x","//a")'})],rid:'r6'}});
ok(r.ok&&B.book.sheets.Ledger.rows.some(x=>String(x[6]).startsWith("'=")),'text starting with = is stored as plain text, not a formula');
r=B.post({action:'edit',pass:adi.d.tok,e:{id:'L0002',row:Object.assign({},row,{who:'Dad',amt:900}),rid:'r7'}}); ok(r.ok&&r.d.led.find(x=>x[0]==='L0002')[10]===900,'edit changes the row');
r=B.post({action:'del',pass:adi.d.tok,e:{id:'L0002',rid:'r8'}}); ok(r.ok&&!r.d.led.find(x=>x[0]==='L0002')&&B.book.sheets.Audit.rows.some(x=>x[2]==='delete'&&/L0002/.test(x[4])),'delete removes the row after copying it to Audit');
r=B.post({action:'get',pass:'f'.repeat(64),e:{}}); ok(!r.ok&&/^SIGNIN/.test(r.m),"another family's session key is refused (SIGNIN)");
r=B.post({action:'get',pass:'',e:{}}); ok(!r.ok&&/^SIGNIN/.test(r.m),'no session key is refused');
r=B.post({action:'setupFamily',pass:adi.d.tok,e:{}}); ok(!r.ok&&/Unknown action/.test(r.m),'editor-only functions cannot be called from the web');
r=B.post({action:'upload',pass:adi.d.tok,e:{b64:'aGk=',name:'artha-inbox-abc-context.txt',path:'Inbox'}}); ok(r.ok&&r.d.file.name==='artha-parents-inbox-abc-context.txt','uploaded inbox files are forced to this family\'s prefix');
r=B.post({action:'upload',pass:adi.d.tok,e:{b64:'aGk=',name:'artha-result-abc.json',mime:'text/plain'}}); ok(!r.ok,'a phone cannot upload a result file');
// IDs past 9999
const sh=B.book.sheets.Ledger; sh.rows.push(['L9999',new Date(),'Mom','Groww · Mom','Stocks','Buy','x','', '', '',1,'Bank','']);
r=B.post({action:'add',pass:adi.d.tok,e:{rows:[row,row],rid:'r9'}}); ok(r.ok&&r.d.added.join()==='L10000,L10001','IDs continue correctly past L9999');
// removing a person from FAMILY signs them out at once
const F2=JSON.parse(B.P.FAMILY); delete F2.users['mom@x.com']; B.P.FAMILY=JSON.stringify(F2); B.ctx.FAM_=null;
const B3=load('./family-Code.gs',B.P); // a fresh run, as every web request is
r=B3.post({action:'get',pass:mom.d.tok,e:{}}); ok(!r.ok&&/^SIGNIN/.test(r.m),'a person removed from FAMILY is signed out on their next request');
console.log(fail?fail+' FAILED':'ALL PASSED'); process.exit(fail?1:0);
