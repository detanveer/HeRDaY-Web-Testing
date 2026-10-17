/* One pagination control and header structure across rendered pages and async lists. */
(()=>{
 let pending=false,lastRoute=S.route,lastOwner=currentUser()?.id||null;
 function apply(){
  const root=document.querySelector('#beautyApp');if(!root)return;
  for(const header of root.querySelectorAll('.gs-header,.ex-header,.rr-header,.ds-header')){
   const title=[...header.children].find(el=>el.tagName==='H1');if(!title)continue;
   const copy=[...header.children].find(el=>el.tagName==='P'),group=document.createElement('div');group.className='herday-heading';title.before(group);group.append(title);if(copy)group.append(copy);
  }
  const explicit='[data-mod-more],[data-ex-action="more"],[data-gs-action="more-feed"],[data-gs-action="more-comments"],[data-saved-more],[data-inbox-more],[data-public-more],[data-diary-action="more"],[data-diary-action="calendar-more"]';
  for(const button of root.querySelectorAll('button')){
   if(!button.matches(explicit)&&!button.hasAttribute('data-herday-load-more')&&!/^load\s+more(?:\s|$)/i.test(button.textContent.trim()))continue;
   if(!button.hasAttribute('data-herday-load-more')){button.setAttribute('data-herday-load-more','');if(!button.hasAttribute('aria-label'))button.setAttribute('aria-label',button.textContent.trim()==='Loading…'?'Load More':button.textContent.trim());}
   button.classList.add('herday-load-more');const label=button.disabled?'Loading…':'Load More';if(button.textContent!==label)button.textContent=label;button.setAttribute('aria-busy',String(button.disabled));
  }
  const owner=currentUser()?.id||null;if(S.route!==lastRoute||owner!==lastOwner)document.querySelector('dialog.herday-comment-options')?.remove();lastRoute=S.route;lastOwner=owner;
 }
 const previous=render;render=function(){previous();apply();};
 const root=document.querySelector('#beautyApp');if(root)new MutationObserver(()=>{if(pending)return;pending=true;queueMicrotask(()=>{pending=false;apply();});}).observe(root,{childList:true,subtree:true,attributes:true,attributeFilter:['disabled']});
 apply();
})();
