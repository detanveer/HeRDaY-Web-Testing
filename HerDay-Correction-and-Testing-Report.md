# HerDay — User Browser Testing Source

Baseline: latest supplied HerDay-Web-Poetry-Upload-Moderation-Preview-Correction.zip only.
This package is for user-led browser testing, as explicitly requested after the workspace Chromium download failed. It is not a fully browser-verified production release. No deployment, DNS change, or production data mutation was performed during preparation.

## Changed files
- admin-post-history.js
- beauty.js
- content-service.js
- index.html
- moderation.js
- my-posts.js
- poetry.js

## Changes
- Public Poetry uses approved submission RPC data and public author names instead of demo reference records.
- Comments use the installed add/read RPCs with request IDs for retry handling.
- Active categories appear with empty search; Admin category management uses the installed Admin RPCs, including permanent category deletion.
- Submission confirms saved state and publishes images for approved posts; retries retain confirmed uploads/submission IDs.
- Admin can inspect Moderator auto-approved posts and deletion metadata history.
- Admin delete controls call the deployed Worker deletion endpoint; Moderator has no delete control.
- Base URL opens Home; explicit URL routes preserve refresh/navigation state. Protected actions require login.
- Existing CSS, image assets, canvas #FFF8FA, card surfaces and CTA colors are unchanged.

## Verification and limits
All source JavaScript syntax checks passed. Local Worker mocked contract tests: 13 passed (not live Supabase/R2 proof). Local script references resolve. Root CNAME is web.appherday.com. Every baseline file outside the seven listed files is byte-identical; no baseline file removed.
Browser testing was not completed because Chromium download returned truncated/invalid archives. Actual uploaded images, autoapproval, private previews, publication, comments, roles, category deletion and media deletion still require user testing. Existing backend feed/mine RPC limits retrieval to the latest 100 posts; older deep links may not resolve. Root CNAME verification does not prove GitHub/Cloudflare deployed output or DNS.
Worker and SQL updates already confirmed installed/deployed by the user are external dependencies; this frontend ZIP does not redeploy them.

## Browser test order
1. Deploy this frontend through your existing workflow. Open the base URL: Home should appear. Refresh Home, then open Poetry and refresh: the Poetry page should remain.
2. Poetry should show actual approved posts, not example demo records; categories should be visible without typing search.
3. Send one comment on an approved real Poetry post. Refresh and confirm it remains. Guest comment/submit should open login.
4. Submit an Admin text-only test post: confirm approved status and visibility in Poetry. Then test an image post (first one image, then five).
5. Test ordinary-user pending submission and moderation preview/approve/reject. Confirm all images load before image approval.
6. Test an authorized Moderator post and Admin Moderator Posts history. Check another section without permission remains scoped. Moderator should not see delete.
7. Only after testing, delete a specifically selected test post as Admin. Confirm post/comments disappear and deletion history reports media cleanup. Retry cleanup if it reports incomplete. Public cached images can remain briefly after origin deletion.
8. Test category rename, archive/restore and explicit permanent deletion on a test category; existing posts should remain.

Do not bulk-delete production or demo records. Hardcoded example records removed from rendering are source data, not database rows. Deletion applies only to actual database submissions with UUIDs. Capture screenshots and exact error text for any failed step.
