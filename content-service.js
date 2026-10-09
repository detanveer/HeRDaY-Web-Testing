/* Confirmed HerDay RPC/Worker contracts only. No direct public profile/table reads. */
const HERDAY_UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const herdayContent={posts:[],cats:[],authors:{},loaded:false,loading:null,error:'',comments:{},deleting:new Set(),publicationRetries:{}};
let herdayPrivateOwner=null;
function herdayResetPrivateState(){
  const owner=currentUser()?.id||null;
  if(owner===herdayPrivateOwner)return;
  herdayPrivateOwner=owner;
  for(const state of Object.values(herdayContent.comments)){state.draft='';state.request=null;state.sending=false;}
  herdayContent.publicationRetries={};
  if(window.herdayResetAdminHistory)herdayResetAdminHistory();
}
async function herdayRetryPublication(id){
  try{await herdayPublishSubmission(id);poetrySuccessNotice('Approved images published.');if(S.route==='my-posts')await loadMyPosts();else if(['mod-post-history','content-history'].includes(S.route))await herdayAdminLoadHistory(true);else render();}
  catch(error){alert('Publishing could not be confirmed: '+(error.message||'Connection failed.')+' Do not submit or approve this post again.');}
}
async function herdayRpc(name,args={}){
  const {data,error}=await supabaseClient.rpc(name,args);
  if(error)throw error;
  return data;
}
async function herdayMediaAction(path,body){
  const {data,error}=await supabaseClient.auth.getSession();
  if(error)throw error;
  const token=data?.session?.access_token;
  if(!token)throw new Error('Session expired. Please log in again.');
  const worker=(window.HERDAY_MEDIA_WORKER||'https://herday-media-api.urduwaveblog.workers.dev').replace(/\/+$/,'');
  const response=await fetch(worker+path,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(body),cache:'no-store',redirect:'error',referrerPolicy:'no-referrer'});
  const result=await response.json().catch(()=>null);
  if(!response.ok||result?.ok!==true)throw new Error((result?.error||'Media operation failed')+' ('+response.status+').');
  return result;
}
async function herdayPublishSubmission(id){
  if(!HERDAY_UUID.test(id||''))throw new Error('Invalid submission ID.');
  const result=await herdayMediaAction('/v1/publish',{submission_id:id});
  if(result.submission_id!==id||!Array.isArray(result.published_keys))throw new Error('Publication could not be confirmed.');
  delete herdayContent.publicationRetries[id];
  herdayContent.loaded=false;
  return result;
}
function herdayPublicMedia(key,row){
  const section=row.section_key||'poetry',prefix=`pending/${section}/${row.author_id}/`;
  if(!['poetry','explore','girls_space'].includes(section)||typeof key!=='string'||!key.startsWith(prefix)||!/^pending\/(poetry|explore|girls_space)\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp)$/i.test(key))throw new Error('Published image ownership could not be verified.');
  return 'https://media.appherday.com/'+key.split('/').map(encodeURIComponent).join('/');
}
function herdayTime(iso){
  const t=Date.parse(iso);if(!Number.isFinite(t))return '';
  const minutes=Math.max(0,Math.floor((Date.now()-t)/60000));
  if(minutes<1)return 'Just now';if(minutes<60)return minutes+'m ago';
  if(minutes<1440)return Math.floor(minutes/60)+'h ago';
  return new Date(t).toLocaleDateString();
}
async function herdayPublicAuthors(ids){
  const unique=[...new Set(ids)].filter(id=>HERDAY_UUID.test(id)&&!herdayContent.authors[id]);
  for(let i=0;i<unique.length;i+=100){
    const selected=unique.slice(i,i+100),rows=await herdayRpc('herday_get_poetry_public_authors',{p_author_ids:selected});
    if(!Array.isArray(rows)||rows.some(r=>!selected.includes(r.id)))throw new Error('Invalid public authors response.');
    for(const r of rows)herdayContent.authors[r.id]=[r.first_name,r.last_name].filter(Boolean).join(' ')||'HerDay User';
  }
}
async function herdayLoadPoetry(force=false){
  if(herdayContent.loading)return herdayContent.loading;
  if(herdayContent.loaded&&!force)return;
  herdayContent.error='';
  herdayContent.loading=(async()=>{
    try{
      const [rows,cats]=await Promise.all([herdayRpc('herday_get_content',{p_view:'published',p_section_key:'poetry',p_limit:100}),poetryFetchActiveCategories()]);
      if(!Array.isArray(rows)||rows.some(r=>!HERDAY_UUID.test(r.id||'')||!HERDAY_UUID.test(r.author_id||'')||r.section_key!=='poetry'||r.status!=='approved'||typeof r.body!=='string'||typeof r.title!=='string'||!Array.isArray(r.r2_object_keys)||r.r2_object_keys.length>5))throw new Error('Invalid published Poetry response.');
      await herdayPublicAuthors(rows.map(r=>r.author_id));
      herdayContent.cats=cats;
      herdayContent.posts=rows.map(r=>{
        const images=r.r2_object_keys.map(k=>herdayPublicMedia(k,r));
        return {...r,key:r.id,author:herdayContent.authors[r.author_id]||'HerDay User',avatar:'',time:herdayTime(r.created_at),category:cats.find(c=>c.id===r.poetry_category_id)?.name||'Poetry',preview:r.body.split(/\n\s*\n/).slice(0,2).join('\n\n'),poem:r.body,images,image:images[0]||'',likes:'',commentCount:'',order:Date.parse(r.created_at)};
      });
      herdayContent.loaded=true;
    }catch(error){herdayContent.posts=[];herdayContent.error=error.message||'Could not load Poetry.';herdayContent.loaded=true;}
    finally{herdayContent.loading=null;if(['poetry','poetry-post','poetry-category'].includes(S.route))render();}
  })();
  return herdayContent.loading;
}
function herdayPoetryNavigate(route){
  if(['poetry','poetry-post','poetry-category'].includes(route)){herdayContent.loaded=false;herdayContent.error='';}
}
function herdayPoetryState(){
  if(herdayContent.error)return `<div class="poetry-empty" role="alert">Could not load Poetry: ${esc(herdayContent.error)}<br><button onclick="herdayLoadPoetry(true)">Try again</button></div>`;
  if(!herdayContent.loaded){setTimeout(()=>herdayLoadPoetry(),0);return '<p class="poetry-empty" role="status">Loading Poetry…</p>';}
  return '';
}
function herdayCommentState(id){
  return herdayContent.comments[id]||(herdayContent.comments[id]={rows:[],loaded:false,loading:false,error:'',more:false,draft:'',request:null,sending:false});
}
async function herdayLoadComments(id,more=false){
  const state=herdayCommentState(id);if(state.loading)return;
  state.loading=true;state.error='';
  const last=more?state.rows.at(-1):null;
  try{
    const rows=await herdayRpc('herday_get_poetry_comments',{p_submission_id:id,p_limit:30,p_after_created_at:last?.created_at||null,p_after_id:last?.id||null});
    if(!Array.isArray(rows)||rows.some(r=>!HERDAY_UUID.test(r.id||'')||!HERDAY_UUID.test(r.author_id||'')||typeof r.body!=='string'))throw new Error('Invalid comments response.');
    await herdayPublicAuthors(rows.map(r=>r.author_id));
    state.rows=more?[...state.rows,...rows.filter(r=>!state.rows.some(x=>x.id===r.id))]:rows;
    const total=rows.length?Number(rows[0].total_count):state.rows.length;
    state.more=rows.length===30&&state.rows.length<total;
    state.loaded=true;
  }catch(error){state.error=error.message||'Could not load comments.';state.loaded=true;}
  finally{state.loading=false;if(S.route==='poetry-post'&&S.poetryPostKey===id)render();}
}
async function herdaySendComment(form){
  if(!currentUser())return nav('login');
  const id=S.poetryPostKey,state=herdayCommentState(id),owner=currentUser().id;
  if(state.sending)return;
  const body=form.elements.comment.value.trim();
  if(!body||body.length>2000)return;
  if(!state.request||state.request.body!==body||state.request.owner!==owner)state.request={id:crypto.randomUUID(),body,owner};
  state.sending=true;state.draft=body;
  const button=form.querySelector('[type="submit"]');button.disabled=true;
  const status=form.querySelector('[role="status"]');
  if(status)status.textContent='Posting comment…';
  try{
    const result=await herdayRpc('herday_add_poetry_comment',{p_submission_id:id,p_body:body,p_request_id:state.request.id});
    if(!HERDAY_UUID.test(result||''))throw new Error('Comment result could not be confirmed.');
    state.draft='';state.request=null;form.reset();
    await herdayLoadComments(id);
    poetrySuccessNotice('Comment posted successfully.');
  }catch(error){if(status)status.textContent='Comment could not be confirmed: '+(error.message||'Connection failed.')+' Retry the same comment to confirm it without duplicating it.';}
  finally{state.sending=false;if(button.isConnected)button.disabled=false;if(S.route==='poetry-post'&&S.poetryPostKey===id){const current=document.querySelector('[data-poetry-composer] [type="submit"]');if(current)current.disabled=false;}}
}
async function herdayDeletePost(id){
  if(!isAdmin()||herdayContent.deleting.has(id)||!HERDAY_UUID.test(id||''))return;
  if(!confirm('Permanently delete this post, its comments and attached images? This cannot be undone. Basic Admin audit history will remain.'))return;
  herdayContent.deleting.add(id);
  try{
    const result=await herdayMediaAction('/v1/admin/delete-content',{submission_id:id,confirm:true});
    if(result.submission_id!==id||result.status!=='deleted'||result.media_cleanup!=='complete')throw new Error('Deletion completion could not be confirmed.');
    herdayAdminHistory.loaded=false;herdayContent.loaded=false;herdayContent.posts=herdayContent.posts.filter(p=>p.id!==id);delete herdayContent.comments[id];delete herdayContent.publicationRetries[id];
    if(S.route==='poetry-post'&&S.poetryPostKey===id)await nav('poetry');
    else if(S.route==='my-posts')await loadMyPosts();
    else if(['mod-post-history','content-history'].includes(S.route))await herdayAdminLoadHistory(true);
    else render();
    poetrySuccessNotice('Post and attached media deleted.');
  }catch(error){alert('Deletion could not be confirmed: '+(error.message||'Connection failed.')+' The post may already be removed while media cleanup is pending. Check Admin deletion history and retry cleanup for this same post.');}
  finally{herdayContent.deleting.delete(id);}
}
