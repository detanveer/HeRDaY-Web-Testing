# HerDay Horoscope approved-reference geometry

Source canvases inspected from their actual binary format:

- Page 1: 681 × 1536 px (`302725.png`, binary JPEG)
- Page 2: 680 × 1536 px (`302741.png`, binary JPEG)

The implementation uses width-relative geometry so the reference proportions scale to mobile CSS pixels/dp without assuming one device pixel ratio.

## Shared geometry

| Element | Reference geometry | Normalized width ratio |
|---|---:|---:|
| Page side inset | 30 px | 4.41% |
| Usable content width | 620–621 px | 91.19% |
| Two-column gap | 15 px | 2.20% |
| Bottom navigation height | 87–102 px | 12.78–15.00% |

## Page 1

| Element | Reference bounds/size | CSS contract |
|---|---:|---:|
| Artwork card | x 30, y 302, w 621, h 219 px | 91.19vw content width, 32.2vw height |
| Language selector | x 30, y 536, w 621, h 76 px | 11.2vw height |
| Zodiac grid columns | 306 px + 15 px + 307 px | 2 equal columns, 2.2vw gap |
| Zodiac card | approximately 306 × 104 px | 15.3vw minimum height |
| Zodiac row gap | approximately 12–14 px | 2.1vw |
| Zodiac symbol | approximately 82 × 82 px | 11.8vw |

## Page 2

| Element | Reference bounds/size | CSS contract |
|---|---:|---:|
| Identity artwork card | x 30, y 252, w 620, h 282 px | 41.5vw height |
| Today’s Reading | x 30, y 549, w 620, h 190 px | content-driven; measured padding/type scale |
| Insight columns | approximately 304 px + 15 px + 302 px | 2 equal columns, 2.1vw gap |
| Insight card | approximately 304 × 184 px | variable height; row stretches to taller card |
| Lucky Details | x 30, y 1153, w 620, h 167 px | content-driven |
| Share action | x 30, y 1339, w 620, h 75 px | 11vw minimum height |

## Final production artwork

- Page 1 panoramic artwork: 2112 × 744 px (2.84:1), RGBA with real transparency.
- Page 2 right-weighted artwork: 1430 × 1100 px (1.30:1), RGBA with real transparency and clear left-side identity space.

The simplified approved pages intentionally omit separate page-level moon, star, sparkle and constellation decorations. Celestial details contained inside the Page 1 production illustration remain part of that single artwork asset.

## Artwork rule

Both supplied 1254 × 1254 RGBA production PNGs retain their original aspect ratio. They use `object-fit: contain`, centered positioning, and explicit maximum bounds. No screenshot extraction, destructive crop, width stretching, or baked-in dynamic text is used.
