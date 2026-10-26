// npm run import <file.json>: writes a surah copied with "Copy JSON" on the live site back into content/.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { saveSurah } from "../src/lib/content.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const file = process.argv[2];
if (!file) { console.error("Usage: npm run import <file.json>"); process.exit(1); }
const doc = JSON.parse(fs.readFileSync(file, "utf8"));
saveSurah(root, doc);
console.log("Saved " + doc.slug + " into content/. Check the changes with git diff, then commit.");
