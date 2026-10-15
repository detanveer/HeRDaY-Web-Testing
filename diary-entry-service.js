/* Verified owner + Diary unlock proof RPCs; no direct table/media access. */
const herdayDiaryEntries=(()=>{
 const M=herdayPeriodModel;let owner=null,generation=0,pending=null;
 function reset(){const next=currentUser()?.id||null;if(owner!==next){owner=next;generation++;pending=null;}}
 function clear(){generation++;pending=null;}
 function ticket(){reset();if(!owner)throw Error('Please sign in.');return {owner,generation,proof:herdayDiarySecurity.activeProof()};}
 function same(t){reset();try{return owner===t.owner&&generation===t.generation&&herdayDiarySecurity.activeProof()===t.proof;}catch{return false;}}
 function attachmentIDs(value){if(value===null)return null;if(!Array.isArray(value)||value.length>10||value.some(x=>typeof x!=='string'||!HERDAY_UUID.test(x))||new Set(value).size!==value.length)throw Error('Select at most ten unique Diary attachments.');return [...value];}
 function validRow(r){
  if(!r||!HERDAY_UUID.test(r.id||'')||typeof r.title!=='string'||[...r.title].length>180||typeof r.thoughts!=='string'||[...r.thoughts].length>20000||!Number.isSafeInteger(r.revision)||r.revision<1||typeof r.recorded_time_zone!=='string'||![r.created_at,r.updated_at,r.consent_at].every(v=>typeof v==='string'&&Number.isFinite(Date.parse(v))))throw Error('Diary entry could not be confirmed.');
  const hasCount=Object.hasOwn(r,'attachment_count'),hasItems=Object.hasOwn(r,'attachments');if(hasCount!==hasItems)throw Error('Diary attachment metadata unavailable.');const count=hasCount?r.attachment_count:0,items=hasItems?r.attachments:[];
  if(!Number.isInteger(count)||count<0||count>10||!Array.isArray(items)||items.length!==count||(!r.thoughts.trim()&&count===0))throw Error('Diary attachment count unavailable.');
  const seen=new Set();items.forEach((x,i)=>{if(!x||!HERDAY_UUID.test(x.id||'')||seen.has(x.id)||x.position!==i+1||!['image/jpeg','image/png','image/webp','video/mp4','video/webm'].includes(x.mime_type)||!Number.isSafeInteger(x.size_bytes)||x.size_bytes<1||x.size_bytes>(x.mime_type.startsWith('image/')?10:250)*1048576)throw Error('Diary attachment metadata unavailable.');seen.add(x.id);});
  M.ordinal(r.entry_date);M.today(r.recorded_time_zone);return r;
 }
 async function read({limit=30,cursor=null,id=null,onDate=null}={}){const t=ticket();if(!Number.isInteger(limit)||limit<1||limit>100||(id&&!HERDAY_UUID.test(id))||(cursor&&!HERDAY_UUID.test(cursor.id)))throw Error('Invalid Diary read.');if(cursor)M.ordinal(cursor.entry_date);if(onDate)M.ordinal(onDate);
  const d=await herdayRpc('herday_get_diary_entries',{p_proof:t.proof,p_limit:limit,p_before_date:cursor?.entry_date||null,p_before_id:cursor?.id||null,p_entry_id:id,p_on_date:onDate});
  if(!same(t))throw Error('Diary locked or session changed.');if(!d||!Number.isSafeInteger(d.data_epoch)||d.data_epoch<1||!Array.isArray(d.entries)||d.entries.length>limit||typeof d.has_more!=='boolean'||!Number.isSafeInteger(d.total_entries)||d.total_entries<d.entries.length||(d.has_more&&d.entries.length!==limit))throw Error('Diary history could not be confirmed.');
  if(onDate&&(!Number.isSafeInteger(d.on_date_count)||d.on_date_count<d.entries.length))throw Error('Selected-date count unavailable.');
  const ids=new Set();let previous=cursor;for(const r of d.entries){validRow(r);if(ids.has(r.id)||(id&&r.id!==id)||(onDate&&r.entry_date!==onDate)||(previous&&(r.entry_date>previous.entry_date||(r.entry_date===previous.entry_date&&r.id>=previous.id))))throw Error('Diary cursor could not be confirmed.');ids.add(r.id);previous=r;}return d;
 }
 async function month(start){M.ordinal(start);if(!start.endsWith('-01'))throw Error('Use the first day of the month.');const t=ticket();const d=await herdayRpc('herday_get_diary_month',{p_proof:t.proof,p_month:start});if(!same(t))throw Error('Diary locked or session changed.');
  if(!d||d.month_start!==start||!Number.isSafeInteger(d.data_epoch)||d.data_epoch<1||!Array.isArray(d.dates)||d.dates.length>31||!Number.isSafeInteger(d.entries_in_month)||d.entries_in_month<0)throw Error('Diary calendar unavailable.');
  M.ordinal(d.month_end);const [y,m]=start.split('-').map(Number),days=new Date(M.ordinal(start)*86400000);days.setUTCMonth(days.getUTCMonth()+1,0);const end=M.fromOrdinal(days.getTime()/86400000);if(d.month_end!==end)throw Error('Calendar month boundary unavailable.');
  let previous=null,total=0;for(const r of d.dates){M.ordinal(r?.entry_date);if(r.entry_date<start||r.entry_date>end||(previous&&r.entry_date<=previous)||!Number.isSafeInteger(r.entry_count)||r.entry_count<1)throw Error('Complete calendar dates unavailable.');previous=r.entry_date;total+=r.entry_count;}
  if(total!==d.entries_in_month)throw Error('Calendar counts inconsistent.');return d;
 }
 function form({date,title='',thoughts,zone,mediaIds=null}){M.ordinal(date);if(date>M.today(zone))throw Error('Entry date must be today or past.');const ids=attachmentIDs(mediaIds);if(typeof title!=='string'||[...title].length>180||typeof thoughts!=='string'||[...thoughts].length>20000||(!thoughts.trim()&&!ids?.length))throw Error('Use a title up to 180 characters, thoughts up to 20,000 characters, and thoughts or verified attachments.');return {date,title,thoughts,zone,mediaIds:ids};}
 async function mutate(operation,{epoch,id=null,revision=null,value=null,confirmed=false}={}){if(pending)throw Error('Confirm the previous request first.');const t=ticket();if(!Number.isSafeInteger(epoch)||epoch<1||confirmed!==true)throw Error('Explicit confirmation required.');
  let v;if(operation==='save_entry'){v=form(value);if((id&&(!HERDAY_UUID.test(id)||!Number.isSafeInteger(revision)||revision<1))||(!id&&revision!==0))throw Error('Invalid entry revision.');}else if(operation==='delete_entry'){if(!HERDAY_UUID.test(id||'')||!Number.isSafeInteger(revision)||revision<1)throw Error('Invalid entry deletion.');}else if(operation!=='clear_entries')throw Error('Invalid Diary operation.');
  pending={ticket:t,rpc:v?.mediaIds!==null&&v?.mediaIds!==undefined?'herday_mutate_diary_entry_with_media':'herday_mutate_diary_entry',args:{p_proof:t.proof,p_operation:operation,p_request_id:crypto.randomUUID(),p_data_epoch:epoch,p_entry_id:id,p_expected_revision:revision,p_entry_date:v?.date||null,p_title:v?.title??null,p_thoughts:v?.thoughts??null,p_time_zone:v?.zone||null,p_confirm_private_save:operation==='save_entry',p_confirm_delete:operation!=='save_entry',...(v?.mediaIds!==null&&v?.mediaIds!==undefined?{p_media_ids:v.mediaIds}:{})},result:null};return retry();
 }
 async function retry(){if(!pending)throw Error('No pending entry request.');const p=pending;if(!same(p.ticket))throw Error('Diary locked or session changed.');if(!p.result){let r;try{r=await herdayRpc(p.rpc,p.args);}catch(error){if(pending===p&&['22023','40001','42501'].includes(error?.code))pending=null;throw error;}if(pending!==p||!same(p.ticket))throw Error('Diary locked or session changed.');if(!r||typeof r.replayed!=='boolean'||r.operation!==p.args.p_operation||!Number.isSafeInteger(r.data_epoch)||r.data_epoch<1)throw Error('Diary write could not be confirmed.');p.result=r;}return p.result;}
 function finish(){pending=null;}
 return {read,month,mutate,retry,finish,clear,reset,form,hasPending:()=>!!pending};
})();
window.herdayDiaryEntries=herdayDiaryEntries;
