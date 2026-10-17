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
herdayResetPrivateState=function(){const changed=herdayPrivateOwner!==(currentUser()?.id||null);herdayOriginalReset();if(changed){herdayFix.mine=[];herdayFix.mineOwner=null;herdayContent.loaded=false;herdayFix.feedRequest++;herdayContent.loading=null;herdayFix.identities={};herdayContent.authors={};herdayCloseEdit(true);herdaySavedReset();}};
let herdayEditing=null,herdayEditBusy=false,herdayEditReturnFocus=null,herdayEditOpenVersion=0;
function herdayCloseEdit(force=false){if(herdayEditBusy&&!force)return;herdayEditOpenVersion++;document.getElementById('herdayEdit')?.remove();document.documentElement.classList.remove('hm-lock');herdayEditing=null;herdayEditBusy=false;if(!force)herdayEditReturnFocus?.focus?.();}
async function herdayEditPost(id,after){
 if(herdayEditBusy)return;
 if(!currentUser())return nav('login');
 const owner=currentUser().id,opening=++herdayEditOpenVersion;
 try{
  if(!HERDAY_UUID.test(id||''))throw new Error('Invalid post.');
  const mine=herdayFix.mine.find(r=>r.id===id),section=mine?.section_key||S.modSection||'poetry';
  if(mine?.section_key==='explore')return nav('explore-edit',{exploreId:id});
  const [rows,cats]=await Promise.all([herdayRpc('herday_get_content_v2',{p_view:mine?'mine':'queue',p_section_key:section,p_submission_id:id,p_limit:1}),section==='poetry'?poetryFetchActiveCategories():Promise.resolve([])]);
  if(currentUser()?.id!==owner||opening!==herdayEditOpenVersion)return;
  const x=rows?.[0],own=x?.author_id===owner;
  if(!Array.isArray(rows)||rows.length!==1||!x||x.id!==id||!['poetry','girls_space','explore'].includes(x.section_key)||!['pending','approved','rejected'].includes(x.status)||!Array.isArray(x.r2_object_keys)||x.r2_object_keys.length>5||!Number.isFinite(Date.parse(x.updated_at))||(!own&&x.status!=='pending'))throw new Error('This post is unavailable for editing. Reload the list.');
  herdayEditing={x,after,owner,images:x.r2_object_keys.map(key=>({key})),uploads:new Map(),frozen:false,ack:null,uncertain:false,intent:null,current:null};herdayEditReturnFocus=document.activeElement;
  document.getElementById('herdayEdit')?.remove();document.documentElement.classList.add('hm-lock');
  const copy=own?(['admin','moderator'].includes(currentUser()?.role)?'Your own post remains approved after saving.':'Your revised post will be Pending. Editing a published post sends it for review again.'):x.section_key==='explore'?'This pending submission remains in review. Its author must reconfirm ownership after content changes.':'This pending submission remains in the review queue.';
  document.body.insertAdjacentHTML('beforeend',`<div id="herdayEdit" class="hm-modal-backdrop"><form class="hm-modal herday-edit-form" role="dialog" aria-modal="true" aria-labelledby="editPostTitle" onsubmit="herdaySaveEdit(event)"><h2 id="editPostTitle">${x.status==='rejected'?'Edit & Resubmit':'Edit Post'}</h2><p>${esc(copy)}</p>${herdayContentLanguage.selector(x.content_language||'')}<label>Title<input ${herdayContentLanguage.attrs(x)} name="title" value="${esc(x.title)}" maxlength="180" required></label>${x.section_key==='poetry'?`<label>Category<select name="category" required><option value="">Select a category</option>${cats.map(c=>`<option value="${esc(c.id)}" ${c.id===x.poetry_category_id?'selected':''}>${esc(c.name)}</option>`).join('')}</select></label>`:''}<label>Post text<textarea name="body" maxlength="20000" required ${herdayContentLanguage.attrs(x)}>${esc(x.body)}</textarea></label><div><h3>Images</h3><p>Remove an image, then add its replacement. Maximum five images.</p><div id="herdayEditImages"></div>${own?'<input name="newImages" type="file" accept="image/jpeg,image/png,image/webp" multiple aria-label="Add images" onchange="herdayEditAddImages(this)">':''}</div><p role="status"></p><div class="hm-actions"><button type="button" class="hm-btn secondary" onclick="herdayCloseEdit()">Cancel</button><button class="hm-btn primary" type="submit">${x.status==='rejected'?'Resubmit Post':'Save Changes'}</button></div></form></div>`);
  herdayRenderEditImages();document.querySelector('#herdayEdit input')?.focus();
 }catch(error){if(currentUser()?.id===owner&&opening===herdayEditOpenVersion)alert('Could not open editor: '+error.message);}
}
function herdayEditFence(state){if(herdayEditing!==state||currentUser()?.id!==state.owner)throw new Error('Account or editor changed. Reopen My Posts.');}
async function herdayReadEditCurrent(state){
 herdayEditFence(state);const x=state.x;
 const rows=await herdayRpc('herday_get_content_v2',{p_view:x.author_id===state.owner?'mine':'queue',p_section_key:x.section_key,p_submission_id:x.id,p_limit:1});herdayEditFence(state);
 const r=rows?.[0];if(!Array.isArray(rows)||rows.length!==1||r.id!==x.id||r.author_id!==x.author_id||r.section_key!==x.section_key||!['pending','approved','rejected'].includes(r.status)||!Number.isFinite(Date.parse(r.updated_at))||!Array.isArray(r.r2_object_keys))throw new Error('Current post could not be confirmed. Retry checking the same save.');return r;
}
function herdayEditMatches(row,args){return row.content_language===args.p_content_language&&row.title===args.p_title&&row.body===args.p_body&&JSON.stringify(row.r2_object_keys)===JSON.stringify(args.p_keys)&&(row.section_key!=='poetry'||row.poetry_category_id===args.p_category_id);}
async function herdaySaveEdit(event){
 event.preventDefault();if(herdayEditBusy||!herdayEditing)return;
 const form=event.target,state=herdayEditing,{x,after}=state;herdayEditBusy=true;const controls=[...form.querySelectorAll('button,input,textarea,select')];controls.forEach(b=>b.disabled=true);
 try{
  herdayEditFence(state);
  if(!state.intent){const language=form.elements.language.value;if(!herdayContentLanguage.validLanguage(language))throw new Error('Select content language.');const title=form.elements.title.value.trim(),body=form.elements.body.value.trim(),category=form.elements.category?.value||null;
   if(!title||[...title].length>180||!body||[...body].length>20000||(x.section_key==='poetry'&&!HERDAY_UUID.test(category||'')))throw new Error('Enter a title, content and an available category.');
   state.intent={p_content_language:language,p_submission_id:x.id,p_title:title,p_body:body,p_category_id:category,p_expected_updated_at:x.updated_at,p_keys:null};state.frozen=true;
  }
  if(!state.intent.p_keys){const keys=[];for(const image of state.images){herdayEditFence(state);if(image.key)keys.push(image.key);else{if(!state.uploads.has(image.file)){const key=await herdayUploadFile(image.file,x.section_key,image.uploadId,state.owner);herdayEditFence(state);state.uploads.set(image.file,key);}keys.push(state.uploads.get(image.file));}}state.intent.p_keys=keys;}
  const args=state.intent;
  // An unknown result is checked first. A changed version is never blindly overwritten.
  if(state.uncertain&&!state.ack){const r=await herdayReadEditCurrent(state);
   if(r.updated_at!==x.updated_at){if(!herdayEditMatches(r,args))throw new Error('The post changed. Close and reopen Edit before making changes.');state.current=r;}
  }
  if(!state.ack&&!state.current){state.uncertain=true;const result=await herdayRpc('herday_edit_content_localized',args);herdayEditFence(state);
   if(result?.submission_id!==x.id||!['pending','approved'].includes(result.status)||!Number.isFinite(Date.parse(result.updated_at))||(result.cleanup_id!==null&&result.cleanup_id!==undefined&&!HERDAY_UUID.test(result.cleanup_id)))throw new Error('Save receipt could not be confirmed. Retry checking the same save.');state.ack=result;state.uncertain=false;
  }
  const current=await herdayReadEditCurrent(state);if(!herdayEditMatches(current,args))throw new Error('The saved post has changed again. Close and reopen My Posts.');state.current=current;
  let cleanupFailed=false,publishFailed=false;
  if(state.ack?.cleanup_id)try{await herdayMediaAction('/v1/edit/cleanup',{submission_id:state.ack.cleanup_id,confirm:true});herdayEditFence(state);}catch(error){herdayEditFence(state);cleanupFailed=true;}
  if(current.status==='approved'&&current.r2_object_keys.length){herdayContent.publicationRetries[x.id]={owner:state.owner};try{await herdayPublishSubmission(x.id);herdayEditFence(state);}catch(error){herdayEditFence(state);publishFailed=true;}}
  herdayEditBusy=false;herdayCloseEdit();if(currentUser()?.id!==state.owner)return;
  if(after)await after();else await loadMyPosts();if(currentUser()?.id!==state.owner)return;
  poetrySuccessNotice((current.status==='approved'?'Changes saved. The post is approved.':current.status==='pending'?'Changes saved. The post is Pending approval.':'The post currently needs changes.')+(publishFailed?' Image publishing needs retry in My Posts.':'')+(cleanupFailed||state.uncertain?' Check My Posts for any pending removed-image cleanup.':''));
 }catch(error){if(herdayEditing===state&&currentUser()?.id===state.owner){form.querySelector('[role="status"]').textContent=(error.message||'Changes could not be confirmed.')+(state.frozen?' Keep this save unchanged, or close and reload My Posts.':'');const submit=form.querySelector('[type="submit"]');if(submit&&state.frozen)submit.textContent='Retry Same Save';}}
 finally{if(herdayEditing===state){herdayEditBusy=false;controls.forEach(b=>b.disabled=state.frozen&&!b.matches('[type="submit"],[onclick="herdayCloseEdit()"]'));}}
}
document.addEventListener('keydown',event=>{const modal=document.getElementById('herdayEdit');if(!modal)return;if(event.key==='Escape')herdayCloseEdit();if(event.key==='Tab'){const controls=[...modal.querySelectorAll('input,textarea,select,button')].filter(e=>!e.disabled);const first=controls[0],last=controls.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}});
function herdayMineHtml(){
 const sections={poetry:'Poetry',explore:'Explore',girls_space:'Girls’ Space'};
 return (herdayFix.mine.map(x=>`<article class="my-post-card"><div class="my-post-meta"><span>${esc(x.section_key==='poetry'?(x.category_name||'Poetry'):(sections[x.section_key]||'Submission'))}</span><b class="my-post-status status-${esc(x.status)}">${esc(x.status[0].toUpperCase()+x.status.slice(1))}</b></div><h2 dir="auto">${esc(x.title)}</h2><p class="my-post-body" dir="auto">${esc(x.body)}</p>${x.status==='rejected'?`<p class="my-post-reason">${x.rejection_reason?'Rejection reason: '+esc(x.rejection_reason):'No reason was recorded for this older rejection.'}</p>`:''}<small>${esc(new Date(x.created_at).toLocaleDateString())}</small><div class="hm-actions">${['pending','approved','rejected'].includes(x.status)?`<button class="btn secondary" onclick="${x.section_key==='explore'?`nav('explore-edit',{exploreId:'${x.id}'})`:`herdayEditPost('${x.id}')`}">${x.status==='rejected'?'Edit & Resubmit':'Edit Post'}</button>`:''}${x.status==='rejected'?`<button class="btn secondary" onclick="herdayDeleteRejected('${x.id}')">Delete Post</button>`:isAdmin()?`<button class="btn secondary" onclick="herdayDeletePost('${x.id}')">Delete Post</button>`:''}${x.status==='approved'&&x.r2_object_keys.length&&['admin','moderator'].includes(currentUser()?.role)?`<button class="btn secondary" onclick="herdayRetryPublication('${x.id}')">Retry Image Publishing</button>`:''}</div></article>`).join('')||'<p>You have not submitted any posts yet.</p>')+(herdayFix.mineMore?`<button class="btn secondary" onclick="loadMyPosts(true)" ${herdayFix.mineLoading?'disabled':''}>Load more posts</button>`:'');
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
