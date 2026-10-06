// サービス（ご相談内容）の一覧。
// ページを持つサービスは slug を持ち、/services/{slug}/ に対応する。
// relatedFaq / relatedCases / relatedColumns で、各ページの「関連」欄を自動で組み立てる。

export type Service = {
  slug: string;
  name: string; // カード・パンくず用の短い名前
  group: 'price' | 'building';
  summary: string; // 一覧カード用の説明
  concerns: string[]; // 相談者の言葉
  flowExample: string; // 「ご相談の流れ」で示す、最初のひと言の例
  relatedFaq: string[];
  relatedCases: string[];
  relatedColumns: string[];
};

export const services: Service[] = [
  {
    slug: 'appraisal',
    name: '不動産鑑定・評価',
    group: 'price',
    summary: '不動産鑑定士が、不動産の適正な価格・賃料を調べ、根拠とともに書面にまとめます。鑑定評価書・意見書の違いや、使われる場面もご案内します。',
    concerns: ['不動産会社の査定だけで大丈夫か不安', '第三者に説明できる価格の根拠がほしい', '銀行の担保評価が思ったより低い'],
    flowExample: '所有している土地の適正な価値を知りたい',
    relatedFaq: ['fee', 'nationwide'],
    relatedCases: [],
    relatedColumns: [],
  },
  {
    slug: 'inheritance',
    name: '相続・遺産分割',
    group: 'price',
    summary: '相続した不動産をどう評価し、どう分けるか。遺産分割の話し合いに、客観的な立場からの評価と助言をお届けします。',
    concerns: ['相続した実家や土地を、兄弟で公平に分けたい', '相続前に、子どもにどう配分するか考えておきたい', '古い建物の評価額に納得がいかない'],
    flowExample: '相続した実家を兄弟で公平に分ける方法を相談したい',
    relatedFaq: ['lawyer-tax', 'confidential'],
    relatedCases: ['suginami-rental'],
    relatedColumns: [],
  },
  {
    slug: 'family-transaction',
    name: '親族間・同族間の売買',
    group: 'price',
    summary: '親子・親族の間や、会社と代表者の間で不動産を売買するとき。適正な時価を鑑定評価書でお示しし、契約や融資のご相談までまとめてお手伝いします。',
    concerns: ['親から子へ、子から親へ不動産を売りたい', 'この売買価格で問題ないのか確かめたい', '自分の会社と個人の間で不動産を売買したい'],
    flowExample: '子どもに売る土地の価格が適正か確かめたい',
    relatedFaq: ['report-types', 'fee'],
    relatedCases: [],
    relatedColumns: [],
  },
  {
    slug: 'rent',
    name: '地代・家賃・借地',
    group: 'price',
    summary: '地代や家賃の値上げ・値下げ、借地権・底地・更新料の評価。交渉や調停で説明できる「根拠」を不動産鑑定士が作成します。',
    concerns: ['地代や家賃の値上げ（値下げ）を求められた・求めたい', '今の家賃が適正なのかわからない', '借地や底地をこの先どうするか決めたい'],
    flowExample: 'いまの地代が相場に合っているか確かめたい',
    relatedFaq: ['satei-vs-kantei', 'lawyer-tax'],
    relatedCases: ['nakano-apartment', 'suginami-rental'],
    relatedColumns: [],
  },
  {
    slug: 'eviction',
    name: '立退料',
    group: 'price',
    summary: 'オーナー側・借家人側どちらの立場でも。立退料の目安や鑑定評価で、交渉・調停・裁判を支えます。',
    concerns: ['立退きの話が出ている', '提示された立退料が妥当なのか知りたい', '建替えのために立退きをお願いしたい'],
    flowExample: '提示された立退料が妥当か相談したい',
    relatedFaq: ['consult-only', 'confidential'],
    relatedCases: [],
    relatedColumns: [],
  },
  {
    slug: 'seismic',
    name: '耐震診断・耐震改修',
    group: 'building',
    summary: '一級建築士が木造住宅の耐震診断から改修設計・工事までを担当。区の助成金の申請もサポートします。インスペクションやフラット35適合証明にも対応します。',
    concerns: ['古い家の耐震性が心配', '耐震診断や改修に助成金が使えるか知りたい', '中古住宅を売る前・買う前に建物の状態を確かめたい'],
    flowExample: '古い木造住宅の耐震性を調べてほしい',
    relatedFaq: ['remote', 'consult-only'],
    relatedCases: ['suginami-taishin', 'nakano-apartment', 'suginami-rental'],
    relatedColumns: ['seismic-standards-history'],
  },
];

export const getService = (slug: string) => {
  const s = services.find((x) => x.slug === slug);
  if (!s) throw new Error(`Unknown service: ${slug}`);
  return s;
};

/** 専用ページはまだないが、対応しているご相談（現行サイトに記載あり） */
export const otherServices = [
  { name: '売却・購入のサポート', text: '宅地建物取引士による査定に、不動産鑑定士・一級建築士の助言を添えて売却・買い替えを進めます。気になる物件への同行や調査報告書の作成にも対応します。' },
  { name: '海外不動産', text: '中国・韓国・香港・台湾の不動産鑑定事務所と業務提携し、海外不動産の評価や市場調査に対応します。鑑定書・建物調査報告書の翻訳（英語・中国語・韓国語）も承ります。' },
];
