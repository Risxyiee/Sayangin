#!/usr/bin/env python3
"""Perbaiki selector rusak di tests/e2e/confess.spec.ts.

Literal 'a[href' dihindari di sini karena teks bracket dimutasi saat lewat
shell — string dibangun via chr(91)/chr(93).
"""
import pathlib

A = "a" + chr(91) + "href*="  # a[href*=
CLOSE = chr(93)               # ]

p = pathlib.Path("tests/e2e/confess.spec.ts")
s = p.read_text()

before_aref = s.count("aref")
s = s.replace("locator('aref*=\"/?k=\"')", "locator('" + A + "\"/?k=\"" + CLOSE + "')")
s = s.replace("locator('aref*=\"/?s=\"')", "locator('" + A + "\"/?s=\"" + CLOSE + "')")
p.write_text(s)

s2 = p.read_text()
print("aref sebelum:", before_aref, "| sesudah:", s2.count("aref"))
print("target fix ada:", s2.count(A))
for i, line in enumerate(s2.splitlines(), 1):
    if "locator(" in line and ("/?k=" in line or "/?s=" in line):
        print(f"{i}: {line.strip()}")
