/* Original-byte image transport for Girls' Space / Explore; approved Library assets untouched. */
const herdaySectionAttachments = (() => {
  const collections=new Map();
  let owner=null;
  function reset() {
    const next=currentUser()?.id || null;
    if(next!==owner){for(const entries of collections.values())for(const entry of entries)URL.revokeObjectURL(entry.preview);collections.clear();owner=next;}
  }
  function collection(context) {
    reset();if(!context || typeof context!=='string')throw new Error('Invalid attachment context.');
    if(!collections.has(context))collections.set(context,[]);
    return collections.get(context);
  }
  function add(context,files) {
    const entries=collection(context);
    if(!owner)throw new Error('Please log in to attach images.');
    if(entries.some(entry=>entry.uploading))throw new Error('Wait for the current upload to finish.');
    const selected=Array.from(files);
    if(entries.length+selected.length>5)throw new Error('Select no more than five photos.');
    if(selected.some(file=>!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size<1 || file.size>10*1048576))throw new Error('Use JPG, PNG or WebP images up to 10 MB.');
    for(const file of selected)entries.push({file,id:crypto.randomUUID(),preview:URL.createObjectURL(file),key:null,uploading:false});
    return entries;
  }
  function remove(context,id) {
    const entries=collection(context),index=entries.findIndex(entry=>entry.id===id);
    if(index<0)return;
    if(entries.some(entry=>entry.uploading))throw new Error('Wait for the current upload to finish.');
    URL.revokeObjectURL(entries[index].preview);entries.splice(index,1);
  }
  function clear(context) {
    const entries=collection(context);
    if(entries.some(entry=>entry.uploading))throw new Error('Wait for the current upload to finish.');
    entries.forEach(entry=>URL.revokeObjectURL(entry.preview));collections.delete(context);
  }
  async function upload(context,section) {
    if(!['girls_space','explore'].includes(section))throw new Error('Invalid attachment section.');
    const entries=collection(context),author=owner;
    if(!author)throw new Error('Please log in to upload images.');
    if(entries.some(entry=>entry.uploading))throw new Error('Your images are already being uploaded.');
    // Mark the whole batch before any await so files cannot be changed mid-submit.
    entries.forEach(entry=>entry.uploading=true);
    try {
      for(const entry of entries) {
        if(entry.key)continue;
        const {data,error}=await herdaySession();
        if(error)throw error;
        const session=data?.session;
        if(session?.user?.id!==author || !session.access_token)throw new Error('Session changed. Reopen the post.');
        const body=new FormData();body.append('section',section);body.append('file',entry.file);body.append('upload_id',entry.id);
        const worker=(window.HERDAY_MEDIA_WORKER || 'https://herday-media-api.urduwaveblog.workers.dev').replace(/\/+$/,'');
        // Existing bounded retry transport; same file bytes and upload UUID each time.
        const response=await herdayUploadFetch(worker,body,session.access_token);
        const result=await response.json();
        reset();if(owner!==author)throw new Error('Session changed. Reopen the post.');
        const ext={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[entry.file.type];
        const expected=`pending/${section}/${author}/${entry.id}.${ext}`;
        if(!response.ok || result?.ok!==true || result.section!==section || result.status!=='pending' || result.key!==expected || result.size!==entry.file.size || !Number.isInteger(result.width) || !Number.isInteger(result.height) || result.width<1 || result.height<1 || result.width>4096 || result.height>4096)throw new Error(result?.error || 'Image upload could not be confirmed.');
        entry.key=result.key;
      }
      return entries.map(entry=>entry.key);
    } finally {entries.forEach(entry=>entry.uploading=false);}
  }
  function previews(context) {
    return collection(context).map(entry=>`<div class="gs-photo"><img src="${esc(entry.preview)}" alt="Selected photo preview"><button type="button" data-gs-remove-image="${esc(entry.id)}" aria-label="Remove selected photo">×</button></div>`).join('');
  }
  return {reset,collection,add,remove,clear,upload,previews};
})();
