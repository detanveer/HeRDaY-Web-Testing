/* Verified owner-only Symptoms RPCs. No direct tables, Worker or health storage copies. */
const herdaySymptomsService=(()=>{
  const M=herdayPeriodModel,F=herdaySymptomsModel;
  let owner=null,generation=0,pending=null;
  const integer=(n,min=0)=>Number.isSafeInteger(n)&&n>=min;
  const uuid=v=>HERDAY_UUID.test(v||'');
  function reset(){const next=currentUser()?.id||null;if(next!==owner){owner=next;generation++;pending=null;}}
  function session(){reset();if(!owner||currentUser()?.isBlocked)throw new Error('Please log in with an active account.');return {owner,generation};}
  function same(ticket){reset();return ticket.owner===owner&&ticket.generation===generation;}
  function overview(value,reference,reason){
    if(!reference){if(value!==null||reason!==null)throw new Error('Unexpected symptom overview.');return;}
    const range=F.windows(reference);if(!range){if(value!==null||reason!=='reference_range_unsupported')throw new Error('Unsupported overview range could not be confirmed.');return;}
    if(!value||reason!==null||Object.keys(range).some(k=>value[k]!==range[k])||!integer(value.recent_log_count)||value.recent_log_count>7||!integer(value.logged_this_week_days)||value.logged_this_week_days>value.recent_log_count||!Array.isArray(value.frequencies)||value.frequencies.length>140||!Array.isArray(value.most_logged))throw new Error('Complete symptom overview could not be confirmed.');
    const map=new Map();let max=0;
    for(const f of value.frequencies){if(!f||!['preset','custom'].includes(f.kind)||typeof f.key!=='string'||!f.key||typeof f.label!=='string'||!f.label.trim()||(f.kind==='preset'&&!F.presets.includes(f.key))||!integer(f.rolling_days,1)||f.rolling_days>value.recent_log_count||!integer(f.week_days)||f.week_days>f.rolling_days||f.week_days>value.logged_this_week_days)throw new Error('Recorded symptom frequency could not be confirmed.');
      const key=f.kind+':'+f.key;if(map.has(key))throw new Error('Duplicate symptom frequency.');map.set(key,f);max=Math.max(max,f.rolling_days);
    }
    const expected=new Set([...map].filter(([,f])=>f.rolling_days===max).map(([k])=>k));
    for(const f of value.most_logged){const key=f?.kind+':'+f?.key,record=map.get(key);if(!record||!expected.delete(key)||['label','rolling_days','week_days'].some(k=>f[k]!==record[k]))throw new Error('Symptom overview ties could not be confirmed.');}
    if(expected.size)throw new Error('Symptom overview omitted a tie.');
  }
  async function read({limit=100,onDate=null,cursor=null,reference=null}={}){
    if(!integer(limit,1)||limit>100||(onDate&&cursor)||(cursor&&!uuid(cursor.id)))throw new Error('Invalid Symptoms read request.');if(onDate)M.ordinal(onDate);if(cursor)M.ordinal(cursor.log_date);if(reference)M.ordinal(reference);
    const ticket=session(),data=await herdayRpc('herday_get_symptom_data',{p_limit:limit,p_on_date:onDate,p_before_date:cursor?.log_date||null,p_before_id:cursor?.id||null,p_reference_date:reference});
    if(!same(ticket))throw new Error('Your session changed. Reopen the tracker.');
    if(!data||!integer(data.data_epoch,1)||!Array.isArray(data.logs)||data.logs.length>limit||typeof data.has_more!=='boolean'||(data.has_more&&data.logs.length!==limit)||(onDate&&(data.logs.length>1||data.has_more)))throw new Error('Private symptom logs could not be confirmed.');
    let last=cursor;const ids=new Set(),dates=new Set();
    for(const r of data.logs){if(!r||!uuid(r.id)||ids.has(r.id)||dates.has(r.log_date)||!integer(r.revision,1)||typeof r.notes!=='string'||[...r.notes].length>2000||typeof r.recorded_time_zone!=='string'||!Array.isArray(r.related_tags)||new Set(r.related_tags).size!==r.related_tags.length||r.related_tags.some(t=>!F.tags.includes(t))||![r.consent_at,r.created_at,r.updated_at].every(t=>typeof t==='string'&&Number.isFinite(Date.parse(t))))throw new Error('Private symptom record could not be confirmed.');
      M.ordinal(r.log_date);M.today(r.recorded_time_zone);F.items(r.symptoms);
      if(r.started_date!==null){M.ordinal(r.started_date);if(r.started_date>r.log_date||!r.symptoms.length)throw new Error('Shared onset date could not be confirmed.');}
      if(!r.symptoms.length&&!r.notes.trim())throw new Error('Empty symptom record.');
      if((onDate&&r.log_date!==onDate)||(last&&(r.log_date>last.log_date||(r.log_date===last.log_date&&r.id>=last.id))))throw new Error('Symptom history cursor could not be confirmed.');ids.add(r.id);dates.add(r.log_date);last=r;
    }
    overview(data.overview,reference,data.overview_unavailable_reason);return data;
  }
  function failure(error){const e=new Error(error?.code==='40001'?'Symptoms changed or were cleared. Reload before editing.':error?.code==='42501'?'Your account cannot access these private records.':error?.code==='22023'?'Check symptoms, dates, tags and confirmation. If this date exists, edit its saved log.':'The result could not be confirmed. Retry the same Symptoms request.');e.code=error?.code;return e;}
  async function mutate(args){if(!['save_log','delete_log','clear_symptom_logs'].includes(args?.p_operation)||Object.hasOwn(args,'p_request_id'))throw new Error('Invalid Symptoms operation.');
    const ticket=session(),key=JSON.stringify(args);if(pending&&pending.key!==key)throw new Error('Resolve the previous Symptoms request before changing it.');if(!pending)pending={key,args:{...JSON.parse(key),p_request_id:crypto.randomUUID()},busy:false,result:null};const request=pending;
    if(request.busy)throw new Error('This Symptoms request is still being sent.');if(request.result)return request.result;request.busy=true;
    try{const result=await herdayRpc('herday_mutate_symptom_log',request.args);if(!same(ticket))throw new Error('Your session changed. Reopen the tracker.');
      if(!result||result.operation!==args.p_operation||!integer(result.data_epoch,1)||typeof result.replayed!=='boolean'||
        (args.p_operation==='save_log'&&(!uuid(result.log_id)||!integer(result.revision,1)))||
        (args.p_operation==='delete_log'&&(!uuid(result.log_id)||result.log_id!==args.p_log_id||result.deleted!==true))||
        (args.p_operation==='clear_symptom_logs'&&result.deleted!==true))throw new Error('Symptoms acknowledgement unavailable.');request.result=result;return result;
    }catch(error){if(same(ticket)&&['22023','40001','42501'].includes(error?.code))pending=null;throw failure(error);}finally{request.busy=false;}
  }
  function unresolved(){reset();return pending;}
  async function retry(){const p=unresolved();if(!p)throw new Error('No Symptoms request needs retrying.');const args={...p.args};delete args.p_request_id;return mutate(args);}
  function release(){pending=null;}
  return Object.freeze({reset,read,mutate,unresolved,retry,release});
})();
window.herdaySymptomsService=herdaySymptomsService;
