/* Shared authenticated image reader; private URLs are never persisted or placed in query tokens. */
const herdayScopedMedia=(()=>{
 let owner=null,epoch=0;const blobs=new Map(),pending=new Map();
 const base=()=> (window.HERDAY_MEDIA_WORKER||'https://herday-media-api.urduwaveblog.workers.dev').replace(/\/+$/,'');
 function reset(){const next=currentUser()?.id||null;if(next!==owner){owner=next;epoch++;for(const url of blobs.values())URL.revokeObjectURL(url);blobs.clear();pending.clear();}}
 function publicProduct(key){return base()+'/v1/market/image?key='+encodeURIComponent(key);}
 async function privateUrl(path,key){reset();const cache=path+'|'+key;if(blobs.has(cache))return blobs.get(cache);if(pending.has(cache))return pending.get(cache);const ticket=epoch;
  const flight=(async()=>{const {data,error}=await herdaySession();if(error)throw error;if(!data?.session?.access_token)throw Error('Login required.');
   const r=await fetch(base()+path+'?key='+encodeURIComponent(key),{headers:{Authorization:'Bearer '+data.session.access_token},cache:'no-store',redirect:'error',referrerPolicy:'no-referrer'});
   if(!r.ok||!/^image\/(jpeg|png|webp)(?:;|$)/i.test(r.headers.get('content-type')||''))throw Error('Image unavailable.');
   const blob=await r.blob();reset();if(ticket!==epoch)throw Error('Session changed.');const url=URL.createObjectURL(blob);blobs.set(cache,url);return url;
  })();pending.set(cache,flight);try{return await flight;}finally{if(pending.get(cache)===flight)pending.delete(cache);}
 }
 async function hydrate(root=document){reset();const ticket=epoch;await Promise.allSettled([...root.querySelectorAll('img[data-private-media]:not([src])')].map(async el=>{try{const url=await privateUrl(el.dataset.privatePath,el.dataset.privateMedia);if(ticket===epoch&&el.isConnected){el.src=url;el.alt='Photo';}}catch{if(el.isConnected){el.alt='Photo unavailable';el.classList.add('image-unavailable');}}}));}
 return {base,reset,publicProduct,privateUrl,hydrate};
})();
