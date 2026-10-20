/**
 * HerDay R2 API + private Diary recovery email
 * R2 Bindings: MEDIA_BUCKET -> herday-media; PRIVATE_BUCKET -> herday-private
 * Variables: SUPABASE_URL, PUBLIC_MEDIA_BASE_URL, ALLOWED_ORIGINS
 * Secrets: SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
 * Diary recovery only: secret RESEND_API_KEY; variable RESEND_FROM_EMAIL
 * RESEND_FROM_EMAIL must be a sender on your verified Resend domain.
 * Requires verified HerDay-Private-Diary-Recovery.sql RPCs.
 * Diary media: DIARY_MEDIA_ENABLED=true after verified SQL; scheduled cleanup trigger required.
 * Public publishing requires an approved Supabase submission.
 * Admin deletion/publication coordination requires HerDay-Admin-Post-Deletion.sql.
 */

const MB = 1048576;
const MAX_PROFILE = 5 * MB;
const MAX_IMAGE = 10 * MB;
const MAX_REQUEST = 11 * MB;

const SECTION = new Set([
  'poetry',
  'explore',
  'girls_space',
  'buy_sell'
]);

const TYPES = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp'
};

const te = new TextEncoder();
const td = new TextDecoder();

const j = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff'
    }
  });

const fail = (msg, status) => j({ error: msg }, status);

const b64 = s => {
  const raw = atob(
    s.replace(/-/g, '+')
      .replace(/_/g, '/')
      .padEnd(Math.ceil(s.length / 4) * 4, '=')
  );
  return Uint8Array.from(raw, c => c.charCodeAt(0));
};

const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function origin(req, env) {
  const o = req.headers.get('origin');
  if (!o) return null;

  return (
    env.ALLOWED_ORIGINS ||
    'https://appherday.com,https://www.appherday.com,https://web.appherday.com'
  ).split(',').map(x => x.trim()).includes(o) ? o : null;
}

function cors(req, env) {
  const o = origin(req, env);

  return o ? {
    'access-control-allow-origin': o,
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': new URL(req.url).pathname.startsWith('/v1/diary/media/') ? 'Authorization,Content-Type,Range,X-Diary-Proof,X-Diary-Media,X-Diary-Request,X-Diary-Part' : 'Authorization,Content-Type',
    ...(new URL(req.url).pathname.startsWith('/v1/diary/media/') ? {'access-control-expose-headers':'Content-Length,Content-Range,Accept-Ranges'} : {}),
    'vary': 'Origin'
  } : {};
}

function wrap(resp, req, env) {
  const h = new Headers(resp.headers);

  Object.entries(cors(req, env)).forEach(
    ([k, v]) => h.set(k, v)
  );

  return new Response(resp.body, {
    status: resp.status,
    headers: h
  });
}

function config(env) {
  return !!(
    env.MEDIA_BUCKET &&
    env.PRIVATE_BUCKET &&
    /^https:\/\/[a-z0-9]+\.supabase\.co\/?$/.test(
      env.SUPABASE_URL || ''
    ) &&
    typeof env.SUPABASE_ANON_KEY === 'string' &&
    env.SUPABASE_ANON_KEY.length > 20 &&
    typeof env.SUPABASE_SERVICE_ROLE_KEY === 'string' &&
    env.SUPABASE_SERVICE_ROLE_KEY.length > 20 &&
    /^https:\/\//.test(env.PUBLIC_MEDIA_BASE_URL || '')
  );
}

async function jwt(req, env) {
  const m = /^Bearer ([A-Za-z0-9._-]+)$/.exec(
    req.headers.get('authorization') || ''
  );

  if (!m) {
    throw Object.assign(
      Error('Authentication required'),
      { status: 401 }
    );
  }

  let parts, h, p;

  try {
    parts = m[1].split('.');
    if (parts.length !== 3) throw 0;

    h = JSON.parse(td.decode(b64(parts[0])));
    p = JSON.parse(td.decode(b64(parts[1])));
  } catch {
    throw Object.assign(
      Error('Invalid JWT'),
      { status: 401 }
    );
  }

  const iss =
    env.SUPABASE_URL.replace(/\/$/, '') + '/auth/v1';

  const now = Math.floor(Date.now() / 1000);

  if (
    h.alg !== 'ES256' ||
    typeof h.kid !== 'string' ||
    p.iss !== iss ||
    p.aud !== 'authenticated' ||
    p.role !== 'authenticated' ||
    !uuid.test(p.sub || '') ||
    !Number.isFinite(p.exp) ||
    p.exp <= now ||
    (p.nbf !== undefined && p.nbf > now + 30)
  ) {
    throw Object.assign(
      Error('Invalid JWT claims'),
      { status: 401 }
    );
  }

  const r = await fetch(
    iss + '/.well-known/jwks.json',
    {signal:AbortSignal.timeout(10000),redirect:'error'}
  );

  if (!r.ok) {
    throw Object.assign(
      Error('Signing keys unavailable'),
      { status: 503 }
    );
  }

  const keys = (await r.json()).keys || [];

  const k = keys.find(x =>
    x.kid === h.kid &&
    x.kty === 'EC' &&
    x.crv === 'P-256' &&
    x.x &&
    x.y &&
    (!x.alg || x.alg === 'ES256')
  );

  if (!k) {
    throw Object.assign(
      Error('Signing key unavailable'),
      { status: 401 }
    );
  }

  const key = await crypto.subtle.importKey(
    'jwk',
    k,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['verify']
  );

  const signature = b64(parts[2]);

  if (signature.length !== 64) {
    throw Object.assign(
      Error('Invalid JWT signature'),
      { status: 401 }
    );
  }

  const valid = await crypto.subtle.verify(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    signature,
    te.encode(parts[0] + '.' + parts[1])
  );

  if (!valid) {
    throw Object.assign(
      Error('Invalid JWT signature'),
      { status: 401 }
    );
  }

  return {
    id: p.sub,
    session: uuid.test(p.session_id || '') ? p.session_id : null,
    token: m[1]
  };
}

/**
 * User RPC: anon API key + user JWT
 * Admin operation: service-role API key + service-role authorization
 * @param {any} env
 * @param {string} path
 * @param {{method?: string, token?: string, body?: unknown, admin?: boolean}} [options]
 */
async function supa(
  env,
  path,
  { method = 'GET', token, body, admin = false } = {}
) {
  const apiKey = admin
    ? env.SUPABASE_SERVICE_ROLE_KEY
    : env.SUPABASE_ANON_KEY;

  if (
    typeof apiKey !== 'string' ||
    !apiKey.length ||
    (!admin && !token)
  ) {
    throw Object.assign(
      Error('Supabase credentials missing'),
      { status: 503 }
    );
  }

  // This table insert needs confirmation of HTTP success, not a JSON result.
  const minimalMediaInsert = admin && method === 'POST' &&
    path.startsWith('/rest/v1/herday_media_uploads');

  const headers = {
    'apikey': apiKey,
    // Modern secret keys belong in apikey, never in a JWT Bearer header.
    ...(!admin || apiKey.startsWith('eyJ') ? {authorization:'Bearer '+(admin?apiKey:token)} : {}),
    'accept': 'application/json',
    'cache-control': 'no-store'
  };

  if (body !== undefined) {
    headers['content-type'] = 'application/json';
  }

  if (minimalMediaInsert) {
    headers['prefer'] = 'return=minimal,resolution=ignore-duplicates';
  }

  const r = await fetch(
    env.SUPABASE_URL.replace(/\/$/, '') + path,
    {
      method,
      headers,
      signal: AbortSignal.timeout(15000),
      redirect: 'error',
      body: body === undefined
        ? undefined
        : JSON.stringify(body)
    }
  );

  if (!r.ok) {
    // Diagnostic only: never log credentials, request bodies or database messages.
    let diagnosticCode = null;
    try {
      const detail = await r.clone().json();
      if (/^(?:[0-9A-Z]{5}|PGRST[0-9]{3})$/.test(detail?.code || '')) diagnosticCode = detail.code;
    } catch {}
    console.error('HERDAY_DIAGNOSTIC', JSON.stringify({
      stage: 'supabase-response', status: r.status, code: diagnosticCode,
      operation: path.split('?')[0]
    }));
    throw Object.assign(
      Error('Supabase authorization or data operation failed'),
      {
        status: r.status === 401
          ? 401
          : r.status === 403
            ? 403
            : 502
      }
    );
  }

  return r.status === 204 || minimalMediaInsert ? null : r.json();
}

async function active(env, user) {
  const ok = await supa(
    env,
    '/rest/v1/rpc/is_active_user',
    {
      method: 'POST',
      token: user.token,
      body: {}
    }
  );

  if (ok !== true) {
    throw Object.assign(
      Error('Account inactive'),
      { status: 403 }
    );
  }
}

function dimensions(b, m) {
  if (m === 'image/png') {
    if (
      b.length < 24 ||
      ![137, 80, 78, 71, 13, 10, 26, 10]
        .every((x, i) => b[i] === x) ||
      td.decode(b.slice(12, 16)) !== 'IHDR'
    ) return null;

    const v = new DataView(
      b.buffer,
      b.byteOffset,
      b.byteLength
    );

    return [
      v.getUint32(16),
      v.getUint32(20)
    ];
  }

  if (m === 'image/webp') {
    if (
      b.length < 30 ||
      td.decode(b.slice(0, 4)) !== 'RIFF' ||
      td.decode(b.slice(8, 12)) !== 'WEBP'
    ) return null;

    const tag = td.decode(b.slice(12, 16));

    if (tag === 'VP8X') {
      return [
        1 + b[24] + (b[25] << 8) + (b[26] << 16),
        1 + b[27] + (b[28] << 8) + (b[29] << 16)
      ];
    }

    if (tag === 'VP8L' && b[20] === 0x2f) {
      return [
        1 + (((b[22] & 0x3f) << 8) | b[21]),
        1 + (
          ((b[24] & 0x0f) << 10) |
          (b[23] << 2) |
          ((b[22] & 0xc0) >> 6)
        )
      ];
    }

    if (
      tag === 'VP8 ' &&
      b.length >= 30 &&
      b[23] === 0x9d &&
      b[24] === 0x01 &&
      b[25] === 0x2a
    ) {
      return [
        (b[26] | b[27] << 8) & 0x3fff,
        (b[28] | b[29] << 8) & 0x3fff
      ];
    }

    return null;
  }

  if (m === 'image/jpeg') {
    if (
      b.length < 4 ||
      b[0] !== 255 ||
      b[1] !== 216
    ) return null;

    let i = 2;

    while (i + 4 < b.length) {
      if (b[i] !== 255) return null;

      while (b[i] === 255) i++;

      const marker = b[i++];

      if (marker === 0xd9 || marker === 0xda) break;

      if (
        marker === 0x01 ||
        (marker >= 0xd0 && marker <= 0xd7)
      ) continue;

      if (i + 2 > b.length) break;

      const n = (b[i] << 8) | b[i + 1];

      if (n < 2 || i + n > b.length) break;

      if (
        [
          0xc0, 0xc1, 0xc2, 0xc3,
          0xc5, 0xc6, 0xc7,
          0xc9, 0xca, 0xcb,
          0xcd, 0xce, 0xcf
        ].includes(marker) &&
        n >= 7
      ) {
        return [
          (b[i + 5] << 8) | b[i + 6],
          (b[i + 3] << 8) | b[i + 4]
        ];
      }

      i += n;
    }

    return null;
  }

  return null;
}

function own(key, user) {
  const a = key.split('/');

  return (
    a.length === 3 &&
    a[0] === 'profiles' &&
    a[1] === user.id
  ) || (
    a.length === 4 &&
    a[0] === 'pending' &&
    SECTION.has(a[1]) &&
    a[2] === user.id
  );
}

async function upload(req, env, user) {
  console.info('HERDAY_DIAGNOSTIC upload-start');
  const lengthHeader =
    req.headers.get('content-length');

  const length = lengthHeader === null
    ? null
    : Number(lengthHeader);

  if (
    length !== null &&
    (
      !Number.isSafeInteger(length) ||
      length < 0 ||
      length > MAX_REQUEST
    )
  ) {
    return fail('Request too large', 413);
  }

  if (
    !/^multipart\/form-data\s*;/i.test(
      req.headers.get('content-type') || ''
    )
  ) {
    return fail('multipart/form-data required', 415);
  }

  const chunks = [];
  let total = 0;

  const reader = req.body?.getReader();

  if (!reader) {
    return fail('Missing request body', 400);
  }

  while (true) {
    const { done, value } = await reader.read();

    if (done) break;

    total += value.byteLength;

    if (total > MAX_REQUEST) {
      await reader.cancel();
      return fail('Request too large', 413);
    }

    chunks.push(value);
  }

  const bounded = new Uint8Array(total);
  let offset = 0;

  for (const chunk of chunks) {
    bounded.set(chunk, offset);
    offset += chunk.byteLength;
  }

  let form;

  try {
    form = await new Request(req.url, {
      method: 'POST',
      headers: {
        'content-type':
          req.headers.get('content-type')
      },
      body: bounded
    }).formData();
  } catch {
    return fail('Malformed multipart body', 400);
  }

  console.info('HERDAY_DIAGNOSTIC multipart-parsed');
  const file = form.get('file');
  const section = String(
    form.get('section') || ''
  );

  if (!(file instanceof File)) {
    return fail('Image required', 400);
  }

  const profile = section === 'profile';
  const message = section === 'messages';
  const conversation = String(form.get('conversation_id') || '');
  if(message){
    if(!uuid.test(conversation))return fail('Invalid conversation',400);
    const allowed=await supa(env,'/rest/v1/rpc/herday_conversation_allowed_v1',{method:'POST',token:user.token,body:{p_id:conversation}});
    if(allowed!==true)return fail('Conversation unavailable',403);
  }

  if (!profile && !message && !SECTION.has(section)) {
    return fail('Invalid section', 400);
  }

  const limit = profile
    ? MAX_PROFILE
    : MAX_IMAGE;

  const mime = file.type.toLowerCase();

  if (file.size < 1 || file.size > limit) {
    return fail('Image size limit exceeded', 413);
  }

  if (!Object.hasOwn(TYPES, mime)) {
    return fail(
      'Only JPEG, PNG or WebP images are allowed',
      415
    );
  }

  const bytes = new Uint8Array(
    await file.arrayBuffer()
  );

  const d = dimensions(bytes, mime);

  if (
    !d ||
    d[0] < 1 ||
    d[1] < 1 ||
    d[0] > 4096 ||
    d[1] > 4096
  ) {
    return fail(
      'Invalid image or dimensions exceed 4096 x 4096',
      415
    );
  }

  const uploadId = String(form.get("upload_id") || "");
  if(uploadId && !uuid.test(uploadId)) return fail("Invalid upload ID",400);
  const fingerprint=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",bytes)),b=>b.toString(16).padStart(2,"0")).join("");
  const key = `${
    profile
      ? 'profiles'
      : message ? 'messages/' + conversation : 'pending/' + section
  }/${user.id}/${uploadId || crypto.randomUUID()}.${TYPES[mime]}`;

  const previous = uploadId ? await env.PRIVATE_BUCKET.head(key) : null;
  if(previous){
    if(previous.customMetadata?.owner!==user.id || previous.customMetadata?.section!==section || previous.customMetadata?.fingerprint!==fingerprint)return fail('Upload ID already used for another image',409);
    if(message){const registered=await supa(env,'/rest/v1/rpc/herday_message_media_register_v1',{method:'POST',admin:true,body:{p_owner:user.id,p_conversation:conversation,p_key:key,p_mime:mime,p_size:file.size,p_fingerprint:fingerprint}});if(registered!==true)return fail('Attachment registration unavailable',409);}
    else if(!profile){const registered=await supa(env,'/rest/v1/rpc/'+(section==='buy_sell'?'herday_product_upload_lookup_v1':'herday_upload_lookup_v2'),{method:'POST',token:user.token,body:section==='buy_sell'?{p_key:key}:{p_key:key,p_section:section}});if(registered!==true)return fail('Upload already attached or registration incomplete',409);}
    return j({ok:true,key,section,status:profile||message?'private':'pending',size:file.size,width:d[0],height:d[1]},200);
  }
  console.info('HERDAY_DIAGNOSTIC private-r2-put-start');
  await env.PRIVATE_BUCKET.put(key, bytes, {
    httpMetadata: {
      contentType: mime,
      cacheControl: 'private, no-store'
    },
    customMetadata: {
      owner: user.id,
      fingerprint,
      section,
      created: new Date().toISOString()
    }
  });

  console.info('HERDAY_DIAGNOSTIC private-r2-put-success');
  if(message){
    const registered=await supa(env,'/rest/v1/rpc/herday_message_media_register_v1',{method:'POST',admin:true,body:{p_owner:user.id,p_conversation:conversation,p_key:key,p_mime:mime,p_size:file.size,p_fingerprint:fingerprint}});
    if(registered!==true)return fail('Attachment registration unavailable',409);
  }
  if (!profile && !message) {
    try {
      console.info('HERDAY_DIAGNOSTIC media-registration-start');
      await supa(
        env,
        '/rest/v1/herday_media_uploads?on_conflict=object_key',
        {
          method: 'POST',
          admin: true,
          body: {
            object_key: key,
            owner_id: user.id,
            section_key: section,
            mime_type: mime,
            size_bytes: file.size
          }
        }
      );
      console.info('HERDAY_DIAGNOSTIC media-registration-success');
    } catch (e) {
      console.info('HERDAY_DIAGNOSTIC upload-rollback-start');
      if(!uploadId)await env.PRIVATE_BUCKET.delete(key);
      console.info('HERDAY_DIAGNOSTIC upload-rollback-success');
      throw e;
    }
  }

  return j({
    ok: true,
    key,
    section,
    status: profile || message ? 'private' : 'pending',
    size: file.size,
    width: d[0],
    height: d[1]
  }, 201);
}

async function read(req, env, user, url) {
  const key = url.searchParams.get('key') || '';

  if (!own(key, user)) {
    return fail('Forbidden', 403);
  }

  const obj = await env.PRIVATE_BUCKET.get(key);

  if (!obj) {
    return fail('Not found', 404);
  }

  if (obj.customMetadata?.owner !== user.id) {
    return fail('Forbidden', 403);
  }

  return new Response(obj.body, {
    headers: {
      'content-type':
        obj.httpMetadata?.contentType ||
        'application/octet-stream',
      'cache-control': 'private, no-store',
      'x-content-type-options': 'nosniff',
      'content-security-policy':
        "default-src 'none'; sandbox"
    }
  });
}

// ADDED: authenticated, server-authorized pending-image moderation preview.
// No moderation review count quota is imposed.
async function moderationPreview(req, env, user, url) {
  const key = url.searchParams.get('key') || '';

  const match = /^pending\/(poetry|explore|girls_space)\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.(jpg|png|webp)$/i.exec(key);

  if (!match) {
    return fail('Invalid pending image key', 400);
  }

  const allowed = await supa(
    env,
    '/rest/v1/rpc/herday_authorize_submission_media_preview',
    {
      method: 'POST',
      token: user.token,
      body: { p_object_key: key }
    }
  );

  if (allowed !== true) {
    return fail('Forbidden', 403);
  }

  const obj = await env.PRIVATE_BUCKET.get(key);

  if (!obj) {
    return fail('Not found', 404);
  }

  const mime = obj.httpMetadata?.contentType;

  if (
    obj.customMetadata?.owner !== match[2] ||
    obj.customMetadata?.section !== match[1] ||
    !Object.hasOwn(TYPES, mime) ||
    TYPES[mime] !== match[4] ||
    obj.size < 1 ||
    obj.size > MAX_IMAGE
  ) {
    return fail('Private image metadata mismatch', 409);
  }

  return new Response(obj.body, {
    headers: {
      'content-type': mime,
      'cache-control': 'private, no-store',
      'x-content-type-options': 'nosniff',
      'content-security-policy': "default-src 'none'; sandbox",
      'content-disposition': 'inline'
    }
  });
}


// Bounded JSON parsing for the new operation wrappers.
async function mediaOperationBody(req) {
  const reader = req.body?.getReader();
  if (!reader) throw Object.assign(Error('JSON body required'), { status: 400 });
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 4096) {
      await reader.cancel();
      throw Object.assign(Error('JSON request too large'), { status: 413 });
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  let body;
  try { body = JSON.parse(td.decode(bytes)); }
  catch { throw Object.assign(Error('Invalid JSON'), { status: 400 }); }
  if (!uuid.test(body?.submission_id || '')) {
    throw Object.assign(Error('Invalid submission_id'), { status: 400 });
  }
  return body;
}

async function publish(req, env, user) {
  const body = await mediaOperationBody(req);
  const id = body.submission_id;
  // User JWT: existing section approve permission is checked in Supabase.
  const rows = await supa(env, '/rest/v1/rpc/herday_begin_media_publication', {
    method: 'POST', token: user.token, body: { p_submission_id: id }
  });
  if (!Array.isArray(rows) || rows.length !== 1 ||
      rows[0].submission_id !== id || !uuid.test(rows[0].operation_id || '')) {
    return fail('Invalid publication operation', 409);
  }
  const item = rows[0];
  try {
    return await publishManifest(env, user, id, item);
  } finally {
    // Release only after all R2 writes/rollback have finished. No timed expiry.
    const released = await supa(env, '/rest/v1/rpc/herday_finish_media_publication', {
      method: 'POST', admin: true,
      body: { p_submission_id: id, p_operation_id: item.operation_id }
    });
    if (released !== true) {
      throw Object.assign(Error('Publication operation requires reconciliation'), { status: 503 });
    }
  }
}

async function deleteContent(req, env, user, ownerRejected = false, moderatorDelete = false) {
  const body = await mediaOperationBody(req);
  if (body.confirm !== true) return fail('Deletion confirmation required', 400);
  const id = body.submission_id;
  // An active Admin must authorize the exact submission, never arbitrary keys.
  // This transaction removes DB content and leaves a durable cleanup manifest.
  const rows = await supa(env, '/rest/v1/rpc/'+(ownerRejected?'herday_owner_begin_rejected_deletion':moderatorDelete?'herday_moderator_begin_deletion_v2':'herday_admin_begin_content_deletion'), {
    method: 'POST', token: user.token, body: moderatorDelete?{p_submission_id:id,p_reason:body.reason}:{ p_submission_id: id }
  });
  if (!Array.isArray(rows) || rows.length !== 1) return fail('Deletion unavailable', 409);
  const item = rows[0];
  if (item.submission_id !== id || !uuid.test(item.deletion_id || '') ||
      !uuid.test(item.author_id || '') || !SECTION.has(item.section_key) ||
      !Array.isArray(item.object_keys) || item.object_keys.length > 5 ||
      new Set(item.object_keys).size !== item.object_keys.length) {
    return fail('Invalid deletion manifest', 409);
  }
  const prefix = `pending/${item.section_key}/${item.author_id}/`;
  for (const key of item.object_keys) {
    if (typeof key !== 'string' || !key.startsWith(prefix) ||
        !/^pending\/(poetry|explore|girls_space)\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/i.test(key)) {
      return fail('Invalid deletion ownership key', 409);
    }
    const privateObject = await env.PRIVATE_BUCKET.head(key);
    const publicObject = await env.MEDIA_BUCKET.head(key);
    if ((privateObject && (privateObject.customMetadata?.owner !== item.author_id ||
                           privateObject.customMetadata?.section !== item.section_key)) ||
        (publicObject && (publicObject.customMetadata?.owner !== item.author_id ||
                         publicObject.customMetadata?.section !== item.section_key ||
                         publicObject.customMetadata?.submission_id !== id))) {
      return fail('Media ownership mismatch; cleanup requires reconciliation', 409);
    }
  }
  // Missing objects are allowed on retries; deletion is idempotent.
  for (const key of item.object_keys) {
    await env.MEDIA_BUCKET.delete(key);
    await env.PRIVATE_BUCKET.delete(key);
  }
  for (const key of item.object_keys) {
    if (await env.MEDIA_BUCKET.head(key) || await env.PRIVATE_BUCKET.head(key)) {
      throw Object.assign(Error('Media cleanup incomplete'), { status: 503 });
    }
  }
  const complete = await supa(env, '/rest/v1/rpc/herday_finish_content_media_deletion', {
    method: 'POST', admin: true,
    body: { p_submission_id: id, p_deletion_id: item.deletion_id }
  });
  if (complete !== true) {
    throw Object.assign(Error('Deletion completion requires reconciliation'), { status: 503 });
  }
  return j({ ok: true, submission_id: id, status: 'deleted', media_cleanup: 'complete' });
}

async function publishManifest(env, user, id, item) {
  const keys = item.object_keys;

  if (
    item.submission_id !== id ||
    !SECTION.has(item.section_key) ||
    !uuid.test(item.author_id || '') ||
    !Array.isArray(keys) ||
    keys.length > 5 ||
    new Set(keys).size !== keys.length
  ) {
    return fail('Invalid manifest', 409);
  }

  const prefix =
    `pending/${item.section_key}/${item.author_id}/`;

  const objects = [];

  for (const key of keys) {
    if (
      typeof key !== 'string' ||
      !key.startsWith(prefix) ||
      !/^pending\/(poetry|explore|girls_space)\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp)$/i.test(key)
    ) {
      return fail('Invalid ownership key', 409);
    }

    const obj = await env.PRIVATE_BUCKET.get(key);

    if (
      !obj ||
      obj.customMetadata?.owner !== item.author_id ||
      obj.customMetadata?.section !== item.section_key
    ) {
      return fail(
        'Private image missing or mismatched',
        409
      );
    }

    const ct = obj.httpMetadata?.contentType;

    if (
      !Object.hasOwn(TYPES, ct) ||
      !key.endsWith('.' + TYPES[ct]) ||
      obj.size < 1 ||
      obj.size > MAX_IMAGE
    ) {
      return fail('Invalid private media', 409);
    }

    objects.push({
      key,
      obj,
      ct
    });
  }

  if (keys.length) {
    const filter = new URLSearchParams({
      select:
        'object_key,owner_id,section_key,submission_id,mime_type,size_bytes',
      submission_id: `eq.${id}`,
      owner_id: `eq.${item.author_id}`,
      section_key: `eq.${item.section_key}`
    });

    const registrations = await supa(
      env,
      '/rest/v1/herday_media_uploads?' +
        filter.toString(),
      {
        admin: true
      }
    );

    if (
      !Array.isArray(registrations) ||
      registrations.length !== keys.length
    ) {
      return fail(
        'Media registration mismatch',
        409
      );
    }

    const byKey = new Map(
      registrations.map(r => [
        r.object_key,
        r
      ])
    );

    for (const { key, obj, ct } of objects) {
      const r = byKey.get(key);

      if (
        !r ||
        r.mime_type !== ct ||
        Number(r.size_bytes) !== obj.size
      ) {
        return fail(
          'Media registration mismatch',
          409
        );
      }
    }
  }

  // R2 and Postgres do not share an atomic transaction.
  // Roll back only objects created by this attempt.
  const created = [];

  try {
    for (const { key, obj, ct } of objects) {
      const existing =
        await env.MEDIA_BUCKET.head(key);

      if (existing) {
        if (
          existing.customMetadata?.submission_id !== id ||
          existing.customMetadata?.owner !== item.author_id
        ) {
          throw Error('Conflicting public object');
        }

        continue;
      }

      await env.MEDIA_BUCKET.put(
        key,
        obj.body,
        {
          httpMetadata: {
            contentType: ct,
            cacheControl: 'public, max-age=300'
          },
          customMetadata: {
            submission_id: id,
            owner: item.author_id,
            section: item.section_key
          }
        }
      );

      created.push(key);
    }

    const confirm = await supa(
      env,
      '/rest/v1/rpc/herday_get_publish_manifest',
      {
        method: 'POST',
        token: user.token,
        body: {
          p_submission_id: id
        }
      }
    );

    if (
      !Array.isArray(confirm) ||
      confirm.length !== 1 ||
      confirm[0].submission_id !== id ||
      confirm[0].section_key !== item.section_key ||
      confirm[0].author_id !== item.author_id ||
      JSON.stringify(confirm[0].object_keys) !==
        JSON.stringify(keys)
    ) {
      throw Error(
        'Approval changed during publication'
      );
    }
  } catch (e) {
    for (const key of created) {
      try {
        await env.MEDIA_BUCKET.delete(key);
      } catch {
        // Manual reconciliation may be required.
      }
    }

    throw Object.assign(
      Error(
        'Publishing failed; check R2 for partial objects'
      ),
      { status: 503 }
    );
  }

  return j({
    ok: true,
    submission_id: id,
    published_keys: keys,
    base_url: env.PUBLIC_MEDIA_BASE_URL
  });
}

async function cleanupEdit(req,env,user){
 const body=await mediaOperationBody(req),id=body.submission_id;
 const job=await supa(env,'/rest/v1/rpc/herday_media_cleanup_manifest_v2',{method:'POST',token:user.token,body:{p_id:id}});
 if(!job||job.id!==id||!uuid.test(job.author_id||'')||!SECTION.has(job.section_key)||!Array.isArray(job.object_keys)||job.object_keys.length>5)return fail('Cleanup unavailable',403);
 for(const key of job.object_keys){
  if(typeof key!=='string'||!key.startsWith(`pending/${job.section_key}/${job.author_id}/`)||!/^pending\/(poetry|explore|girls_space)\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp)$/i.test(key))return fail('Invalid cleanup key',409);
  for(const bucket of [env.PRIVATE_BUCKET,env.MEDIA_BUCKET]){const obj=await bucket.head(key);if(obj&&(obj.customMetadata?.owner!==job.author_id||obj.customMetadata?.section!==job.section_key))return fail('Media ownership mismatch',409);}
 }
 for(const key of job.object_keys){await env.PRIVATE_BUCKET.delete(key);await env.MEDIA_BUCKET.delete(key);if(await env.PRIVATE_BUCKET.head(key)||await env.MEDIA_BUCKET.head(key))return fail('Cleanup incomplete',502);}
 await supa(env,'/rest/v1/rpc/herday_finish_edit_cleanup_v2',{method:'POST',admin:true,body:{p_id:id}});
 return j({ok:true,cleanup_id:id,media_cleanup:'complete'});
}


/* Private Diary email dispatch. No recipient/owner/session override from body. */
function diaryMailConfigured(env) {
  return typeof env.RESEND_API_KEY === 'string' && env.RESEND_API_KEY.startsWith('re_') && env.RESEND_API_KEY.length > 10 &&
    typeof env.RESEND_FROM_EMAIL === 'string' && env.RESEND_FROM_EMAIL.length <= 254 &&
    /^[A-Za-z0-9.!#$%&'*+\/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?$/.test(env.RESEND_FROM_EMAIL) &&
    !/[\r\n]/.test(env.RESEND_FROM_EMAIL);
}
async function diaryRecoveryBody(req) {
  if (!/^application\/json(?:\s*;|$)/i.test(req.headers.get('content-type') || '')) {
    throw Object.assign(Error('JSON request required'), { status: 415 });
  }
  const reader = req.body?.getReader();
  if (!reader) throw Object.assign(Error('Request ID required'), { status: 400 });
  let size = 0, chunks = [];
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 1024) { await reader.cancel(); throw Object.assign(Error('Request too large'), { status: 413 }); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  let body;
  try { body = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
  catch { throw Object.assign(Error('Invalid JSON request'), { status: 400 }); }
  if (!body || typeof body !== 'object' || Array.isArray(body) ||
    Object.keys(body).length !== 1 || !Object.hasOwn(body, 'request_id') || !uuid.test(body.request_id || '')) {
    throw Object.assign(Error('Only a valid request_id is accepted'), { status: 400 });
  }
  return body;
}
function diaryCodeEmail(code) {
  // Versioned fixed email body keeps same-request provider retries identical.
  const text = 'HerDay — My Diary\n\nYour verification code is: ' + code +
    '\n\nUse this code in HerDay to create a new Diary PIN. It expires 10 minutes after your request.\n' +
    'Never share this code. HerDay will never ask you to send your PIN or verification code to anyone.\n' +
    'If you did not request this reset, you can ignore this email. Your existing PIN has not changed.\n\nHerDay';
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#FFF8FA;font-family:Arial,sans-serif;color:#360018"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FFF8FA"><tr><td align="center" style="padding:32px 16px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#FFFDFD;border:1px solid #E8B9CC;border-radius:20px"><tr><td style="padding:32px"><div style="font-size:28px;font-weight:700;color:#C91656">HerDay</div><p style="margin:8px 0 28px;color:#70456B;font-size:14px">Your private world, just for you.</p><h1 style="font-size:24px;line-height:1.35;margin:0 0 16px">Reset your Diary PIN</h1><p style="font-size:16px;line-height:1.65">Use this verification code in HerDay to create a new Diary PIN.</p><div style="padding:24px 12px;margin:24px 0;background:#FFF8FA;border:1px solid #E8B9CC;border-radius:12px;text-align:center;color:#C91656;font-family:monospace;font-size:32px;font-weight:700;letter-spacing:6px">${code}</div><p style="font-size:14px;line-height:1.65;color:#70456B">This code expires 10 minutes after your request. Never share it. HerDay will never ask you to send your PIN or verification code to anyone.</p><p style="font-size:14px;line-height:1.65;color:#70456B">If you did not request this reset, you can ignore this email. Your existing PIN has not changed.</p><div style="border-top:1px solid #E8B9CC;margin-top:28px;padding-top:20px;color:#853879;font-size:13px;line-height:1.5">Private to your HerDay account.</div></td></tr></table></td></tr></table></body></html>`;
  return { subject: 'Your HerDay verification code', html, text };
}
async function diaryRecoverySend(req, env, user) {
  if (!diaryMailConfigured(env)) return fail('Diary email configuration incomplete', 503);
  if (!user.session) return fail('Valid Auth session required', 401);
  const body = await diaryRecoveryBody(req);
  // User JWT authorizes current verified owner/email/session before server operation.
  await supa(env, '/rest/v1/rpc/herday_get_diary_recovery', { method: 'POST', token: user.token, body: {} });
  const job = await supa(env, '/rest/v1/rpc/herday_begin_diary_recovery', {
    method: 'POST', admin: true,
    body: { p_owner: user.id, p_session: user.session, p_request_id: body.request_id }
  });
  if (job?.ok !== true) {
    const limited = ['resend_cooldown', 'send_limit'].includes(job?.reason);
    return j({ error: limited ? 'Please wait before requesting another code' : 'Recovery challenge unavailable; reload recovery',
      reason: limited ? job.reason : 'challenge_unavailable',
      retry_after: limited && typeof job.retry_after === 'string' && Number.isFinite(Date.parse(job.retry_after)) ? job.retry_after : null }, limited ? 429 : 409);
  }
  if (!uuid.test(job.challenge_id || '') || !/^[0-9]{6}$/.test(job.code || '') ||
    typeof job.email !== 'string' || job.email.length > 254 || /[\r\n]/.test(job.email) ||
    !/^[^\s@]+@[^\s@]+$/.test(job.email) || typeof job.expires_at !== 'string' ||
    !Number.isFinite(Date.parse(job.expires_at)) || Date.parse(job.expires_at) <= Date.now()) {
    return fail('Recovery dispatch unavailable', 503);
  }
  const email = diaryCodeEmail(job.code);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  let accepted = false;
  try {
    const sent = await fetch('https://api.resend.com/emails', {
      method: 'POST', signal: controller.signal,
      headers: { 'authorization': 'Bearer ' + env.RESEND_API_KEY, 'content-type': 'application/json',
        'Idempotency-Key': 'herday-diary-recovery/' + user.id + '/' + body.request_id },
      body: JSON.stringify({ from: 'HerDay <' + env.RESEND_FROM_EMAIL + '>', to: [job.email], ...email })
    });
    if (sent.ok) { const data = await sent.json(); accepted = typeof data?.id === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(data.id); }
  } catch {
    // Never log recipient/code/provider response. Same request ID can be retried.
  } finally { clearTimeout(timeout); }
  if (!accepted) return fail('Email send could not be confirmed; retry the same request', 503);
  const marked = await supa(env, '/rest/v1/rpc/herday_mark_diary_recovery_delivery', {
    method: 'POST', admin: true,
    body: { p_owner: user.id, p_session: user.session, p_request_id: body.request_id, p_challenge_id: job.challenge_id }
  });
  if (marked !== true) return fail('Recovery confirmation changed; reload recovery', 409);
  // Provider acceptance is NOT a claim of mailbox delivery. No email/code in response.
  return j({ ok: true, request_id: body.request_id, challenge_id: job.challenge_id,
    code_expires_at: job.expires_at, send_status: 'accepted', replayed: job.replayed === true });
}

/* Diary media additions begin. */
// Internal Worker module; NOT a standalone deployable Worker.
// serviceRPC is a trusted transport; user derives from verified signed JWT.
// Client must never select attempt IDs. No R2 work starts until acquire resolves.
async function acquireDiaryOperation(serviceRPC,user,proof,mediaId,operation,requestId){
 const attempt=crypto.randomUUID();
 const args={p_owner:user.id,p_session:user.session,p_proof:proof,p_media_id:mediaId,
  p_operation:operation,p_request_id:requestId,p_attempt_id:attempt};
 let acquired;
 try{acquired=await serviceRPC('herday_begin_diary_media_operation_v2',args);}
 catch{
  // This invocation has not touched R2. Look up only its own acquire transaction,
  // serialized behind the owner lock. Never release a competing attempt.
  let inspected;
  try{inspected=await serviceRPC('herday_inspect_diary_media_attempt',args);}
  catch{throw Object.assign(Error('Media authorization outcome unavailable; retry status.'),{status:503});}
  if(inspected?.owned===true){
   const expectedKey=`diary/${user.id}/${mediaId}`;
   if(inspected.attempt_id!==attempt||inspected.media_id!==mediaId||inspected.operation!==operation
    ||inspected.object_key!==expectedKey||!validUUID(inspected.lease_id))
    throw Object.assign(Error('Operation acknowledgement unavailable.'),{status:503});
   // Only the matching no-R2-started attempt is released. Unknown release keeps its
   // fence; no new R2 operation or automatic timed unlock is attempted here.
   try{const r=await serviceRPC('herday_finish_diary_media_operation',{p_lease_id:inspected.lease_id});
    if(r?.released!==true)throw Error();}
   catch{throw Object.assign(Error('Media authorization outcome unavailable; retry status.'),{status:503});}
  }
  throw Object.assign(Error(inspected?.busy===true?'Media operation awaiting confirmation.':'Retry media authorization.'),
   {status:inspected?.owned===false&&inspected?.busy===true?409:503});
 }
 if(acquired?.attempt_id!==attempt||acquired?.media_id!==mediaId
  ||acquired?.object_key!==`diary/${user.id}/${mediaId}`||!validUUID(acquired?.lease_id))
  throw Object.assign(Error('Operation acknowledgement unavailable.'),{status:503});
 return acquired;
}
function validUUID(x){return typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x);}

/* Private Diary transport. Only opaque IDs in responses; no proof/token in URLs. */
const DIARY_PART=8*1048576;
const DIARY_MIMES=new Set(['image/jpeg','image/png','image/webp','video/mp4','video/webm']);
function diaryErr(message,status=400){return Object.assign(Error(message),{status});}
function diaryRPC(env,name,args){return supa(env,'/rest/v1/rpc/'+name,{method:'POST',admin:true,body:args});}
async function diaryBytes(req,max){
 const rd=req.body?.getReader();if(!rd)throw diaryErr('Body required');let n=0;const chunks=[];
 try{while(true){const x=await rd.read();if(x.done)break;n+=x.value.byteLength;if(n>max){await rd.cancel();throw diaryErr('Body too large',413);}chunks.push(x.value);}}
 finally{rd.releaseLock();}const a=new Uint8Array(n);let pos=0;for(const x of chunks){a.set(x,pos);pos+=x.length;}return a;
}
async function diaryJSON(req,extra=[]){
 if(!/^application\/json(?:\s*;|$)/i.test(req.headers.get('content-type')||''))throw diaryErr('JSON required',415);
 let b;try{b=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(await diaryBytes(req,16384)));}catch(e){if(e?.status)throw e;throw diaryErr('Invalid JSON');}
 const keys=['media_id','request_id','proof',...extra];
 if(!b||typeof b!=='object'||Array.isArray(b)||Object.keys(b).some(k=>!keys.includes(k))
 ||!uuid.test(b.media_id||'')||!uuid.test(b.request_id||'')||!/^([0-9a-f]{64})$/.test(b.proof||''))throw diaryErr('Invalid private media request');
 return b;
}
async function diaryAcquire(env,user,b,mode){
 if(!user.session)throw diaryErr('Current Auth session required',401);
 const m=await acquireDiaryOperation((name,args)=>diaryRPC(env,name,args),user,b.proof,b.media_id,mode,b.request_id);
 if(!DIARY_MIMES.has(m.mime_type)||!Number.isSafeInteger(m.size_bytes)||m.size_bytes<1||m.size_bytes>250*1048576
 ||(m.mime_type.startsWith('image/')&&m.size_bytes>10*1048576)||!/^[0-9a-f]{64}$/.test(m.sha256_hex||''))throw diaryErr('Media metadata unavailable',503);
 return m;
}
async function diaryRelease(env,m,args={}){
 // Retry only the SAME lease/result, never reacquire or reissue R2 work here.
 const body={p_lease_id:m.lease_id,...args};let last;
 for(let i=0;i<2;i++){try{const r=await diaryRPC(env,'herday_finish_diary_media_operation',body);if(r?.released!==true)throw Error();return r;}catch(e){last=e;}}
 throw diaryErr('Media operation confirmation unavailable; reload status.',503);
}
function diaryOwnedObject(o,user,m){return !!o&&o.size===m.size_bytes&&o.customMetadata?.owner===user.id
 &&o.customMetadata?.media===m.media_id&&o.customMetadata?.sha256===m.sha256_hex&&o.httpMetadata?.contentType===m.mime_type;}
function diaryContainer(prefix,size){
 const s=(a,b)=>new TextDecoder().decode(prefix.subarray(a,b));
 if(prefix[0]===255&&prefix[1]===216&&prefix[2]===255)return 'image/jpeg';
 if([137,80,78,71,13,10,26,10].every((x,i)=>prefix[i]===x))return 'image/png';
 if(s(0,4)==='RIFF'&&s(8,12)==='WEBP'&&prefix.length>=16){const n=new DataView(prefix.buffer,prefix.byteOffset,prefix.byteLength).getUint32(4,true);
  if(n+8===size&&['VP8 ','VP8L','VP8X'].includes(s(12,16)))return 'image/webp';}
 if(prefix.length>=16&&s(4,8)==='ftyp'){
  const n=new DataView(prefix.buffer,prefix.byteOffset,prefix.byteLength).getUint32(0,false);
  if(n>=16&&n<=size&&['isom','iso2','iso3','iso4','iso5','iso6','mp41','mp42','avc1','M4V ','dash','MSNV'].includes(s(8,12)))return 'video/mp4';}
 // EBML DocType element must explicitly say webm (not merely Matroska signature).
 if(prefix[0]===26&&prefix[1]===69&&prefix[2]===223&&prefix[3]===163){
  for(let i=4;i+7<=prefix.length;i++)if(prefix[i]===0x42&&prefix[i+1]===0x82&&prefix[i+2]===0x84&&s(i+3,i+7)==='webm')return 'video/webm';}
 return null;
}
async function diaryVerifyObject(o,user,m){
 if(!diaryOwnedObject(o,user,m)||!o.body)throw diaryErr('Uploaded object metadata mismatch',409);
 const rd=o.body.getReader(),digest=new crypto.DigestStream('SHA-256'),writer=digest.getWriter(),prefix=new Uint8Array(Math.min(4096,m.size_bytes));let n=0;
 digest.digest.catch(()=>{});
 try{while(true){const x=await rd.read();if(x.done)break;if(n+x.value.length>m.size_bytes){await rd.cancel();throw diaryErr('Uploaded size mismatch',409);}
  if(n<prefix.length)prefix.set(x.value.subarray(0,Math.min(x.value.length,prefix.length-n)),n);await writer.write(x.value);n+=x.value.length;}await writer.close();}
 catch(e){await writer.abort().catch(()=>{});await rd.cancel().catch(()=>{});throw e;}
 finally{rd.releaseLock();writer.releaseLock();}
 const observed=[...new Uint8Array(await digest.digest)].map(x=>x.toString(16).padStart(2,'0')).join(''),mime=diaryContainer(prefix,n);return{bytes:n,sha256:observed,mime};
}
async function diaryReady(env,user,b){
 if(!uuid.test(b.draft_id||''))throw diaryErr('Draft ID required');
 const d=await supa(env,'/rest/v1/rpc/herday_get_diary_media',{method:'POST',token:user.token,body:{p_proof:b.proof,p_draft_id:b.draft_id}});
 if(!Array.isArray(d?.media))throw diaryErr('Media status unavailable',503);
 return d.media.some(m=>m.id===b.media_id&&m.status==='ready');
}
async function diaryMediaStart(req,env,user){
 const b=await diaryJSON(req,['draft_id']);if(await diaryReady(env,user,b))return j({ok:true,media_id:b.media_id,ready:true});
 const m=await diaryAcquire(env,user,b,'upload');
 if(m.upload_id){await diaryRelease(env,m);return j({ok:true,media_id:m.media_id,ready:false,part_bytes:DIARY_PART,part_count:Math.ceil(m.size_bytes/DIARY_PART)});}
 // Any unknown R2 outcome retains its lease; do not free quota by timed guesses.
 const u=await env.PRIVATE_BUCKET.createMultipartUpload(m.object_key,{httpMetadata:{contentType:m.mime_type,cacheControl:'no-store'},
 customMetadata:{owner:user.id,media:m.media_id,sha256:m.sha256_hex,kind:'diary'}});
 if(typeof u?.uploadId!=='string'||!u.uploadId)throw diaryErr('Multipart acknowledgement unavailable',503);
 await diaryRelease(env,m,{p_upload_id:u.uploadId});
 return j({ok:true,media_id:m.media_id,ready:false,part_bytes:DIARY_PART,part_count:Math.ceil(m.size_bytes/DIARY_PART)});
}
async function diaryMediaPart(req,env,user){
 const b={media_id:req.headers.get('x-diary-media'),request_id:req.headers.get('x-diary-request'),proof:req.headers.get('x-diary-proof')};
 const raw=req.headers.get('x-diary-part');
 if(!uuid.test(b.media_id||'')||!uuid.test(b.request_id||'')||!/^([0-9a-f]{64})$/.test(b.proof||'')||!/^\d{1,2}$/.test(raw||''))throw diaryErr('Invalid part request');
 if(req.headers.get('content-type')!=='application/octet-stream')throw diaryErr('Binary part required',415);
 const part=Number(raw),bytes=await diaryBytes(req,DIARY_PART); // Read/validate before lease; disconnect cannot strand an acquire.
 const m=await diaryAcquire(env,user,b,'upload');const total=Math.ceil(m.size_bytes/DIARY_PART),expected=Math.min(DIARY_PART,m.size_bytes-(part-1)*DIARY_PART);
 if(part<1||part>total||bytes.length!==expected||!m.upload_id){await diaryRelease(env,m);throw diaryErr('Invalid part number/length or upload not started');}
 const r=await env.PRIVATE_BUCKET.resumeMultipartUpload(m.object_key,m.upload_id).uploadPart(part,bytes);
 if(r?.partNumber!==part||typeof r.etag!=='string'||r.etag.length<1||r.etag.length>256)throw diaryErr('Part acknowledgement unavailable',503);
 await diaryRelease(env,m);return j({ok:true,media_id:m.media_id,part_number:part,etag:r.etag});
}
async function diaryMediaComplete(req,env,user){
 const b=await diaryJSON(req,['draft_id','parts']);if(await diaryReady(env,user,b))return j({ok:true,media_id:b.media_id,ready:true,replayed:true});
 if(!Array.isArray(b.parts)||b.parts.length<1||b.parts.length>32||b.parts.some((p,i)=>!p||Object.keys(p).length!==2
 ||p.partNumber!==i+1||typeof p.etag!=='string'||p.etag.length<1||p.etag.length>256))throw diaryErr('Invalid part manifest');
 const m=await diaryAcquire(env,user,b,'upload');
 if(!m.upload_id||b.parts.length!==Math.ceil(m.size_bytes/DIARY_PART)){await diaryRelease(env,m);throw diaryErr('Incomplete part manifest');}
 let o=await env.PRIVATE_BUCKET.head(m.object_key);
 if(!o)await env.PRIVATE_BUCKET.resumeMultipartUpload(m.object_key,m.upload_id).complete(b.parts);
 o=await env.PRIVATE_BUCKET.get(m.object_key);
 const v=await diaryVerifyObject(o,user,m);const valid=v.bytes===m.size_bytes&&v.sha256===m.sha256_hex&&v.mime===m.mime_type;
 const r=await diaryRelease(env,m,{p_complete:true,p_observed_size:v.bytes,p_observed_mime:v.mime,
 p_observed_sha256:v.sha256,p_etag:o.etag,p_owner:user.id,p_session:user.session,p_proof:b.proof});
 // A successful repeat release may return minimal ACK; read current private status.
 if(!valid||r.ready===false)throw diaryErr('File validation or private authorization failed; reload status.',409);
 if(!await diaryReady(env,user,b))throw diaryErr('Completion confirmation unavailable; reload status.',503);
 return j({ok:true,media_id:m.media_id,ready:true});
}
function diaryRange(raw,size){
 if(!raw)return null;const x=/^bytes=(\d*)-(\d*)$/.exec(raw);if(!x||(!x[1]&&!x[2]))throw diaryErr('Invalid byte range',416);
 let start,end;if(!x[1]){const suffix=Number(x[2]);if(!Number.isSafeInteger(suffix)||suffix<1)throw diaryErr('Invalid byte range',416);start=Math.max(0,size-suffix);end=size-1;}
 else{start=Number(x[1]);end=x[2]?Number(x[2]):size-1;}
 if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||start>=size||end<start)throw diaryErr('Invalid byte range',416);
 end=Math.min(end,size-1);return{offset:start,length:end-start+1};
}
async function diaryMediaRead(req,env,user,ctx){
 const b=await diaryJSON(req);
 const security=await supa(env,'/rest/v1/rpc/herday_get_diary_security',{method:'POST',token:user.token,body:{p_proof:b.proof}});
 const deadline=Date.parse(security?.unlock_expires_at||'');
 if(security?.unlocked!==true||!Number.isFinite(deadline)||deadline<=Date.now())throw diaryErr('Unlock Diary first',403);
 const m=await diaryAcquire(env,user,b,'read');let range;
 try{range=diaryRange(req.headers.get('range'),m.size_bytes);}catch(e){await diaryRelease(env,m);return new Response(null,{status:416,headers:{'content-range':`bytes */${m.size_bytes}`,'cache-control':'no-store'}});}
 const o=await env.PRIVATE_BUCKET.get(m.object_key,range?{range}:undefined);
 if(!diaryOwnedObject(o,user,m)||!o.body){if(o?.body)await o.body.cancel();await diaryRelease(env,m);throw diaryErr('Private media unavailable',404);}
 const rd=o.body.getReader();let settled=false,lastCheck=Date.now();const release=async()=>{if(settled)return;settled=true;await diaryRelease(env,m);};
 const background=()=>{const promise=release().catch(()=>{});if(ctx?.waitUntil)ctx.waitUntil(promise);return promise;};
 const body=new ReadableStream({async pull(controller){try{
  if(Date.now()>=deadline)throw Error('Unlock expired');
  if(Date.now()-lastCheck>=1000){const check=await diaryRPC(env,'herday_inspect_diary_media_attempt',{p_owner:user.id,p_session:user.session,p_proof:b.proof,p_media_id:m.media_id,p_operation:'read',p_request_id:b.request_id,p_attempt_id:m.attempt_id});
   if(check?.owned!==true||check.lease_id!==m.lease_id||Date.now()>=deadline)throw Error('Read authorization unavailable');lastCheck=Date.now();}
  const x=await rd.read();if(Date.now()>=deadline)throw Error('Unlock expired');if(x.done){rd.releaseLock();await background();controller.close();}else controller.enqueue(x.value);}
 catch{try{await rd.cancel();}finally{rd.releaseLock();await background();}controller.error(Error('Private read interrupted'));}},
 async cancel(reason){try{await rd.cancel(reason);}finally{rd.releaseLock();await background();}}});
 const headers={'content-type':m.mime_type,'content-length':String(range?range.length:m.size_bytes),'accept-ranges':'bytes',
 'cache-control':'private, no-store, max-age=0','pragma':'no-cache','x-content-type-options':'nosniff','content-security-policy':"default-src 'none'; sandbox",
 'referrer-policy':'no-referrer','content-disposition':'inline'};
 if(range)headers['content-range']=`bytes ${range.offset}-${range.offset+range.length-1}/${m.size_bytes}`;
 return new Response(body,{status:range?206:200,headers});
}
async function diaryMediaCleanup(env){
 const job=await diaryRPC(env,'herday_get_diary_media_cleanup',{p_limit:5});if(!Array.isArray(job?.jobs))throw Error('Cleanup unavailable');let finished=0,failed=0;
 for(const q of job.jobs){try{
  if(!uuid.test(q.id||'')||!uuid.test(q.owner_id||'')||q.object_key!==`diary/${q.owner_id}/${q.id}`)throw Error('Manifest invalid');
  const o=await env.PRIVATE_BUCKET.head(q.object_key);
  if(o&&(o.customMetadata?.owner!==q.owner_id||o.customMetadata?.media!==q.id||o.customMetadata?.kind!=='diary'))throw Error('Ownership mismatch');
  if(q.upload_id){try{await env.PRIVATE_BUCKET.resumeMultipartUpload(q.object_key,q.upload_id).abort();}
   catch(e){if(!/\(10024\)\s*$/.test(e?.message||''))throw e;}}
  await env.PRIVATE_BUCKET.delete(q.object_key);if(await env.PRIVATE_BUCKET.head(q.object_key))throw Error('Deletion unconfirmed');
  if(await diaryRPC(env,'herday_finish_diary_media_cleanup',{p_media_id:q.id})!==true)throw Error('Cleanup fenced');finished++;
 }catch{failed++;}}
 console.info('HERDAY_DIARY_CLEANUP',JSON.stringify({finished,failed}));return{finished,failed};
}

/* Seven-day expiry queue is opt-in and additionally gated by the V3 database
   policy switch (default false). Never accepts file keys or expiry dates from
   clients. SQL decides oldest-first under the shared owner/reservation lock.
   Existing cleanup verifies ownership and physical absence before releasing bytes. */
async function diaryScheduledCleanup(env){
 if(env.DIARY_STORAGE_EXPIRY_ENABLED==='true'){
  try{
   const r=await diaryRPC(env,'herday_expire_diary_paid_storage',{p_owner_limit:3,p_file_limit:10});
   if(!r||typeof r.enabled!=='boolean'||!Number.isInteger(r.owners)||r.owners<0||r.owners>3
    ||!Number.isInteger(r.removed_files)||r.removed_files<0||r.removed_files>30
    ||!Number.isSafeInteger(r.queued_bytes)||r.queued_bytes<0
    ||(!r.enabled&&(r.owners!==0||r.removed_files!==0||r.queued_bytes!==0)))throw Error('Expiry batch unavailable');
   console.info('HERDAY_DIARY_STORAGE_EXPIRY',JSON.stringify({enabled:r.enabled,owners:r.owners,removed_files:r.removed_files,queued_bytes:r.queued_bytes}));
  }catch{console.error('HERDAY_DIARY_STORAGE_EXPIRY_UNAVAILABLE');}
 }
 // Recovery of existing canceled/deleted media continues even if expiry is off
 // or its RPC is unavailable; Reports cleanup remains independently scheduled.
 return diaryMediaCleanup(env);
}

/* Diary media additions end. */
/* Shared report withdrawal: public copies only, exact durable batch provenance. */
function reportsConfigured(env) {
 try {const u=new URL(env.PUBLIC_MEDIA_BASE_URL);return env.REPORTS_MEDIA_ENABLED==='true'&&
 /^[a-f0-9]{32}$/i.test(env.REPORTS_ZONE_ID||'')&&typeof env.REPORTS_CACHE_PURGE_TOKEN==='string'&&
 env.REPORTS_CACHE_PURGE_TOKEN.length>0&&u.protocol==='https:'&&!u.username&&!u.password&&
 u.pathname==='/'&&!u.search&&!u.hash&&!!env.MEDIA_BUCKET&&!!env.PRIVATE_BUCKET;}catch{return false;}
}
const reportRPC=(env,name,body,token)=>supa(env,'/rest/v1/rpc/'+name,{method:'POST',body,...(token?{token}:{admin:true})});
function reportKey(key,m) {
 return typeof key==='string'&&['poetry','explore','girls_space'].includes(m.section_key)&&
 uuid.test(m.author_id||'')&&new RegExp('^pending/'+m.section_key+'/'+m.author_id+'/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[.](jpg|png|webp)$').test(key);
}
function reportManifest(m,id,attempt) {
 return m&&m.id===id&&m.complete===false&&m.attempt_id===attempt&&uuid.test(m.operation_id||'')&&
 uuid.test(m.submission_id||'')&&Number.isSafeInteger(m.processed_count)&&m.processed_count>=0&&
 Number.isSafeInteger(m.total_count)&&m.total_count>m.processed_count&&Array.isArray(m.keys)&&
 m.keys.length===Math.min(10,m.total_count-m.processed_count)&&new Set(m.keys).size===m.keys.length&&
 m.keys.every(k=>reportKey(k,m));
}
async function reportMediaBatch(env,id) {
 if(!reportsConfigured(env))throw Object.assign(Error('Report media configuration incomplete'),{status:503});
 const attempt=crypto.randomUUID();let m,valid=false,r2Uncertain=false,finishAttempted=false;
 const finish=success=>reportRPC(env,'herday_finish_report_media_batch',{p_job_id:id,p_attempt_id:attempt,
 p_operation_id:m.operation_id,p_expected_processed:m.processed_count,p_batch_count:m.keys.length,p_success:success});
 try {
  try{m=await reportRPC(env,'herday_begin_report_media_batch',{p_job_id:id,p_attempt_id:attempt});}
  catch(e){m=await reportRPC(env,'herday_inspect_report_media_attempt',{p_job_id:id,p_attempt_id:attempt});if(!m)throw e;}
  if(m?.id===id&&m.complete===true)return {ok:true,job_id:id,complete:true,processed_count:m.processed_count,total_count:m.total_count};
  valid=reportManifest(m,id,attempt);if(!valid)throw Error('Report media manifest requires reconciliation');
  for(const key of m.keys){
   const obj=await env.MEDIA_BUCKET.head(key);
   if(obj){if(obj.customMetadata?.submission_id!==m.submission_id||obj.customMetadata?.owner!==m.author_id||obj.customMetadata?.section!==m.section_key)
    throw Error('Public media ownership mismatch');
    // A rejected R2 promise may still have committed. Retain the fence in that case.
    r2Uncertain=true;await env.MEDIA_BUCKET.delete(key);r2Uncertain=false;
   }
   if(await env.MEDIA_BUCKET.head(key))throw Error('Public media deletion unconfirmed');
  }
  const base=new URL(env.PUBLIC_MEDIA_BASE_URL);
  const purge=await fetch('https://api.cloudflare.com/client/v4/zones/'+env.REPORTS_ZONE_ID+'/purge_cache',{
   method:'POST',headers:{authorization:'Bearer '+env.REPORTS_CACHE_PURGE_TOKEN,'content-type':'application/json'},
   body:JSON.stringify({prefixes:m.keys.map(k=>base.host+'/'+k)})});
  let ack;try{ack=await purge.json();}catch{throw Error('Cache purge unconfirmed');}
  if(!purge.ok||ack?.success!==true||!Array.isArray(ack.errors)||ack.errors.length)throw Error('Cache purge unconfirmed');
  // Once sent, never replace an uncertain successful finish with a failure release.
  finishAttempted=true;const done=await finish(true);
  if(done?.id!==id||done.processed_count!==m.processed_count+m.keys.length||
   done.total_count!==m.total_count||done.complete!==(done.processed_count===m.total_count))throw Error('Media completion unconfirmed');
  return {ok:true,job_id:id,complete:done.complete,processed_count:done.processed_count,total_count:done.total_count};
 } catch(e) {
  if(valid&&!r2Uncertain&&!finishAttempted){try{await finish(false);}catch{}}
  throw Object.assign(Error('Report media removal unfinished; reload status or reconcile the fenced attempt'),{status:503});
 }
}
async function reportMediaWithdraw(req,env,user,url) {
 if(req.method!=='POST'||url.search)return fail('Private POST request required',400);
 if(!/^application\/json(?:;|$)/i.test(req.headers.get('content-type')||''))return fail('JSON required',400);
 const reader=req.body?.getReader();if(!reader)return fail('Job required',400);let size=0,chunks=[];
 try{for(;;){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;
 if(size>2048){await reader.cancel();return fail('Request too large',413);}chunks.push(value);}}finally{reader.releaseLock();}
 let b;try{const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}b=JSON.parse(new TextDecoder().decode(bytes));}catch{return fail('Invalid JSON',400);}
 if(!b||Object.keys(b).length!==1||!uuid.test(b.job_id||''))return fail('Only job_id is accepted',400);
 // Caller JWT is mandatory here; service credentials are used only after this Admin gate.
 const job=await reportRPC(env,'herday_get_report_media_job',{p_job_id:b.job_id},user.token);
 if(!job)return fail('Media job unavailable',404);
 return j(await reportMediaBatch(env,b.job_id));
}
async function reportMediaPreview(req,env,user,url) {
 if(req.method!=='GET'||[...url.searchParams.keys()].some(k=>!['report_id','key'].includes(k))||
 url.searchParams.getAll('report_id').length!==1||url.searchParams.getAll('key').length!==1)return fail('Invalid preview',400);
 const id=url.searchParams.get('report_id'),key=url.searchParams.get('key');if(!uuid.test(id||''))return fail('Invalid report',400);
 const m=await reportRPC(env,'herday_authorize_report_media_preview',{p_report_id:id,p_object_key:key},user.token);
 const types={jpg:'image/jpeg',png:'image/png',webp:'image/webp'};
 if(!m||m.key!==key||!reportKey(key,m)||!uuid.test(m.submission_id||'')||!Number.isSafeInteger(m.size_bytes)||
 m.size_bytes<1||m.size_bytes>10*1024*1024||types[key.split('.').pop()]!==m.mime_type)return fail('Preview unavailable',403);
 const obj=await env.PRIVATE_BUCKET.get(key);if(!obj)return fail('Preview unavailable',404);
 if(obj.customMetadata?.owner!==m.author_id||obj.customMetadata?.section!==m.section_key||
 obj.size!==m.size_bytes||obj.httpMetadata?.contentType!==m.mime_type)return fail('Preview registration mismatch',409);
 return new Response(obj.body,{headers:{'content-type':m.mime_type,'content-length':String(obj.size),
 'cache-control':'private, no-store','x-content-type-options':'nosniff','content-security-policy':"default-src 'none'; sandbox"}});
}
async function reportMediaCleanup(env) {
 const ids=await reportRPC(env,'herday_get_report_media_pending',{p_limit:3});
 if(!Array.isArray(ids)||ids.length>3||ids.some(id=>!uuid.test(id)))throw Error('Invalid report cleanup queue');
 for(const id of ids){try{await reportMediaBatch(env,id);}catch{console.error('HERDAY_REPORT_MEDIA_UNFINISHED');}}
}
/* Shared report withdrawal additions end. */


/* Marketplace photos and conversation photos share storage, never authorization. */
async function sharedScopedImage(req,env,url,user=null){
  if(req.method!=='GET'||url.searchParams.getAll('key').length!==1||[...url.searchParams.keys()].some(k=>k!=='key'))return fail('Invalid image request',400);
  const key=url.searchParams.get('key');
  const message=url.pathname==='/v1/messages/image';
  const privateProduct=url.pathname==='/v1/market/preview';
  const body=message?{p_key:key}:{p_key:key,p_private:privateProduct};
  const m=await supa(env,'/rest/v1/rpc/'+(message?'herday_message_media_read_v1':'herday_product_image_v1'),{method:'POST',body,...(user?{token:user.token}:{admin:true})});
  if(!m||m.key!==key||!uuid.test(m.owner||'')||!Object.hasOwn(TYPES,m.mime)||!Number.isSafeInteger(Number(m.size))||Number(m.size)<1||Number(m.size)>MAX_IMAGE)return fail('Image unavailable',404);
  const valid=message?new RegExp('^messages/[0-9a-f-]{36}/'+m.owner+'/[0-9a-f-]{36}[.]'+TYPES[m.mime]+'$').test(key):new RegExp('^pending/buy_sell/'+m.owner+'/[0-9a-f-]{36}[.]'+TYPES[m.mime]+'$').test(key);
  if(!valid||m.section!==(message?'messages':'buy_sell'))return fail('Image unavailable',404);
  const o=await env.PRIVATE_BUCKET.get(key);
  if(!o||o.customMetadata?.owner!==m.owner||o.customMetadata?.section!==m.section||o.httpMetadata?.contentType!==m.mime||o.size!==Number(m.size))return fail('Image unavailable',404);
  return new Response(o.body,{headers:{'content-type':m.mime,'content-length':String(o.size),'cache-control':'private, no-store, max-age=0','x-content-type-options':'nosniff','content-security-policy':"default-src 'none'; sandbox",'referrer-policy':'no-referrer'}});
}

export default {
  async scheduled(event,env,ctx){
    if(config(env)&&env.DIARY_MEDIA_ENABLED==='true')ctx.waitUntil(diaryScheduledCleanup(env).catch(()=>console.error('HERDAY_DIARY_CLEANUP_UNAVAILABLE')));
    if(config(env)&&reportsConfigured(env))ctx.waitUntil(reportMediaCleanup(env).catch(()=>console.error('HERDAY_REPORT_CLEANUP_UNAVAILABLE')));
  },
  async fetch(req, env, ctx) {
    if (!config(env)) {
      return fail(
        'Worker configuration incomplete',
        503
      );
    }

    if (req.method === 'OPTIONS') {
      return origin(req, env)
        ? new Response(null, {
            status: 204,
            headers: cors(req, env)
          })
        : fail('Origin not allowed', 403);
    }

    if (
      req.headers.has('origin') &&
      !origin(req, env)
    ) {
      return fail('Origin not allowed', 403);
    }

    const path = new URL(req.url);

    if (
      path.pathname === '/health' &&
      req.method === 'GET'
    ) {
      return wrap(
        j({
          ok: true,
          service: 'herday-media-api',
          publishing: 'requires_approved_submission',
          diary_recovery: diaryMailConfigured(env) ? 'configured' : 'not_configured',
          diary_media: env.DIARY_MEDIA_ENABLED==='true' ? 'enabled' : 'disabled',
          diary_storage_expiry: env.DIARY_STORAGE_EXPIRY_ENABLED==='true' ? 'worker_enabled_database_gate_required' : 'disabled',
          reports_media: reportsConfigured(env) ? 'configured' : 'not_configured'
        }),
        req,
        env
      );
    }

    try {
      if (
        !['GET', 'POST'].includes(req.method)
      ) {
        return wrap(
          fail('Method not allowed', 405),
          req,
          env
        );
      }

      if(path.pathname==='/v1/market/location'&&req.method==='GET'){const country=req.cf?.country;return wrap(j({country:typeof country==='string'&&/^[A-Z]{2}$/.test(country)?country:null}),req,env);}
      if(path.pathname==='/v1/market/image')return wrap(await sharedScopedImage(req,env,path),req,env);
      console.info('HERDAY_DIAGNOSTIC jwt-start');
      const user = await jwt(req, env);
      console.info('HERDAY_DIAGNOSTIC jwt-success');
      await active(env, user);
      console.info('HERDAY_DIAGNOSTIC active-user-success');

      let result;

      if(['/v1/messages/image','/v1/market/preview'].includes(path.pathname))result=await sharedScopedImage(req,env,path,user);
      else if(path.pathname==='/v1/reports/media/withdraw')result=await reportMediaWithdraw(req,env,user,path);
      else if(path.pathname==='/v1/reports/media/preview')result=await reportMediaPreview(req,env,user,path);
      else if(path.pathname.startsWith('/v1/diary/media/')) {
        if(env.DIARY_MEDIA_ENABLED!=='true')result=fail('Diary media not enabled',503);
        else if(typeof crypto.DigestStream!=='function')result=fail('Streaming digest runtime unavailable',503);
        else if(req.method!=='POST'||path.search)result=fail('Private POST request required',400);
        else if(path.pathname==='/v1/diary/media/start')result=await diaryMediaStart(req,env,user);
        else if(path.pathname==='/v1/diary/media/part')result=await diaryMediaPart(req,env,user);
        else if(path.pathname==='/v1/diary/media/complete')result=await diaryMediaComplete(req,env,user);
        else if(path.pathname==='/v1/diary/media/read')result=await diaryMediaRead(req,env,user,ctx);
        else result=fail('Not found',404);
      } else if (path.pathname === '/v1/diary/recovery/send' && req.method === 'POST') {
        result = await diaryRecoverySend(req, env, user);
      } else if (
        path.pathname === '/v1/upload' &&
        req.method === 'POST'
      ) {
        result = await upload(req, env, user);
      } else if (
        path.pathname === '/v1/private' &&
        req.method === 'GET'
      ) {
        result = await read(
          req,
          env,
          user,
          path
        );
      } else if (
        path.pathname === '/v1/moderation-preview' &&
        req.method === 'GET'
      ) {
        result = await moderationPreview(
          req,
          env,
          user,
          path
        );
      } else if (
        path.pathname === '/v1/publish' &&
        req.method === 'POST'
      ) {
        result = await publish(
          req,
          env,
          user
        );
      } else if (
        ['/v1/admin/delete-content','/v1/owner/delete-rejected','/v1/moderator/delete-content'].includes(path.pathname) &&
        req.method === 'POST'
      ) {
        result = await deleteContent(req, env, user, path.pathname === '/v1/owner/delete-rejected',path.pathname === '/v1/moderator/delete-content');
      } else if(path.pathname==='/v1/edit/cleanup' && req.method==='POST'){
        result=await cleanupEdit(req,env,user);
      } else {
        result = fail('Not found', 404);
      }

      return wrap(result, req, env);
    } catch (e) {
      const knownRuntimeError = [
        'File is not defined', 'crypto is not defined'
      ].includes(e?.message) ? e.message : null;
      console.error('HERDAY_DIAGNOSTIC', JSON.stringify({
        stage: 'request-failed',
        errorType: ['Error','TypeError','ReferenceError','RangeError','SyntaxError','DOMException'].includes(e?.name) ? e.name : 'OtherError',
        status: Number.isInteger(e?.status) ? e.status : 500,
        knownRuntimeError
      }));
      return wrap(
        fail(
          e.status && e.status < 500
            ? e.message
            : 'Request failed',
          e.status || 500
        ),
        req,
        env
      );
    }
  }
};
