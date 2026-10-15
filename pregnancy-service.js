/* Verified private dating RPCs only. One in-memory pending request per owner. */
const herdayPregnancyService=(()=>{
  const M=herdayPeriodModel;
  let owner=null,generation=0,pending=null;
  function reset(){const next=currentUser()?.id||null;if(next!==owner){owner=next;generation++;pending=null;}}
  function session(){reset();if(!owner||currentUser()?.isBlocked)throw new Error('Please log in with an active account.');return {owner,generation};}
  function same(ticket){reset();return ticket.owner===owner&&ticket.generation===generation;}
  const integer=(n,min=0)=>Number.isSafeInteger(n)&&n>=min;
  function failure(error){const e=new Error(error?.code==='40001'?'Dating changed or was cleared. Reload before editing.':error?.code==='42501'?'Your account cannot access this private dating record.':error?.code==='22023'?'Check the dating source, dates and required confirmations.':'The request could not be confirmed. Retry the same request.');e.code=error?.code;return e;}
  async function read(){const ticket=session();const data=await herdayRpc('herday_get_pregnancy_dating',{});if(!same(ticket))throw new Error('Your session changed. Reopen the tracker.');
    if(!data||!integer(data.data_epoch,1)||!integer(data.revision)||data.dating===undefined)throw new Error('Private dating record could not be confirmed.');
    if(data.dating!==null){const d=data.dating;
      if(!d||!['standard','art'].includes(d.tracking_mode)||!['lmp','clinician_edd'].includes(d.dating_source)||typeof d.time_zone!=='string')throw new Error('Private dating source could not be confirmed.');
      M.ordinal(d.selected_edd);M.today(d.time_zone);
      if(d.dating_source==='clinician_edd'){
        M.ordinal(d.clinician_edd);if(d.selected_edd!==d.clinician_edd||[d.lmp,d.cycle_length,d.lmp_reliable,d.cycles_regular].some(v=>v!==null))throw new Error('Clinician dating could not be confirmed.');
      }else{
        M.ordinal(d.lmp);if(d.tracking_mode!=='standard'||d.clinician_edd!==null||d.lmp_reliable!==true||(d.cycles_regular!==null&&typeof d.cycles_regular!=='boolean')||d.cycles_regular===false||(d.cycle_length!==null&&(!integer(d.cycle_length,21)||d.cycle_length>35||d.cycles_regular!==true))||M.add(d.lmp,280+(d.cycle_length??28)-28)!==d.selected_edd)throw new Error('Preliminary dating could not be confirmed.');
      }
      if(![d.consent_at,d.created_at,d.updated_at].every(t=>typeof t==='string'&&Number.isFinite(Date.parse(t))))throw new Error('Dating metadata could not be confirmed.');
    }return data;
  }
  async function mutate(args){const ticket=session(),key=JSON.stringify(args);
    if(pending&&pending.key!==key)throw new Error('Resolve the previous dating request before changing it.');
    if(!pending)pending={key,args:{...JSON.parse(key),p_request_id:crypto.randomUUID()},busy:false,result:null};
    const request=pending;if(request.busy)throw new Error('This dating request is still being sent.');if(request.result)return request.result;
    request.busy=true;
    try{const result=await herdayRpc('herday_mutate_pregnancy_dating',request.args);if(!same(ticket))throw new Error('Your session changed. Reopen the tracker.');
      if(!result||result.operation!==args.p_operation||!integer(result.revision,1)||!integer(result.data_epoch,1)||typeof result.replayed!=='boolean'||(args.p_operation==='clear_dating'&&result.deleted!==true))throw new Error('Dating acknowledgement unavailable.');request.result=result;return result;
    }catch(error){if(same(ticket)&&['22023','40001','42501'].includes(error?.code))pending=null;throw failure(error);}
    finally{request.busy=false;}
  }
  function unresolved(){reset();return pending;}
  async function retry(){const p=unresolved();if(!p)throw new Error('No dating request needs retrying.');const args={...p.args};delete args.p_request_id;return mutate(args);}
  function release(){pending=null;}
  return {reset,read,mutate,unresolved,retry,release};
})();
window.herdayPregnancyService=herdayPregnancyService;
