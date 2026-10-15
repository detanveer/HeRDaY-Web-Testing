/* Approved Period page family. All health values/drafts stay outside S/localStorage. */
const herdayPeriodTracker=(()=>{
  const M=herdayPeriodModel,API=herdayPeriodService;
  const flows=['none','light','medium','heavy'],symptoms=['cramps','headache','bloating','backache','fatigue','acne'],moods=['great','good','okay','low','irritable'];
  let owner=null,ticket=0,st;
  function blank(){const zone=Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC',today=M.today(zone);return {zone,selected:today,month:today.slice(0,7),cycle:null,daily:null,loaded:false,loading:false,error:'',notice:'',busy:false,dailyLoading:false,dailyTicket:0,drafts:new Map(),periodForm:null,prefForm:null,history:false,clearPlan:null};}
  function reset(){API.reset();const next=currentUser()?.id||null;if(owner!==next){owner=next;ticket++;st=blank();}}
  function refresh(){if(S.route==='gs-period'){render();herdayGirlsSocial.reserveNavigation();}}
  function title(value){return value[0].toUpperCase()+value.slice(1);}
  function display(date,withYear=false){return new Intl.DateTimeFormat('en',{timeZone:'UTC',month:'short',day:'numeric',...(withYear?{year:'numeric'}:{})}).format(new Date(M.ordinal(date)*86400000));}
  function notify(message){st.notice=message;refresh();}
  function safeError(error){return ['40001','22023','42501'].includes(error?.code)?error.message:error?.message==='Your session changed. Reopen the tracker.'?error.message:'Could not confirm the request. Check your connection and retry.';}
  function draft(){if(!st.drafts.has(st.selected)){const row=st.daily?.logs[0];st.drafts.set(st.selected,{id:row?.id||null,revision:row?.revision||0,flow:row?.flow??null,symptoms:[...(row?.symptoms||[])],mood:row?.mood??null,notes:row?.notes||'',zone:st.zone,dirty:false});}return st.drafts.get(st.selected);}
  function hasDraft(){return [...st.drafts.values()].some(d=>d.dirty)||!!st.periodForm?.dirty||!!st.prefForm?.dirty;}
  async function loadDaily(){const current=st,selected=st.selected,request=++st.dailyTicket,identity=ticket;st.dailyLoading=true;
    try{const data=await API.daily(selected);if(identity!==ticket||st!==current||request!==st.dailyTicket)return;st.daily=data;if(!st.drafts.get(selected)?.dirty)st.drafts.delete(selected);}
    catch(error){if(identity===ticket&&st===current&&request===st.dailyTicket){st.error=safeError(error);st.daily=null;}}
    finally{if(identity===ticket&&st===current&&request===st.dailyTicket){st.dailyLoading=false;refresh();}}
  }
  async function load(){if(st.loading)return;const current=st,identity=ticket;st.loading=true;st.error='';
    try{const data=await API.cycle();if(identity!==ticket||st!==current)return;
      st.cycle=data;if(!st.loaded&&data.preferences?.time_zone){st.zone=data.preferences.time_zone;st.selected=M.today(st.zone);st.month=st.selected.slice(0,7);}st.loaded=true;
      await loadDaily();
    }catch(error){if(identity===ticket&&st===current)st.error=safeError(error);}
    finally{if(identity===ticket&&st===current){st.loading=false;refresh();}}
  }
  function button(action,label,extra=''){return `<button type="button" class="section-secondary" data-period-action="${action}" ${st.busy?'disabled':''} ${extra}>${label}</button>`;}
  function consent(){return '<label class="period-consent"><input type="checkbox" name="consent" required> Save this information privately to my account.</label>';}
  function timezone(zone=st.zone){return `<label>Time zone <input name="zone" value="${esc(zone)}" required autocomplete="off"><small>Confirm the zone used to validate this date.</small></label>`;}
  function calendar(model){return herdayCycleCalendar.render({month:st.month,selected:st.selected,entries:st.cycle.entries,period:model,disabled:st.busy||!!st.clearPlan||st.dailyLoading||!!API.unresolved('daily')});}
  function chips(name,values,selected){return `<div class="period-chips period-${name}">${values.map(value=>`<button type="button" data-period-chip="${name}" data-value="${value}" aria-pressed="${Array.isArray(selected)?selected.includes(value):selected===value}">${title(value)}</button>`).join('')}</div>`;}
  function dailyMarkup(){
    const locked=st.busy||!!st.clearPlan||!!API.unresolved('daily'),ready=st.daily!==null&&!st.dailyLoading;
    if(!ready)return `<h2>Daily Log <small>${esc(display(st.selected))}</small></h2><section class="section-card period-panel"><p>${st.dailyLoading?'Loading your private log…':'Daily Log could not be loaded.'}</p>${button('retry-daily','Try again')}</section>`;
    const d=draft();
    return `<h2>Daily Log <small>${esc(display(st.selected))}</small></h2><form data-period-form="daily" class="section-card period-panel"><fieldset ${locked?'disabled':''}><legend class="gs-visually-hidden">Private Daily Log</legend><h3>Flow</h3>${chips('flow',flows,d.flow)}<h3>Symptoms</h3>${chips('symptoms',symptoms,d.symptoms)}<h3>Mood</h3>${chips('mood',moods,d.mood)}<label>Notes<textarea name="notes" maxlength="4000" placeholder="Add a private note about this day...">${esc(d.notes)}</textarea><small>Up to 2,000 characters.</small></label>${timezone(d.zone)}${consent()}<button class="section-primary" type="submit">Save Daily Log</button>${d.id?button('delete-daily','Delete this Daily Log'):''}</fieldset></form>`;
  }
  function periodForm(){const f=st.periodForm;if(!f)return '';const locked=st.busy||!!st.clearPlan||!!API.unresolved('cycle');
    return `<form data-period-form="period" class="section-card period-panel"><h3>${f.id?'Edit Period':'Log Period'}</h3><fieldset ${locked?'disabled':''}><label>First day of period bleeding<input type="date" name="start" value="${esc(f.start)}" max="${M.today(st.zone)}" required></label><label>Last day of bleeding (optional)<input type="date" name="end" value="${esc(f.end)}" max="${M.today(st.zone)}"></label><small>A missing end date does not confirm ongoing bleeding. Spotting is not automatically a new period.</small>${timezone(f.zone||st.zone)}${consent()}<button class="section-primary" type="submit">Save Period</button>${button('cancel-period','Cancel')}${f.id?button('delete-period','Delete this Period'):''}</fieldset></form>`;
  }
  function preferenceForm(){const f=st.prefForm;if(!f)return '';const locked=st.busy||!!st.clearPlan||!!API.unresolved('cycle');
    const select=(key,label)=>`<label>${label}<select name="${key}">${[['','Not specified'],['false','No'],['true','Yes']].map(([value,text])=>`<option value="${value}" ${String(f[key]??'')===value?'selected':''}>${text}</option>`).join('')}</select></label>`;
    return `<form data-period-form="preferences" class="section-card period-panel"><h3>Cycle Preferences</h3><fieldset ${locked?'disabled':''}><label>Usual cycle length (days, optional)<input name="cycle" type="number" min="1" step="1" value="${esc(f.cycle)}"></label><label>Usual bleeding duration (days, optional)<input name="duration" type="number" min="1" step="1" value="${esc(f.duration)}"></label><small>Blank values use visibly labelled assumptions for estimates. Entered values are retained even outside the calendar model’s support.</small>${timezone(f.zone||st.zone)}${select('contraception','Do you use hormonal contraception?')}${select('circumstance','Do you have a known circumstance affecting ovulation?')}${select('irregular','Do you report irregular cycles?')}${consent()}<button class="section-primary" type="submit">Save Preferences</button>${button('cancel-preferences','Cancel')}${st.cycle.preferences?button('delete-preferences','Delete Preferences'):''}</fieldset></form>`;
  }
  function history(){const entries=st.history?st.cycle.entries:st.cycle.entries.slice(0,3);
    return `<h2>Period History ${button('history',st.history?'Show Less':'View History')}</h2><section class="section-card period-history">${entries.length?entries.map(e=>`<div><button type="button" data-period-edit="${esc(e.id)}" ${st.busy||API.unresolved('cycle')?'disabled':''}>${esc(display(e.start_date,true))}${e.end_date?' – '+esc(display(e.end_date,true)):''}</button><small>${e.end_date?M.ordinal(e.end_date)-M.ordinal(e.start_date)+1+' days':'End not recorded'}</small></div>`).join(''):'<p>No periods recorded yet.</p>'}${button('new-period','Log / Edit Period')}${st.history&&st.cycle.has_more?button('more-history','Load More'):''}</section>${periodForm()}`;
  }
  function renderPage(){reset();if(!st)st=blank();if(!st.loaded&&!st.loading&&!st.error)setTimeout(load,0);
    const header='<header class="gs-header"><button type="button" data-period-action="back" aria-label="Back">‹</button><h1>Period Tracker</h1><p>Understand and track your cycle.</p></header>';
    const pending=['cycle','daily'].filter(domain=>API.unresolved(domain));
    const status=`${st.error?`<p role="alert" class="period-status">${esc(st.error)}</p>`:''}${st.notice?`<p role="status" class="period-status">${esc(st.notice)}</p>`:''}${st.error&&!pending.length&&!st.clearPlan?button('reload','Reload tracker'):''}${pending.map(domain=>button('retry-'+domain,'Confirm / retry previous '+(domain==='cycle'?'period':'Daily Log')+' request')).join('')}`;
    if(!st.cycle)return header+`<div class="section-body">${status}<p>${!st.error?'Loading your private tracker…':'Your tracker could not be loaded.'}</p>${st.error?button('reload','Try again'):''}</div>`;
    const model=M.derive(st.cycle.entries,st.cycle.preferences,M.today(st.zone),{overlaps:st.cycle.has_overlapping_records,incomplete:st.cycle.has_more});
    const completed=st.cycle.entries.filter(e=>e.end_date!==null).slice(0,6),actualMean=completed.length?Math.round(completed.reduce((n,e)=>n+M.ordinal(e.end_date)-M.ordinal(e.start_date)+1,0)/completed.length):null;
    const estimate=model.nextStart?model.elapsed?`Estimate elapsed ${Math.abs(model.remaining)} days ago — unconfirmed`:model.remaining===0?'Estimated for today':`Next period in ${model.remaining} days`:'Calendar estimate unavailable';
    return header+`<div class="section-body period-content">${status}<section class="section-card period-summary"><div><small>CURRENT CYCLE</small><strong>${model.cycleDay!==null?'Cycle Day '+model.cycleDay:'No start recorded'}</strong></div><div><small>${esc(estimate)}</small>${model.nextStart?`<strong>${esc(display(model.nextStart,true))}</strong><small>Estimated</small>`:''}</div><div><small>Last period</small><span>${model.latest?esc(display(model.latest.start_date,true))+(model.latest.end_date?' – '+esc(display(model.latest.end_date,true)):' · end not recorded'):'Not recorded'}</span></div><div><small>Estimated cycle length</small><span>${model.estimateLength!==null?model.estimateLength+' days':'Unavailable'}</span></div></section><p class="period-model-label">${esc(model.label)}${model.nextStart&&!model.nextEnd?' Estimated bleeding end unavailable.':''}${model.nextEnd?` Estimated end: ${esc(display(model.nextEnd,true))} (${model.bleedingSource==='assumed'?'assumes 5 days':'uses your entered duration'}).`:''}</p><div class="period-preference-link">${button('preferences','Cycle Preferences')}</div>${preferenceForm()}${calendar(model)}${dailyMarkup()}<h2>Cycle Insights</h2><div class="period-insights"><section class="section-card"><small>Recorded cycle median</small><strong>${model.intervals.length?M.median(model.intervals)+' days':'Not available'}</strong></section><section class="section-card"><small>Average recorded period</small><strong>${actualMean!==null?actualMean+' days':'Not available'}</strong></section><section class="section-card"><small>Completed intervals</small><strong>${model.completedIntervals}${st.cycle.has_more?'+':''}</strong></section></div>${history()}<section class="section-card ovulation-period-link">${button('ovulation','Ovulation &amp; Fertile Window ›')}<p>View your approximate calendar illustration.</p></section><section class="section-card period-health"><h3>Health Information</h3><p>Cycle predictions are estimates based on your logged information. Cycles can vary. This tool is for personal tracking and general wellbeing information and is not a substitute for professional medical advice, diagnosis or treatment.</p><p>Calendar support ranges are HerDay product rules, not diagnostic limits. An elapsed estimate does not confirm pregnancy.</p></section><footer class="period-private"><strong>Private to you</strong><p>Your cycle tracking information is private to your account.</p>${button('clear-all',st.clearPlan?'Confirm / retry deletion':'Delete All Period Tracking Data')}</footer></div>`;
  }
  async function reloadAfter(domain){const identity=ticket,current=st;await load();if(identity!==ticket||st!==current)throw new Error('Your session changed. Reopen the tracker.');if(st.error)throw new Error('Reload could not be confirmed.');API.release(domain);st.drafts.clear();st.periodForm=null;st.prefForm=null;}
  async function run(domain,args){await API.mutate(domain,args);await reloadAfter(domain);notify('Request confirmed. Current records refreshed.');}
  async function clearAll(){
    const identity=ticket,current=st;
    if(!st.clearPlan){if(!confirm('Permanently delete your period records, preferences and Daily Logs?'))return;
      st.clearPlan={cycle:{p_operation:'clear_cycle_data',p_data_epoch:st.cycle.data_epoch,p_confirm_delete:true},daily:{p_operation:'clear_daily_logs',p_data_epoch:st.daily.data_epoch,p_confirm_delete:true}};}
    const plan=st.clearPlan;
    await API.mutate('cycle',plan.cycle);await API.mutate('daily',plan.daily);
    await load();if(identity!==ticket||st!==current)throw new Error('Your session changed. Reopen the tracker.');if(st.error)throw new Error('Deletion could not be reread.');API.release('cycle');API.release('daily');st.clearPlan=null;st.drafts.clear();st.periodForm=null;st.prefForm=null;notify('Period and Daily Log deletion requests confirmed. Current records refreshed.');
  }
  async function click(event){if(S.route!=='gs-period')return;const b=event.target.closest('button');if(!b||b.disabled)return;reset();if(st.busy)return;const identity=ticket,current=st;
    if(st.clearPlan&&!['back','clear-all','retry-cycle','retry-daily'].includes(b.dataset.periodAction))return;
    try{
      if(b.dataset.periodDate){if(hasDraft()&&!confirm('Leave your unsaved changes?'))return;st.selected=b.dataset.periodDate;st.daily=null;st.error='';await loadDaily();return;}
      if(b.dataset.periodChip){const d=draft(),key=b.dataset.periodChip,value=b.dataset.value;if(key==='symptoms')d.symptoms=d.symptoms.includes(value)?d.symptoms.filter(x=>x!==value):symptoms.filter(x=>x===value||d.symptoms.includes(x));else d[key]=d[key]===value?null:value;d.dirty=true;refresh();return;}
      if(b.dataset.periodEdit){if(API.unresolved('cycle'))return;const e=st.cycle.entries.find(e=>e.id===b.dataset.periodEdit);st.periodForm={id:e.id,revision:e.revision,start:e.start_date,end:e.end_date||'',dirty:false};refresh();document.querySelector('[data-period-form=period]')?.scrollIntoView({block:'center'});return;}
      const action=b.dataset.periodAction;if(!action)return;
      if(action==='back'){if(hasDraft()&&!confirm('Leave your unsaved changes?'))return;return nav('gs-tools');}
      if(action==='previous-month'||action==='next-month'){const y=Number(st.month.slice(0,4)),m=Number(st.month.slice(5)),n=y*12+m-1+(action==='next-month'?1:-1),year=Math.floor(n/12);if(year<1||year>9999)return;st.month=`${String(year).padStart(4,'0')}-${String(n%12+1).padStart(2,'0')}`;refresh();return;}
      if(action==='ovulation'){if(hasDraft()&&!confirm('Leave your unsaved changes?'))return;herdayOvulationTracker.revalidate();return nav('gs-ovulation');}
      if(action==='history'){st.history=!st.history;refresh();return;}
      if(action==='new-period'){if(API.unresolved('cycle'))return;st.periodForm={id:null,revision:0,start:st.selected,end:'',dirty:false};refresh();return;}
      if(action==='cancel-period'){st.periodForm=null;refresh();return;}
      if(action==='cancel-preferences'){st.prefForm=null;refresh();return;}
      if(action==='preferences'){if(API.unresolved('cycle'))return;const p=st.cycle.preferences;st.prefForm={cycle:p?.cycle_length??'',duration:p?.bleeding_duration??'',contraception:p?.uses_hormonal_contraception??'',circumstance:p?.has_ovulation_affecting_circumstance??'',irregular:p?.reports_irregular_cycles??'',dirty:false};refresh();return;}
      if(action==='reload'){if(hasDraft()&&!confirm('Discard unsaved changes and reload?'))return;st.drafts.clear();st.periodForm=null;st.prefForm=null;await load();return;}
      if(action==='retry-daily'&&!API.unresolved('daily')){await loadDaily();return;}
      st.busy=true;st.error='';st.notice='Confirming…';refresh();
      if(st.clearPlan){await clearAll();return;}
      if(action==='retry-cycle'||action==='retry-daily'){const domain=action==='retry-cycle'?'cycle':'daily';await API.retry(domain);await reloadAfter(domain);notify('Previous request confirmed.');return;}
      if(action==='delete-daily'){const d=draft();if(!confirm('Delete this private Daily Log?'))return;await run('daily',{p_operation:'delete_log',p_data_epoch:st.daily.data_epoch,p_log_id:d.id,p_expected_revision:d.revision,p_confirm_delete:true});}
      if(action==='delete-period'){const f=st.periodForm;if(!confirm('Delete this actual period record?'))return;await run('cycle',{p_operation:'delete_period',p_data_epoch:st.cycle.data_epoch,p_entry_id:f.id,p_expected_revision:f.revision,p_confirm_delete:true});}
      if(action==='delete-preferences'){if(!confirm('Delete your cycle preferences? Actual period records and Daily Logs will remain.'))return;await run('cycle',{p_operation:'delete_preferences',p_data_epoch:st.cycle.data_epoch,p_expected_revision:st.cycle.preferences_revision,p_confirm_delete:true});}
      if(action==='clear-all'){if(!st.daily)throw new Error('Daily Log data must be reloaded before deletion.');await clearAll();}
      if(action==='more-history'){const last=st.cycle.entries.at(-1),page=await API.cycle({cursor:last});if(page.data_epoch!==st.cycle.data_epoch||page.preferences_revision!==st.cycle.preferences_revision)throw new Error('History changed; reload the tracker.');st.cycle.entries.push(...page.entries.filter(e=>!st.cycle.entries.some(old=>old.id===e.id)));st.cycle.has_more=page.has_more;}
    }catch(error){if(identity===ticket&&st===current){st.error=safeError(error);st.notice='';}}finally{if(identity===ticket&&st===current){st.busy=false;refresh();}}
  }
  async function submit(event){const form=event.target.closest('[data-period-form]');if(!form||S.route!=='gs-period')return;event.preventDefault();if(st.busy||st.clearPlan)return;reset();const type=form.dataset.periodForm,domain=type==='daily'?'daily':'cycle',identity=ticket,current=st;
    try{
      if(!form.elements.consent.checked)throw new Error('Private save confirmation required.');
      const zone=form.elements.zone.value.trim(),today=M.today(zone);let args;
      if(type==='daily'){const d=draft();d.notes=form.elements.notes.value;if([...d.notes.trim()].length>2000)throw new Error('Notes must contain at most 2,000 characters.');if(st.selected>today)throw new Error('Actual Daily Logs cannot be in the future.');
        args={p_operation:'save_log',p_data_epoch:st.daily.data_epoch,p_log_id:d.id,p_expected_revision:d.revision,p_log_date:st.selected,p_flow:d.flow,p_symptoms:d.symptoms,p_mood:d.mood,p_notes:d.notes.trim(),p_time_zone:zone,p_confirm_private_save:true};
      }else if(type==='period'){const f=st.periodForm,start=form.elements.start.value,end=form.elements.end.value||null;M.ordinal(start);if(end)M.ordinal(end);if(start>today||(end&&(end<start||end>today)))throw new Error('Actual dates must be ordered and not in the future.');
        args={p_operation:'save_period',p_data_epoch:st.cycle.data_epoch,p_entry_id:f.id,p_expected_revision:f.revision,p_start_date:start,p_end_date:end,p_time_zone:zone,p_confirm_private_save:true};
      }else{const whole=value=>{if(!value)return null;const n=Number(value);if(!Number.isSafeInteger(n)||n<1||n>2147483647)throw new Error('Enter positive whole-day preferences.');return n;},flag=value=>value===''?null:value==='true';
        args={p_operation:'save_preferences',p_data_epoch:st.cycle.data_epoch,p_expected_revision:st.cycle.preferences_revision,p_cycle_length:whole(form.elements.cycle.value),p_bleeding_duration:whole(form.elements.duration.value),p_time_zone:zone,p_uses_hormonal_contraception:flag(form.elements.contraception.value),p_has_ovulation_affecting_circumstance:flag(form.elements.circumstance.value),p_reports_irregular_cycles:flag(form.elements.irregular.value),p_confirm_private_save:true};
      }
      st.busy=true;st.error='';st.notice='Saving privately…';refresh();await run(domain,args);if(identity===ticket&&st===current)st.zone=zone;
    }catch(error){if(identity===ticket&&st===current){st.error=error?.code?safeError(error):['Notes must contain at most 2,000 characters.','Actual Daily Logs cannot be in the future.','Actual dates must be ordered and not in the future.','Enter positive whole-day preferences.','Enter a valid calendar date.','Private save confirmation required.'].includes(error?.message)?error.message:safeError(error);st.notice='';}}
    finally{if(identity===ticket&&st===current){st.busy=false;refresh();}}
  }
  document.addEventListener('click',click);document.addEventListener('submit',submit);
  document.addEventListener('input',event=>{if(S.route!=='gs-period')return;const form=event.target.closest('[data-period-form]');if(!form)return;const name=event.target.name;
    if(form.dataset.periodForm==='daily'){if(['notes','zone'].includes(name)){draft()[name]=event.target.value;draft().dirty=true;}}
    else if(form.dataset.periodForm==='period'){if(['start','end','zone'].includes(name))st.periodForm[name]=event.target.value;st.periodForm.dirty=true;}
    else{if(['cycle','duration','contraception','circumstance','irregular','zone'].includes(name))st.prefForm[name]=event.target.value;st.prefForm.dirty=true;}
    // Unsaved zone and consent fields are deliberately never persisted to S.
  });
  function revalidate(){reset();if(!st)st=blank();if(!API.unresolved('cycle')&&!API.unresolved('daily')&&!st.clearPlan){st.loaded=false;st.error='';}}
  return {renderPage,reset,revalidate};
})();
window.herdayPeriodTracker=herdayPeriodTracker;
