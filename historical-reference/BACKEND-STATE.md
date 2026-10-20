# HerDay backend state — preserve this established baseline

## Evidence levels

**Applied / deployed** below means the user reported executing/deploying it and supplied the stated result. This handoff makes no new database connection. **Defined in applied migration** means the exact included SQL creates/replaces it, backed by the successful final readiness result; it is not a fresh individual production catalog probe. These distinctions prevent needless setup repetition without pretending every live read/write was tested.

## 1. SQL already run — DO NOT rerun setup blindly

### Community matching setup

User ran the full transaction at once, including COMMIT. A blank result under `pg_advisory_xact_lock` is the normal void-return display, not evidence of a failed migration.

User supplied readiness result:

| community_table | matching_jobs | community_feed | matching_worker_rpc |
|---|---|---|---|
| true | true | true | true |

Relevant tables were also individually present with RLS enabled in the supplied backend inventory:

- `herday_community_details_v1`
- `herday_community_embeddings_v1`
- `herday_community_match_jobs_v1`
- `herday_community_matches_v1`
- `herday_community_receipts_v1`

Exact original Community setup SQL is not bundled here: do not reconstruct and rerun it from memory. Its installed existence and functional later matching are established. Request only a specific current definition if a scoped future change needs it.

### Marketplace + Messages + public profile migration

Included reference: `backend-reference/HerDay-Marketplace-Messages.sql`.
Library identity: `libfile_33c6e566e3e48191ab964a32134b39b6`. Current text was read in full (692 lines) for handoff.

**Important: the file's old header says DRAFT / not applied. That was true when authored, but is stale relative to the user's subsequent successful execution.** User ran it and supplied this final result:

| marketplace_ready | messages_ready | profile_fields_ready |
|---|---|---|
| true | true | true |

The checks establish respectively product table existence, `herday_message_send_v1(uuid,uuid,text,jsonb)` registration, and `profiles.public_about` existence. Other migration objects are recorded below as defined in that applied transaction, not as newly queried one by one.

Migration has CREATE TABLE, constraints, triggers and drift guards; it is not a generic repeatable health check. Do not rerun it to see whether tables exist. Do not duplicate marketplace or chat schema.

### Notifications snapshot — user supplied current definitions on 20 October

Already installed table: `herday_notifications_v1`.
Columns: `id uuid NOT NULL DEFAULT gen_random_uuid()`, `owner_id uuid NOT NULL`, `submission_id uuid NULL`, `section_key text NOT NULL`, `detail_key text NULL`, `event_key text NOT NULL`, `title text NOT NULL`, `message text NOT NULL`, `created_at timestamptz NOT NULL DEFAULT clock_timestamp()`, `read_at timestamptz NULL`.

Current triggers supplied by user:

| Table | Trigger | Event / function |
|---|---|---|
| content_submissions | herday_notify_status_v1 | AFTER INSERT OR UPDATE OF status; herday_notify_status_v1() |
| herday_poetry_comments | herday_notify_comment_v1 | AFTER INSERT; herday_notify_comment_v1() |
| herday_poetry_likes | herday_notify_like_v2 | AFTER INSERT; herday_notify_like_v2() |

Current functions supplied:

- `herday_notify_like_v2()`: approved poetry/explore/girls_space/community post; recipient is post author; no self-like; recipient must be unblocked and notifications_enabled. Inserts New like with event key `like:` plus fresh random UUID.
- `herday_notify_comment_v1()`: approved post in those four sections; root comment recipient post author; reply recipient parent comment author from same submission; no self notification; eligible recipient only. Event key `TG_TABLE_NAME:comment_id`; ON CONFLICT DO NOTHING.
- `herday_notify_status_v1()`: existing author-only Post approved/Post needs changes notices for those four sections; changed status only on UPDATE; notification preferences respected. These review notices were preserved, not removed.
- `herday_get_notifications_v1(p_before_at timestamptz DEFAULT NULL,p_before_id uuid DEFAULT NULL) RETURNS jsonb`: authenticated active user only; cursor pair validation; owner_id=auth.uid(); excludes read notices older than 24 hours; returns up to 31 entries and unread count; joins Explore/Girls/Community details to resolve navigation.
- `herday_read_notification_v1(p_id uuid) RETURNS void`: authenticated active user only; marks only own row read, retaining first read time.
- `herday_cleanup_read_notifications_v2`: referenced by deployed matching Worker for scheduled expiry cleanup. Its exact production body was NOT supplied in this notification export; do not invent it or assume cleanup execution was live-tested.

User-approved notification audience: likes/comments on own posts and replies to own comments. **No broadcast of every Admin/user published post to all users.** Existing review notices were left intact. No notification SQL change was needed for the prior text-wrapping release. Do not add a broadcast migration.

## 2. Known available schema — relevant inventory

### Present in supplied live inventory before marketplace/messages

All of these were shown RLS enabled:

`profiles`, `content_submissions`, `poetry_categories`, `poetry_submission_details`, `explore_submission_details`, `girls_space_submission_details`, `herday_explore_categories`, `moderator_section_permissions`, `herday_poetry_comments`, `herday_comment_likes`, `herday_poetry_likes`, `herday_poetry_saves`, `herday_media_uploads`, `herday_media_edit_cleanup`, `herday_media_publication_operations`, `herday_content_deletions`, `herday_content_reports`, `herday_content_translations`, `herday_content_language_requests`, `herday_notifications_v1`, `herday_user_admin_audit_v1`, `herday_user_restrictions_v1`, and the five Community tables above.

The inventory also already included Beauty profiles/reviews, reports/moderation/history, Diary media/security/storage/receipts, cycle/period/pregnancy/symptom/mood/water/breast tracking and Horoscope editions/records/audit tables. They are existing features, not missing dependencies for rebuilding this app. This is a scoped handoff, not a claim to be a fresh complete catalog dump.

### Created by the applied marketplace/messages migration

| Table | Purpose | Authorization |
|---|---|---|
| herday_product_details_v1 | Product fields attached to content_submissions via submission_id | RLS; direct PUBLIC/anon/authenticated access revoked; scoped RPCs |
| herday_conversations_v1 | Unique normalized pair of participants | RLS; participant RPCs |
| herday_messages_v1 | Message history, idempotent sender/request, sequence | RLS; participant RPCs |
| herday_message_media_v1 | Registered private attachments linked to conversation/message | RLS; authorized registration/read |
| herday_message_presence_v1 | Expiring per-user/per-session presence | RLS; live presence only |

`herday_message_presence_v1` is BOTH a table name and an RPC name; this is intentional, not a duplicate.

Before this migration the supplied inventory had no marketplace/private messaging system. **That absence is historical: they are now created.** No relevant table is currently confirmed absent. Do not interpret an omitted unrelated name as proof of absence. If a genuinely new operation is needed, inspect only its specific dependency, not the full schema again.

### Profiles/media changes already applied

- `profiles.public_about`, `profiles.public_country`, `profiles.public_city`; maximum lengths 2000/100/120; existing Edit Profile integration.
- `content_submissions.section_key` supports `buy_sell`; at most four product photos.
- Existing `herday_media_uploads` supports `buy_sell` and `pending/buy_sell/<owner>/<uuid>.(jpg|png|webp)` registration.
- Products reuse `content_submissions` and existing shared public comments, likes and saves.
- Dedicated product lifecycle trigger requires pending creation and dedicated Admin approval. Generic staff-own content editors must not bypass it.
- Existing author visibility extended for marketplace and chat identity; additive Storage policy `HerDay scoped current profile avatars v1` through `herday_can_read_profile_avatar_v1(text)`; old owner/Admin/Beauty/current-author policies preserved.

## 3. Installed RPCs and authorization contracts

Full exact CREATE statements/signatures/GRANTs are in the included migration; use those rather than inventing new versions.

### Products

- `herday_social_visible_v2(uuid)` — approved publicly visible content/product eligibility; active unsold product and unblocked seller.
- `herday_product_submit_v1(uuid,jsonb,jsonb)` — idempotent request ID; input/media validation; pending submission.
- `herday_product_feed_v1(text,text,text,uuid,integer,text,uuid)` — category/country/search/owner/public/mine/queue; seeded fair public ordering; Admin-only queue.
- `herday_product_v1(uuid)` — public product or authorized seller/Admin private view.
- `herday_product_status_v1(uuid,text)` — owner Sold; Admin Approve/Reject pending.
- `herday_product_lifecycle_guard_v1()` — trigger enforcement.
- `herday_product_image_v1(text,boolean)` — exact registered image metadata, public visibility or active seller/Admin private authorization. Granted service_role as well as allowed browser roles per migration.
- `herday_product_upload_lookup_v1(text)` — own unattached product upload.
- `herday_market_identities_v1(uuid[])` — scoped seller/comment identity.

### Shared private messaging

- `herday_conversation_allowed_v1(uuid)` — active authorized participant.
- `herday_conversation_open_v1(uuid,uuid DEFAULT NULL)` — peer and optional product, shared participant-pair conversation.
- `herday_messages_inbox_v1(timestamptz DEFAULT NULL,uuid DEFAULT NULL)`.
- `herday_messages_read_v1(uuid,bigint DEFAULT NULL)`.
- `herday_messages_ack_v1(uuid,bigint)`.
- `herday_message_send_v1(uuid,uuid,text,jsonb DEFAULT '[]')` — sender/request idempotency.
- `herday_message_presence_v1(boolean)` — genuine live presence.
- `herday_message_identity_v1(uuid)` — internal scoped identity helper.
- `herday_message_media_register_v1(uuid,uuid,text,text,bigint,text)` — service-only registered attachment metadata.
- `herday_message_media_read_v1(text)` — registered media + authorized conversation; attached image or own unattached upload.

**An Admin must still be a participant in a private conversation. No Admin bypass to inspect other users' private messages is approved.** Do not “fix Admin photos” with unrestricted private bucket/table access.

### Existing social/profile APIs reused or extended

`herday_add_social_comment(uuid,text,uuid,uuid)`, `herday_delete_social_comment(uuid)`, `herday_edit_comment_v1(uuid,text,text)`, `herday_get_social_actions(uuid[])`, `herday_get_social_comments(uuid,timestamptz,uuid)`, `herday_like_social_comment(uuid,boolean)`, `herday_set_social_action(uuid,text,boolean)`, `herday_public_user_v1(uuid,timestamptz,uuid)`, `herday_get_content(text,text,integer)`, `herday_get_content_v2(text,text,integer,timestamptz,uuid,uuid,text,uuid)`, `herday_can_read_author(uuid)`, `herday_can_read_profile_avatar_v1(text)`.

Existing poetry/comment v2 endpoints, `herday_get_author_identities`, Admin account state/restrictions, public profile and reports functions were also already present in the supplied source/catalog. Do not duplicate them.

### Community matching APIs referenced by deployed code

`herday_community_feed_v1`, `herday_community_question_v1`, `herday_community_claim_job_v1`, `herday_community_finish_job_v1`, `herday_community_fail_job_v1`; underlying enqueue/source-changed helpers already installed. Claim/finish/fail are worker service-role operations, not browser inference endpoints.

## 4. Workers already created/deployed

### herday-community-matching

- User created the Worker, added Workers AI binding named `AI`, `SUPABASE_URL`, service-role secret, and `MATCHING_ENABLED` (initial false, subsequently true).
- Cron `* * * * *` every minute was configured and explicitly approved. Keep it unless asked.
- Initial failure: Cloudflare rejects fetch redirect:error. Fixed to redirect:manual with explicit 3xx rejection. User later deployed the 79-line code and confirmed related article eventually appeared.
- Current saved code: `backend-reference/HerDay-Community-Matching.txt` (79 lines); Library `libfile_35347189abd88191a83dbe4bb62bc3fc`.
- Embeddings `@cf/baai/bge-m3`; translation `@cf/zai-org/glm-4.7-flash`; do not substitute models under a media correction.
- drain() calls `herday_cleanup_read_notifications_v2`, then processes matching only when MATCHING_ENABLED==='true'. Two jobs per bounded invocation, durable Postgres retries.
- /health reports configured/enabled/scheduled_only/notification_cleanup/release. No public inference endpoint.
- Historic queued_jobs=61/indexed_articles=0 and zero question attempts preceded processing success. Not the current queue count; do not treat that snapshot as proof worker is still broken.

### herday-media-api

- User reported deploying the approximately 1629-line code after marketplace SQL. Public base used in app: `https://herday-media-api.urduwaveblog.workers.dev`.
- Current saved reference: `backend-reference/HerDay-Media-Worker.txt`; original Library `libfile_5fa1055af7708191a55367b9888c714d`.
- Variables in saved Worker header: SUPABASE_URL, PUBLIC_MEDIA_BASE_URL, ALLOWED_ORIGINS. Secrets: SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY. Reuses MEDIA_BUCKET/PRIVATE_BUCKET and existing diary/report functionality. No actual secret value is included in this packet.
- Browser uses publishable key; server service-role secret remains server-side. Do not paste secret key into web source.
- `/v1/market/location`: country from req.cf.country, before JWT validation but after config/origin gates.
- `/v1/market/image?key=...`: public approved product image; exact registry/visibility RPC; reads registered object from PRIVATE_BUCKET. Public visibility is achieved by guarded streaming, not necessarily copying to public R2.
- `/v1/market/preview?key=...`: authenticated seller/Admin private product preview.
- `/v1/messages/image?key=...`: authenticated conversation-authorized attachment.
- `sharedScopedImage()` validates returned key/owner/mime/size/section, key pattern, PRIVATE_BUCKET object metadata and bytes. Failure returns Image unavailable. Trace which exact check fails; do not remove checks wholesale.
- Existing uploads/register/publish/delete, diary and report endpoints are part of same Worker; preserve them.
- Earlier assistant-side location HTTP request returned 200 with country US (execution environment) and Access-Control-Allow-Origin for https://web.appherday.com. This was not the user's Pakistani device and does not verify intermittent live reliability.

### Other existing HerDay Workers

User screenshots showed herday-horoscope-api, herday-translation-api, herday-verification-api and divine-star-f7e9, plus herday-web-testing Pages. Their latest deployed code is not included/recovered here. Do not delete any or infer that random naming means unused. Horoscope has an established schedule/Workers AI translation setup; unrelated to these marketplace media corrections.

## 5. Historical tests and remaining verification

Previously reported isolated PostgreSQL/PGlite checks: 32 passed, covering migration behavior, products/comments/media, idempotency, participant restrictions, role boundaries and scoped avatar authorization. Historical mocked browser checks passed as documented in the included previous report. They do NOT prove production image delivery or country reliability; later user live failures remain authoritative.

No new SQL or Worker change was made by the October 20 combined correction source release or this handoff. Do not rerun the applied SQL or redeploy unchanged Worker as a substitute for diagnosis.
