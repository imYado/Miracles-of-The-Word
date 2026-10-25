"""Build editor/index.html by inlining data/112-al-ikhlas.json into editor/template.html."""
import json
from pathlib import Path

root = Path(__file__).resolve().parent.parent
seed = json.loads((root / "data" / "112-al-ikhlas.json").read_text(encoding="utf-8"))
# Escape "</" so the JSON cannot close the <script> tag it sits in.
payload = json.dumps(seed, ensure_ascii=False).replace("</", "<\\/")
template = (root / "editor" / "template.html").read_text(encoding="utf-8")
(root / "editor" / "index.html").write_text(template.replace("/*__SEED__*/", payload), encoding="utf-8")
print("Wrote editor/index.html")
