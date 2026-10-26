// npm run build: writes the finished site into dist/ (this is what Vercel runs).
import { fileURLToPath } from "node:url";
import path from "node:path";
import { build } from "../src/lib/build.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { surahs } = build(root);
console.log("Built dist/ with " + surahs.length + " surah page(s): " + surahs.join(", "));
