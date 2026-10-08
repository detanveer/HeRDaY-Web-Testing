/* HerDay R2 opt-in test only. No production UI integration. */
(() => {
  'use strict';
  const SUPABASE_URL = 'https://mxokajwumvkdtdnjqkhw.supabase.co';
  const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_EcHg4SrOtEP5EgVOCG9ylQ_WLkQjcyC';
  const WORKER_URL = 'https://herday-media-api.urduwaveblog.workers.dev';
  const workerBase = () => WORKER_URL;
  const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
  const $ = id => document.getElementById(id);
  const log = value => { $('output').textContent = typeof value === 'string' ? value : JSON.stringify(value, null, 2); };
  let uploadedKey = null;
  async function session() {
    const {data, error} = await client.auth.getSession();
    if (error || !data.session?.access_token) throw Error('Log in to HerDay in this browser first, then reload this page.');
    return data.session.access_token;
  }
  async function request(path, options = {}) {
    const headers = new Headers(options.headers || {});
    if (options.auth) headers.set('Authorization', 'Bearer ' + await session());
    const res = await fetch(workerBase() + path, {method: options.method || 'GET', headers, body: options.body});
    if (options.blob && res.ok) return {status:res.status, blob:await res.blob()};
    const text = await res.text();
    let data; try {data = JSON.parse(text);} catch {data = {message:text.slice(0, 300)};}
    if (!res.ok) throw Error(`HTTP ${res.status}: ${data.error || data.message || 'Request failed'}`);
    return {status:res.status, data};
  }
  $('health').onclick = async () => { try {log(await request('/health'));} catch(e) {log('Health failed: ' + e.message + '\nCheck Worker URL and allowed CORS origin.');} };
  $('upload').onclick = async () => {
    $('upload').disabled = true;
    try {
      const file = $('file').files[0];
      if (!file || !['image/jpeg','image/png','image/webp'].includes(file.type) || file.size < 1 || file.size > 5*1048576) throw Error('Choose a JPEG/PNG/WebP file up to 5 MB.');
      const form = new FormData(); form.append('section','profile'); form.append('file',file);
      const result = await request('/v1/upload',{auth:true,method:'POST',body:form});
      uploadedKey = result.data.key;
      $('read').disabled = false;
      log({upload:'PASS',http_status:result.status,section:result.data.section,status:result.data.status,width:result.data.width,height:result.data.height,key:uploadedKey});
    } catch(e) {log('Upload failed: ' + e.message);} finally {$('upload').disabled = false;}
  };
  $('read').onclick = async () => {
    try {
      if (!uploadedKey) throw Error('Upload a test image first.');
      const result = await request('/v1/private?key=' + encodeURIComponent(uploadedKey),{auth:true,blob:true});
      if (!['image/jpeg','image/png','image/webp'].includes(result.blob.type)) throw Error('Unexpected private media content type.');
      const imageUrl = URL.createObjectURL(result.blob);
      if ($('preview').dataset.objectUrl) URL.revokeObjectURL($('preview').dataset.objectUrl);
      $('preview').dataset.objectUrl = imageUrl;
      $('preview').src = imageUrl;
      $('preview').hidden = false;
      log({private_read:'PASS',http_status:result.status,content_type:result.blob.type,size_bytes:result.blob.size});
    } catch(e) {log('Private read failed: ' + e.message);}
  };
  client.auth.getUser().then(async ({data, error}) => {const user = data?.user; let loggedIn = false; if (!error && user) {const result = await client.from('profiles').select('role').eq('id',user.id).single(); loggedIn = !result.error && result.data?.role === 'admin';} if (!loggedIn) { $('health').disabled=true; $('read').disabled=true; }  $('session').textContent = loggedIn ? 'Supabase session found (authentication not yet tested against Worker).' : 'Admin session not verified. Log in as Admin on the main Web App first.'; $('upload').disabled = !loggedIn;}).catch(e => {$('session').textContent = 'Session check failed: ' + e.message;});
})();
