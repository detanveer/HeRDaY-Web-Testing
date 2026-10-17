# HerDay — Girls’ Space / Explore visual correction pass

Latest source: English-only horoscope build, with the requested compact category-title correction retained. Deploy this complete folder to the existing Web Testing app. CNAME remains web.appherday.com. No SQL, Worker, secret or binding update is required.

## What changed

- One compact top title next to Back; repeated category/feed title removed. Latest user instruction supersedes centered/duplicated headings in older PNGs.
- Consistent 20px top headings, smaller supporting copy, shared gutters, compact cards/forms and wrapping tabs.
- Explore: reference-style category grids, compact search previews, feed author/content hierarchy, status badges, submission cards and separate review overview/content/images/ownership/decision groups.
- Girls’ Space: all four social contexts, composer, photo preview grid and SVG Add icon; consistent landing/Tools typography; Diary/PIN/calendar/recovery/settings and tracker spacing.
- Bra tile now says Measurement Guide to match the approved functional source. The older numeric sizing mockup is not implemented or implied.
- Exact-byte cache versions updated for changed JavaScript/CSS.

## Verification and limits

- Compared the 11 current Explore PNGs, 24 approved Girls’ Space PNGs and the later Diary Settings V5 reference. Source originals were only read; no original was edited.
- Actual local browser rendering: 45 screen/state combinations at 320, 390 and 520 CSS pixels (135 captures). No JavaScript errors, undefined/NaN/invalid-date placeholders in the final fixtures.
- 32 route cases at each width (96 checks): no horizontal overflow, broken artwork, heading/field right-edge clipping or last control behind navigation after scrolling to the page end.
- Category navigation and Back tested. Two selected-photo previews tested locally. PIN/recovery, calendar and free/active/expired storage states exercised with isolated fixtures.
- Fixtures replace data services only inside the local harness; they are NOT in this package. No live private records, PINs, health data, posts, decisions, quotas, emails or media were read or changed for these tests.
- This is frontend visual/interaction verification, not live backend validation for private account operations. Final phone deployment review remains necessary.
- Real content length, empty states, missing optional media and actual counts necessarily differ from the illustrative PNG data. No sample posts, history, counts, measurements or dates were installed.
- Required functional fields, truthful unsupported rankings, privacy/consent controls, health information and later free-plus-paid storage rules remain. They are not removed to imitate an older static mockup.
- Existing private attachment viewing remains the secure user-triggered viewer. This pass does not add automatic private photo/video thumbnails or claim that attachment-rich Diary galleries have been verified against real media.
- Global canvas #FFF8FA, original artwork, 110 asset/font files, all existing files, real-data boundaries and the English horoscope implementation are preserved.

## Rendered screen/state inventory

| State | Browser render |
| --- | --- |
| gs-main | Inspected using isolated fixture |
| gs-tools | Inspected using isolated fixture |
| gs-feed-discussions | Inspected using isolated fixture |
| gs-feed-advice_support | Inspected using isolated fixture |
| gs-feed-personal_stories | Inspected using isolated fixture |
| gs-feed-celebrate_inspire | Inspected using isolated fixture |
| gs-create-discussions | Inspected using isolated fixture |
| gs-create-advice_support | Inspected using isolated fixture |
| gs-create-personal_stories | Inspected using isolated fixture |
| gs-create-celebrate_inspire | Inspected using isolated fixture |
| gs-post-discussions | Inspected using isolated fixture |
| gs-post-advice_support | Inspected using isolated fixture |
| explore | Inspected using isolated fixture |
| explore-categories | Inspected using isolated fixture |
| explore-feed | Inspected using isolated fixture |
| explore-search | Inspected using isolated fixture |
| explore-submit | Inspected using isolated fixture |
| explore-mine | Inspected using isolated fixture |
| explore-queue | Inspected using isolated fixture |
| explore-post | Inspected using isolated fixture |
| explore-edit | Inspected using isolated fixture |
| explore-review | Inspected using isolated fixture |
| report-review | Inspected using isolated fixture |
| gs-period | Inspected using isolated fixture |
| gs-ovulation | Inspected using isolated fixture |
| gs-pregnancy | Inspected using isolated fixture |
| gs-symptoms | Inspected using isolated fixture |
| gs-mood | Inspected using isolated fixture |
| gs-breast | Inspected using isolated fixture |
| gs-bra | Inspected using isolated fixture |
| gs-water | Inspected using isolated fixture |
| gs-diary | Inspected using isolated fixture |
| diary-forgot | Inspected using isolated fixture |
| diary-code | Inspected using isolated fixture |
| diary-reset | Inspected using isolated fixture |
| diary-main | Inspected using isolated fixture |
| diary-new | Inspected using isolated fixture |
| diary-detail | Inspected using isolated fixture |
| diary-calendar | Inspected using isolated fixture |
| diary-settings | Inspected using isolated fixture |
| diary-change | Inspected using isolated fixture |
| diary-settings-paid | Inspected using isolated fixture |
| diary-settings-expired | Inspected using isolated fixture |
| diary-setup | Inspected using isolated fixture |
| gs-create-photos | Inspected using isolated fixture |
