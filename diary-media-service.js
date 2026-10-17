/* Private read foundation. Upload/view transport follows verified vault counts.
   No service keys, raw object URLs or persistent private state. */
const herdayDiaryMedia=(()=>{
 let identity=null,generation=0;const Q=herdayDiarySecurity;
 function clear(){generation++;}
 function sessionID(s){try{return JSON.parse(atob(s.access_token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).session_id;}catch{return null;}}
 async function ticket(){const {data,error}=await supabaseClient.auth.getSession();if(error)throw error;const s=data?.session,sid=sessionID(s);
  if(!s||s.user.id!==currentUser()?.id||currentUser()?.isBlocked||!HERDAY_UUID.test(sid||''))throw Error('Please sign in with an active account.');
  if(!identity||identity.owner!==s.user.id||identity.session!==sid){identity={owner:s.user.id,session:sid};clear();}
  return {...identity,generation,proof:Q.activeProof()};
 }
 function same(t){try{return generation===t.generation&&identity?.owner===t.owner&&identity?.session===t.session&&currentUser()?.id===t.owner&&Q.activeProof()===t.proof;}catch{return false;}}
 function validate(d,{draft=null,entry=null}={}){
  if(!d||!Number.isSafeInteger(d.quota_bytes)||d.quota_bytes<314572800||d.quota_bytes>1125899906842624||d.max_attachments!==10||!Number.isSafeInteger(d.data_epoch)||d.data_epoch<1||!Array.isArray(d.media)||d.media.length>10)throw Error('Diary storage unavailable.');
  for(const n of ['used_bytes','reserved_bytes','cleanup_bytes','saved_photos','saved_videos','saved_media'])if(!Number.isSafeInteger(d[n])||d[n]<0)throw Error('Complete Diary storage/counts unavailable.');
  const allocated=d.used_bytes+d.reserved_bytes+d.cleanup_bytes;
  if(!Number.isSafeInteger(allocated)||d.saved_photos+d.saved_videos!==d.saved_media)throw Error('Diary storage totals inconsistent.');
  if(!['free','active','expired'].includes(d.storage_status)||!Number.isSafeInteger(d.storage_revision)||d.storage_revision<0||d.expiry_timezone!=='Asia/Karachi'||(d.storage_status!=='free'&&(!/^\d{4}-\d{2}-\d{2}$/.test(d.paid_valid_until||'')||!Number.isFinite(Date.parse(d.paid_expires_at)))))throw Error('Storage expiry information unavailable.');
  if(d.quota_model!=='free_plus_paid_v2'||d.free_quota_bytes!==314572800||!Number.isSafeInteger(d.active_paid_bytes)||d.active_paid_bytes<0||d.quota_bytes!==314572800+d.active_paid_bytes||(d.storage_status!=='active'&&d.active_paid_bytes!==0)||d.cleanup_grace_days!==7||(d.storage_status!=='free'&&!Number.isFinite(Date.parse(d.cleanup_after))))throw Error('Complete free/paid storage policy unavailable.');
  const seen=new Set();for(const r of d.media){
   if(!r||!HERDAY_UUID.test(r.id||'')||seen.has(r.id)||!HERDAY_UUID.test(r.draft_id||'')||!Number.isSafeInteger(r.revision)||r.revision<1
   ||!Number.isSafeInteger(r.size_bytes)||r.size_bytes<1||!['image/jpeg','image/png','image/webp','video/mp4','video/webm'].includes(r.mime_type)
   ||r.size_bytes>(r.mime_type.startsWith('image/')?10:250)*1048576||!['reserved','ready'].includes(r.status)||!Number.isFinite(Date.parse(r.expires_at)))throw Error('Private attachment metadata unavailable.');
   if(entry?(r.entry_id!==entry||r.status!=='ready'||!Number.isInteger(r.position)||r.position<1||r.position>10):draft?(r.draft_id!==draft||r.entry_id!==null||r.position!==null):true)throw Error('Unexpected private attachment scope.');
   seen.add(r.id);
  }
  return {...d,allocated_bytes:allocated,available_bytes:Math.max(0,d.quota_bytes-allocated),over_quota:allocated>d.quota_bytes};
 }
 async function read({draft=null,entry=null}={}){if((draft&&entry)||(draft&&!HERDAY_UUID.test(draft))||(entry&&!HERDAY_UUID.test(entry)))throw Error('Invalid media scope.');const t=await ticket();
  const d=await herdayRpc('herday_get_diary_media',{p_proof:t.proof,p_draft_id:draft,p_entry_id:entry});if(!same(t))throw Error('Diary locked or session changed.');return validate(d,{draft,entry});
 }
 Q.onLock(clear);
 supabaseClient.auth.onAuthStateChange((event,s)=>{if(event==='SIGNED_OUT'||(identity&&(s?.user?.id!==identity.owner||sessionID(s)!==identity.session))){identity=null;clear();}});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)clear();});
 return {read,clear};
})();
window.herdayDiaryMedia=herdayDiaryMedia;
