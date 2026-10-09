/* Admin-only read controls for confirmed Moderator-post and deletion-audit RPCs. */
const herdayAdminHistory={owner:null,tab:'posts',posts:[],deletions:[],people:{},loaded:false,loading:false,error:'',postMore:false,deletionMore:false};
function herdayResetAdminHistory(){Object.assign(herdayAdminHistory,{owner:null,posts:[],deletions:[],people:{},loaded:false,loading:false,error:'',postMore:false,deletionMore:false});}
function herdayHistoryAuthor(id){
  if(id===currentUser()?.id)return userFullName(currentUser());
  return herdayAdminHistory.people[id]||id;
}
function herdayAdminHistoryPage(){
  if(!isAdmin())return '';
  if(herdayAdminHistory.owner!==currentUser().id){herdayResetAdminHistory();herdayAdminHistory.owner=currentUser().id;}
  if(!herdayAdminHistory.loaded&&!herdayAdminHistory.loading)setTimeout(()=>herdayAdminLoadHistory(),0);
  const h=herdayAdminHistory;
  const tabs=`<div class="hm-tabs" role="tablist"><button role="tab" class="${h.tab==='posts'?'on':''}" aria-selected="${h.tab==='posts'}" onclick="herdayHistoryTab('posts')">Moderator Posts</button><button role="tab" class="${h.tab==='deletions'?'on':''}" aria-selected="${h.tab==='deletions'}" onclick="herdayHistoryTab('deletions')">Deletion History</button></div>`;
  let content='';
  if(h.error)content=`<div class="hm-error" role="alert">Could not load history: ${esc(h.error)}<br><button class="hm-btn secondary" onclick="herdayAdminLoadHistory(true)">Try again</button></div>`;
  else if(!h.loaded)content='<p role="status">Loading history…</p>';
  else if(h.tab==='posts'){
    content=h.posts.map(p=>{
      const images=p.status==='approved'?p.r2_object_keys.map(key=>herdayPublicMedia(key,p)):[];
      return `<article class="my-post-card"><div class="my-post-meta"><b>${esc(herdayHistoryAuthor(p.author_id))}</b><span>${esc(p.section_key.replace('_',' '))}</span></div><h2 dir="auto">${esc(p.title)}</h2><p class="my-post-body" dir="auto">${esc(p.body)}</p>${images.map((image,i)=>`<img class="poetry-detail-image" src="${esc(image)}" alt="Post image ${i+1} of ${images.length}">`).join('')}<p>Auto-approved: ${esc(new Date(p.auto_approved_at).toLocaleString())}</p><p>Status: ${esc(p.status)}</p><small>Post ID: ${esc(p.id)}</small><div class="hm-actions">${p.status==='approved'&&images.length?`<button class="hm-btn secondary" onclick="herdayRetryPublication('${p.id}')">Retry Image Publishing</button>`:''}<button class="hm-btn secondary" onclick="herdayDeletePost('${p.id}')">Delete Post</button></div></article>`;
    }).join('')||'<p role="status">No auto-approved Moderator posts recorded yet.</p>';
    if(h.postMore)content+=`<button class="hm-btn secondary" ${h.loading?'disabled':''} onclick="herdayAdminLoadHistory(false,true)">Load more posts</button>`;
  }else{
    content=h.deletions.map(d=>`<article class="my-post-card"><h2>Deleted ${esc(d.section_key.replace('_',' '))} post</h2><p>Author: ${esc(herdayHistoryAuthor(d.author_id))}</p><p>Deleted by: ${esc(herdayHistoryAuthor(d.requested_by))}</p><p>${esc(new Date(d.requested_at).toLocaleString())}</p>${d.moderator_auto_approved_at?`<p>Moderator auto-approved: ${esc(new Date(d.moderator_auto_approved_at).toLocaleString())}</p>`:''}<p role="status">${d.media_deleted_at?'Origin media cleanup completed.':'Media cleanup needs confirmation.'}</p><small>Post ID: ${esc(d.submission_id)}</small>${!d.media_deleted_at?`<div class="hm-actions"><button class="hm-btn secondary" onclick="herdayDeletePost('${d.submission_id}')">Retry Media Cleanup</button></div>`:''}</article>`).join('')||'<p role="status">No posts have been deleted.</p>';
    if(h.deletionMore)content+=`<button class="hm-btn secondary" ${h.loading?'disabled':''} onclick="herdayAdminLoadHistory(false,true)">Load more history</button>`;
  }
  return head('Moderator Posts & History','Review Moderator activity and post deletion cleanup','mod-users')+`<div class="hm-wrap">${tabs}${content}</div>`;
}
function herdayHistoryTab(tab){if(!['posts','deletions'].includes(tab)||herdayAdminHistory.loading)return;herdayAdminHistory.tab=tab;render();}
async function herdayAdminLoadHistory(reset=false,more=false){
  if(!isAdmin()||herdayAdminHistory.loading)return;
  const h=herdayAdminHistory,owner=currentUser().id,tab=h.tab;
  h.loading=true;h.error='';
  try{
    if(!more){
      const [posts,deletions,people]=await Promise.all([
        herdayRpc('herday_admin_get_moderator_posts',{p_limit:30,p_before_created_at:null,p_before_id:null}),
        herdayRpc('herday_admin_get_content_deletions',{p_limit:30,p_before_requested_at:null,p_before_id:null}),
        herdayRpc('admin_list_moderator_candidates')
      ]);
      if(!Array.isArray(posts)||!Array.isArray(deletions)||!Array.isArray(people))throw new Error('Invalid history response.');
      if(currentUser()?.id!==owner)return;
      h.posts=posts;h.deletions=deletions;h.postMore=posts.length===30;h.deletionMore=deletions.length===30;
      h.people=Object.fromEntries(people.map(p=>[p.user_id,[p.first_name,p.last_name].filter(Boolean).join(' ')]));
    }else if(tab==='posts'){
      const last=h.posts.at(-1);if(!last)return;
      const rows=await herdayRpc('herday_admin_get_moderator_posts',{p_limit:30,p_before_created_at:last.created_at,p_before_id:last.id});
      if(!Array.isArray(rows))throw new Error('Invalid posts response.');if(currentUser()?.id!==owner)return;
      h.posts.push(...rows.filter(p=>!h.posts.some(x=>x.id===p.id)));h.postMore=rows.length===30;
    }else{
      const last=h.deletions.at(-1);if(!last)return;
      const rows=await herdayRpc('herday_admin_get_content_deletions',{p_limit:30,p_before_requested_at:last.requested_at,p_before_id:last.submission_id});
      if(!Array.isArray(rows))throw new Error('Invalid deletion history response.');if(currentUser()?.id!==owner)return;
      h.deletions.push(...rows.filter(d=>!h.deletions.some(x=>x.submission_id===d.submission_id)));h.deletionMore=rows.length===30;
    }
    if(h.posts.some(p=>!HERDAY_UUID.test(p.id||'')||!HERDAY_UUID.test(p.author_id||'')||!['poetry','explore','girls_space'].includes(p.section_key)||!Array.isArray(p.r2_object_keys))||h.deletions.some(d=>!HERDAY_UUID.test(d.submission_id||'')||!HERDAY_UUID.test(d.author_id||'')))throw new Error('History records could not be verified.');
    h.loaded=true;
  }catch(error){if(currentUser()?.id===owner){h.error=error.message||'Connection failed.';h.loaded=true;}}
  finally{h.loading=false;if(S.route==='mod-post-history'&&currentUser()?.id===owner)render();}
}
