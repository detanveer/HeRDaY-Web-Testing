/* Approved Pregnancy V2 product rules; estimates never establish pregnancy/wellbeing. */
const herdayPregnancyModel=(()=>{
  const M=herdayPeriodModel;
  const emergency='Severe sudden abdominal or pelvic pain, fainting or collapse, or heavy bleeding—especially if pregnancy is possible—requires immediate emergency medical care. Contact local emergency services or go to the nearest emergency department.';
  function dating({source,mode='standard',lmp=null,clinicianEdd=null,cycleLength=null,reliable=null,regular=null},today){
    M.ordinal(today);
    if(!['standard','art'].includes(mode)||!['lmp','clinician_edd'].includes(source))throw new Error('Select a supported dating source.');
    if(source==='clinician_edd'){
      if(!clinicianEdd)throw new Error('Enter the due date provided by your clinician.');
      M.ordinal(clinicianEdd);
      if(lmp!==null||cycleLength!==null||reliable!==null||regular!==null)throw new Error('Use one dating source at a time.');
      return {dating_source:source,tracking_mode:mode,selected_edd:clinicianEdd,lmp:null,cycle_length:null,lmp_reliable:null,cycles_regular:null,status:'Clinician-provided due date — reported by you'};
    }
    if(mode==='art')throw new Error('Use the due date provided by your fertility clinician.');
    if(!lmp||reliable!==true||regular===false)throw new Error('Use a clinician-provided due date when LMP is unreliable or cycles are variable.');
    M.ordinal(lmp);if(lmp>today)throw new Error('An actual LMP cannot be in the future.');
    if(clinicianEdd!==null)throw new Error('Use one dating source at a time.');
    if(cycleLength!==null&&(!Number.isInteger(cycleLength)||cycleLength<21||cycleLength>35||regular!==true))throw new Error('Cycle adjustment requires explicitly regular cycles and a 21–35 day entered length.');
    if(regular!==null&&typeof regular!=='boolean')throw new Error('Confirm cycle regularity or leave it unspecified.');
    const edd=M.add(lmp,280+(cycleLength===null?0:cycleLength-28));
    return {dating_source:source,tracking_mode:mode,selected_edd:edd,lmp,cycle_length:cycleLength,lmp_reliable:true,cycles_regular:regular,status:cycleLength===null?'Preliminary estimate — assumes a 28-day cycle':'Preliminary estimate — uses your entered cycle length'};
  }
  function progress(record,reference){
    M.ordinal(reference);M.ordinal(record.selected_edd);
    const elapsed=M.ordinal(reference)-(M.ordinal(record.selected_edd)-280);
    const result={selected_edd:record.selected_edd,source:record.dating_source,available:false,elapsedDays:elapsed,weeks:null,days:null,remainingDays:null,reason:null};
    if(elapsed<0){result.reason='inconsistent_dates';return result;}
    if(elapsed>294){result.reason='beyond_product_support';return result;}
    result.available=true;result.weeks=Math.floor(elapsed/7);result.days=elapsed%7;result.remainingDays=M.ordinal(record.selected_edd)-M.ordinal(reference);return result;
  }
  return {dating,progress,emergency};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=herdayPregnancyModel;
