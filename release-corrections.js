/* Shared reading rules and correction lifecycle. No backend permissions are replaced here. */
function herdayPostPreview(body,limit=300){
 const text=String(body||'').trim().replace(/\s*\n\s*/g,' ').replace(/[ \t]{2,}/g,' '),chars=[...text];
 return chars.length>limit?chars.slice(0,limit).join('').trimEnd()+'…':text;
}
function herdayTopicName(key){return {discussions:'Girls’ Discussions',personal_stories:'Personal Stories',advice_support:'Advice & Support',celebrate_inspire:'Celebrate & Inspire'}[key]||'';}
function herdayOwnAvatar(className){const user=currentUser(),name=[user?.firstName,user?.lastName].filter(Boolean).join(' ')||'User';return `<span class="${className}" aria-hidden="true">${user?.photo?`<img src="${esc(user.photo)}" alt="" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><span hidden>${esc(herdaySectionFeed.initials(name))}</span>`:esc(herdaySectionFeed.initials(name))}</span>`;}
function herdayBeautyAvatar(provider){return `<div class="avatar">${provider.photo?`<img src="${esc(provider.photo)}" alt="${esc(provider.name)}" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><span hidden>♙</span>`:'♙'}</div>`;}
function herdayPostOptions(post){
 if(!post)return;document.querySelector('dialog.herday-post-options')?.remove();
 const dialog=document.createElement('dialog');dialog.className='herday-post-options';dialog.setAttribute('aria-label','Post options');
 function action(label,fn){const button=document.createElement('button');button.type='button';button.textContent=label;button.onclick=()=>{dialog.close();dialog.remove();void fn();};dialog.append(button);}
 action('Report',()=>herdayReports.open(post.id));
 if(currentUser()?.id===post.author_id)action('Manage my post',()=>nav(post.section_key==='explore'?'explore-mine':'my-posts'));
 if(isAdmin())action('Delete Post',async()=>{const deleted=await herdayDeletePost(post.id);if(deleted){herdaySavedReset();if(post.section_key==='explore'){herdayExplore.invalidate();await nav('explore');}else if(post.section_key==='girls_space'){herdaySectionFeed.reset();await herdaySectionFeed.load('girls_space',post.detail_key,{refresh:true});await nav('gs-feed',{gsTopic:post.detail_key});}}});
 action('Cancel',()=>{});dialog.addEventListener('close',()=>dialog.remove(),{once:true});document.body.append(dialog);dialog.showModal();
}
// Reset navigation state on every render, including history navigation and Home.
function herdaySyncNavigation(){
 const route=S.route,active=route==='home'?0:route.startsWith('explore')?1:['user-profile','admin-profile','account-settings','change-password','my-posts','saved-posts','my-beauty','notifications','public-user'].includes(route)||isAdminRoute(route)?4:0;
 document.querySelectorAll('body>.nav>div').forEach((item,index)=>{item.dataset.current=String(index===active);if(index===active)item.setAttribute('aria-current','page');else item.removeAttribute('aria-current');});
 document.querySelectorAll('#homePage [role=button]:not([onkeydown])').forEach(el=>{el.onkeydown=e=>{if(e.target===el&&['Enter',' '].includes(e.key)){e.preventDefault();el.click();}};});
 if(route==='home'){document.body.style.removeProperty('overflow');document.documentElement.style.removeProperty('overflow');}
 herdayGirlsSocial.reserveNavigation();
}
const herdayRenderBeforeRelease=render;
render=function(){herdayRenderBeforeRelease();herdaySyncNavigation();};
// A password recovery link must open the password form after its session is restored.
let herdayRecovery=false,herdayAuthRevision=0;
supabaseClient.auth.onAuthStateChange((event,session)=>{
 if(event==='PASSWORD_RECOVERY')herdayRecovery=true;
 if(!['SIGNED_OUT','SIGNED_IN','PASSWORD_RECOVERY','USER_UPDATED'].includes(event))return;
 const revision=++herdayAuthRevision;
 setTimeout(async()=>{
  if(revision!==herdayAuthRevision)return;
  if(event==='SIGNED_OUT'){herdayRecovery=false;herdayAccountLoadSerial++;ACTIVE_AUTH_USER=null;ACTIVE_ACCOUNT=null;ADMIN_PENDING=[];ADMIN_APPROVED=[];herdaySavedReset();render();return;}
  if(!session?.user)return;
  if(event!=='PASSWORD_RECOVERY'&&session.user.id===currentUser()?.id&&event!=='USER_UPDATED')return;
  try{await loadCurrentAccount();if(revision!==herdayAuthRevision)return;if(herdayRecovery){S.route='change-password';save();}render();}catch{if(revision===herdayAuthRevision){ACTIVE_AUTH_USER=null;ACTIVE_ACCOUNT=null;S.route='login';render();}}
 },0);
});
const herdayBootstrapBeforeRecovery=bootstrapSupabase;
bootstrapSupabase=async function(){await herdayBootstrapBeforeRecovery();if(herdayRecovery&&currentUser()){S.route='change-password';save();render();}};
