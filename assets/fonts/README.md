# Quran text font

The application self-hosts **Noto Sans Arabic, Version 2.012**, licensed under
the SIL Open Font License 1.1 (see [OFL.txt](OFL.txt)). The typeface is scoped to
the active Quran reading text, Quran search excerpts, and Surah headings. UI
controls retain the existing DIN Next LT Arabic / Tajawal stack.

- File: `NotoSansArabic-v2.012-e5ee313.ttf`
- Size: 844,676 bytes; one variable font, not multiple downloaded weights.
- SHA-256: `63111b5b2e074dd48cc67692e0a2726d86ee94c1c37fe8598257b7b4e87e869e`
- Official source, pinned commit:
  [Google Fonts e5ee31305efa101c2cae65f44d9642df2c8f0b4d](https://github.com/google/fonts/tree/e5ee31305efa101c2cae65f44d9642df2c8f0b4d/ofl/notosansarabic)
- [Pinned binary](https://raw.githubusercontent.com/google/fonts/e5ee31305efa101c2cae65f44d9642df2c8f0b4d/ofl/notosansarabic/NotoSansArabic%5Bwdth,wght%5D.ttf)

The complete TTF is intentional: an Arabic-only web subset can omit Quranic
annotation marks. Its cmap coverage is checked against all 6,236 original
Uthmani verses, including the small waw/yeh and Quranic marks. This checks glyph
availability, not the visual quality of every possible glyph combination; the
browser verification additionally checks real rendering and mobile line height.

Repeat the coverage and binary-integrity check (Node 24; no dependencies):

```powershell
node assets/fonts/verify-font.mjs
```

By default the check reads the application's pinned local Quran dataset; no
network is used. An optional second argument may point to a complete local
AlQuran Cloud `quran-uthmani` JSON response. The script never
modifies the original text or font. `font-display: swap` leaves text readable
while the font loads; the local versioned asset is browser-cacheable.
