/* Verified owner-only Breast RPCs. No direct tables, Worker or health storage copies. */
const herdayBreastService=(()=>{
  const M=herdayPeriodModel,F=herdayBreastModel;
  let owner=null,generation=0,pending=null;
  const integer=(n,min=0)=>Number.isSafeInteger(n)&&n>=min;
  const uuid=v=>HERDAY_UUID.test(v||'');
  function reset(){const next=currentUser()?.id||null;if(next!==owner){owner=next;generation++;pending=null;}}
  function session(){reset();if(!owner||currentUser()?.isBlocked)throw new Error('Please log in with an active account.');return {owner,generation};}
  function same(ticket){reset();return ticket.owner===owner&&ticket.generation===generation;}
  function overview(value,reference){if(!reference){if(value!==null)throw new Error('Unexpected Breast overview.');return;}
    if(!value||value.reference_date!==reference||!integer(value.check_ins)||value.check_ins>M.ordinal(reference)-M.ordinal('0001-01-01')+1)throw new Error('Complete Breast overview unavailable.');
    if(!value.check_ins){if(value.last_check_in_date!==null)throw new Error('Unexpected last check-in.');}else{M.ordinal(value.last_check_in_date);if(value.last_check_in_date>reference)throw new Error('Last check-in unavailable.');}
    if(reference<'0001-01-30'){if(value.recent!==null||value.recent_unavailable_reason!=='reference_range_unsupported')throw new Error('Unsupported range unavailable.');return;}
    const r=value.recent;if(!r||value.recent_unavailable_reason!==null||r.start_date!==M.add(reference,-29)||r.end_date!==reference||!integer(r.check_ins)||r.check_ins>30||r.check_ins>value.check_ins)throw new Error('Complete 30-day overview unavailable.');
    for(const [field,key,known] of [['feeling_frequencies','feeling',F.feelings],['observation_frequencies','observation',F.observations]]){if(!Array.isArray(r[field])||r[field].length>known.length)throw new Error('Observation frequencies unavailable.');const seen=new Set();let total=0;for(const f of r[field]){if(!f||!known.includes(f[key])||seen.has(f[key])||!integer(f.days,1)||f.days>r.check_ins)throw new Error('Observation frequencies inconsistent.');seen.add(f[key]);total+=f.days;}if(key==='feeling'&&total>r.check_ins)throw new Error('Feeling frequency exceeds actual records.');}
  }
  async function read({limit=100,onDate=null,cursor=null,reference=null}={}){
    if(!integer(limit,1)||limit>100||(onDate&&cursor)||(cursor&&!uuid(cursor.id)))throw new Error('Invalid Breast read request.');if(onDate)M.ordinal(onDate);if(cursor)M.ordinal(cursor.log_date);if(reference)M.ordinal(reference);
    const ticket=session(),data=await herdayRpc('herday_get_breast_data',{p_limit:limit,p_on_date:onDate,p_before_date:cursor?.log_date||null,p_before_id:cursor?.id||null,p_reference_date:reference});
    if(!same(ticket))throw new Error('Your session changed. Reopen the tracker.');
    if(!data||!integer(data.data_epoch,1)||!Array.isArray(data.logs)||data.logs.length>limit||typeof data.has_more!=='boolean'||(data.has_more&&data.logs.length!==limit)||(onDate&&(data.logs.length>1||data.has_more)))throw new Error('Private breast logs could not be confirmed.');
    let last=cursor;const ids=new Set(),dates=new Set();
    for(const r of data.logs){if(!r||!uuid(r.id)||ids.has(r.id)||dates.has(r.log_date)||!integer(r.revision,1)||typeof r.notes!=='string'||[...r.notes].length>2000||typeof r.recorded_time_zone!=='string'||![r.consent_at,r.created_at,r.updated_at].every(t=>typeof t==='string'&&Number.isFinite(Date.parse(t))))throw new Error('Private breast record could not be confirmed.');
      M.ordinal(r.log_date);M.today(r.recorded_time_zone);
      F.entry({date:r.log_date,feeling:r.feeling,observations:r.observations,area:r.area,notes:r.notes,zone:r.recorded_time_zone});
      if((onDate&&r.log_date!==onDate)||(last&&(r.log_date>last.log_date||(r.log_date===last.log_date&&r.id>=last.id))))throw new Error('Breast history cursor could not be confirmed.');ids.add(r.id);dates.add(r.log_date);last=r;
    }
    overview(data.overview,reference);
    if(!integer(data.reminder_revision))throw new Error('Reminder revision unavailable.');
    if(data.reminder===null){if(data.reminder_status!=='off')throw new Error('Reminder off state inconsistent.');}
    else{const r=data.reminder;if(!r||typeof r.consent_at!=='string'||!Number.isFinite(Date.parse(r.consent_at)))throw new Error('Reminder unavailable.');F.reminder({date:r.date,anchor:r.anchor_day,zone:r.time_zone});if(!integer(r.anchor_day,1)||r.anchor_day>31||data.reminder_status!==(reference?(r.date<=reference?'due':'upcoming'):null))throw new Error('Reminder date status inconsistent.');}
    return data;
  }
  function failure(error){const e=new Error(error?.code==='40001'?'Breast changed or were cleared. Reload before editing.':error?.code==='42501'?'Your account cannot access these private records.':error?.code==='22023'?'Check breast, dates, selections and confirmation. If this date exists, edit its saved log.':'The result could not be confirmed. Retry the same Breast request.');e.code=error?.code;return e;}
  async function mutate(args){if(!['save_log','delete_log','save_reminder','clear_reminder','clear_breast_data'].includes(args?.p_operation)||Object.hasOwn(args,'p_request_id'))throw new Error('Invalid Breast operation.');
    const ticket=session(),key=JSON.stringify(args);if(pending&&pending.key!==key)throw new Error('Resolve the previous Breast request before changing it.');if(!pending)pending={key,args:{...JSON.parse(key),p_request_id:crypto.randomUUID()},busy:false,result:null};const request=pending;
    if(request.busy)throw new Error('This Breast request is still being sent.');if(request.result)return request.result;request.busy=true;
    try{const result=await herdayRpc('herday_mutate_breast_data',request.args);if(!same(ticket))throw new Error('Your session changed. Reopen the tracker.');
      if(!result||result.operation!==args.p_operation||!integer(result.data_epoch,1)||typeof result.replayed!=='boolean'||
        (args.p_operation==='save_log'&&(!uuid(result.log_id)||!integer(result.revision,1)))||
        (['save_reminder','clear_reminder','clear_breast_data'].includes(args.p_operation)&&!integer(result.revision,1))||
        (args.p_operation==='delete_log'&&(!uuid(result.log_id)||result.log_id!==args.p_log_id||result.deleted!==true))||
        (['clear_reminder','clear_breast_data'].includes(args.p_operation)&&result.deleted!==true))throw new Error('Breast acknowledgement unavailable.');request.result=result;return result;
    }catch(error){if(same(ticket)&&['22023','40001','42501'].includes(error?.code))pending=null;throw failure(error);}finally{request.busy=false;}
  }
  function unresolved(){reset();return pending;}
  async function retry(){const p=unresolved();if(!p)throw new Error('No Breast request needs retrying.');const args={...p.args};delete args.p_request_id;return mutate(args);}
  function release(){pending=null;}
  return Object.freeze({reset,read,mutate,unresolved,retry,release});
})();
window.herdayBreastService=herdayBreastService;
