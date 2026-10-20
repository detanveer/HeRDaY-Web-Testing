/* Reusable section feed data and card rendering; activated only with complete route contracts. */
const herdaySectionFeed = (() => {
  const feeds = new Map();
  let generation = 0, sessionOwner = null;
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  function reset() {
    const owner = currentUser()?.id || null;
    if (owner !== sessionOwner) { sessionOwner=owner;generation++;feeds.clear();herdaySectionSocial.reset(); }
  }
  function state(section,detail) {
    if (!['girls_space','explore'].includes(section) || !/^[a-z0-9_]{1,80}$/.test(detail || '')) throw new Error('Invalid section.');
    const key=section+':'+detail;
    if (!feeds.has(key)) feeds.set(key,{rows:[],cursor:null,more:true,loading:false,error:'',loaded:false,pending:[],serverMore:true});
    return feeds.get(key);
  }
  function valid(row,section) {
    return uuid.test(row?.id || '') && uuid.test(row?.author_id || '') && row.section_key===section &&
      row.status==='approved' && typeof row.title==='string' && typeof row.body==='string' &&
      Number.isFinite(Date.parse(row.created_at)) && Array.isArray(row.r2_object_keys) && row.r2_object_keys.length<=5;
  }
  async function hydrate(rows) {
    if (!rows.length) return [];
    const [authors,actions,kinds]=await Promise.all([
      herdaySectionSocial.authors([...new Set(rows.map(row=>row.author_id))]),
      herdaySectionSocial.actions(rows.map(row=>row.id)),
      rows[0].section_key==='girls_space'
        ? herdayRpc('herday_get_girls_space_post_kinds',{p_submission_ids:rows.map(row=>row.id)})
        : Promise.resolve([])
    ]);
    const people=new Map(authors.map(person=>[person.id,[person.first_name,person.last_name].filter(Boolean).join(' ').trim()]));
    const photos=new Map(authors.map(person=>[person.id,person.photo||'']));
    const stats=new Map(actions.map(row=>[row.id,row]));
    if (!Array.isArray(kinds) || kinds.some(row=>!rows.some(post=>post.id===row.id) || !['post','question',null].includes(row.post_kind))) throw new Error('Post type could not be confirmed.');
    const types=new Map(kinds.map(row=>[row.id,row.post_kind]));
    if (rows[0].section_key==='girls_space' && rows.some(row=>!['post','question'].includes(types.get(row.id)))) throw new Error('A post needs its Question or Normal Post type confirmed before it can be displayed.');
    return rows.filter(row=>stats.has(row.id)).map(row=>({...row,
      author:people.get(row.author_id) || 'HerDay User',avatar:photos.get(row.author_id)||'',
      post_kind:types.get(row.id) || null,
      actions:stats.get(row.id),images:row.r2_object_keys.map(key=>herdayPublicMedia(key,row))
    }));
  }
  async function load(section,detail,{refresh=false}={}) {
    reset();const feed=state(section,detail);
    if (feed.loading || (!refresh && !feed.more)) return feed;
    const ticket=generation;
    if (refresh) {feed.rows=[];feed.cursor=null;feed.more=true;}
    feed.loading=true;feed.error='';
    try {
      const additions=[];feed.inFlight=additions;
      if(refresh){feed.pending=[];feed.serverMore=true;}
      // Keep a cursor for the scanned server page and a buffer for its unused matches.
      while(additions.length<3){
        while(feed.pending.length&&additions.length<3)additions.push(feed.pending.shift());
        if(additions.length===3||!feed.serverMore)break;
        const rows=await herdayRpc('herday_get_content_v2',{
          p_view:'published',p_section_key:section,p_limit:30,
          p_before_created_at:feed.cursor?.created_at||null,p_before_id:feed.cursor?.id||null
        });
        if(Array.isArray(rows)&&rows.length&&feed.cursor?.id===rows.at(-1).id)throw new Error('Feed cursor did not advance. Please retry.');
        if(!Array.isArray(rows)||rows.length>30||rows.some(row=>!valid(row,section)))throw new Error('Published feed could not be confirmed.');
        const hydrated=await hydrate(rows.filter(row=>row.detail_key===detail));
        reset();if(ticket!==generation)return state(section,detail);
        const existing=new Set([...feed.rows,...additions,...feed.pending].map(row=>row.id));
        feed.pending.push(...hydrated.filter(row=>!existing.has(row.id)));
        feed.cursor=rows.at(-1)||feed.cursor;feed.serverMore=rows.length===30;
      }
      while(feed.pending.length&&additions.length<3)additions.push(feed.pending.shift());
      feed.rows.push(...additions);feed.more=feed.pending.length>0||feed.serverMore;feed.loaded=true;

    } catch(error) {if(ticket===generation){feed.pending.unshift(...(feed.inFlight||[]));feed.error=error.message || 'Could not load posts.';feed.loaded=true;}}
    finally {feed.inFlight=[];feed.loading=false;}
    return feed;
  }
  function initials(name) {return name.split(/\s+/).filter(Boolean).slice(0,2).map(part=>[...part][0]).join('').toUpperCase();}
  function icon(kind) {
    const paths={like:'M12 21S3 15 3 8a5 5 0 0 1 9-3 5 5 0 0 1 9 3c0 7-9 13-9 13Z',comment:'M21 11a9 9 0 0 1-9 9H4l-2 2V11a9 9 0 0 1 19 0Z',save:'M5 3h14v19l-7-5-7 5Z',share:'M14 3l8 7-8 7v-5c-6 0-9 3-12 8 0-9 4-13 12-13Z'};
    return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[kind]}"/></svg>`;
  }
  function avatar(row) {
    return `<button type="button" class="section-avatar" data-public-user="${esc(row.author_id)}" aria-label="View ${esc(row.author)} profile">${row.avatar?`<img src="${esc(row.avatar)}" alt="" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><span hidden>${esc(initials(row.author))}</span>`:esc(initials(row.author))}</button>`;
  }
  function card(row,{expanded=false,commentLabel=row.post_kind==='question'?'Answer':'Comment'}={}) {
    const a=row.actions,body=expanded?row.body:herdayPostPreview(row.body);
    return `<article class="section-post section-card" data-post-id="${esc(row.id)}">
      <header class="section-author">${avatar(row)}
      <div><strong>${herdayAccountFeatures.userLink(row.author_id,row.author)}</strong><small class="post-meta-line"><time>${esc(herdayTime(row.created_at))}</time><span class="post-category">${esc(row.category_name||herdayTopicName(row.detail_key)||'Girls’ Space')}</span></small></div>
      <button type="button" data-social-action="menu" aria-label="Post options">···</button></header>
      ${row.title?.trim()?`<h3 ${herdayContentLanguage.attrs(row)}>${expanded?esc(row.title):herdayReadingButton(esc(row.title),'data-social-action="open"')}</h3>`:''}
      <button type="button" class="section-post-reading" ${herdayContentLanguage.attrs(row)} data-social-action="open"><span>${esc(body)}</span></button>
      ${(expanded?row.images:row.images.slice(0,1)).map(src=>`<img class="section-detail-image" src="${esc(src)}" alt="Attached post image" loading="lazy">`).join('')}
      ${herdayContentLanguage.markup(row)}
      <footer class="section-post-actions">
      <button type="button" data-social-action="like" aria-pressed="${a.liked}">${icon('like')}<span><span class="action-word">Like</span> ${esc(a.likes)}</span></button>
      <button type="button" data-social-action="open">${icon('comment')}<span><span class="action-word">${esc(commentLabel)}</span> ${esc(a.comment_count)}</span></button>
      <button type="button" data-social-action="share">${icon('share')}<span>Share</span></button>
      <button type="button" data-social-action="save" aria-pressed="${a.saved}">${icon('save')}<span>Save</span></button></footer></article>`;
  }
  return {reset,state,load,hydrate,card,icon,initials,avatar};
})();
