# HerDay correction delivery — 20 October 2026, R2

Status: code prepared and locally checked. NOT deployed. Live resolution UNVERIFIED.

## Changes in this pass
- Country: race same-site Cloudflare trace and Worker country endpoint; bounded retry; 5 minute session cache of network detection. Late results cannot overwrite a current manual country selection. Country is approximate IP location; VPN/network failures can still require manual selection. City remains manual.
- Currency: country tender currency defaults from Unicode CLDR snapshot; manual choice stays intact. No exchange-rate conversion. License and notice included.
- Product uploads: large/dimension-heavy photos prepared up to 2048 pixels; smaller valid photos retained. Stable prepared bytes and UUID reused after unknown upload outcomes. Photo progress, 45 second per-attempt upload limit, one retry, 30 second product confirmation deadline; same product request ID retained on unknown failure. This bounds individual requests, not the whole multi-photo submission.
- Product images: public approved-image endpoint now goes through bounded blob loading/retry. No public bucket copy is required by the existing authorized streaming design. Failed product images can be clicked/keyboard-retried.
- Chat images: transient request/body failures retry; 401 refreshes session; in-session blobs reused. Existing participant authorization and account-change fencing retained. Admin has no special access to other conversations.
- Worker: modern sb_secret keys sent in apikey without pretending they are JWTs; legacy service_role JWT remains supported. Supabase/JWKS network deadlines added. Default origins include web.appherday.com; an explicitly configured ALLOWED_ORIGINS still takes precedence.
- WhatsApp CTA already existed for an approved unsold listing with a saved number; preserved. Seller chat targeting was user-confirmed working and preserved.

## Validation actually performed
14 local checks passed. Includes Worker helper execution with mocked RPC/R2 responses, key header compatibility, metadata/ownership denial, public product stream, participant authorization, actual browser helper VM network retry/cache, upload JWT refresh with same FormData, and mocked canvas optimization reused after unknown upload outcome. Currency samples verified. Country/manual guard and WhatsApp/seller-target checks are source checks, not browser interaction tests.
Syntax checks passed for all five changed scripts and Worker module. Runtime source ZIP CRC checked. Original assets preserved byte for byte.

## UNVERIFIED / PENDING
No full browser visual test, real device image decoding/quality test, live Supabase/R2 test, deployed Worker hash comparison, real slow-network upload test, or cross-account production test was performed. Mock tests do not establish current live grants, data, configuration, or the original failure's sole cause. Secret-key compatibility is a concrete code correction, not a confirmed diagnosis of every image failure.

After deployment test: (1) repeated country entry and manual override; (2) currency default plus manual retention; (3) four large photos on slow connection and a retry without duplicate listing; (4) approved photos as seller, other signed-in buyer and signed-out buyer; (5) chat view/download/reopen in both participant accounts and denial for unrelated account; (6) enabled WhatsApp number on an approved listing. If public image still fails, inspect the exact scoped request status and its existing registry association, without rerunning migrations.

## Deployment order
1. Back up current Worker, replace herday-media-api with supplied complete HerDay-Media-Worker.txt. Preserve all bindings/secrets/Diary/report flags/schedules. Ensure ALLOWED_ORIGINS includes https://web.appherday.com if explicitly set. No secrets are included in this delivery.
2. Deploy contents of HerDay-Web-Corrections-20261020-R2.zip with index.html at root. Script content hashes refreshed.
3. Perform pending production checks above. Do not mark live complete until observed.

## SQL / other Worker
No new SQL required by these prepared changes. No SQL executed. Do not rerun historical Marketplace/Messages migration. Historical SQL and backend state are references only. Community Matching Worker unchanged and not deployed in this pass. Diary/report logic retained in the media Worker; no new permissions, expiry rules or scheduled jobs introduced.

References: https://supabase.com/docs/guides/getting-started/migrating-to-new-api-keys ; https://github.com/unicode-org/cldr-json/blob/main/cldr-json/cldr-core/supplemental/currencyData.json
