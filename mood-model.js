/* Voluntary subjective Mood contract; no diagnosis, causal inference or psychiatric score. */
const herdayMoodModel=(()=>{
 const M=herdayPeriodModel;
 const moods=Object.freeze(['great','good','okay','low','very_low']);
 const feelings=Object.freeze(['calm','happy','hopeful','energetic','tired','anxious','sad','irritable','overwhelmed','lonely']);
 const influences=Object.freeze(['sleep','period','pregnancy','work','study','family','friends','relationship','health','stress','exercise','other']);
 const label=k=>k.split('_').map(s=>s[0].toUpperCase()+s.slice(1)).join(' ');
 function selections(items,known){if(!Array.isArray(items)||new Set(items).size!==items.length||items.some(x=>!known.includes(x)))throw new Error('Choose supported, unique selections.');return [...items].sort();}
 function entry({date,mood,intensity=null,feelings:chosen=[],influences:context=[],notes='',zone}){
  M.ordinal(date);if(date>M.today(zone))throw new Error('An actual check-in date cannot be in the future.');
  if(!moods.includes(mood))throw new Error('Select how you feel.');
  if(intensity!==null&&(!Number.isInteger(intensity)||intensity<1||intensity>5))throw new Error('Choose an optional intensity from 1 to 5.');
  if(typeof notes!=='string'||[...notes.trim()].length>2000)throw new Error('Enter at most 2,000 note characters.');
  return {mood,intensity,feelings:selections(chosen,feelings),influences:selections(context,influences),notes:notes.trim(),time_zone:zone.trim()};
 }
 function window(reference){const ord=M.ordinal(reference),dow=new Date(ord*86400000).getUTCDay();return {reference_date:reference,week_start_date:M.add(reference,-((dow+6)%7)),week_end_date:reference};}
 const support='If you feel unsafe, are in immediate danger, or are struggling with thoughts of harming yourself or someone else, contact local emergency services or a qualified healthcare professional for immediate help.';
 const health='Mood Tracker is designed for personal wellbeing tracking and self-reflection. It does not diagnose mental-health conditions or replace professional medical or mental-health advice, diagnosis or treatment.';
 const gentle='Your feelings can change from day to day. Tracking them can help you notice your own patterns over time.';
 return Object.freeze({moods,feelings,influences,label,selections,entry,window,support,health,gentle});
})();
if(typeof module!=='undefined'&&module.exports)module.exports=herdayMoodModel;
