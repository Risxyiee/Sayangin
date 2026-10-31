#!/usr/bin/env python3
"""Rename merek Degdegin → Kangenin (satu kali pakai).

Urutan pola penting: wordmark JSX yang terpecah dulu, baru merek utuh.
Tagline baru: "bikin dia kangen". Domain kartu OG: kangen.in.
"""
import pathlib, re

ROOT = pathlib.Path("/home/z/my-project/src")
FILES = [p for p in ROOT.rglob("*.tsx")] + [p for p in ROOT.rglob("*.ts")]
FILES += [
    pathlib.Path("/home/z/my-project/prisma/schema.prisma"),
    pathlib.Path("/home/z/my-project/scripts/seed-fomo.ts"),
]

PATTERNS = [
    # wordmark JSX terpecah: degdeg<span ...>in</span> → kangen<span ...>in</span>
    (re.compile(r"degdeg(<span[^>]*>in</span>)"), r"kangen\1"),
    # wordmark kartu status: degdeg<span ...>.in</span> → kangen<span ...>.in</span>
    (re.compile(r"degdeg(<span[^>]*>\.in</span>)"), r"kangen\1"),
    # tagline utama di metadata
    (re.compile(r"bikin dia deg-degan"), "bikin dia kangen"),
    # merek utuh
    (re.compile(r"\bDegdegin\b"), "Kangenin"),
    (re.compile(r"\bdegdegin\b"), "kangenin"),
    # fragmen OG card: div "degdeg" berdiri sendiri (pasangan ".in")
    (re.compile(r"(>\s*)degdeg(\s*<)"), r"\1kangen\2"),
]

changed = {}
for f in FILES:
    text = f.read_text(encoding="utf-8")
    orig = text
    for pat, rep in PATTERNS:
        text = pat.sub(rep, text)
    if text != orig:
        f.write_text(text, encoding="utf-8")
        n = sum(1 for a, b in zip(orig.splitlines(), text.splitlines()) if a != b)
        changed[str(f)] = n

for f, n in sorted(changed.items()):
    print(f"{n:3d} lines  {f}")
print(f"\n{len(changed)} file diubah")
