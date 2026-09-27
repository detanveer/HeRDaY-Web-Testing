HERDAY 92% — EXACT PRE-882 HERO REGISTRATION PASS

This corrects the previous wrong CSS percentage-font conversion.

Verified PRE-882 Android source:
- Hero master coordinate space: 972x500
- Runtime master scale: rendered Hero width / 972
- Good morning, = Kalam Regular 41, ascender anchor (58,110)
- Tanveer = Kalam Bold 58, ascender anchor (58,160)
- A little space, just for you = Kalam Regular 25, ascender anchor (60,236)
- Kalam ascent = 1063/1000 of font size
- Mask = left 29, top 91, base right 369, base height 208, feather 24, radius 24

Web implementation now uses a canvas overlay with alphabetic baselines and the same master-width scale.
It also corrects mask vertical scaling to the Android width-derived master scale.

Unchanged:
92% foreground width; Hero artwork; header; cards; card icons; nav icons; fixed nav.

Upload/replace BOTH index.html and responsive.css.
