/* Saved content uses existing authorised read/action RPCs; no new tables or SQL. */
function herdayNewSavedState(){return {owner:currentUser()?.id||null,rows:[],loaded:false,loading:false,more:true,error:'',request:0,streams:['poetry','explore','girls_space'].map(section=>({section,cursor:null,more:true,pending:[]}))};}
herdaySavedReset=function(){herdaySaved=herdayNewSavedState();};
herdaySavedPage=function(){
 if(!currentUser())return '';if(herdaySaved.owner!==currentUser().id||!herdaySaved.streams)herdaySavedReset();
 if(!herdaySaved.loaded&&!herdaySaved.loading)setTimeout(()=>herdayLoadSaved(),0);
 const state=herdaySaved;return `<section class="saved-content-page">${head('Saved Posts','Your saved posts from Poetry, Explore and Girls’ Space.',isAdmin()?'admin-profile':'user-profile')}<div class="saved-content-feed">${state.error?`<p role="alert">${esc(state.error)}</p><button class="btn secondary" data-saved-retry>Retry</button>`:''}${state.rows.map(post=>herdaySectionFeed.card(post)).join('')}${state.loading?'<p role="status">Loading saved posts…</p>':!state.rows.length&&state.loaded&&!state.more&&!state.error?'<p>No saved posts yet.</p>':''}${state.loaded&&state.more?`<button class="btn secondary" data-saved-more ${state.loading?'disabled':''}>Load More</button>`:''}</div></section>`;
};
herdayLoadSaved=async function(more=false){
 if(!currentUser())return;if(herdaySaved.owner!==currentUser().id||!herdaySaved.streams)herdaySavedReset();
 const state=herdaySaved;if(state.loading)return;state.loading=true;state.error='';const owner=currentUser().id,revision=++state.request;
 const streams=(more?state.streams:herdayNewSavedState().streams).map(s=>({...s,pending:[...s.pending]}));
 const fence=()=>{if(herdaySaved!==state||currentUser()?.id!==owner||revision!==state.request)throw Error('Account changed. Reopen Saved Posts.');};
 async function fill(stream){
  while(!stream.pending.length&&stream.more){
   const args={p_before_created_at:stream.cursor?.created_at||null,p_before_id:stream.cursor?.id||null};
   const rows=await herdayRpc(stream.section==='poetry'?'herday_saved_poetry_v2':'herday_get_content_v2',stream.section==='poetry'?args:{...args,p_view:'published',p_section_key:stream.section,p_limit:30});fence();
   if(!Array.isArray(rows)||rows.length>30||rows.some(r=>!HERDAY_UUID.test(r.id||'')||!HERDAY_UUID.test(r.author_id||'')||(stream.section==='poetry'?(r.section_key!=null&&r.section_key!=='poetry'||r.status!=null&&r.status!=='approved'):(r.section_key!==stream.section||r.status!=='approved'))||typeof r.body!=='string'||!Number.isFinite(Date.parse(r.created_at))||!Array.isArray(r.r2_object_keys)))throw Error('Saved posts could not be verified.');
   if(rows.length&&stream.cursor?.id===rows.at(-1).id)throw Error('Saved feed cursor did not advance. Please retry.');
   let posts=[];
   if(stream.section==='poetry'&&rows.length){await herdayIdentities(rows.map(r=>r.author_id));const cats=await poetryFetchActiveCategories();const adapted=rows.map(r=>herdayAdaptPost({...r,section_key:'poetry',status:'approved'},cats));await herdayRefreshActions(adapted);posts=adapted.filter(p=>p.saved).map(p=>({...p,category_name:p.category,actions:{liked:p.liked,saved:p.saved,likes:p.likes,comment_count:p.commentCount}}));}
   else if(rows.length)posts=(await herdaySectionFeed.hydrate(rows)).filter(p=>p.actions.saved);
   fence();stream.pending.push(...posts);stream.cursor=rows.at(-1)||stream.cursor;stream.more=rows.length===30;
  }
 }
 try{
  const additions=[];for(let count=0;count<3;count++){
   await Promise.all(streams.map(fill));fence();
   const heads=streams.filter(s=>s.pending.length).sort((a,b)=>Date.parse(b.pending[0].created_at)-Date.parse(a.pending[0].created_at)||b.pending[0].id.localeCompare(a.pending[0].id));
   if(!heads.length)break;additions.push(heads[0].pending.shift());
  }
  fence();const existing=more?state.rows:[],known=new Set(existing.map(p=>p.id));state.rows=[...existing,...additions.filter(p=>!known.has(p.id))];state.streams=streams;state.more=streams.some(s=>s.more||s.pending.length);state.loaded=true;
 }catch(error){if(herdaySaved===state&&currentUser()?.id===owner){state.error=error.message;state.loaded=true;}}
 finally{state.loading=false;if(herdaySaved===state&&currentUser()?.id===owner&&S.route==='saved-posts')render();}
};
document.addEventListener('click',async event=>{
 if(S.route!=='saved-posts')return;const button=event.target.closest('button');if(!button||button.disabled)return;
 if(button.hasAttribute('data-saved-more'))return void herdayLoadSaved(true);if(button.hasAttribute('data-saved-retry'))return void herdayLoadSaved(false);
 const card=button.closest('[data-post-id]'),post=herdaySaved.rows.find(p=>p.id===card?.dataset.postId),kind=button.dataset.socialAction;if(!post||!kind)return;
 try{if(kind==='menu')return herdayPostOptions(post);
 if(kind==='open')return herdayOpenContent(post,'saved-posts');
 if(kind==='share'){const url=new URL(location.origin+location.pathname),params=post.section_key==='poetry'?{page:'poetry-post',poetryPostKey:post.id}:post.section_key==='explore'?{page:'explore-post',exploreId:post.id}:{page:'gs-post',gsPostId:post.id,gsTopic:post.detail_key};url.hash=new URLSearchParams(params);if(navigator.share){try{await navigator.share({title:post.title,url:url.href});return;}catch(e){if(e.name==='AbortError')return;}}await navigator.clipboard.writeText(url.href);alert('Post link copied.');return;}
 if(['like','save'].includes(kind)){
  const owner=currentUser()?.id;button.disabled=true;
  if(post.section_key==='poetry'){await herdayRpc('herday_set_poetry_action',{p_submission_id:post.id,p_action:kind,p_enabled:!(kind==='like'?post.actions.liked:post.actions.saved)});await herdayRefreshActions([post]);post.actions={liked:post.liked,saved:post.saved,likes:post.likes,comment_count:post.commentCount};}
  else{const stats=await herdaySectionSocial.setAction(post.id,kind,!(kind==='like'?post.actions.liked:post.actions.saved));if(stats.length!==1)throw Error('Post unavailable.');post.actions=stats[0];}
  if(owner!==currentUser()?.id)return;if(kind==='save'&&!post.actions.saved)herdaySaved.rows=herdaySaved.rows.filter(p=>p.id!==post.id);render();
 }
 }catch(error){alert(error.message||'Please retry.');}finally{if(button.isConnected)button.disabled=false;}
});
