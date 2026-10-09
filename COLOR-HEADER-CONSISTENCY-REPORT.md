# HerDay limited consistency correction

## Exact changed files
- `index.html`: load `internal-consistency.css` after existing styles; refresh cache query strings for changed CSS/JS.
- `beauty.css`: Horoscope body canvas uses existing `--cream` (#FFF8FA).
- `poetry.css`: Poetry html/body canvas uses `--cream`; category-feed `--poetry-surface` normalized to #FDF8FC.
- `beauty.js`: only `head()` and `horoscopeHeader()` back-button presentation changed. Existing onclick routes retained. Beauty Back gets an accessible label.
- `internal-consistency.css` (new): narrowly scoped internal header, back-button and normal Horoscope surface rules.
- This report (new).

## Exact selectors / tokens
Existing changes: `html:has(>body.poetry-mode)`, `body.poetry-mode`, `body.beauty-mode:has(.horoscope-page)`, `.poetry-category-feed` / `--poetry-surface`.

New geometry tokens: `--internal-top:12px`, `--internal-nav-height:44px`, `--internal-title-gap:6px`, `--internal-content-gap:12px`, `--internal-back-color:#4D3042`.
Existing `--cream:#FFF8FA` and `--card:#FFFDFD` reused unchanged.

New scoped selectors:
- `html:has(>body.beauty-mode):not(:has(>body.auth-mode))`, `body.beauty-mode:not(.auth-mode)`.
- `body.beauty-mode .beauty-shell .beauty-head`, `.beauty-head>.back`, `.beauty-head>div` (with body scope).
- `body.beauty-mode .poetry-page`, `body.beauty-mode .horoscope-page`.
- `body.beauty-mode .poetry-page .poetry-header`, `body.beauty-mode .horoscope-page .horo-head`, `body.beauty-mode .account-header`.
- `body.beauty-mode .poetry-page .poetry-intro`, `body.beauty-mode .horoscope-page .horo-title-block`, `body.beauty-mode .account-page-title`.
- `body.beauty-mode .beauty-head>.back`, `body.beauty-mode .poetry-header>.poetry-back`, `body.beauty-mode .horo-head>.horo-back`.
- `body.beauty-mode .beauty-head .internal-back-icon`, `body.beauty-mode .horo-head .internal-back-icon`, `body.beauty-mode .poetry-back .poetry-icon`.
- `.horoscope-page .language-tabs`, `.horoscope-page .zodiac-card:not(.selected)`, `.horoscope-page .selected-zodiac-summary`, `.horoscope-page .sign-identity`, `.horoscope-page .reading-card`, `.horoscope-page .insight-card`, `.horoscope-page .lucky-card`.

## Page and card colors
Poetry and Horoscope canvas changed from #FCE8EF / #FDEAEC to #FFF8FA. Other existing Beauty/account internal body canvases already use #FFF8FA; html canvas now also matches, preventing a different underlying page color. Home and authentication styles are excluded from new canvas rules.

Beauty normal cards remain #FFFDFD. Normal Poetry posts remain #FDF8FC. Category-feed surface changes from #FCF6FA to #FDF8FC. Normal Horoscope language container, unselected zodiac cards, summary, sign identity, reading, insight and lucky cards change from #FDF3F2 to #FFFDFD. Existing borders and shadows preserve the subtle distinction from the canvas.

Selected Zodiac #FCEBF1 and its #D8477A border remain intact. Language active / Horoscope CTA #D8477A, Poetry active #DF247B, category accents, zodiac medallions, insight icon semantic colors, badges and status colors remain unchanged. Horoscope artwork container background remains #FDF3F2; no image compensation applied.

## Header geometry
A common 12px top inset, 44px navigation row, 6px title gap and 12px title-to-content margin replace independent arbitrary header offsets. Beauty uses its existing two children in a CSS grid: back in navigation row, title/subtitle in the next row. Poetry and Horoscope retain separate existing header/title nodes. Profile retains its existing notification row and no back button is added. Existing typefaces, font sizes, subtitle spacing and RTL direction rules are retained. Home, auth and camera headers are excluded.

## Back buttons
Existing Poetry arrow path reused for Beauty and Horoscope as inline UI SVG markup; no asset file edited. All three have transparent 44x44 hit areas, 24x24 arrow icons, 1.8 stroke and #4D3042 color. No decorative panel or library. All original route handlers and Poetry delegated navigation remain unchanged.

## Validation and limits
- Beauty and Poetry JavaScript syntax checks passed.
- Byte comparisons confirm all 57 PNG/JPG/JPEG/WebP/SVG image assets are identical to supplied ZIP.
- `assets/horoscope-page1-artwork-web.webp` unchanged; SHA-256: `0110f616164769223e0b7db2882610c0f3825802de28232df3e1939307f65e7a`.
- `responsive.css`, `styles.css`, `home-fragment.html`, Home HTML content, Poetry JS/data and all backend-related code remain unchanged.
- No image editing, generation, replacement, filters, overlays, opacity or sizing changes.
- Runtime screenshots and functional browser regression could NOT be completed: no browser installed; browser download returned a truncated/non-ZIP response. This delivery is source-checked and requires runtime validation before visual approval. No runtime-pass claim is made.
- The Page 1 Horoscope artwork remains a possible baked-in peach/pink mismatch. A remaining visible mismatch cannot be confirmed without runtime screenshots; no other image identified for editing.
