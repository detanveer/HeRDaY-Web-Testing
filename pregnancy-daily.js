/* Private Pregnancy Check-in, recent entries and paginated history. */
const herdayPregnancyDaily=(()=>{
  const M=herdayPeriodModel,API=herdayPregnancyDailyService;
  let owner=null,generation=0,state;
  function blank(){return {date:null,zone:null,day:null,recent:null,history:null,historyView:false,draft:null,loading:false,historyLoading:false,busy:false,error:'',notice:''};}
  function reset(){API.reset();const next=currentUser()?.id||null;if(next!==owner){owner=next;generation++;state=blank();}}
  function same(current,ticket){reset();return current===state&&ticket===generation;}
  function refresh(){if(S.route==='gs-pregnancy'){render();herdayGirlsSocial.reserveNavigation();}}
  function dirty(){reset();return !!state?.draft?.dirty;}
  function locked(){reset();return !!state?.busy||!!API.unresolved();}
  function label(value){return value?value[0].toUpperCase()+value.slice(1):'Not recorded';}
  function date(value){return new Intl.DateTimeFormat('en',{timeZone:'UTC',year:'numeric',month:'short',day:'numeric'}).format(new Date(M.ordinal(value)*86400000));}
  function latestDate(zone){try{return M.today(zone);}catch{return M.today(state.zone);}}
  function btn(action,text,extra=''){return `<button type="button" class="section-secondary" data-pregnancy-check-action="${action}" ${state.busy?'disabled':''} ${extra}>${text}</button>`;}
  function draft(){if(!state.draft&&state.day){const r=state.day.logs[0];state.draft={energy:r?.energy??null,mood:r?.mood??null,symptoms:[...(r?.symptoms||[])],notes:r?.notes||'',zone:r?.recorded_time_zone||state.zone,dirty:false};}return state.draft;}
  async function loadDay(){if(state.loading)return;const current=state,ticket=generation,selected=state.date;state.loading=true;state.error='';
    try{const [day,recent]=await Promise.all([API.read({onDate:selected,limit:1}),API.read({limit:3})]);if(!same(current,ticket)||state.date!==selected)return;
      if(day.data_epoch!==recent.data_epoch)throw new Error('Check-in data changed during read.');state.day=day;state.recent=recent;
      if(!state.draft?.dirty)state.draft=null;
    }catch{if(same(current,ticket))state.error='Private check-ins could not be loaded. Please retry.';}
    finally{if(same(current,ticket)){state.loading=false;refresh();}}
  }
  async function loadHistory(more=false){if(state.historyLoading)return;const current=state,ticket=generation;
    const before=more?state.history:null,cursor=before?.logs.at(-1);if(more&&(!before?.has_more||!cursor))return;
    state.historyLoading=true;state.error='';
    try{const page=await API.read({limit:30,cursor:cursor||null});if(!same(current,ticket))return;
      if(before&&page.data_epoch!==before.data_epoch)throw new Error('Check-in history was reset.');
      state.history={...page,logs:before?[...before.logs,...page.logs]:page.logs};
    }catch{if(same(current,ticket))state.error='Check-in history could not be confirmed. Reload the history.';}
    finally{if(same(current,ticket)){state.historyLoading=false;refresh();}}
  }
  function summary(r){return `<strong>${esc(date(r.log_date))}</strong><p>Mood: ${esc(label(r.mood))} · Energy: ${esc(label(r.energy))}</p>${r.symptoms.length?`<p>Symptoms: ${esc(r.symptoms.map(label).join(', '))}</p>`:''}${r.notes?`<p class="pregnancy-check-note">${esc(r.notes)}</p>`:''}${btn('open','View / Edit',`data-pregnancy-check-date="${esc(r.log_date)}"`)}`;}
  function renderPart(defaultZone,{includeRecent=true}={}){reset();if(!state)state=blank();if(!state.date){state.zone=defaultZone||Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC';state.date=M.today(state.zone);}
    if(!state.day&&!state.loading&&!state.error&&!state.historyView)setTimeout(loadDay,0);
    const pending=API.unresolved(),messages=`${state.error?`<p role="alert" class="period-status">${esc(state.error)}</p>`:''}${state.notice?`<p role="status" class="period-status">${esc(state.notice)}</p>`:''}${pending?btn('retry','Confirm / retry previous check-in'):''}`;
    if(state.historyView){if(!state.history&&!state.historyLoading&&!state.error)setTimeout(()=>loadHistory(),0);
      return `<section class="pregnancy-checkin"><h2>Check-in History</h2>${messages}${btn('history-back','Back to Daily Check-in')}${state.history?.logs.length?state.history.logs.map(r=>`<article class="section-card period-panel pregnancy-check-row">${summary(r)}</article>`).join(''):state.history?'<p>No saved check-ins.</p>':'<p>Loading private history…</p>'}${state.historyLoading?'<p role="status">Loading…</p>':''}${state.history?.has_more&&!state.historyLoading?btn('history-more','Load More'):''}${btn('history-reload','Reload History')}</section>`;
    }
    let form='';
    if(state.day){const f=draft(),r=state.day.logs[0],disabled=locked()||state.loading;
      const choices=(field,values)=>`<div class="pregnancy-check-choices" data-pregnancy-check-group="${field}" role="group" aria-label="${label(field)}">${values.map(value=>`<button type="button" data-pregnancy-check-choice="${field}" data-pregnancy-check-value="${value}" aria-pressed="${field==='symptoms'?f.symptoms.includes(value):f[field]===value}">${label(value)}</button>`).join('')}</div>`;
      form=`<form data-pregnancy-checkin class="section-card period-panel"><fieldset ${disabled?'disabled':''}><label>Check-in date<input type="date" name="log_date" value="${esc(state.date)}" max="${latestDate(f.zone)}" required></label><small>${r?'Editing your saved check-in.':'No check-in is saved for this date.'} Unselected fields remain unrecorded.</small><h3>Mood</h3>${choices('mood',API.moods)}<h3>Energy</h3>${choices('energy',API.energies)}<h3>Symptoms</h3>${choices('symptoms',API.symptoms)}<label>Notes<textarea name="notes" rows="3" placeholder="Anything you want to note?">${esc(f.notes)}</textarea></label><small>Optional; up to 2,000 characters.</small><label>Time zone<input name="zone" value="${esc(f.zone)}" required autocomplete="off"></label><label class="period-consent"><input type="checkbox" name="consent" required> Save this check-in privately to my account.</label><button type="submit" class="section-primary">${r?'Save Changes':'Save Check-in'}</button>${r?btn('delete','Delete This Check-in'):''}${btn('reload','Reload Date')}</fieldset></form>`;
    }else form=`<section class="section-card period-panel"><p>${state.error?'Private check-in unavailable.':'Loading private check-in…'}</p>${state.error?btn('reload','Try Again'):''}</section>`;
    return `<section class="pregnancy-checkin"><h2>Daily Check-in</h2>${messages}${form}<p class="pregnancy-reference-note">Your notes record what you report. They do not diagnose symptoms or assess pregnancy or fetal wellbeing.</p>${includeRecent?renderRecent():''}</section>`;
  }
  function renderRecent(){reset();if(!state||state.historyView)return '';
    const recent=state.recent?.logs.length?`<section class="section-card period-panel">${state.recent.logs.map(r=>`<div class="pregnancy-check-row pregnancy-check-recent"><strong>${esc(date(r.log_date))}</strong><p>Mood: ${esc(label(r.mood))} · Energy: ${esc(label(r.energy))}</p>${btn('open','View / Edit',`data-pregnancy-check-date="${esc(r.log_date)}"`)}</div>`).join('')}</section>`:state.recent?'<p>No saved check-ins yet.</p>':'';
    return `<section class="pregnancy-checkin"><h2>Recent Check-ins</h2>${recent}<div class="pregnancy-controls">${btn('history','View History')}${btn('clear','Delete All Check-ins')}</div></section>`;
  }

  function failure(error){return ['22023','40001','42501'].includes(error?.code)?error.message:'The result could not be confirmed. Retry the same check-in request.';}
  async function confirmWrite(current,ticket){state.draft=null;state.history=null;await loadDay();if(!same(current,ticket))return;if(state.error)throw new Error('Check-in read confirmation failed.');API.release();state.notice='Check-in request confirmed. Current data refreshed.';}
  async function selectDate(value){if(locked()||state.loading)return;M.ordinal(value);if(state.draft?.dirty&&!confirm('Discard unsaved check-in changes?')){refresh();return;}state.date=value;state.day=null;state.draft=null;state.historyView=false;state.error='';state.notice='';refresh();await loadDay();}
  document.addEventListener('input',event=>{if(S.route!=='gs-pregnancy'||!event.target.closest('[data-pregnancy-checkin]'))return;reset();if(locked())return;const f=draft();if(f&&['notes','zone'].includes(event.target.name)){f[event.target.name]=event.target.value;f.dirty=true;}});
  document.addEventListener('change',async event=>{if(S.route!=='gs-pregnancy'||!event.target.closest('[data-pregnancy-checkin]')||event.target.name!=='log_date')return;reset();try{await selectDate(event.target.value);}catch{state.error='Enter a valid check-in date.';refresh();}});
  document.addEventListener('click',async event=>{if(S.route!=='gs-pregnancy')return;const b=event.target.closest('button');if(!b||b.disabled)return;reset();if(!state||state.busy)return;
    const current=state,ticket=generation,action=b.dataset.pregnancyCheckAction,field=b.dataset.pregnancyCheckChoice;
    try{
      if(field){if(locked()||state.loading)return;const value=b.dataset.pregnancyCheckValue,f=draft();if(!f)return;
        if(field==='symptoms'&&API.symptoms.includes(value))f.symptoms=f.symptoms.includes(value)?f.symptoms.filter(x=>x!==value):[...f.symptoms,value];
        else if(['mood','energy'].includes(field)&&(field==='mood'?API.moods:API.energies).includes(value))f[field]=f[field]===value?null:value;else return;
        f.dirty=true;refresh();return;
      }
      if(action==='open'){await selectDate(b.dataset.pregnancyCheckDate);return;}
      if(action==='history'){state.historyView=true;state.error='';refresh();return;}
      if(action==='history-back'){state.historyView=false;state.error='';refresh();return;}
      if(action==='history-more'){await loadHistory(true);return;}
      if(action==='history-reload'){state.history=null;await loadHistory();return;}
      if(action==='reload'){if(locked())return;if(state.draft?.dirty&&!confirm('Discard unsaved check-in changes and reload?'))return;state.draft=null;await loadDay();return;}
      if(action==='retry'){state.busy=true;state.error='';state.notice='Confirming privately…';refresh();await API.retry();await confirmWrite(current,ticket);return;}
      if(action==='delete'||action==='clear'){if(locked()||!state.day)return;const r=state.day.logs[0];if(action==='delete'&&!r)return;
        if(!confirm(action==='delete'?`Permanently delete your check-in for ${date(state.date)}?`:'Permanently delete all your Pregnancy check-ins? Saved dating and other trackers will remain.'))return;
        state.busy=true;state.error='';state.notice='Deleting privately…';refresh();
        await API.mutate(action==='delete'?{p_operation:'delete_log',p_data_epoch:state.day.data_epoch,p_log_id:r.id,p_expected_revision:r.revision,p_confirm_delete:true}:{p_operation:'clear_daily_logs',p_data_epoch:state.day.data_epoch,p_confirm_delete:true});
        await confirmWrite(current,ticket);
      }
    }catch(error){if(same(current,ticket)){state.error=failure(error);state.notice='';}}
    finally{if(same(current,ticket)){state.busy=false;refresh();}}
  });
  document.addEventListener('submit',async event=>{const form=event.target.closest('[data-pregnancy-checkin]');if(!form||S.route!=='gs-pregnancy')return;event.preventDefault();reset();if(!state?.day||locked()||state.loading)return;
    const current=state,ticket=generation;
    try{const f=draft();f.notes=form.elements.notes.value;f.zone=form.elements.zone.value.trim();
      if(!form.elements.consent.checked)throw new Error('Confirm saving this check-in privately.');
      M.ordinal(state.date);const today=M.today(f.zone);if(state.date>today)throw new Error('An actual check-in cannot be in the future.');
      if([...f.notes.trim()].length>2000)throw new Error('Enter at most 2,000 characters.');
      if(f.energy===null&&f.mood===null&&!f.symptoms.length&&!f.notes.trim())throw new Error('Select a value or enter a note.');
      const r=state.day.logs[0];state.busy=true;state.error='';state.notice='Saving privately…';refresh();
      await API.mutate({p_operation:'save_log',p_data_epoch:state.day.data_epoch,p_log_id:r?.id||null,p_expected_revision:r?.revision||0,p_log_date:state.date,p_energy:f.energy,p_mood:f.mood,p_symptoms:[...f.symptoms].sort(),p_notes:f.notes.trim(),p_time_zone:f.zone,p_confirm_private_save:true});
      await confirmWrite(current,ticket);
    }catch(error){if(same(current,ticket)){const messages=['Confirm saving this check-in privately.','An actual check-in cannot be in the future.','Enter at most 2,000 characters.','Select a value or enter a note.','Enter a valid calendar date.'];state.error=messages.includes(error?.message)?error.message:failure(error);state.notice='';}}
    finally{if(same(current,ticket)){state.busy=false;refresh();}}
  });
  return {reset,renderPart,renderRecent,dirty,locked};
})();
window.herdayPregnancyDaily=herdayPregnancyDaily;
