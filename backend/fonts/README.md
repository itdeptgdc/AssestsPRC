# PDF report fonts

Used by `src/utils/export.js` so PDF exports show Latin, Thai and Khmer text on any server.

| File | Script | Source | Licence |
|---|---|---|---|
| NotoSans-Regular/Bold.ttf | Latin | Noto (notofonts.github.io) | SIL Open Font License 1.1 |
| NotoSansThai-Regular/Bold.ttf | Thai | Noto (notofonts.github.io) | SIL Open Font License 1.1 |
| Battambang-Regular/Bold.ttf | Khmer | Google Fonts (github.com/google/fonts, ofl/battambang) | SIL Open Font License 1.1 |

Battambang is used for Khmer because Noto Sans Khmer triggers a mark-positioning bug in the PDF library (fontkit).
