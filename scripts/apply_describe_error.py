#!/usr/bin/env python3
"""Terapkan describeError() ke semua catch di src/app/api/**/*.ts
- tambah import setelah blok import terakhir
- console.error("...", err) -> console.error("...", describeError(err), err)
"""
import re
import sys
from pathlib import Path

ROOT = Path("/home/z/my-project/src/app/api")
IMPORT_LINE = 'import { describeError } from "@/lib/log-error";'

changed, skipped = [], []

for f in sorted(ROOT.rglob("route.ts")):
    src = f.read_text()
    if "describeError" in src:
        skipped.append(str(f))
        continue
    # 1) sisipkan import setelah import terakhir
    lines = src.splitlines()
    last_import = max(i for i, l in enumerate(lines) if l.startswith("import "))
    lines.insert(last_import + 1, IMPORT_LINE)
    # 2) perkaya console.error(..., err)
    out = "\n".join(lines)
    out = re.sub(
        r"console\.error\((\"[^\"]+\"),\s*err\);",
        r"console.error(\1, describeError(err), err);",
        out,
    )
    if "describeError(err)" not in out:
        skipped.append(str(f) + " (pola console.error tidak ketemu)")
        continue
    f.write_text(out + "\n" if not out.endswith("\n") else out)
    changed.append(str(f))

print(f"DIUBAH ({len(changed)}):")
for c in changed:
    print("  ", c)
print(f"LEWATI ({len(skipped)}):")
for s in skipped:
    print("  ", s)
sys.exit(0)
