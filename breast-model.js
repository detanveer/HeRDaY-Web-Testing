/* Voluntary observations and personal reminders, not a medical assessment. */
const herdayBreastModel=(()=>{
 const M=herdayPeriodModel;
 const feelings=Object.freeze(['no_change','tenderness','discomfort','other_change']);
 const observations=Object.freeze(['no_new_change','tenderness','lump_thickening','skin_change','nipple_change','discharge','pain','other']);
 const areas=Object.freeze(['left','right','both','not_applicable']);
 const label=k=>k==='lump_thickening'?'Lump / Thickening':k.split('_').map(s=>s[0].toUpperCase()+s.slice(1)).join(' ');
 function selected(items){if(!Array.isArray(items)||new Set(items).size!==items.length||items.some(x=>!observations.includes(x)))throw new Error('Choose supported, unique observations.');return [...items].sort();}
 function entry({date,feeling=null,observations:items=[],area=null,notes='',zone}){M.ordinal(date);if(date>M.today(zone))throw new Error('An actual check-in date cannot be in the future.');const choices=selected(items);
  if(feeling!==null&&!feelings.includes(feeling)||area!==null&&!areas.includes(area))throw new Error('Choose supported descriptions and area.');
  if(choices.includes('no_new_change')&&(choices.length!==1||feeling!==null&&feeling!=='no_change')||feeling==='no_change'&&choices.some(x=>x!=='no_new_change'))throw new Error('No Change conflicts with a recorded change. Review your selections.');
  if(typeof notes!=='string'||[...notes.trim()].length>2000)throw new Error('Enter at most 2,000 note characters.');
  if(feeling===null&&!choices.length&&!notes.trim())throw new Error('Record a description, observation or note.');
  return {feeling,observations:choices,area,notes:notes.trim(),time_zone:zone.trim()};
 }
 function reminder({date,anchor=null,zone}){M.ordinal(date);M.today(zone);const day=Number(date.slice(8)),preferred=anchor===null||anchor===''?day:Number(anchor);if(!Number.isInteger(preferred)||preferred<1||preferred>31)throw new Error('Choose a monthly anchor day from 1 to 31.');
  const year=Number(date.slice(0,4)),month=Number(date.slice(5,7)),days=[31,year%4===0&&(year%100!==0||year%400===0)?29:28,31,30,31,30,31,31,30,31,30,31][month-1];
  if(day!==Math.min(preferred,days))throw new Error('Reminder date must match the anchor or the last valid day of its month.');return {date,anchor_day:preferred,time_zone:zone.trim()};
 }
 function nextMonth(date,anchor){M.ordinal(date);let year=Number(date.slice(0,4)),month=Number(date.slice(5,7))+1;if(month===13){year++;month=1;}if(year>9999)throw new Error('Next month is outside the supported calendar range.');const days=[31,year%4===0&&(year%100!==0||year%400===0)?29:28,31,30,31,30,31,31,30,31,30,31][month-1];return String(year).padStart(4,'0')+'-'+String(month).padStart(2,'0')+'-'+String(Math.min(anchor,days)).padStart(2,'0');}
 const notice='If you notice a new, unusual or persistent breast change, contact a qualified healthcare professional for advice and appropriate assessment.';
 const caution='Do not rely on HerDay to determine the cause of a change.';
 const screening='Breast screening recommendations can vary based on age, personal history, family history and local medical guidance. A qualified healthcare professional can advise you about screening that may be appropriate for you.';
 const health='Breast Awareness helps you keep personal notes and become familiar with changes you notice. It does not diagnose breast conditions or cancer and does not replace professional screening, medical advice, diagnosis or treatment.';
 return Object.freeze({feelings,observations,areas,label,selected,entry,reminder,nextMonth,notice,caution,screening,health});
})();
if(typeof module!=='undefined'&&module.exports)module.exports=herdayBreastModel;
