Research-based PRE-882 Hero correction.

Verified directly from PRE-882 source:
text master width 972
Hero visible aspect 882x512 => master SVG height 564.244898
Kalam ascent 1063/1000
Greeting x58 ascender-top110 size41 => baseline 153.583000
Name x58 ascender-top160 size58 => baseline 221.654000
Subtitle x60 ascender-top236 size25 => baseline 262.575000

Why previous pass broke:
CSS calc(var(--cw) * 41 / 972) depended on CSS multiplication/division support.
On the phone those font-size declarations were invalid, so all three lines inherited normal text size and overlapped.

This pass uses SVG's native coordinate system and explicit font-size values in the verified master space.
No canvas. No JS. No CSS arithmetic for Hero typography.
The SVG scales as one unit with the Hero.

Replace index.html and responsive.css only.
