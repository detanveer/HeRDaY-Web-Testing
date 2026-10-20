/* Verified owner-only reminder text-list RPCs; no notification delivery. */
const herdayPregnancyReminderService=(()=>{
  let owner=null,generation=0,pending=null;
  const integer=(n,min=0)=>Number.isSafeInteger(n)&&n>=min;
  const uuid=v=>HERDAY_UUID.test(v||'');
  // Preserve PostgreSQL microseconds when validating a timestamp+UUID cursor.
  function stampKey(value){const m=typeof value==='string'&&/^([0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2})(?:\.([0-9]{1,6}))?(Z|[+-][0-9]{2}:[0-9]{2})$/.exec(value);
    if(!m)throw new Error('Reminder timestamp could not be confirmed.');herdayPeriodModel.ordinal(m[1].slice(0,10));const ms=Date.parse(m[1]+m[3]);if(!Number.isFinite(ms))throw new Error('Reminder timestamp could not be confirmed.');return BigInt(ms)*1000n+BigInt((m[2]||'').padEnd(6,'0'));
  }
  function reset(){const next=currentUser()?.id||null;if(next!==owner){owner=next;generation++;pending=null;}}
  function session(){reset();if(!owner||currentUser()?.isBlocked)throw new Error('Please log in with an active account.');return {owner,generation};}
  function same(ticket){reset();return ticket.owner===owner&&ticket.generation===generation;}
  async function read({limit=30,cursor=null}={}){
    if(!integer(limit,1)||limit>100||(cursor&&!uuid(cursor.id)))throw new Error('Invalid reminder list request.');if(cursor)stampKey(cursor.created_at);
    const ticket=session(),data=await herdayRpc('herday_get_pregnancy_reminders',{p_limit:limit,p_before_created_at:cursor?.created_at||null,p_before_id:cursor?.id||null});
    if(!same(ticket))throw new Error('Your session changed. Reopen the tracker.');
    if(!data||!integer(data.data_epoch,1)||!Array.isArray(data.reminders)||data.reminders.length>limit||typeof data.has_more!=='boolean'||(data.has_more&&data.reminders.length!==limit))throw new Error('Private reminders could not be confirmed.');
    let last=cursor;const ids=new Set(),labels=new Set();
    for(const r of data.reminders){if(!r||!uuid(r.id)||ids.has(r.id)||!integer(r.revision,1)||typeof r.label!=='string'||![...r.label.trim()].length||[...r.label.trim()].length>180||labels.has(r.label))throw new Error('Private reminder record could not be confirmed.');
      const key=stampKey(r.created_at);stampKey(r.updated_at);stampKey(r.consent_at);
      if(last&&(key>stampKey(last.created_at)||(key===stampKey(last.created_at)&&r.id>=last.id)))throw new Error('Private reminder cursor could not be confirmed.');ids.add(r.id);labels.add(r.label);last=r;
    }return data;
  }
  function failure(error){const e=new Error(error?.code==='40001'?'Reminder changed or was cleared. Reload before editing.':error?.code==='42501'?'Your account cannot access this private reminder.':error?.code==='22023'?'Check the reminder text and confirmation. If it already exists, edit its saved entry.':'The result could not be confirmed. Retry the same reminder request.');e.code=error?.code;return e;}
  async function mutate(args){if(!['save_reminder','delete_reminder','clear_reminders'].includes(args?.p_operation)||Object.hasOwn(args,'p_request_id'))throw new Error('Invalid reminder operation.');
    const ticket=session(),key=JSON.stringify(args);if(pending&&pending.key!==key)throw new Error('Resolve the previous reminder request before changing it.');
    if(!pending)pending={key,args:{...JSON.parse(key),p_request_id:crypto.randomUUID()},busy:false,result:null};const request=pending;
    if(request.busy)throw new Error('This reminder request is still being sent.');if(request.result)return request.result;request.busy=true;
    try{const result=await herdayRpc('herday_mutate_pregnancy_reminder',request.args);if(!same(ticket))throw new Error('Your session changed. Reopen the tracker.');
      if(!result||result.operation!==args.p_operation||!integer(result.data_epoch,1)||typeof result.replayed!=='boolean'||
        (args.p_operation==='save_reminder'&&(!uuid(result.reminder_id)||!integer(result.revision,1)))||
        (args.p_operation==='delete_reminder'&&(!uuid(result.reminder_id)||result.reminder_id!==args.p_reminder_id||result.deleted!==true))||
        (args.p_operation==='clear_reminders'&&result.deleted!==true))throw new Error('Reminder acknowledgement unavailable.');request.result=result;return result;
    }catch(error){if(same(ticket)&&['22023','40001','42501'].includes(error?.code))pending=null;throw failure(error);}finally{request.busy=false;}
  }
  function unresolved(){reset();return pending;}
  async function retry(){const p=unresolved();if(!p)throw new Error('No reminder request needs retrying.');const args={...p.args};delete args.p_request_id;return mutate(args);}
  function release(){pending=null;}
  return Object.freeze({reset,read,mutate,unresolved,retry,release});
})();
window.herdayPregnancyReminderService=herdayPregnancyReminderService;
