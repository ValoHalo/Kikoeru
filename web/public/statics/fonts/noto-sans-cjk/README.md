# Noto Sans CJK

Bundled Noto Sans CJK SC, JP, and TC variable fonts, version 2.004, under the
SIL Open Font License 1.1. See `LICENSE`. The copyright and license metadata
are also preserved in each font file.

Copyright 2014-2021 Adobe (http://www.adobe.com/), with Reserved Font Name 'Source'.

## Source

Official repository: https://github.com/notofonts/noto-cjk

Revision: `f8d157532fbfaeda587e826d4cd5b21a49186f7c`

Original files at that revision:

- `Sans/Variable/TTF/NotoSansCJKsc-VF.ttf`
- `Sans/Variable/TTF/NotoSansCJKjp-VF.ttf`
- `Sans/Variable/TTF/NotoSansCJKtc-VF.ttf`
- `Sans/LICENSE`

Each region retains all 44,810 Unicode characters from its original cmap,
the 100-900 weight axis, and OpenType layout features. WOFF2 files partition
the sorted character set into groups of up to 1,024 characters. The generated
`src/css/noto-sans-cjk.css` uses exact `unicode-range` declarations so browsers
load the shards needed by the page. These are not subsets limited to UI text.

All font requests use the Kikoeru server. The existing PWA precache includes
the font assets, so the installed PWA downloads all shards for offline use.

## Regeneration

Download the four original files above into one directory. With Python and
`fonttools[woff]==4.62.1` installed, run from `web`:

```sh
python scripts/subset-cjk-fonts.py /path/to/original-fonts
```

The script regenerates the WOFF2 assets, license, and CSS and checks that
every original Unicode character is retained. Python is only needed to
regenerate fonts; normal application builds use the bundled files directly.
