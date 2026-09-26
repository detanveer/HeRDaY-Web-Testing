HERDAY WEB — ACTUAL RESPONSIVE CONTENT-WIDTH CALIBRATION

This replaces the previous transform/scale test.

LOCKED:
- Phone viewport/background remains fixed at 100%.
- No CSS transform scale is used for Home calibration.
- No artwork/copy/icon redesign.
- No Android source changes.

ADJUSTABLE:
- Only the actual foreground content-frame width as a percentage of viewport.
- Slider range: 78% to 98%.
- Live output: viewport px, content px, side gutter px.

Foreground scope:
Logo, bell, Hero, cards and Bottom Navigation.

Replace these repo-root files:
index.html
calibration.html
home-fragment.html
styles.css

Then let GitHub Pages redeploy and open calibration.html.
