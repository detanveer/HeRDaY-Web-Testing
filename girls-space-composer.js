/* Shared approved composer shell; attachment transport is a separate verified contract. */
const herdayGirlsComposer = (() => {
  const drafts=new Map();
  let owner=null;
  function reset() {
    const next=currentUser()?.id || null;
    if(next!==owner){owner=next;drafts.clear();}
  }
  function draft(topic,defaultKind='post') {
    reset();if(!/^[a-z0-9_]{1,80}$/.test(topic || ''))throw new Error('Invalid topic.');
    if(!drafts.has(topic))drafts.set(topic,{body:'',title:'',language:'',kind:defaultKind,sending:false,submittedId:null,uncertain:false});
    return drafts.get(topic);
  }
  function markup({topic,title,advice=false}) {
    const d=draft(topic,advice?'question':'post'),user=currentUser(),name=user?.name || [user?.firstName,user?.lastName].filter(Boolean).join(' ') || 'HerDay User';
    const initials=name.split(/\s+/).filter(Boolean).slice(0,2).map(part=>[...part][0]).join('');
    return `<form class="section-card gs-composer" data-gs-compose="${esc(topic)}">
      <header class="section-author"><span class="section-avatar" aria-hidden="true">${esc(initials)}</span><div><strong>${esc(name)}</strong><small>${esc(title)}</small></div></header>
      ${herdayContentLanguage.selector(d.language)}
      ${advice?`<div class="gs-type-picker" role="group" aria-label="Post type"><button type="button" data-gs-kind="question" aria-pressed="${d.kind==='question'}">Ask for Advice</button><button type="button" data-gs-kind="post" aria-pressed="${d.kind==='post'}">Share Advice &amp; Support</button></div>
      <input ${herdayContentLanguage.attrs({content_language:d.language})} name="title" maxlength="180" value="${esc(d.title)}" aria-label="${d.kind==='question'?'Your question':'Post title'}" placeholder="${d.kind==='question'?'What would you like advice about?':'Give your post a title'}" ${d.kind==='question'?'required':''}>`:''}
      <textarea ${herdayContentLanguage.attrs({content_language:d.language})} name="body" required maxlength="40000" aria-label="Your content" placeholder="${advice&&d.kind==='question'?'Share a little more about your situation...':'What would you like to share?'}">${esc(d.body)}</textarea>
      <div class="gs-attachment-heading"><label for="gsPhotos">Add Photos</label><small>Up to 5 photos</small></div>
      <div class="gs-upload-grid"><div class="gs-attachments" data-gs-previews></div><label class="gs-upload-tile"><span aria-hidden="true">＋</span><strong>Add</strong><input type="file" id="gsPhotos" data-gs-images aria-label="Add Photos" accept="image/jpeg,image/png,image/webp" multiple></label></div>
      <p role="status" aria-live="polite"></p>
      <div class="gs-composer-actions"><button class="section-secondary" type="button" data-gs-cancel>Cancel</button><button class="section-primary" type="submit">Post</button></div>
      </form><p class="gs-kindness">Be kind and respectful to everyone.</p>`;
  }
  function update(topic,{body,title,kind,language}) {
    const d=draft(topic);if(d.sending || d.submittedId || d.uncertain)throw new Error('Check the existing submission before making another attempt.');
    if(language!==undefined){if(!herdayContentLanguage.validLanguage(language))throw new Error('Select content language.');d.language=language;}
    if(body!==undefined)d.body=String(body);
    if(title!==undefined)d.title=String(title);
    if(kind!==undefined){if(!['post','question'].includes(kind))throw new Error('Invalid post type.');d.kind=kind;}
    return d;
  }
  async function submit(topic,keys=[]) {
    const d=draft(topic),author=owner;
    if(!author)throw new Error('Please log in to post.');
    if(d.sending)throw new Error('Your post is still being submitted.');
    if(d.submittedId)return confirmSubmission(d.submittedId,author);
    if(d.uncertain)throw new Error('The previous submission result is uncertain. Check your posts before submitting again.');
    if(!herdayContentLanguage.validLanguage(d.language))throw new Error('Select content language.');
    if(!d.body.trim() || [...d.body.trim()].length>20000 || [...d.title.trim()].length>180 || (d.kind==='question'&&!d.title.trim()))throw new Error('Check your content and question/title.');
    if(!Array.isArray(keys) || keys.length>5 || keys.some(key=>typeof key!=='string'))throw new Error('Invalid attachments.');
    d.sending=true;
    try {
      d.uncertain=true;
      const id=await herdayRpc('herday_submit_girls_space_post_localized',{
        p_topic_key:topic,p_body:d.body,p_post_kind:d.kind,p_title:d.title.trim() || null,p_r2_object_keys:keys,p_content_language:d.language
      });
      if(!HERDAY_UUID.test(id || ''))throw new Error('Submission result could not be confirmed. Do not submit again until your posts have been checked.');
      reset();if(owner!==author)throw new Error('Your session changed. Reopen your posts to check submission status.');
      d.submittedId=id;
      d.uncertain=false;
      return await confirmSubmission(id,author);
    } catch(error) {
      if(!d.submittedId && ['22023','42501','23514','23503'].includes(error.code))d.uncertain=false;
      throw error;
    } finally {d.sending=false;}
  }
  function validate(topic){
    const d=draft(topic);
    if(d.submittedId)return;
    if(d.uncertain)throw new Error('The previous submission result is uncertain. Check your posts before submitting again.');
    if(!herdayContentLanguage.validLanguage(d.language))throw new Error('Select content language.');
    if(!d.body.trim() || [...d.body.trim()].length>20000 || [...d.title.trim()].length>180 || (d.kind==='question'&&!d.title.trim()))throw new Error('Check your content and question/title.');
  }
  async function confirmSubmission(id,author) {
    const rows=await herdayRpc('herday_get_content_v2',{p_view:'mine',p_section_key:'girls_space',p_submission_id:id,p_limit:1});
    reset();if(owner!==author)throw new Error('Your session changed.');
    if(!Array.isArray(rows) || rows.length!==1 || rows[0].id!==id || rows[0].author_id!==author || rows[0].section_key!=='girls_space' || !['pending','approved','rejected'].includes(rows[0].status))throw new Error('Submission status could not be confirmed.');
    return rows[0];
  }
  function clear(topic){drafts.delete(topic);}
  return {reset,draft,markup,update,submit,clear,validate};
})();
