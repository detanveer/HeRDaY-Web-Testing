/* NHS educational references checked 2026-10-13. No personal growth assessment.
 * Source register and editorial decisions: pregnancy-content/HerDay-Pregnancy-NHS-Reference-Basis.md.
 * Null values are intentional. Never interpolate weeks, measurements or comparisons.
 */
const herdayPregnancyWeeks=(()=>{
  const index='https://www.nhs.uk/best-start-in-life/pregnancy/week-by-week-guide-to-pregnancy/';
  // week, published approximate length, unit, explicitly stated measurement basis,
  // published comparison, paraphrased educational topic, general maternal topic.
  const rows=[
    [4,2,'mm',null,'poppy seed','The NHS describes an early embryo within a fluid-filled sac, with nourishment initially supplied by a yolk sac.','A visible bump may not appear yet; its timing varies between pregnancies.'],
    [5,2,'mm',null,'sesame seed','Early facial structures, the brain and the spinal cord are beginning to develop.','Learning about pregnancy can bring mixed emotions. Discuss worries with your maternity care professional.'],
    [6,6,'mm',null,'pea','Early arm and leg buds are forming, with small indentations where ears will develop.','Pregnancy-related nausea can happen throughout the day, rather than only in the morning.'],
    [7,10,'mm','head to bottom','grape','The NHS describes developing eyelids and cartilage within the limb buds.','Increasing blood volume is one of the changes described in pregnancy. The timing of a visible bump varies.'],
    [8,16,'mm',null,'raspberry','The arms and legs are lengthening as early development continues.','Anxiety and stress can occur. Sharing concerns with a maternity care professional can help you find support.'],
    [9,22,'mm','head to bottom','strawberry','Facial features are becoming more distinct while internal organs continue to develop.','Tiredness, nausea and changes in mood are among the possible experiences described by the NHS.'],
    [10,30,'mm','head to bottom','small apricot','Early ear and jaw structures are forming as facial development continues.','Hormonal changes may contribute to bloating and digestive discomfort.'],
    [11,41,'mm','head to bottom','fig','The fingers and toes are separating, and small nails are beginning to appear.','The NHS discusses stretching tissues and increased circulation. Significant pain needs clinical advice.'],
    [12,5.4,'cm','head to bottom','plum','The developing skeleton is beginning to harden into bone.','Bump size varies with several factors; appearance alone does not assess development.'],
    [13,7.4,'cm',null,'peach','Early movements are becoming more coordinated, and thumb-sucking may help develop the sucking reflex.','The growing uterus may make a small bump more noticeable.'],
    [14,8.5,'cm','head to bottom','kiwi fruit','The NHS describes swallowing fluid and developing kidney function.','Early breast milk, called colostrum, may become noticeable. Ask your care professional about concerning breast changes.'],
    [15,10.1,'cm','head to bottom','apple','Fine body hair, eyebrows and eyelashes are developing.','Itchy skin may occur. Worsening itching, especially at night, needs advice from your maternity care professional.'],
    [16,11.6,'cm','head to bottom','avocado','The developing nervous system supports movements of the arms and legs.','Constipation can contribute to bloating and abdominal discomfort.'],
    [17,12,'cm','head to bottom','pomegranate','The NHS describes emerging fingernails and individual fingerprint patterns.','Discuss sadness or anxiety with your care professional; support is available.'],
    [18,14.2,'cm','head to bottom','bell pepper','Sensory abilities and swallowing and sucking reflexes continue developing.','A growing bump may affect balance. Some people begin noticing flutter-like movements around this stage.'],
    [19,15.3,'cm','head to bottom','beef tomato','The NHS describes the beginnings of adult teeth behind the first set.','Sleep disruption and changing physical comfort are discussed in this week’s guide.'],
    [20,25.6,'cm','head to heel','banana','A protective coating called vernix is developing on the skin.','Leg cramps may disturb sleep. The guide also discusses the mid-pregnancy scan.'],
    [21,26.7,'cm','head to toe','carrot','Fine body hair and eyebrows continue developing, and sounds outside the womb may be heard.','A growing bump and looser joints may affect balance. Tell your maternity care professional if you fall.'],
    [22,27.8,'cm','head to toe','sweet potato','The lungs continue developing, with breathing-like practice movements described by the NHS.','Stretch marks may appear on the abdomen, thighs or breasts.'],
    [23,28.9,'cm','head to heel','large mango','The limbs are becoming more proportionate. Movement patterns are an important topic in the NHS guide.','Rib discomfort and changes in breathing comfort may occur. Discuss symptoms that concern you with your care professional.'],
    [24,30,'cm','head to heel','corn on the cob','The NHS discusses proportionate growth and specialist care for babies born prematurely.','Bump appearance varies between pregnancies; it is not a growth measurement.'],
    [25,34.6,'cm','head to heel','courgette','The NHS describes activity and possible hiccups during this stage.','New swelling warrants clinical advice. Severe headache, visual changes or pain below the ribs need prompt medical attention.'],
    [26,35.6,'cm','head to heel','cucumber','The eyes begin opening around this stage; eye colour can continue changing after birth.','Contact your maternity care team immediately if established movements slow, change or stop.'],
    [27,36.6,'cm','head to heel','head of cauliflower','Fat accumulation changes the skin’s appearance while organs continue maturing.','Bloating and constipation are possible experiences as pregnancy progresses.'],
    [28,37.6,'cm','head to heel','aubergine','The NHS discusses changes in heart rate during development. This guide does not assess a personal heart rate.','Heartburn and back discomfort may occur. Have swelling or other worrying changes checked by your care professional.'],
    [29,38.6,'cm','head to heel','butternut squash','Organ maturation and fat accumulation continue during the later weeks.','Sleep may be disrupted by discomfort or leg cramps. Report changes in established movements to your maternity care team.'],
    [30,39.9,'cm','head to heel','cabbage','The eyes can focus, with vision continuing to develop before and after birth.','Sleep difficulties or vivid dreams may occur. Share ongoing stress with your care professional.'],
    [31,41.1,'cm','head to heel','coconut','The NHS describes movement, increasing body fat and recognition of voices from outside the womb.','Your care professional may assess growth and position; HerDay does neither.'],
    [32,42.4,'cm','head to heel','bunch of celery','The guide describes continued weight gain during the coming weeks.','Established movements should continue. Contact your maternity care team promptly if the pattern changes or movements stop.'],
    [33,43.7,'cm','head to heel','pineapple','Bones continue hardening while skull bones remain more flexible.','Practice contractions may feel like tightening. Painful or regular contractions need advice from your maternity care team.'],
    [34,45,'cm','head to heel','cantaloupe melon','The NHS describes a curled position within the womb at this stage.','A lower position in the pelvis may change discomfort, but does not by itself establish that labour is imminent.'],
    [35,46.2,'cm','head to heel','honeydew melon','Increasing body fat supports temperature regulation after birth.','Colostrum may be noticeable before birth. Contact your maternity care team if established movements change or stop.'],
    [36,47.4,'cm','head to heel','romaine lettuce','The guide discusses later development of breathing, sucking and digestion. These capabilities cannot be confirmed by HerDay.','A head-down position does not determine when labour will begin. Your care professional can assess position.'],
    [37,48.6,'cm','head to heel','leek','Facial expressions may occur, without indicating emotions such as happiness or sadness.','Practice contractions and changes in discharge may occur. Your care team can advise about possible labour symptoms.'],
    [38,49.8,'cm','head to heel','stick of rhubarb','Much of the fine body hair has disappeared; material for the first stool collects in the bowel.','The NHS discusses late-pregnancy checks and planning with a maternity care professional.'],
    [39,50.7,'cm','head to heel','watermelon','The skin develops a more substantial protective layer; vernix may still be present at birth.','A mucus “show” does not precisely predict delivery timing. Discuss concerning changes with your care team.'],
    [40,51.2,'cm','head to heel','pumpkin','The NHS emphasises continued usual movements near the estimated due date.','Contact your maternity care team immediately if established movements change or stop.'],
    [41,null,null,null,'small pumpkin or watermelon','The NHS discusses care after the estimated due date, including monitoring and possible induction with your maternity team.','Review the next steps with your maternity care professional. An elapsed estimated due date does not establish delivery.']
  ];
  const records=new Map(rows.map(([week,value,unit,basis,comparison,topic,you])=>{
    const trimester=week<13?1:week<28?2:3;
    const length=value===null?null:Object.freeze({value,unit,basis});
    const weight=week===41?Object.freeze({min:3,max:4,unit:'kg'}):null;
    return [week,Object.freeze({week,trimester,length,weight,comparison,topic,you,
      source:index+`${trimester===1?'1st':trimester===2?'2nd':'3rd'}-trimester/week-${week}/`,verifiedOn:'2026-10-13'})];
  }));
  function get(week){return Number.isInteger(week)?records.get(week)||null:null;}
  // Only assign trimester information within the publisher's verified week range.
  function trimester(week){return get(week)?.trimester||null;}
  const available=Object.freeze(Array.from(records.keys()));
  const disclaimer='General educational reference only. Timing and development vary. This is not a measurement of your baby, a fetal wellbeing assessment, diagnosis or personalised medical advice.';
  return Object.freeze({get,trimester,available,index,disclaimer});
})();
if(typeof module!=='undefined'&&module.exports)module.exports=herdayPregnancyWeeks;
