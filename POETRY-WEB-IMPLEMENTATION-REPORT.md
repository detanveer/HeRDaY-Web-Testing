# HerDay Web — Poetry Implementation and Shared Home Logo

## Scope and source

The supplied latest Web ZIP was the sole baseline. All six engineering reports and all eight approved Poetry images were inspected. `/Poetry Section` and its original reports/images were read only; local reference SHA-256 checks remained unchanged. No artwork was regenerated.

The canonical PNG dimensions differ from the preview coordinate bases in some reports. Responsive relationships were followed rather than treating preview pixels as CSS pixels. Canonical page dimensions are: Pages 1/5 1080×2400; Pages 2/3/4 841×1870; Page 6 691×1536. Original report measurements and source files were not rewritten. Raster font families are not authoritative; the Web uses a Times-style serif hierarchy and responsive sizes, with a sans-serif category-feed body.

## Files changed

| File | Change |
|---|---|
| `index.html` | Home Poetry entry, shared logo mount and new Poetry script/style loading; existing nav markup preserved |
| `beauty.js` | Existing router recognizes Poetry routes; auth/profile/Horoscope logo portions use shared renderer |
| `calibration.html`, `home-fragment.html` | Existing logo rendering uses shared source; archived layout retained |
| `shared-brand.js` | One Home-derived logo renderer using unchanged `logo_herday.webp` |
| `poetry.js` | Six responsive screens and existing-router navigation |
| `poetry.css` | Scoped Poetry presentation and nav clearance |
| `poetry-reference-data.js` | Clearly marked approved reference content, independent of backend records |
| `assets/poetry/` | Exact production Heroes and reference sample content |
| `POETRY-WEB-IMPLEMENTATION-REPORT.md` | This report |

Original `responsive.css`, `beauty.css`, `styles.css`, Home artwork, logo, navigation icons and font binaries are unchanged. No original source file was removed.

## Screens and routing

| Page | Existing-router route | Result |
|---|---|---|
| 1 Main Feed | `poetry` | Exact standalone Hero, Submit CTA, For You/Love/Friendship/Hope/View All, search, latest and popular posts |
| 2 Text-only detail | `poetry-post` with a text-only record | Full-width poem, metadata/badge, actions, comments and composer; no media allocation |
| 3 Image detail | `poetry-post` with an image record | Dynamic square post image, full-width poem below, actions/comments/composer |
| 4 Submit | `poetry-submit` | Title, Category, multiline poem, optional image, approved guidance and CTA; no identity field |
| 5 Categories | `poetry-categories` | Exact standalone Hero, icon-less two-column grid, trailing chevrons and adaptive rows |
| 6 Category feed | `poetry-category` | Reusable category identity, Search Poetry, Latest, mixed cards; no redundant heading chip |

Home Poetry → Main → View All → Categories → selected category → Category Feed. Post taps use the same detail route with text-only/image states. Submit uses the existing router. No separate routing framework was added. For You is a feed control; View All is navigation, neither is a category.

## Artwork and content

Both standalone files were copied byte for byte: `07-Production-Asset-Page1-Hero.png` (2059×764) and `08-Production-Asset-Page5-Hero.png` (1678×937). They were not extracted from screenshots, resized on disk or recompressed. Rounded clipping is CSS; rendering is proportional.

Seventeen mechanical photo/avatar crops from approved screenshots supply the reference/demo post content. `reference-content-provenance.json` records source filenames, decoded sizes and crop bounds. These are demo content, not fixed production imagery or authenticated identities. Post images are record-driven; future real data can supply different images. Feed/detail image targets are 1:1 with proportional rendering.

Text-only cards have no media placeholder or reserved column. Feed thumbnails float only beside overlapping text; continuation below reclaims full width. Cards are content-driven. At the 390px reference viewport, Life & Emotions remains one line and Dreams & Cherished Memories wraps to two; both cards in that row share height, then Family/Motivation return to compact height.

## Shared logo and navigation

`HerDayLogo.html()` and `HerDayLogo.mount()` resolve to the original Home asset. Existing `authLogo()`, `profileHeader()` and `horoscopeHeader()` retain their surrounding logic and allocated header geometry while delegating logo rendering. Home, auth, user/admin profile, settings and Horoscope no longer independently specify the asset. Poetry uses the same renderer. No raster screenshot wordmark, alternate asset or base64 logo was added; previously logo-less existing screens remain logo-less.

The existing single global five-item Home navigation is reused. Its markup, icons and original styles are unchanged. Home remains active in Poetry. Poetry reserves the measured fixed-nav/system space and remains scrollable, without a second navigation component.

## Backend boundary — genuine limitation

The baseline does not establish Poetry read/write contracts, tables, image storage, category IDs, search APIs, persistent Like/Save/comments or publishing. None were fabricated. The approved cards/categories are explicitly reference data, not permanent accounts, production records or taxonomy.

Reference search works locally and Latest is the only approved visible sort value. Web Share/clipboard is functional. Like/Save, comment submission and publishing report that the backend is not connected; they do not pretend to persist or publish. The form accepts a text-only submission and optional image selection, but does not upload it. Authenticated identity uses existing account data where available; the form adds no identity fields.

Production integration needs the actual Poetry read/category/post contracts plus authorized action/submission/image-storage contracts. This deliverable completes the visual/navigation layer, not unsupported backend functionality.

## Validation

All six pages were rendered and checked at widths 320, 360, 390, 430 and 768px: no horizontal overflow, one shared navigation, correct shared logo, proportional square post media and zero media allocation in text-only states. JavaScript syntax checks passed. Navigation, reference search, optional-image form validity and dynamic image-detail selection passed. A long-text DOM probe verified clearance beside the thumbnail and full-width continuation below it. Final content clears the fixed navigation.

Baseline screenshot comparisons at 390px were pixel-identical for Horoscope selection/detail, Login, Signup, user/admin profile and Account Settings. Home retained identical canvas/geometry and original CSS/assets; the screenshot comparison showed small photographic raster differences within two right-side artwork regions, so strict pixel identity is not claimed for Home. No Home design change was made; only its existing Poetry card gained navigation and its logo mount was centralized.

Tests used isolated authentication stubs and blocked live backend requests; they do not establish live authentication, publishing or persistence correctness. No test stub/dependency/browser is shipped in the app.

## Preservation confirmation

Library source material was not modified, moved, renamed or overwritten. Unrelated baseline files and features were preserved; Horoscope changed only its logo delegation. No schema, RLS, RPC, storage policy, deployment/domain configuration, unrelated refactor or new decorative artwork was introduced. The ZIP contains the complete updated project, not a patch.
