// 日本語の文節の切れ目に <wbr>（改行してよい位置）を入れる（ビルド後に dist/ の HTML を加工する）。
//
// なぜ必要か：CSS の word-break: auto-phrase は Chrome だけが対応しており、Safari・Firefox では文節ではなく
// 文字単位で改行されてしまう（「始めま／す。」「立退料な／ど」のように、語の途中で割れる）。
// BudouX（Google の文節分割。Chrome の auto-phrase と同系統の方式、Apache-2.0）で切れ目を決め、
// どのブラウザでも同じ位置で改行できるようにする。ビルド時だけに使い、配信物に BudouX のコードは含まれない。
//
// 方針
//  - 本文のテキストだけを加工（script・style・noscript・svg・textarea・title・pre・code は除く）
//  - <wbr> は表示にも読み上げにもコピーにも影響せず、検索エンジンも文字としては扱わない
//  - パーサー parse5 の位置情報を使い、元の HTML は該当テキスト以外を一切書き換えない（同じ入力なら同じ出力）
//  - dev-preview/（確認用ページ）は加工しない。PHRASE_BREAKS=0 で無効にできる
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadDefaultJapaneseParser } from 'budoux';
import { parse } from 'parse5';

const SKIP = new Set(['script', 'style', 'noscript', 'svg', 'textarea', 'title', 'template', 'pre', 'code', 'option', 'head']);
const JA = /[぀-ヿ㐀-鿿]/;
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const walk = (dir) => readdirSync(dir).flatMap((n) => {
  const p = join(dir, n);
  if (statSync(p).isDirectory()) return n === 'dev-preview' ? [] : walk(p);
  return p.endsWith('.html') ? [p] : [];
});

/** HTML 文字列を加工して返す（テスト用に公開） */
export function addPhraseBreaks(html, parser = loadDefaultJapaneseParser()) {
  const doc = parse(html, { sourceCodeLocationInfo: true });
  const edits = [];
  const visit = (node, skipped) => {
    for (const c of node.childNodes ?? []) {
      if (c.nodeName === '#text') {
        if (skipped || !JA.test(c.value) || !c.sourceCodeLocation) continue;
        const phrases = parser.parse(c.value);
        if (phrases.length < 2) continue;
        edits.push([c.sourceCodeLocation.startOffset, c.sourceCodeLocation.endOffset, phrases.map(esc).join('<wbr>')]);
      } else if (c.childNodes) {
        const attrs = c.attrs ?? [];
        visit(c, skipped || SKIP.has(c.nodeName) || attrs.some((a) => a.name === 'data-no-wbr' || (a.name === 'translate' && a.value === 'no')));
      }
    }
    if (node.content) visit(node.content, skipped); // <template>
  };
  visit(doc, false);
  let out = html;
  for (const [s, e, t] of edits.sort((a, b) => b[0] - a[0])) out = out.slice(0, s) + t + out.slice(e);
  return out;
}

export default function phraseBreaks() {
  return {
    name: 'phrase-breaks',
    hooks: {
      'astro:build:done': ({ dir }) => {
        if (process.env.PHRASE_BREAKS === '0') return;
        const parser = loadDefaultJapaneseParser();
        let files = 0, wbrs = 0;
        for (const f of walk(fileURLToPath(dir))) {
          const html = readFileSync(f, 'utf8');
          const out = addPhraseBreaks(html, parser);
          if (out !== html) { writeFileSync(f, out); files++; wbrs += (out.match(/<wbr>/g) ?? []).length - (html.match(/<wbr>/g) ?? []).length; }
        }
        console.log(`[phrase-breaks] ${files} ページに <wbr> を ${wbrs} か所追加（BudouX）`);
      },
    },
  };
}
