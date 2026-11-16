#!/usr/bin/env python3
"""デモ用フォントのサブセット生成。

各デモの HTML / JS に実際に出てくる文字だけを抜き出し、OFL フォントから woff2 を作る。
元フォント（Google Fonts の github.com/google/fonts にある TTF）は容量が大きいためリポジトリに含めない。
  使い方: python3 demo/_tools/build_fonts.py --src <元フォントを置いたフォルダ>
  必要:   pip install fonttools brotli
"""
import argparse, pathlib, re, sys, html
from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

ROOT = pathlib.Path(__file__).resolve().parents[1]

# 役割ごとに「どのファイルの文字を集めるか」「どの書体・太さから作るか」
JOBS = {
    'a-rikon': {
        'text_from': ['index.html', 'js/a.js', 'css/a.css'],
        'fonts': [
            ('zenoldmincho/ZenOldMincho-Medium.ttf', None, 'zen-old-mincho-500.woff2'),
            ('zenoldmincho/ZenOldMincho-Bold.ttf', None, 'zen-old-mincho-700.woff2'),
            ('zenkakugothicnew/ZenKakuGothicNew-Regular.ttf', None, 'zen-kaku-gothic-new-400.woff2'),
            ('zenkakugothicnew/ZenKakuGothicNew-Medium.ttf', None, 'zen-kaku-gothic-new-500.woff2'),
            ('zenkakugothicnew/ZenKakuGothicNew-Bold.ttf', None, 'zen-kaku-gothic-new-700.woff2'),
        ],
    },
    'b-kachi-check': {
        'text_from': ['index.html', 'js/b.js', 'css/b.css'],
        'fonts': [
            ('mplus2/MPLUS2[wght].ttf', 400, 'm-plus-2-400.woff2'),
            ('mplus2/MPLUS2[wght].ttf', 500, 'm-plus-2-500.woff2'),
            ('mplus2/MPLUS2[wght].ttf', 700, 'm-plus-2-700.woff2'),
            ('mplus2/MPLUS2[wght].ttf', 800, 'm-plus-2-800.woff2'),
        ],
    },
}
# 入力欄などで後から打たれる可能性のある基本文字（数字・英字・記号・かな）
BASE = ''.join(chr(c) for c in range(0x20, 0x7f)) + \
    ''.join(chr(c) for c in range(0x3041, 0x3097)) + ''.join(chr(c) for c in range(0x30a1, 0x30fd)) + \
    '、。・「」『』（）〜ー―…？！：；／％＋－×÷＝㎡￥¥,.　'

def collect(dirpath, names):
    chars = set(BASE)
    for n in names:
        p = dirpath / n
        if not p.exists():
            continue
        t = p.read_text(encoding='utf-8')
        if n.endswith('.css'):
            t = ' '.join(re.findall(r'content:"([^"]*)"', t))
        if n.endswith('.html'):
            t = re.sub(r'<(script|style)\b.*?</\1>', ' ', t, flags=re.S)
            t = re.sub(r'<!--.*?-->', ' ', t, flags=re.S)
            attrs = ' '.join(m.group(2) for m in re.finditer(r'\b(alt|title|placeholder|aria-label|content|value|label)="([^"]*)"', t))
            t = html.unescape(re.sub(r'<[^>]+>', ' ', t) + ' ' + attrs)
        chars.update(ch for ch in t if ord(ch) >= 0x20)
    return ''.join(sorted(chars))

def build(src_dir, job_name, job):
    out_dir = ROOT / job_name / 'fonts'
    out_dir.mkdir(parents=True, exist_ok=True)
    text = collect(ROOT / job_name, job['text_from'])
    for src, wght, out in job['fonts']:
        font = TTFont(str(src_dir / src))
        if wght is not None:
            font = instancer.instantiateVariableFont(font, {'wght': wght})
        opts = subset.Options()
        opts.flavor = 'woff2'
        opts.layout_features = ['*']      # 縦書き(vert)・詰め(palt)などを残す
        opts.name_IDs = ['*']             # 著作権・ライセンス表示を残す
        opts.name_languages = ['*']
        opts.notdef_outline = True
        opts.glyph_names = False
        sub = subset.Subsetter(opts)
        sub.populate(text=text)
        sub.subset(font)
        font.flavor = 'woff2'
        font.save(str(out_dir / out))
        missing = [ch for ch in text if ord(ch) > 0x7f and ord(ch) not in font.getBestCmap()]
        size = (out_dir / out).stat().st_size
        print(f'{job_name}/{out}: {size/1024:.0f}KB, {len(text)}字' + (f' ／未収録: {"".join(missing)}' if missing else ''))

if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--src', required=True)
    ap.add_argument('--only')
    a = ap.parse_args()
    for name, job in JOBS.items():
        if a.only and a.only != name:
            continue
        build(pathlib.Path(a.src), name, job)
