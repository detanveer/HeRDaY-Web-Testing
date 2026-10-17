/* My Reminders: user-created private text list, no medical defaults or alerts. */
const herdayPregnancyReminders=(()=>{
  const API=herdayPregnancyReminderService;
  let owner=null,generation=0,state;
  function blank(){return {data:null,loading:false,busy:false,draft:null,error:'',notice:''};}
  function reset(){API.reset();const next=currentUser()?.id||null;if(next!==owner){owner=next;generation++;state=blank();}}
  function same(current,ticket){reset();return state===current&&ticket===generation;}
  function refresh(){if(S.route==='gs-pregnancy'){render();herdayGirlsSocial.reserveNavigation();}}
  function dirty(){reset();return !!state?.draft?.dirty;}
  function locked(){return state.busy||!!API.unresolved();}
  function btn(action,text,extra=''){return `<button type="button" class="section-secondary" data-pregnancy-reminder-action="${action}" ${state.busy?'disabled':''} ${extra}>${text}</button>`;}
  async function load(more=false){if(state.loading)return;const current=state,ticket=generation,before=more?state.data:null,cursor=before?.reminders.at(-1);if(more&&(!before?.has_more||!cursor))return;
    state.loading=true;state.error='';
    try{const data=await API.read({limit:30,cursor:cursor||null});if(!same(current,ticket))return;if(before&&before.data_epoch!==data.data_epoch)throw new Error('Reminders were reset.');state.data={...data,reminders:before?[...before.reminders,...data.reminders]:data.reminders};}
    catch{if(same(current,ticket))state.error='Your private reminders could not be confirmed. Please reload.';}
    finally{if(same(current,ticket)){state.loading=false;refresh();}}
  }
  function editor(){const f=state.draft;if(!f)return '';return `<form data-pregnancy-reminder class="section-card period-panel"><h3>${f.row?'Edit Reminder':'Add Reminder'}</h3><fieldset ${locked()||state.loading?'disabled':''}><label>Reminder text<input name="label" value="${esc(f.label)}" required autocomplete="off"></label><small>1–180 characters. This is an in-app list; it does not send alerts.</small><label class="period-consent"><input type="checkbox" name="consent" required> Save this reminder privately to my account.</label><button type="submit" class="section-primary">Save Reminder</button>${btn('cancel','Cancel')}</fieldset></form>`;}
  function renderPart(){reset();if(!state)state=blank();if(!state.data&&!state.loading&&!state.error)setTimeout(load,0);
    const messages=`${state.error?`<p class="period-status" role="alert">${esc(state.error)}</p>`:''}${state.notice?`<p class="period-status" role="status">${esc(state.notice)}</p>`:''}${API.unresolved()?btn('retry','Confirm / retry previous reminder'):''}`;
    return `<section class="pregnancy-reminders"><h2>My Reminders</h2>${messages}<section class="section-card period-panel"><p>Your personal reminders</p>${state.data?.reminders.length?`<ul class="pregnancy-reminder-list">${state.data.reminders.map(r=>`<li><span>${esc(r.label)}</span><div>${btn('edit','Edit',`data-pregnancy-reminder-id="${r.id}"`)}${btn('delete','Delete',`data-pregnancy-reminder-id="${r.id}"`)}</div></li>`).join('')}</ul>`:`<p>${state.data?'No saved reminders yet.':'Loading your private reminders…'}</p>`}${btn('add','+ Add Reminder')}${state.data?.has_more&&!state.loading?btn('more','Load More'):''}</section>${editor()}<div class="pregnancy-controls">${btn('reload','Refresh')}${btn('clear','Delete All Reminders')}</div></section>`;
  }
  function failure(error){return ['22023','40001','42501'].includes(error?.code)?error.message:'The result could not be confirmed. Retry the same reminder request.';}
  async function confirmWrite(current,ticket){await load();if(!same(current,ticket))return;if(state.error)throw new Error('Reminder read confirmation failed.');API.release();state.draft=null;state.notice='Reminder request confirmed. Current list refreshed.';}
  document.addEventListener('input',event=>{if(S.route!=='gs-pregnancy'||!event.target.closest('[data-pregnancy-reminder]')||event.target.name!=='label')return;reset();if(state.draft&&!locked()){state.draft.label=event.target.value;state.draft.dirty=true;}});
  document.addEventListener('click',async event=>{if(S.route!=='gs-pregnancy')return;const b=event.target.closest('button');if(!b||b.disabled)return;reset();if(!state||state.busy)return;const action=b.dataset.pregnancyReminderAction,current=state,ticket=generation;
    try{
      if(action==='add'||action==='edit'){if(locked()||state.loading||!state.data)return;if(state.draft?.dirty&&!confirm('Discard unsaved reminder changes?'))return;const r=action==='edit'?state.data.reminders.find(r=>r.id===b.dataset.pregnancyReminderId):null;if(action==='edit'&&!r)return;state.draft={row:r,label:r?.label||'',dirty:false};refresh();return;}
      if(action==='cancel'){if(locked())return;if(state.draft?.dirty&&!confirm('Discard unsaved reminder changes?'))return;state.draft=null;refresh();return;}
      if(action==='more'){await load(true);return;}
      if(action==='reload'){await load();return;}
      if(action==='retry'){state.busy=true;state.error='';state.notice='Confirming privately…';refresh();await API.retry();await confirmWrite(current,ticket);return;}
      if(action==='delete'||action==='clear'){if(locked()||state.loading||!state.data)return;const r=action==='delete'?state.data.reminders.find(r=>r.id===b.dataset.pregnancyReminderId):null;if(action==='delete'&&!r)return;
        if(!confirm(action==='delete'?`Permanently delete “${r.label}”?`:'Permanently delete all your Pregnancy reminders? Dating, check-ins and appointments will remain.'))return;
        state.busy=true;state.error='';state.notice='Deleting privately…';refresh();
        await API.mutate(action==='delete'?{p_operation:'delete_reminder',p_data_epoch:state.data.data_epoch,p_reminder_id:r.id,p_expected_revision:r.revision,p_confirm_delete:true}:{p_operation:'clear_reminders',p_data_epoch:state.data.data_epoch,p_confirm_delete:true});await confirmWrite(current,ticket);
      }
    }catch(error){if(same(current,ticket)){state.error=failure(error);state.notice='';}}finally{if(same(current,ticket)){state.busy=false;refresh();}}
  });
  document.addEventListener('submit',async event=>{const form=event.target.closest('[data-pregnancy-reminder]');if(!form||S.route!=='gs-pregnancy')return;event.preventDefault();reset();if(!state.data||!state.draft||state.loading||locked())return;const current=state,ticket=generation;
    try{const f=state.draft;f.label=form.elements.label.value.trim();if(!form.elements.consent.checked)throw new Error('Confirm saving this reminder privately.');if(!f.label||[...f.label].length>180)throw new Error('Enter reminder text of 1–180 characters.');
      state.busy=true;state.error='';state.notice='Saving privately…';refresh();
      await API.mutate({p_operation:'save_reminder',p_data_epoch:state.data.data_epoch,p_reminder_id:f.row?.id||null,p_expected_revision:f.row?.revision||0,p_label:f.label,p_confirm_private_save:true});await confirmWrite(current,ticket);
    }catch(error){if(same(current,ticket)){state.error=['Confirm saving this reminder privately.','Enter reminder text of 1–180 characters.'].includes(error?.message)?error.message:failure(error);state.notice='';}}
    finally{if(same(current,ticket)){state.busy=false;refresh();}}
  });
  return {reset,renderPart,dirty};
})();
window.herdayPregnancyReminders=herdayPregnancyReminders;
