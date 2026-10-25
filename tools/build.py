"""Build the site: one page per surah in data/surahs/, plus site/index.html.

Each data/surahs/NNN-name.json becomes site/NNN-name.html, with the surah's
data inlined so the page works as a single file.
"""
import html
import json
import sys
from pathlib import Path

# The templates are page bodies. For the repo we wrap them in a full document;
# with --artifact OUT_DIR we also write the bare bodies, which the Artifact
# host wraps itself.
HEAD = '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
artifact_dir = Path(sys.argv[sys.argv.index("--artifact") + 1]) if "--artifact" in sys.argv else None


def write(name, body):
    (root / "site" / name).write_text(HEAD + body, encoding="utf-8")
    if artifact_dir:
        artifact_dir.mkdir(parents=True, exist_ok=True)
        (artifact_dir / name).write_text(body, encoding="utf-8")

root = Path(__file__).resolve().parent.parent
templates = root / "site" / "templates"
surah_tpl = (templates / "surah.html").read_text(encoding="utf-8")
index_tpl = (templates / "index.html").read_text(encoding="utf-8")

items = []
for path in sorted((root / "data" / "surahs").glob("*.json")):
    data = json.loads(path.read_text(encoding="utf-8"))
    s = data["surah"]
    # Escape "</" so the JSON cannot close the <script> tag it sits in.
    payload = json.dumps(data, ensure_ascii=False).replace("</", "<\\/")
    page = surah_tpl.replace("/*__SEED__*/", payload).replace("/*__TITLE__*/", html.escape("Sūrat " + s["nameTr"]))
    write(path.stem + ".html", page)
    items.append(
        f'<li><a href="{path.stem}.html"><span class="num">{s["number"]}</span>'
        f'<span class="en">{html.escape(s["nameTr"])}<small>{html.escape(s["nameEn"])} · {len(data["verses"])} verses</small></span>'
        f'<span class="ar" lang="ar">{html.escape(s["nameAr"])}</span></a></li>'
    )
    print("Wrote site/" + path.stem + ".html")

write("index.html", index_tpl.replace("/*__LIST__*/", "".join(items)))
print("Wrote site/index.html")
