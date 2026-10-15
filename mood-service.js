/* Verified owner-only Mood RPCs. No direct tables, Worker or health storage copies. */
const herdayMoodService=(()=>{
  const M=herdayPeriodModel,F=herdayMoodModel;
  let owner=null,generation=0,pending=null;
  const integer=(n,min=0)=>Number.isSafeInteger(n)&&n>=min;
  const uuid=v=>HERDAY_UUID.test(v||'');
  function reset(){const next=currentUser()?.id||null;if(next!==owner){owner=next;generation++;pending=null;}}
  function session(){reset();if(!owner||currentUser()?.isBlocked)throw new Error('Please log in with an active account.');return {owner,generation};}
  function same(ticket){reset();return ticket.owner===owner&&ticket.generation===generation;}
  function overview(value,reference){
    if(!reference){if(value!==null)throw new Error('Unexpected Mood overview.');return;}
    const range=F.window(reference);
    if(!value||Object.keys(range).some(k=>value[k]!==range[k])||!integer(value.check_ins_this_week)||value.check_ins_this_week>7||!integer(value.current_streak)||value.current_streak>M.ordinal(reference)-M.ordinal('0001-01-01')+1||!Array.isArray(value.week_records)||value.week_records.length!==value.check_ins_this_week)throw new Error('Complete Mood overview could not be confirmed.');
    const counts=new Map(),days=new Set();let last=null;
    for(const r of value.week_records){M.ordinal(r?.log_date);if(r.log_date<range.week_start_date||r.log_date>reference||!F.moods.includes(r.mood)||days.has(r.log_date)||(last&&r.log_date<=last))throw new Error('Mood week records unavailable.');days.add(r.log_date);last=r.log_date;counts.set(r.mood,(counts.get(r.mood)||0)+1);}
    if(!Array.isArray(value.mood_frequencies)||value.mood_frequencies.length!==counts.size||!Array.isArray(value.most_logged))throw new Error('Mood frequencies unavailable.');
    let max=0;const seen=new Set();for(const f of value.mood_frequencies){if(!f||seen.has(f.mood)||counts.get(f.mood)!==f.days)throw new Error('Mood frequencies inconsistent.');seen.add(f.mood);max=Math.max(max,f.days);}
    const ties=new Set([...counts].filter(([,n])=>n===max).map(([key])=>key));for(const f of value.most_logged){if(!f||!ties.delete(f.mood)||f.days!==max)throw new Error('Mood ties inconsistent.');}if(ties.size)throw new Error('Mood overview omitted a tie.');
    for(const [field,key,known] of [['feeling_frequencies','feeling',F.feelings],['influence_frequencies','influence',F.influences]]){const values=value[field];if(!Array.isArray(values)||values.length>known.length)throw new Error('Mood pattern frequencies unavailable.');const seen=new Set();for(const f of values){if(!f||!known.includes(f[key])||seen.has(f[key])||!integer(f.days,1)||f.days>value.check_ins_this_week)throw new Error('Mood pattern frequencies inconsistent.');seen.add(f[key]);}}
    let prefix=0;for(let d=reference;d>=range.week_start_date;){if(!days.has(d))break;prefix++;if(d===range.week_start_date)break;d=M.add(d,-1);}
    const fullWeek=M.ordinal(reference)-M.ordinal(range.week_start_date)+1;
    if((prefix<fullWeek&&value.current_streak!==prefix)||(prefix===fullWeek&&value.current_streak<prefix))throw new Error('Reference-ended Mood streak inconsistent.');
  }
  async function read({limit=100,onDate=null,cursor=null,reference=null}={}){
    if(!integer(limit,1)||limit>100||(onDate&&cursor)||(cursor&&!uuid(cursor.id)))throw new Error('Invalid Mood read request.');if(onDate)M.ordinal(onDate);if(cursor)M.ordinal(cursor.log_date);if(reference)M.ordinal(reference);
    const ticket=session(),data=await herdayRpc('herday_get_mood_data',{p_limit:limit,p_on_date:onDate,p_before_date:cursor?.log_date||null,p_before_id:cursor?.id||null,p_reference_date:reference});
    if(!same(ticket))throw new Error('Your session changed. Reopen the tracker.');
    if(!data||!integer(data.data_epoch,1)||!Array.isArray(data.logs)||data.logs.length>limit||typeof data.has_more!=='boolean'||(data.has_more&&data.logs.length!==limit)||(onDate&&(data.logs.length>1||data.has_more)))throw new Error('Private mood logs could not be confirmed.');
    let last=cursor;const ids=new Set(),dates=new Set();
    for(const r of data.logs){if(!r||!uuid(r.id)||ids.has(r.id)||dates.has(r.log_date)||!integer(r.revision,1)||typeof r.notes!=='string'||[...r.notes].length>2000||typeof r.recorded_time_zone!=='string'||![r.consent_at,r.created_at,r.updated_at].every(t=>typeof t==='string'&&Number.isFinite(Date.parse(t))))throw new Error('Private mood record could not be confirmed.');
      M.ordinal(r.log_date);M.today(r.recorded_time_zone);
      if(!F.moods.includes(r.mood)||(r.intensity!==null&&(!integer(r.intensity,1)||r.intensity>5)))throw new Error('Private Mood selection unavailable.');F.selections(r.feelings,F.feelings);F.selections(r.influences,F.influences);
      if((onDate&&r.log_date!==onDate)||(last&&(r.log_date>last.log_date||(r.log_date===last.log_date&&r.id>=last.id))))throw new Error('Mood history cursor could not be confirmed.');ids.add(r.id);dates.add(r.log_date);last=r;
    }
    overview(data.overview,reference);return data;
  }
  function failure(error){const e=new Error(error?.code==='40001'?'Mood changed or were cleared. Reload before editing.':error?.code==='42501'?'Your account cannot access these private records.':error?.code==='22023'?'Check mood, dates, selections and confirmation. If this date exists, edit its saved log.':'The result could not be confirmed. Retry the same Mood request.');e.code=error?.code;return e;}
  async function mutate(args){if(!['save_log','delete_log','clear_mood_logs'].includes(args?.p_operation)||Object.hasOwn(args,'p_request_id'))throw new Error('Invalid Mood operation.');
    const ticket=session(),key=JSON.stringify(args);if(pending&&pending.key!==key)throw new Error('Resolve the previous Mood request before changing it.');if(!pending)pending={key,args:{...JSON.parse(key),p_request_id:crypto.randomUUID()},busy:false,result:null};const request=pending;
    if(request.busy)throw new Error('This Mood request is still being sent.');if(request.result)return request.result;request.busy=true;
    try{const result=await herdayRpc('herday_mutate_mood_log',request.args);if(!same(ticket))throw new Error('Your session changed. Reopen the tracker.');
      if(!result||result.operation!==args.p_operation||!integer(result.data_epoch,1)||typeof result.replayed!=='boolean'||
        (args.p_operation==='save_log'&&(!uuid(result.log_id)||!integer(result.revision,1)))||
        (args.p_operation==='delete_log'&&(!uuid(result.log_id)||result.log_id!==args.p_log_id||result.deleted!==true))||
        (args.p_operation==='clear_mood_logs'&&result.deleted!==true))throw new Error('Mood acknowledgement unavailable.');request.result=result;return result;
    }catch(error){if(same(ticket)&&['22023','40001','42501'].includes(error?.code))pending=null;throw failure(error);}finally{request.busy=false;}
  }
  function unresolved(){reset();return pending;}
  async function retry(){const p=unresolved();if(!p)throw new Error('No Mood request needs retrying.');const args={...p.args};delete args.p_request_id;return mutate(args);}
  function release(){pending=null;}
  return Object.freeze({reset,read,mutate,unresolved,retry,release});
})();
window.herdayMoodService=herdayMoodService;
