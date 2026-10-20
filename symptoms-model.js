/* Approved voluntary Symptoms contract; no diagnosis, cause inference or risk score. */
const herdaySymptomsModel=(()=>{
  const M=herdayPeriodModel;
  const presets=Object.freeze(['cramps','headache','bloating','backache','fatigue','nausea','breast_tenderness','acne','dizziness','heartburn']);
  const severities=Object.freeze(['mild','moderate','severe']);
  const tags=Object.freeze(['period','pregnancy','sleep','food','stress','exercise','other']);
  const label=key=>key.split('_').map(s=>s[0].toUpperCase()+s.slice(1)).join(' ');
  const identity=item=>item.kind==='preset'?'preset:'+item.key:'custom:'+item.label.toLowerCase();
  function items(input){if(!Array.isArray(input)||input.length>20)throw new Error('Select up to 20 symptoms.');const seen=new Set();
    return input.map(item=>{if(!item||typeof item!=='object'||Array.isArray(item)||!Object.hasOwn(item,'severity')||(item.severity!==null&&!severities.includes(item.severity)))throw new Error('Choose a supported symptom and optional severity.');
      let result;
      if(item.kind==='preset'&&presets.includes(item.key)&&Object.keys(item).every(k=>['kind','key','severity'].includes(k)))result={kind:'preset',key:item.key,severity:item.severity};
      else if(item.kind==='custom'&&typeof item.label==='string'&&Object.keys(item).every(k=>['kind','label','severity'].includes(k))){const text=item.label.trim();if(!text||[...text].length>80)throw new Error('Enter a custom symptom of 1–80 characters.');
        if(presets.some(k=>k===text.toLowerCase()||label(k).toLowerCase()===text.toLowerCase()))throw new Error('Choose that symptom from the preset choices.');result={kind:'custom',label:text,severity:item.severity};
      }else throw new Error('Choose a supported symptom and optional severity.');
      const key=identity(result);if(seen.has(key))throw new Error('This symptom is already selected.');seen.add(key);return result;
    });
  }
  function entry({date,started=null,symptoms=[],notes='',related=[],zone}){const selected=items(symptoms);M.ordinal(date);const today=M.today(zone);
    if(date>today)throw new Error('An actual log date cannot be in the future.');
    if(started){M.ordinal(started);if(started>date)throw new Error('Started cannot be after the actual log date.');if(!selected.length)throw new Error('Started applies only to selected symptoms.');}
    if(typeof notes!=='string'||[...notes.trim()].length>2000)throw new Error('Enter at most 2,000 note characters.');
    if(!Array.isArray(related)||new Set(related).size!==related.length||related.some(t=>!tags.includes(t)))throw new Error('Choose supported organisational tags.');
    if(!selected.length&&!notes.trim())throw new Error('Select a symptom or enter a note.');
    return {symptoms:selected,started_date:started||null,notes:notes.trim(),related_tags:[...related].sort(),time_zone:zone.trim()};
  }
  function windows(reference){M.ordinal(reference);if(reference<'0001-01-07')return null;const dow=new Date(M.ordinal(reference)*86400000).getUTCDay();return {reference_date:reference,rolling_start_date:M.add(reference,-6),rolling_end_date:reference,week_start_date:M.add(reference,-((dow+6)%7)),week_end_date:reference};}
  const emergency='If a symptom is severe, sudden, persistent, worsening, or feels urgent or concerning, contact a qualified healthcare professional or emergency service.';
  const urgency='Tracking a symptom in HerDay does not determine whether it is medically serious.';
  const health='Symptoms & Notes is designed to help you keep a personal record of how you feel. It does not diagnose conditions, identify causes, or replace professional medical advice, diagnosis or treatment.';
  return Object.freeze({presets,severities,tags,label,identity,items,entry,windows,emergency,urgency,health});
})();
if(typeof module!=='undefined'&&module.exports)module.exports=herdaySymptomsModel;
