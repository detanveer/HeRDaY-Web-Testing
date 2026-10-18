/* Shared Admin report review. Private state and captured JWTs stay in memory. */
const herdayReportReviewService=(()=>{
 const sections=['poetry','explore','girls_space','community'],states=['open','under_review','resolved'];
 let identity='',generation=0;const controllers=new Set();
 const id=x=>HERDAY_UUID.test(x||''),date=x=>typeof x==='string'&&Number.isFinite(Date.parse(x));
 function reset(){const u=currentUser(),next=u?.id+':'+u?.role;if(next!==identity){identity=next;generation++;for(const c of controllers)c.abort();controllers.clear();}}
 function guard(g=generation){reset();if(g!==generation||currentUser()?.role!=='admin'||!id(currentUser()?.id))throw Error('Admin session changed. Reopen Reports & Safety.');return g;}
 async function session(g){guard(g);const {data,error}=await supabaseClient.auth.getSession();guard(g);const s=data?.session;
 if(error||s?.user?.id!==currentUser()?.id||!s.access_token)throw Error('Sign in again to review reports.');return s.access_token;}
 async function request(path,body,{worker=false,signal=null,binary=false}={}){
  reset();const g=guard(),token=await session(g);guard(g);const c=new AbortController();controllers.add(c);
  const abort=()=>c.abort();if(signal?.aborted)c.abort();else signal?.addEventListener('abort',abort,{once:true});
  try{const base=worker?(window.HERDAY_MEDIA_WORKER||'https://herday-media-api.urduwaveblog.workers.dev').replace(/\/+$/,''):SUPABASE_URL;
   const headers={Authorization:'Bearer '+token,...(worker?{}:{apikey:SUPABASE_PUBLISHABLE_KEY}),...(body===undefined?{}:{'Content-Type':'application/json'})};
   const response=await fetch(base+path,{method:body===undefined?'GET':'POST',headers,...(body===undefined?{}:{body:JSON.stringify(body)}),signal:c.signal,cache:'no-store',redirect:'error',referrerPolicy:'no-referrer'});guard(g);
   if(binary){if(!response.ok)throw Error('Private preview unavailable.');const mime=(response.headers.get('content-type')||'').split(';')[0];
    if(!['image/jpeg','image/png','image/webp'].includes(mime))throw Error('Invalid private preview.');const blob=await response.blob();guard(g);
    if(blob.size<1||blob.size>10*1024*1024)throw Error('Private preview size unavailable.');return blob;}
   const result=await response.json().catch(()=>null);guard(g);
   if(!response.ok){const e=Error(worker?'Media operation is unfinished. Reload its status before retrying.':result?.message||'Report request failed.');
    e.code=typeof result?.code==='string'?result.code:'';e.definitive=!worker&&response.status>=400&&response.status<500;throw e;}
   return result;
  }finally{controllers.delete(c);signal?.removeEventListener('abort',abort);}
 }
 const rpc=(name,body={})=>request('/rest/v1/rpc/'+name,body);
 function validJob(j){return j&&id(j.id)&&id(j.report_id)&&id(j.submission_id)&&['pending','complete'].includes(j.state)&&
 Number.isSafeInteger(j.processed_count)&&Number.isSafeInteger(j.total_count)&&j.processed_count>=0&&j.total_count>=j.processed_count&&typeof j.busy==='boolean'&&
 (j.state!=='complete'||j.processed_count===j.total_count&&!j.busy&&date(j.completed_at));}
 function validReport(r){return r&&id(r.id)&&id(r.content_id_snapshot)&&(r.submission_id===null||id(r.submission_id))&&sections.includes(r.section_key)&&
 states.includes(r.status)&&typeof r.title_snapshot==='string'&&typeof r.reason==='string'&&typeof r.description==='string'&&date(r.created_at);}
 function validContent(c,r){return c===null||c&&id(c.id)&&c.id===r.submission_id&&id(c.author_id)&&c.section_key===r.section_key&&
 ['pending','approved','rejected'].includes(c.status)&&typeof c.title==='string'&&typeof c.body==='string'&&date(c.updated_at)&&Array.isArray(c.r2_object_keys)&&
 c.r2_object_keys.length<=5&&(c.section_key!=='explore'||typeof c.ownership_declared==='boolean'&&(!c.ownership_declared||date(c.consent_at)))&&new Set(c.r2_object_keys).size===c.r2_object_keys.length&&c.r2_object_keys.every(k=>{try{return !!herdayPublicMedia(k,c);}catch{return false;}});}
 async function queue({status='open',section=null,query='',cursor=null}={}){
  if(status!==null&&!states.includes(status)||section!==null&&!sections.includes(section)||typeof query!=='string'||[...query].length>200||
   cursor&&(!id(cursor.id)||!date(cursor.created_at)))throw Error('Invalid report filters.');
  const r=await rpc('herday_get_report_queue',{p_status:status,p_section_key:section,p_query:query,p_limit:30,p_before_created_at:cursor?.created_at||null,p_before_id:cursor?.id||null});
  if(!r||!Array.isArray(r.entries)||r.entries.length>30||r.entries.some(x=>!validReport(x)||status&&x.status!==status||section&&x.section_key!==section)||
   !Number.isSafeInteger(Number(r.total_count))||Number(r.total_count)<r.entries.length||typeof r.has_more!=='boolean'||r.has_more&&!r.entries.length)throw Error('Report queue could not be confirmed.');return r;
 }
 async function review(report){if(!id(report))throw Error('Invalid report reference.');const r=await rpc('herday_get_report_review',{p_report_id:report});
  if(!r||!validReport(r.report)||r.report.id!==report||!Number.isSafeInteger(Number(r.revision))||Number(r.revision)<1||!validContent(r.content,r.report)||
   r.evidence_upload_supported!==false||!Array.isArray(r.history)||r.history.some(h=>!id(h.id)||!['keep','withdraw'].includes(h.operation)||typeof h.internal_notes!=='string'||typeof h.explanation!=='string'||!date(h.created_at))||
   r.hold!==null&&(!id(r.hold.report_id)||r.hold.active!==true||!id(r.hold.media_job_id))||
   r.media_job!==null&&(!validJob(r.media_job)||r.media_job.submission_id!==r.content?.id||r.media_job.id!==r.hold?.media_job_id))throw Error('Report review could not be confirmed.');return r;
 }
 function intent(review,operation,notes,explanation,checklist){reset();const g=guard();if(!['keep','withdraw'].includes(operation)||typeof notes!=='string'||[...notes].length>2000||
 typeof explanation!=='string'||![...explanation.trim()].length||[...explanation.trim()].length>2000||
 Object.keys(checklist||{}).sort().join(',')!=='content,declaration,evidence,guidelines,statement'||Object.values(checklist).some(x=>x!==true))throw Error('Complete all five checks and the decision explanation.');
 const args={p_report_id:review.report.id,p_request_id:crypto.randomUUID(),p_expected_revision:Number(review.revision),p_expected_content_updated_at:review.content?.updated_at||null,
  p_operation:operation,p_internal_notes:notes,p_explanation:explanation.trim(),p_checklist:{...checklist}};
 return {owner:currentUser().id,generation:g,args:Object.freeze({...args,p_checklist:Object.freeze(args.p_checklist)}),ack:null,busy:false};
 }
 async function decide(i){guard(i.generation);if(i.owner!==currentUser().id||i.busy)throw Error('Decision is already running or session changed.');i.busy=true;
 try{if(!i.ack){const a=await rpc('herday_decide_content_report',i.args);guard(i.generation);
  if(!a||!id(a.decision_id)||a.report_id!==i.args.p_report_id||a.operation!==i.args.p_operation||!Number.isSafeInteger(Number(a.revision))||
   Number(a.revision)!==i.args.p_expected_revision+1||typeof a.publish_required!=='boolean'||typeof a.replayed!=='boolean'||a.media_job_id!==null&&!id(a.media_job_id))throw Error('Decision acknowledgement is unconfirmed. Retry the same decision.');i.ack=a;}
  const current=await review(i.args.p_report_id);guard(i.generation);return {ack:i.ack,current};
 }finally{i.busy=false;}}
 async function removeBatch(report){const r=await review(report),j=r.media_job;
 if(!j||!r.hold||j.state==='complete')return r;if(j.busy)throw Error('A media attempt is fenced. Reload status; reconciliation may be required.');
 const a=await request('/v1/reports/media/withdraw',{job_id:j.id},{worker:true});
 if(a?.ok!==true||a.job_id!==j.id||typeof a.complete!=='boolean'||!Number.isSafeInteger(a.processed_count)||a.processed_count<j.processed_count||a.processed_count>j.total_count||a.total_count!==j.total_count)throw Error('Media result is unconfirmed. Reload status.');
 return review(report);
 }
 async function publish(report,expected){const r=await review(report),c=r.content;
 if(!c||c.status!=='approved'||r.hold||r.revision!==expected.revision||c.updated_at!==expected.content.updated_at||c.id!==expected.content.id)throw Error('Content changed. Reload the review before publishing.');
 const a=await request('/v1/publish',{submission_id:c.id},{worker:true});
 if(a?.ok!==true||a.submission_id!==c.id||!Array.isArray(a.published_keys)||a.published_keys.length!==c.r2_object_keys.length||
 new Set(a.published_keys).size!==a.published_keys.length||a.published_keys.some(k=>!c.r2_object_keys.includes(k)))throw Error('Publication is unconfirmed. Reload before retrying.');return review(report);
 }
 async function preview(report,key,signal){const r=await review(report);if(!r.content?.r2_object_keys.includes(key))throw Error('Image is no longer attached.');
 const q=new URLSearchParams({report_id:report,key});return request('/v1/reports/media/preview?'+q,undefined,{worker:true,binary:true,signal});}
 supabaseClient.auth.onAuthStateChange((event,s)=>{if(event==='SIGNED_OUT'||s?.user?.id!==currentUser()?.id){identity='';generation++;for(const c of controllers)c.abort();controllers.clear();}});
 return {reset,queue,review,intent,decide,removeBatch,publish,preview};
})();
window.herdayReportReviewService=herdayReportReviewService;
