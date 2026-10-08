# HerDay Web — Moderator / Moderation (7 pages) implementation

Base: HerDay-Web-Six-Limited-Corrections (working source). Reference: 7 approved PNGs + visual report.
Nothing else in the base was touched (Home, Beauty, Poetry, Horoscope, Profile, auth unchanged).

## Files
| File | Change |
|---|---|
| `moderation.js` | NEW. All 7 pages + dialogs + Supabase calls |
| `moderation.css` | NEW. Scoped styles (`.mod-screen`, `.hm-*`) |
| `beauty.js` | Small hooks only: route guard + nav/render hooks, Admin module list, Moderator badge + Tools card on Profile |
| `index.html` | Links `moderation.css` and `moderation.js` (loaded before `bootstrapSupabase()`) |

Deploy: upload all 4 files together (cache-busting `?v=20261009-mod7` already set).

## Pages and routes
| Page | Route | Who | Backend used |
|---|---|---|---|
| Moderator entry on Profile (badge + "Moderator Tools" card above Beauty Services) | `user-profile` | role = moderator | none |
| Moderator Tools | `mod-tools` | moderator, admin | `get_moderator_section_permissions`, `herday_get_content` (counts), table `content_moderation_decisions` (Recent Activity) |
| Common Review queue (one screen, section-driven) | `mod-queue` | moderator, admin | `herday_get_content`, `herday_get_poetry_categories` |
| Full Submission Review | `mod-review` | moderator, admin | in-memory queue item |
| Reject dialog (6 reasons, "Other" needs text) + Approve confirmation | modal | moderator, admin | `herday_moderate_content(p_submission_id,p_decision,p_reason)` |
| User Management (Users / Moderators tabs, search, permissions) | `mod-users` | admin | `admin_list_moderator_candidates`, `admin_assign_moderator`, `admin_revoke_moderator`, `admin_set_moderator_section_permissions`, `get_moderator_section_permissions` |
| Poetry Management (add / edit / delete category + poetry review) | `poetry-management` | admin | `herday_admin_upsert_poetry_category`, `herday_get_poetry_categories`, table `poetry_categories`, `herday_get_content`, `herday_moderate_content` |

Admin Profile gets: Moderation -> `mod-tools` (all 3 sections), new "Poetry Management" card, Users -> `mod-users`.
Moderators cannot open `mod-users` / `poetry-management` (UI guard; Supabase must also enforce).

## Decisions where the backend or design was silent (please confirm)
1. **Email not shown** on User Management: `admin_list_moderator_candidates` returns no email and `profiles` has none. Search is by name only (placeholder says so).
2. **Author names**: `herday_get_content` returns `author_id` only. The page tries `profiles` (id, name, avatar); if RLS blocks it, the card shows "HerDay Member". Fix on the SQL side by adding `author_name` / `author_avatar_path` to `herday_get_content`.
3. **Delete category = soft delete** (`p_is_active=false`); no delete RPC exists. Existing poems keep their category. Edit keeps the slug.
4. **Permission switches**: ON sets can_review + can_approve + can_reject = true, can_edit = false; OFF sets all false. Preview switches before promotion default OFF (least privilege); they are applied right after "Make Moderator".
5. **Recent Activity** reads `content_moderation_decisions` directly (own decisions, last 3). If RLS denies it the section simply hides.
6. **Media**: submissions with `r2_object_keys` show "Includes N media files. Media preview is not available yet" (private R2 reads need the Worker URL, not wired here).
7. Counts on Moderator Tools cap at 100 (`100+`), matching the queue limit.
8. Reject reasons are saved as the visible label text (e.g. "Spam / Promotional Content"); for "Other Reason" the typed text is saved.
9. Approve/Reject buttons are disabled when the moderator's `can_approve` / `can_reject` is false. This is UI only.
10. `herday_moderate_content` is called with `p_decision` = `'approved'` / `'rejected'` (same values the earlier Phase 1 code used). If your SQL expects other strings, change them in `modDecide()`.

## Verified (mock Supabase in headless Chromium, 390px and 320px)
Moderator: Profile card/badge, Tools (only permitted sections, counts, activity), queue, full review (stanza breaks kept), Reject dialog (6 reasons, Other validation, no RPC without a reason), approve confirmation, exact RPC arguments, failure keeps the dialog open with the error, admin routes blocked, Reject disabled when not permitted.
Admin: modules, Users/Moderators tabs, search, blocked user cannot be promoted, promote applies the preview permissions, live toggle RPC, add/edit/delete category RPCs, no horizontal overflow at 320px. 0 page errors.

## NOT verified
Real Supabase (RLS, actual return values, enum strings), live site, real R2, real devices. Test against your project before release; Network tab shows any failing RPC with its exact name.
