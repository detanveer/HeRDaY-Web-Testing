/* Shared date-only calendar for Period and Ovulation; no stored predictions. */
const herdayCycleCalendar=(()=>{
  const M=herdayPeriodModel;
  function render({month,selected,entries,period,ovulation=null,prefix='period',disabled=false,heading='Cycle Calendar'}){
    if(!['period','ovulation'].includes(prefix))throw new Error('Invalid cycle calendar context.');
    const ordinal=M.ordinal(month+'-01'),weekday=new Date(ordinal*86400000).getUTCDay(),firstCell=ordinal-weekday;
    const m=Number(month.slice(5)),y=Number(month.slice(0,4));
    const next=m===12?`${String(y+1).padStart(4,'0')}-01-01`:`${String(y).padStart(4,'0')}-${String(m+1).padStart(2,'0')}-01`;
    const count=y===9999&&m===12?31:M.ordinal(next)-ordinal,rows=Math.ceil((weekday+count)/7);
    const display=date=>new Intl.DateTimeFormat('en',{timeZone:'UTC',month:'short',day:'numeric',year:'numeric'}).format(new Date(M.ordinal(date)*86400000));
    let cells='';
    for(let i=0;i<rows*7;i++){
      let date;try{date=M.fromOrdinal(firstCell+i);}catch{cells+='<span></span>';continue;}
      const n=M.ordinal(date),actual=entries.some(e=>n>=M.ordinal(e.start_date)&&n<=M.ordinal(e.end_date??e.start_date));
      const predicted=!period.elapsed&&period.nextStart&&n>=M.ordinal(period.nextStart)&&n<=M.ordinal(period.nextEnd??period.nextStart);
      const fertile=ovulation?.available&&date>=ovulation.windowStart&&date<=ovulation.windowEnd;
      const approximate=ovulation?.available&&date===ovulation.ovulationDate;
      const chosen=date===selected,outside=date.slice(0,7)!==month;
      cells+=`<button type="button" data-${prefix}-date="${date}" class="${actual?'actual ':''}${predicted?'predicted ':''}${fertile?'illustrative ':''}${approximate?'approximate ':''}${chosen?'selected ':''}${outside?'outside':''}" aria-pressed="${chosen}" aria-label="${esc(display(date))}${actual?', recorded period':''}${predicted?', estimated period':''}${fertile?', illustrative estimated window':''}${approximate?', approximate ovulation estimate':''}" ${disabled?'disabled':''}>${Number(date.slice(8))}</button>`;
    }
    const label=new Intl.DateTimeFormat('en',{timeZone:'UTC',month:'long',year:'numeric'}).format(new Date(ordinal*86400000));
    const button=(action,text,aria)=>`<button type="button" class="section-secondary" data-${prefix}-action="${action}" aria-label="${aria}" ${disabled?'disabled':''}>${text}</button>`;
    return `<h2>${esc(heading)}</h2><section class="section-card period-calendar"><header>${button('previous-month','‹','Previous month')}<strong>${esc(label)}</strong>${button('next-month','›','Next month')}</header><div class="period-week">${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(day=>`<span>${day}</span>`).join('')}</div><div class="period-days">${cells}</div><div class="period-legend"><span><i class="actual"></i> Period</span>${prefix==='ovulation'?'<span><i class="illustrative"></i> Estimated Window</span>':''}<span><i class="predicted"></i> Predicted Period</span><span><i class="selected"></i> Selected Day</span>${prefix==='ovulation'?'<span><i class="approximate"></i> Approximate Ovulation</span>':''}</div></section>`;
  }
  function shift(month,delta){const n=Number(month.slice(0,4))*12+Number(month.slice(5))-1+delta,y=Math.floor(n/12);return y>=1&&y<=9999?`${String(y).padStart(4,'0')}-${String(n%12+1).padStart(2,'0')}`:month;}
  return {render,shift};
})();
