/* Owner submissions only. Existing herday_get_content(p_view='mine') RPC
   checks auth.uid server-side. Never read unpublished content tables directly. */
function myPostsPage() {
  setTimeout(loadMyPosts,0);
  return `<section class="my-posts-page">${head('My Posts','Your submissions and moderation status',currentUser()?.role==='admin'?'admin-profile':'user-profile')}<div id="myPostsList" aria-live="polite"><p role="status">Loading your posts…</p></div></section>`;
}
async function loadMyPosts() {
  const box=document.getElementById('myPostsList'), owner=currentUser()?.id;
  if(!box||!owner)return;
  box.innerHTML='<p role="status">Loading your posts…</p>';
  try {
    const {data,error}=await supabaseClient.rpc('herday_get_content',{p_view:'mine',p_section_key:null,p_limit:100});
    if(error)throw error;
    if(!box.isConnected||currentUser()?.id!==owner)return;
    if(!Array.isArray(data)||data.some(x=>x.author_id!==owner || !['pending','approved','rejected'].includes(x.status)))throw new Error('Your posts could not be verified. Please try again.');
    const sections={poetry:'Poetry',explore:'Explore',girls_space:'Girls’ Space'};
    box.innerHTML=data.length?data.map(x=>`<article class="my-post-card"><div class="my-post-meta"><span>${esc(sections[x.section_key]||'Submission')}</span><b class="my-post-status status-${esc(x.status)}">${esc(x.status[0].toUpperCase()+x.status.slice(1))}</b></div><h2 dir="auto">${esc(x.title)}</h2><p class="my-post-body" dir="auto">${esc(x.body)}</p>${x.status==='rejected'?`<p class="my-post-reason">${x.rejection_reason?`Rejection reason: ${esc(x.rejection_reason)}`:'Rejection reason is currently unavailable.'}</p>`:''}<small>${esc(new Date(x.created_at).toLocaleDateString())}</small></article>`).join('')+(data.length===100?'<p>Showing your latest 100 submissions.</p>':''):'<p role="status">You have not submitted any posts yet.</p>';
  } catch(error) {
    if(!box.isConnected||currentUser()?.id!==owner)return;
    box.innerHTML=`<div role="alert">Could not load your posts: ${esc(error.message||'Connection failed.')}<br><button class="btn secondary" onclick="loadMyPosts()">Try again</button></div>`;
  }
}
