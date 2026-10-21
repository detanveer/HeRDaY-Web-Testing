/* Private dating + locally bundled NHS educational references. No fake check-ins. */
const herdayPregnancyTracker=(()=>{
  const M=herdayPeriodModel,P=herdayPregnancyModel,API=herdayPregnancyService,W=herdayPregnancyWeeks,Daily=herdayPregnancyDaily,Appointments=herdayPregnancyAppointments,Reminders=herdayPregnancyReminders;
  let owner=null,generation=0,state;
  function blank(){return {data:null,loaded:false,loading:false,busy:false,error:'',notice:'',draft:null,weekView:false,referenceWeek:4};}
  function reset(){API.reset();Daily.reset();Appointments.reset();Reminders.reset();const next=currentUser()?.id||null;if(next!==owner){owner=next;generation++;state=blank();}}
  function refresh(){if(S.route==='gs-pregnancy'){render();herdayGirlsSocial.reserveNavigation();}}
  function same(current,ticket){reset();return state===current&&generation===ticket;}
  async function load(){if(state.loading)return;const current=state,ticket=generation;state.loading=true;state.error='';
    try{const data=await API.read();if(!same(current,ticket))return;state.data=data;state.loaded=true;}
    catch{if(same(current,ticket))state.error='Your private dating record could not be loaded. Please retry.';}
    finally{if(same(current,ticket)){state.loading=false;refresh();}}
  }
  function date(value){return new Intl.DateTimeFormat('en',{timeZone:'UTC',year:'numeric',month:'long',day:'numeric'}).format(new Date(M.ordinal(value)*86400000));}
  function provenance(d){return d.dating_source==='clinician_edd'?'Clinician-provided due date — reported by you':d.cycle_length===null?'Preliminary estimate — assumes a 28-day cycle':'Preliminary estimate — uses your entered cycle length';}
  function draft(){if(!state.draft){const d=state.data?.dating;state.draft={source:d?.dating_source||'',mode:d?.tracking_mode||'standard',lmp:d?.lmp||'',edd:d?.clinician_edd||'',cycle:d?.cycle_length??'',reliable:d?.lmp_reliable??'',regular:d?.cycles_regular??'',zone:d?.time_zone||Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC',dirty:false};}return state.draft;}
  function button(action,label){return `<button type="button" class="section-secondary" data-pregnancy-action="${action}" ${state.busy?'disabled':''}>${label}</button>`;}
  function editor(){const f=draft(),locked=state.busy||!!API.unresolved(),old=state.data.dating;
    const options=(values,selected)=>values.map(([v,label])=>`<option value="${v}" ${String(selected)===v?'selected':''}>${label}</option>`).join('');
    const choice=(name,label,value)=>`<label>${label}<select name="${name}">${options([['','Not specified'],['true','Yes'],['false','No']],value)}</select></label>`;
    return `<form data-pregnancy-dating class="section-card period-panel"><h3>${old?'Edit Dating':'Set Dating'}</h3>${old?`<p class="pregnancy-source">Current: ${esc(provenance(old))}<br>${esc(date(old.selected_edd))}</p>`:''}<fieldset ${locked?'disabled':''}><label>Tracking mode<select name="mode">${options([['standard','Standard'],['art','IVF / ART']],f.mode)}</select></label><label>Dating source<select name="source" required>${options([['','Choose a dating source'],['clinician_edd','Due date provided by my clinician'],['lmp','Preliminary estimate from LMP']],f.source)}</select></label>${f.source==='lmp'?`<label>First day of your last menstrual period<input type="date" name="lmp" value="${esc(f.lmp)}" required></label>${choice('reliable','Is this LMP date reliable?',f.reliable)}${choice('regular','Are your cycles regular?',f.regular)}<label>Entered cycle length (days, optional)<input type="number" name="cycle" min="21" max="35" step="1" value="${esc(f.cycle)}"></label><small>Blank length assumes 28 days. Adjustment requires explicitly regular cycles and reliable LMP. Variable cycles require a clinician-provided due date.</small>`:f.source==='clinician_edd'?`<label>Due date provided by your clinician<input type="date" name="edd" value="${esc(f.edd)}" required></label><small>This is a date you report; HerDay does not verify a medical record.</small>`:''}<label>Time zone<input name="zone" value="${esc(f.zone)}" required autocomplete="off"></label><label class="period-consent"><input type="checkbox" name="tracking" required> I choose to use pregnancy tracking. This does not establish pregnancy.</label><label class="period-consent"><input type="checkbox" name="consent" required> Save this dating information privately to my account.</label><button class="section-primary" type="submit">Save Dating</button>${old?button('cancel-edit','Cancel'):''}</fieldset></form>`;
  }
  function safety(){return `<section class="section-card pregnancy-emergency"><h3>When to Seek Medical Help</h3><p>${esc(P.emergency)}</p></section><section class="section-card period-health"><h3>Health Information</h3><p>Pregnancy dates and due dates are estimates. Every pregnancy is different. HerDay does not replace professional prenatal care, medical advice, diagnosis or treatment.</p><p>HerDay does not confirm pregnancy, delivery or fetal wellbeing. Your clinician’s guidance takes priority.</p></section><footer class="period-private"><strong>Private to you</strong><p>Your pregnancy tracking information is private to your account.</p></footer>`;}
  function source(url,label){return `<a class="pregnancy-reference" href="${esc(url)}" target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer">${label} ↗</a>`;}
  function trimester(week){const t=W.trimester(week);return t?`${['','First','Second','Third'][t]} Trimester — NHS reference`:null;}
  function weekly(week,browsing=false){const r=W.get(week),title=browsing?'Week Reference':'This Week';
    if(!r)return `<h2>${title}</h2><section class="section-card period-panel pregnancy-week"><h3>Week ${esc(week)} reference unavailable</h3><p>No verified week-specific content is bundled for this week. HerDay does not fill gaps using another week’s information.</p>${source(W.index,'NHS pregnancy guide')}</section>`;
    const length=r.length?`<p class="pregnancy-measurement">Approx. ${esc(r.length.value)} ${esc(r.length.unit)}<small>${r.length.basis?esc(r.length.basis):'Measurement basis not stated on this week’s source page'}</small></p>`:'';
    const weight=r.weight?`<p class="pregnancy-measurement">Approx. ${esc(r.weight.min)}–${esc(r.weight.max)} ${esc(r.weight.unit)}<small>Published general weight range</small></p>`:'';
    return `<h2>${title}</h2><section class="section-card period-panel pregnancy-week"><div class="pregnancy-week-heading"><h3>Week ${r.week}</h3><span class="pregnancy-trimester">${esc(trimester(r.week))}</span></div><p>${esc(r.topic)}</p><p class="pregnancy-reference-note">${esc(W.disclaimer)}</p>${source(r.source,`NHS Week ${r.week} source`)}</section>${r.length||r.weight||r.comparison?`<h2>Baby Size</h2><section class="section-card period-panel pregnancy-size"><h3>Typical published reference</h3>${r.comparison?`<p>Approximate comparison: ${esc(r.comparison)}</p>`:''}${length}${weight}<small>These are approximate population references, not your baby’s measured size. Lengths use different measurement bases across weeks and should not be treated as a personal growth chart.</small></section>`:''}<h2>You This Week</h2><section class="section-card period-panel pregnancy-week"><p>${esc(r.you)}</p><small>Possible general experiences, not a diagnosis or an assessment of your symptoms.</small></section>`;
  }
  function weeksPage(header,messages){const week=state.referenceWeek;
    return header+`<div class="section-body period-content pregnancy-content"><h2>Pregnancy Weeks</h2><p class="pregnancy-reference-note">Browse educational references independently of your saved dating. Selecting a week does not change your dating record. Verified NHS pages: Weeks 4–41.</p>${messages}${button('weeks-back','Back to My Tracker')}<div class="pregnancy-week-picker" aria-label="Choose an educational week">${W.available.map(w=>`<button type="button" data-pregnancy-week="${w}" aria-pressed="${w===week}" ${state.busy?'disabled':''}>${w}</button>`).join('')}</div>${weekly(week,true)}<div class="pregnancy-controls">${week>4?button('previous-week','Previous Week'):''}${week<41?button('next-week','Next Week'):''}</div>${safety()}</div>`;
  }
  function renderPage(){reset();if(!state)state=blank();if(!state.loaded&&!state.loading&&!state.error)setTimeout(load,0);
    const header=herdayPageHeader({className:'gs-header',title:'Pregnancy Tracker',subtitle:'Follow your pregnancy journey week by week.',button:`<button type="button" data-pregnancy-action="back" aria-label="Back"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 12H4m7-8-8 8 8 8"/></svg></button>`});
    const pending=API.unresolved(),messages=`${state.error?`<p class="period-status" role="alert">${esc(state.error)}</p>`:''}${state.notice?`<p class="period-status" role="status">${esc(state.notice)}</p>`:''}${pending?button('retry','Confirm / retry previous dating request'):''}`;
    if(state.weekView)return weeksPage(header,messages);
    if(!state.data)return header+`<div class="section-body period-content">${messages}<p>${state.error?'Private dating unavailable.':'Loading your private dating record…'}</p>${state.error?button('reload','Try again'):''}${safety()}</div>`;
    const d=state.data.dating;let body='';
    if(d){const age=P.progress(d,M.today(d.time_zone));const unavailable=age.reason==='inconsistent_dates'?'Calculated progress unavailable: the reference date is before the selected dating anchor.':'Routine calculated progress unavailable beyond the 42w0d product support limit. Please seek prompt clinical clarification.';
      body=`<section class="section-card pregnancy-summary"><strong>${age.available?`Week ${age.weeks}`:'Calculated Progress Unavailable'}</strong><p>${age.available?`${age.weeks} weeks + ${age.days} days`:esc(unavailable)}</p><small>Estimated Due Date</small><h2>${esc(date(d.selected_edd))}</h2>${age.available?`<span>${age.remainingDays>0?`${Math.floor(age.remainingDays/7)} weeks + ${age.remainingDays%7} days until the estimated due date`:age.remainingDays===0?'Estimated due date is today':`Estimated due date passed ${Math.abs(age.remainingDays)} days ago; delivery is not inferred.`}</span>`:''}<p class="pregnancy-source">${esc(provenance(d))}</p></section><h2>Your Pregnancy</h2><section class="section-card period-panel">${age.available?`<p>${age.weeks} weeks + ${age.days} days against an approximately 40-week dating reference.</p>${age.elapsedDays<=280?`<progress value="${age.elapsedDays}" max="280" aria-label="Elapsed time against the 40-week dating reference"></progress>`:''}`:`<p>${esc(unavailable)}</p>`}<small>Calculated from the selected EDD minus 280 days. Your saved dating record is retained.</small></section><div class="pregnancy-controls">${button('edit','Edit Dating')}${button('delete','Delete Dating')}${button('reload','Refresh')}</div>`;
    }else body='<section class="section-card pregnancy-summary"><strong>No Dating Saved</strong><p>Choose a dating source to start private tracking. A missed period is not pregnancy confirmation.</p></section>';
    if(d){const age=P.progress(d,M.today(d.time_zone));const label=age.available?trimester(age.weeks):null;
      if(label)body=body.replace('</strong>',`</strong><span class="pregnancy-trimester">${esc(label)}</span>`);
      if(age.available)body+=weekly(age.weeks);
      else body+='<section class="section-card period-panel"><p>Current-week educational content is unavailable while routine calculated progress is unavailable. You can still browse the general reference guide.</p></section>';
    }
    body+=Daily.renderPart(d?.time_zone,{includeRecent:false});
    body+=Appointments.renderPart(d?.time_zone);
    body+=Reminders.renderPart();
    body+=Daily.renderRecent();
    body+=`<div class="pregnancy-controls">${button('weeks','View Pregnancy Weeks')}</div>`;
    if(state.draft||!d)body+=editor();
    return header+`<div class="section-body period-content pregnancy-content">${messages}${body}${safety()}</div>`;
  }
  function failure(error){return ['22023','40001','42501'].includes(error?.code)?error.message:'The result could not be confirmed. Check your connection and retry the same request.';}
  async function confirmWrite(current,ticket){await load();if(!same(current,ticket))return;if(state.error)throw new Error('Read confirmation failed.');API.release();state.draft=null;state.notice='Dating request confirmed. Current record refreshed.';}
  document.addEventListener('input',event=>{if(S.route!=='gs-pregnancy'||!event.target.closest('[data-pregnancy-dating]'))return;const f=draft(),name=event.target.name;if(['source','mode','lmp','edd','cycle','reliable','regular','zone'].includes(name)){f[name]=event.target.value;f.dirty=true;}});
  document.addEventListener('change',event=>{if(S.route!=='gs-pregnancy'||!event.target.closest('[data-pregnancy-dating]'))return;if(['source','mode'].includes(event.target.name)){draft()[event.target.name]=event.target.value;draft().dirty=true;refresh();}});
  document.addEventListener('click',async event=>{if(S.route!=='gs-pregnancy')return;const b=event.target.closest('button');if(!b||b.disabled)return;reset();if(state.busy)return;const current=state,ticket=generation,action=b.dataset.pregnancyAction;
    try{
      const picked=b.dataset.pregnancyWeek;if(picked!==undefined){const week=Number(picked);if(W.get(week)){state.referenceWeek=week;refresh();}return;}
      if(action==='weeks'){const d=state.data?.dating,age=d?P.progress(d,M.today(d.time_zone)):null;state.referenceWeek=age?.available&&W.get(age.weeks)?age.weeks:4;state.weekView=true;refresh();return;}
      if(action==='weeks-back'||(action==='back'&&state.weekView)){state.weekView=false;refresh();return;}
      if(action==='previous-week'||action==='next-week'){const week=state.referenceWeek+(action==='next-week'?1:-1);if(W.get(week)){state.referenceWeek=week;refresh();}return;}
      if(action==='back'){if((state.draft?.dirty||Daily.dirty()||Appointments.dirty()||Reminders.dirty())&&!confirm('Leave your unsaved pregnancy tracking changes?'))return;return nav('gs-tools');}
      if(action==='edit'){if(API.unresolved())return;draft();refresh();return;}
      if(action==='cancel-edit'){state.draft=null;refresh();return;}
      if(action==='reload'){if(state.draft?.dirty&&!confirm('Discard unsaved changes and reload?'))return;state.draft=null;await load();return;}
      if(action==='retry'){state.busy=true;state.error='';state.notice='Confirming…';refresh();await API.retry();await confirmWrite(current,ticket);return;}
      if(action==='delete'){if(API.unresolved())return;if(!confirm('Permanently delete your saved pregnancy dating record?'))return;state.busy=true;state.error='';state.notice='Deleting privately…';refresh();await API.mutate({p_operation:'clear_dating',p_data_epoch:state.data.data_epoch,p_expected_revision:state.data.revision,p_confirm_delete:true});await confirmWrite(current,ticket);}
    }catch(error){if(same(current,ticket)){state.error=failure(error);state.notice='';}}finally{if(same(current,ticket)){state.busy=false;refresh();}}
  });
  document.addEventListener('submit',async event=>{const form=event.target.closest('[data-pregnancy-dating]');if(!form||S.route!=='gs-pregnancy')return;event.preventDefault();reset();if(state.busy||!state.data||API.unresolved())return;const current=state,ticket=generation;
    try{
      const f=draft();for(const name of ['source','mode','lmp','edd','cycle','reliable','regular','zone'])if(form.elements[name])f[name]=form.elements[name].value;
      if(!form.elements.consent.checked||!form.elements.tracking.checked)throw new Error('Confirm tracking and saving privately to your account.');
      const flag=value=>value===''?null:String(value)==='true',length=f.cycle===''?null:Number(f.cycle);
      const chosen=P.dating({source:f.source,mode:f.mode,lmp:f.source==='lmp'?f.lmp:null,clinicianEdd:f.source==='clinician_edd'?f.edd:null,cycleLength:f.source==='lmp'?length:null,reliable:f.source==='lmp'?flag(f.reliable):null,regular:f.source==='lmp'?flag(f.regular):null},M.today(f.zone.trim()));
      const old=state.data.dating;
      if(old&&!confirm(`Replace saved dating?\nCurrent: ${provenance(old)} — ${date(old.selected_edd)}\nNew: ${chosen.status} — ${date(chosen.selected_edd)}`))return;
      const clinicianReplacement=!!old&&old.dating_source==='clinician_edd'&&chosen.dating_source==='lmp';
      if(clinicianReplacement&&!confirm('Your clinician-provided date has priority. Explicitly replace it with this preliminary LMP estimate?'))return;
      state.busy=true;state.error='';state.notice='Saving privately…';refresh();
      await API.mutate({p_operation:'save_dating',p_data_epoch:state.data.data_epoch,p_expected_revision:state.data.revision,p_dating_source:chosen.dating_source,p_tracking_mode:chosen.tracking_mode,p_lmp:chosen.lmp,p_clinician_edd:chosen.dating_source==='clinician_edd'?chosen.selected_edd:null,p_cycle_length:chosen.cycle_length,p_lmp_reliable:chosen.lmp_reliable,p_cycles_regular:chosen.cycles_regular,p_time_zone:f.zone.trim(),p_confirm_private_save:true,p_confirm_tracking:true,p_confirm_replace:!!old,p_confirm_clinician_replacement:clinicianReplacement});
      await confirmWrite(current,ticket);
    }catch(error){if(same(current,ticket)){const local=['Confirm tracking and saving privately to your account.','Select a supported dating source.','Enter the due date provided by your clinician.','Use one dating source at a time.','Use the due date provided by your fertility clinician.','Use a clinician-provided due date when LMP is unreliable or cycles are variable.','An actual LMP cannot be in the future.','Cycle adjustment requires explicitly regular cycles and a 21–35 day entered length.','Confirm cycle regularity or leave it unspecified.','Enter a valid calendar date.'];state.error=local.includes(error?.message)?error.message:failure(error);state.notice='';}}
    finally{if(same(current,ticket)){state.busy=false;refresh();}}
  });
  return {reset,renderPage};
})();
window.herdayPregnancyTracker=herdayPregnancyTracker;
