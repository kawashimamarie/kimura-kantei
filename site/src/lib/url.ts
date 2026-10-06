import { site } from '../data/site';

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

/** サイト内リンク・アセットのパスを返す（"/services/" → base 付きのパス） */
export const u = (path: string) => BASE + path;

/** 本番ドメインでの絶対 URL（canonical・OGP・構造化データ用） */
export const abs = (path: string) => new URL(path, site.url).href;
