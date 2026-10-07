/* Approved visual reference content only. These are not backend IDs, accounts,
 * a permanent taxonomy, persisted counts or published production records. */
const POETRY_REFERENCE = (() => {
  const photo = name => `assets/poetry/reference-content/${name}.png`;
  const ayeshaPoem = `Tum se roshan hai dil ka har kona,
Tum se mehka hai khwabon ka raasta.

Khamosh raaton mein jab dil tanha ho,
Teri yaad ban jaati hai ek narm sada.

Hawa jab dheere se chehra chhoo jaaye,
Lagta hai tera paighaam le kar aayi hai.

Har subah mein tera ek rang milta hai,
Har shaam teri yaadon mein dhal jaati hai.

Faaslay chahe kitne bhi darmiyan rahen,
Dil ka raasta tum tak hi jaata hai.

Kuch lafz kehne se reh jaate hain,
Magar dil har baar tumhara naam leta hai.`;
  const zaraPoem = `Raat ki khamoshi mein dil ne teri baat ki,
Chand ne chupke se meri tanhai ka saath diya.

Subah hui to yaadon ka diya phir bhi jalta raha,
Dil ne phir teri yaad ko chupke se apna kaha.

Hawa mein aaj bhi wohi pehchani si khushboo hai,
Jaise koi purani baat phir se yaad aayi ho.

Bheegi hui raat ne jab khirki ko chhoo liya,
Dil ne tera naam bina awaaz ke pukara.

Kuch yaadein waqt ke saath kam nahi hotin,
Bas dil ke kisi kone mein aur gehri ho jaati hain.`;
  const commentsA = [
    {author:'Sara Khan',time:'1h',avatar:photo('sara'),body:'Beautiful lines ❤️'},
    {author:'Hira Ali',time:'45m',avatar:photo('hira-ali'),body:'Aakhri stanza bohat khoobsurat hai.'}
  ];
  const commentsZ = [
    {author:'Maha Ali',time:'1h',avatar:photo('maha'),body:'Raat wali feeling bohat khoobsurat likhi hai. ❤️'},
    {author:'Sana Malik',time:'35m',avatar:photo('sana'),body:'Ye lines seedha dil tak gayin.'}
  ];
  const posts = [
    {key:'main-ayesha',author:'Ayesha Noor',avatar:photo('main-ayesha'),time:'2h ago',category:'Love',title:'Tum Se Roshan Hai Dil',
      preview:'Tumhari yaad ki khushboo abhi tak dil mein rehti hai. Har ek khamosh lamha chupke se tumhara naam kehta hai. Tum door ho magar meri har shaam tum se roshan hai.',
      likes:124,commentCount:18,order:6,detail:{avatar:photo('detail-ayesha'),time:'2h',poem:ayeshaPoem,likes:128,commentCount:24,comments:commentsA}},
    {key:'main-zara',author:'Zara Ahmed',avatar:photo('main-zara'),time:'4h ago',category:'Reflection',title:'Raat Se Dil Ki Guftagu',
      preview:'Raat ki khamoshi mein dil ne teri baat ki. Chand ne chupke se meri tanhai ka saath diya. Subah hui to yaadon ka diya phir bhi jalta raha. Dil ne phir teri yaad ko chupke se apna kaha.',
      image:photo('flower-post'),thumbnail:photo('main-flower-thumbnail'),imageAlt:'Pink flowers in warm evening light',likes:98,commentCount:12,order:5,
      detail:{avatar:photo('detail-zara'),time:'4h',poem:zaraPoem,comments:commentsZ}},
    {key:'popular-maya',author:'Maya Khan',avatar:photo('maya'),time:'1d ago',category:'Friendship',title:'Dosti Ka Narm Saaya',
      preview:'Teri hansi se meri udaas shaam sanwarti hai. Dosti chupke se dil ka bojh baant leti hai.',likes:256,commentCount:32,order:2},
    {key:'popular-noor',author:'Noor Fatima',avatar:photo('noor'),time:'1d ago',category:'Longing',title:'Bheegi Shaam Ki Yaad',
      preview:'Barish aayi to phir tum yaad aaye. Bheegi hawa mein dil ne tumhein pukara, tum yaad aaye.',
      image:photo('popular-flower'),imageAlt:'A pink flower',likes:214,commentCount:24,order:1},
    {key:'category-ayesha',author:'Ayesha Noor',avatar:photo('category-ayesha'),time:'2h',category:'Love',title:'Tum Se Roshan Hai Dil',
      preview:'Tum se roshan hai dil ka har kona,\nTum se mehka hai khwabon ka raasta.\nTeri yaad aaye to dil yun muskuraye,\nJaise subah ne chhoo liya ho andhera.',
      likes:128,commentCount:24,order:6,detail:{avatar:photo('detail-ayesha'),poem:ayeshaPoem,comments:commentsA}},
    {key:'category-mehak',author:'Mehak Ali',avatar:photo('mehak'),time:'5h',category:'Love',title:'Dil Ki Baat',
      preview:'Kuch baatein lafzon mein dhalti nahi,\nBas aankhon se dil tak utar jaati hain.\n\nTera naam jab khamoshi mein aaye,\nHar dhadkan ek nazm ban jaati hai.',
      image:photo('rose-post'),imageAlt:'A soft pink rose with dew',likes:96,commentCount:20,order:4},
    {key:'category-hira',author:'Hira Khan',avatar:photo('hira-khan'),time:'Yesterday',category:'Love',title:'Tera Khayal',
      preview:'Shaam dhalti hai to tera khayal aata hai,\nDil ko phir ek purana sawaal aata hai.\nDoor reh kar bhi tu itna kareeb kyun hai,\nHar dua mein tera hi naam aata hai.',
      likes:214,commentCount:32,order:3}
  ];
  return Object.freeze({
    categories:['Love','Friendship','Hope','Reflection','Heartbreak','Life & Emotions','Dreams & Cherished Memories','Self Love','Family','Motivation'],
    categorySubtitles:{Love:'Words from the heart, written with love.'},
    posts,
    mainKeys:['main-ayesha','main-zara'],
    popularKeys:['popular-maya','popular-noor'],
    categoryKeys:['category-ayesha','category-mehak','category-hira','popular-maya','main-zara','popular-noor']
  });
})();
