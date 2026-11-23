# Visual and audio direction

Style source for this Christmas advent game; `.agents/skills/web-game/SKILL.md` points here. The owner chose this direction after three mockup rounds, having rejected flat paper-cut vector art and every cartoon or childish style. A change to anything below needs owner approval.

Audience: Vietnamese adults who like history and logic puzzles.

## Style

A 19th-century hand-tinted steel-engraving book plate (Doré spirit). Reference and generator: `art/style/`. Outside `art/style/`, `art/kit` and `art/bg/*-minigame*` still hold the superseded paper-cut kit of the Phaser mini games: do not extend it or copy its look.

- Realistic adult depiction: natural proportions (Tèo is a slender young elf, head ≈ 1/7 of height, natural face, small pointed ears), natural-history precision for birds and objects. Cúc Cu is a cuckoo, Quạ Đồn is a crow, drawn as field-guide plates.
- Expressions come from eyes, eyebrows and mouth at adult subtlety; each of the 6–8 expressions reads through eyebrows and mouth alone.
- Light: the lanterns are the key light, plus hearth and window. One `tone(x, y)` function per scene (distance to the light sources, shaded by form) drives every hatch family, so density follows the light. Chiaroscuro is strong: lit areas are open paper, shadows are cross-hatched.
- Engraving: ink `#1b1712` lines as swelling polygons (`engrave()` in `art/style/lib.mjs`), width follows tone, pitch 1.5–3.4 px in the 390-px design, max width 2 px, parallel hatching in the lit half-tones and a second angle only in shadow. Contours 0.8–2 px.
- Tint: hand-tinting only. Transparent colour washes (`fill-opacity` 0.4–0.9, `mix-blend-mode: multiply`), offset ≈ (1.1, 0.8) px from the line work and ragged-edged (`feTurbulence` + `feDisplacementMap`). No opaque colour fills, no outline-plus-flat-fill.
- Page: ground `#ece2c8`, foxing vignette and paper grain (multiply, opacity 0.14).
- A chapter differs by setting, light and props only; line work, tint method and characters stay fixed.
- Motion: move baked layers with transforms, fades and lantern flicker. No squash and stretch, no bounce easing.

## Palette

Every colour belongs to one row; a new colour needs a row and a contrast check.

| Role | Hex |
|---|---|
| Ink (lines, text) | `#1b1712` |
| Page, card, label plate | `#ece2c8`, `#f5eed8`, `#f1e8cd`, recess `#e4d8b8` |
| Secondary text | `#3e362b`, `#4a4032` |
| Oxblood (primary button, speaker name) | `#661b16`, `#6b1c17`, text on it `#f6edd5` |
| Stamps | green `#2c5a38`, red `#8b2a22`, blue `#2d4666`; the legend stamp's flame uses the wash orange `#f08a2c` |
| Washes | brass `#e4b04a`, wood `#b9803f` `#a7692f`, coat green `#4f7a4b`, cap red `#b8362b`, skin `#e59a78`, night sky `#4f6f98`→`#9db6cf`, flame `#f08a2c`, lantern glow `#ffd25a` `#f4b447` |
| Plate-art tints (baked art only, never text; not yet owner-approved) | `#1e1b17` `#2a2620` `#3a352e` `#4d3a22` `#5b1a1a` `#6b3d1a` `#6c5a42` `#8a6a3c` `#a89878` `#c9cabf` `#cdbd8c` `#cfa24a` `#cfd0c4` `#cfd8dc` `#d8cfb4` `#dcdccf` `#e0d2ac` `#e4d6a6` `#e6c98c` `#e8d7a0` `#e9d9a4` `#e9e2cc` `#efe3c0` `#f0a53a` `#f1e19a` `#f1e6c6` `#f3ead0` `#f6ecc0` `#fbf4dc` `#fbfbf6` `#fff3b0` |

Contrast (WCAG, computed): ink/page 13.8, ink/card 15.4, secondary/page 9.2, oxblood/card 10.0, page-cream/oxblood 10.4, stamp green/card 6.9, stamp red/card 7.4, stamp blue/card 8.3. Text on a wash label plate stays ink (≥ 10).

## Typography and UI

- One font: EB Garamond (SIL OFL 1.1), self-hosted from `art/style/fonts/` (woff2, latin + vietnamese subsets, weights 400/500/600, italic 400/600; licence `OFL-EBGaramond.txt` ships with it). All fonts together ≤160 KB. CSS, canvas and SVG name nothing else except the generic `serif`.
- Spaced capitals: `text-transform: uppercase` + `letter-spacing` 0.13–0.2em for labels, buttons and stamps. Never `font-variant: small-caps` or synthesized small caps; they break Vietnamese diacritics.
- Vietnamese check, every text size and style used (uppercase labels and italic included): screenshot `Tiếng Việt có dấu` and the stacked marks `Ề Ặ Ỗ Ị Ử Ữ Ệ`; open it and confirm no mark is clipped or collides with the line above. Give uppercase labels a box ≥ 1.4× the font size tall.
- UI is an antique book page: square corners; thin double rule (outer 1.3–1.7 px, inner 0.5–0.7 px, inset 3.5 px); offset hatched shadow instead of a blur; diamond ornaments; the plate caption `Hình I. — …` in italic under every plate; verdicts as rotated (≈ −3.5°) inked stamps; dividers in double rule with a diamond.
- Interactive targets ≥44 px tall and wide (hard floor); labels are plain verbs.
- All text is DOM text in that font, never baked into the image (the numerals of the clock face are part of the drawing).

## Bake and budgets

1. Sources are the JS generators in `art/style/`. The scene SVG is an intermediate (the mockup plate is 1.8 MB, ~540 KB gzip) and never ships.
2. Bake each scene to WebP (`magick plate.png -quality N plate.webp`); a layer that moves (Tèo, clock, birds) is a separate alpha WebP shared across chapters.
3. Resolution and quality come from measurement: ship the smallest WebP whose hatching stays legible on a DPR 3 phone (see Self-check). Reference measurement for the 366×578 mockup plate: 1x 67–79 KB, 2x 240–290 KB at q70–80.
4. Budgets: first load (JS + fonts + assets) ≤1 MB before chapter 1 is playable; each chapter adds ≤250 KB of assets; all chapters together ≤8.5 MB. If a chapter cannot fit 250 KB, the art agent may raise its budget up to 400 KB and logs the measurements (sizes, resolution, quality, DPR 3 screenshot reviewed) in `docs/approvals.md`; the 8.5 MB total still holds.
5. Check sizes with `ls -l` on the shipped files; the `size-limit` and `npm run measure` entries cover the rest.
6. Generated PNG/WebP/HTML stay out of git: write to `$TMPDIR/Game/` (the scripts default to `$TMPDIR/Game/art-style/`).

## Self-check

Per asset, before it counts as done:

1. Rebuild: `node art/style/build.mjs && node art/style/render.cjs` (add `DPR=1,2,3` for several scales; `PLAYWRIGHT_BROWSERS_PATH` may point to `$TMPDIR/Game/cache/ms-playwright`, which the script picks up when it exists). Open the PNGs and look.
2. Phone legibility: the shipped bitmap in a 390 CSS px wide page at DPR 1 and DPR 3. Crop the hatched areas at ×4 (`magick -filter point -resize 400%`): hatching is readable at both, and DPR 1 shows no moiré bands that DPR 3 lacks. Bake the DPR 1 bitmap from the source at DPR 1 (the rasterizer anti-aliases) instead of letting the browser shrink the DPR 3 bitmap; where the pitch falls under 2 device px, merge the hatch into tone.
3. `magick montage` a contact sheet of the figure at 96, 192 and plate width beside the already-approved plates, plus the one-colour silhouette (threshold 55%). Light direction, line weight and tint offset match.
4. `grep -oiE '#[0-9a-f]{6}' <file> | sort -u` lists only Palette hex values.
5. Text pairs meet the contrast list; the Vietnamese check above passes.
6. Redrawn Tèo (turnaround and expressions) and the first 3 chapters go to the owner before the rest.

## Known defects of the mockup (avoid)

- Tèo is built from stiff hand-written polygons. Build the figure from a skeleton with smooth Catmull-Rom contours (`cr()`), overlapping limbs and cloth folds.
- The cap reads as a witch hat. Draw a soft red cap with a folded brim and a tip that slumps; its silhouette is not a straight cone.
- Hands holding the letter and quill are rough. Draw hands from a five-finger model with tapering fingers and contact with the object, or keep them out of view.
- The floor reads as a grid. Use planks of varied length with staggered joints, perspective convergence and hatching along the grain, not two evenly spaced orthogonal families.

## Banned

- Cartoon or childish drawing: chibi proportions, big eyes, rosy cheeks, thick outlines, bubbly rounded UI, squash and stretch.
- Flat paper-cut shapes, opaque flat fills, glow, glass blur, gradients other than lantern light and sky washes.
- Real logos and trade dress (KFC, NORAD, Coca-Cola); brand and institution names appear only as narration text.
- Portraits of real people; any living person. Historical figures (St Nicholas, Dickens, 1914 soldiers, the Magi) are drawn as period engravings, respectful.
- Nativity figures (infant Jesus, Mary, Joseph) appear without faces: shown through the star, light, a silhouette from behind, or the manger. The Bethlehem chapter's script needs owner approval.
- Emoji as icons; text baked into an image.
- AI-generated images in shipped assets; any paid image service. Revisit only when the owner asks.
- Inter, Geist, Roboto.

## Audio

- Only CC0 or self-made. No CC-BY, so no credits screen.
- Sound effects: ZzFX (MIT, https://github.com/KilledByAPixel/ZzFX), generated at runtime.
- Music: a small Web Audio synth (celesta, noise sleigh bells) playing public-domain melodies; timbre changes per era (lyre for Rome, flute for Vikings). The melody may be public domain while a recording or arrangement is not, so synthesize it yourself. No modern songs (Last Christmas). Music copyright law in Vietnam: unverified.
- Kenney CC0 samples (https://kenney.nl/assets/category:Audio): one pack per sound type, merged into a single audio sprite.
- Format: AAC `.m4a` everywhere. Ogg Opus does not play on Safari; Opus in WebM has Lockdown Mode bug reports.
- Unlock, pause and silent-switch rules: `web-game` skill. `navigator.audioSession` silent-switch behaviour: unverified.
