# HerDay Web — Moderator / Moderation: corrections round (defect report applied)

Baseline: the previously delivered `HerDay-Web-Moderation-7-Pages.zip`. Changed this round: `moderation.js`, `moderation.css`, this report.
`beauty.js`, `index.html` and every other file are unchanged. No SQL, RLS or Worker changes. No dummy data in the app.
Status: **NOT final.** Verified with a mock Supabase + mock Worker in headless Chromium and a side-by-side look at the 7 PNGs. Live Supabase / R2 / GitHub Pages are NOT verified.

## Issue → fix map
| # | Defect | Where (moderation.js) | Fix | Limit / note |
|---|---|---|---|---|
| P0 | Review showed only a count of R2 keys | `reviewPage`, `ensureMedia`, `fetchMedia`, `mediaHtml` | Each attachment is fetched from the existing Worker `GET /v1/private?key=` with the user's Supabase JWT and shown as an image (loading, error + Retry per image). Object URLs are revoked when leaving the review. Nothing is made public. | Worker URL is the one in the existing `r2-test.js` (`HERDAY_MEDIA_WORKER` can override it). The Worker must allow this site's origin (CORS). Not tested live. |
| P0 | Approval could rely on an unseen attachment | `actionButtons`, `modAskApprove` | Submissions with attachments cannot be approved from the queue; in the full review Approve unlocks only after every attachment loaded. The confirmation names the attachment count. Reject stays available. | |
| P0 | Poetry Management had one-tap Approve/Reject | `poetryMgmtPage`, `modOpenReview` | Cards now have only "View Full Submission". Decisions exist only in the full review, which returns to Poetry Management. Category management and moderation are separate groups. | The approved PNG shows Approve/Reject on these cards; the defect report overrides it. |
| P0 | Partial failure while making a moderator | `modRoleConfirm`, `modAskRole` | Intended permissions are frozen, each step is tracked, the real state is reloaded on failure, the exact failing step and what was/wasn't saved is shown, and "Retry remaining steps" continues without re-assigning. Success is shown only when every step succeeded. | No new SQL, so it is retry/recovery, not a transaction. |
| P1 | One switch = review+approve+reject, edit always false | `usersBody`, `modTogglePerm`, `permArgs` | Four independent switches per section (Review, Approve, Reject, Edit). Changing one sends the other three unchanged. Failure restores and reloads the saved state. | |
| P1 | Queue silently truncated at 100 | `fetchQueue`, `loadQueue`, `modLoadMore`, `moreHtml` | Page size 30 + "Load more"; the page says how many are shown and whether more may exist; stops when the server returns nothing new. | `herday_get_content` has no offset/cursor (only `p_limit`), so "Load more" re-reads with a larger limit. |
| P1 | Counts presented as totals | `toolsPage` | Exact below 100, `100+` at the limit (tooltip + note), "Count unavailable" on error. | No count RPC exists. |
| P1 | Review depended on the cached queue | `LOADERS['mod-review']` | Refresh/deep link searches the pending lists (own section first, then other permitted ones, up to 500) for the id. If not found: clear "no longer pending / not found" status with a back button. | `herday_get_content` has no id lookup. |
| P1 | Inactive categories vanished | `loadCats`, `catListHtml`, `modSetCatActive` | Archive and Restore. Archived list is shown when the direct read works; otherwise an explicit note says Restore is unavailable. | "Delete" is now labelled "Archive" (it is `is_active=false`). |
| P2 | User list capped at 20, name search only | `usersBody`, `modUsersMore` | "Showing X of Y", Show more, note that search is by name only. | No email search (RPC returns no email). |
| P2 | Author "HerDay Member" hid identity | `authorOf`, `loadAuthors` | Real name when `profiles` is readable, else "Author unavailable". | RLS not relaxed; adding author fields to the RPC would be the clean fix. |
| P2 | Recent Activity hid errors | `loadActivity`, `toolsPage` | Separate loading / empty / not-available / error (+ Try again) states. | |
| P2 | Stale permissions | `refreshPermsQuiet` | Reloaded on page entry, when the tab becomes visible again, and after a failed decision. Backend stays authoritative. | |
| P2 | Modal focus/scroll | `openModal`, `closeModal`, `trapTab` | Focus trap, Escape, focus returns to the opener (or page heading), page scroll locked, dialog labelled. Look unchanged. | |
| P2 | Visual / runtime proof | — | Compared all 7 states at 420px to the PNGs and tuned sizes. 320/360/390/430/768 px: no horizontal overflow. | See differences below. |

## Remaining visual differences (not changed)
- Header: back arrow sits above the title because the app's existing internal header is reused (the PNGs show it inline). Profile page layout is the existing Profile.
- Font: Poppins (the only loaded Poppins file) vs the heavier sans in the PNGs. Bottom navigation is the app's shared illustrated one.
- Reference names/avatars are examples; real authors may show "Author unavailable".

## Tests run (mock Supabase/Worker, Chromium)
Per batch plus full regression: roles and route guards; approve/reject RPC arguments; reject reason rules (Other needs text); failure keeps the dialog open; per-action permission calls; assign failure at step 2 then retry (role assigned once); pagination 30/60/90 and end; deep-link refresh to an item beyond page 1; unknown id; activity denied/error/empty; image 404 → Retry → loaded; network failure message; approve locked until loaded; Poetry Management has no direct actions and returns correctly; archive/restore; archive-list limitation note; users Show more; focus trap/restore/scroll lock; no overflow at 5 widths. JS syntax OK. 0 page errors (the only console errors are the intentionally mocked 404/network failures).

## Not verified / blockers
Live Supabase responses and RLS for each role, real R2 reads and Worker CORS for this origin, exact `p_decision` strings (`approved`/`rejected` assumed), GitHub Pages behaviour, real devices.
