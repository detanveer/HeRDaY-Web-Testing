/* Shared presentation only. Existing section controllers own data, writes and permissions. */
const herdayCommentsUI = (() => {
  function composer({attributes='',state,reply='',cancel='',answers=false,id='herdayComment'}) {
    const label=reply?'Write a reply':answers?'Write an answer':'Add a comment';
    return `<form class="hd-comment-compose" ${attributes}>${reply?`<p class="hd-comment-reply">Replying to ${esc(reply)} ${cancel}</p>`:''}${herdayOwnAvatar('hd-comment-avatar')}<div class="hd-comment-field"><textarea id="${esc(id)}" name="comment" aria-label="${label}" placeholder="${label}..." maxlength="2000" rows="1" required>${esc(state.draft||'')}</textarea><button type="submit" aria-label="${answers?'Send answer':'Send comment'}" ${state.sending?'disabled':''}>${poetryIcon('plane')}</button></div><p role="status" aria-live="polite">${esc(state.sendError||'')}</p></form>`;
  }
  function comment(c,{menu='',like='',reply='',children='',nested=false}={}) {
    return `<div class="hd-comment ${nested?'hd-comment-nested':''}" data-comment-id="${esc(c.id)}"><header class="hd-comment-author">${c.avatar?`<img class="hd-comment-avatar" src="${esc(c.avatar)}" alt="">`:`<span class="hd-comment-avatar" aria-hidden="true">${esc((c.author||'H').slice(0,1))}</span>`}<div><strong>${herdayAccountFeatures.userLink(c.author_id,c.author)}</strong><time>${esc(c.time||herdayTime(c.created_at))}</time></div>${menu}</header><p dir="auto">${esc(c.body)}</p><div class="hd-comment-actions">${like}${reply}</div>${children}</div>`;
  }
  function resize(field){field.style.height='auto';field.style.height=Math.min(120,Math.max(30,field.scrollHeight))+'px';}
  document.addEventListener('input',e=>{if(e.target.matches('.hd-comment-field textarea'))resize(e.target);});
  document.addEventListener('focusin',e=>{if(e.target.matches('.hd-comment-field textarea'))resize(e.target);});
  return {composer,comment};
})();
