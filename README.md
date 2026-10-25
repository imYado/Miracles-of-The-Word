# The Miracles of The Word

A verse-by-verse English study of the Qurʾān for readers who don't know Arabic, focused on the miracle of its language.

## How it is organised

- `data/surahs/NNN-name.json` holds one surah: its words (root, classical meanings, possible translations and which are meant, meanings beyond the dictionary), literal translation, layers of meaning (each with its own tafsir), the linguistic miracle notes, and the reason for revelation. Every claim is tagged `consensus`, `scholar` (with the scholar's name) or `reflection`, has a source, and can be marked for scholar review.
- `site/templates/` holds the page design. `site/NNN-name.html` (one page per surah) and `site/index.html` are built from the data.
- Build with `python3 tools/build.py`.

Right now only Sūrat al-Ikhlāṣ (112) is filled in, as a demo.

A surah can carry a ring composition (sections, and the rings that pair them, each with what connects the two). Readers see the diagram only when a ring is claimed and the claim is tagged Scholar's view with the scholar named. al-Ikhlāṣ has none.

## Editing a surah

Open `site/112-al-ikhlas.html` and press **Edit**. Every piece of text becomes editable in place; click an Arabic word to edit its card. The bar at the bottom shows the project rules check. Edits save in your browser. Use **Copy JSON** and paste the result into the surah's file in `data/surahs/` to keep them, then rebuild.

The demo content is a first draft. Items marked "verify" need checking against the named sources.
