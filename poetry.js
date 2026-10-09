/* Poetry UI uses the existing nav()/render() and the existing fixed Home nav.
 * No database schema, upload bucket, API or fake persistence is introduced. */
const POETRY_ROUTES = new Set(['poetry','poetry-post','poetry-submit','poetry-categories','poetry-category']);
const poetryUI = {mainSearch:'',categorySearch:'',sort:'Latest',form:null};
function isPoetryRoute(route){return POETRY_ROUTES.has(route)}
function poetryIcon(name){
  const paths={
    back:'<path d="M20 12H4m7-8-8 8 8 8"/>',
    chevron:'<path d="m9 5 7 7-7 7"/>',down:'<path d="m5 9 7 7 7-7"/>',
    search:'<circle cx="10" cy="10" r="7"/><path d="m15 15 6 6"/>',
    heart:'<path d="M12 21C8 17 2 13 2 7a5 5 0 0 1 10-1 5 5 0 0 1 10 1c0 6-6 10-10 14Z"/>',
    comment:'<path d="M21 11a9 9 0 0 1-9 9c-2 0-3-.4-4-1L3 21l1-6a9 9 0 1 1 17-4Z"/>',
    share:'<path d="m14 3 8 8-8 7v-5C8 13 4 16 2 21c0-8 4-14 12-14Z"/>',
    plane:'<path d="m2 10 20-8-7 20-5-9-8-3Z"/><path d="m10 13 12-11"/>',
    save:'<path d="M5 3h14v19l-7-5-7 5Z"/>',
    write:'<path d="M13 4H3v18h18V12M9 16l1-5L20 1l3 3-10 10Z"/>',
    image:'<rect x="2" y="2" width="20" height="20" rx="2"/><circle cx="8" cy="8" r="2"/><path d="m3 19 6-6 4 3 5-7 4 5"/>',
    shield:'<path d="m12 2 9 4v7c0 5-9 9-9 9s-9-4-9-9V6Z"/><path d="m7 12 3 3 7-7"/>',
    sprout:'<path d="M12 22V10m0 7C4 18 2 14 2 8c6 0 10 2 10 9Zm0-5C11 4 16 2 22 2c0 6-4 10-10 10Z"/>',
    menu:'<circle cx="12" cy="4" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="20" r="1.5"/>'
  };
  return `<svg class="poetry-icon icon-${name}" viewBox="0 0 24 24" aria-hidden="true" fill="${['heart','menu'].includes(name)?'currentColor':'none'}" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">${paths[name]||''}</svg>`;
}
function poetryRecord(key){return POETRY_REFERENCE.posts.find(p=>p.key===key)}
function poetryHeader(back,title,subtitle=''){
  return `<header class="poetry-header"><button class="poetry-back" data-poetry-action="back" data-route="${back}" aria-label="Back">${poetryIcon('back')}</button></header><div class="poetry-intro"><h1>${esc(title)}</h1>${subtitle?`<p>${esc(subtitle)}</p>`:''}</div>`;
}
function poetryBadge(category,plain=false){return `<span class="poetry-badge">${plain?'':poetryIcon('sprout')}${esc(category)}</span>`}
function poetryMetadata(post,plain=false){
  return `<div class="poetry-meta"><img class="poetry-avatar" src="${esc(post.avatar)}" alt="${esc(post.author)}"><div class="poetry-author-copy"><b>${esc(post.author)}</b><div class="poetry-meta-line"><time>${esc(post.time)}</time>${plain?'<span aria-hidden="true">•</span>':''}${poetryBadge(post.category,plain)}</div></div><button class="poetry-menu" data-poetry-action="menu" data-key="${esc(post.key)}" aria-label="Post options">${poetryIcon('menu')}</button></div>`;
}
function poetryActions(post,plain=false){
  return `<div class="poetry-actions"><button class="poetry-like" data-poetry-action="like" data-key="${esc(post.key)}" aria-label="Like post">${poetryIcon('heart')}<span>${post.likes}</span></button><button data-poetry-action="comments" data-key="${esc(post.key)}" aria-label="Read comments">${poetryIcon('comment')}<span>${post.commentCount}</span></button><button data-poetry-action="share" data-key="${esc(post.key)}">${poetryIcon(plain?'plane':'share')}<span>Share</span></button><button data-poetry-action="save" data-key="${esc(post.key)}">${poetryIcon('save')}<span>Save</span></button></div>`;
}
function poetryParagraphs(text,className=''){
  return text.split(/\n\s*\n/).map(stanza=>`<p class="${className}">${esc(stanza).replace(/\n/g,'<br>')}</p>`).join('');
}
function poetryCard(post,{popular=false,category=false}={}){
  return `<article class="poetry-card ${popular?'poetry-popular-card':''} ${post.image?'has-image':'text-only'}" data-poetry-card="${esc(post.key)}" tabindex="0" role="button" aria-label="Read ${esc(post.title)}">${poetryMetadata(post,category)}<div class="poetry-preview-flow">${post.image?`<img class="poetry-thumbnail" src="${esc(post.thumbnail||post.image)}" alt="${esc(post.imageAlt||'Post image')}">`:''}<h3>${esc(post.title)}</h3><div class="poetry-preview">${poetryParagraphs(post.preview)}</div></div>${poetryActions(post,category)}</article>`;
}
function poetryMatches(post,query){return !query||`${post.title} ${post.author} ${post.preview} ${post.category}`.toLocaleLowerCase().includes(query.toLocaleLowerCase())}
function poetryMainList(){return POETRY_REFERENCE.mainKeys.map(poetryRecord).filter(p=>poetryMatches(p,poetryUI.mainSearch)).map(p=>poetryCard(p)).join('')||'<p class="poetry-empty">No matching poetry.</p>'}
function poetryMain(){
  return `<section class="poetry-page poetry-main" data-poetry-page="1">${poetryHeader('home','Poetry','Words from the heart')}<img class="poetry-hero poetry-main-hero" src="assets/poetry/07-Production-Asset-Page1-Hero.webp" alt="A poetry notebook, books, flowers, warm tea and candlelight"><button class="poetry-submit-shortcut" data-poetry-action="submit-page">${poetryIcon('write')}<span>Submit Poetry</span></button><div class="poetry-shortcuts" aria-label="Poetry shortcuts"><button class="active" data-poetry-action="for-you">For You</button>${['Love','Friendship','Hope'].map(c=>`<button data-poetry-action="category" data-category="${c}">${c}</button>`).join('')}<button data-poetry-action="categories">View All</button></div><div class="poetry-latest-row"><h2>Latest Posts</h2><label class="poetry-search">${poetryIcon('search')}<input type="search" aria-label="Search poems and poets" placeholder="Search poems, poets..." value="${esc(poetryUI.mainSearch)}" data-poetry-search="main"></label></div><div class="poetry-feed" id="poetryMainFeed">${poetryMainList()}</div><h2 class="poetry-popular-heading">Popular Posts</h2><div class="poetry-popular-grid">${POETRY_REFERENCE.popularKeys.map(poetryRecord).map(p=>poetryCard(p,{popular:true})).join('')}</div></section>`;
}
function poetryCategories(){
  setTimeout(poetryLoadPublicCategories, 0);
  return `<section class="poetry-page poetry-categories" data-poetry-page="5">${poetryHeader('poetry','Poetry Categories','Find the words that speak to you.')}<img class="poetry-hero poetry-categories-hero" src="assets/poetry/08-Production-Asset-Page5-Hero.webp" alt="South Asian poetry journal, literary books, jali window, roses and chai"><h2>All Categories</h2><div class="poetry-category-grid" id="poetryCanonicalCategories"><p role="status">Loading categories…</p></div></section>`;
}
function poetryCategoryRecords(){
  const selected=S.poetryCategory||'Love';
  // Reference records only; selecting a category never fabricates matching posts.
  return POETRY_REFERENCE.categoryKeys.map(poetryRecord).filter(p=>p.category===selected&&poetryMatches(p,poetryUI.categorySearch)).sort((a,b)=>b.order-a.order);
}
function poetryCategoryList(){return poetryCategoryRecords().map(p=>poetryCard(p,{category:true})).join('')||'<p class="poetry-empty">No posts available in this category.</p>'}
function poetryCategory(){
  const category=S.poetryCategory||'Love',subtitle=POETRY_REFERENCE.categorySubtitles[category]||'Words from the heart';
  return `<section class="poetry-page poetry-category-feed" data-poetry-page="6">${poetryHeader('poetry-categories',`${category} Poetry`,subtitle)}<div class="poetry-feed-controls"><label class="poetry-search">${poetryIcon('search')}<input type="search" aria-label="Search Poetry" placeholder="Search Poetry" value="${esc(poetryUI.categorySearch)}" data-poetry-search="category"></label><div class="poetry-sort"><select aria-label="Sort poetry" data-poetry-sort><option>Latest</option></select>${poetryIcon('down')}</div></div><h2 class="poetry-posts-heading">Posts</h2><div class="poetry-feed" id="poetryCategoryFeed">${poetryCategoryList()}</div></section>`;
}
function poetryDetailRecord(){
  const source=poetryRecord(S.poetryPostKey)||poetryRecord('main-ayesha');
  return {...source,...source.detail,poem:source.detail?.poem||source.preview,comments:source.detail?.comments||[]};
}
function poetryComment(comment){
  return `<div class="poetry-comment"><img class="poetry-avatar" src="${esc(comment.avatar)}" alt="${esc(comment.author)}"><div class="poetry-comment-copy"><b>${esc(comment.author)}</b><time>${esc(comment.time)}</time><p>${esc(comment.body)}</p></div><button class="poetry-menu" data-poetry-action="comment-menu" aria-label="Comment options">${poetryIcon('menu')}</button></div>`;
}
function poetryComposer(post){
  const user=currentUser();
  return `<form class="poetry-composer" data-poetry-composer><span class="poetry-composer-avatar">${user?.photo?`<img class="poetry-avatar" src="${esc(user.photo)}" alt="Your profile">`:`<span class="poetry-avatar poetry-user-initial" aria-label="Your profile">${esc((user?.firstName||'H').slice(0,1))}</span>`}</span><div class="poetry-composer-input"><input name="comment" aria-label="Add a comment" placeholder="Add a comment..." required><button type="submit" aria-label="Send comment">${poetryIcon('plane')}</button></div></form>`;
}
function poetryDetail(){
  const post=poetryDetailRecord();
  return `<section class="poetry-page poetry-detail ${post.image?'image-detail':'text-detail'}" data-poetry-page="${post.image?3:2}">${poetryHeader(S.poetryReturn||'poetry','Poetry')}<article class="poetry-card poetry-full-post ${post.image?'has-image':'text-only'}">${poetryMetadata(post)}<h3>${esc(post.title)}</h3>${post.image?`<img class="poetry-detail-image" src="${esc(post.image)}" alt="${esc(post.imageAlt||'Post image')}">`:''}<div class="poetry-full-body">${poetryParagraphs(post.poem)}</div>${poetryActions(post)}</article><section class="poetry-comments" id="poetryComments"><h2>Comments</h2>${post.comments.map(poetryComment).join('')}${poetryComposer(post)}</section></section>`;
}
function poetrySubmit(){
  setTimeout(poetryLoadSubmitCategories, 0);
  return `<section class="poetry-page poetry-submit" data-poetry-page="4">${poetryHeader(S.poetrySubmitReturn||'poetry','Submit Poetry','Share your words with the HerDay community.')}<form class="poetry-form" data-poetry-submit><label for="poetryTitle">Poetry Title</label><input id="poetryTitle" name="title" maxlength="180" placeholder="Give your poetry a title..." required><label for="poetryCategory">Category</label><div class="poetry-category-select"><select id="poetryCategory" name="category" required><option value="">Select a category</option><option disabled>Loading categories…</option></select>${poetryIcon('down')}</div><label for="poetryBody">Your Poetry</label><textarea id="poetryBody" name="poetry" maxlength="20000" placeholder="Write your poetry here..." required></textarea><div class="poetry-image-label"><b>Add Image</b> <span>(Optional)</span></div><label class="poetry-add-image" for="poetryImage">${poetryIcon('image')}<span>Add Image</span></label><input id="poetryImage" name="image" type="file" accept="image/jpeg,image/png,image/webp" multiple class="poetry-file-input"><p class="poetry-image-helper">Add up to five images to accompany your poetry.</p><p class="poetry-selected-file" hidden></p><div class="poetry-guidance">${poetryIcon('shield')}<span>Please share original and respectful content.</span></div><p id="poetrySubmitStatus" role="status" aria-live="polite"></p><button id="poetryCategoryRetry" type="button" hidden>Retry categories</button><button class="poetry-final-submit" type="submit" disabled>Submit Poetry</button></form></section>`;
}
function renderPoetry(){
  switch(S.route){
    case 'poetry-post':return poetryDetail();
    case 'poetry-submit':return poetrySubmit();
    case 'poetry-categories':return poetryCategories();
    case 'poetry-category':return poetryCategory();
    default:return poetryMain();
  }
}
function poetryOpenPost(key,comments=false){
  const returnRoute=S.route==='poetry-post'?(S.poetryReturn||'poetry'):S.route;
  return nav('poetry-post',{poetryPostKey:key,poetryReturn:returnRoute}).then(()=>{if(comments)document.getElementById('poetryComments')?.scrollIntoView({block:'start'})});
}
function poetryBackendUnavailable(action){
  const message=action==='submit'?'Poetry publishing is not connected yet. Your poem has not been submitted.':action==='comment'?'Comments are not connected yet. Your comment has not been posted.':'This action is not connected yet. No changes have been saved.';
  alert(message);
}
async function poetryShare(key){
  const post=poetryRecord(key);if(!post)return;
  const text=`${post.title}\n\n${post.detail?.poem||post.preview}\n\n— ${post.author} · HerDay`;
  if(navigator.share){try{await navigator.share({title:post.title,text});return}catch(e){if(e.name==='AbortError')return}}
  try{await navigator.clipboard.writeText(text);alert('Poetry copied for sharing.')}catch(e){alert(text)}
}
document.addEventListener('click',event=>{
  const action=event.target.closest('[data-poetry-action]');
  if(action){
    const {poetryAction:kind,key,category,route}=action.dataset;
    if(kind==='back')nav(route);
    else if(kind==='submit-page')nav('poetry-submit',{poetrySubmitReturn:S.route});
    else if(kind==='categories')nav('poetry-categories');
    else if(kind==='category'){poetryUI.categorySearch='';nav('poetry-category',{poetryCategory:category})}
    else if(kind==='for-you'){poetryUI.mainSearch='';nav('poetry')}
    else if(kind==='comments')poetryOpenPost(key,true);
    else if(kind==='share')poetryShare(key);
    else if(kind==='like'||kind==='save')poetryBackendUnavailable(kind);
    else if(kind==='menu'){
      const existing=document.querySelector('.poetry-options');if(existing){existing.remove();return}
      const menu=document.createElement('div');menu.className='poetry-options';menu.innerHTML=`<button data-poetry-action="share" data-key="${esc(key)}">Share</button><button data-poetry-action="save" data-key="${esc(key)}">Save</button>`;action.after(menu);
    }else if(kind==='comment-menu')poetryBackendUnavailable(kind);
    return;
  }
  document.querySelector('.poetry-options')?.remove();
  const card=event.target.closest('[data-poetry-card]');
  if(card)poetryOpenPost(card.dataset.poetryCard);
});
document.addEventListener('keydown',event=>{
  const card=event.target.closest('[data-poetry-card]');
  if(card&&event.target===card&&['Enter',' '].includes(event.key)){event.preventDefault();poetryOpenPost(card.dataset.poetryCard)}
});
document.addEventListener('input',event=>{
  const kind=event.target.dataset.poetrySearch;
  if(kind==='main'){poetryUI.mainSearch=event.target.value;document.getElementById('poetryMainFeed').innerHTML=poetryMainList()}
  if(kind==='category'){poetryUI.categorySearch=event.target.value;document.getElementById('poetryCategoryFeed').innerHTML=poetryCategoryList()}
});
document.addEventListener('change',event=>{
  if(event.target.id==='poetryImage'){
    const label=document.querySelector('.poetry-selected-file'),files=[...event.target.files];label.hidden=!files.length;label.textContent=files.length>5?'Select no more than five images.':files.map(f=>f.name).join(', ');
  }
});
document.addEventListener('submit',event=>{
  if(event.target.matches('[data-poetry-submit]')){event.preventDefault();poetrySendSubmission(event.target)}
  if(event.target.matches('[data-poetry-composer]')){event.preventDefault();poetryBackendUnavailable('comment')}
});
// Use the actual shared Home nav geometry instead of a Poetry-specific footer.
function poetryReserveNavigation(){
  const navElement=document.querySelector('body > .nav');if(!navElement)return;
  const style=getComputedStyle(navElement),space=navElement.getBoundingClientRect().height+(parseFloat(style.bottom)||0)+10;
  document.documentElement.style.setProperty('--poetry-nav-reserve',`${space}px`);
}
window.addEventListener('resize',poetryReserveNavigation);
if(window.ResizeObserver){const sharedNav=document.querySelector('body > .nav');if(sharedNav)new ResizeObserver(poetryReserveNavigation).observe(sharedNav)}
poetryReserveNavigation();


// Existing content-moderation RPC contract; no direct table writes or security changes.
// Contract evidence: HerDay_Content_Moderation_Combined_Migration.sql.txt.
let poetrySubmitting = false;
function poetrySubmissionMessage(form, message, error = false) {
  const el = form.querySelector('#poetrySubmitStatus');
  if (el) { el.textContent = message; el.setAttribute('role', error ? 'alert' : 'status'); }
}
async function poetryLoadSubmitCategories() {
  const form = document.querySelector('[data-poetry-submit]');
  if (!form) return;
  const select = form.querySelector('#poetryCategory');
  const button = form.querySelector('[type="submit"]');
  const retry = form.querySelector('#poetryCategoryRetry');
  select.disabled = true; button.disabled = true; retry.hidden = true;
  poetrySubmissionMessage(form, 'Loading categories…');
  try {
    const data = await poetryFetchActiveCategories();
    if (!form.isConnected) return;
    select.innerHTML = '<option value="">Select a category</option>' + data.map(c => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('');
    select.disabled = !data.length;
    button.disabled = !data.length || poetrySubmitting;
    poetrySubmissionMessage(form, data.length ? '' : 'No active poetry categories are available. An Admin must add or restore a category before submission.');
  } catch (error) {
    if (!form.isConnected) return;
    select.innerHTML = '<option value="">Categories unavailable</option>';
    retry.hidden = false;
    poetrySubmissionMessage(form, 'Could not load categories: ' + (error.message || 'Connection failed.') + ' Nothing has been submitted.', true);
  }
  retry.onclick = poetryLoadSubmitCategories;
}
async function poetrySendSubmission(form) {
  if (poetrySubmitting) return;
  if (!currentUser()) return nav('login');
  const title = form.elements.title.value.trim();
  const body = form.elements.poetry.value.trim();
  const categoryId = form.elements.category.value;
  if (!title || title.length > 180 || !body || body.length > 20000 || !categoryId || form.elements.category.disabled) {
    poetrySubmissionMessage(form, 'Enter a title, poetry and an available category before submitting.', true); return;
  }
  if (form.elements.image.files.length > 5) {
    poetrySubmissionMessage(form, 'Select no more than five images. Nothing has been submitted.', true); return;
  }
  if (form.elements.image.files.length) {
    poetrySubmissionMessage(form, 'Image upload is unavailable until the current Worker upload and submission ownership contract is verified. Nothing has been uploaded or submitted; your form is retained.', true); return;
  }
  const button = form.querySelector('[type="submit"]');
  poetrySubmitting = true; button.disabled = true;
  poetrySubmissionMessage(form, 'Submitting poetry for review…');
  try {
    const {data, error} = await supabaseClient.rpc('herday_submit_content', {
      p_section_key: 'poetry', p_title: title, p_body: body,
      p_r2_object_keys: [], p_detail_key: null, p_poetry_category_id: categoryId
    });
    if (error) throw error;
    if (typeof data !== 'string' || !data) {
      poetrySubmissionMessage(form, 'The server returned no submission ID. The result is uncertain; verify before retrying to avoid a duplicate.', true); return;
    }
    const back = ['poetry','poetry-post','poetry-categories','poetry-category'].includes(S.poetrySubmitReturn) ? S.poetrySubmitReturn : 'poetry';
    await nav(back);
    poetrySuccessNotice('Poetry submitted successfully! Awaiting moderation.');
  } catch (error) {
    poetrySubmissionMessage(form, 'Submission could not be confirmed: ' + (error.message || 'Connection failed.') + ' Your form is retained. If the connection dropped, verify before retrying.', true);
  } finally {
    poetrySubmitting = false;
    if (button.isConnected) button.disabled = form.elements.category.disabled;
  }
}


// One canonical active-category contract for public categories, submission and moderation.
async function poetryFetchActiveCategories() {
  const {data,error}=await supabaseClient.rpc('herday_get_poetry_categories');
  if(error) throw error;
  if(!Array.isArray(data) || data.some(c=>!c || typeof c.id!=='string' || typeof c.name!=='string')) throw new Error('Invalid categories response.');
  return data;
}
async function poetryLoadPublicCategories() {
  const grid=document.getElementById('poetryCanonicalCategories');
  if(!grid)return;
  grid.innerHTML='<p role="status">Loading categories…</p>';
  try {
    const cats=await poetryFetchActiveCategories();
    if(!grid.isConnected)return;
    grid.innerHTML=cats.length?cats.map(c=>`<button class="poetry-category-card" data-poetry-action="category" data-category="${esc(c.name)}" data-category-id="${esc(c.id)}"><span>${esc(c.name)}</span>${poetryIcon('chevron')}</button>`).join(''):'<p role="status">No active poetry categories are available.</p>';
  } catch(error) {
    if(!grid.isConnected)return;
    grid.innerHTML=`<div role="alert">Could not load categories: ${esc(error.message||'Connection failed.')}<br><button type="button" onclick="poetryLoadPublicCategories()">Try again</button></div>`;
  }
}
function poetrySuccessNotice(message) {
  document.getElementById('poetrySuccessNotice')?.remove();
  const el=document.createElement('div');el.id='poetrySuccessNotice';el.className='poetry-success-notice';el.setAttribute('role','status');el.textContent=message;document.body.append(el);
  setTimeout(()=>el.remove(),6000);
}
