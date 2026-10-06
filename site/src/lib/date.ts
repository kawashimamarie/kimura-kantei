export const isoDate = (d: Date) => d.toISOString().slice(0, 10);
export const formatDate = (d: Date) => `${d.getUTCFullYear()}年${d.getUTCMonth() + 1}月${d.getUTCDate()}日`;
