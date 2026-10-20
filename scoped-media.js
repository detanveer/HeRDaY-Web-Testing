/* Bounded shared media session lookup: do not leave previews waiting indefinitely. */
async function herdayMediaSession(force=false){
 const expected=currentUser()?.id||null;let timer;
 try{const result=await Promise.race([herdaySession(force),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Session restoration timed out. Retry when connected. [MEDIA_SESSION_TIMEOUT]')),15000);})]);
  if((currentUser()?.id||null)!==expected)throw Error('Account changed. Reopen the page.');
  if(result?.error)throw result.error;return result;
 }finally{clearTimeout(timer);}
}
function herdayMediaFailure(data,status,fallback='Photo unavailable'){
 const stage=/^[a-z0-9-]{1,48}$/.test(data?.diagnostic?.stage||'')?data.diagnostic.stage:null;
 const reason=/^[a-z0-9-]{1,48}$/.test(data?.diagnostic?.reason||'')?data.diagnostic.reason:null;
 const message=typeof data?.error==='string'?data.error.slice(0,180):fallback;
 return message+' (HTTP '+status+(stage?'; '+stage:'')+(reason?'; '+reason:'')+').';
}
/* Shared authenticated image reader; private URLs are never persisted or placed in query tokens. */
const herdayScopedMedia=(()=>{
 let owner=null,epoch=0,viewer=null;const imageFlights=new WeakMap();const blobs=new Map(),pending=new Map();
 const base=()=> (window.HERDAY_MEDIA_WORKER||'https://herday-media-api.urduwaveblog.workers.dev').replace(/\/+$/,'');
 function reset(){const next=currentUser()?.id||null;if(next!==owner){closeViewer();owner=next;epoch++;for(const url of blobs.values())URL.revokeObjectURL(url);blobs.clear();pending.clear();}}
 function publicProduct(key){return base()+'/v1/market/image?key='+encodeURIComponent(key);}
 async function privateUrl(path,key){reset();const cache=path+'|'+key;if(blobs.has(cache))return blobs.get(cache);if(pending.has(cache))return pending.get(cache);const ticket=epoch;
  const flight=(async()=>{const publicRead=path==='/v1/market/image';const {data,error}=publicRead?{data:null,error:null}:await herdayMediaSession();if(error)throw error;if(!publicRead&&!data?.session?.access_token)throw Error('Login required.');
   let token=data?.session?.access_token,blob;
   for(let attempt=0;attempt<3;attempt++){
    reset();if(ticket!==epoch)throw Error('Session changed.');
    try{
     const r=await fetch(base()+path+'?key='+encodeURIComponent(key),{headers:publicRead?{}:{Authorization:'Bearer '+token},cache:'no-store',redirect:'error',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(20000)});
     if(!publicRead&&r.status===401&&attempt<2){const refreshed=await herdayMediaSession(true);reset();if(ticket!==epoch||!refreshed.data?.session?.access_token)throw Error('Session changed.');token=refreshed.data.session.access_token;continue;}
     if([408,429,500,502,503,504].includes(r.status)&&attempt<2){await r.body?.cancel();continue;}
     if(!r.ok){let detail;try{detail=await r.json();}catch{}const error=Error(herdayMediaFailure(detail,r.status));error.terminal=true;throw error;}
     if(!/^image\/(jpeg|png|webp)(?:;|$)/i.test(r.headers.get('content-type')||'')){const error=Error('Image unavailable.');error.terminal=true;throw error;}
     blob=await r.blob();break;
    }catch(error){if(error.terminal||attempt===2)throw error;}
   }
   if(!blob?.size)throw Error('Image unavailable.');
reset();if(ticket!==epoch)throw Error('Session changed.');const url=URL.createObjectURL(blob);blobs.set(cache,url);return url;
  })();pending.set(cache,flight);try{return await flight;}finally{if(pending.get(cache)===flight)pending.delete(cache);}
 }
 function closeViewer(){viewer?.close();viewer?.remove();viewer=null;}
 async function showPhoto(path,key){
  closeViewer();reset();const who=owner,route=S.route,conversation=S.conversationId;
  const dialog=document.createElement('dialog');viewer=dialog;dialog.className='herday-photo-viewer';dialog.dataset.conversation=conversation||'';dialog.setAttribute('aria-label','Photo viewer');
  dialog.innerHTML=`<header><strong>Photo</strong><button type="button" data-photo-close aria-label="Close photo">×</button></header><p role="status">Loading photo…</p>`;
  document.body.append(dialog);dialog.showModal();dialog.addEventListener('close',()=>{if(viewer===dialog)viewer=null;dialog.remove();});dialog.addEventListener('click',e=>{if(e.target.closest('[data-photo-close]'))closeViewer();if(e.target.closest('[data-photo-zoom]')){const img=dialog.querySelector('img');if(img){const zoomed=img.classList.toggle('is-zoomed');dialog.querySelector('[data-photo-zoom]').textContent=zoomed?'Fit photo':'Zoom in';}}});
  try{const url=await privateUrl(path,key);if(viewer!==dialog||who!==currentUser()?.id||S.route!==route||S.conversationId!==conversation){if(viewer===dialog)closeViewer();return;}
   const extension=/\.(png|webp|jpe?g)$/i.exec(key)?.[1]||'jpg';dialog.innerHTML=`<header><strong>Photo</strong><button type="button" data-photo-close aria-label="Close photo">×</button></header><div class="photo-viewer-image"><img src="${esc(url)}" alt="Shared photo"></div><footer><button type="button" data-photo-zoom>Zoom in</button><a href="${esc(url)}" download="HerDay-Photo.${extension}">Download</a></footer>`;
  }catch(error){if(viewer===dialog)dialog.querySelector('[role=status]').textContent=(error?.message||'Photo could not be loaded.')+' Close and try again.';}
 }
 function syncViewer(){if(viewer&&(S.route!=='conversation'||viewer.dataset.conversation!==S.conversationId))closeViewer();}
 async function hydrate(root=document){
  reset();const ticket=epoch;
  await Promise.allSettled([...root.querySelectorAll('img[data-private-media]:not([src])')].map(el=>{
   if(imageFlights.has(el))return imageFlights.get(el);
   const flight=(async()=>{try{const url=await privateUrl(el.dataset.privatePath,el.dataset.privateMedia);
    if(ticket===epoch&&el.isConnected){el.src=url;el.alt='Photo';el.classList.remove('image-unavailable');el.removeAttribute('role');el.removeAttribute('tabindex');el.removeAttribute('title');el.onclick=null;el.onkeydown=null;}
   }catch(error){if(ticket===epoch&&el.isConnected){el.alt=(error?.message||'Photo unavailable')+' — tap to retry';el.title=el.alt;el.classList.add('image-unavailable');el.tabIndex=0;el.setAttribute('role','button');el.onclick=()=>{imageFlights.delete(el);el.alt='Loading photo…';void hydrate(el.parentElement||document);};el.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();el.click();}};}}})();
   imageFlights.set(el,flight);return flight;
  }));
 }
 // Hydrate nodes inserted after render without retry loops or duplicate fetches.
 const root=document.querySelector('#beautyApp');if(root&&typeof MutationObserver==='function'){
  let queued=false;new MutationObserver(records=>{if(queued||!records.some(r=>r.addedNodes.length))return;queued=true;queueMicrotask(()=>{queued=false;if(['market','market-category','market-product','market-mine','market-user','market-queue','conversation'].includes(S.route))void hydrate(root);});}).observe(root,{childList:true,subtree:true});
 }

 return {base,reset,publicProduct,privateUrl,hydrate,showPhoto,closeViewer,syncViewer};
})();
