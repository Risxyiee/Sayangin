#!/usr/bin/env python3
"""Hapus entri TOC duplikat pertama (hyperlink PAGEREF tanpa nomor halaman)."""
import re, shutil, zipfile

SRC = "/home/z/my-project/download/PRD_Sayangin.docx"
TMP = SRC + ".tmp"

with zipfile.ZipFile(SRC, "r") as zin:
    names = zin.namelist()
    data = {n: zin.read(n) for n in names}

doc = data["word/document.xml"].decode("utf-8")

# cari paragraf yang memuat hyperlink anchor _Toc1 di dalam field TOC
m = re.search(r"<w:p>(?:(?!</w:p>).)*?w:anchor=\"_Toc1\"(?:(?!</w:p>).)*?</w:p>", doc, re.S)
if m:
    doc = doc[:m.start()] + doc[m.end():]
    print("duplikat entri TOC pertama dihapus")
else:
    print("tidak ada duplikat (sudah bersih)")

data["word/document.xml"] = doc.encode("utf-8")
with zipfile.ZipFile(TMP, "w", zipfile.ZIP_DEFLATED) as zout:
    for n in names:
        zout.writestr(n, data[n])
shutil.move(TMP, SRC)
print("OK:", SRC)
