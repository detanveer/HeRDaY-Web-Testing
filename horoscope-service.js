/* Read-only daily horoscope: never calls a generation/provider/admin endpoint. */
(function(root){
 'use strict';
 const SIGNS=['aries','taurus','gemini','cancer','leo','virgo','libra','scorpio','sagittarius','capricorn','aquarius','pisces'];
 const LANGS=['en','ur','hi','bn','ar'];
 const FIELDS=['reading','love','career','health','guidance','lucky_color','lucky_number','mood','traits'];
 function day(now=Date.now()){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Karachi',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(now));}
 function create(client,{now=()=>Date.now(),changed=()=>{}}={}){
  const cache=new Map(),pending=new Map();
  const key=(s,l)=>`${day(now())}:${s}:${l}`;
  function validate(data,sign,language){
   if(!data||!['ready','unavailable'].includes(data.status)||data.edition_date!==day(now())||data.sign!==sign||data.language!==language||data.timezone!=='Asia/Karachi')throw Error('invalid_daily_response');
   if(data.status!=='ready')return {status:'unavailable'};
   if(!Number.isFinite(Date.parse(data.valid_until))||Date.parse(data.valid_until)<=now())throw Error('expired_daily_response');
   if(language!=='en'&&data.translation_ready!==true)return {status:'unavailable'};
   const content=data.content;
   if(!content||Array.isArray(content)||Object.keys(content).length!==FIELDS.length||!FIELDS.every(k=>Object.hasOwn(content,k)&&(content[k]===null||typeof content[k]==='string'&&content[k].trim().length>0&&[...content[k]].length<=8000))||typeof content.reading!=='string')throw Error('invalid_daily_content');
   return {...data,content};
  }
  function peek(sign,language){const item=cache.get(key(sign,language));return item&&item.until>now()?item.value:{status:'loading'};}
  function load(sign,language,force=false){
   if(!SIGNS.includes(sign)||!LANGS.includes(language))return Promise.resolve({status:'error'});
   const k=key(sign,language),current=cache.get(k);
   if(pending.has(k))return pending.get(k);
   if(!force&&current&&current.until>now())return Promise.resolve(current.value);
   const task=(async()=>{
    let value;
    try{let request=client.rpc('herday_get_daily_horoscope_v2',{p_sign:sign,p_language:language});if(typeof request.abortSignal==='function')request=request.abortSignal(AbortSignal.timeout(15000));const {data,error}=await request;if(error)throw error;value=validate(data,sign,language);}catch{value={status:'error'};}
    // Never revive yesterday's content after a midnight rollover.
    if(k!==key(sign,language))return {status:'unavailable'};
    const ttl=value.status==='ready'?60000:value.status==='unavailable'?30000:15000;
    cache.set(k,{value,until:Math.min(now()+ttl,value.valid_until?Date.parse(value.valid_until):Infinity)});
    return value;
   })().finally(()=>{pending.delete(k);changed(sign,language);});
   pending.set(k,task);return task;
  }
  return {load,peek,day:()=>day(now())};
 }
 root.HerdayHoroscopeService={create,day};
})(typeof window==='undefined'?globalThis:window);
