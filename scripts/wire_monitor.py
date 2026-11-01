#!/usr/bin/env python3
"""S-05: sisipkan reportError(err, { route }) setelah setiap console.error
di catch block API routes + tambahkan import monitor. Idempotent."""
import re, glob, os

ROOT = "/home/z/my-project/src/app/api"
pat_console = re.compile(
    r'^(\s*)console\.error\("([^"]*?) error:", describeError\(err\), err\);$'
)
pat_import = re.compile(r'^import ')
import_line = 'import { reportError } from "@/lib/monitor";'

changed = []
for path in glob.glob(os.path.join(ROOT, "**", "route.ts"), recursive=True):
    with open(path) as f:
        lines = f.read().splitlines()
    if any(import_line in l for l in lines):
        continue  # sudah di-wiring
    out, inserted_import, n_hit = [], False, 0
    for l in lines:
        out.append(l)
        if not inserted_import and pat_import.match(l):
            pass  # tunggu import terakhir
    # temukan indeks import terakhir
    last_import = max(i for i, l in enumerate(lines) if pat_import.match(l))
    m_all = []
    for i, l in enumerate(lines):
        m = pat_console.match(l)
        if m:
            indent, route = m.group(1), m.group(2)
            m_all.append((i, indent, route))
    if not m_all:
        continue
    lines.insert(last_import + 1, import_line)
    # sisipkan setelah console.error (indeks geser +1 karena import disisip)
    for i, indent, route in reversed(m_all):
        lines.insert(i + 2, f'{indent}reportError(err, {{ route: "{route}" }});')
    with open(path, "w") as f:
        f.write("\n".join(lines) + "\n")
    changed.append((os.path.relpath(path, ROOT), len(m_all)))

for p, n in changed:
    print(f"  {p}: {n} catch di-wiring")
print(f"TOTAL: {len(changed)} file, {sum(n for _, n in changed)} catch")
