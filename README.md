# Miracles-of-The-Word

A verse-by-verse English study of the Qurʾān for readers who don't know Arabic, focused on its linguistics.

## Sūrat al-Ikhlāṣ demo editor

- `data/112-al-ikhlas.json` holds the study content: surah overview plus, for each verse, the Arabic text, word by word, literal translation, layers of meaning, linguistics, tafsir, and reason for revelation. Every claim carries a tag (`consensus`, `scholar`, `reflection`), a scholar name, a source, and a `review` flag for scholar review.
- `editor/index.html` is the editor. Open it in a browser. Switch between Read and Edit, and watch the project rules check in the sidebar (untagged claims, Scholar's view without a name, qiraʾāt or scientific-miracle wording, items marked for review). Edits save in your browser; use **Copy JSON** to take them out and paste them back into `data/112-al-ikhlas.json`.
- After changing the JSON or `editor/template.html`, rebuild with `python3 tools/build_editor.py`.

The content is a first draft. Items marked "Scholar review" need checking against the named sources before publishing.
