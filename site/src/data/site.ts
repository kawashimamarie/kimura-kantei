// 会社・連絡先の基本情報。
// ここに書く内容は、現行公式サイトで確認できた事実に限る（推測で補わない）。

export const site = {
  url: 'https://www.kimurakantei.jp',
  name: '株式会社木村不動産鑑定',
  nameShort: '木村不動産鑑定',
  nameEn: 'Kimura Real Estate Appraisal Co., Ltd.',
  tagline: '不動産鑑定士・一級建築士事務所',
  // 確認用プレビューの間は検索エンジンに登録させない。本番公開時に false にする。
  noindex: true,
};

export const contact = {
  tel: '03-5356-9158',
  telHref: 'tel:0353569158',
  fax: '03-5356-9159',
  email: 'info@kimurakantei.com',
  hours: '10:00〜18:00',
  postalCode: '166-0001',
  address: '東京都杉並区阿佐谷北1丁目3番5号 キリサワビル201号',
  addressRegion: '東京都',
  addressLocality: '杉並区',
  streetAddress: '阿佐谷北1丁目3番5号 キリサワビル201号',
  access: 'JR中央線「阿佐ヶ谷」駅から徒歩1分',
  accessSub: '新宿駅から約10分',
  mapUrl: 'https://www.google.com/maps/search/?api=1&query=%E6%9D%B1%E4%BA%AC%E9%83%BD%E6%9D%89%E4%B8%A6%E5%8C%BA%E9%98%BF%E4%BD%90%E8%B0%B7%E5%8C%971-3-5',
};

export const company = {
  founded: '2011-07-01',
  foundedLabel: '2011年7月1日設立（2006年7月創業）',
  representative: '代表取締役 木村 修',
  licenses: [
    '不動産鑑定業者 東京都知事（3）第2384号',
    '一級建築士事務所 東京都知事登録 第58065号',
    '宅地建物取引業者 東京都知事（3）第96716号',
    '東京都木造住宅耐震診断事務所 第697号',
  ],
  memberships: [
    '公益社団法人 日本不動産鑑定士協会連合会',
    '公益社団法人 東京都不動産鑑定士協会',
    '公益社団法人 全日本不動産協会',
    '中小企業家同友会',
    '東京商工会議所',
  ],
  business: [
    '不動産鑑定評価・不動産仲介・コンサルティング業務',
    '耐震診断・改修設計・耐用年数レポート・耐震リフォーム工事・設計監理業務',
    '建物現況調査（インスペクション）・フラット35適合証明',
  ],
};

/** メインナビゲーション */
export const nav = [
  { href: '/services/', label: 'ご相談内容' },
  { href: '/cases/', label: '事例' },
  { href: '/column/', label: 'コラム' },
  { href: '/profile/', label: '代表紹介' },
  { href: '/about/', label: '会社案内' },
  { href: '/fees/', label: '料金' },
  { href: '/faq/', label: 'よくある質問' },
];
