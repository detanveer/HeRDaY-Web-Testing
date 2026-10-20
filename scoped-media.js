/* Shared authenticated image reader; private URLs are never persisted or placed in query tokens. */
const herdayScopedMedia=(()=>{
 let owner=null,epoch=0,viewer=null;const blobs=new Map(),pending=new Map();
 const base=()=> (window.HERDAY_MEDIA_WORKER||'https://herday-media-api.urduwaveblog.workers.dev').replace(/\/+$/,'');
 function reset(){const next=currentUser()?.id||null;if(next!==owner){closeViewer();owner=next;epoch++;for(const url of blobs.values())URL.revokeObjectURL(url);blobs.clear();pending.clear();}}
 function publicProduct(key){return base()+'/v1/market/image?key='+encodeURIComponent(key);}
 async function privateUrl(path,key){reset();const cache=path+'|'+key;if(blobs.has(cache))return blobs.get(cache);if(pending.has(cache))return pending.get(cache);const ticket=epoch;
  const flight=(async()=>{const {data,error}=await herdaySession();if(error)throw error;if(!data?.session?.access_token)throw Error('Login required.');
   const request=token=>fetch(base()+path+'?key='+encodeURIComponent(key),{headers:{Authorization:'Bearer '+token},cache:'no-store',redirect:'error',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(20000)});
   let r=await request(data.session.access_token);
   if(r.status===401){const refreshed=await herdaySession(true);reset();if(ticket!==epoch)throw Error('Session changed.');r=await request(refreshed.data?.session?.access_token);}
   if(!r.ok||!/^image\/(jpeg|png|webp)(?:;|$)/i.test(r.headers.get('content-type')||''))throw Error('Image unavailable.');
   const blob=await r.blob();reset();if(ticket!==epoch)throw Error('Session changed.');const url=URL.createObjectURL(blob);blobs.set(cache,url);return url;
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
  }catch{if(viewer===dialog)dialog.querySelector('[role=status]').textContent='Photo could not be loaded. Close and try again.';}
 }
 function syncViewer(){if(viewer&&(S.route!=='conversation'||viewer.dataset.conversation!==S.conversationId))closeViewer();}
 async function hydrate(root=document){reset();const ticket=epoch;await Promise.allSettled([...root.querySelectorAll('img[data-private-media]:not([src])')].map(async el=>{try{const url=await privateUrl(el.dataset.privatePath,el.dataset.privateMedia);if(ticket===epoch&&el.isConnected){el.src=url;el.alt='Photo';el.classList.remove('image-unavailable');el.nextElementSibling?.remove();}}catch{if(el.isConnected){el.alt='Photo unavailable — tap to retry';el.classList.add('image-unavailable');}}}));}
 return {base,reset,publicProduct,privateUrl,hydrate,showPhoto,closeViewer,syncViewer};
})();
