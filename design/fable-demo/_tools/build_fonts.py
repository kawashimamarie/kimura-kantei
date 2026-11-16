#!/usr/bin/env python3
"""使用文字だけのサブセットフォント(woff2)を作り直す。
usage: python3 build_fonts.py --src <元TTFのフォルダ>
元TTFは google/fonts (ofl/shipporimincho, ofl/zenkakugothicnew, ofl/ibmplexsansjp) から取得する。
"""
import argparse, glob, html, os, re
from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAGES = {
    "a-rikon": [("ShipporiMincho-Medium", "shippori-mincho-500"), ("ShipporiMincho-SemiBold", "shippori-mincho-600"),
                ("ZenKakuGothicNew-Regular", "zen-kaku-gothic-new-400"), ("ZenKakuGothicNew-Medium", "zen-kaku-gothic-new-500"),
                ("ZenKakuGothicNew-Bold", "zen-kaku-gothic-new-700")],
    "b-kachi-check": [("IBMPlexSansJP-Regular", "ibm-plex-sans-jp-400"), ("IBMPlexSansJP-Medium", "ibm-plex-sans-jp-500"),
                      ("IBMPlexSansJP-SemiBold", "ibm-plex-sans-jp-600"), ("IBMPlexSansJP-Bold", "ibm-plex-sans-jp-700")],
}
BASE = "".join(chr(c) for c in range(0x20, 0x7F)) + "　、。・「」（）〜ー…—―％㎡￥¥×→←↑↓〒○●◯※"

def page_text(page):
    t = BASE
    for f in glob.glob(os.path.join(ROOT, page, "**", "*"), recursive=True):
        if f.endswith((".html", ".js", ".css")):
            s = html.unescape(open(f, encoding="utf-8").read())
            t += s
    return "".join(sorted(set(c for c in t if c >= " ")))

def find(src, name):
    m = glob.glob(os.path.join(src, "*" + name + ".ttf"))
    if not m: raise SystemExit("not found: " + name)
    return m[0]

ap = argparse.ArgumentParser(); ap.add_argument("--src", required=True); a = ap.parse_args()
for page, fonts in PAGES.items():
    text = page_text(page)
    for srcname, out in fonts:
        opt = subset.Options(); opt.flavor = "woff2"; opt.layout_features = ["*"]; opt.name_IDs = [1, 2, 4, 6]
        font = TTFont(find(a.src, srcname))
        ss = subset.Subsetter(opt); ss.populate(text=text); ss.subset(font)
        font.flavor = "woff2"
        dst = os.path.join(ROOT, page, "fonts", out + ".woff2"); font.save(dst)
        print(page, out, len(text), "chars", os.path.getsize(dst) // 1024, "KB")
