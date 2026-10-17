/* Verified Pregnancy Check-in RPCs. Owner-scoped memory only. */
const herdayPregnancyDailyService=(()=>{
  const M=herdayPeriodModel;
  const moods=Object.freeze(['great','good','okay','low','emotional']);
  const energies=Object.freeze(['low','medium','good']);
  const symptoms=Object.freeze(['nausea','fatigue','backache','heartburn','headache','swelling']);
  let owner=null,generation=0,pending=null;
  const integer=(n,min=0)=>Number.isSafeInteger(n)&&n>=min;
  const uuid=value=>HERDAY_UUID.test(value||'');
  function reset(){const next=currentUser()?.id||null;if(next!==owner){owner=next;generation++;pending=null;}}
  function session(){reset();if(!owner||currentUser()?.isBlocked)throw new Error('Please log in with an active account.');return {owner,generation};}
  function same(ticket){reset();return ticket.owner===owner&&ticket.generation===generation;}
  function rowValid(r){
    if(!r||!uuid(r.id)||!integer(r.revision,1)||typeof r.recorded_time_zone!=='string'||
      (r.energy!==null&&!energies.includes(r.energy))||(r.mood!==null&&!moods.includes(r.mood))||
      !Array.isArray(r.symptoms)||r.symptoms.length>6||new Set(r.symptoms).size!==r.symptoms.length||r.symptoms.some(x=>!symptoms.includes(x))||
      typeof r.notes!=='string'||[...r.notes].length>2000||
      ![r.consent_at,r.created_at,r.updated_at].every(t=>typeof t==='string'&&Number.isFinite(Date.parse(t))))throw new Error('Private check-in record could not be confirmed.');
    M.ordinal(r.log_date);M.today(r.recorded_time_zone);
    if(r.energy===null&&r.mood===null&&r.symptoms.length===0&&!r.notes.trim())throw new Error('Empty check-in record could not be confirmed.');
  }
  async function read({onDate=null,cursor=null,limit=100}={}){
    if(!integer(limit,1)||limit>100||(onDate&&cursor))throw new Error('Invalid check-in history request.');
    if(onDate)M.ordinal(onDate);if(cursor){M.ordinal(cursor.log_date);if(!uuid(cursor.id))throw new Error('Invalid check-in history cursor.');}
    const ticket=session();const data=await herdayRpc('herday_get_pregnancy_daily_logs',{
      p_limit:limit,p_on_date:onDate,p_before_date:cursor?.log_date||null,p_before_id:cursor?.id||null});
    if(!same(ticket))throw new Error('Your session changed. Reopen the tracker.');
    if(!data||!integer(data.data_epoch,1)||!Array.isArray(data.logs)||data.logs.length>limit||typeof data.has_more!=='boolean')throw new Error('Private check-in history could not be confirmed.');
    let last=null;const ids=new Set(),dates=new Set();
    for(const r of data.logs){rowValid(r);if(ids.has(r.id)||dates.has(r.log_date)||(onDate&&r.log_date!==onDate)||
      (last&&(r.log_date>last.log_date||(r.log_date===last.log_date&&r.id>=last.id)))||
      (cursor&&(r.log_date>cursor.log_date||(r.log_date===cursor.log_date&&r.id>=cursor.id))))throw new Error('Private check-in page could not be confirmed.');
      ids.add(r.id);dates.add(r.log_date);last=r;
    }
    if(onDate&&(data.logs.length>1||data.has_more))throw new Error('Private check-in date could not be confirmed.');
    if(data.has_more&&data.logs.length!==limit)throw new Error('Private check-in cursor could not be confirmed.');
    return data;
  }
  function failure(error){const e=new Error(error?.code==='40001'?'Check-in changed or was cleared. Reload before editing.':error?.code==='42501'?'Your account cannot access this private check-in.':error?.code==='22023'?'Check the date, selected values and confirmation. If this date already exists, edit that check-in.':'The result could not be confirmed. Retry the same check-in request.');e.code=error?.code;return e;}
  async function mutate(args){
    if(!['save_log','delete_log','clear_daily_logs'].includes(args?.p_operation)||Object.hasOwn(args,'p_request_id'))throw new Error('Invalid check-in operation.');
    const ticket=session(),key=JSON.stringify(args);
    if(pending&&pending.key!==key)throw new Error('Resolve the previous check-in request before changing it.');
    if(!pending)pending={key,args:{...JSON.parse(key),p_request_id:crypto.randomUUID()},busy:false,result:null};
    const request=pending;if(request.busy)throw new Error('This check-in request is still being sent.');if(request.result)return request.result;
    request.busy=true;
    try{const result=await herdayRpc('herday_mutate_pregnancy_daily_log',request.args);if(!same(ticket))throw new Error('Your session changed. Reopen the tracker.');
      if(!result||result.operation!==args.p_operation||!integer(result.data_epoch,1)||typeof result.replayed!=='boolean'||
        (args.p_operation==='save_log'&&(!uuid(result.log_id)||!integer(result.revision,1)))||
        (args.p_operation==='delete_log'&&(!uuid(result.log_id)||result.log_id!==args.p_log_id||result.deleted!==true))||
        (args.p_operation==='clear_daily_logs'&&result.deleted!==true))throw new Error('Check-in acknowledgement unavailable.');
      request.result=result;return result;
    }catch(error){if(same(ticket)&&['22023','40001','42501'].includes(error?.code))pending=null;throw failure(error);}
    finally{request.busy=false;}
  }
  function unresolved(){reset();return pending;}
  async function retry(){const p=unresolved();if(!p)throw new Error('No check-in request needs retrying.');const args={...p.args};delete args.p_request_id;return mutate(args);}
  function release(){pending=null;}
  return Object.freeze({reset,read,mutate,unresolved,retry,release,moods,energies,symptoms});
})();
window.herdayPregnancyDailyService=herdayPregnancyDailyService;
