#!/usr/bin/env python3
"""Patch footer instrText (ROMAN/arabic) + hapus pgNumType kosong — aturan toc.md."""
import re, shutil, sys, zipfile, os

SRC = "/home/z/my-project/download/PRD_Sayangin.docx"
TMP = SRC + ".tmp"

with zipfile.ZipFile(SRC, "r") as zin:
    names = zin.namelist()
    data = {n: zin.read(n) for n in names}

# 1) document.xml: hapus <w:pgNumType/> kosong (docx-js artefak, membingungkan WPS)
doc = data["word/document.xml"].decode("utf-8")
doc = doc.replace("<w:pgNumType/>", "")
data["word/document.xml"] = doc.encode("utf-8")

# 2) footer XML: PAGE bare -> dengan format switch.
#    Footer Roman ditandai warna 807F80; footer body 808080 -> \* arabic.
pat = re.compile(r"(<w:instrText[^>]*>)\s*PAGE\s*(</w:instrText>)")
for n in names:
    if re.match(r"word/footer\d+\.xml", n):
        xml = data[n].decode("utf-8")
        fmt = "ROMAN" if "807F80" in xml else "arabic"
        xml2 = pat.sub(lambda m: m.group(1) + " PAGE \\* " + fmt + " \\* MERGEFORMAT " + m.group(2), xml)
        if xml2 != xml:
            print(f"patched {n} -> \\* {fmt}")
        data[n] = xml2.encode("utf-8")

with zipfile.ZipFile(TMP, "w", zipfile.ZIP_DEFLATED) as zout:
    for n in names:
        zout.writestr(n, data[n])
shutil.move(TMP, SRC)
print("OK footers+pgNumType patched:", SRC)
