/* Original content stays unchanged. Only explicit server language selects fonts.
   Public-post English translation; no Diary/private content or persistent token storage. */
const herdayContentLanguage=(()=>{
 const languages=[['en','English'],['ur','اردو'],['hi','हिन्दी'],['bn','বাংলা'],['ar','العربية']];
 const supported=new Set(languages.map(x=>x[0])),jobs=new Map();let owner=null,epoch=0;
 const endpoint='https://herday-translation-api.urduwaveblog.workers.dev/v1/translate';
 function reset(){const next=currentUser()?.id||null;if(next!==owner){owner=next;epoch++;for(const j of jobs.values())j.controller?.abort();jobs.clear();}}
 function validLanguage(value){return supported.has(value);}
 function attrs(row){return validLanguage(row.content_language)?`lang="${row.content_language}" dir="${['ur','ar'].includes(row.content_language)?'rtl':'ltr'}"`:'dir="auto"';}
 function selector(value='',name='language'){return `<label class="content-language-label">Content language<select name="${name}" data-content-language required><option value="">Select language</option>${languages.map(([key,label])=>`<option value="${key}" ${value===key?'selected':''}>${label}</option>`).join('')}</select></label>`;}
 async function fingerprint(title,body,language){const text='['+[title,body,language].map(v=>JSON.stringify(v)).join(', ')+']';const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));return [...new Uint8Array(hash)].map(x=>x.toString(16).padStart(2,'0')).join('');}
 async function hydrate(rows){
  if(!rows.length)return rows;reset();const ticket=epoch;
  try{
   const ids=rows.filter(r=>HERDAY_UUID.test(r.id||'')&&typeof r.title==='string'&&typeof r.body==='string').map(r=>r.id);
   for(let i=0;i<ids.length;i+=100){
    const selected=ids.slice(i,i+100),meta=await herdayRpc('herday_get_content_languages',{p_submission_ids:selected});
    if(!Array.isArray(meta)||meta.some(m=>!selected.includes(m.id)||!(m.language===null||supported.has(m.language))||!/^[a-f0-9]{64}$/.test(m.fingerprint)))throw Error('Language unavailable');
    await Promise.all(meta.map(async m=>{const r=rows.find(r=>r.id===m.id);if(!r)return;const hash=await fingerprint(r.title,r.body,m.language);reset();if(ticket!==epoch)return;
     // A metadata read for a newer revision must never label the older visible text.
     if(hash===m.fingerprint){r.content_language=m.language;r.content_fingerprint=hash;}
    }));
   }
  }catch{/* Original text remains readable; do not guess a language or offer unverified translation. */}
  return rows;
 }
 function key(row){return row.id+':'+row.content_fingerprint;}
 function markup(row){reset();if(row.status!=='approved'||!validLanguage(row.content_language)||row.content_language==='en'||!/^[a-f0-9]{64}$/.test(row.content_fingerprint||''))return '';
  const k=key(row);let j=jobs.get(k);if(!j){j={id:row.id,hash:row.content_fingerprint,language:row.content_language,next:0,busy:false,show:false,result:null,error:'',controller:null};jobs.set(k,j);}
  return `<div class="content-translation" data-content-translation="${k}" lang="en" dir="ltr">${inner(j)}</div>`;
 }
 function inner(j){return `<button type="button" class="content-translate-button" data-translate-toggle ${j.busy?'disabled':''}>${j.busy?'Translating…':j.show?'Show Original':j.result?'Show English Translation':j.next!==0?'Resume English Translation':'Translate to English'}</button>${j.error?`<p class="content-translation-status" role="status">${esc(j.error)}</p>`:''}${j.show&&j.result?`<section class="content-translation-output" aria-label="English machine translation"><small>Machine translation · English</small><h3>${esc(j.result.title)}</h3><p>${esc(j.result.body)}</p></section>`:''}`;}
 function roots(j){return [...document.querySelectorAll('[data-content-translation]')].filter(e=>e.dataset.contentTranslation===j.id+':'+j.hash);}
 function patch(j){for(const root of roots(j))root.innerHTML=inner(j);}
 function accept(j,r){if(r?.status!=='ready'||r.submission_id!==j.id||r.fingerprint!==j.hash||r.source_language!==j.language||r.target_language!=='en'||r.machine_translation!==true||typeof r.title!=='string'||typeof r.body!=='string'||!r.title.trim()||!r.body.trim()||[...r.title].length>720||[...r.body].length>80000)throw Error('Translation could not be confirmed. Reload the post.');j.result={title:r.title,body:r.body};j.show=true;j.error='';}
 async function translate(j){reset();const ticket=epoch,actor=owner;if(j.busy)return;j.busy=true;j.error='';j.controller=new AbortController();patch(j);
  const check=()=>{reset();if(ticket!==epoch||actor!==owner||!roots(j).length)throw new DOMException('View changed','AbortError');};
  try{
   const cached=await herdayRpc('herday_get_content_translation',{p_submission_id:j.id,p_source_fingerprint:j.hash});check();
   if(cached?.status==='ready'){accept(j,cached);return;}
   if(cached?.status!=='missing')throw Error('This post changed or its translation is unavailable. Reload the post.');
   if(!actor)throw Error('Please log in to generate an English translation.');
   let rounds=0,waits=0;
   while(rounds++<50){
    check();const {data,error}=await herdaySession();check();if(error||data?.session?.user?.id!==actor||!data.session.access_token)throw Error('Session expired. Please log in again.');
    const timeout=new AbortController(),cancel=()=>timeout.abort();j.controller.signal.addEventListener('abort',cancel,{once:true});const timer=setTimeout(cancel,65000);
    let response;try{response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+data.session.access_token},body:JSON.stringify({submission_id:j.id,fingerprint:j.hash,batch:j.next}),signal:timeout.signal,cache:'no-store',redirect:'error',referrerPolicy:'no-referrer'});}finally{clearTimeout(timer);j.controller.signal.removeEventListener('abort',cancel);}
    const result=await response.json().catch(()=>null);check();
    if(response.ok&&result?.status==='ready'){accept(j,result);return;}
    if(response.status===202&&result?.ok===true&&result.status==='processing'&&Number.isInteger(result.total_batches)&&result.total_batches>=1&&result.total_batches<=40&&(result.next_batch==='finalize'||Number.isInteger(result.next_batch)&&result.next_batch>=0&&result.next_batch<result.total_batches)){
     j.next=result.next_batch;const delay=Number(result.retry_after)||0;
     if(delay){if(++waits>4)throw Error('Translation is preparing. Tap Resume shortly.');await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{j.controller.signal.removeEventListener('abort',abort);resolve();},Math.min(30,Math.max(1,delay))*1000);const abort=()=>{clearTimeout(timer);reject(new DOMException('Cancelled','AbortError'));};j.controller.signal.addEventListener('abort',abort,{once:true});});}
     continue;
    }
    if(response.status===401)throw Error('Please log in again to translate.');
    if(response.status===409)throw Error('The post changed. Reload it before translating.');
    if(response.status===429)throw Error('Translation is busy. Try again after one minute.');
    if(response.status===422)throw Error('This post is too long or complex for automatic translation. The original is available.');
    throw Error('Translation is unavailable. You can retry; the original is unchanged.');
   }
   throw Error('Translation is preparing. Tap Resume shortly.');
  }catch(error){if(ticket===epoch&&error.name!=='AbortError')j.error=error.message||'Translation unavailable.';}
  finally{j.busy=false;if(ticket===epoch)patch(j);}
 }
 document.addEventListener('click',e=>{const b=e.target.closest('[data-translate-toggle]');if(!b)return;e.preventDefault();e.stopImmediatePropagation();const root=b.closest('[data-content-translation]'),j=jobs.get(root?.dataset.contentTranslation);if(!j)return;if(j.result){j.show=!j.show;patch(j);}else void translate(j);},true);
 document.addEventListener('change',e=>{if(!e.target.matches('[data-content-language]'))return;const form=e.target.closest('form'),language=e.target.value;if(!form)return;for(const el of form.querySelectorAll('[name=title],textarea[name=body],textarea[name=poetry]')){if(validLanguage(language)){el.lang=language;el.dir=['ur','ar'].includes(language)?'rtl':'ltr';}else{el.removeAttribute('lang');el.dir='auto';}}});
 return {reset,hydrate,attrs,markup,selector,validLanguage,fingerprint};
})();
window.herdayContentLanguage=herdayContentLanguage;
