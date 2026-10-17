/* Shared comment options. Editing is restricted again on the server to the author. */
function herdayCommentOptions(comment,{onEdit,onDelete}={}){
 const owner=currentUser()?.id;if(!owner||!comment||!HERDAY_UUID.test(comment.id||''))return;
 const own=comment.author_id===owner;if(!own&&!isAdmin())return;
 document.querySelector('dialog.herday-comment-options')?.remove();
 const dialog=document.createElement('dialog');dialog.className='herday-comment-options';dialog.setAttribute('aria-label','Comment options');
 const close=()=>{dialog.close();dialog.remove();};let saving=false;
 const sameUser=()=>{if(currentUser()?.id!==owner){close();return false;}return true;};
 dialog.addEventListener('cancel',event=>{if(saving)event.preventDefault();});dialog.addEventListener('close',()=>dialog.remove(),{once:true});
 function button(label,handler){const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=handler;dialog.append(b);return b;}
 function edit(){
  if(!sameUser()||!own)return;dialog.replaceChildren();dialog.setAttribute('aria-label','Edit comment');
  const form=document.createElement('form'),label=document.createElement('label'),input=document.createElement('textarea'),status=document.createElement('p'),actions=document.createElement('div'),cancel=document.createElement('button'),save=document.createElement('button');
  label.textContent='Edit comment';input.id='herdayEditComment';input.name='comment';input.maxLength=2000;input.required=true;input.value=comment.body;label.htmlFor=input.id;status.setAttribute('role','status');actions.className='comment-editor-actions';cancel.type='button';cancel.textContent='Cancel';cancel.onclick=close;save.type='submit';save.textContent='Save Changes';actions.append(cancel,save);form.append(label,input,status,actions);dialog.append(form);input.focus();input.setSelectionRange(input.value.length,input.value.length);
  form.onsubmit=async event=>{
   event.preventDefault();if(saving||!sameUser())return;const body=input.value.trim();if(!body||[...body].length>2000){status.textContent='Enter 1 to 2000 characters.';return;}
   saving=true;save.disabled=true;cancel.disabled=true;input.disabled=true;status.textContent='Saving…';
   try{
    const result=await herdayRpc('herday_edit_comment_v1',{p_comment_id:comment.id,p_body:body,p_expected_body:comment.body});
    if(!sameUser())return;if(result?.comment_id!==comment.id||result.body!==body)throw Error('The saved comment could not be confirmed. Retry the same edit.');
    comment.body=result.body;close();if(onEdit)await onEdit(result);
   }catch(error){if(!dialog.isConnected||!sameUser())return;status.textContent=/PGRST202|schema cache|function.*does not exist/i.test((error.code||'')+' '+(error.message||''))?'Comment editing needs the supplied SQL update.':error.message||'Could not save. Retry the same edit.';}
   finally{saving=false;save.disabled=false;cancel.disabled=false;input.disabled=false;}
  };
 }
 if(own)button('Edit',edit);
 button('Delete',async()=>{if(saving||!sameUser()||!onDelete)return;if(!confirm('Delete this comment and any replies beneath it?'))return;saving=true;for(const b of dialog.querySelectorAll('button'))b.disabled=true;try{await onDelete();close();}catch(error){saving=false;for(const b of dialog.querySelectorAll('button'))b.disabled=false;let status=dialog.querySelector('[role=alert]');if(!status){status=document.createElement('p');status.setAttribute('role','alert');dialog.append(status);}status.textContent=error.message||'Could not delete this comment. Please retry.';}});
 button('Cancel',close);document.body.append(dialog);dialog.showModal();
}
