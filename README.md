# Miracles of The Word

A verse-by-verse English study of the Qurʾān's language, for readers who don't know Arabic.
Live at https://miraclesoftheword.vercel.app

## How the content is organised

```
content/
  sources.yaml                 every book and scholar, written once
  dictionary/<entry>.yaml      one file per word, shared by every verse that uses it
  surahs/
    112-al-ikhlas/
      surah.yaml               overview, theme, neighbouring surahs, ring composition
      verses/
        1.yaml                 words, literal translation, layers of meaning (each with its
        2.yaml …               own tafsir), the miracle in the words, reason for revelation
```

- **Claims.** Every claim has a `tag` (`consensus`, `scholar` with a `scholar:` name, or `reflection`), `sources`, and `review: true` when it still needs a scholar to check it.
- **Sources** are cited by id: `sources: [{ id: kashshaf, loc: "on 112:1" }]`. Add new books to `content/sources.yaml`.
- **Words** in a verse point to a dictionary entry (`entry: ahad`) and list which of its translations are meant in that verse (`used:`). The root, meanings and translations live in the dictionary, so they stay the same everywhere.
- **Ring composition** is shown only when `ring.supported` is true and the claim is tagged `scholar` with a name, or `ring.demo` is true (shown with a "not yet verified" label).

To add a surah, copy the `112-al-ikhlas` folder, rename it (`NNN-name`), and fill it in. It appears on the home page automatically.

## Working on it

You need [Node.js](https://nodejs.org) 20 or newer.

```
npm install        # once
npm run dev        # http://localhost:4321
```

On your computer the **Edit** button appears on every surah page. Every change you make there is saved straight into the files in `content/`. Commit and push them, and Vercel publishes the site.

Visitors to the live site don't see the Edit button. You can still edit there by adding `#edit` to a surah's address (for example `/112-al-ikhlas#edit`). Those changes are kept only in your browser. To keep them, press **Copy JSON**, save it as a file, and run `npm run import that-file.json`.

`npm run build` writes the finished site into `dist/`. Vercel runs this on every push (see `vercel.json`).

## How the site is built

- `src/templates/` holds the page shells, and `src/styles/site.css` the design.
- `src/client/render.js` turns a surah into HTML. The same code pre-renders every page at build time and redraws the page in edit mode.
- `src/client/page.js` runs the word cards, the ring diagram and the night sky. `src/client/editor.js` loads only when Edit is pressed.
- `src/lib/content.mjs` reads and writes `content/`, and `src/lib/build.mjs` builds `dist/`.

The demo content is a first draft. Items marked "verify" need checking against the named sources.
