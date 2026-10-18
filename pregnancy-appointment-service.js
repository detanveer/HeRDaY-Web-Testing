/* Verified owner-only Appointment RPCs; one stable pending request in memory. */
const herdayPregnancyAppointmentService=(()=>{
  const M=herdayPeriodModel;
  let owner=null,generation=0,pending=null;
  const integer=(n,min=0)=>Number.isSafeInteger(n)&&n>=min;
  const uuid=v=>HERDAY_UUID.test(v||'');
  const stamp=v=>typeof v==='string'&&/^[0-9]{4}-/.test(v)&&!v.startsWith('0000-')&&Number.isFinite(Date.parse(v));
  function reset(){const next=currentUser()?.id||null;if(next!==owner){owner=next;generation++;pending=null;}}
  function session(){reset();if(!owner||currentUser()?.isBlocked)throw new Error('Please log in with an active account.');return {owner,generation};}
  function same(ticket){reset();return ticket.owner===owner&&ticket.generation===generation;}
  async function read({view='upcoming',limit=30,cursor=null}={}){
    if(!['upcoming','past','all'].includes(view)||!integer(limit,1)||limit>100||(cursor&&(!stamp(cursor.starts_at)||!uuid(cursor.id))))throw new Error('Invalid appointment read request.');
    const ticket=session(),data=await herdayRpc('herday_get_pregnancy_appointments',{p_view:view,p_limit:limit,p_after_starts_at:cursor?.starts_at||null,p_after_id:cursor?.id||null});
    if(!same(ticket))throw new Error('Your session changed. Reopen the tracker.');
    if(!data||!integer(data.data_epoch,1)||!Array.isArray(data.appointments)||data.appointments.length>limit||typeof data.has_more!=='boolean'||(data.has_more&&data.appointments.length!==limit))throw new Error('Private appointments could not be confirmed.');
    let last=cursor;const ids=new Set();
    for(const r of data.appointments){if(!r||!uuid(r.id)||ids.has(r.id)||!integer(r.revision,1)||typeof r.title!=='string'||![...r.title.trim()].length||[...r.title.trim()].length>180||!stamp(r.starts_at)||Date.parse(r.starts_at)%60000!==0||typeof r.time_zone!=='string'||![r.consent_at,r.created_at,r.updated_at].every(stamp))throw new Error('Private appointment record could not be confirmed.');
      M.today(r.time_zone);const local=herdayAppointmentTime.local(r.starts_at,r.time_zone);M.ordinal(local.date);
      if(last&&(Date.parse(r.starts_at)<Date.parse(last.starts_at)||(Date.parse(r.starts_at)===Date.parse(last.starts_at)&&r.id<=last.id)))throw new Error('Private appointment cursor could not be confirmed.');
      ids.add(r.id);last=r;
    }return data;
  }
  function failure(error){const e=new Error(error?.code==='40001'?'Appointment changed or was cleared. Reload before editing.':error?.code==='42501'?'Your account cannot access this private appointment.':error?.code==='22023'?'Check the title, UTC time, time zone and confirmation. If it already exists, edit its saved record.':'The result could not be confirmed. Retry the same appointment request.');e.code=error?.code;return e;}
  async function mutate(args){if(!['save_appointment','delete_appointment','clear_appointments'].includes(args?.p_operation)||Object.hasOwn(args,'p_request_id'))throw new Error('Invalid appointment operation.');
    const ticket=session(),key=JSON.stringify(args);if(pending&&pending.key!==key)throw new Error('Resolve the previous appointment request before changing it.');
    if(!pending)pending={key,args:{...JSON.parse(key),p_request_id:crypto.randomUUID()},busy:false,result:null};
    const request=pending;if(request.busy)throw new Error('This appointment request is still being sent.');if(request.result)return request.result;request.busy=true;
    try{const result=await herdayRpc('herday_mutate_pregnancy_appointment',request.args);if(!same(ticket))throw new Error('Your session changed. Reopen the tracker.');
      if(!result||result.operation!==args.p_operation||!integer(result.data_epoch,1)||typeof result.replayed!=='boolean'||
        (args.p_operation==='save_appointment'&&(!uuid(result.appointment_id)||!integer(result.revision,1)))||
        (args.p_operation==='delete_appointment'&&(!uuid(result.appointment_id)||result.appointment_id!==args.p_appointment_id||result.deleted!==true))||
        (args.p_operation==='clear_appointments'&&result.deleted!==true))throw new Error('Appointment acknowledgement unavailable.');request.result=result;return result;
    }catch(error){if(same(ticket)&&['22023','40001','42501'].includes(error?.code))pending=null;throw failure(error);}finally{request.busy=false;}
  }
  function unresolved(){reset();return pending;}
  async function retry(){const p=unresolved();if(!p)throw new Error('No appointment request needs retrying.');const args={...p.args};delete args.p_request_id;return mutate(args);}
  function release(){pending=null;}
  return Object.freeze({reset,read,mutate,unresolved,retry,release});
})();
window.herdayPregnancyAppointmentService=herdayPregnancyAppointmentService;
