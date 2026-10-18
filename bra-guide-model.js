/* Approved measurement guide only. No band, cup, sister-size or sizing-system calculation. */
const herdayBraGuideModel=(()=>{
 const units=Object.freeze(['in','cm']);
 function value(raw,unit){const text=String(raw).trim();if(!units.includes(unit)||text.length>4096||!/^\+?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(text)||!Number.isFinite(Number(text))||Number(text)<=0)throw new Error('Enter finite, positive measurements.');
  const [mantissa,exponent='0']=text.toLowerCase().replace(/^\+/,'').split('e'),[whole,decimal='']=mantissa.split('.'),power=Number(exponent)-decimal.length;if(!Number.isSafeInteger(power)||Math.abs(power)>4096)throw new Error('Enter finite, positive measurements.');
  let n=BigInt((whole||'0')+decimal),d=1n;if(power>=0)n*=10n**BigInt(power);else d=10n**BigInt(-power);
  // Exact definition: 1 inch = 2.54 centimetres = 254/100 centimetres.
  if(unit==='in'){n*=254n;d*=100n;}return {n,d,raw:text,unit};
 }
 function display(v,unit){if(unit===v.unit)return v.raw;if(!units.includes(unit))throw new Error('Choose inches or centimetres.');let n=v.n,d=v.d;if(unit==='in'){n*=100n;d*=254n;}const scaled=(n*1000000n+d/2n)/d;if(scaled===0n)return 'Less than 0.000001';const whole=scaled/1000000n,frac=(scaled%1000000n).toString().padStart(6,'0').replace(/0+$/,'');return whole.toString()+(frac?'.'+frac:'');}
 function summary(under,bust){if(!under||!bust)throw new Error('Enter both measurements.');if(bust.n*under.d<=under.n*bust.d)throw new Error('Recheck your measurements: bust is not greater than underbust.');return {under,bust};}
 const disclaimer='Measurements alone may not determine your fit. Use the retailer’s UK fitting guidance and check comfort; a fitting specialist can help.';
 return Object.freeze({units,value,display,summary,disclaimer});
})();
if(typeof module!=='undefined'&&module.exports)module.exports=herdayBraGuideModel;
