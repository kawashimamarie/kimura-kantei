// トップ比較案で使う線画アイコン（24×24、stroke のみ）。サービスの slug ごとのパス。装飾なので画面上は aria-hidden で使う。
export const icons: Record<string, string> = {
  appraisal: 'M12 3v18M6 21h12M5 7h14M5 7l-3 7a3 3 0 0 0 6 0zM19 7l-3 7a3 3 0 0 0 6 0z',
  inheritance: 'M3 11l9-7 9 7M5 10v10h14V10M10 20v-6h4v6',
  'family-transaction': 'M4 8h14l-3-3M20 16H6l3 3',
  rent: 'M6 3h9l4 4v14H6zM15 3v4h4M9 12h6M9 16h6',
  eviction: 'M10 4H5v16h5M14 8l4 4-4 4M18 12H9',
  seismic: 'M5 21V9l7-5 7 5v12M5 21h14M12 9l-2 4 3 2-2 4',
  building: 'M4 21V7l8-4 8 4v14M4 21h16M9 21v-5h6v5M9 10h2M13 10h2',
  deal: 'M3 12l5-5 4 3 4-3 5 5M8 7v9M16 7v9M3 16h18',
  phone: 'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2',
  doc: 'M6 3h9l4 4v14H6zM15 3v4h4M9 12h6M9 16h6',
  badge: 'M12 3l2.5 2.2 3.3-.2.9 3.2 2.8 1.8-1.2 3.1 1.2 3.1-2.8 1.8-.9 3.2-3.3-.2L12 21l-2.5-2.2-3.3.2-.9-3.2L2.5 14l1.2-3.1L2.5 7.8l2.8-1.8.9-3.2 3.3.2zM9 12l2 2 4-4',
};
