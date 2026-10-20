# Pending corrections — latest live evidence

These are the issues raised AFTER delivery of the included source. No new fixes for this list have been saved.

| ID | Correction | Latest evidence / acceptance |
|---|---|---|
| C1 | Country detection intermittent and slow | Sometimes selects Pakistan after a delay; sometimes Detecting your country… becomes Choose your country / Retry country detection. Not just a deterministic failure or only slow Internet. Must investigate actual request failures, not guess a country. Manual country search remains. |
| C2 | Currency follows detected country | User explicitly requested automatic currency selection corresponding to detected country. Preserve supported manual currency behavior. No currency conversion requirement was approved. |
| C3 | Product submission hangs/fails with larger images | Form stays Submitting… with disabled controls for 4–5 minutes, then Failed to fetch. Small-image test succeeded. Image size is user's plausible observation, not a confirmed cause. Submission might have committed before a lost response: retain request idempotency and do not create duplicate listings on retry. |
| C4 | Approved product photos unavailable to other viewers | Seller sees their images; after approval another user sees blank gallery/thumbnails. Product metadata and approved listing appear. Investigate scoped public product image path and registry/storage checks; do not assume publication copy or permissions cause without response evidence. |
| C5 | Chat photo view/download intermittent | Initially described as Admin account failing while user worked. Later the SAME user account that successfully viewed/downloaded the image also failed. Thumbnail Loading photo / Photo unavailable; viewer Photo could not be loaded. Close and try again. Treat as intermittent across participant accounts, not an Admin permission request. |
| C6 | WhatsApp contact visibility | User requested WhatsApp button when seller provides number. Earlier screenshot was pending product, with no chat CTA; later approved screenshot has HerDay Chat. Check approved listing with WhatsApp enabled and valid number. Preserve approved visibility rules; do not expose private/pending product contact data publicly. |

## Confirmed working — not outstanding corrections

- HerDay Chat opens the conversation with the correct product seller: explicitly confirmed by user. Do not duplicate or replace it.
- Country detection can work: intermittent failures remain, not total absence.
- A Buy & Sell submission succeeded with small images. This does not resolve larger-image failures.
- Marketplace Admin approval was performed by user. Pending approval and an in-progress Submitting… operation are different states.
- Community related Explore article appeared after queue delay; do not list it as still missing without new evidence.

## Live screenshot breadcrumbs

All descriptions below came from the user and visible conversation images; no fresh image analysis was performed for this handoff.

- Country: 310018.jpg `libfile_440333eb2b9881919f97b2dff9b2f990`; 310017.jpg `libfile_808389c118948191ac7e4274d980f9a5`.
- Product submitting/failure: 309991.jpg `libfile_e45149c3d13c8191af740344005941a5`; 309986.jpg `libfile_e0484758483c81919807c3bdd0b5783f`; 309987.jpg `libfile_f1f96ac51bb88191ac72d9bd393c08c4`.
- Approved gallery / working seller chat CTA: 310005.jpg `libfile_4f54fd156bc88191aaffeb0b8a753e45`.
- Contact Seller earlier pending screenshot: 309990.jpg `libfile_d319e71c86b48191aa6bcf0ac3b0701d`.
- Chat: 310002.jpg `libfile_6c013b8d23048191bcc5fb774cab7016`; 310009.jpg `libfile_64d1a634ed908191b8377e0d9ec71a05`; 310010.jpg `libfile_0e0ac7a7fa1481919d89d7d2a6a931e0`.
- Later Library breadcrumbs 310051/310052/310053 have no accompanying described correction in this visible conversation. Do not invent issues from their names.

## Earlier corrections already included in baseline

Notifications wrapping; Admin-only Buy & Sell Moderation entry moved from Main to Moderator Tools; Poetry Like/Comment labels; social row alignment; comment focus without current-detail reload; Community Save/Share and Saved Posts retrieval; latest three question cap; session-expiry retry handling. These were implemented and fixture-tested before release, not newly fixed during this handoff. Country/photo live failures show that earlier retry changes were insufficient.
