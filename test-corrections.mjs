import {readFileSync,writeFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const root=new URL('./',import.meta.url);const read=n=>readFileSync(new URL(n,root),'utf8');
let count=0;const pass=n=>{count++;console.log('PASS '+n);};
// Execute the actual Worker helper functions with deterministic Supabase/R2 fixtures.
writeFileSync(new URL('worker-test-copy.mjs',root),read('HerDay-Media-Worker.mjs')+'\nexport {supa,sharedScopedImage,origin};\n');
const {supa,sharedScopedImage,origin}=await import('./worker-test-copy.mjs');
const env={SUPABASE_URL:'https://abc.supabase.co',SUPABASE_ANON_KEY:'sb_publishable_fixture',SUPABASE_SERVICE_ROLE_KEY:'sb_secret_fixture',ALLOWED_ORIGINS:'https://web.appherday.com'};
let requests=[];globalThis.fetch=async(u,o)=>{requests.push(o);return Response.json(true);};
await supa(env,'/rest/v1/rpc/test',{method:'POST',admin:true,body:{}});
assert.equal(requests.at(-1).headers.apikey,'sb_secret_fixture');assert.equal(requests.at(-1).headers.authorization,undefined);pass('modern service secret stays out of JWT Authorization');
env.SUPABASE_SERVICE_ROLE_KEY='eyJ.legacy.fixture';await supa(env,'/rest/v1/rpc/test',{method:'POST',admin:true,body:{}});assert.equal(requests.at(-1).headers.authorization,'Bearer eyJ.legacy.fixture');pass('legacy service role JWT remains supported');
await supa(env,'/rest/v1/rpc/test',{method:'POST',token:'user.jwt.fixture',body:{}});assert.equal(requests.at(-1).headers.authorization,'Bearer user.jwt.fixture');pass('participant RPC uses user JWT');
const owner='11111111-1111-4111-8111-111111111111',conversation='22222222-2222-4222-8222-222222222222',id='33333333-3333-4333-8333-333333333333';let allowed=true,section='buy_sell',key=`pending/buy_sell/${owner}/${id}.jpg`,metadataOwner=owner;
globalThis.fetch=async()=>Response.json(allowed?{key,owner,mime:'image/jpeg',size:3,section}:null);
env.PRIVATE_BUCKET={get:async()=>({customMetadata:{owner:metadataOwner,section},httpMetadata:{contentType:'image/jpeg'},size:3,body:new Uint8Array([1,2,3])})};
let url=new URL('https://worker/v1/market/image?key='+key);assert.equal((await sharedScopedImage(new Request(url),env,url)).status,200);pass('approved public product can stream registered private R2 photo');
allowed=false;assert.equal((await sharedScopedImage(new Request(url),env,url)).status,404);pass('unavailable product authorization cannot expose photo');
allowed=true;metadataOwner=id;assert.equal((await sharedScopedImage(new Request(url),env,url)).status,404);pass('R2 ownership mismatch denied');metadataOwner=owner;
section='messages';key=`messages/${conversation}/${owner}/${id}.jpg`;url=new URL('https://worker/v1/messages/image?key='+key);assert.equal((await sharedScopedImage(new Request(url),env,url,{token:'participant'})).status,200);allowed=false;assert.equal((await sharedScopedImage(new Request(url),env,url,{token:'outsider'})).status,404);pass('chat image participant grant required, no Admin bypass');
assert.equal(origin(new Request('https://worker',{headers:{origin:'https://web.appherday.com'}}),env),'https://web.appherday.com');assert.equal(origin(new Request('https://worker',{headers:{origin:'https://evil.example'}}),env),null);pass('configured web origin allowed; unrelated origin denied');
// Actual shared image reader: body failure retries and successful blobs are reused.
let calls=0;const context={console,Map,URL:{createObjectURL:()=> 'blob:fixture',revokeObjectURL(){}},AbortSignal,Response,Error,currentUser:()=>({id:owner}),window:{},S:{},herdaySession:async()=>({data:{session:{access_token:'token'}}}),fetch:async()=>{calls++;if(calls===1)throw TypeError('network');return new Response(new Uint8Array([1,2,3]),{headers:{'content-type':'image/jpeg'}});}};
vm.createContext(context);vm.runInContext(read('web/scoped-media.js')+'\nglobalThis.media=herdayScopedMedia;',context);assert.equal(await context.media.privateUrl('/v1/messages/image',key),'blob:fixture');assert.equal(calls,2);await context.media.privateUrl('/v1/messages/image',key);assert.equal(calls,2);pass('chat image network retry and stable in-session blob cache');
const market=read('web/marketplace.js');const map=JSON.parse(/const countryCurrency=(\{[^\n]+\});/.exec(market)[1]);assert.equal(map.PK,'PKR');assert.equal(map.US,'USD');assert.equal(map.AE,'AED');pass('country currency mapping includes PKR/USD/AED');
assert(market.includes("if(!draft.currencyTouched)draft.currency=countryCurrency[country]||''"));assert(market.includes('revision!==countryRevision'));assert(market.includes('Promise.any(['));pass('manual country/currency guards and parallel detection retained (source check)');
assert(market.includes('https://wa.me/${esc(p.whatsapp)}'));assert(market.includes('herdayMessages.open(p.author_id,p.id)'));pass('existing WhatsApp CTA and seller-specific chat preserved (source check)');
console.log(`${count} checks passed`);
// Actual upload transport retries the identical multipart payload and rotates expired JWT once.
const uploadCode=read('web/batch2.js').split('\nasync function herdayUploadFile')[0];
let uploadCalls=[],attempt=0;const payload=new FormData();payload.append('upload_id',id);payload.append('file',new Blob(['same bytes']),'test.jpg');
const up={AbortController,setTimeout,clearTimeout,Response,currentUser:()=>({id:owner}),herdaySession:async()=>({data:{session:{user:{id:owner},access_token:'fresh'}}}),fetch:async(u,o)=>{uploadCalls.push(o);return ++attempt===1?new Response('{}',{status:401}):Response.json({ok:true});}};vm.createContext(up);vm.runInContext(uploadCode,up);assert.equal((await up.herdayUploadFetch('https://worker',payload,'expired')).status,200);assert.equal(uploadCalls[0].body,payload);assert.equal(uploadCalls[1].body,payload);assert.equal(uploadCalls[1].headers.Authorization,'Bearer fresh');pass('upload refresh keeps identical multipart bytes and upload ID');
// Product preparation stays stable across an unknown upload outcome and a user retry.
let draws=0,uploads=0,files=[];
class FakeImage{naturalWidth=6000;naturalHeight=4000;set src(v){if(v)queueMicrotask(()=>this.onload());}}
const att={Map,File,FormData,crypto,Image:FakeImage,Error,setTimeout,clearTimeout,URL:{createObjectURL:()=> 'blob:photo',revokeObjectURL(){}},document:{createElement:()=>({getContext:()=>({drawImage(){draws++;}}),toBlob(cb){cb(new Blob(['optimized'],{type:'image/webp'}));}})},currentUser:()=>({id:owner}),herdaySession:async()=>({data:{session:{user:{id:owner},access_token:'token'}}}),HERDAY_UUID:/^[a-f0-9-]{36}$/i,window:{},herdayUploadFetch:async(w,body)=>{uploads++;files.push(body.get('file'));if(uploads===1)throw Error('unknown network outcome');return Response.json({ok:true,section:'buy_sell',status:'pending',key:`pending/buy_sell/${owner}/${body.get('upload_id')}.webp`,size:body.get('file').size,width:2048,height:1365});}};
vm.createContext(att);vm.runInContext(read('web/section-attachments.js')+'\nglobalThis.attach=herdaySectionAttachments;',att);att.attach.add('draft',[new File(['large input'],'photo.jpg',{type:'image/jpeg'})],4);await assert.rejects(att.attach.upload('draft','buy_sell'));await att.attach.upload('draft','buy_sell');assert.equal(draws,1);assert.equal(files[0],files[1]);assert.equal(att.attach.collection('draft')[0].uploading,false);pass('large-dimension product photo optimized once and reused after failure');
console.log(`${count} total checks passed`);
