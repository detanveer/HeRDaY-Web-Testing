/* Dedicated general History and separate Moderator records. Admin access is checked by every RPC. */
const herdayAdminHistory={owner:null,route:'',tab:'posts',posts:[],deletions:[],activity:[],people:{},loaded:false,loading:false,error:'',postMore:false,deletionMore:false,activityMore:false,author:null,date:''};
function herdayResetAdminHistory(){Object.assign(herdayAdminHistory,{owner:null,route:'',tab:'posts',posts:[],deletions:[],activity:[],people:{},loaded:false,loading:false,error:'',postMore:false,deletionMore:false,activityMore:false,author:null,date:''});}
function herdayHistoryAuthor(id){if(id===currentUser()?.id)return userFullName(currentUser());return herdayAdminHistory.people[id]||'Former or unavailable account';}
function herdayAdminHistoryPage(){
 if(!isAdmin())return '';
 const h=herdayAdminHistory,general=S.route==='content-history';
 if(h.owner!==currentUser().id||h.route!==S.route){herdayResetAdminHistory();h.owner=currentUser().id;h.route=S.route;h.tab=general?'activity':'posts';}
 if(!h.loaded&&!h.loading)setTimeout(()=>herdayAdminLoadHistory(),0);
 const tabs=general?[['activity','Moderation'],['deletions','Deletions']]:[['posts','Posts'],['deletions','Deleted Posts']];
 let body='';
 if(h.error)body=`<p class="hm-error" role="alert">${esc(h.error)} <button onclick="herdayAdminLoadHistory(true)">Try again</button></p>`;
 else if(!h.loaded)body='<p role="status">Loading history…</p>';
 else if(h.tab==='activity')body=h.activity.map(d=>`<article class="my-post-card"><h3>${esc(d.title||'Submission')}</h3><p>${esc(d.section_key)} — ${esc(d.to_status)}</p><p>By: ${esc(herdayHistoryAuthor(d.actor_id))}</p>${d.reason?`<p>Reason: ${esc(d.reason)}</p>`:''}<small>${esc(new Date(d.created_at).toLocaleString())}</small></article>`).join('')||'<p>No moderation decisions recorded.</p>';
 else if(h.tab==='posts')body=h.posts.map(p=>`<article class="my-post-card"><b>${esc(herdayHistoryAuthor(p.author_id))}</b><h2 dir="auto">${esc(p.title)}</h2><p class="my-post-body" dir="auto">${esc(p.body)}</p><p>${esc(p.section_key)} — ${esc(p.status)}</p><small>${esc(new Date(p.created_at).toLocaleString())}</small><div class="hm-actions">${p.status==='pending'?`<button class="hm-btn secondary" onclick="nav('mod-review',{modReviewId:'${p.id}',modSection:'${p.section_key}',modReviewBack:'mod-post-history'})">Review Post</button>`:''}${p.status==='approved'&&p.r2_object_keys.length?`<button class="hm-btn secondary" onclick="herdayRetryPublication('${p.id}')">Retry Image Publishing</button>`:''}<button class="hm-btn secondary" onclick="herdayDeletePost('${p.id}')">Delete Post</button></div></article>`).join('')||'<p>No Moderator posts recorded.</p>';
 else body=h.deletions.map(d=>`<article class="my-post-card"><h2 dir="auto">${esc(d.title_snapshot||'Deleted '+d.section_key+' post')}</h2><p>Author: ${esc(herdayHistoryAuthor(d.author_id))}</p><p>Deleted by: ${esc(herdayHistoryAuthor(d.requested_by))}</p><p>Reason: ${esc(d.deletion_reason||'No reason recorded for this older deletion.')}</p><small>${esc(new Date(d.requested_at).toLocaleString())}</small><p role="status">${d.media_deleted_at?'Media cleanup completed.':'Media cleanup needs confirmation.'}</p>${!d.media_deleted_at?`<button class="hm-btn secondary" onclick="herdayDeletePost('${d.submission_id}')">Retry Media Cleanup</button>`:''}</article>`).join('')||'<p>No deleted posts recorded.</p>';
 const more=h.tab==='posts'?h.postMore:h.tab==='activity'?h.activityMore:h.deletionMore;
 return `<section>${head(general?'History':'Moderator Posts',general?'Moderation and deletion history':'What moderators posted and deleted',general?'admin-profile':'mod-users')}<div class="hm-wrap">${!general?`<label class="hm-search">Search Moderator<input type="search" placeholder="Search by name" value="${esc(h.query||'')}" oninput="herdayHistorySearch(this.value)"></label><div id="herdayHistorySearchResults">${herdayHistorySearchResults()}</div>${h.author?`<button class="hm-btn secondary" onclick="herdayHistorySelect(null)">Show all moderators</button>`:''}`:''}<div class="hm-tabs" role="tablist">${tabs.map(([key,label])=>`<button role="tab" class="${h.tab===key?'on':''}" aria-selected="${h.tab===key}" onclick="herdayHistoryTab('${key}')">${label}</button>`).join('')}</div>${general?`<div class="herday-history-filters"><button class="hm-btn secondary" onclick="herdayHistoryDate('')">All dates</button><button class="hm-btn secondary" onclick="herdayHistoryDate(herdayHistoryDay())">Today</button><button class="hm-btn secondary" onclick="herdayHistoryDate(herdayHistoryDay(-1))">Yesterday</button><input type="date" aria-label="History date" value="${esc(h.date||'')}" onchange="herdayHistoryDate(this.value)"><button class="hm-btn secondary" ${h.loading?'disabled':''} onclick="herdayClearHistory()">Clear displayed history</button></div>`:''}${body}${more?`<button class="hm-btn secondary" ${h.loading?'disabled':''} onclick="herdayAdminLoadHistory(false,true)">Load more</button>`:''}</div></section>`;
}
let herdayHistorySearchSerial=0;
function herdayHistorySearchResults(){const h=herdayAdminHistory;return !h.query?.trim()?'':h.searching?'<p>Searching…</p>':(h.searchResults||[]).map(r=>`<button class="hm-btn secondary" onclick="herdayHistorySelect('${r.id}')">${esc(r.display_name)}</button>`).join('')||'<p>No matching moderator.</p>';}
async function herdayHistorySearch(q){
 const h=herdayAdminHistory,serial=++herdayHistorySearchSerial,owner=currentUser()?.id;h.query=q;h.searching=!!q.trim();h.searchResults=[];
 const box=document.getElementById('herdayHistorySearchResults');if(box)box.innerHTML=herdayHistorySearchResults();if(!q.trim())return;
 try{const rows=await herdayRpc('herday_admin_find_moderator_authors',{p_query:q});if(serial!==herdayHistorySearchSerial||owner!==currentUser()?.id||S.route!=='mod-post-history')return;h.searchResults=rows;for(const r of rows)h.people[r.id]=r.display_name;}
 catch(error){if(serial===herdayHistorySearchSerial&&box?.isConnected)box.textContent=error.message;return;}
 finally{if(serial===herdayHistorySearchSerial){h.searching=false;if(box?.isConnected)box.innerHTML=herdayHistorySearchResults();}}
}
function herdayHistorySelect(id){herdayAdminHistory.author=id;herdayAdminHistory.query='';herdayAdminLoadHistory(true);}
function herdayHistoryTab(tab){herdayAdminHistory.tab=tab;render();}
async function herdayAdminLoadHistory(force=false,more=false){
 if(!isAdmin())return;
 const h=herdayAdminHistory;if(h.loading)return;
 const owner=currentUser().id,route=S.route,general=route==='content-history',tab=h.tab,author=h.author;
 h.loading=true;h.error='';
 try{
  if(!more){const candidates=await herdayRpc('admin_list_moderator_candidates');h.people=Object.fromEntries(candidates.map(p=>[p.user_id,[p.first_name,p.last_name].filter(Boolean).join(' ')]));}
  const tasks=[];
  if(!general&&(!more||tab==='posts')){const last=more?h.posts.at(-1):null;tasks.push(herdayRpc('herday_admin_get_moderator_posts_v2',{p_limit:30,p_before_created_at:last?.created_at||null,p_before_id:last?.id||null,p_author_id:author}).then(rows=>({kind:'posts',rows})));}
  if(!more||tab==='deletions'){const last=more?h.deletions.at(-1):null;tasks.push(herdayRpc('herday_history_v3',{p_kind:'deletions',p_before_at:last?.requested_at||null,p_before_id:last?.submission_id||null,p_date:general?h.date||null:null,p_moderator_only:!general,p_moderator_id:general?null:author}).then(rows=>({kind:'deletions',rows})));}
  if(general&&(!more||tab==='activity')){const last=more?h.activity.at(-1):null;tasks.push(herdayRpc('herday_history_v3',{p_kind:'activity',p_before_at:last?.created_at||null,p_before_id:last?.id||null,p_date:h.date||null}).then(rows=>({kind:'activity',rows})));}
  const results=await Promise.all(tasks);
  if(currentUser()?.id!==owner||S.route!==route)return;
  for(const {kind,rows} of results){if(!Array.isArray(rows))throw new Error('Invalid history response.');h[kind]=more?[...h[kind],...rows.filter(r=>!h[kind].some(x=>(x.id||x.submission_id)===(r.id||r.submission_id)))]:rows;h[kind==='posts'?'postMore':kind==='activity'?'activityMore':'deletionMore']=rows.length===(kind==='posts'?30:5);}
  const ids=[...h.posts.map(p=>p.author_id),...h.deletions.flatMap(d=>[d.author_id,d.requested_by]),...h.activity.map(d=>d.actor_id)];await herdayIdentities(ids);if(currentUser()?.id!==owner||S.route!==route)return;for(const id of ids){const p=herdayFix.identities[id];if(p)h.people[id]=p.display_name;}
  h.loaded=true;
 }catch(error){if(currentUser()?.id===owner&&S.route===route){h.error=error.message||'Could not load history.';h.loaded=true;}}
 finally{h.loading=false;if(currentUser()?.id===owner&&S.route===route)render();}
}
