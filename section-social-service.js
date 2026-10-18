/* Shared Girls' Space / Explore actions. Poetry retains its existing callers. */
const herdaySectionSocial = (() => {
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const comments = new Map();
  let owner = null;
  function id(value) { if (!uuid.test(value || '')) throw new Error('Invalid content reference.'); return value; }
  function reset() {
    const next = currentUser()?.id || null;
    if (next !== owner) { owner = next; comments.clear(); }
  }
  function activeOwner() {
    reset();
    if (!owner) throw new Error('Please log in to continue.');
    return owner;
  }
  async function actions(ids) {
    if (!Array.isArray(ids) || ids.length > 100) throw new Error('Invalid posts request.');
    const selected = [...new Set(ids.map(id))];
    if (!selected.length) return [];
    const rows = await herdayRpc('herday_get_social_actions', {p_submission_ids: selected});
    if (!Array.isArray(rows) || rows.some(row => !selected.includes(row.id) ||
      !Number.isSafeInteger(Number(row.likes)) || Number(row.likes) < 0 ||
      !Number.isSafeInteger(Number(row.comment_count)) || Number(row.comment_count) < 0 ||
      typeof row.liked !== 'boolean' || typeof row.saved !== 'boolean')) {
      throw new Error('Social actions could not be confirmed.');
    }
    return rows;
  }
  async function authors(ids) {
    if (!Array.isArray(ids) || ids.length > 100) throw new Error('Invalid author request.');
    const selected = [...new Set(ids.map(id))];
    if (!selected.length) return [];
    const rows = await herdayRpc('herday_get_author_identities',{p_author_ids:selected});
    if (!Array.isArray(rows) || rows.some(row => !selected.includes(row.id) ||
      typeof row.public_name !== 'string' ||
      (row.avatar_path != null && (typeof row.avatar_path !== 'string' || !row.avatar_path.startsWith(row.id+'/'))))) {
      throw new Error('Public authors could not be confirmed.');
    }
    return Promise.all(rows.map(async row => ({id:row.id,first_name:row.public_name || 'HerDay User',last_name:'',
      photo:row.avatar_path ? await signedStorageUrl('profile-photos',row.avatar_path) : ''})));
  }

  async function setAction(post, action, enabled) {
    activeOwner(); id(post);
    if (!['like','save'].includes(action) || typeof enabled !== 'boolean') throw new Error('Invalid action.');
    await herdayRpc('herday_set_social_action', {p_submission_id:post,p_action:action,p_enabled:enabled});
    return actions([post]);
  }
  async function readComments(post, cursor = null, communitySort = null) {
    reset(); id(post);
    if (cursor && (!uuid.test(cursor.id || '') || !Number.isFinite(Date.parse(cursor.created_at)))) {
      throw new Error('Invalid comment cursor.');
    }
    const rows = await herdayRpc(communitySort?'herday_community_answers_v1':'herday_get_social_comments', {
      ...(communitySort?{p_sort:communitySort}:{}),
      p_submission_id:post,p_after_created_at:cursor?.created_at || null,p_after_id:cursor?.id || null
    });
    if (!Array.isArray(rows) || rows.length > 30 || rows.some(row =>
      !uuid.test(row.id || '') || !uuid.test(row.author_id || '') || row.submission_id !== post ||
      typeof row.body !== 'string' || !Number.isFinite(Date.parse(row.created_at)) ||
      typeof row.liked !== 'boolean' || !Number.isSafeInteger(Number(row.likes)) || Number(row.likes)<0 ||
      !Number.isSafeInteger(Number(row.total_count)) || Number(row.total_count)<0 ||
      (row.parent_comment_id !== null && !uuid.test(row.parent_comment_id || '')))) {
      throw new Error('Comments could not be confirmed.');
    }
    return rows;
  }
  async function addComment(post, body, parent = null) {
    const author = activeOwner(); id(post); if (parent !== null) id(parent);
    body = String(body || '').trim();
    if (!body || [...body].length > 2000) throw new Error('Enter 1 to 2000 characters.');
    let pending = comments.get(post);
    if (pending?.sending) throw new Error('Your comment is still being sent.');
    if (!pending || pending.body !== body || pending.parent !== parent) {
      pending = {body,parent,request:crypto.randomUUID(),sending:false};
      comments.set(post,pending);
    }
    pending.sending = true;
    try {
      const result = await herdayRpc('herday_add_social_comment', {
        p_submission_id:post,p_body:body,p_request_id:pending.request,p_parent_id:parent
      });
      reset();
      if (owner !== author) throw new Error('Your session changed. Reopen the post before continuing.');
      id(result);
      comments.delete(post);
      return result;
    } finally {
      // Keep the request UUID after an uncertain result so retries stay idempotent.
      pending.sending = false;
    }
  }
  async function likeComment(comment, enabled) {
    activeOwner(); id(comment);
    if (typeof enabled !== 'boolean') throw new Error('Invalid action.');
    await herdayRpc('herday_like_social_comment',{p_comment_id:comment,p_enabled:enabled});
  }
  async function deleteComment(comment) {
    activeOwner(); id(comment);
    await herdayRpc('herday_delete_social_comment',{p_comment_id:comment});
  }
  return {reset,authors,actions,setAction,readComments,addComment,likeComment,deleteComment};
})();
