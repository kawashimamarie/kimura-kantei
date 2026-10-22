#!/usr/bin/env python3
"""自前配信フォントのサブセット生成（fonttools）。

使い方は fonts/README.md を参照。通常は `npm run fonts:subset`（または fonts:update）から呼ばれる。
入力  : fonts/fonts.config.json・fonts/sources.json・fonts/charset.json・.font-cache/（元フォント）
出力  : public/assets/fonts/<id>.<hash>.woff2・fonts/manifest.json・src/styles/d7/fonts.css
同じ入力・同じ fonttools のバージョンなら、同じバイト列（同じハッシュ）になる。
"""
import hashlib
import json
import platform
import sys
from pathlib import Path

import brotli  # noqa: F401  WOFF2 の圧縮に必要
import fontTools
from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

SITE = Path(__file__).resolve().parents[2]
cfg = json.loads((SITE / 'fonts/fonts.config.json').read_text(encoding='utf8'))
src = json.loads((SITE / 'fonts/sources.json').read_text(encoding='utf8'))
charset = json.loads((SITE / 'fonts/charset.json').read_text(encoding='utf8'))
cache = SITE / '.font-cache'
out_dir = SITE / cfg['outDir']


def jis_symbols():
    """JIS X 0208 の漢字以外（記号・全角英数・かな・ギリシャ・キリル・罫線）。"""
    out = set()
    for hi in range(0x81, 0xEB):
        for lo in range(0x40, 0xFD):
            if lo == 0x7F:
                continue
            try:
                ch = bytes([hi, lo]).decode('shift_jis')
            except UnicodeDecodeError:
                continue
            if len(ch) == 1 and not (0x4E00 <= ord(ch) <= 0x9FFF):
                out.add(ch)
    return out


BASE_SETS = {
    'ascii': {chr(c) for c in range(0x20, 0x7F)},
    'kana': {chr(c) for c in range(0x3040, 0x3100)},
    'jis-symbols': jis_symbols(),
    'latin-punct': set('¥©·–—‘’“”•…‹›«»°±×÷'),
}


def ranges(codepoints):
    cps = sorted(codepoints)
    out, start, prev = [], None, None
    for c in cps:
        if start is None:
            start = prev = c
        elif c == prev + 1:
            prev = c
        else:
            out.append((start, prev))
            start = prev = c
    if start is not None:
        out.append((start, prev))
    return ','.join(f'{a:X}' if a == b else f'{a:X}-{b:X}' for a, b in out)


def sha256(b):
    return hashlib.sha256(b).hexdigest()


old_manifest = None
mp = SITE / 'fonts/manifest.json'
if mp.exists():
    old_manifest = json.loads(mp.read_text(encoding='utf8'))

manifest = {
    'tools': {'python': platform.python_version(), 'fonttools': fontTools.version, 'brotli': brotli.__version__},
    'faces': {},
}
out_dir.mkdir(parents=True, exist_ok=True)
keep = set()
css = []

for face in cfg['faces']:
    s = src['sources'][face['source']]
    path = cache / s['file']
    raw = path.read_bytes()
    if sha256(raw) != s['sha256']:
        sys.exit(f"元フォントの sha256 が一致しません: {path.name}（npm run fonts:fetch をやり直してください）")
    font = TTFont(path, recalcTimestamp=False)  # 保存のたびに更新日時が変わらないようにする（同じ入力なら同じバイト列）
    if face.get('instance'):
        axes = {k: (tuple(v) if isinstance(v, list) else v) for k, v in face['instance'].items()}
        font = instancer.instantiateVariableFont(font, axes, inplace=False)
        # いったん保存して読み直す（メモリ上のまま subset すると gvar の読み込みで失敗するため）
        inst = out_dir / f'.{face["id"]}.instance.ttf'
        font.recalcTimestamp = False
        font.save(inst)
        font = TTFont(inst, recalcTimestamp=False)
        inst.unlink()
    chars = set(''.join(charset['faces'][face['id']]['chars']))
    for b in face['baseSets']:
        chars |= BASE_SETS[b]
    opts = subset.Options()
    opts.flavor = 'woff2'
    opts.hinting = False
    opts.layout_features = face['layoutFeatures']
    opts.name_IDs = ['*']
    opts.notdef_outline = True
    opts.glyph_names = False
    opts.drop_tables += ['DSIG']
    sub = subset.Subsetter(opts)
    sub.populate(unicodes={ord(c) for c in chars})
    sub.subset(font)
    font.flavor = 'woff2'
    font.recalcTimestamp = False
    tmp = out_dir / f'.{face["id"]}.tmp'
    font.save(tmp)
    data = tmp.read_bytes()
    tmp.unlink()
    h = sha256(data)
    name = f'{face["id"]}.{h[:8]}.woff2'
    (out_dir / name).write_bytes(data)
    keep.add(name)
    cmap = set(TTFont(out_dir / name).getBestCmap().keys())
    src_cmap = set(TTFont(path).getBestCmap().keys())
    unavailable = ''.join(sorted((c for c in set(''.join(charset['faces'][face['id']]['chars'])) if ord(c) not in src_cmap and not c.isspace()), key=ord))
    manifest['faces'][face['id']] = {
        'file': name,
        'family': face['family'],
        'weight': face['weight'],
        'bytes': len(data),
        'sha256': h,
        'source': face['source'],
        'sourceSha256': s['sha256'],
        'sourceVersion': s['version'],
        'codepoints': len(cmap),
        'coverage': ranges(cmap),
        'unavailable': unavailable,
    }
    css.append(
        '@font-face { font-family: "%s"; font-style: normal; font-weight: %s; font-display: swap; '
        'src: url("%s%s") format("woff2"); }' % (face['family'], face['weight'], cfg['publicPath'], name)
    )

for f in out_dir.glob('*.woff2'):
    if f.name not in keep:
        f.unlink()

manifest['totalBytes'] = sum(f['bytes'] for f in manifest['faces'].values())
mp.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf8')
(SITE / cfg['cssFile']).write_text(
    '/* このファイルは scripts/fonts/subset.py が生成します。手で編集しないでください（npm run fonts:update で再生成）。\n'
    '   自前配信フォント。ライセンスは SIL Open Font License 1.1（public/assets/fonts/licenses/）。\n'
    '   font-display: swap … 文字は最初は端末の既定フォントで表示し、フォントが届き次第入れ替える。 */\n'
    + '\n'.join(css) + '\n',
    encoding='utf8',
)

print('%-26s %9s  %s' % ('face', 'bytes', 'glyphs/codepoints'))
for k, v in manifest['faces'].items():
    prev = (old_manifest or {}).get('faces', {}).get(k, {}).get('bytes')
    d = '' if prev is None else '  (前回 %d → %+d bytes)' % (prev, v['bytes'] - prev)
    print('%-26s %9d  %d%s' % (k, v['bytes'], v['codepoints'], d))
print('合計 %d bytes' % manifest['totalBytes'])
