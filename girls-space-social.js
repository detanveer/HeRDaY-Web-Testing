/* One feed/create/detail family, with section context and Question/Comment semantics. */
const herdayGirlsSocial = (() => {
  const contexts={
    discussions:{title:'Girls’ Discussions',heading:'Discussions',subtitle:'Share your thoughts, connect and talk.'},
    personal_stories:{title:'Personal Stories',heading:'Personal Stories',subtitle:'Every story deserves to be heard.'},
    advice_support:{title:'Advice & Support',heading:'Advice & Support',subtitle:'Ask, share and support each other.',advice:true},
    celebrate_inspire:{title:'Celebrate & Inspire',heading:'Celebrate & Inspire',subtitle:'Celebrate moments that matter.'}
  };
  const details=new Map(),threads=new Map();
  let owner=null,epoch=0;
  function reset(){
    const next=currentUser()?.id || null;
    if(next!==owner){owner=next;epoch++;details.clear();threads.clear();herdayGirlsComposer.reset();herdaySectionFeed.reset();herdaySectionAttachments.reset();}
  }
  function context(){return contexts[S.gsTopic] || contexts.discussions;}
  function topic(){return contexts[S.gsTopic]?S.gsTopic:'discussions';}
  function header(title,subtitle=''){
    return herdayPageHeader({className:'gs-header',title,subtitle:subtitle,button:`<button type="button" data-gs-action="back" aria-label="Back"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 12H4m7-8-8 8 8 8"/></svg></button>`});
  }
  function message(text,error=false){return `<p class="gs-message" role="${error?'alert':'status'}">${esc(text)}</p>`;}
  function refresh(){if(['gs-feed','gs-post','gs-create','explore-post','community-question'].includes(S.route))render();}
  function activePostId(){if(S.route==='community-question')return S.communityId;return S.route==='explore-post'?S.exploreId:S.gsPostId;}
  async function loadFeed(more=false){
    const key=topic(),ticket=epoch;
    await herdaySectionFeed.load('girls_space',key,{refresh:!more});
    if(ticket===epoch&&S.route==='gs-feed'&&topic()===key)refresh();
  }
  function row(id){if(S.route==='community-question')return window.herdayCommunity?.row(id);if(S.route==='explore-post'&&window.herdayExplore)return herdayExplore.row(id);return details.get(id)?.row || herdaySectionFeed.state('girls_space',topic()).rows.find(post=>post.id===id);}
  async function loadPost(id){
    if(!HERDAY_UUID.test(id || ''))return;
    const state=details.get(id) || {row:null,loading:false,error:'',loaded:false};
    details.set(id,state);if(state.loading)return;state.loading=true;state.error='';const ticket=epoch;
    try{
      const rows=await herdayRpc('herday_get_content_v2',{p_view:'published',p_section_key:'girls_space',p_submission_id:id,p_limit:1});
      if(!Array.isArray(rows)||rows.length!==1||rows[0].id!==id||rows[0].section_key!=='girls_space'||rows[0].status!=='approved'||!contexts[rows[0].detail_key]||typeof rows[0].body!=='string'||!Array.isArray(rows[0].r2_object_keys))throw new Error('Published post unavailable.');
      const hydrated=await herdaySectionFeed.hydrate(rows);
      if(hydrated.length!==1)throw new Error('Published post unavailable.');
      if(ticket!==epoch)return;state.row=hydrated[0];state.loaded=true;if(S.route==='gs-post'&&S.gsPostId===id){S.gsTopic=rows[0].detail_key;save();}
    }catch(error){if(ticket===epoch){state.error=error.message || 'Could not load post.';state.loaded=true;}}
    finally{state.loading=false;if(ticket===epoch&&['gs-post','explore-post','community-question'].includes(S.route)&&activePostId()===id)refresh();}
  }
  function thread(id){if(!threads.has(id))threads.set(id,{rows:[],loaded:false,loading:false,more:false,error:'',draft:'',reply:null,sending:false,sendError:''});return threads.get(id);}
  async function loadThread(id,more=false){
    const state=thread(id);if(state.loading)return;state.loading=true;state.error='';const ticket=epoch;
    try{
      const rows=await herdaySectionSocial.readComments(id,more?state.rows.at(-1):null,S.route==='community-question'?window.herdayCommunity.answerSort():null);
      const authors=await herdaySectionSocial.authors([...new Set(rows.map(comment=>comment.author_id))]);
      const names=new Map(authors.map(author=>[author.id,[author.first_name,author.last_name].filter(Boolean).join(' ').trim()]));
      const photos=new Map(authors.map(author=>[author.id,author.photo||'']));
      if(ticket!==epoch)return;
      const merged=rows.map(comment=>({...comment,author:names.get(comment.author_id)||'HerDay User',avatar:photos.get(comment.author_id)||''}));
      state.rows=more?[...state.rows,...merged.filter(comment=>!state.rows.some(old=>old.id===comment.id))]:merged;
      state.more=rows.length===30 && state.rows.length<Number(rows[0]?.total_count || 0);state.loaded=true;
      if(S.route==='community-question'&&(!more||rows.length))window.herdayCommunity.updateAnswerCount(id,Number(rows[0]?.total_count)||0);
    }catch(error){if(ticket===epoch){state.error=error.message || 'Could not load comments.';state.loaded=true;}}
    finally{state.loading=false;if(ticket===epoch&&['gs-post','explore-post','community-question'].includes(S.route)&&activePostId()===id)refresh();}
  }
  function commentsMarkup(id){
    const state=thread(id),post=row(id),label=post?.post_kind==='question'?'Answers':'Comments';
    if(!state.loaded&&!state.loading)setTimeout(()=>loadThread(id),0);
    const children=new Map();for(const comment of state.rows){const parent=comment.parent_comment_id || '';if(!children.has(parent))children.set(parent,[]);children.get(parent).push(comment);}
    const seen=new Set();
    function branch(comment,depth=0){
      if(seen.has(comment.id))return '';seen.add(comment.id);
      return herdayCommentsUI.comment(comment,{nested:depth>0,
        menu:comment.author_id===currentUser()?.id||isAdmin()?'<button type="button" data-gs-comment-action="menu" aria-label="Comment options">···</button>':'',
        like:`<button type="button" data-gs-comment-action="like" aria-pressed="${!!comment.liked}">Like ${Number(comment.likes)||0}</button>`,
        reply:'<button type="button" data-gs-comment-action="reply">Reply</button>',
        children:(children.get(comment.id)||[]).map(child=>branch(child,depth+1)).join('')});
    }
    const roots=state.rows.filter(comment=>!comment.parent_comment_id || !state.rows.some(parent=>parent.id===comment.parent_comment_id));
    return `<section class="gs-thread">${S.route==='community-question'?`<div class="community-answer-heading"><h2>Community Answers (${Number(post?.actions?.comment_count)||0})</h2>${window.herdayCommunity.answerToolbar()}</div>`:`<h2>${label}</h2>`}
      ${state.error?message(state.error,true)+'<button class="section-secondary" data-gs-action="retry-comments">Try again</button>':''}
      <div class="gs-comments">${roots.map(comment=>branch(comment)).join('')}${state.loaded&&!state.rows.length&&!state.error?message(label==='Answers'?'No answers yet.':'No comments yet.'):''}${state.loading?message('Loading…'):''}</div>
      ${state.more?'<button class="section-secondary" data-gs-action="more-comments">Load More</button>':''}
      ${currentUser()?herdayCommentsUI.composer({attributes:`data-gs-comment-compose="${esc(id)}"`,state,reply:state.reply?.author||'',cancel:'<button type="button" data-gs-action="cancel-reply">Cancel</button>',answers:label==='Answers',id:'gsComment'}):'<button type="button" class="section-secondary" data-gs-action="login">Log in to join the conversation</button>'}</section>`;
  }
  function renderPage(){
    reset();const c=context(),key=topic();
    if(S.route==='gs-create')return header('Create Post')+`<div class="section-body">${herdayGirlsComposer.markup({topic:key,title:c.title,advice:!!c.advice})}</div>`;
    if(S.route==='gs-post'){
      const id=S.gsPostId;
      if(!HERDAY_UUID.test(id || ''))return header('Post')+message('Published post unavailable.',true);
      const state=details.get(id);
      if(!state)setTimeout(()=>loadPost(id),0);
      return header('Post')+`<div class="section-body">${state?.error?message(state.error,true)+'<button class="section-secondary" data-gs-action="retry-post">Try again</button>':state?.row?herdaySectionFeed.card(state.row,{expanded:true})+commentsMarkup(id):message('Loading post…')}</div>`;
    }
    const feed=herdaySectionFeed.state('girls_space',key);
    if(!feed.loaded&&!feed.loading)setTimeout(()=>loadFeed(),0);
    return header(c.title,c.subtitle)+`<div class="section-body"><div class="gs-feed-toolbar"><span class="gs-sort">Latest</span><button class="section-primary" data-gs-action="create">+ Create Post</button></div>
      ${feed.error?message(feed.error,true)+'<button class="section-secondary" data-gs-action="retry-feed">Try again</button>':''}
      ${feed.rows.map(post=>herdaySectionFeed.card(post)).join('')}
      ${feed.loading?message('Loading posts…'):feed.loaded&&!feed.rows.length&&!feed.more&&!feed.error?message('No published posts yet.'):''}
      ${feed.more&&feed.loaded?'<button class="section-secondary" data-gs-action="more-feed">Load More</button>':''}</div>`;
  }
  function reserveNavigation(){
    const nav=document.querySelector('body > .nav');if(!nav)return;
    const reserve=nav.getBoundingClientRect().height+(parseFloat(getComputedStyle(nav).bottom)||0)+12;
    document.documentElement.style.setProperty('--herday-section-nav-clearance',reserve+'px');
  }
  async function click(event){
    if(!['gs-feed','gs-post','gs-create','explore-post','community-question'].includes(S.route))return;
    const button=event.target.closest('button');if(!button)return;
    const action=button.dataset.gsAction,card=button.closest('[data-post-id]');
    if(button.disabled)return;
    try{
      if(action==='back'){const back=S.route==='gs-post'&&HERDAY_ROUTES.has(S.gsReturn)?S.gsReturn:S.route==='gs-feed'?'gs-main':'gs-feed';return nav(back,{gsTopic:topic()});}
      if(action==='login')return nav('login');
      if(action==='create')return nav('gs-create',{gsTopic:topic()});
      if(action==='retry-feed')return loadFeed();
      if(action==='more-feed')return loadFeed(true);
      if(action==='retry-post')return loadPost(S.gsPostId);
      if(action==='retry-comments')return loadThread(activePostId());
      if(action==='more-comments')return loadThread(activePostId(),true);
      if(action==='cancel-reply'){thread(activePostId()).reply=null;return refresh();}
      if(button.dataset.gsKind){herdayGirlsComposer.update(topic(),{kind:button.dataset.gsKind});refresh();renderPreviews();return;}
      if(button.hasAttribute('data-gs-remove-image')){herdaySectionAttachments.remove('gs:'+topic(),button.dataset.gsRemoveImage);return renderPreviews();}
      if(button.hasAttribute('data-gs-cancel'))return nav('gs-feed',{gsTopic:topic()});
      if(card){
        const id=card.dataset.postId,kind=button.dataset.socialAction,post=row(id);
        if(kind==='open')return nav('gs-post',{gsPostId:id,gsTopic:post?.detail_key || topic(),gsReturn:'gs-feed'});
        if(kind==='menu')return herdayPostOptions(post);
        if(kind==='share'){
          const url=new URL(location.origin+location.pathname);url.hash=new URLSearchParams({page:'gs-post',gsPostId:id,gsTopic:topic()}).toString();
          if(navigator.share){try{await navigator.share({title:post.title,url:url.href});return;}catch(error){if(error.name==='AbortError')return;}}
          await navigator.clipboard.writeText(url.href);alert('Post link copied.');return;
        }
        if(kind==='like'||kind==='save'){
          if(!currentUser())return nav('login');button.disabled=true;
          const result=await herdaySectionSocial.setAction(id,kind,!(kind==='like'?post.actions.liked:post.actions.saved));
          if(result.length!==1)throw new Error('Post is no longer available.');post.actions=result[0];if(kind==='save')herdaySavedReset();refresh();return;
        }
      }
      const commentElement=button.closest('[data-comment-id]');
      if(commentElement){
        if(!currentUser())return nav('login');const id=commentElement.dataset.commentId,state=thread(activePostId()),comment=state.rows.find(row=>row.id===id);
        if(button.dataset.gsCommentAction==='reply'){state.reply=comment;refresh();document.querySelector('#gsComment')?.focus();return;}
        if(button.dataset.gsCommentAction==='like'){button.disabled=true;await herdaySectionSocial.likeComment(id,!comment.liked);return loadThread(activePostId());}
        if(button.dataset.gsCommentAction==='menu'){const postId=activePostId(),ticket=epoch;return herdayCommentOptions(comment,{onEdit:()=>{if(ticket===epoch&&activePostId()===postId)refresh();},onDelete:async()=>{await herdaySectionSocial.deleteComment(id);if(ticket===epoch)await loadThread(postId);}});}
      }
    }catch(error){alert(error.message || 'Action could not be confirmed.');}
    finally{if(button.isConnected)button.disabled=false;}
  }
  function renderPreviews(){const box=document.querySelector('[data-gs-previews]');if(box)box.innerHTML=herdaySectionAttachments.previews('gs:'+topic());}
  async function submit(event){
    const form=event.target;
    if(form.matches('[data-gs-comment-compose]')){
      event.preventDefault();const id=form.dataset.gsCommentCompose,state=thread(id),button=form.querySelector('[type=submit]'),status=form.querySelector('[role=status]');
      if(state.sending)return;state.draft=form.elements.comment.value;state.sending=true;button.disabled=true;
      state.sendError='';
      try{await herdaySectionSocial.addComment(id,state.draft,state.reply?.id || null);state.draft='';state.reply=null;await loadThread(id);}catch(error){state.sendError=error.message || 'Comment could not be confirmed. Retry the same comment.';if(status.isConnected)status.textContent=state.sendError;}finally{state.sending=false;if(['gs-post','explore-post','community-question'].includes(S.route)&&activePostId()===id)refresh();}
    }
    if(form.matches('[data-gs-compose]')){
      event.preventDefault();const key=form.dataset.gsCompose,button=form.querySelector('[type=submit]'),status=form.querySelector('[role=status]');
      if(button.disabled)return;button.disabled=true;
      try{
        const d=herdayGirlsComposer.draft(key);
        if(!d.submittedId&&!d.uncertain)herdayGirlsComposer.update(key,{body:form.elements.body.value,title:form.elements.title?.value || '',language:form.elements.language.value});
        herdayGirlsComposer.validate(key);
        status.textContent='Submitting…';
        const keys=d.submittedId?[]:await herdaySectionAttachments.upload('gs:'+key,'girls_space');
        const result=await herdayGirlsComposer.submit(key,keys);
        if(result.status==='approved'&&result.r2_object_keys?.length){status.textContent='Confirming image publication…';await herdayPublishSubmission(result.id);}
        if(!form.isConnected)return;
        status.textContent=result.status==='pending'?'Submitted successfully. Pending approval.':result.status==='approved'?'Your post has been published.':'Your submission needs changes.';
        form.querySelectorAll('input,textarea,button').forEach(control=>control.disabled=true);
        herdaySectionAttachments.clear('gs:'+key);
        herdayGirlsComposer.clear(key);
      }catch(error){if(status.isConnected)status.textContent=error.message || 'Submission could not be confirmed.';button.disabled=false;}
    }
  }
  document.addEventListener('click',click);
  document.addEventListener('submit',submit);
  document.addEventListener('input',event=>{
    const form=event.target.closest('[data-gs-compose]');
    if(form&&['body','title','language'].includes(event.target.name)){try{herdayGirlsComposer.update(form.dataset.gsCompose,{[event.target.name]:event.target.value});}catch{}}
    if(event.target.matches('[data-gs-comment-compose] textarea'))thread(event.target.closest('form').dataset.gsCommentCompose).draft=event.target.value;
  });
  document.addEventListener('change',event=>{if(event.target.matches('[data-gs-images]')){try{herdaySectionAttachments.add('gs:'+topic(),event.target.files);renderPreviews();}catch(error){alert(error.message);}event.target.value='';}});
  window.addEventListener('resize',reserveNavigation);
  if(window.ResizeObserver){const nav=document.querySelector('body > .nav');if(nav)new ResizeObserver(reserveNavigation).observe(nav);}
  return {renderPage,reset,reserveNavigation,renderPreviews,contexts,commentsMarkup, reloadThread:loadThread};
})();
window.herdayGirlsSocial=herdayGirlsSocial;
