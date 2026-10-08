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
  const QUEUE_LIMIT = 100;
  const USERS_SHOWN = 20;

  const MOD = {
    fresh: {}, loading: {}, errors: {},
    perms: [], queue: [], counts: {}, activity: [], cats: [], allCats: [],
    users: [], authors: {},
    tab: 'users', q: '', sel: null, preview: { poetry: false, explore: false, girls_space: false },
    catQ: '', busy: false, pendingId: null, catId: null
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
      MOD.allCats = !error && Array.isArray(data) ? data : MOD.cats.map((c) => ({ ...c, is_active: true }));
    }
  }
  async function fetchQueue(key) {
    const data = await rpc('herday_get_content', { p_view: 'queue', p_section_key: key, p_limit: QUEUE_LIMIT });
    return Array.isArray(data) ? data : [];
  }
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
    MOD.activity = [];
    const u = me();
    if (!u) return;
    try {
      const { data, error } = await supabaseClient.from('content_moderation_decisions')
        .select('id,submission_id,section_key,to_status,reason,created_at').eq('actor_id', u.id)
        .order('created_at', { ascending: false }).limit(3);
      if (!error && Array.isArray(data)) MOD.activity = data;
    } catch (_) { /* optional */ }
  }

  const LOADERS = {
    async 'mod-tools'() {
      await loadPerms();
      const keys = allowedSections();
      MOD.counts = {};
      await Promise.all(keys.map(async (k) => { try { MOD.counts[k] = (await fetchQueue(k)).length; } catch (_) { MOD.counts[k] = null; } }));
      await loadActivity();
    },
    async 'mod-queue'() {
      await loadPerms();
      await loadCats(false);
      MOD.queue = await fetchQueue(section());
      await loadAuthors(MOD.queue);
    },
    async 'mod-review'() { await LOADERS['mod-queue'](); },
    async 'mod-users'() {
      MOD.users = (await rpc('admin_list_moderator_candidates')) || [];
      await loadPerms();
    },
    async 'poetry-management'() {
      await loadCats(true);
      MOD.queue = await fetchQueue('poetry');
      await loadAuthors(MOD.queue);
    }
  };
  function load(route) {
    if (MOD.loading[route]) return;
    MOD.loading[route] = true;
    MOD.errors[route] = '';
    LOADERS[route]().catch((err) => { MOD.errors[route] = err?.message || 'Could not load this page.'; })
      .finally(() => { MOD.loading[route] = false; MOD.fresh[route] = true; if (S.route === route) render(); });
  }

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
      const pill = n == null ? '' : `<span class="hm-count">${n >= QUEUE_LIMIT ? QUEUE_LIMIT + '+' : n} Pending</span>`;
      return `<button class="hm-tool" onclick="modOpenQueue('${k}')"><div><h3>${e(SECTIONS[k].title)}</h3><p>${e(SECTIONS[k].tool)}</p>${pill}</div>${chevron}</button>`;
    }).join('');
    const act = MOD.activity.length ? `<h2 class="hm-h2">Recent Activity</h2><div class="hm-card hm-activity">${MOD.activity.map((a) => {
      const k = KEYS.includes(a.section_key) ? a.section_key : 'poetry';
      const verb = a.to_status === 'approved' ? 'approved' : a.to_status === 'rejected' ? 'rejected' : 'updated';
      return `<button class="hm-act" onclick="modOpenQueue('${k}')"><div><b>${e(SECTIONS[k].short)} submission ${verb}</b>${a.reason ? '<span>Reason submitted</span>' : ''}<span>${e(dayLabel(a.created_at))}</span></div>${chevron}</button>`;
    }).join('')}</div>` : '';
    return head('Moderator Tools', 'Review content assigned to you', backToTools()) + `<div class="hm-wrap">
      <section class="hm-card hm-identity">${avatar(u.photo, 'lg')}<div><b class="hm-name">${e(userFullName(u))}</b><span class="hm-role">${isAdminUser() ? 'Admin' : 'Moderator'}</span><p>${isAdminUser() ? 'You have access to every moderation section.' : 'Your moderation access is managed by an Admin.'}</p></div></section>
      <h2 class="hm-h2">Assigned Moderation</h2>
      ${err ? errBox(err) : cards || '<div class="hm-card hm-empty">No moderation sections are assigned to you yet. An Admin can assign them.</div>'}
      ${keys.length ? '<p class="hm-note">Rejections require a reason.</p>' : ''}
      ${act}</div>`;
  }
  window.modOpenQueue = (k) => { if (KEYS.includes(k)) nav('mod-queue', { modSection: k }); };

  /* ---------- submission cards ---------- */
  function authorOf(x) {
    const a = MOD.authors[x.author_id] || {};
    return { name: a.name || 'HerDay Member', photo: a.photo || '' };
  }
  function preview(body) {
    return String(body || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean).slice(0, 2).join('\n');
  }
  function actionButtons(x) {
    const p = perm(x.section_key);
    return `<div class="hm-actions"><button class="hm-btn primary" ${p.approve ? '' : 'disabled'} onclick="modAskApprove('${e(x.id)}')">Approve</button><button class="hm-btn secondary" ${p.reject ? '' : 'disabled'} onclick="modAskReject('${e(x.id)}')">Reject</button></div>`;
  }
  function authorRow(x, withCategory) {
    const a = authorOf(x), cat = categoryOf(x);
    return `<div class="hm-author">${avatar(a.photo)}<div class="hm-who"><b class="hm-name">${e(a.name)}</b><div class="hm-sub"><span class="hm-time">${e(timeAgo(x.created_at))}</span>${withCategory && cat ? `<span class="hm-cat">${e(cat)}</span>` : ''}</div></div><span class="hm-pending">Pending Review</span></div>`;
  }

  /* ---------- Common Review queue ---------- */
  function queuePage() {
    const k = section(), s = SECTIONS[k], err = MOD.errors['mod-queue'];
    let body;
    if (err) body = errBox(err);
    else if (!MOD.queue.length) body = '<div class="hm-card hm-empty">No submissions are waiting for review.</div>';
    else body = MOD.queue.map((x) => `<article class="hm-card hm-sub-card">${authorRow(x, true)}<h3 class="hm-title" dir="auto">${e(x.title)}</h3><p class="hm-preview" dir="auto">${e(preview(x.body))}</p><button class="hm-view" onclick="modOpenReview('${e(x.id)}')">View Full Submission ${chevron}</button>${actionButtons(x)}</article>`).join('');
    return head(s.title, s.qSub, 'mod-tools') + `<div class="hm-wrap"><h2 class="hm-h2 lg">Pending Submissions</h2><p class="hm-lead">${e(s.wait)}</p>${body}</div>`;
  }
  window.modOpenReview = (id) => nav('mod-review', { modReviewId: id });

  /* ---------- Full Submission Review ---------- */
  function reviewPage() {
    const err = MOD.errors['mod-review'];
    const x = MOD.queue.find((v) => v.id === S.modReviewId);
    if (err) return head('Review Submission', '', 'mod-queue') + `<div class="hm-wrap">${errBox(err)}</div>`;
    if (!x) return head('Review Submission', 'Review the full content before taking action', 'mod-queue') + '<div class="hm-wrap"><div class="hm-card hm-empty">This submission is no longer pending. Return to the queue.</div></div>';
    const media = Array.isArray(x.r2_object_keys) ? x.r2_object_keys.length : 0;
    return head('Review Submission', 'Review the full content before taking action', 'mod-queue') + `<div class="hm-wrap"><article class="hm-card hm-sub-card hm-full-card">${authorRow(x, true)}<h3 class="hm-title" dir="auto">${e(x.title)}</h3><div class="hm-full" dir="auto">${e(x.body)}</div>${media ? `<p class="hm-note">Includes ${media} media file${media > 1 ? 's' : ''}. Media preview is not available in this screen yet.</p>` : ''}${actionButtons(x)}</article></div>`;
  }

  /* ---------- modals ---------- */
  function openModal(html) {
    closeModal();
    document.body.insertAdjacentHTML('beforeend', `<div id="hmModal" class="hm-modal-backdrop" onclick="if(event.target===this)modClose()"><div class="hm-modal" role="dialog" aria-modal="true">${html}</div></div>`);
    document.getElementById('hmModal')?.querySelector('input:checked,input,textarea,button')?.focus();
  }
  function closeModal() { document.getElementById('hmModal')?.remove(); }
  window.modClose = () => { if (!MOD.busy) closeModal(); };
  document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && document.getElementById('hmModal')) window.modClose(); });
  const setModalBusy = (on) => { MOD.busy = on; document.querySelectorAll('#hmModal button,#hmModal input,#hmModal textarea').forEach((b) => { b.disabled = on; }); };
  const modalErr = (m) => { const el = document.getElementById('hmErr'); if (el) { el.textContent = m; el.hidden = !m; } };

  window.modAskApprove = (id) => {
    if (!MOD.queue.some((x) => x.id === id)) return;
    MOD.pendingId = id;
    openModal(`<h2>Approve submission?</h2><p>Confirm you have reviewed the complete submission.</p><p id="hmErr" class="hm-modal-err" role="alert" hidden></p><div class="hm-modal-actions"><button class="hm-btn secondary" onclick="modClose()">Cancel</button><button class="hm-btn primary" onclick="modDecide('approved')">Approve</button></div>`);
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
      if (S.route === 'mod-review') { nav('mod-queue'); return; }
      MOD.fresh[S.route] = true; render();
    } catch (err) {
      setModalBusy(false);
      modalErr(err?.message || 'Could not save the decision. Try again.');
      if (!document.getElementById('hmErr')) alert(err?.message || 'Could not save the decision.');
    }
  };

  /* ---------- User Management (Admin) ---------- */
  const fullName = (x) => [x.first_name, x.last_name].filter(Boolean).join(' ') || 'HerDay User';
  const switchHtml = (on, key, label, disabled) => `<button class="hm-switch ${on ? 'on' : ''}" role="switch" aria-checked="${on}" aria-label="${e(label)}" ${disabled ? 'disabled' : ''} onclick="modTogglePerm('${key}')"><span></span></button>`;
  function filteredUsers() {
    const q = MOD.q.trim().toLowerCase();
    const want = MOD.tab === 'moderators' ? 'moderator' : 'user';
    return MOD.users.filter((x) => x.account_role === want && (!q || fullName(x).toLowerCase().includes(q)));
  }
  function usersBody() {
    const list = filteredUsers();
    const shown = list.slice(0, USERS_SHOWN);
    const sel = shown.find((x) => x.user_id === MOD.sel) || shown[0] || null;
    MOD.sel = sel?.user_id || null;
    if (!shown.length) return `<div class="hm-card hm-empty">${MOD.tab === 'moderators' ? 'No moderators found.' : 'No users found.'}</div>`;
    const cards = shown.map((x) => {
      const isSel = x.user_id === MOD.sel, isMod = x.account_role === 'moderator';
      return `<article class="hm-card hm-user ${isSel ? 'selected' : ''}" onclick="modSelectUser('${e(x.user_id)}')"><div class="hm-user-top">${avatar('', 'lg')}<div><b class="hm-name">${e(fullName(x))}</b><span class="hm-role">${isMod ? 'Moderator' : 'User'}</span><span class="${x.is_blocked ? 'hm-blocked' : 'hm-active'}">${x.is_blocked ? 'Blocked account' : 'Active account'}</span></div></div><button class="hm-btn ${isMod ? 'secondary' : 'primary'}" ${!isMod && x.is_blocked ? 'disabled' : ''} onclick="event.stopPropagation();modAskRole('${e(x.user_id)}','${isMod ? 'revoke' : 'assign'}')">${isMod ? 'Remove Moderator' : 'Make Moderator'}</button></article>`;
    }).join('');
    const more = list.length > shown.length ? `<p class="hm-note">Showing ${shown.length} of ${list.length}. Search by name to narrow the list.</p>` : '';
    const isMod = sel.account_role === 'moderator';
    const row = (k) => {
      const on = isMod ? !!MOD.perms.find((p) => p.moderator_id === sel.user_id && p.section_key === k)?.can_review : MOD.preview[k];
      return `<div class="hm-card hm-perm"><div><h3>${e(SECTIONS[k].title)}</h3><p>${e(SECTIONS[k].perm)}</p></div>${switchHtml(on, k, SECTIONS[k].title, MOD.busy)}</div>`;
    };
    return `${cards}${more}<h2 class="hm-h2 lg">Moderator Permissions</h2><p class="hm-lead">${isMod ? e('Access for ' + fullName(sel)) : 'Preview access to assign after promotion'}</p>${KEYS.map(row).join('')}<p class="hm-note">Rejections require a reason.</p>`;
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
  window.modUsersTab = (t) => { MOD.tab = t; MOD.sel = null; render(); };
  window.modUsersSearch = (v) => { MOD.q = v; refreshUsers(); };
  window.modSelectUser = (id) => { MOD.sel = id; refreshUsers(); };
  window.modTogglePerm = async (key) => {
    const u = MOD.users.find((x) => x.user_id === MOD.sel);
    if (!u || MOD.busy) return;
    if (u.account_role !== 'moderator') { MOD.preview[key] = !MOD.preview[key]; refreshUsers(); return; }
    const had = MOD.perms.find((p) => p.moderator_id === u.user_id && p.section_key === key);
    const next = !had?.can_review;
    const snapshot = MOD.perms.map((p) => ({ ...p }));
    if (had) Object.assign(had, { can_review: next, can_approve: next, can_reject: next });
    else MOD.perms.push({ moderator_id: u.user_id, section_key: key, can_review: next, can_approve: next, can_reject: next, can_edit: false });
    MOD.busy = true; refreshUsers();
    try {
      await rpc('admin_set_moderator_section_permissions', { p_moderator_id: u.user_id, p_section_key: key, p_can_review: next, p_can_approve: next, p_can_reject: next, p_can_edit: false });
    } catch (err) {
      MOD.perms = snapshot;
      alert(err?.message || 'Could not update permission.');
    }
    MOD.busy = false; refreshUsers();
  };
  window.modAskRole = (id, action) => {
    const u = MOD.users.find((x) => x.user_id === id);
    if (!u) return;
    MOD.pendingId = id;
    const assign = action === 'assign';
    const on = KEYS.filter((k) => MOD.preview[k]).map((k) => SECTIONS[k].short).join(', ');
    openModal(`<h2>${assign ? 'Make Moderator?' : 'Remove Moderator?'}</h2><p>${assign ? e(fullName(u)) + ' will become a Moderator' + (on ? ' with access to: ' + e(on) + '.' : ' with no sections assigned yet.') : 'This removes the Moderator role and all section permissions for ' + e(fullName(u)) + '.'}</p><p id="hmErr" class="hm-modal-err" role="alert" hidden></p><div class="hm-modal-actions"><button class="hm-btn secondary" onclick="modClose()">Cancel</button><button class="hm-btn primary" onclick="modRoleConfirm('${action}')">${assign ? 'Make Moderator' : 'Remove'}</button></div>`);
  };
  window.modRoleConfirm = async (action) => {
    if (MOD.busy) return;
    const id = MOD.pendingId;
    setModalBusy(true);
    try {
      if (action === 'assign') {
        await rpc('admin_assign_moderator', { p_user_id: id });
        for (const k of KEYS) {
          const on = !!MOD.preview[k];
          await rpc('admin_set_moderator_section_permissions', { p_moderator_id: id, p_section_key: k, p_can_review: on, p_can_approve: on, p_can_reject: on, p_can_edit: false });
        }
        MOD.preview = { poetry: false, explore: false, girls_space: false };
      } else {
        await rpc('admin_revoke_moderator', { p_user_id: id });
      }
      MOD.busy = false; closeModal();
      toast(action === 'assign' ? 'Moderator role assigned' : 'Moderator role removed');
      MOD.fresh['mod-users'] = false; render();
    } catch (err) {
      setModalBusy(false);
      modalErr(err?.message || 'Could not update the role.');
      MOD.fresh['mod-users'] = false;
    }
  };

  /* ---------- Poetry Management (Admin) ---------- */
  function catListHtml() {
    const q = MOD.catQ.trim().toLowerCase();
    const list = MOD.allCats.filter((c) => c.is_active !== false && (!q || String(c.name).toLowerCase().includes(q)));
    if (!list.length) return `<div class="hm-card hm-empty">${q ? 'No categories match your search.' : 'No categories yet. Add the first one above.'}</div>`;
    return list.map((c) => `<div class="hm-card hm-cat-row"><span class="hm-cat-name">${e(c.name)}</span><span class="hm-cat-acts"><button onclick="modEditCat('${e(c.id)}')"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 20 1-4L16.5 4.5a2 2 0 0 1 3 3L8 19l-4 1z"/></svg>Edit</button><i aria-hidden="true"></i><button onclick="modDeleteCat('${e(c.id)}')"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13"/></svg>Delete</button></span></div>`).join('');
  }
  function poetryMgmtPage() {
    const err = MOD.errors['poetry-management'];
    const items = MOD.queue.length ? MOD.queue.map((x) => {
      const a = authorOf(x), cat = categoryOf(x);
      return `<article class="hm-card hm-sub-card"><div class="hm-author">${avatar(a.photo)}<div class="hm-who"><b class="hm-name">${e(a.name)}</b><div class="hm-sub"><span class="hm-time">${e(timeAgo(x.created_at))}</span></div></div><span class="hm-pending">Pending Review</span></div><h3 class="hm-title" dir="auto">${e(x.title)}</h3>${cat ? `<p class="hm-plain-cat">${e(cat)}</p>` : ''}<p class="hm-preview dark" dir="auto">${e(preview(x.body))}</p>${actionButtons(x)}</article>`;
    }).join('') : '<div class="hm-card hm-empty">No poetry is waiting for review.</div>';
    return head('Poetry Management', 'Manage categories and review poetry', 'admin-profile') + `<div class="hm-wrap">${err ? errBox(err) : `
      <h2 class="hm-h2 lg">Add Category</h2>
      <form class="hm-add" onsubmit="modAddCat(event)"><input id="hmCatName" class="hm-input" maxlength="60" placeholder="Enter category name" aria-label="Category name" autocomplete="off"><button class="hm-btn primary" type="submit">Add</button></form>
      <h2 class="hm-h2 lg">Manage Categories</h2>
      <label class="hm-search"><svg class="lead" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/></svg><input type="search" value="${e(MOD.catQ)}" placeholder="Search categories" aria-label="Search categories" oninput="modCatSearch(this.value)" autocomplete="off"></label>
      <div id="hmCatList">${catListHtml()}</div>
      <h2 class="hm-h2 lg">Poetry Moderation</h2><p class="hm-lead">Submissions awaiting review</p>${items}`}</div>`;
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
    if (MOD.allCats.some((c) => c.is_active !== false && (String(c.name).toLowerCase() === name.toLowerCase() || c.slug === slug))) { alert('This category already exists.'); return; }
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
    openModal(`<h2>Delete category?</h2><p>“${e(c.name)}” will no longer be offered for new poetry. Poetry already using it keeps its category.</p><p id="hmErr" class="hm-modal-err" role="alert" hidden></p><div class="hm-modal-actions"><button class="hm-btn secondary" onclick="modClose()">Cancel</button><button class="hm-btn primary" onclick="modConfirmDeleteCat()">Delete</button></div>`);
  };
  window.modConfirmDeleteCat = async () => {
    if (MOD.busy) return;
    const c = MOD.allCats.find((x) => x.id === MOD.catId);
    if (!c) { closeModal(); return; }
    setModalBusy(true);
    try {
      await rpc('herday_admin_upsert_poetry_category', { p_name: c.name, p_slug: c.slug, p_id: c.id, p_is_active: false });
      MOD.busy = false; closeModal(); toast('Category deleted');
      MOD.fresh['poetry-management'] = false; render();
    } catch (err) { setModalBusy(false); modalErr(err?.message || 'Could not delete the category.'); }
  };
})();
