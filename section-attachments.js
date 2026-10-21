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
  function add(context,files,limit=5) {
    const entries=collection(context);
    if(!owner)throw new Error('Please log in to attach images.');
    if(entries.some(entry=>entry.uploading))throw new Error('Wait for the current upload to finish.');
    const selected=Array.from(files);
    if(entries.length+selected.length>limit)throw new Error('Select no more than '+limit+' photos.');
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
  async function prepareProductPhoto(file){
    // Only seller-uploaded product photos; approved app/Library assets remain untouched.
    const url=URL.createObjectURL(file),image=new Image();
    try{
      await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Photo could not be decoded. Choose another image.')),15000);image.onload=()=>{clearTimeout(timer);resolve();};image.onerror=()=>{clearTimeout(timer);reject(Error('Photo could not be read.'));};image.src=url;});
      const width=image.naturalWidth,height=image.naturalHeight;
      if(!width||!height)throw Error('Photo dimensions unavailable.');
      if(file.size<=1048576&&width<=2048&&height<=2048)return file;
      const ratio=Math.min(1,2048/Math.max(width,height));const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(width*ratio));canvas.height=Math.max(1,Math.round(height*ratio));
      const ctx=canvas.getContext('2d');if(!ctx)throw Error('Photo preparation unavailable.');ctx.drawImage(image,0,0,canvas.width,canvas.height);
      let blob;for(const quality of [.85,.75,.65,.55]){blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',quality));if(!blob)throw Error('Photo preparation failed.');if(blob.size<=1048576)break;}
      if(!blob||blob.size>10*1048576)throw Error('Photo is too large. Choose a smaller photo.');
      if(width<=4096&&height<=4096&&blob.size>=file.size)return file;
      return new File([blob],file.name.replace(/\.[^.]+$/,'')+(blob.type==='image/webp'?'.webp':'.png'),{type:blob.type,lastModified:file.lastModified});
    }finally{image.src='';URL.revokeObjectURL(url);}
  }
  async function upload(context,section,conversationId=null,onProgress=null) {
    if(!['girls_space','explore','buy_sell','messages'].includes(section))throw new Error('Invalid attachment section.');
    const entries=collection(context),author=owner;
    if(!author)throw new Error('Please log in to upload images.');
    if(entries.some(entry=>entry.uploading))throw new Error('Your images are already being uploaded.');
    // Mark the whole batch before any await so files cannot be changed mid-submit.
    entries.forEach(entry=>entry.uploading=true);
    try {
      for(const [index,entry] of entries.entries()) {
        if(entry.key)continue;
        if(onProgress)onProgress(index+1,entries.length);
        if(section==='buy_sell'&&!entry.prepared){entry.file=await prepareProductPhoto(entry.file);entry.prepared=true;}

        const {data,error}=await herdayMediaSession();
        if(error)throw error;
        const session=data?.session;
        if(session?.user?.id!==author || !session.access_token)throw new Error('Session changed. Reopen the post.');
        const body=new FormData();if(section==='messages'){if(!HERDAY_UUID.test(conversationId||''))throw Error('Invalid conversation.');body.append('conversation_id',conversationId);}body.append('section',section);body.append('file',entry.file);body.append('upload_id',entry.id);
        const worker=(window.HERDAY_MEDIA_WORKER || 'https://herday-media-api.urduwaveblog.workers.dev').replace(/\/+$/,'');
        // Existing bounded retry transport; same file bytes and upload UUID each time.
        const response=await herdayUploadFetch(worker,body,session.access_token);
        const result=await response.json();
        reset();if(owner!==author)throw new Error('Session changed. Reopen the post.');
        const ext={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[entry.file.type];
        const expected=section==='messages'?`messages/${conversationId}/${author}/${entry.id}.${ext}`:`pending/${section}/${author}/${entry.id}.${ext}`;
        if(!response.ok || result?.ok!==true || result.section!==section || result.status!==(section==='messages'?'private':'pending') || result.key!==expected || result.size!==entry.file.size || !Number.isInteger(result.width) || !Number.isInteger(result.height) || result.width<1 || result.height<1 || result.width>4096 || result.height>4096)throw new Error(result?.error || 'Image upload could not be confirmed.');
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
