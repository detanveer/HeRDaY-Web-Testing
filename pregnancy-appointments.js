/* Private appointment planning only. No automatic booking, attendance or alerts. */
const herdayPregnancyAppointments=(()=>{
  const M=herdayPeriodModel,T=herdayAppointmentTime,API=herdayPregnancyAppointmentService;
  let owner=null,generation=0,state;
  function blank(){return {next:null,history:null,view:'all',historyView:false,loading:false,historyLoading:false,busy:false,draft:null,zone:null,error:'',notice:''};}
  function reset(){API.reset();const next=currentUser()?.id||null;if(next!==owner){owner=next;generation++;state=blank();}}
  function same(current,ticket){reset();return state===current&&ticket===generation;}
  function refresh(){if(S.route==='gs-pregnancy'){render();herdayGirlsSocial.reserveNavigation();}}
  function dirty(){reset();return !!state?.draft?.dirty;}
  function locked(){return state.busy||!!API.unresolved();}
  function btn(action,text,extra=''){return `<button type="button" class="section-secondary" data-pregnancy-appointment-action="${action}" ${state.busy?'disabled':''} ${extra}>${text}</button>`;}
  function when(r){const p=T.local(r.starts_at,r.time_zone);return `${p.date} · ${p.time} · ${r.time_zone}`;}
  async function load(){if(state.loading)return;const current=state,ticket=generation;state.loading=true;state.error='';
    try{const data=await API.read({limit:1});if(same(current,ticket))state.next=data;}
    catch{if(same(current,ticket))state.error='Your private appointments could not be loaded. Please retry.';}
    finally{if(same(current,ticket)){state.loading=false;refresh();}}
  }
  async function history(more=false){if(state.historyLoading)return;const current=state,ticket=generation,before=more?state.history:null,cursor=before?.appointments.at(-1);
    if(more&&(!before?.has_more||!cursor))return;state.historyLoading=true;state.error='';
    try{const page=await API.read({view:state.view,limit:30,cursor:cursor||null});if(!same(current,ticket))return;if(before&&before.data_epoch!==page.data_epoch)throw new Error('Appointments were reset.');state.history={...page,appointments:before?[...before.appointments,...page.appointments]:page.appointments};}
    catch{if(same(current,ticket))state.error='Appointment history could not be confirmed. Reload the history.';}
    finally{if(same(current,ticket)){state.historyLoading=false;refresh();}}
  }
  function editor(){const f=state.draft;if(!f)return '';return `<form data-pregnancy-appointment class="section-card period-panel"><h3>${f.row?'Edit Appointment':'Add Appointment'}</h3><fieldset ${locked()?'disabled':''}><label>Appointment title<input name="title" value="${esc(f.title)}" required autocomplete="off"></label><label>Date in the selected time zone<input type="date" name="date" min="0001-01-01" max="9999-12-31" value="${esc(f.date)}" required></label><label>Time in the selected time zone<input type="time" name="time" step="60" value="${esc(f.time)}" required></label><label>Time zone<input name="zone" value="${esc(f.zone)}" required autocomplete="off"></label>${f.candidates.length>1?`<label>This time occurs more than once. Choose the intended UTC instant<select name="utc_choice" required><option value="">Choose an occurrence</option>${f.candidates.map((iso,i)=>`<option value="${iso}" ${f.utc===iso?'selected':''}>${i+1}: ${iso}</option>`).join('')}</select></label>`:''}<label class="period-consent"><input type="checkbox" name="consent" required> Save this appointment privately to my account.</label><button type="submit" class="section-primary">Save Appointment</button>${btn('cancel','Cancel')}</fieldset><small>A personal planning record, not a clinician booking or an automatic reminder.</small></form>`;}
  function row(r){return `<article class="section-card period-panel"><h3>${esc(r.title)}</h3><p>${esc(when(r))}</p><div class="pregnancy-controls">${btn('edit','Edit',`data-pregnancy-appointment-id="${r.id}"`)}${btn('delete','Delete',`data-pregnancy-appointment-id="${r.id}"`)}</div></article>`;}
  function renderPart(defaultZone){reset();if(!state)state=blank();if(!state.zone)state.zone=defaultZone||Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC';
    const expired=state.next?.appointments[0]&&Date.parse(state.next.appointments[0].starts_at)<Date.now();
    if((!state.next||expired)&&!state.loading&&!state.error&&!locked())setTimeout(load,0);
    const messages=`${state.error?`<p class="period-status" role="alert">${esc(state.error)}</p>`:''}${state.notice?`<p class="period-status" role="status">${esc(state.notice)}</p>`:''}${API.unresolved()?btn('retry','Confirm / retry previous appointment'):''}`;
    if(state.historyView){if(!state.history&&!state.historyLoading&&!state.error)setTimeout(()=>history(),0);
      return `<section class="pregnancy-appointments"><h2>My Appointments</h2>${messages}<div class="pregnancy-controls">${['all','upcoming','past'].map(v=>btn('view',v[0].toUpperCase()+v.slice(1),`data-pregnancy-appointment-view="${v}" aria-pressed="${state.view===v}"`)).join('')}${btn('back','Back to Next Appointment')}</div><small>Past times do not mean an appointment was attended.</small>${state.history?.appointments.map(row).join('')|| (state.history?'<p>No appointments in this view.</p>':'<p>Loading private appointments…</p>')}${state.history?.has_more&&!state.historyLoading?btn('more','Load More'):''}${btn('history-reload','Reload History')}${editor()}</section>`;
    }
    const r=state.next?.appointments[0];return `<section class="pregnancy-appointments"><h2>Appointments</h2>${messages}<section class="section-card period-panel"><small>Next Appointment</small>${r?`<h3>${esc(r.title)}</h3><p>${esc(when(r))}</p>${btn('edit','Edit Appointment',`data-pregnancy-appointment-id="${r.id}"`)}`:`<p>${state.next?'No upcoming appointment saved.':'Loading private appointments…'}</p>`}${btn('add','+ Add Appointment')}</section>${editor()}<div class="pregnancy-controls">${btn('history','View Appointments')}${btn('reload','Refresh')}${btn('clear','Delete All Appointments')}</div></section>`;
  }
  function find(id){return [...(state.next?.appointments||[]),...(state.history?.appointments||[])].find(r=>r.id===id);}
  function failure(error){return ['22023','40001','42501'].includes(error?.code)?error.message:'The result could not be confirmed. Retry the same appointment request.';}
  async function confirmWrite(current,ticket){await load();if(!same(current,ticket))return;if(state.error)throw new Error('Appointment read confirmation failed.');if(state.historyView){state.history=null;await history();if(!same(current,ticket))return;if(state.error)throw new Error('Appointment history confirmation failed.');}API.release();state.draft=null;state.notice='Appointment request confirmed. Current data refreshed.';}
  document.addEventListener('input',event=>{if(S.route!=='gs-pregnancy'||!event.target.closest('[data-pregnancy-appointment]'))return;reset();if(!state.draft||locked())return;const f=state.draft,name=event.target.name;
    if(['title','date','time','zone'].includes(name)){f[name]=event.target.value;f.dirty=true;if(name!=='title'){f.candidates=[];f.utc=null;}}});
  document.addEventListener('change',event=>{if(S.route!=='gs-pregnancy'||!event.target.closest('[data-pregnancy-appointment]')||event.target.name!=='utc_choice')return;reset();if(!locked()&&state.draft?.candidates.includes(event.target.value))state.draft.utc=event.target.value;});
  document.addEventListener('click',async event=>{if(S.route!=='gs-pregnancy')return;const b=event.target.closest('button');if(!b||b.disabled)return;reset();if(!state||state.busy)return;const action=b.dataset.pregnancyAppointmentAction,current=state,ticket=generation;
    try{
      if(action==='add'||action==='edit'){if(locked()||state.loading||!state.next)return;if(state.draft?.dirty&&!confirm('Discard unsaved appointment changes?'))return;
        const r=action==='edit'?find(b.dataset.pregnancyAppointmentId):null;if(action==='edit'&&!r)return;const p=r?T.local(r.starts_at,r.time_zone):null;
        state.draft={row:r,title:r?.title||'',date:p?.date||M.today(state.zone),time:p?.time||'',zone:r?.time_zone||state.zone,candidates:[],utc:null,dirty:false};refresh();return;}
      if(action==='cancel'){if(locked())return;if(state.draft?.dirty&&!confirm('Discard unsaved appointment changes?'))return;state.draft=null;refresh();return;}
      if(action==='history'){state.historyView=true;state.error='';refresh();return;}
      if(action==='back'){state.historyView=false;state.error='';refresh();return;}
      if(action==='view'){if(state.historyLoading)return;const view=b.dataset.pregnancyAppointmentView;if(!['all','upcoming','past'].includes(view))return;state.view=view;state.history=null;state.error='';refresh();return;}
      if(action==='more'){await history(true);return;}
      if(action==='history-reload'){state.history=null;await history();return;}
      if(action==='reload'){await load();return;}
      if(action==='retry'){state.busy=true;state.error='';state.notice='Confirming privately…';refresh();await API.retry();await confirmWrite(current,ticket);return;}
      if(action==='delete'||action==='clear'){if(locked()||state.loading||!state.next)return;const r=action==='delete'?find(b.dataset.pregnancyAppointmentId):null;if(action==='delete'&&!r)return;
        if(!confirm(action==='delete'?`Permanently delete “${r.title}” at ${when(r)}?`:'Permanently delete all your Pregnancy appointments? Dating and check-ins will remain.'))return;
        const epoch=action==='delete'&&state.historyView?state.history.data_epoch:state.next.data_epoch;
        state.busy=true;state.error='';state.notice='Deleting privately…';refresh();
        await API.mutate(action==='delete'?{p_operation:'delete_appointment',p_data_epoch:epoch,p_appointment_id:r.id,p_expected_revision:r.revision,p_confirm_delete:true}:{p_operation:'clear_appointments',p_data_epoch:epoch,p_confirm_delete:true});await confirmWrite(current,ticket);
      }
    }catch(error){if(same(current,ticket)){state.error=failure(error);state.notice='';}}finally{if(same(current,ticket)){state.busy=false;refresh();}}
  });
  document.addEventListener('submit',async event=>{const form=event.target.closest('[data-pregnancy-appointment]');if(!form||S.route!=='gs-pregnancy')return;event.preventDefault();reset();if(!state.next||!state.draft||state.loading||locked())return;const current=state,ticket=generation;
    try{const f=state.draft;for(const name of ['title','date','time','zone'])f[name]=form.elements[name].value;
      if(!form.elements.consent.checked)throw new Error('Confirm saving this appointment privately.');f.title=f.title.trim();f.zone=f.zone.trim();
      if(!f.title||[...f.title].length>180)throw new Error('Enter an appointment title of 1–180 characters.');
      const choices=T.candidates(f.date,f.time,f.zone);f.candidates=choices;
      if(!choices.length)throw new Error('This local time is nonexistent or unsupported. Choose another time; no appointment was saved.');
      const utc=choices.length===1?choices[0]:f.utc;if(!choices.includes(utc))throw new Error('This local time occurs more than once. Choose the intended UTC occurrence; nothing was saved.');
      if(!confirm(`Save appointment?\n${f.title}\n${f.date} ${f.time} (${f.zone})\nUTC: ${utc}${f.row?`\nReplaces: ${when(f.row)}`:''}`))return;
      const epoch=f.row&&state.historyView?state.history.data_epoch:state.next.data_epoch;
      state.busy=true;state.error='';state.notice='Saving privately…';refresh();
      await API.mutate({p_operation:'save_appointment',p_data_epoch:epoch,p_appointment_id:f.row?.id||null,p_expected_revision:f.row?.revision||0,p_title:f.title,p_starts_at:utc,p_time_zone:f.zone,p_confirm_private_save:true});await confirmWrite(current,ticket);
    }catch(error){if(same(current,ticket)){const local=['Confirm saving this appointment privately.','Enter an appointment title of 1–180 characters.','Enter a valid appointment time.','Enter a valid calendar date.','Select a supported appointment time zone.','This local time is nonexistent or unsupported. Choose another time; no appointment was saved.','This local time occurs more than once. Choose the intended UTC occurrence; nothing was saved.'];state.error=local.includes(error?.message)?error.message:failure(error);state.notice='';}}
    finally{if(same(current,ticket)){state.busy=false;refresh();}}
  });
  return {reset,renderPart,dirty};
})();
window.herdayPregnancyAppointments=herdayPregnancyAppointments;
