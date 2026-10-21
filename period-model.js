/* HerDay's approved configurable Period V2 product rules; not diagnostic rules. */
const herdayPeriodModel = (() => {
  const DAY=86400000;
  const rules=Object.freeze({minCycle:21,maxCycle:45,maxVariation:7,historyIntervals:6,minIntervals:3,assumedCycle:28,assumedBleeding:5,maxBleeding:14});
  function ordinal(value){
    if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))throw new Error('Enter a valid calendar date.');
    const [y,m,d]=value.split('-').map(Number);
    if(y<1||y>9999||m<1||m>12||d<1||d>31)throw new Error('Enter a valid calendar date.');
    const date=new Date(0);date.setUTCHours(0,0,0,0);date.setUTCFullYear(y,m-1,d);
    if(date.getUTCFullYear()!==y||date.getUTCMonth()!==m-1||date.getUTCDate()!==d)throw new Error('Enter a valid calendar date.');
    // UTC midnight encodes an ordinal Gregorian day, never a local DST duration.
    return date.getTime()/DAY;
  }
  function fromOrdinal(n){
    if(!Number.isSafeInteger(n))throw new Error('Invalid calendar day.');
    const date=new Date(n*DAY),year=date.getUTCFullYear();
    if(year<1||year>9999)throw new Error('Date is outside the supported calendar.');
    return `${String(year).padStart(4,'0')}-${String(date.getUTCMonth()+1).padStart(2,'0')}-${String(date.getUTCDate()).padStart(2,'0')}`;
  }
  function add(date,n){if(!Number.isSafeInteger(n))throw new Error('Invalid day count.');return fromOrdinal(ordinal(date)+n);}
  function today(zone,instant=new Date()){
    if(!zone)throw new Error('Confirm your time zone.');
    const parts=new Intl.DateTimeFormat('en-CA',{timeZone:zone,calendar:'gregory',numberingSystem:'latn',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(instant);
    const p=Object.fromEntries(parts.map(part=>[part.type,part.value]));
    const value=`${p.year.padStart(4,'0')}-${p.month}-${p.day}`;ordinal(value);return value;
  }
  function median(values){const s=[...values].sort((a,b)=>a-b),n=s.length;return n?Math.round(n%2?s[(n-1)/2]:(s[n/2-1]+s[n/2])/2):null;}
  function derive(entries,prefs,reference,{overlaps=false,incomplete=false}={}){
    const current=ordinal(reference),starts=[...entries].sort((a,b)=>a.start_date.localeCompare(b.start_date));
    const out={cycleDay:null,latest:starts.at(-1)||null,intervals:[],completedIntervals:Math.max(0,starts.length-1),historyIncomplete:incomplete,
      estimateLength:null,nextStart:null,nextEnd:null,remaining:null,elapsed:false,bleedingSource:null,label:'Log an actual period start to see an estimate.',reason:'missing_start',eligible:false};
    if(!starts.length)return out;
    let invalid=false,contradiction=overlaps;
    for(let i=0;i<starts.length;i++){
      const s=ordinal(starts[i].start_date),end=starts[i].end_date===null?null:ordinal(starts[i].end_date);
      if(s>current||(end!==null&&(end<s||end>current)))invalid=true;
      if(i){const previous=starts[i-1],gap=s-ordinal(previous.start_date);if(gap<=0)invalid=true;
        if(previous.end_date!==null&&ordinal(previous.end_date)>=s)contradiction=true;out.intervals.push(gap);}
    }
    out.intervals=out.intervals.slice(-rules.historyIntervals);
    const latest=ordinal(out.latest.start_date);if(latest<=current)out.cycleDay=current-latest+1;
    const unavailable=(reason,label)=>Object.assign(out,{reason,label});
    if(invalid)return unavailable('invalid_history','Correct the recorded dates before using calendar predictions.');
    if(contradiction)return unavailable('overlap','Overlapping period records — calendar prediction unavailable.');
    if([prefs?.uses_hormonal_contraception,prefs?.has_ovulation_affecting_circumstance,prefs?.reports_irregular_cycles].some(value=>value===true))
      return unavailable('circumstance','Calendar prediction unavailable with your reported circumstances.');
    if(prefs?.cycle_length!=null&&(prefs.cycle_length<rules.minCycle||prefs.cycle_length>rules.maxCycle))
      return unavailable('unsupported_preference','Your entered cycle length is retained; calendar prediction unavailable.');
    if(out.intervals.some(n=>n<rules.minCycle||n>rules.maxCycle))return unavailable('unsupported_history','Recorded intervals are outside this calendar model’s support; prediction unavailable.');
    if(out.intervals.length&&Math.max(...out.intervals)-Math.min(...out.intervals)>rules.maxVariation)
      return unavailable('variable','Variable cycles — calendar prediction unavailable.');
    const enough=out.intervals.length>=rules.minIntervals;
    out.estimateLength=enough?median(out.intervals):(prefs?.cycle_length??rules.assumedCycle);
    out.label=enough?'More consistent recorded history — still an estimate':prefs?.cycle_length!=null?'Limited history — estimate uses your entered length':'Limited history — assumes 28 days';
    try{out.nextStart=add(out.latest.start_date,out.estimateLength);}catch{return unavailable('calendar_range','Estimated date is outside the supported calendar.');}
    const duration=prefs?.bleeding_duration??rules.assumedBleeding;
    out.bleedingSource=prefs?.bleeding_duration!=null?'entered':'assumed';
    if(Number.isInteger(duration)&&duration>=1&&duration<=rules.maxBleeding){try{out.nextEnd=add(out.nextStart,duration-1);}catch{out.nextEnd=null;}}
    out.remaining=ordinal(out.nextStart)-current;out.elapsed=out.remaining<0;
    out.reason=null;out.eligible=true;
    return out;
  }
  function ovulation(entries,prefs,reference,options={}){
    const period=derive(entries,prefs,reference,options);
    const out={period,available:false,reason:period.reason,ovulationDate:null,windowStart:null,windowEnd:null,
      label:'Calendar estimate unavailable with the current history. Ovulation varies; a healthcare professional can advise.'};
    if(!period.eligible)return out;
    if(period.intervals.length<rules.minIntervals){out.reason='limited_history';return out;}
    const flags=['uses_hormonal_contraception','has_ovulation_affecting_circumstance','reports_irregular_cycles'];
    if(flags.some(key=>prefs?.[key]!==false)){out.reason='suitability_unconfirmed';return out;}
    if(period.elapsed){out.reason='elapsed_unconfirmed';return out;}
    try{
      const date=add(period.nextStart,-14);
      out.ovulationDate=date;out.windowStart=add(date,-5);out.windowEnd=add(date,1);
    }catch{out.reason='calendar_range';out.ovulationDate=null;out.windowStart=null;out.windowEnd=null;return out;}
    out.available=true;out.reason=null;out.label='Approximate calendar estimate — ovulation may occur earlier or later.';
    return out;
  }
  return {rules,ordinal,fromOrdinal,add,today,median,derive,ovulation};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=herdayPeriodModel;
