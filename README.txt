HERDAY WEB HOME CALIBRATION

Source: verified PRE-882 Native Android source.
Purpose: visual screen-fit calibration only. No Android source was modified.

index.html       = clean Home view
calibration.html = same Home + Fit slider (0.900–1.180) and live content/gutter measurements

Baseline Fit 1.000 preserves the 1080 master mapping:
- Master width 1080
- Content/card frame 882
- Master side gutter 97
- Pair card 431 + 20 + 431
- Hero 882 x 512
- Wide cards 882 x 443
- Pair cards 431 x 443
- Bottom nav 930 x 110, viewport-fixed

The slider changes ONLY the global presentation scale for calibration. It does not change card/artwork internals.
Once a Fit value is visually approved on the target phone, use its measured ratio as evidence for the Native Android root-scale correction; do not copy CSS px directly to dp.
