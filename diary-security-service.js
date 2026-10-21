/* Verified Diary security RPCs. PIN/proof/pending requests exist only in memory. */
const herdayDiarySecurity=(()=>{
 let identity=null,epoch=0,proof=null,expiry=0,metadata=null,pending=null,timer=null;
 const listeners=new Set();
 const notify=()=>listeners.forEach(fn=>fn());
 function erase(){clearTimeout(timer);timer=null;proof=null;expiry=0;pending=null;epoch++;notify();}
 function reset(){const id=currentUser()?.id||null;if(identity&&identity.owner!==id){identity=null;metadata=null;erase();}}
 async function ticket(){reset();const {data,error}=await herdaySession();if(error)throw error;const session=data?.session;
  let sid;try{const part=session.access_token.split('.')[1];sid=JSON.parse(atob(part.replace(/-/g,'+').replace(/_/g,'/'))).session_id;}catch{throw new Error('Please sign in again.');}
  if(!session||session.user.id!==currentUser()?.id||currentUser()?.isBlocked||!HERDAY_UUID.test(sid||''))throw new Error('Please sign in with an active account.');
  if(!identity||identity.owner!==session.user.id||identity.session!==sid){identity={owner:session.user.id,session:sid};metadata=null;erase();}
  return {...identity,epoch};
 }
 const same=t=>identity?.owner===t.owner&&identity?.session===t.session&&epoch===t.epoch&&currentUser()?.id===t.owner;
 function validate(d){if(!d||typeof d.configured!=='boolean'||!Number.isSafeInteger(d.revision)||d.revision<0||typeof d.auto_lock!=='boolean'||typeof d.unlocked!=='boolean'||d.unlocked!==(d.unlock_expires_at!==null)||(d.blocked_until!==null&&!Number.isFinite(Date.parse(d.blocked_until)))||(d.unlock_expires_at!==null&&!Number.isFinite(Date.parse(d.unlock_expires_at))))throw new Error('Diary security could not be confirmed.');return d;}
 async function read(){const t=await ticket();const d=validate(await herdayRpc('herday_get_diary_security',{p_proof:proof}));if(!same(t))throw new Error('Diary session changed. Reopen it.');metadata=d;
  if(d.unlocked&&proof){expiry=Date.parse(d.unlock_expires_at);clearTimeout(timer);timer=setTimeout(()=>{erase();},Math.max(0,expiry-Date.now()));}else{proof=null;expiry=0;clearTimeout(timer);}
  return {...d};
 }
 function randomProof(){const bytes=new Uint8Array(32);crypto.getRandomValues(bytes);return Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');}
 const pin=v=>typeof v==='string'&&/^\d{6}$/.test(v);
 async function mutate(operation,{current=null,next=null,confirm=null,consent=false,autoLock=null}={}){
  const t=await ticket();if(pending)throw new Error('Confirm the previous request before another change.');
  if(!metadata)throw new Error('Reload Diary security first.');
  if(['unlock','change_pin'].includes(operation)&&!pin(current))throw new Error('Enter your six-digit PIN.');
  if(['setup_pin','change_pin'].includes(operation)&&(!pin(next)||next!==confirm))throw new Error('Enter and confirm the same six-digit PIN.');
  if(['setup_pin','change_pin','set_auto_lock'].includes(operation)&&consent!==true)throw new Error('Confirm saving privately to your account.');
  if(['change_pin','set_auto_lock'].includes(operation)&&(!proof||expiry<=Date.now()))throw new Error('Unlock Diary first.');
  const secret=operation==='unlock'?randomProof():proof;
  const args={p_operation:operation,p_request_id:crypto.randomUUID(),p_expected_revision:['setup_pin','change_pin','set_auto_lock'].includes(operation)?metadata.revision:null,
   p_pin:current,p_new_pin:next,p_confirm_pin:confirm,p_proof:operation==='setup_pin'?null:secret,p_auto_lock:autoLock,p_confirm_private_save:consent};
  pending={ticket:t,args,secret,result:null};return retry();
 }
 async function retry(){if(!pending)throw new Error('No pending Diary request.');const p=pending;const t=await ticket();if(!same(p.ticket)||!same(t))throw new Error('Diary session changed.');
  if(!p.result){let r;try{r=await herdayRpc('herday_mutate_diary_security',p.args);}catch(error){if(pending===p&&['22023','40001','42501'].includes(error?.code))pending=null;throw error;}if(pending!==p||!same(p.ticket))throw new Error('Diary session changed.');if(!r||typeof r.ok!=='boolean'||typeof r.replayed!=='boolean'||r.operation!==p.args.p_operation)throw new Error('Diary request could not be confirmed.');p.result=r;}
  if(p.args.p_operation==='unlock'&&p.result.ok){proof=p.secret;}if(p.args.p_operation==='change_pin'&&p.result.ok){proof=null;expiry=0;}
  const d=await read();if(pending!==p||!same(p.ticket))throw new Error('Diary session changed.');pending=null;if(p.args.p_operation==='change_pin'&&p.result.ok)notify();
  return {result:p.result,security:d};
 }
 function leave(force=false){reset();if(!force&&metadata?.auto_lock===false){pending=null;return;}const old=proof,t=identity;erase();if(old&&t&&currentUser()?.id===t.owner){void herdaySession().then(({data})=>{let sid;try{sid=JSON.parse(atob(data.session.access_token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).session_id;}catch{return;}if(data.session.user.id!==t.owner||sid!==t.session)return;return herdayRpc('herday_mutate_diary_security',{p_operation:'lock',p_request_id:crypto.randomUUID(),p_proof:old});}).catch(()=>{});}}
 function activeProof(){reset();if(!proof||expiry<=Date.now()){if(proof)erase();throw new Error('Unlock Diary first.');}return proof;}
 // Switching to browser downloads does not close Diary. Explicit exit and page unload still lock it.
 window.addEventListener('pagehide',()=>leave(true));
 supabaseClient.auth.onAuthStateChange((event,session)=>{let sid;try{sid=JSON.parse(atob(session.access_token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).session_id;}catch{}if(event==='SIGNED_OUT'||(identity&&(session?.user?.id!==identity.owner||sid!==identity.session))){identity=null;metadata=null;erase();}});
 return {read,mutate,retry,leave,reset,activeProof,hasPending:()=>!!pending,onLock:fn=>{listeners.add(fn);return()=>listeners.delete(fn);}};
})();
window.herdayDiarySecurity=herdayDiarySecurity;
