/* Shared Cycle illustration and voluntary private observations; no inferred biology. */
const herdayOvulationTracker=(()=>{
  const M=herdayPeriodModel;
  let owner=null,generation=0,state=null;
  function blank(){const zone=Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC',today=M.today(zone);return {zone,selected:today,month:today.slice(0,7),data:null,loading:false,error:'',loaded:false,daily:null,dailyLoading:false,dailyTicket:0,drafts:new Map(),busy:false,notice:''};}
  function reset(){const next=currentUser()?.id||null;if(next!==owner){owner=next;generation++;state=blank();}}
  function refresh(){if(S.route==='gs-ovulation'){render();herdayGirlsSocial.reserveNavigation();}}
  async function load(){if(state.loading)return;const current=state,ticket=generation;state.loading=true;state.error='';
    try{const data=await herdayPeriodService.cycle();if(ticket!==generation||state!==current)return;state.data=data;
      if(data.preferences?.time_zone){state.zone=data.preferences.time_zone;if(!state.loaded){state.selected=M.today(state.zone);state.month=state.selected.slice(0,7);}}state.loaded=true;await loadDaily();
    }catch{if(ticket===generation&&state===current)state.error='Your private cycle data could not be loaded. Please retry.';}
    finally{if(ticket===generation&&state===current){state.loading=false;refresh();}}
  }
  function date(value){return value?new Intl.DateTimeFormat('en',{timeZone:'UTC',month:'short',day:'numeric',year:'numeric'}).format(new Date(M.ordinal(value)*86400000)):'Unavailable';}
  function button(action,label){return `<button class="section-secondary" type="button" data-ovulation-action="${action}" ${state.busy?'disabled':''}>${label}</button>`;}
  function draft(){if(!state.drafts.has(state.selected)){const row=state.daily?.logs[0];state.drafts.set(state.selected,{id:row?.id||null,revision:row?.revision||0,mucus:row?.cervical_mucus??null,temperature:row?.basal_temperature_c==null?'':String(row.basal_temperature_c),notes:row?.notes||'',zone:state.zone,dirty:false});}return state.drafts.get(state.selected);}
  function unsaved(){return [...state.drafts.values()].some(d=>d.dirty);}
  async function loadDaily(){const current=state,ticket=generation,request=++state.dailyTicket,selected=state.selected;state.dailyLoading=true;
    try{const data=await herdayPeriodService.daily(selected);if(ticket!==generation||state!==current||request!==state.dailyTicket)return;state.daily=data;if(!state.drafts.get(selected)?.dirty)state.drafts.delete(selected);}
    catch{if(ticket===generation&&state===current&&request===state.dailyTicket){state.daily=null;state.error='Your private Daily Log could not be loaded. Retry before making changes.';}}
    finally{if(ticket===generation&&state===current&&request===state.dailyTicket){state.dailyLoading=false;refresh();}}
  }
  function dailyForm(){
    const heading=`<h2>Daily Log <small>${esc(date(state.selected))}</small></h2>`;
    if(state.dailyLoading||!state.daily)return heading+`<section class="section-card period-panel"><p>${state.dailyLoading?'Loading your private observations…':'Daily Log unavailable.'}</p>${!state.dailyLoading?button('retry-daily','Try again'):''}</section>`;
    const d=draft(),choices=[['dry','Dry'],['sticky','Sticky'],['creamy','Creamy'],['watery','Watery'],['egg_white','Egg White']],locked=state.busy||!!herdayPeriodService.unresolved('daily');
    return heading+`<form data-ovulation-form class="section-card period-panel"><fieldset ${locked?'disabled':''}><legend class="gs-visually-hidden">Private Daily Observations</legend><h3>Cervical Mucus</h3><div class="period-chips period-mucus">${choices.map(([value,label])=>`<button type="button" data-ovulation-mucus="${value}" aria-pressed="${d.mucus===value}">${label}</button>`).join('')}</div><label>Basal Temperature (°C, optional)<input name="temperature" type="text" inputmode="decimal" value="${esc(d.temperature)}" placeholder="Enter your measured temperature" autocomplete="off"></label><label>Notes<textarea name="notes" maxlength="4000" placeholder="Add a private note about this day...">${esc(d.notes)}</textarea><small>Up to 2,000 characters. Notes are shared with this date’s Period Daily Log.</small></label><label>Time zone<input name="zone" value="${esc(d.zone)}" required autocomplete="off"><small>Confirm the zone used to validate this date.</small></label><label class="period-consent"><input name="consent" type="checkbox" required> Save this information privately to my account.</label><button type="submit" class="section-primary">Save Daily Log</button>${d.id?button('delete-daily','Delete this Daily Log'):''}<small>Observations are not used to confirm ovulation or fertile dates.</small></fieldset></form>`;
  }
  function renderPage(){reset();if(!state)state=blank();if(!state.loaded&&!state.loading&&!state.error)setTimeout(load,0);
    const header=herdayPageHeader({className:'gs-header',title:'Ovulation & Fertile Window',subtitle:'Understand your estimated fertile days.',button:`<button type="button" data-ovulation-action="back" aria-label="Back"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 12H4m7-8-8 8 8 8"/></svg></button>`});
    const safety='<section class="section-card period-health"><h3>Health Information</h3><p>Fertile dates are estimates. Ovulation can vary. Do not use this calculator alone to prevent pregnancy.</p><p>This illustration does not guarantee pregnancy, fertile dates or infertile dates. It is not a method of contraception. For medical or reproductive-health concerns, consult a qualified healthcare professional.</p></section>';
    if(!state.data)return header+`<div class="section-body period-content"><p role="${state.error?'alert':'status'}">${state.error?esc(state.error):'Loading your private cycle information…'}</p>${state.error?button('reload','Try again'):''}${safety}</div>`;
    const pending=herdayPeriodService.unresolved('daily');
    const status=`${state.notice?`<p class="period-status" role="status">${esc(state.notice)}</p>`:''}${pending?button('retry-daily','Confirm / retry previous Daily Log request'):''}`;
    const data=state.data,today=M.today(state.zone),model=M.ovulation(data.entries,data.preferences,today,{overlaps:data.has_overlapping_records,incomplete:data.has_more}),p=model.period;
    const range=model.available?`${date(model.windowStart)} – ${date(model.windowEnd)}`:'Unavailable';
    const inside=model.available&&today>=model.windowStart&&today<=model.windowEnd;
    const todayText=model.available?inside?'Today falls within the illustrative estimated window. Actual fertile days may differ.':'This is a calendar illustration; actual ovulation and fertile days may differ.':model.label;
    const latest=p.latest,rows=[['Recorded period',latest?date(latest.start_date)+(latest.end_date?' – '+date(latest.end_date):' · end not recorded'):'Not recorded'],['Illustrative estimated window',range],['Approximate ovulation',model.available?date(model.ovulationDate):'Unavailable'],['Next period — estimated',p.nextStart?date(p.nextStart)+(p.elapsed?' · elapsed, unconfirmed':''):'Unavailable']];
    return header+`<div class="section-body period-content ovulation-content">${status}${state.error?`<p role="alert">${esc(state.error)}</p>`:''}<section class="section-card period-summary"><div><small>Illustrative Estimated Window</small><strong>${esc(range)}</strong><small>Estimated</small></div><div><small>Approximate Ovulation</small><strong>${esc(model.available?date(model.ovulationDate):'Unavailable')}</strong></div><div><small>Cycle Day</small><span>${p.cycleDay??'Not available'}</span></div><div><small>Next Period — Estimated</small><span>${esc(p.nextStart?date(p.nextStart)+(p.elapsed?' · elapsed, unconfirmed':''):'Unavailable')}</span></div></section><p class="period-model-label">${esc(model.label)}</p>${herdayCycleCalendar.render({month:state.month,selected:state.selected,entries:data.entries,period:p,ovulation:model,prefix:'ovulation',heading:'Fertility Calendar',disabled:state.busy||state.dailyLoading||!!pending})}<h2>Today</h2><section class="section-card period-panel"><p>${esc(todayText)}</p>${model.available?`<p>Approximate ovulation: ${esc(date(model.ovulationDate))}. Ovulation may occur earlier or later.</p>`:''}</section><h2>This Cycle</h2><section class="section-card ovulation-timeline">${rows.map(([label,value])=>`<div><strong>${esc(label)}</strong><span>${esc(value)}</span></div>`).join('')}</section>${dailyForm()}<h2>Cycle Insights</h2><div class="period-insights"><section class="section-card"><small>Recorded cycle median</small><strong>${p.intervals.length?M.median(p.intervals)+' days':'Not available'}</strong></section><section class="section-card"><small>Illustrative window</small><strong>${model.available?'7 calendar days':'Unavailable'}</strong></section><section class="section-card"><small>Completed intervals</small><strong>${p.completedIntervals}${data.has_more?'+':''}</strong></section></div><section class="section-card ovulation-period-link">${button('period','Period Tracker ›')}<p>View or update your cycle dates and preferences.</p></section>${safety}<footer class="period-private"><strong>Private to you</strong><p>Your cycle tracking information is private to your account.</p>${button('reload','Refresh Cycle Data')}</footer></div>`;
  }
  function guard(current,ticket){reset();return state===current&&generation===ticket;}
  function failure(error){return ['22023','40001','42501'].includes(error?.code)?error.message:'The result could not be confirmed. Check your connection and retry the same request.';}
  async function confirmWrite(current,ticket){
    await loadDaily();if(!guard(current,ticket))return false;
    if(!state.daily||state.error)throw new Error('Read confirmation unavailable.');
    herdayPeriodService.release('daily');state.drafts.delete(state.selected);
    state.notice='Request confirmed. Current Daily Log refreshed.';return true;
  }
  document.addEventListener('click',async event=>{if(S.route!=='gs-ovulation')return;const b=event.target.closest('button');if(!b||b.disabled)return;reset();if(state.busy)return;
    const current=state,ticket=generation;
    if(herdayPeriodService.unresolved('daily')&&(b.dataset.ovulationMucus||b.dataset.ovulationDate||b.dataset.ovulationAction==='delete-daily'))return;
    try{
      if(b.dataset.ovulationDate){if(unsaved()&&!confirm('Leave your unsaved changes?'))return;state.selected=b.dataset.ovulationDate;state.daily=null;state.error='';await loadDaily();return;}
      if(b.dataset.ovulationMucus){const d=draft();d.mucus=d.mucus===b.dataset.ovulationMucus?null:b.dataset.ovulationMucus;d.dirty=true;refresh();return;}
      const action=b.dataset.ovulationAction;
      if(action==='back'||action==='period'){if(unsaved()&&!confirm('Leave your unsaved changes?'))return;if(action==='period'){herdayPeriodTracker.revalidate();return nav('gs-period');}return nav('gs-tools');}
      if(action==='reload'){if(unsaved()&&!confirm('Discard unsaved changes and reload?'))return;state.drafts.clear();await load();return;}
      if(action==='previous-month'||action==='next-month'){state.month=herdayCycleCalendar.shift(state.month,action==='next-month'?1:-1);refresh();return;}
      if(action==='retry-daily'&&!herdayPeriodService.unresolved('daily')){state.error='';await loadDaily();return;}
      if(action==='retry-daily'){state.busy=true;state.error='';state.notice='Confirming previous request…';refresh();await herdayPeriodService.retry('daily');await confirmWrite(current,ticket);return;}
      if(action==='delete-daily'){const d=draft();if(!confirm('Delete all entries for this date, including Flow, Symptoms, Mood, observations and shared Notes?'))return;
        state.busy=true;state.error='';state.notice='Deleting privately…';refresh();
        await herdayPeriodService.mutate('daily',{p_operation:'delete_log',p_data_epoch:state.daily.data_epoch,p_log_id:d.id,p_expected_revision:d.revision,p_confirm_delete:true});await confirmWrite(current,ticket);
      }
    }catch(error){if(guard(current,ticket)){state.error=failure(error);state.notice='';}}
    finally{if(guard(current,ticket)){state.busy=false;refresh();}}
  });
  document.addEventListener('input',event=>{if(S.route!=='gs-ovulation'||!event.target.closest('[data-ovulation-form]'))return;const name=event.target.name;if(['temperature','notes','zone'].includes(name)){draft()[name]=event.target.value;draft().dirty=true;}});
  document.addEventListener('submit',async event=>{const form=event.target.closest('[data-ovulation-form]');if(!form||S.route!=='gs-ovulation')return;event.preventDefault();reset();if(state.busy||!state.daily||herdayPeriodService.unresolved('daily'))return;
    const current=state,ticket=generation;
    try{
      const d=draft(),raw=form.elements.temperature.value.trim(),notes=form.elements.notes.value.trim(),zone=form.elements.zone.value.trim();
      if(!form.elements.consent.checked)throw new Error('Confirm saving privately to your account.');
      if(raw&&(!/^[+-]?(?:[0-9]+(?:[.][0-9]*)?|[.][0-9]+)$/.test(raw)||!Number.isFinite(Number(raw))))throw new Error('Enter a finite decimal temperature in °C, or leave it blank.');
      if([...notes].length>2000)throw new Error('Enter no more than 2,000 note characters.');
      if(state.selected>M.today(zone))throw new Error('Actual observations cannot be dated in the future.');
      const base=state.daily.logs[0];
      if(!d.mucus&&!raw&&!notes&&(!base||(base.flow===null&&base.mood===null&&!base.symptoms.length)))throw new Error('Select an observation or add a note. Use Delete to remove an empty existing log.');
      d.temperature=raw;d.notes=form.elements.notes.value;d.zone=zone;
      state.busy=true;state.error='';state.notice='Saving privately…';refresh();
      await herdayPeriodService.mutate('daily',{p_operation:'save_log',p_data_epoch:state.daily.data_epoch,p_log_id:d.id,p_expected_revision:d.revision,p_log_date:state.selected,p_cervical_mucus:d.mucus,p_basal_temperature_c:raw?Number(raw):null,p_notes:notes,p_time_zone:zone,p_confirm_private_save:true});
      await confirmWrite(current,ticket);
    }catch(error){if(guard(current,ticket)){const messages=['Confirm saving privately to your account.','Enter a finite decimal temperature in °C, or leave it blank.','Enter no more than 2,000 note characters.','Actual observations cannot be dated in the future.','Select an observation or add a note. Use Delete to remove an empty existing log.'];state.error=messages.includes(error?.message)?error.message:failure(error);state.notice='';}}
    finally{if(guard(current,ticket)){state.busy=false;refresh();}}
  });
  function revalidate(){reset();if(!state)state=blank();generation++;state.loading=false;state.dailyLoading=false;state.dailyTicket++;state.loaded=false;state.data=null;state.daily=null;state.error='';}
  return {renderPage,reset,revalidate};
})();
window.herdayOvulationTracker=herdayOvulationTracker;
