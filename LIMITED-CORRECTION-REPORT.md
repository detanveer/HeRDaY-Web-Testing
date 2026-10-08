# HerDay Web — Four Limited Corrections

## Baseline and changed files

Only the supplied `HerDay-Web-Testing-Poetry-6-Pages-Shared-Home-Logo.zip` was extracted and edited. Poetry was not rebuilt or retrieved again from the Library. Changes are confined to the four authorized corrections.

Source/metadata files changed: `responsive.css`, `poetry-reference-data.js`, `beauty.js`, `poetry.css`, `poetry.js`, `index.html`, `beauty.css`, `assets/poetry/reference-content-provenance.json`. Thirty-one referenced PNG images were replaced by lossless WebP runtime versions. This report is the sole new document. Existing historical implementation reports remain unchanged; this report supersedes their original PNG runtime-path/branding statements.

## 1. Home-only logo

Removed logo rendering from Login (`login`), Signup (`signup`), user Profile (`user-profile`), Admin Profile (`admin-profile`), Account Settings (`account-settings`), Change Password (`change-password`), Horoscope selection/detail (`horoscope`, `horoscope-detail`), and all Poetry states (`poetry`, `poetry-post` text/image variants, `poetry-submit`, `poetry-categories`, `poetry-category`).

`profileHeader()` and `horoscopeHeader()` retain their controls, titles and surrounding logic; only logo markup was removed. The remaining account-header notification bell stays right aligned. Auth's logo-only helper/invocations were removed. Poetry back-header geometry remains intact; no fake logo placeholder was added. Existing Beauty pages already had no logo.

Home is the only rendered app route carrying the logo. Its original shared renderer, asset bytes, position and size are unchanged. The calibration/Home-fragment files represent Home-only development references and remain unchanged. Hidden Home DOM is retained by the existing router; it is not visible on internal routes.

Runtime checked all 23 current non-Poetry/Home routes: `home`, `horoscope`, `horoscope-detail`, `login`, `signup`, `user-profile`, `admin-profile`, `account-settings`, `change-password`, `my-beauty`, `beauty-main`, `categories`, `results`, `profile`, `create`, `verify-info`, `pending`, `contacts`, `confirm`, `rate`, `beauty-verifications`, `beauty-approved-providers`, `beauty-verification-review`. Home has one visible logo, every internal route zero. No new routes/screens were added for currently unimplemented placeholder destinations such as standalone Notifications, Explore or Shop.

## 2. Continuous Poetry background

Exact cause: `responsive.css` supplies `html,body` with Home root background `#FFF8FA`; Poetry overrides only `body` to `#FCE8EF`. On a short feed the body does not fill the viewport, exposing the differently colored root beneath it. Before correction, Friendship Page 6 body height was 481.69px inside an 867px viewport at width 390px.

Correction: one route-scoped rule, `html:has(>body.poetry-mode){background:#fce8ef}`, matches the existing Poetry body color. No content sizes, layout, card surfaces, typography or nav rules were changed. No new shade or artificial content spacer was added.

Pages 1–5 shared the same root mismatch. Page 5 also exposed it at 390×867 (body 816.33px); Pages 1–4 filled that viewport with their current content, so the root mismatch was not visibly exposed there. The common rule handles all six when content/viewport makes root space visible. Dense Love feed and short Friendship feed were both tested.

## 3. Safe image optimization

Every converted image retains original dimensions, aspect ratio, transparency and **byte-identical decoded RGBA pixels**. Lossless WebP avoids visible degradation or resampling entirely. Runtime fitting/cropping/clipping remains unchanged. Home logo, icons, Home artwork, navigation images and existing small WebP files are untouched.

References in `beauty.js`, `poetry.js` and the `photo()` helper in `poetry-reference-data.js` were updated. Provenance now records new runtime paths alongside original crop filenames. Old converted PNG copies are not shipped/loaded too. Script/style version query strings were bumped to invalidate stale references. No service worker/preload manifest is present in the baseline to update; caching architecture was not redesigned.

No large full-page reference/development screenshot was present in the supplied source; no filename-based unused-image deletion was made. All converted images were traced to direct source references or the runtime `photo(name)` helper.

| Original filename | Format | Dimensions | Original bytes | Optimized filename | Format | Dimensions | Optimized bytes | Reduction |
|---|---|---|---:|---|---|---|---:|---:|
| `assets/beauty-categories/01_makeup.png` | PNG | 256×256 | 53,920 | `assets/beauty-categories/01_makeup.webp` | Lossless WebP | 256×256 | 41,168 | 23.65% |
| `assets/beauty-categories/02_bridal_services.png` | PNG | 256×256 | 70,928 | `assets/beauty-categories/02_bridal_services.webp` | Lossless WebP | 256×256 | 51,538 | 27.34% |
| `assets/beauty-categories/03_hair.png` | PNG | 256×256 | 77,814 | `assets/beauty-categories/03_hair.webp` | Lossless WebP | 256×256 | 55,202 | 29.06% |
| `assets/beauty-categories/04_mehndi.png` | PNG | 256×256 | 68,137 | `assets/beauty-categories/04_mehndi.webp` | Lossless WebP | 256×256 | 57,692 | 15.33% |
| `assets/beauty-categories/05_skin_facial.png` | PNG | 256×256 | 66,262 | `assets/beauty-categories/05_skin_facial.webp` | Lossless WebP | 256×256 | 48,096 | 27.42% |
| `assets/beauty-categories/06_waxing.png` | PNG | 256×256 | 52,927 | `assets/beauty-categories/06_waxing.webp` | Lossless WebP | 256×256 | 40,632 | 23.23% |
| `assets/beauty-categories/07_threading_brows.png` | PNG | 256×256 | 63,644 | `assets/beauty-categories/07_threading_brows.webp` | Lossless WebP | 256×256 | 51,776 | 18.65% |
| `assets/beauty-categories/08_nails.png` | PNG | 256×256 | 53,056 | `assets/beauty-categories/08_nails.webp` | Lossless WebP | 256×256 | 38,892 | 26.70% |
| `assets/beauty-categories/09_manicure_pedicure.png` | PNG | 256×256 | 68,556 | `assets/beauty-categories/09_manicure_pedicure.webp` | Lossless WebP | 256×256 | 51,642 | 24.67% |
| `assets/beauty-categories/10_lashes.png` | PNG | 256×256 | 82,549 | `assets/beauty-categories/10_lashes.webp` | Lossless WebP | 256×256 | 63,628 | 22.92% |
| `assets/beauty-categories/11_massage_relaxation.png` | PNG | 256×256 | 77,108 | `assets/beauty-categories/11_massage_relaxation.webp` | Lossless WebP | 256×256 | 57,896 | 24.92% |
| `assets/beauty-categories/12_other_beauty_services.png` | PNG | 256×256 | 64,231 | `assets/beauty-categories/12_other_beauty_services.webp` | Lossless WebP | 256×256 | 48,934 | 23.82% |
| `assets/poetry/07-Production-Asset-Page1-Hero.png` | PNG | 2059×764 | 2,485,646 | `assets/poetry/07-Production-Asset-Page1-Hero.webp` | Lossless WebP | 2059×764 | 1,818,424 | 26.84% |
| `assets/poetry/08-Production-Asset-Page5-Hero.png` | PNG | 1678×937 | 2,789,631 | `assets/poetry/08-Production-Asset-Page5-Hero.webp` | Lossless WebP | 1678×937 | 1,875,100 | 32.78% |
| `assets/poetry/reference-content/category-ayesha.png` | PNG | 75×72 | 10,658 | `assets/poetry/reference-content/category-ayesha.webp` | Lossless WebP | 75×72 | 7,386 | 30.70% |
| `assets/poetry/reference-content/detail-ayesha.png` | PNG | 97×98 | 17,675 | `assets/poetry/reference-content/detail-ayesha.webp` | Lossless WebP | 97×98 | 12,716 | 28.06% |
| `assets/poetry/reference-content/detail-zara.png` | PNG | 93×92 | 16,034 | `assets/poetry/reference-content/detail-zara.webp` | Lossless WebP | 93×92 | 11,412 | 28.83% |
| `assets/poetry/reference-content/flower-post.png` | PNG | 560×515 | 363,807 | `assets/poetry/reference-content/flower-post.webp` | Lossless WebP | 560×515 | 268,932 | 26.08% |
| `assets/poetry/reference-content/hira-ali.png` | PNG | 94×96 | 15,960 | `assets/poetry/reference-content/hira-ali.webp` | Lossless WebP | 94×96 | 11,662 | 26.93% |
| `assets/poetry/reference-content/hira-khan.png` | PNG | 76×75 | 11,360 | `assets/poetry/reference-content/hira-khan.webp` | Lossless WebP | 76×75 | 8,018 | 29.42% |
| `assets/poetry/reference-content/maha.png` | PNG | 80×82 | 12,795 | `assets/poetry/reference-content/maha.webp` | Lossless WebP | 80×82 | 9,296 | 27.35% |
| `assets/poetry/reference-content/main-ayesha.png` | PNG | 93×93 | 16,501 | `assets/poetry/reference-content/main-ayesha.webp` | Lossless WebP | 93×93 | 11,312 | 31.45% |
| `assets/poetry/reference-content/main-flower-thumbnail.png` | PNG | 253×230 | 83,015 | `assets/poetry/reference-content/main-flower-thumbnail.webp` | Lossless WebP | 253×230 | 56,576 | 31.85% |
| `assets/poetry/reference-content/main-zara.png` | PNG | 93×94 | 16,454 | `assets/poetry/reference-content/main-zara.webp` | Lossless WebP | 93×94 | 10,964 | 33.37% |
| `assets/poetry/reference-content/maya.png` | PNG | 86×86 | 14,274 | `assets/poetry/reference-content/maya.webp` | Lossless WebP | 86×86 | 9,846 | 31.02% |
| `assets/poetry/reference-content/mehak.png` | PNG | 75×74 | 11,155 | `assets/poetry/reference-content/mehak.webp` | Lossless WebP | 75×74 | 7,668 | 31.26% |
| `assets/poetry/reference-content/noor.png` | PNG | 84×85 | 13,213 | `assets/poetry/reference-content/noor.webp` | Lossless WebP | 84×85 | 9,306 | 29.57% |
| `assets/poetry/reference-content/popular-flower.png` | PNG | 123×134 | 29,009 | `assets/poetry/reference-content/popular-flower.webp` | Lossless WebP | 123×134 | 20,086 | 30.76% |
| `assets/poetry/reference-content/rose-post.png` | PNG | 177×182 | 54,031 | `assets/poetry/reference-content/rose-post.webp` | Lossless WebP | 177×182 | 38,818 | 28.16% |
| `assets/poetry/reference-content/sana.png` | PNG | 80×82 | 11,983 | `assets/poetry/reference-content/sana.webp` | Lossless WebP | 80×82 | 8,764 | 26.86% |
| `assets/poetry/reference-content/sara.png` | PNG | 94×95 | 16,982 | `assets/poetry/reference-content/sara.webp` | Lossless WebP | 94×95 | 12,106 | 28.71% |

| Image size scope | Before bytes | After bytes | Saved bytes | Reduction |
|---|---:|---:|---:|---:|
| Optimized 31-image subset | 6,789,315 | 4,815,488 | 1,973,827 | 29.07% |
| All shipped local runtime image assets, including unchanged WebP/SVG | 7,187,391 | 5,213,564 | 1,973,827 | 27.46% |

Dynamic/post-content rendering remains data-driven. Square detail/thumbnail presentation is unchanged; no image column is reserved for text-only posts. Optimization affects only bundled reference image delivery, not upload/storage/backend processing.

## 4. Girls' Space subtitle only

Added `transform:translateY(3px)` solely to `.girls-space-card p`. This shifts the subtitle visually without modifying layout flow, title coordinates, text size, wrapping width, card size, icon, chevron or neighbouring Poetry card. Existing fonts/wording and natural wrapping remain unchanged. The transform avoids moving the vertically centered title when subtitle spacing is adjusted.

At 390px: title bottom remains Y=456.75; subtitle top moves from Y=457.75 to Y=460.75, creating a 4px title-to-subtitle gap. Subtitle remains within the card (bottom 480.75 vs card bottom 486.25). Card/title/icon/arrow, Home logo/bell/nav and adjacent Poetry-card rectangles matched baseline exactly at widths 320, 390, 430 and 768px. The Poetry Home card's markup is byte-identical.

## Runtime validation and regressions

- Rendered all currently implemented routes; every internal route has no visible logo, Home keeps its original logo. Existing Beauty/auth/profile/Horoscope output loaded without browser exceptions or broken images.
- Rendered all six Poetry states plus short Friendship feed at 320, 390 and 430px. Root/body both equal `rgb(252,232,239)`, with no horizontal overflow. Content/control/card/Hero/form/grid and nav rectangles match baseline.
- Poetry main → View All → Love feed → search Mehak → image detail still navigates. Hero and all optimized images load. Optional-image field remains optional.
- Square post-image geometry remains proportional. Text-only posts reserve no media. A long-text probe verified clearance beside the thumbnail and full-width continuation below it.
- Final content remains reachable above the unchanged fixed nav. Normal behind-nav scrolling is preserved. Nav HTML, icons and styling are unchanged.
- All 31 optimized images passed exact decoded RGBA equality and dimensions checks. Home logo bytes remain exact. JavaScript syntax checks pass; complete ZIP integrity was checked.

Runtime tests used isolated test authentication/data stubs and blocked live backend requests. These validate render/navigation regressions, not real sign-in or backend submissions. Backend/auth action functions were left unchanged; the only `beauty.js` differences are authorized logo removal and asset filenames.

## Freeze confirmation

No backend/schema/data/RLS/RPC/storage-policy/OAuth/domain/deep-link behavior was changed. No feature or route was added. Existing Poetry backend limitations remain as supplied. No Poetry reconstruction, unrelated cleanup or design change was made. Home remains frozen except the subtitle-only shift; Bottom Navigation remains unchanged. Approved Library reference material was not read again or modified.
