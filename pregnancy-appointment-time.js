/* Explicit local wall time -> minute-precision UTC candidates. No browser-zone parsing. */
const herdayAppointmentTime=(()=>{
  const M=herdayPeriodModel;
  function formatter(zone){return new Intl.DateTimeFormat('en-GB',{timeZone:zone,calendar:'gregory',numberingSystem:'latn',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});}
  function parts(format,instant){const p=Object.fromEntries(format.formatToParts(new Date(instant)).filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));return {date:`${p.year.padStart(4,'0')}-${p.month}-${p.day}`,time:`${p.hour}:${p.minute}`,second:p.second};}
  function local(instant,zone){const ms=Date.parse(instant);if(!Number.isFinite(ms))throw new Error('Enter a valid appointment time.');return parts(formatter(zone),ms);}
  function candidates(date,time,zone){M.ordinal(date);if(!/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(time))throw new Error('Enter a valid appointment time.');
    let format;try{format=formatter(zone);}catch{throw new Error('Select a supported appointment time zone.');}
    const [hour,minute]=time.split(':').map(Number),wall=M.ordinal(date)*86400000+hour*3600000+minute*60000,result=[];
    // Exhaustive minute candidates within a bounded +/-26-hour supported offset search.
    // Every candidate is round-tripped through the actual zone. Gaps have no candidate;
    // repeated local times retain ALL candidates rather than selecting an offset.
    for(let offset=-26*60;offset<=26*60;offset++){
      const instant=wall+offset*60000,iso=new Date(instant).toISOString();if(!/^[0-9]{4}-/.test(iso)||iso.startsWith('0000-'))continue;
      const p=parts(format,instant);if(p.date===date&&p.time===time&&p.second==='00')result.push(iso.replace('.000Z','Z'));
    }
    return result;
  }
  return Object.freeze({local,candidates});
})();
if(typeof module!=='undefined'&&module.exports)module.exports=herdayAppointmentTime;
