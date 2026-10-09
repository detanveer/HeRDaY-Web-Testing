/* HerDay Moderator / Moderation (Web)
   Pages: Moderator Tools, Common Review queue, Full Submission Review, Reject dialog,
   User Management (Admin), Poetry Management (Admin), Moderator entry on Profile.
   Backend: only the installed Supabase RPCs / tables listed in MODERATION-IMPLEMENTATION-REPORT.md.
   All real authorization is enforced by Supabase; the UI below only hides/disables controls. */
(function () {
  'use strict';

  const KEYS = ['poetry', 'explore', 'girls_space'];
  const SECTIONS = {
    poetry: { title: 'Poetry Moderation', short: 'Poetry', tool: 'Review submitted poetry.', perm: 'Approve or reject submitted poetry', qSub: 'Review submitted poetry', wait: 'Poetry awaiting your review' },
    explore: { title: 'Explore Moderation', short: 'Explore', tool: 'Review user-submitted Explore content.', perm: 'Approve or reject user-submitted Explore content', qSub: 'Review submitted Explore content', wait: 'Explore content awaiting your review' },
    girls_space: { title: 'Girls’ Space Moderation', short: 'Girls’ Space', tool: 'Review user-submitted Girls’ Space content.', perm: 'Approve or reject user-submitted Girls’ Space content', qSub: 'Review submitted Girls’ Space content', wait: 'Girls’ Space content awaiting your review' }
  };
  const REASONS = [
    'Copyright / Copied Content',
    'Poor Quality / Incomplete Content',
    'Community Guidelines Violation',
    'Inappropriate / Offensive Content',
    'Spam / Promotional Content',
    'Other Reason'
  ];
  const ROUTES = ['mod-tools', 'mod-queue', 'mod-review', 'mod-users', 'poetry-management'];
  const ADMIN_ONLY = ['mod-users', 'poetry-management'];
  const COUNT_LIMIT = 100;   // counts on Moderator Tools are read with this limit; at the limit they are shown as 100+
  const PAGE = 30;           // queue page size (herday_get_content only supports p_limit, so "Load more" raises the limit)
  const SEARCH_MAX = 500;    // deep-link search ceiling
  // Existing secure R2 Worker (same address as the already-integrated r2-test.js). Private reads need the user's Supabase JWT.
  const MEDIA_WORKER = (window.HERDAY_MEDIA_WORKER || 'https://herday-media-api.urduwaveblog.workers.dev').replace(/\/+$/, '');
  const ACTIONS = [['review', 'Review', 'can_review'], ['approve', 'Approve', 'can_approve'], ['reject', 'Reject', 'can_reject'], ['edit', 'Edit', 'can_edit']];
  const blankPerm = () => ({ review: false, approve: false, reject: false, edit: false });
  const blankPreview = () => ({ poetry: blankPerm(), explore: blankPerm(), girls_space: blankPerm() });
  const USERS_SHOWN = 20;

  const MOD = {
    fresh: {}, loading: {}, errors: {},
    perms: [], queue: [], counts: {}, activity: [], cats: [], allCats: [],
    users: [], authors: {},
    tab: 'users', q: '', sel: null, preview: blankPreview(), permErr: '', assign: null,
    catQ: '', catsLimited: false, usersShown: USERS_SHOWN, media: {}, queueLimit: PAGE, hasMore: false, capped: false, loadingMore: false, reviewGone: '', activityState: 'loading', activity: [], activityMsg: '', busy: false, pendingId: null, catId: null
  };

  const e = (s) => esc(s);
  const me = () => currentUser();
  const isAdminUser = () => me()?.role === 'admin';
  const isModUser = () => me()?.role === 'moderator';
  const section = () => (KEYS.includes(S.modSection) ? S.modSection : 'poetry');
  const backToTools = () => (isAdminUser() ? 'admin-profile' : 'user-profile');

  window.modIsRoute = (route) => ROUTES.includes(route);
  window.modCanAccess = (route) => {
    const u = me();
    if (!u) return false;
    if (u.role === 'admin') return true;
    return u.role === 'moderator' && !ADMIN_ONLY.includes(route);
  };
  window.modOnNavigate = (route) => {
    if (!ROUTES.includes(route)) return;
    // Opening a submission from the queue reuses the queue already in memory.
    if (route !== 'mod-review') { MOD.queueLimit = PAGE; revokeMedia(); }
    MOD.fresh[route] = route === 'mod-review' && MOD.queue.some((x) => x.id === S.modReviewId);
  };

  /* ---------- helpers ---------- */
  function perm(key) {
    if (isAdminUser()) return { review: true, approve: true, reject: true };
    const u = me();
    const r = MOD.perms.find((p) => p.moderator_id === u?.id && p.section_key === key);
    return { review: !!r?.can_review, approve: !!r?.can_approve, reject: !!r?.can_reject };
  }
  const allowedSections = () => KEYS.filter((k) => perm(k).review);
  const humanize = (s) => String(s || '').replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()).trim();
  const slugify = (s) => String(s).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const catName = (id) => (MOD.cats.find((c) => c.id === id) || MOD.allCats.find((c) => c.id === id))?.name || '';
  function categoryOf(x) {
    if (x.section_key === 'poetry') return catName(x.poetry_category_id);
    return x.detail_key ? humanize(x.detail_key) : '';
  }
  function timeAgo(iso) {
    const t = new Date(iso).getTime();
    if (!t) return '';
    const m = Math.max(0, Math.round((Date.now() - t) / 60000));
    if (m < 1) return 'Just now';
    if (m < 60) return m + 'm ago';
    const h = Math.round(m / 60);
    if (h < 24) return h + 'h ago';
    const d = Math.round(h / 24);
    if (d < 7) return d + 'd ago';
    return new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  }
  function dayLabel(iso) {
    const d = new Date(iso);
    if (isNaN(d)) return '';
    const start = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const diff = Math.round((start(new Date()) - start(d)) / 86400000);
    if (diff <= 0) return 'Today';
    if (diff === 1) return 'Yesterday';
    return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  }
  const personIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8.5" r="4.2"/><path d="M3.8 21c.6-4.6 3.8-7 8.2-7s7.6 2.4 8.2 7z"/></svg>';
  const chevron = '<svg class="hm-chev" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg>';
  const avatar = (photo, cls = '') => `<span class="hm-avatar ${cls}">${photo ? `<img src="${e(photo)}" alt="">` : personIcon}</span>`;
  const errBox = (m) => `<div class="hm-error" role="alert">${e(m)}</div>`;
  const loadingView = (title, sub, back) => head(title, sub, back) + '<div class="hm-state" role="status">Loading…</div>';

  async function rpc(name, args) {
    const { data, error } = await supabaseClient.rpc(name, args);
    if (error) throw error;
    return data;
  }
  function toast(msg) {
    document.getElementById('hmToast')?.remove();
    document.body.insertAdjacentHTML('beforeend', `<div id="hmToast" class="hm-toast" role="status">${e(msg)}</div>`);
    setTimeout(() => document.getElementById('hmToast')?.remove(), 2600);
  }

  /* ---------- data loaders ---------- */
  async function loadPerms() {
    try { MOD.perms = (await rpc('get_moderator_section_permissions')) || []; }
    catch (err) { MOD.perms = []; throw err; }
  }
  async function loadCats(all) {
    try { MOD.cats = (await rpc('herday_get_poetry_categories')) || []; } catch (_) { MOD.cats = []; }
    if (all) {
      const { data, error } = await supabaseClient.from('poetry_categories').select('id,name,slug,is_active').order('name', { ascending: true });
      MOD.catsLimited = !!error || !Array.isArray(data);
      MOD.allCats = !MOD.catsLimited ? data : MOD.cats.map((c) => ({ ...c, is_active: true }));
    }
  }
  /* ---------- private R2 media (read-only, via the existing Worker; never made public) ---------- */
  const mediaItems = (x) => (Array.isArray(x.r2_object_keys) ? x.r2_object_keys : []).map((k) => (typeof k === 'string' ? k : (k && (k.key || k.object_key || k.r2_key)) || ''));
  const mediaCount = (x) => (Array.isArray(x.r2_object_keys) ? x.r2_object_keys.length : 0);
  const allMediaOk = (x) => { const m = MOD.media[x.id]; return !!m && m.length === mediaCount(x) && m.every((i) => i.state === 'ok'); };
  function revokeMedia() {
    Object.values(MOD.media).forEach((arr) => arr.forEach((i) => { if (i.url) URL.revokeObjectURL(i.url); }));
    MOD.media = {};
  }
  async function fetchMedia(arr, i, id) {
    const it = arr[i];
    if (!it) return;
    it.state = 'loading'; it.msg = '';
    try {
      if (!it.key) throw new Error('This attachment reference is unreadable.');
      const { data } = await supabaseClient.auth.getSession();
      const token = data?.session?.access_token;
      if (!token) throw new Error('Your session has expired. Log in again.');
      const res = await fetch(MEDIA_WORKER + '/v1/private?key=' + encodeURIComponent(it.key), { headers: { Authorization: 'Bearer ' + token } });
      if (!res.ok) {
        let m = ''; try { m = (await res.json()).error || ''; } catch (_) { /* not json */ }
        throw new Error(res.status === 401 || res.status === 403 ? 'You are not authorised to view this attachment (' + res.status + ').' : res.status === 404 ? 'This attachment was not found (404).' : 'The media service returned ' + res.status + (m ? ': ' + m : '') + '.');
      }
      const blob = await res.blob();
      if (!/^image\/(jpeg|png|webp)$/.test(blob.type)) throw new Error('Unexpected attachment type.');
      if (MOD.media[id] !== arr) return;                     // user left this review meanwhile
      it.url = URL.createObjectURL(blob); it.state = 'ok';
    } catch (err) {
      it.state = 'error';
      it.msg = err instanceof TypeError ? 'Could not reach the media service. Check your connection; if this continues, the service may not allow this site.' : (err?.message || 'Could not load this attachment.');
    }
    if (MOD.media[id] === arr && S.route === 'mod-review' && S.modReviewId === id) render();
  }
  function ensureMedia(x) {
    if (MOD.media[x.id] || !mediaCount(x)) return;
    const arr = mediaItems(x).map((key) => ({ key, state: 'loading', url: '', msg: '' }));
    MOD.media = { [x.id]: arr };
    arr.forEach((_, i) => fetchMedia(arr, i, x.id));
  }
  window.modRetryMedia = (id, i) => { const arr = MOD.media[id]; if (arr) { arr[i].state = 'loading'; render(); fetchMedia(arr, i, id); } };
  function mediaHtml(x) {
    const arr = MOD.media[x.id] || [];
    if (!arr.length) return '';
    const n = arr.length;
    const done = arr.filter((i) => i.state === 'ok').length;
    return `<section class="hm-media" aria-label="Attachments"><h4 class="hm-media-h">Attachments (${n})<span>${done} of ${n} loaded</span></h4><div class="hm-media-grid">${arr.map((it, i) => it.state === 'ok'
      ? `<figure class="hm-fig"><img src="${e(it.url)}" alt="Attachment ${i + 1} of ${n}"></figure>`
      : it.state === 'error'
        ? `<div class="hm-fig err" role="alert"><p>Attachment ${i + 1} could not be loaded.</p><p class="small">${e(it.msg)}</p><button class="hm-btn secondary hm-retry" onclick="modRetryMedia('${e(x.id)}',${i})">Retry</button></div>`
        : `<div class="hm-fig ph" role="status" aria-busy="true">Loading attachment ${i + 1}…</div>`).join('')}</div></section>`;
  }

  async function fetchQueue(key, limit) {
    const data = await rpc('herday_get_content', { p_view: 'queue', p_section_key: key, p_limit: limit || PAGE });
    return Array.isArray(data) ? data : [];
  }
  async function loadQueue(key, limit) {
    const items = await fetchQueue(key, limit);
    MOD.queue = items; MOD.queueLimit = limit; MOD.hasMore = items.length >= limit; MOD.capped = false;
    await loadAuthors(items);
  }
  window.modLoadMore = async () => {
    if (MOD.loadingMore) return;
    const key = S.route === 'poetry-management' ? 'poetry' : section();
    const next = MOD.queueLimit + PAGE, before = MOD.queue.length;
    MOD.loadingMore = true; render();
    try {
      const items = await fetchQueue(key, next);
      if (items.length <= before) { MOD.hasMore = false; MOD.capped = items.length >= MOD.queueLimit; }
      else { MOD.queue = items; MOD.queueLimit = next; MOD.hasMore = items.length >= next; MOD.capped = false; await loadAuthors(items); }
    } catch (err) { toast('Could not load more: ' + (err?.message || 'unknown error')); }
    MOD.loadingMore = false; render();
  };
  const moreHtml = () => `<div class="hm-more"><p class="hm-note">Showing ${MOD.queue.length} pending submission${MOD.queue.length === 1 ? '' : 's'}${MOD.hasMore ? '. More may be waiting.' : '.'}${MOD.capped ? ' The server returned no further items.' : ''}</p>${MOD.hasMore ? `<button class="hm-btn secondary" ${MOD.loadingMore ? 'disabled aria-busy="true"' : ''} onclick="modLoadMore()">${MOD.loadingMore ? 'Loading…' : 'Load more'}</button>` : ''}</div>`;
  async function loadAuthors(items) {
    const ids = [...new Set(items.map((x) => x.author_id).filter((id) => id && !(id in MOD.authors)))];
    if (!ids.length) return;
    try {
      const { data, error } = await supabaseClient.from('profiles').select('id,first_name,last_name,avatar_path').in('id', ids);
      if (error || !Array.isArray(data)) throw error || new Error('no profile access');
      await Promise.all(data.map(async (p) => {
        let photo = '';
        try { photo = await signedStorageUrl('profile-photos', p.avatar_path); } catch (_) { /* optional */ }
        MOD.authors[p.id] = { name: [p.first_name, p.last_name].filter(Boolean).join(' '), photo };
      }));
    } catch (_) { /* profiles of other users may not be readable; fall back to generic label */ }
    ids.forEach((id) => { if (!(id in MOD.authors)) MOD.authors[id] = { name: '', photo: '' }; });
  }
  async function loadActivity() {
    MOD.activityState = 'loading'; MOD.activity = []; MOD.activityMsg = '';
    const u = me();
    if (!u) { MOD.activityState = 'denied'; return; }
    try {
      const { data, error } = await supabaseClient.from('content_moderation_decisions')
        .select('id,submission_id,section_key,to_status,reason,created_at').eq('actor_id', u.id)
        .order('created_at', { ascending: false }).limit(3);
      if (error) {
        const denied = error.code === '42501' || error.status === 401 || error.status === 403 || /permission denied|row-level security|not authorized/i.test(error.message || '');
        MOD.activityState = denied ? 'denied' : 'error'; MOD.activityMsg = error.message || '';
      } else { MOD.activity = Array.isArray(data) ? data : []; MOD.activityState = MOD.activity.length ? 'ok' : 'empty'; }
    } catch (err) { MOD.activityState = 'error'; MOD.activityMsg = err?.message || ''; }
  }
  window.modRetryActivity = async () => { MOD.activityState = 'loading'; if (S.route === 'mod-tools') render(); await loadActivity(); if (S.route === 'mod-tools') render(); };

  const LOADERS = {
    async 'mod-tools'() {
      await loadPerms();
      const keys = allowedSections();
      MOD.counts = {};
      await Promise.all(keys.map(async (k) => { try { MOD.counts[k] = (await fetchQueue(k, COUNT_LIMIT)).length; } catch (_) { MOD.counts[k] = null; } }));
      MOD.activityState = 'loading';
      loadActivity().finally(() => { if (S.route === 'mod-tools') render(); });   // activity has its own loading/empty/error state
    },
    async 'mod-queue'() {
      await loadPerms();
      await loadCats(false);
      await loadQueue(section(), MOD.queueLimit || PAGE);
    },
    async 'mod-review'() {
      // Restore by submission id: herday_get_content has no id lookup, so search the pending lists.
      await loadPerms();
      await loadCats(false);
      MOD.reviewGone = '';
      const id = S.modReviewId;
      const order = [section(), ...allowedSections().filter((k) => k !== section())];
      let exhausted = true;
      for (const key of order) {
        if (!perm(key).review) continue;
        let limit = PAGE, items = [];
        for (;;) {
          items = await fetchQueue(key, limit);
          if (items.some((x) => x.id === id) || items.length < limit) break;
          if (limit >= SEARCH_MAX) { exhausted = false; break; }
          limit = Math.min(limit * 2, SEARCH_MAX);
        }
        if (items.some((x) => x.id === id)) {
          S.modSection = key; save();
          MOD.queue = items; MOD.queueLimit = limit; MOD.hasMore = items.length >= limit; MOD.capped = false;
          await loadAuthors(items);
          return;
        }
      }
      MOD.queue = [];
      MOD.reviewGone = exhausted
        ? 'This submission is no longer pending. It may already have been approved or rejected, or it was removed.'
        : 'This submission was not found in the first ' + SEARCH_MAX + ' pending items. Open it from the queue instead.';
    },
    async 'mod-users'() {
      MOD.users = (await rpc('admin_list_moderator_candidates')) || [];
      await loadPerms();
    },
    async 'poetry-management'() {
      await loadCats(true);
      await loadQueue('poetry', MOD.queueLimit || PAGE);
    }
  };
  function load(route) {
    if (MOD.loading[route]) return;
    MOD.loading[route] = true;
    MOD.errors[route] = '';
    LOADERS[route]().catch((err) => { MOD.errors[route] = err?.message || 'Could not load this page.'; })
      .finally(() => { MOD.loading[route] = false; MOD.fresh[route] = true; if (S.route === route) render(); });
  }

  /* ---------- permission refresh (backend stays the authority) ---------- */
  async function refreshPermsQuiet() {
    try { await loadPerms(); } catch (_) { return; }
    if (ROUTES.includes(S.route) && MOD.fresh[S.route] && !MOD.busy && !document.getElementById('hmModal')) render();
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && ROUTES.includes(S.route) && me() && MOD.fresh[S.route]) refreshPermsQuiet();
  });

  /* ---------- router ---------- */
  window.modRender = function (route) {
    const u = me();
    if (!u || !window.modCanAccess(route)) { setTimeout(() => nav(u ? 'user-profile' : 'login')); return ''; }
    if (!MOD.fresh[route]) {
      load(route);
      const t = { 'mod-tools': ['Moderator Tools', 'Review content assigned to you', backToTools()], 'mod-queue': [SECTIONS[section()].title, SECTIONS[section()].qSub, 'mod-tools'], 'mod-review': ['Review Submission', 'Review the full content before taking action', 'mod-queue'], 'mod-users': ['User Management', 'Search users and manage moderator access', 'admin-profile'], 'poetry-management': ['Poetry Management', 'Manage categories and review poetry', 'admin-profile'] }[route];
      return loadingView(...t);
    }
    return { 'mod-tools': toolsPage, 'mod-queue': queuePage, 'mod-review': reviewPage, 'mod-users': usersPage, 'poetry-management': poetryMgmtPage }[route]();
  };

  /* ---------- Profile entry (Moderator role only) ---------- */
  window.modToolsCard = () => `<button class="hm-tools-entry" onclick="nav('mod-tools')"><span class="hm-tools-icon" aria-hidden="true">♙♙</span><div><h3>Moderator Tools</h3><p>Review content assigned to you</p></div><i aria-hidden="true">›</i></button>`;

  /* ---------- Moderator Tools ---------- */
  function toolsPage() {
    const u = me();
    const err = MOD.errors['mod-tools'];
    const keys = allowedSections();
    const cards = keys.map((k) => {
      const n = MOD.counts[k];
      const pill = n == null ? '<span class="hm-count off">Count unavailable</span>' : `<span class="hm-count" ${n >= COUNT_LIMIT ? `title="At least ${COUNT_LIMIT} pending; the exact total is not available"` : ''}>${n >= COUNT_LIMIT ? COUNT_LIMIT + '+' : n} Pending</span>`;
      return `<button class="hm-tool" onclick="modOpenQueue('${k}')"><div><h3>${e(SECTIONS[k].title)}</h3><p>${e(SECTIONS[k].tool)}</p>${pill}</div>${chevron}</button>`;
    }).join('');
    let act;
    if (MOD.activityState === 'ok') act = `<div class="hm-card hm-activity">${MOD.activity.map((a) => {
      const k = KEYS.includes(a.section_key) ? a.section_key : 'poetry';
      const verb = a.to_status === 'approved' ? 'approved' : a.to_status === 'rejected' ? 'rejected' : 'updated';
      return `<button class="hm-act" onclick="modOpenQueue('${k}')"><div><b>${e(SECTIONS[k].short)} submission ${verb}</b>${a.reason ? '<span>Reason submitted</span>' : ''}<span>${e(dayLabel(a.created_at))}</span></div>${chevron}</button>`;
    }).join('')}</div>`;
    else if (MOD.activityState === 'loading') act = '<div class="hm-card hm-empty" role="status">Loading recent activity…</div>';
    else if (MOD.activityState === 'empty') act = '<div class="hm-card hm-empty">No recent activity yet.</div>';
    else if (MOD.activityState === 'denied') act = '<div class="hm-card hm-empty">Recent activity is not available for your account.</div>';
    else act = `<div class="hm-card hm-empty" role="alert">Recent activity could not be loaded.${MOD.activityMsg ? ' ' + e(MOD.activityMsg) : ''}<br><button class="hm-btn secondary hm-retry" onclick="modRetryActivity()">Try again</button></div>`;
    act = `<h2 class="hm-h2">Recent Activity</h2>${act}`;
    const anyCapped = keys.some((k) => MOD.counts[k] >= COUNT_LIMIT);
    return head('Moderator Tools', 'Review content assigned to you', backToTools()) + `<div class="hm-wrap">
      <section class="hm-card hm-identity">${avatar(u.photo, 'lg')}<div><b class="hm-name">${e(userFullName(u))}</b><span class="hm-role">${isAdminUser() ? 'Admin' : 'Moderator'}</span><p>${isAdminUser() ? 'You have access to every moderation section.' : 'Your moderation access is managed by an Admin.'}</p></div></section>
      <h2 class="hm-h2">Assigned Moderation</h2>
      ${err ? errBox(err) : cards || '<div class="hm-card hm-empty">No moderation sections are assigned to you yet. An Admin can assign them.</div>'}
      ${keys.length ? `<p class="hm-note">Rejections require a reason.${anyCapped ? ' Counts show 100+ when more than 100 are waiting.' : ''}</p>` : ''}
      ${act}</div>`;
  }
  window.modOpenQueue = (k) => { if (KEYS.includes(k)) { MOD.queueLimit = PAGE; nav('mod-queue', { modSection: k }); } };

  /* ---------- submission cards ---------- */
  function authorOf(x) {
    const a = MOD.authors[x.author_id] || {};
    return { name: a.name || 'Author unavailable', photo: a.photo || '', missing: !a.name };
  }
  function preview(body) {
    return String(body || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean).slice(0, 2).join('\n');
  }
  function actionButtons(x, ctx) {
    const p = perm(x.section_key), nm = mediaCount(x);
    let approveOk = p.approve, hint = '';
    if (nm > 0 && p.approve) {
      if (ctx !== 'review') { approveOk = false; hint = `This submission has ${nm} attachment${nm > 1 ? 's' : ''}. Open the full review and view ${nm > 1 ? 'them' : 'it'} before approving.`; }
      else if (!allMediaOk(x)) { approveOk = false; hint = 'Approve unlocks after every attachment has loaded, so nothing is approved unseen.'; }
    }
    return `<div class="hm-actions"><button class="hm-btn primary" ${approveOk ? '' : 'disabled'} onclick="modAskApprove('${e(x.id)}')">Approve</button><button class="hm-btn secondary" ${p.reject ? '' : 'disabled'} onclick="modAskReject('${e(x.id)}')">Reject</button></div>${hint ? `<p class="hm-note hm-hint">${e(hint)}</p>` : ''}`;
  }
  function authorRow(x, withCategory) {
    const a = authorOf(x), cat = categoryOf(x);
    return `<div class="hm-author">${avatar(a.photo)}<div class="hm-who"><b class="hm-name ${a.missing ? 'hm-unavail' : ''}">${e(a.name)}</b><div class="hm-sub"><span class="hm-time">${e(timeAgo(x.created_at))}</span>${withCategory && cat ? `<span class="hm-cat">${e(cat)}</span>` : ''}</div></div><span class="hm-pending">Pending Review</span></div>`;
  }

  /* ---------- Common Review queue ---------- */
  function queuePage() {
    const k = section(), s = SECTIONS[k], err = MOD.errors['mod-queue'];
    let body;
    if (err) body = errBox(err);
    else if (!MOD.queue.length) body = '<div class="hm-card hm-empty">No submissions are waiting for review.</div>';
    else body = MOD.queue.map((x) => `<article class="hm-card hm-sub-card">${authorRow(x, true)}<h3 class="hm-title" dir="auto">${e(x.title)}</h3><p class="hm-preview" dir="auto">${e(preview(x.body))}</p><button class="hm-view" onclick="modOpenReview('${e(x.id)}')">View Full Submission ${chevron}</button>${actionButtons(x, 'queue')}</article>`).join('');
    return head(s.title, s.qSub, 'mod-tools') + `<div class="hm-wrap"><h2 class="hm-h2 lg">Pending Submissions</h2><p class="hm-lead">${e(s.wait)}</p>${body}${!err && MOD.queue.length ? moreHtml() : ''}</div>`;
  }
  window.modOpenReview = (id, back) => nav('mod-review', { modReviewId: id, modReviewBack: back === 'poetry-management' ? 'poetry-management' : 'mod-queue', ...(back === 'poetry-management' ? { modSection: 'poetry' } : {}) });

  /* ---------- Full Submission Review ---------- */
  function reviewPage() {
    const back = S.modReviewBack === 'poetry-management' && isAdminUser() ? 'poetry-management' : 'mod-queue';
    const err = MOD.errors['mod-review'];
    const x = MOD.queue.find((v) => v.id === S.modReviewId);
    if (err) return head('Review Submission', '', back) + `<div class="hm-wrap">${errBox(err)}</div>`;
    if (!x) return head('Review Submission', 'Review the full content before taking action', back) + `<div class="hm-wrap"><div class="hm-card hm-empty" role="status">${e(MOD.reviewGone || 'This submission is no longer pending.')}<br><button class="hm-btn secondary hm-retry" onclick="nav('${back}')">${back === 'poetry-management' ? 'Back to Poetry Management' : 'Back to queue'}</button></div></div>`;
    ensureMedia(x);
    return head('Review Submission', 'Review the full content before taking action', back) + `<div class="hm-wrap"><article class="hm-card hm-sub-card hm-full-card">${authorRow(x, true)}<h3 class="hm-title" dir="auto">${e(x.title)}</h3><div class="hm-full" dir="auto">${e(x.body)}</div>${mediaHtml(x)}${actionButtons(x, 'review')}</article></div>`;
  }

  /* ---------- modals ---------- */
  let returnFocusEl = null;
  function openModal(html) {
    const had = !!document.getElementById('hmModal');
    if (!had) returnFocusEl = document.activeElement;
    document.getElementById('hmModal')?.remove();
    const titled = html.replace(/<h2>/, '<h2 id="hmModalTitle">');
    document.body.insertAdjacentHTML('beforeend', `<div id="hmModal" class="hm-modal-backdrop" onclick="if(event.target===this)modClose()"><div class="hm-modal" role="dialog" aria-modal="true" aria-labelledby="hmModalTitle">${titled}</div></div>`);
    document.documentElement.classList.add('hm-lock');
    document.getElementById('hmModal')?.querySelector('input:checked,input,textarea,button')?.focus();
  }
  function closeModal() {
    const had = !!document.getElementById('hmModal');
    document.getElementById('hmModal')?.remove();
    document.documentElement.classList.remove('hm-lock');
    if (!had) return;
    const el = returnFocusEl; returnFocusEl = null;
    if (el && document.contains(el) && typeof el.focus === 'function') { el.focus(); return; }
    const h = document.querySelector('#beautyApp .beauty-head h1');
    if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
  }
  function trapTab(ev) {
    const m = document.getElementById('hmModal');
    if (!m || ev.key !== 'Tab') return;
    const f = [...m.querySelectorAll('button,input,textarea,[href],[tabindex]:not([tabindex="-1"])')].filter((n) => !n.disabled && !n.hidden && n.offsetParent !== null);
    if (!f.length) { ev.preventDefault(); return; }
    const first = f[0], last = f[f.length - 1], act = document.activeElement;
    if (!m.contains(act)) { ev.preventDefault(); first.focus(); }
    else if (ev.shiftKey && act === first) { ev.preventDefault(); last.focus(); }
    else if (!ev.shiftKey && act === last) { ev.preventDefault(); first.focus(); }
  }
  document.addEventListener('keydown', trapTab);
  window.modClose = () => { if (!MOD.busy) closeModal(); };
  document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && document.getElementById('hmModal')) window.modClose(); });
  const setModalBusy = (on) => { MOD.busy = on; document.querySelectorAll('#hmModal button,#hmModal input,#hmModal textarea').forEach((b) => { b.disabled = on; }); };
  const modalErr = (m) => { const el = document.getElementById('hmErr'); if (el) { el.textContent = m; el.hidden = !m; } };

  window.modAskApprove = (id) => {
    const x = MOD.queue.find((v) => v.id === id);
    if (!x || !perm(x.section_key).approve) return;
    const nm = mediaCount(x);
    if (nm > 0 && !(S.route === 'mod-review' && allMediaOk(x))) return;   // never approve an unseen attachment
    MOD.pendingId = id;
    openModal(`<h2>Approve submission?</h2><p>Confirm you have reviewed the complete submission${nm ? ` and all ${nm} attachment${nm > 1 ? 's' : ''}` : ''}.</p><p id="hmErr" class="hm-modal-err" role="alert" hidden></p><div class="hm-modal-actions"><button class="hm-btn secondary" onclick="modClose()">Cancel</button><button class="hm-btn primary" onclick="modDecide('approved')">Approve</button></div>`);
  };
  window.modAskReject = (id) => {
    if (!MOD.queue.some((x) => x.id === id)) return;
    MOD.pendingId = id;
    openModal(`<h2>Reject Submission</h2><p>Select a reason for rejecting this submission.</p>
      <div class="hm-reasons" role="radiogroup" aria-label="Rejection reason">${REASONS.map((r, i) => `<label class="hm-radio"><input type="radio" name="hmReason" value="${i}" ${i === 0 ? 'checked' : ''} onchange="modReasonChanged()"><span class="hm-dot" aria-hidden="true"></span><span>${e(r)}</span></label>`).join('')}</div>
      <textarea id="hmOther" class="hm-other" maxlength="2000" placeholder="Write the reason" aria-label="Other reason" hidden></textarea>
      <p id="hmErr" class="hm-modal-err" role="alert" hidden></p>
      <div class="hm-modal-actions"><button class="hm-btn secondary" onclick="modClose()">Cancel</button><button class="hm-btn primary" onclick="modDecide('rejected')">Reject Post</button></div>`);
  };
  window.modReasonChanged = () => {
    const v = document.querySelector('input[name="hmReason"]:checked')?.value;
    const box = document.getElementById('hmOther');
    if (!box) return;
    box.hidden = Number(v) !== REASONS.length - 1;
    if (!box.hidden) box.focus();
    modalErr('');
  };
  window.modDecide = async (decision) => {
    if (MOD.busy) return;
    const x = MOD.queue.find((v) => v.id === MOD.pendingId);
    if (!x) { closeModal(); return; }
    let reason = null;
    if (decision === 'rejected') {
      const idx = Number(document.querySelector('input[name="hmReason"]:checked')?.value);
      if (Number.isNaN(idx)) { modalErr('Select a reason.'); return; }
      reason = idx === REASONS.length - 1 ? (document.getElementById('hmOther')?.value || '').trim() : REASONS[idx];
      if (!reason) { modalErr('Enter a reason for rejecting this submission.'); return; }
    }
    setModalBusy(true);
    try {
      await rpc('herday_moderate_content', { p_submission_id: x.id, p_decision: decision, p_reason: reason });
      MOD.busy = false;
      closeModal();
      MOD.queue = MOD.queue.filter((v) => v.id !== x.id);
      toast(decision === 'approved' ? 'Submission approved' : 'Submission rejected');
      ['mod-tools', 'mod-queue', 'mod-review', 'poetry-management'].forEach((r) => { MOD.fresh[r] = false; });
      if (S.route === 'mod-review') { nav(S.modReviewBack === 'poetry-management' && isAdminUser() ? 'poetry-management' : 'mod-queue'); return; }
      MOD.fresh[S.route] = true; render();
    } catch (err) {
      setModalBusy(false);
      modalErr((err?.message || 'Could not save the decision.') + ' Your permissions were refreshed.');
      refreshPermsQuiet();
    }
  };

  /* ---------- User Management (Admin) ---------- */
  const fullName = (x) => [x.first_name, x.last_name].filter(Boolean).join(' ') || 'HerDay User';
  const permsOf = (uid, key) => {
    const r = MOD.perms.find((p) => p.moderator_id === uid && p.section_key === key);
    return { review: !!r?.can_review, approve: !!r?.can_approve, reject: !!r?.can_reject, edit: !!r?.can_edit };
  };
  const permArgs = (uid, key, v) => ({ p_moderator_id: uid, p_section_key: key, p_can_review: !!v.review, p_can_approve: !!v.approve, p_can_reject: !!v.reject, p_can_edit: !!v.edit });
  const permSwitch = (on, key, act, label, disabled) => `<button class="hm-psw ${on ? 'on' : ''}" role="switch" aria-checked="${on}" aria-label="${e(label)}" ${disabled ? 'disabled' : ''} onclick="modTogglePerm('${key}','${act}')"><span class="hm-psw-box" aria-hidden="true"></span>${e(act[0].toUpperCase() + act.slice(1))}</button>`;
  function filteredUsers() {
    const q = MOD.q.trim().toLowerCase();
    const want = MOD.tab === 'moderators' ? 'moderator' : 'user';
    return MOD.users.filter((x) => x.account_role === want && (!q || fullName(x).toLowerCase().includes(q)));
  }
  function usersBody() {
    const list = filteredUsers();
    const shown = list.slice(0, MOD.usersShown);
    const sel = shown.find((x) => x.user_id === MOD.sel) || shown[0] || null;
    MOD.sel = sel?.user_id || null;
    if (!shown.length) return `<div class="hm-card hm-empty">${MOD.tab === 'moderators' ? 'No moderators found.' : 'No users found.'}</div>`;
    const cards = shown.map((x) => {
      const isSel = x.user_id === MOD.sel, isMod = x.account_role === 'moderator';
      return `<article class="hm-card hm-user ${isSel ? 'selected' : ''}" onclick="modSelectUser('${e(x.user_id)}')"><div class="hm-user-top">${avatar('', 'lg')}<div><b class="hm-name">${e(fullName(x))}</b><span class="hm-role">${isMod ? 'Moderator' : 'User'}</span><span class="${x.is_blocked ? 'hm-blocked' : 'hm-active'}">${x.is_blocked ? 'Blocked account' : 'Active account'}</span></div></div><button class="hm-btn ${isMod ? 'secondary' : 'primary'}" ${!isMod && x.is_blocked ? 'disabled' : ''} onclick="event.stopPropagation();modAskRole('${e(x.user_id)}','${isMod ? 'revoke' : 'assign'}')">${isMod ? 'Remove Moderator' : 'Make Moderator'}</button></article>`;
    }).join('');
    const more = `<p class="hm-note">Showing ${shown.length} of ${list.length} ${MOD.q.trim() ? 'matching ' : ''}${MOD.tab === 'moderators' ? 'moderators' : 'users'}. Search works on names only.</p>${list.length > shown.length ? '<button class="hm-btn secondary hm-showmore" onclick="modUsersMore()">Show more</button>' : ''}`;
    const isMod = sel.account_role === 'moderator';
    const row = (k) => {
      const v = isMod ? permsOf(sel.user_id, k) : MOD.preview[k];
      return `<div class="hm-card hm-perm"><div class="hm-perm-head"><h3>${e(SECTIONS[k].title)}</h3><p>${e(SECTIONS[k].perm)}</p></div><div class="hm-psws" role="group" aria-label="${e(SECTIONS[k].title)} permissions">${ACTIONS.map(([a, label]) => permSwitch(v[a], k, a, SECTIONS[k].short + ' ' + label, MOD.busy)).join('')}</div></div>`;
    };
    return `${cards}${more}<h2 class="hm-h2 lg">Moderator Permissions</h2><p class="hm-lead">${isMod ? e('Saved access for ' + fullName(sel)) : 'Preview access to assign after promotion'}</p>${MOD.permErr ? errBox(MOD.permErr) : ''}${KEYS.map(row).join('')}<p class="hm-note">${isMod ? 'Each change is saved on its own and the saved state is shown above.' : 'These are applied only after Make Moderator succeeds.'} Rejections require a reason.</p>`;
  }
  function usersPage() {
    const err = MOD.errors['mod-users'];
    const tab = (t, label) => `<button role="tab" aria-selected="${MOD.tab === t}" class="${MOD.tab === t ? 'on' : ''}" onclick="modUsersTab('${t}')">${label}</button>`;
    return head('User Management', 'Search users and manage moderator access', 'admin-profile') + `<div class="hm-wrap">${err ? errBox(err) : `
      <div class="hm-tabs" role="tablist">${tab('users', 'Users')}${tab('moderators', 'Moderators')}</div>
      <h2 class="hm-h2 lg">Search Users</h2>
      <label class="hm-search"><input id="hmUserSearch" type="search" value="${e(MOD.q)}" placeholder="Search by name" aria-label="Search users by name" oninput="modUsersSearch(this.value)" autocomplete="off"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/></svg></label>
      <div id="hmUsersBody">${usersBody()}</div>`}</div>`;
  }
  const refreshUsers = () => { const b = document.getElementById('hmUsersBody'); if (b) b.innerHTML = usersBody(); };
  window.modUsersTab = (t) => { MOD.tab = t; MOD.sel = null; MOD.usersShown = USERS_SHOWN; render(); };
  window.modUsersSearch = (v) => { MOD.q = v; MOD.usersShown = USERS_SHOWN; refreshUsers(); };
  window.modUsersMore = () => { MOD.usersShown += USERS_SHOWN; refreshUsers(); };
  window.modSelectUser = (id) => { MOD.sel = id; refreshUsers(); };
  window.modTogglePerm = async (key, act) => {
    const u = MOD.users.find((x) => x.user_id === MOD.sel);
    if (!u || MOD.busy || !ACTIONS.some((a) => a[0] === act)) return;
    if (u.account_role !== 'moderator') { MOD.preview[key][act] = !MOD.preview[key][act]; refreshUsers(); return; }
    const cur = permsOf(u.user_id, key);
    const next = { ...cur, [act]: !cur[act] };           // only the clicked permission changes
    MOD.permErr = ''; MOD.busy = true;
    const had = MOD.perms.find((p) => p.moderator_id === u.user_id && p.section_key === key);
    const snapshot = MOD.perms.map((p) => ({ ...p }));
    const apply = (v) => {
      const row = { moderator_id: u.user_id, section_key: key, can_review: v.review, can_approve: v.approve, can_reject: v.reject, can_edit: v.edit };
      if (had && MOD.perms.includes(had)) Object.assign(had, row); else MOD.perms.push(row);
    };
    apply(next); refreshUsers();
    try {
      await rpc('admin_set_moderator_section_permissions', permArgs(u.user_id, key, next));
    } catch (err) {
      MOD.perms = snapshot;
      MOD.permErr = 'Could not save ' + SECTIONS[key].short + ' ' + act + ' permission: ' + (err?.message || 'unknown error') + '. Showing the saved state.';
      try { await loadPerms(); } catch (_) { /* keep snapshot */ }
    }
    MOD.busy = false; refreshUsers();
  };
  const permSummary = (v) => ACTIONS.filter(([a]) => v[a]).map(([, l]) => l).join('/') || 'none';
  window.modAskRole = (id, action) => {
    const u = MOD.users.find((x) => x.user_id === id);
    if (!u) return;
    MOD.pendingId = id;
    const assign = action === 'assign';
    if (assign && MOD.assign?.id !== id) MOD.assign = null;
    const lines = assign ? KEYS.map((k) => `<li>${e(SECTIONS[k].short)}: ${e(permSummary(MOD.preview[k]))}</li>`).join('') : '';
    openModal(`<h2>${assign ? 'Make Moderator?' : 'Remove Moderator?'}</h2><p>${assign ? e(fullName(u)) + ' will become a Moderator with these permissions:' : 'This removes the Moderator role and all section permissions for ' + e(fullName(u)) + '.'}</p>${assign ? `<ul class="hm-sumlist">${lines}</ul>` : ''}<p id="hmErr" class="hm-modal-err" role="alert" hidden></p><div class="hm-modal-actions"><button class="hm-btn secondary" id="hmRoleCancel" onclick="modRoleCancel()">Cancel</button><button class="hm-btn primary" id="hmRoleGo" onclick="modRoleConfirm('${action}')">${assign ? 'Make Moderator' : 'Remove'}</button></div>`);
  };
  async function reloadUsersQuiet() {
    try { MOD.users = (await rpc('admin_list_moderator_candidates')) || MOD.users; } catch (_) { /* keep */ }
    try { await loadPerms(); } catch (_) { /* keep */ }
  }
  window.modRoleCancel = async () => {
    if (MOD.busy) return;
    const partial = !!MOD.assign;
    closeModal();
    if (partial) { MOD.assign = null; await reloadUsersQuiet(); if (S.route === 'mod-users') render(); }
  };
  window.modRoleConfirm = async (action) => {
    if (MOD.busy) return;
    const id = MOD.pendingId;
    setModalBusy(true);
    let step = 'the role change';
    try {
      if (action === 'assign') {
        // Intended permissions are frozen at first attempt so a retry applies exactly the same set.
        if (!MOD.assign || MOD.assign.id !== id) MOD.assign = { id, roleDone: false, done: {}, want: JSON.parse(JSON.stringify(MOD.preview)) };
        const st = MOD.assign;
        if (MOD.users.find((x) => x.user_id === id)?.account_role === 'moderator') st.roleDone = true;
        if (!st.roleDone) { step = 'assigning the Moderator role'; await rpc('admin_assign_moderator', { p_user_id: id }); st.roleDone = true; }
        for (const k of KEYS) {
          if (st.done[k]) continue;
          step = 'saving ' + SECTIONS[k].short + ' permissions';
          await rpc('admin_set_moderator_section_permissions', permArgs(id, k, st.want[k]));
          st.done[k] = true;
        }
        MOD.assign = null; MOD.preview = blankPreview();
      } else {
        step = 'removing the Moderator role';
        await rpc('admin_revoke_moderator', { p_user_id: id });
      }
      MOD.busy = false; closeModal();
      toast(action === 'assign' ? 'Moderator role and permissions saved' : 'Moderator role removed');
      MOD.fresh['mod-users'] = false; render();
    } catch (err) {
      setModalBusy(false);
      await reloadUsersQuiet();                                  // show what the server really has
      let msg = 'Failed while ' + step + ': ' + (err?.message || 'unknown error') + '.';
      if (action === 'assign' && MOD.assign) {
        const st = MOD.assign;
        const ok = KEYS.filter((k) => st.done[k]).map((k) => SECTIONS[k].short), left = KEYS.filter((k) => !st.done[k]).map((k) => SECTIONS[k].short);
        msg += ' Role: ' + (st.roleDone ? 'assigned' : 'not assigned') + '. Permissions saved: ' + (ok.join(', ') || 'none') + '. Not saved yet: ' + (left.join(', ') || 'none') + '. Nothing is marked successful until every step finishes.';
        const go = document.getElementById('hmRoleGo'); if (go) go.textContent = 'Retry remaining steps';
        const cancel = document.getElementById('hmRoleCancel'); if (cancel) cancel.textContent = 'Close';
      }
      modalErr(msg);
      if (S.route === 'mod-users') render();
      document.getElementById('hmRoleGo')?.focus();
    }
  };

  /* ---------- Poetry Management (Admin) ---------- */
  const editIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 20 1-4L16.5 4.5a2 2 0 0 1 3 3L8 19l-4 1z"/></svg>';
  const archiveIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 5h17v4h-17zM5 9v10h14V9M10 13h4"/></svg>';
  const restoreIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.5-5.8M4 4v4.5h4.5"/></svg>';
  function catListHtml() {
    const q = MOD.catQ.trim().toLowerCase();
    const match = (c) => !q || String(c.name).toLowerCase().includes(q);
    const active = MOD.allCats.filter((c) => c.is_active !== false && match(c));
    const archived = MOD.catsLimited ? [] : MOD.allCats.filter((c) => c.is_active === false && match(c));
    let out = active.length ? active.map((c) => `<div class="hm-card hm-cat-row"><span class="hm-cat-name">${e(c.name)}</span><span class="hm-cat-acts"><button onclick="modEditCat('${e(c.id)}')">${editIcon}Edit</button><i aria-hidden="true"></i><button onclick="modDeleteCat('${e(c.id)}')">${archiveIcon}Archive</button></span></div>`).join('')
      : `<div class="hm-card hm-empty">${q ? 'No categories match your search.' : 'No categories yet. Add the first one above.'}</div>`;
    if (MOD.catsLimited) out += '<p class="hm-note" role="note">Archived categories cannot be listed with your current access, so Restore is not available here.</p>';
    else if (archived.length) out += `<h3 class="hm-h3">Archived Categories</h3>${archived.map((c) => `<div class="hm-card hm-cat-row archived"><span class="hm-cat-name">${e(c.name)}</span><span class="hm-cat-acts"><button onclick="modRestoreCat('${e(c.id)}')">${restoreIcon}Restore</button></span></div>`).join('')}`;
    return out;
  }
  function poetryMgmtPage() {
    const err = MOD.errors['poetry-management'];
    const items = MOD.queue.length ? MOD.queue.map((x) => {
      const a = authorOf(x), cat = categoryOf(x), nm = mediaCount(x);
      return `<article class="hm-card hm-sub-card"><div class="hm-author">${avatar(a.photo)}<div class="hm-who"><b class="hm-name ${a.missing ? 'hm-unavail' : ''}">${e(a.name)}</b><div class="hm-sub"><span class="hm-time">${e(timeAgo(x.created_at))}</span></div></div><span class="hm-pending">Pending Review</span></div><h3 class="hm-title" dir="auto">${e(x.title)}</h3>${cat ? `<p class="hm-plain-cat">${e(cat)}</p>` : ''}<p class="hm-preview dark" dir="auto">${e(preview(x.body))}</p><button class="hm-view" onclick="modOpenReview('${e(x.id)}','poetry-management')">View Full Submission ${chevron}</button>${nm ? `<p class="hm-note">Includes ${nm} attachment${nm > 1 ? 's' : ''}, shown in the full review.</p>` : ''}</article>`;
    }).join('') : '<div class="hm-card hm-empty">No poetry is waiting for review.</div>';
    return head('Poetry Management', 'Manage categories and review poetry', 'admin-profile') + `<div class="hm-wrap">${err ? errBox(err) : `
      <section class="hm-group" aria-label="Category management">
      <h2 class="hm-h2 lg">Add Category</h2>
      <form class="hm-add" onsubmit="modAddCat(event)"><input id="hmCatName" class="hm-input" maxlength="60" placeholder="Enter category name" aria-label="Category name" autocomplete="off"><button class="hm-btn primary" type="submit">Add</button></form>
      <h2 class="hm-h2 lg">Manage Categories</h2>
      <label class="hm-search"><svg class="lead" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/></svg><input type="search" value="${e(MOD.catQ)}" placeholder="Search categories" aria-label="Search categories" oninput="modCatSearch(this.value)" autocomplete="off"></label>
      <div id="hmCatList">${catListHtml()}</div></section>
      <section class="hm-group hm-sep" aria-label="Poetry moderation">
      <h2 class="hm-h2 lg">Poetry Moderation</h2><p class="hm-lead">Submissions awaiting review</p><p class="hm-note hm-first">Open a submission to read it in full. Approve and Reject are available only in the full review.</p>${items}${MOD.queue.length ? moreHtml() : ''}</section>`}</div>`;
  }
  window.modCatSearch = (v) => { MOD.catQ = v; const b = document.getElementById('hmCatList'); if (b) b.innerHTML = catListHtml(); };
  window.modAddCat = async (ev) => {
    ev.preventDefault();
    if (MOD.busy) return;
    const input = document.getElementById('hmCatName');
    const name = (input?.value || '').trim().replace(/\s+/g, ' ');
    if (!name) { alert('Enter a category name.'); return; }
    const slug = slugify(name);
    if (!slug) { alert('Use letters or numbers in the category name.'); return; }
    const dup = MOD.allCats.find((c) => String(c.name).toLowerCase() === name.toLowerCase() || c.slug === slug);
    if (dup) { alert(dup.is_active === false ? 'An archived category with this name exists. Restore it from Archived Categories instead.' : 'This category already exists.'); return; }
    MOD.busy = true;
    try {
      await rpc('herday_admin_upsert_poetry_category', { p_name: name, p_slug: slug });
      input.value = '';
      toast('Category added');
      MOD.busy = false; MOD.fresh['poetry-management'] = false; render();
    } catch (err) { MOD.busy = false; alert(err?.message || 'Could not add the category.'); }
  };
  window.modEditCat = (id) => {
    const c = MOD.allCats.find((x) => x.id === id);
    if (!c) return;
    MOD.catId = id;
    openModal(`<h2>Edit Category</h2><label class="hm-lbl" for="hmCatEdit">Category name</label><input id="hmCatEdit" class="hm-input" maxlength="60" value="${e(c.name)}"><p id="hmErr" class="hm-modal-err" role="alert" hidden></p><div class="hm-modal-actions"><button class="hm-btn secondary" onclick="modClose()">Cancel</button><button class="hm-btn primary" onclick="modSaveCat()">Save</button></div>`);
  };
  window.modSaveCat = async () => {
    if (MOD.busy) return;
    const c = MOD.allCats.find((x) => x.id === MOD.catId);
    const name = (document.getElementById('hmCatEdit')?.value || '').trim().replace(/\s+/g, ' ');
    if (!c) { closeModal(); return; }
    if (!name) { modalErr('Enter a category name.'); return; }
    if (MOD.allCats.some((x) => x.id !== c.id && x.is_active !== false && String(x.name).toLowerCase() === name.toLowerCase())) { modalErr('Another category already uses this name.'); return; }
    setModalBusy(true);
    try {
      await rpc('herday_admin_upsert_poetry_category', { p_name: name, p_slug: c.slug, p_id: c.id, p_is_active: true });
      MOD.busy = false; closeModal(); toast('Category updated');
      MOD.fresh['poetry-management'] = false; render();
    } catch (err) { setModalBusy(false); modalErr(err?.message || 'Could not update the category.'); }
  };
  window.modDeleteCat = (id) => {
    const c = MOD.allCats.find((x) => x.id === id);
    if (!c) return;
    MOD.catId = id;
    openModal(`<h2>Archive category?</h2><p>“${e(c.name)}” will no longer be offered for new poetry. Poetry already using it keeps its category.${MOD.catsLimited ? ' Restoring archived categories is not available here with your current access.' : ' You can restore it later from Archived Categories.'}</p><p id="hmErr" class="hm-modal-err" role="alert" hidden></p><div class="hm-modal-actions"><button class="hm-btn secondary" onclick="modClose()">Cancel</button><button class="hm-btn primary" onclick="modSetCatActive(false)">Archive</button></div>`);
  };
  window.modRestoreCat = (id) => {
    const c = MOD.allCats.find((x) => x.id === id);
    if (!c) return;
    MOD.catId = id;
    openModal(`<h2>Restore category?</h2><p>“${e(c.name)}” will be offered again for new poetry.</p><p id="hmErr" class="hm-modal-err" role="alert" hidden></p><div class="hm-modal-actions"><button class="hm-btn secondary" onclick="modClose()">Cancel</button><button class="hm-btn primary" onclick="modSetCatActive(true)">Restore</button></div>`);
  };
  window.modSetCatActive = async (active) => {
    if (MOD.busy) return;
    const c = MOD.allCats.find((x) => x.id === MOD.catId);
    if (!c) { closeModal(); return; }
    setModalBusy(true);
    try {
      await rpc('herday_admin_upsert_poetry_category', { p_name: c.name, p_slug: c.slug, p_id: c.id, p_is_active: active });
      MOD.busy = false; closeModal(); toast(active ? 'Category restored' : 'Category archived');
      MOD.fresh['poetry-management'] = false; render();
    } catch (err) { setModalBusy(false); modalErr(err?.message || 'Could not update the category.'); }
  };
})();
