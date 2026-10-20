/* Verified owner-only Water RPCs. No direct tables, Worker or health storage copies. */
const herdayWaterService=(()=>{
  const M=herdayPeriodModel,F=herdayWaterModel;
  let owner=null,generation=0,pending=null;
  const integer=(n,min=0)=>Number.isSafeInteger(n)&&n>=min;
  const uuid=v=>HERDAY_UUID.test(v||'');
  function reset(){const next=currentUser()?.id||null;if(next!==owner){owner=next;generation++;pending=null;}}
  function session(){reset();if(!owner||currentUser()?.isBlocked)throw new Error('Please log in with an active account.');return {owner,generation};}
  function same(ticket){reset();return ticket.owner===owner&&ticket.generation===generation;}
  const finite=(v,positive=false)=>typeof v==='number'&&Number.isFinite(v)&&(positive?v>0:v>=0)&&v<=1e100;
  const close=(a,b)=>a===b||Math.abs(a-b)<=Math.max(Math.abs(a),Math.abs(b),Number.MIN_VALUE)*1e-12;
  function overview(value,reference){if(!reference){if(value!==null)throw new Error('Unexpected Water overview.');return;}
    const ord=M.ordinal(reference),start=M.add(reference,-((new Date(ord*86400000).getUTCDay()+6)%7)),days=ord-M.ordinal(start)+1;
    if(!value||value.reference_date!==reference||value.week_start_date!==start||value.week_end_date!==reference||value.calendar_days!==days||!Array.isArray(value.week_records)||value.week_records.length>days)throw new Error('Complete weekly overview unavailable.');
    let last=null,recorded=0,comparable=0,reached=0,care=0,total=0;
    for(const r of value.week_records){M.ordinal(r?.log_date);if(r.log_date<start||r.log_date>reference||(last&&r.log_date<=last)||!integer(r.self_care_count)||r.self_care_count>20||(r.goal_snapshot_ml!==null&&!finite(r.goal_snapshot_ml,true)))throw new Error('Weekly actual records unavailable.');last=r.log_date;if(r.water_ml!==null){if(!finite(r.water_ml))throw new Error('Weekly water unavailable.');recorded++;total+=r.water_ml;if(r.goal_snapshot_ml!==null){comparable++;if(r.water_ml>=r.goal_snapshot_ml)reached++;}}if(r.self_care_count>0)care++;}
    if(value.logged_days!==value.week_records.length||value.recorded_water_days!==recorded||value.goal_comparable_days!==comparable||value.goal_reached_days!==reached||value.self_care_days!==care||(recorded?typeof value.total_recorded_water_ml!=='number'||!close(value.total_recorded_water_ml,total)||typeof value.average_water_ml!=='number'||!close(value.average_water_ml,total/recorded):value.total_recorded_water_ml!==null||value.average_water_ml!==null))throw new Error('Weekly denominators or goal snapshots inconsistent.');
    if(!Array.isArray(value.self_care_frequencies)||value.self_care_frequencies.length>140||!Array.isArray(value.most_logged))throw new Error('Self-care frequencies unavailable.');const map=new Map();let max=0;
    for(const f of value.self_care_frequencies){if(!f||!['preset','custom'].includes(f.kind)||typeof f.key!=='string'||!f.key||typeof f.label!=='string'||!f.label.trim()||(f.kind==='preset'&&!F.presets.includes(f.key))||!integer(f.days,1)||f.days>care||map.has(f.kind+':'+f.key))throw new Error('Self-care frequencies inconsistent.');map.set(f.kind+':'+f.key,f);max=Math.max(max,f.days);}
    const ties=new Set([...map].filter(([,f])=>f.days===max).map(([k])=>k));for(const f of value.most_logged){const key=f?.kind+':'+f?.key,r=map.get(key);if(!r||!ties.delete(key)||f.days!==max||f.label!==r.label)throw new Error('Self-care ties inconsistent.');}if(ties.size)throw new Error('Self-care overview omitted a tie.');
  }
  async function read({limit=100,onDate=null,cursor=null,reference=null}={}){
    if(!integer(limit,1)||limit>100||(onDate&&cursor)||(cursor&&!uuid(cursor.id)))throw new Error('Invalid Water read request.');if(onDate)M.ordinal(onDate);if(cursor)M.ordinal(cursor.log_date);if(reference)M.ordinal(reference);
    const ticket=session(),data=await herdayRpc('herday_get_water_selfcare_data',{p_limit:limit,p_on_date:onDate,p_before_date:cursor?.log_date||null,p_before_id:cursor?.id||null,p_reference_date:reference});
    if(!same(ticket))throw new Error('Your session changed. Reopen the tracker.');
    if(!data||!integer(data.data_epoch,1)||!Array.isArray(data.logs)||data.logs.length>limit||typeof data.has_more!=='boolean'||(data.has_more&&data.logs.length!==limit)||(onDate&&(data.logs.length>1||data.has_more)))throw new Error('Private water logs could not be confirmed.');
    let last=cursor;const ids=new Set(),dates=new Set();
    for(const r of data.logs){if(!r||!uuid(r.id)||ids.has(r.id)||dates.has(r.log_date)||!integer(r.revision,1)||typeof r.notes!=='string'||[...r.notes].length>2000||typeof r.recorded_time_zone!=='string'||![r.consent_at,r.created_at,r.updated_at].every(t=>typeof t==='string'&&Number.isFinite(Date.parse(t))))throw new Error('Private water record could not be confirmed.');
      M.ordinal(r.log_date);M.today(r.recorded_time_zone);
      F.entry({date:r.log_date,water:r.water_ml,care:r.self_care_items,mood:r.mood,notes:r.notes,zone:r.recorded_time_zone});
      if(r.water_ml===null){if(r.water_amount!==null||r.water_unit!==null)throw new Error('Unrecorded water inconsistent.');}else{if(!finite(r.water_amount)||!close(F.amount(r.water_amount,r.water_unit,{zero:true}),r.water_ml))throw new Error('Water unit normalization inconsistent.');}if(r.goal_snapshot_ml!==null&&!finite(r.goal_snapshot_ml,true))throw new Error('Saved goal snapshot unavailable.');
      if((onDate&&r.log_date!==onDate)||(last&&(r.log_date>last.log_date||(r.log_date===last.log_date&&r.id>=last.id))))throw new Error('Water history cursor could not be confirmed.');ids.add(r.id);dates.add(r.log_date);last=r;
    }
    overview(data.overview,reference);
    if(!integer(data.preferences_revision))throw new Error('Preferences revision unavailable.');
    if(data.preferences!==null){const r=data.preferences;if(!r||typeof r.consent_at!=='string'||!Number.isFinite(Date.parse(r.consent_at)))throw new Error('Preferences unavailable.');const value=F.preferences({goal:r.goal_ml,glass:r.glass_ml,waterOn:r.water_reminder_enabled,interval:r.water_reminder_interval_minutes,careOn:r.self_care_reminder_enabled,time:r.self_care_reminder_time,zone:r.time_zone});if(value.water_reminder_interval_minutes!==r.water_reminder_interval_minutes||value.self_care_reminder_time!==r.self_care_reminder_time)throw new Error('Disabled reminder settings inconsistent.');}
    return data;
  }
  function failure(error){const e=new Error(error?.code==='40001'?'Water changed or were cleared. Reload before editing.':error?.code==='42501'?'Your account cannot access these private records.':error?.code==='22023'?'Check water, dates, selections and confirmation. If this date exists, edit its saved log.':'The result could not be confirmed. Retry the same Water request.');e.code=error?.code;return e;}
  async function mutate(args){if(!['save_day','delete_day','save_preferences','clear_preferences','clear_water_selfcare'].includes(args?.p_operation)||Object.hasOwn(args,'p_request_id'))throw new Error('Invalid Water operation.');
    const ticket=session(),key=JSON.stringify(args);if(pending&&pending.key!==key)throw new Error('Resolve the previous Water request before changing it.');if(!pending)pending={key,args:{...JSON.parse(key),p_request_id:crypto.randomUUID()},busy:false,result:null};const request=pending;
    if(request.busy)throw new Error('This Water request is still being sent.');if(request.result)return request.result;request.busy=true;
    try{const result=await herdayRpc('herday_mutate_water_selfcare',request.args);if(!same(ticket))throw new Error('Your session changed. Reopen the tracker.');
      if(!result||result.operation!==args.p_operation||!integer(result.data_epoch,1)||typeof result.replayed!=='boolean'||
        (args.p_operation==='save_day'&&(!uuid(result.log_id)||!integer(result.revision,1)))||
        (['save_preferences','clear_preferences','clear_water_selfcare'].includes(args.p_operation)&&!integer(result.revision,1))||
        (args.p_operation==='delete_day'&&(!uuid(result.log_id)||result.log_id!==args.p_log_id||result.deleted!==true))||
        (['clear_preferences','clear_water_selfcare'].includes(args.p_operation)&&result.deleted!==true))throw new Error('Water acknowledgement unavailable.');request.result=result;return result;
    }catch(error){if(same(ticket)&&['22023','40001','42501'].includes(error?.code))pending=null;throw failure(error);}finally{request.busy=false;}
  }
  function unresolved(){reset();return pending;}
  async function retry(){const p=unresolved();if(!p)throw new Error('No Water request needs retrying.');const args={...p.args};delete args.p_request_id;return mutate(args);}
  function release(){pending=null;}
  return Object.freeze({reset,read,mutate,unresolved,retry,release});
})();
window.herdayWaterService=herdayWaterService;
