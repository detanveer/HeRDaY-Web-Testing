# Typography scale, review spacing and missing back button

A. **Files modified:** `typography-consistency.css`, `beauty.js`, `index.html`. Added `verification-spacing.css` and this report. Existing other files byte-identical.

B. **Typography changes:** Existing shared `--type-section` and `--type-card` tokens changed from 20px to 18px. All current selectors already referencing those tokens now use 18px, including Admin `.admin-card-heading h2`, user/provider section headings, Horoscope section/sign headings, Poetry section/detail headings and account/card headings. No heading tags replaced. No Home selectors changed. New scoped wrapping rules: `#beautyApp .admin-voice-check>p`, `#beautyApp .admin-decision>p` cancel inherited `white-space:nowrap` and use `overflow-wrap:anywhere`, preserving helper font values and complete text.

C. **Final values:** Main internal title remains DMSerif/Georgia/serif, 24px, weight 400, line-height 1.2 = 28.8px. Section/card headings: same family, 18px, weight 400, line-height 1.2 = 21.6px. Body/supporting sizes unchanged: existing targeted 14px body, 13px supporting text, 12px labels, 11px metadata; 14px regular / 12px compact CTA labels. Previously intentional exceptions remain unchanged. All existing header-origin, margin/padding and Home alignment rules remain untouched except the explicit missing-back header restoration described below.

D. **Exact bottom-space root cause:** `responsive.css` gives body `padding-bottom:92px`. `beauty.css` gives `.beauty-shell.admin-review-screen` another `padding-bottom:calc(118px + env(safe-area-inset-bottom))`. These accumulate below the final Review Decision card: 210px plus safe area before existing card margin. The `.beauty-bottom-space` currently has height 0 and is not the cause. No review min-height or flex-growth cause found in the supplied source.

E. **Exact correction:** `body.beauty-mode:has(#beautyApp.admin-review-screen .admin-decision)` gets padding-bottom:0. `#beautyApp.admin-review-screen:has(.admin-decision)` gets one clearance: `calc(66px + max(8px, env(safe-area-inset-bottom)) + 12px)`. This derives from the unchanged fixed nav's 66px height and max(8px,safe-area) bottom inset plus a normal 12px content gap. Existing last-card margin remains. Only pending review with a decision card is affected; Approved Provider detail and other pages retain their existing padding. No negative margin, fixed page height, hidden overflow, spacer deletion, nav movement or device-specific offset.

**Missing Back Button:** `beautyVerifications()` replaces its independent `.admin-page-head` markup with existing `head('Beauty Verifications', 'Review pending Beauty Profile verifications.', 'admin-profile')`; adds only `beauty-verifications-head` for preserving the existing 7px subtitle gap. The shared header's 12px top + 44px navigation row + 6px title gap equals the prior Admin title's 62px top inset. Title text/size and final 12px content gap are retained. Back markup is the exact existing shared SVG, 44px hit area, 24px icon and dark-plum #4D3042 styling. Correct parent is Admin Profile, whose existing Beauty Services action opens Beauty Verifications. No new route or navigation architecture introduced. Existing back buttons unchanged.

F. **Preservation and validation:**
- Canvas #FFF8FA unchanged.
- Surfaces unchanged: Beauty/Admin #FFFDFD, Poetry #FDF8FC, normal Horoscope #FFFDFD, selected Zodiac #FCEBF1, Home #FFFFFF. Other existing semantic surfaces/borders unchanged.
- CTAs unchanged: primary gradient #E91E63→#EC1971, secondary #FFFFFF with #E8B9CC border/#C91656 text, green #08AA67, Horoscope #D8477A, existing Poetry CTA colors unchanged.
- All 57 images/artworks byte-identical. Home CSS and title-alignment script byte-identical.
- Pending review, check requirements, Approve/Needs Correction dialogs, approved access/rendering, navigation dispatcher, rendering dispatcher and backend functions unchanged. Only `beautyVerifications()` presentation gains the requested shared Back button.
- Fixed bottom navigation CSS/HTML/functionality unchanged.
- About wrapping stylesheet declarations unchanged.
- Source checks passed: JS syntax; shared Back markup comparison; correct Admin parent target; frozen function comparisons; two-token-only typography diff; asset and existing stylesheet byte comparisons.
- No unrelated changes. Index changes only refresh affected cache keys and load scoped spacing stylesheet.
- Browser screenshots, computed-style/scroll-end/RTL checks and live provider workflows could not be verified in this environment (browser executable unavailable). No runtime pass claimed. Test the supplied ZIP at runtime before final approval, especially final-card clearance on different safe-area devices and localized heading wrapping.
