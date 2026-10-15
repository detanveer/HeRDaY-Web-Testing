/* No cache/offline handler. Intercept ONLY the ephemeral private Diary stream. */
const views=new Map(),UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
self.addEventListener('install',e=>e.waitUntil(self.skipWaiting()));
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
function revoke(id){const v=views.get(id);if(v){v.dead=true;v.abort?.abort();v.reader?.cancel().catch(()=>{});views.delete(id);}}
self.addEventListener('message',e=>{e.waitUntil((async()=>{const b=e.data,c=await self.clients.get(e.source?.id);if(!c||new URL(c.url).origin!==self.location.origin)return;
 if(b?.kind==='diary-revoke'){for(const [id,v]of views)if(v.client===c.id&&(!b.id||b.id===id))revoke(id);e.ports[0]?.postMessage({ok:true});return;}
 if(b?.kind!=='diary-view'||!UUID.test(b.id||'')||!UUID.test(b.media||'')||typeof b.token!=='string'||!/^([0-9a-f]{64})$/.test(b.proof||'')||!Number.isFinite(b.expires)||b.expires<=Date.now()||b.expires>Date.now()+900000||!['image/jpeg','image/png','image/webp','video/mp4','video/webm'].includes(b.mime)||!Number.isSafeInteger(b.size)||b.size<1||b.size>262144000)return;
 let w;try{w=new URL(b.worker);if(w.protocol!=='https:'||w.username||w.password||w.search||w.hash)throw Error();}catch{return;}
 const old=views.get(b.id);if(old&&(old.client!==c.id||old.media!==b.media||old.proof!==b.proof||old.expires!==b.expires))return;
 const v=old||{client:c.id,media:b.media,proof:b.proof,expires:b.expires,mime:b.mime,size:b.size,chain:Promise.resolve()};v.token=b.token;v.worker=w.href.replace(/\/$/,'');v.pulse=Date.now();views.set(b.id,v);e.ports[0]?.postMessage({ok:true});
 })());});
async function active(v){const c=await self.clients.get(v.client);return !v.dead&&Date.now()<v.expires&&Date.now()-v.pulse<15000&&c?.visibilityState==='visible';}
async function stream(e,id){const v=views.get(id);if(!v||e.clientId!==v.client||!await active(v))return new Response(null,{status:403});
 const previous=v.chain;let settled;v.chain=new Promise(r=>settled=r);await previous;
 if(!await active(v)){settled();return new Response(null,{status:403});}
 const abort=new AbortController();v.abort=abort;let source;
 try{const r=await fetch(v.worker+'/v1/diary/media/read',{method:'POST',headers:{Authorization:'Bearer '+v.token,'Content-Type':'application/json',...(e.request.headers.get('range')?{Range:e.request.headers.get('range')}:{})},body:JSON.stringify({media_id:v.media,request_id:crypto.randomUUID(),proof:v.proof}),signal:abort.signal,cache:'no-store',redirect:'error',referrerPolicy:'no-referrer'});
 if(!r.ok||!r.body||r.headers.get('content-type')!==v.mime){await r.body?.cancel();settled();return new Response(null,{status:r.status===416?416:403,headers:{'Cache-Control':'no-store'}});}source=r.body.getReader();v.reader=source;
 const done=()=>{if(v.reader===source)v.reader=null;if(v.abort===abort)v.abort=null;settled();};
 const body=new ReadableStream({async pull(c){try{if(!await active(v))throw Error();const x=await source.read();if(!await active(v))throw Error();if(x.done){done();c.close();}else c.enqueue(x.value);}catch{await source.cancel().catch(()=>{});abort.abort();done();c.error(Error('Private stream unavailable'));}},async cancel(){await source.cancel().catch(()=>{});abort.abort();done();}});
 const headers=new Headers({'Content-Type':v.mime,'Cache-Control':'no-store, private','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'});for(const key of ['content-length','content-range','accept-ranges'])if(r.headers.has(key))headers.set(key,r.headers.get(key));return new Response(body,{status:r.status,headers});
 }catch{await source?.cancel().catch(()=>{});settled();return new Response(null,{status:503,headers:{'Cache-Control':'no-store'}});}
}
self.addEventListener('fetch',e=>{const u=new URL(e.request.url),match=/\/__herday_diary_stream__\/([0-9a-f-]{36})$/.exec(u.pathname);if(u.origin!==self.location.origin||!match)return;if(e.request.method!=='GET'){e.respondWith(new Response(null,{status:405}));return;}e.respondWith(stream(e,match[1]));});
