// B案の街並み（連続立面）SVG を生成する。出力を index.html の <!--TOWN--> … <!--/TOWN--> に差し込む。
//   node demo/_tools/gen_town.js
const fs = require('fs'), path = require('path');
const G = 228; // 地盤面
const o = [];
const r = (x, y, w, h, c, extra = '') => o.push(`<rect class="${c}" x="${x}" y="${y}" width="${w}" height="${h}"${extra}/>`);
const p = (d, c) => o.push(`<path class="${c}" d="${d}"/>`);

// 奥のシルエット
p('M0,228V150h46v-22h64v40h38v-58h52v26h70v-18h44v46h60v-70h58v34h40v-52h36v52h52v-30h70v62h46v-88h62v36h30v-58h44v58h56v30h64v-44h48v-34h52v60h44v-24h60v46h50v-64h56v36h40v-20h48v104z', 't-far');

// 電線
p('M330,131C420,146 500,146 560,112M330,137C420,152 500,152 560,120', 't-wire');
p('M880,112C960,150 1100,150 1215,128', 't-wire');

// 1 アパート（2階建て）
r(22, 162, 132, 66, 't-b2'); r(16, 158, 144, 5, 't-roof');
for (let f = 0; f < 2; f++) for (let i = 0; i < 4; i++) {
  const x = 32 + i * 31, y = 170 + f * 30;
  r(x, y, 9, 20, 't-door'); r(x + 12, y + 2, 12, 11, (f === 0 && i === 2) || (f === 1 && i === 0) ? 't-w t-w--warm' : 't-w');
}
p('M22,194h132M22,188h132', 't-rail');
// 木
const tree = (x, s = 1) => { p(`M${x},228v${-26 * s}`, 't-trunk'); o.push(`<ellipse class="t-tree" cx="${x}" cy="${228 - 40 * s}" rx="${15 * s}" ry="${21 * s}"/>`); };
tree(180, 1);
// 2 家A
p('M206,228V178l46-30l46,30v50z', 't-b1'); p('M200,180l52-34l52,34l-4,5l-48-31l-48,31z', 't-roof');
r(222, 186, 16, 13, 't-w'); r(264, 186, 16, 13, 't-w t-w--warm'); r(222, 206, 20, 14, 't-w'); r(268, 204, 11, 24, 't-door');
// 電柱
p('M330,228V118M321,128h18M324,137h12', 't-pole'); r(332, 144, 7, 11, 't-pole-box');
// 3 家B（一戸建ての対象）
o.push('<g class="t-target" data-type="kodate" transform="translate(20 0)">');
p('M380,228V162l50-36l50,36v66z', 't-b1 t-b1--l'); p('M373,164l57-41l57,41l-4,6l-53-38l-53,38z', 't-roof');
p('M480,190l34,6v32h-34z', 't-b1 t-b1--l'); p('M476,186l42,7v5l-42-7z', 't-roof');
r(394, 170, 22, 15, 't-w'); r(444, 170, 22, 15, 't-w t-w--lit'); r(392, 198, 30, 22, 't-w t-w--lit'); r(448, 196, 13, 32, 't-door'); r(490, 206, 14, 11, 't-w');
p('M374,228V160l56-40l56,40v26l32,6v36z', 't-hl');
o.push('</g>');

// 4 マンション（窓がドット表示になる）
o.push('<g class="t-target" data-type="mansion">');
r(560, 52, 320, 176, 't-m'); r(554, 47, 332, 6, 't-roof'); r(694, 30, 52, 18, 't-m2'); r(690, 27, 60, 4, 't-roof');
p('M780,47V22M774,28h12M776,34h8', 't-pole');
r(560, 210, 320, 18, 't-m2');
for (let i = 0; i < 7; i++) r(578 + i * 44, 210, 5, 18, 't-col');
r(704, 212, 32, 16, 't-w t-w--warm');
p('M554,47h332v181h-6V53H560v175h-6z', 't-hl');
o.push('<g id="mwin">');
const COLS = 23, ROWS = 11, PX = 13, PY = 14, X0 = 572, Y0 = 59;
const Q = ['01110', '10001', '00001', '00010', '00100', '00000', '00100']; // 「？」の5×7ドット
for (let rr = 0; rr < ROWS; rr++) for (let cc = 0; cc < COLS; cc++) {
  const gr = rr - 2, gc = cc % 9; // 表示に使うのは3〜9階の7段。「？」3つを、5列＋4列あきで並べる
  const on = gr >= 0 && gr < 7 && gc < 5 && Q[gr][gc] === '1';
  r(X0 + cc * PX, Y0 + rr * PY, 9, 9, on ? 'mw on' : 'mw');
}
o.push('</g></g>');

// 5 空き地（土地の対象）
o.push('<g class="t-target" data-type="tochi" transform="translate(-10 0)">');
r(906, 224, 140, 4, 't-lot');
p('M912,224c2-6,3-8,4-10c1,4,2,6,3,10M934,224c1-4,2-6,3-7c1,3,2,4,2,7M1010,224c1-5,2-7,3-9c1,4,2,6,3,9M1030,224c1-3,1-4,2-5c1,2,1,3,2,5', 't-grass');
p('M960,228V196M992,228V196', 't-pole'); r(950, 186, 52, 26, 't-sign');
p('M958,195h36M958,201h24', 't-sign-l');
r(906, 214, 4, 14, 't-stake'); r(1042, 214, 4, 14, 't-stake'); r(905, 211, 6, 4, 't-stake-top'); r(1041, 211, 6, 4, 't-stake-top');
p('M904,228v-18h8M1048,228v-18h-8M904,228h144', 't-hl t-hl--lot');
o.push('</g>');

// 6 家C（寄棟）
p('M1072,228V176h100v52z', 't-b1'); p('M1064,178l20-26h76l20,26z', 't-roof');
r(1086, 186, 20, 14, 't-w t-w--warm'); r(1132, 186, 20, 14, 't-w'); r(1084, 206, 28, 16, 't-w'); r(1136, 204, 12, 24, 't-door');
tree(1196, 1.1);
// 7 5階建てビル
r(1216, 116, 122, 112, 't-b2'); r(1212, 112, 130, 5, 't-roof');
for (let f = 0; f < 4; f++) for (let i = 0; i < 4; i++) r(1228 + i * 27, 126 + f * 20, 17, 11, ((f * 4 + i) % 7 === 2 || (f * 4 + i) === 13) ? 't-w t-w--warm' : 't-w');
r(1228, 206, 98, 22, 't-w t-w--shop');
// 8 端の建物
r(1362, 150, 90, 78, 't-b1'); r(1356, 146, 96, 5, 't-roof'); r(1376, 162, 16, 12, 't-w'); r(1404, 162, 16, 12, 't-w'); r(1376, 186, 16, 12, 't-w t-w--warm'); r(1404, 186, 16, 12, 't-w');
// 地盤
r(0, 228, 1440, 32, 't-ground'); p('M0,228h1440', 't-gl');

const svg = `<svg class="town-svg" viewBox="0 0 1440 260" preserveAspectRatio="xMidYMax slice" role="img" aria-labelledby="townT" focusable="false"><title id="townT">夜の街並み。一戸建て、マンション、空き地が並び、マンションの窓の明かりが文字の形に灯っている</title>\n${o.join('\n')}\n</svg>`;
const file = path.join(__dirname, '..', 'b-kachi-check', 'index.html');
if (fs.existsSync(file)) {
  let h = fs.readFileSync(file, 'utf8');
  h = h.replace(/<!--TOWN-->[\s\S]*?<!--\/TOWN-->/, `<!--TOWN-->\n${svg}\n<!--/TOWN-->`);
  fs.writeFileSync(file, h);
  console.log('inserted', svg.length, 'bytes');
} else console.log(svg);
