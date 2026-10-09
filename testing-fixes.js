/* Backend-backed corrections for the October user testing batch. */
const herdayFix={identities:{},feedKey:'',feedMore:false,feedRequest:0,actionBusy:new Set(),mine:[],mineMore:false,mineLoading:false,mineOwner:null};
function herdayFeedRequest(){
 const q=S.route==='poetry-category'?poetryUI.categorySearch:poetryUI.mainSearch;
 return {p_view:'published',p_section_key:'poetry',p_limit:S.route==='poetry'&&!q.trim()?4:30,p_submission_id:S.route==='poetry-post'?S.poetryPostKey:null,p_query:S.route==='poetry-post'?'':q,p_category_id:S.route==='poetry-category'?S.poetryCategoryId||null:null};
}
function herdayFeedKey(){return JSON.stringify(herdayFeedRequest());}
async function herdayIdentities(ids){
 const wanted=[...new Set(ids)].filter(id=>HERDAY_UUID.test(id||''));
 for(let i=0;i<wanted.length;i+=100){
  const rows=await herdayRpc('herday_get_author_identities',{p_author_ids:wanted.slice(i,i+100)});
  if(!Array.isArray(rows))throw new Error('Invalid author response.');
  await Promise.all(rows.map(async r=>{if(!wanted.includes(r.id))throw new Error('Invalid author identity.');const photo=await signedStorageUrl('profile-photos',r.avatar_path);herdayFix.identities[r.id]={...r,photo};herdayContent.authors[r.id]=r.public_name||'HerDay User';}));
 }
 return herdayFix.identities;
}
async function herdayPublicAuthors(ids){await herdayIdentities(ids);}
function herdayAdaptPost(r,cats){
 const images=r.r2_object_keys.map(k=>herdayPublicMedia(k,r));
 const who=herdayFix.identities[r.author_id];
 return {...r,key:r.id,author:who?.public_name||'HerDay User',avatar:who?.photo||'',time:herdayTime(r.created_at),category:r.category_name||cats.find(c=>c.id===r.poetry_category_id)?.name||'Poetry',preview:r.body,poem:r.body,images,image:images[0]||'',likes:0,commentCount:0,liked:false,saved:false,order:Date.parse(r.created_at)};
}
async function herdayRefreshActions(posts){
 if(!posts.length)return;
 const rows=await herdayRpc('herday_get_poetry_actions',{p_submission_ids:posts.map(p=>p.id)});
 for(const r of rows){const p=posts.find(p=>p.id===r.id);if(p)Object.assign(p,{likes:Number(r.likes),liked:!!r.liked,saved:!!r.saved,commentCount:Number(r.comment_count)});}
}
function herdayRenderPreservingInput(){
 const input=document.activeElement,key=input?.dataset?.poetrySearch,position=input?.selectionStart;
 render();if(key){const next=document.querySelector(`[data-poetry-search="${key}"]`);next?.focus({preventScroll:true});if(next?.type!=='search')next?.setSelectionRange(position,position);}
}
async function herdayLoadPoetry(force=false,more=false){
 const key=herdayFeedKey();
 if(!force&&!more&&herdayContent.loaded&&herdayFix.feedKey===key)return;
 if(!force&&!more&&herdayContent.loading&&herdayFix.feedKey===key)return herdayContent.loading;
 if(more&&(!herdayFix.feedMore||herdayContent.loading))return;
 const serial=++herdayFix.feedRequest,request=herdayFeedRequest(),last=more?herdayContent.posts.at(-1):null;
 const owner=currentUser()?.id||null;
 herdayFix.feedKey=key;herdayContent.error='';
 const task=(async()=>{
  try{
   const [rows,cats]=await Promise.all([herdayRpc('herday_get_content_v2',{...request,p_before_created_at:last?.created_at||null,p_before_id:last?.id||null}),poetryFetchActiveCategories()]);
   if(!Array.isArray(rows)||rows.some(r=>!HERDAY_UUID.test(r.id||'')||!HERDAY_UUID.test(r.author_id||'')||r.section_key!=='poetry'||r.status!=='approved'||!Array.isArray(r.r2_object_keys)))throw new Error('Invalid Poetry response.');
   await herdayIdentities(rows.map(r=>r.author_id));
   const posts=rows.map(r=>herdayAdaptPost(r,cats));await herdayRefreshActions(posts);
   if(serial!==herdayFix.feedRequest||key!==herdayFeedKey()||owner!==(currentUser()?.id||null))return;
   herdayContent.cats=cats;herdayContent.posts=more?[...herdayContent.posts,...posts.filter(p=>!herdayContent.posts.some(x=>x.id===p.id))]:posts;
   herdayFix.feedMore=request.p_limit===30&&rows.length===30;herdayContent.loaded=true;
  }catch(error){if(serial===herdayFix.feedRequest){herdayContent.error=error.message||'Could not load Poetry.';herdayContent.loaded=true;}}
  finally{if(serial===herdayFix.feedRequest){herdayContent.loading=null;if(['poetry','poetry-category','poetry-post'].includes(S.route))herdayRenderPreservingInput();}}
 })();herdayContent.loading=task;return task;
}
function herdayPoetryState(){
 if(herdayFix.feedKey!==herdayFeedKey()){herdayContent.loaded=false;setTimeout(()=>herdayLoadPoetry(),0);return '<p class="poetry-empty" role="status">Loading Poetry…</p>';}
 if(herdayContent.error)return `<p class="poetry-empty" role="alert">${esc(herdayContent.error)} <button onclick="herdayLoadPoetry(true)">Try again</button></p>`;
 if(!herdayContent.loaded){setTimeout(()=>herdayLoadPoetry(),0);return '<p class="poetry-empty" role="status">Loading Poetry…</p>';}
 return '';
}
function herdayMoreFeed(){return herdayFix.feedMore?`<button class="btn secondary" ${herdayContent.loading?'disabled':''} onclick="herdayLoadPoetry(false,true)">Load more posts</button>`:'';}
function poetryMainList(){const state=herdayPoetryState();if(state)return state;return (herdayContent.posts.map(p=>poetryCard(p)).join('')||'<p class="poetry-empty">No matching poetry.</p>')+herdayMoreFeed();}
function poetryCategoryList(){const state=herdayPoetryState();if(state)return state;return (herdayContent.posts.map(p=>poetryCard(p,{category:true})).join('')||'<p class="poetry-empty">No posts in this category.</p>')+herdayMoreFeed();}
async function herdaySetAction(id,action){
 if(!currentUser())return nav('login');
 const post=herdayContent.posts.find(p=>p.id===id),busy=id+action;if(!post||herdayFix.actionBusy.has(busy))return;
 herdayFix.actionBusy.add(busy);const field=action==='like'?'liked':'saved',desired=!post[field];
 try{await herdayRpc('herday_set_poetry_action',{p_submission_id:id,p_action:action,p_enabled:desired});await herdayRefreshActions([post]);render();}
 catch(error){alert('Could not save this action: '+(error.message||'Connection failed.'));herdayContent.loaded=false;}
 finally{herdayFix.actionBusy.delete(busy);}
}
function poetryActions(post,plain=false){return `<div class="poetry-actions"><button class="poetry-like ${post.liked?'is-on':''}" aria-pressed="${post.liked}" data-poetry-action="like" data-key="${esc(post.key)}" aria-label="Like post">${poetryIcon('heart')}<span>${post.likes||''}</span></button><button data-poetry-action="comments" data-key="${esc(post.key)}" aria-label="Read comments">${poetryIcon('comment')}<span>${post.commentCount||''}</span></button><button data-poetry-action="share" data-key="${esc(post.key)}">${poetryIcon(plain?'plane':'share')}<span>Share</span></button><button class="${post.saved?'is-on':''}" aria-pressed="${post.saved}" data-poetry-action="save" data-key="${esc(post.key)}">${poetryIcon('save')}<span>${post.saved?'Saved':'Save'}</span></button></div>`;}
function poetryComment(c){const photo=herdayFix.identities[c.author_id]?.photo;return `<div class="poetry-comment">${photo?`<img class="poetry-avatar" src="${esc(photo)}" alt="">`:`<span class="poetry-avatar poetry-user-initial">${esc(c.author.slice(0,1))}</span>`}<div class="poetry-comment-copy"><b>${esc(c.author)}</b><time>${esc(c.time)}</time><p dir="auto">${esc(c.body)}</p></div>${c.author_id===currentUser()?.id||isAdmin()?`<button class="poetry-menu" data-poetry-action="comment-menu" data-comment-id="${esc(c.id)}" aria-label="Comment options">${poetryIcon('menu')}</button>`:''}</div>`;}
async function herdayDeleteComment(id){
 if(!confirm('Delete this comment?'))return;
 try{await herdayRpc('herday_delete_poetry_comment',{p_comment_id:id});await herdayLoadComments(S.poetryPostKey);await herdayRefreshActions(herdayContent.posts);render();}
 catch(error){alert('Comment could not be deleted: '+error.message);}
}
const herdayOriginalReset=herdayResetPrivateState;
herdayResetPrivateState=function(){const changed=herdayPrivateOwner!==(currentUser()?.id||null);herdayOriginalReset();if(changed){herdayFix.mine=[];herdayFix.mineOwner=null;herdayContent.loaded=false;herdayFix.feedRequest++;herdayContent.loading=null;herdayFix.identities={};herdayContent.authors={};herdayCloseEdit();}};
let herdayEditing=null,herdayEditBusy=false,herdayEditReturnFocus=null;
function herdayCloseEdit(){if(herdayEditBusy)return;document.getElementById('herdayEdit')?.remove();document.documentElement.classList.remove('hm-lock');herdayEditing=null;herdayEditReturnFocus?.focus?.();}
async function herdayEditPost(id,after){
 if(!currentUser())return nav('login');
 try{
  const mine=herdayFix.mine.find(r=>r.id===id),section=mine?.section_key||S.modSection||'poetry';
  const [rows,cats]=await Promise.all([herdayRpc('herday_get_content_v2',{p_view:mine?'mine':'queue',p_section_key:section,p_submission_id:id,p_limit:1}),poetryFetchActiveCategories()]);
  const x=rows[0];if(!x||x.status!=='pending')throw new Error('This post is no longer pending. Reload the list.');
  herdayEditing={x,after};herdayEditReturnFocus=document.activeElement;
  document.getElementById('herdayEdit')?.remove();document.documentElement.classList.add('hm-lock');
  document.body.insertAdjacentHTML('beforeend',`<div id="herdayEdit" class="hm-modal-backdrop"><form class="hm-modal herday-edit-form" role="dialog" aria-modal="true" aria-labelledby="editPostTitle" onsubmit="herdaySaveEdit(event)"><h2 id="editPostTitle">Edit Pending Post</h2><label>Title<input name="title" value="${esc(x.title)}" maxlength="180" required></label>${x.section_key==='poetry'?`<label>Category<select name="category" required><option value="">Select a category</option>${cats.map(c=>`<option value="${esc(c.id)}" ${c.id===x.poetry_category_id?'selected':''}>${esc(c.name)}</option>`).join('')}</select></label>`:''}<label>Post text<textarea name="body" maxlength="20000" required dir="auto">${esc(x.body)}</textarea></label><p role="status"></p><div class="hm-actions"><button type="button" class="hm-btn secondary" onclick="herdayCloseEdit()">Cancel</button><button class="hm-btn primary" type="submit">Save Changes</button></div></form></div>`);
  document.querySelector('#herdayEdit input')?.focus();
 }catch(error){alert('Could not open editor: '+error.message);}
}
async function herdaySaveEdit(event){
 event.preventDefault();if(herdayEditBusy||!herdayEditing)return;
 const form=event.target,{x,after}=herdayEditing;herdayEditBusy=true;form.querySelectorAll('button').forEach(b=>b.disabled=true);
 try{await herdayRpc('herday_edit_pending_content_v2',{p_submission_id:x.id,p_title:form.elements.title.value.trim(),p_body:form.elements.body.value.trim(),p_poetry_category_id:form.elements.category?.value||null,p_expected_updated_at:x.updated_at});herdayEditBusy=false;herdayCloseEdit();if(after)await after();else await loadMyPosts();poetrySuccessNotice('Changes saved. The post remains pending.');}
 catch(error){form.querySelector('[role="status"]').textContent=error.message||'Changes could not be saved.';}
 finally{herdayEditBusy=false;form.querySelectorAll('button').forEach(b=>b.disabled=false);}
}
document.addEventListener('keydown',event=>{const modal=document.getElementById('herdayEdit');if(!modal)return;if(event.key==='Escape')herdayCloseEdit();if(event.key==='Tab'){const controls=[...modal.querySelectorAll('input,textarea,select,button')].filter(e=>!e.disabled);const first=controls[0],last=controls.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}});
function herdayMineHtml(){
 const sections={poetry:'Poetry',explore:'Explore',girls_space:'Girls’ Space'};
 return (herdayFix.mine.map(x=>`<article class="my-post-card"><div class="my-post-meta"><span>${esc(sections[x.section_key]||'Submission')}</span><b class="my-post-status status-${esc(x.status)}">${esc(x.status[0].toUpperCase()+x.status.slice(1))}</b></div><h2 dir="auto">${esc(x.title)}</h2><p class="my-post-body" dir="auto">${esc(x.body)}</p>${x.status==='rejected'?`<p class="my-post-reason">${x.rejection_reason?'Rejection reason: '+esc(x.rejection_reason):'No reason was recorded for this older rejection.'}</p>`:''}<small>${esc(new Date(x.created_at).toLocaleDateString())}</small><div class="hm-actions">${x.status==='pending'?`<button class="btn secondary" onclick="herdayEditPost('${x.id}')">Edit Post</button>`:''}${x.status==='rejected'?`<button class="btn secondary" onclick="herdayDeleteRejected('${x.id}')">Delete Post</button>`:isAdmin()?`<button class="btn secondary" onclick="herdayDeletePost('${x.id}')">Delete Post</button>`:''}${x.status==='approved'&&x.r2_object_keys.length&&['admin','moderator'].includes(currentUser()?.role)?`<button class="btn secondary" onclick="herdayRetryPublication('${x.id}')">Retry Image Publishing</button>`:''}</div></article>`).join('')||'<p>You have not submitted any posts yet.</p>')+(herdayFix.mineMore?`<button class="btn secondary" onclick="loadMyPosts(true)" ${herdayFix.mineLoading?'disabled':''}>Load more posts</button>`:'');
}
async function loadMyPosts(more=false){
 const box=document.getElementById('myPostsList'),owner=currentUser()?.id;if(!box||!owner||herdayFix.mineLoading)return;
 herdayFix.mineLoading=true;if(!more)box.innerHTML='<p role="status">Loading your posts…</p>';
 const last=more&&herdayFix.mineOwner===owner?herdayFix.mine.at(-1):null;
 try{const [rows,jobs]=await Promise.all([herdayRpc('herday_get_content_v2',{p_view:'mine',p_limit:30,p_before_created_at:last?.created_at||null,p_before_id:last?.id||null}),herdayRpc('herday_get_own_deletion_cleanup')]);if(!Array.isArray(rows)||rows.some(r=>r.author_id!==owner))throw new Error('Invalid own posts response.');if(!box.isConnected||currentUser()?.id!==owner)return;herdayFix.mineOwner=owner;herdayFix.mine=more?[...herdayFix.mine,...rows.filter(r=>!herdayFix.mine.some(x=>x.id===r.id))]:rows;herdayFix.mineMore=rows.length===30;box.innerHTML=herdayMineHtml()+jobs.map(job=>`<div class="my-post-card"><p>${esc(job.title||'Rejected post')} was removed; image cleanup needs confirmation.</p><button class="btn secondary" onclick="herdayDeleteRejected('${job.submission_id}')">Retry Image Cleanup</button></div>`).join('');}
 catch(error){if(box.isConnected&&currentUser()?.id===owner)box.innerHTML=`<p role="alert">${esc(error.message)} <button onclick="loadMyPosts()">Try again</button></p>`;}
 finally{herdayFix.mineLoading=false;box.querySelector('button[onclick="loadMyPosts(true)"]')?.removeAttribute('disabled');if(S.route==='my-posts'&&document.getElementById('myPostsList')!==box)setTimeout(()=>loadMyPosts(),0);}
}
async function herdayDeleteRejected(id){
 if(herdayContent.deleting.has(id)||!confirm('Permanently delete your rejected post and attached images?'))return;
 herdayContent.deleting.add(id);
 try{const result=await herdayMediaAction('/v1/owner/delete-rejected',{submission_id:id,confirm:true});if(result.submission_id!==id||result.media_cleanup!=='complete')throw new Error('Cleanup could not be confirmed.');herdayAdminHistory.loaded=false;await loadMyPosts();poetrySuccessNotice('Rejected post deleted.');}
 catch(error){alert('Deletion could not be confirmed: '+error.message+' Check My Posts for Retry Image Cleanup.');await loadMyPosts();}
 finally{herdayContent.deleting.delete(id);}
}
async function herdayOptimizeImage(file){
 // Preserve animation; avoid re-encoding small images.
 if(file.size<=350*1024)return file;
 const header=new Uint8Array(await file.slice(0,262144).arrayBuffer());const chunks=new TextDecoder('latin1').decode(header);if(chunks.includes('acTL')||chunks.includes('ANIM'))return file;
 let bitmap;try{bitmap=await createImageBitmap(file);}catch{return file;}
 try{const scale=Math.min(1,1600/Math.max(bitmap.width,bitmap.height)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',0.86));if(!blob||blob.size>=file.size)return file;return new File([blob],file.name.replace(/\.[^.]*$/,'')+'.webp',{type:'image/webp'});}finally{bitmap.close();}
}
function herdayImageError(image){
 if(image.dataset.retried!=='1'){image.dataset.retried='1';const url=new URL(image.src);url.searchParams.set('retry',Date.now());image.src=url.href;return;}
 const wrap=document.createElement('span');wrap.className='herday-image-error';wrap.innerHTML='<span>Image could not load.</span><button type="button">Retry</button>';image.replaceWith(wrap);wrap.querySelector('button').onclick=event=>{event.stopPropagation();image.dataset.retried='0';wrap.replaceWith(image);const url=new URL(image.src);url.searchParams.set('retry',Date.now());image.src=url.href;};
}
