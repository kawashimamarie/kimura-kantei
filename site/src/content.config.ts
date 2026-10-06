// 事例・コラムのデータ構造。
// ここでスキーマを定義しておくことで、記事や事例を追加するときに
// 必須項目（公開日・執筆者・関連サービスなど）の書き忘れをビルド時に検出できる。
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const serviceSlug = z.enum(['appraisal', 'inheritance', 'family-transaction', 'rent', 'eviction', 'seismic']);

const image = z.object({
  src: z.string(), // public/ からのパス（例：/assets/img/cases/xxx.jpg）
  alt: z.string(),
  width: z.number(),
  height: z.number(),
  caption: z.string().optional(),
});

const cases = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/cases' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    meta: z.string(), // 地域・建物の種類など（番地・建物名は書かない）
    tags: z.array(z.string()),
    order: z.number(), // 一覧の並び順
    services: z.array(serviceSlug).min(1),
    relatedColumns: z.array(z.string()).default([]),
    cover: image,
    gallery: z.array(image).default([]),
    // 4項目の要約（一覧・トップのカード用）
    summary: z.object({
      consult: z.string(),
      issue: z.string(),
      approach: z.string(),
      result: z.string(),
    }),
    sourceUrl: z.string().url().optional(), // 現行サイトでの掲載元（旧URLの対応管理用）
  }),
});

const column = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/column' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    category: z.string(),
    publishedAt: z.coerce.date(),
    updatedAt: z.coerce.date(),
    // 執筆者。木村修本人の執筆・監修が確認できた記事だけ 'kimura' にする。
    author: z.enum(['organization', 'kimura']),
    points: z.array(z.string()).min(1), // 記事冒頭の「この記事の要点」
    services: z.array(serviceSlug).default([]),
    relatedFaq: z.array(z.string()).default([]),
    relatedCases: z.array(z.string()).default([]),
    sources: z
      .array(z.object({ title: z.string(), publisher: z.string(), url: z.string().url().optional() }))
      .default([]),
    originalUrl: z.string().url().optional(), // 現行サイトでの初出（旧URLの対応管理用）
  }),
});

export const collections = { cases, column };
