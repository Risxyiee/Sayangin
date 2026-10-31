#!/usr/bin/env python3
"""Rename merek Sayangin → Degdegin (satu kali pakai).
Hanya menyentuh kata merek, BUKAN kata Indonesia 'sayang' pada umumnya.
"""
import pathlib, re

ROOT = pathlib.Path("/home/z/my-project/src")
FILES = [p for p in ROOT.rglob("*.tsx")] + [p for p in ROOT.rglob("*.ts")]
FILES += [pathlib.Path("/home/z/my-project/package.json")]

# urutan penting: pola paling spesifik dulu
PATTERNS = [
    # wordmark JSX terpecah: sayang<span ...>in</span> → degdeg<span ...>in</span>
    (re.compile(r"sayang(<span[^>]*>in</span>)"), r"degdeg\1"),
    # domain di kartu OG
    (re.compile(r"\bsayang\.in\b"), "degdeg.in"),
    # merek utuh, case-sensitive
    (re.compile(r"\bSayangin\b"), "Degdegin"),
    (re.compile(r"\bsayangin\b"), "degdegin"),
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
