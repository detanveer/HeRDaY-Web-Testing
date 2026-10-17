/* Private health state lives only in memory. No Worker, analytics, URL or storage copies. */
const herdayPeriodService = (() => {
  let owner=null,generation=0;
  const pending=new Map();
  function reset(){const next=currentUser()?.id||null;if(next!==owner){owner=next;generation++;pending.clear();}}
  function session(){reset();if(!owner||currentUser()?.isBlocked)throw new Error('Please log in with an active account.');return {owner,generation};}
  function check(ticket){reset();if(ticket.owner!==owner||ticket.generation!==generation)throw new Error('Your session changed. Reopen the tracker.');}
  const integer=(n,min=0)=>Number.isSafeInteger(n)&&n>=min;
  const date=value=>{herdayPeriodModel.ordinal(value);return value;};
  function problem(error){
    const message=error?.code==='40001'?'Data changed or was cleared. Reload before editing.':error?.code==='42501'?'Your account cannot access this private data.':error?.code==='22023'?'Check the date and values. If this date is already recorded, edit its existing record.':'The result could not be confirmed. Retry the same request.';
    const result=new Error(message);result.code=error?.code;return result;
  }
  async function cycle({cursor=null}={}){
    const ticket=session();
    const data=await herdayRpc('herday_get_cycle_data',{p_limit:100,p_before_start_date:cursor?.start_date||null,p_before_id:cursor?.id||null});check(ticket);
    if(!data||!integer(data.data_epoch,1)||!integer(data.preferences_revision)||!Array.isArray(data.entries)||data.entries.length>100||typeof data.has_more!=='boolean'||typeof data.has_overlapping_records!=='boolean')throw new Error('Private cycle data could not be confirmed.');
    if(data.preferences!==null){const p=data.preferences;
      if(!p||!['cycle_length','bleeding_duration'].every(k=>p[k]===null||integer(p[k],1))||!['cycle_length_source','bleeding_duration_source'].every(k=>['entered','assumed'].includes(p[k]))||typeof p.time_zone!=='string'||!['uses_hormonal_contraception','has_ovulation_affecting_circumstance','reports_irregular_cycles'].every(k=>p[k]===null||typeof p[k]==='boolean'))throw new Error('Private preferences could not be confirmed.');
      herdayPeriodModel.today(p.time_zone);
    }
    for(const row of data.entries){if(!HERDAY_UUID.test(row.id||'')||!integer(row.revision,1)||typeof row.recorded_time_zone!=='string')throw new Error('Private period record could not be confirmed.');date(row.start_date);if(row.end_date!==null){date(row.end_date);if(row.end_date<row.start_date)throw new Error('Private period dates could not be confirmed.');}}
    return data;
  }
  async function daily(onDate){
    date(onDate);const ticket=session();const data=await herdayRpc('herday_get_period_daily_logs',{p_limit:1,p_on_date:onDate});check(ticket);
    if(!data||!integer(data.data_epoch,1)||!Array.isArray(data.logs)||data.logs.length>1||data.has_more!==false)throw new Error('Private Daily Log could not be confirmed.');
    for(const row of data.logs){if(!HERDAY_UUID.test(row.id||'')||row.log_date!==onDate||!integer(row.revision,1)||!Array.isArray(row.symptoms)||row.symptoms.some(x=>!['cramps','headache','bloating','backache','fatigue','acne'].includes(x))||(row.flow!==null&&!['none','light','medium','heavy'].includes(row.flow))||(row.mood!==null&&!['great','good','okay','low','irritable'].includes(row.mood))||typeof row.notes!=='string'||[...row.notes].length>2000||(row.cervical_mucus!==null&&!['dry','sticky','creamy','watery','egg_white'].includes(row.cervical_mucus))||(row.basal_temperature_c!==null&&(typeof row.basal_temperature_c!=='number'||!Number.isFinite(row.basal_temperature_c))))throw new Error('Private Daily Log could not be confirmed.');}
    return data;
  }
  async function mutate(domain,args){
    if(!['cycle','daily'].includes(domain))throw new Error('Invalid private-data operation.');
    const ticket=session(),key=JSON.stringify(args);let request=pending.get(domain);
    if(request&&request.key!==key)throw new Error('Resolve the previous request before making another change.');
    if(!request){request={key,args:{...JSON.parse(key),p_request_id:crypto.randomUUID()},busy:false,result:null};pending.set(domain,request);}
    if(request.busy)throw new Error('This request is still being sent.');
    if(request.result)return request.result;
    request.busy=true;
    try{
      const observations=domain==='daily'&&(Object.hasOwn(args,'p_cervical_mucus')||Object.hasOwn(args,'p_basal_temperature_c'));
      const rpc=domain==='cycle'?'herday_mutate_cycle_data':observations?'herday_save_period_daily_observations':'herday_mutate_period_daily_log';
      const result=await herdayRpc(rpc,request.args);check(ticket);
      const idKey=domain==='cycle'?'entry_id':'log_id';
      const savesRecord=['save_period','save_log'].includes(args.p_operation),deletes=['delete_period','delete_log','delete_preferences','clear_cycle_data','clear_daily_logs'].includes(args.p_operation);
      if(!result||result.operation!==args.p_operation||!integer(result.data_epoch,1)||typeof result.replayed!=='boolean'||(savesRecord&&!HERDAY_UUID.test(result[idKey]||''))||(result[idKey]!==undefined&&!HERDAY_UUID.test(result[idKey]))||(result.revision!==undefined&&!integer(result.revision))||(deletes&&result.deleted!==true))throw new Error('Acknowledgement unavailable.');
      request.result=result;return result;
    }catch(error){
      if(ticket.generation===generation&&['22023','42501','40001'].includes(error?.code))pending.delete(domain);
      throw problem(error);
    }finally{request.busy=false;}
  }
  function release(domain){pending.delete(domain);}
  function unresolved(domain){reset();return pending.get(domain)||null;}
  async function retry(domain){const request=unresolved(domain);if(!request)throw new Error('No request needs retrying.');const args={...request.args};delete args.p_request_id;return mutate(domain,args);}
  return {reset,cycle,daily,mutate,release,unresolved,retry};
})();
window.herdayPeriodService=herdayPeriodService;
