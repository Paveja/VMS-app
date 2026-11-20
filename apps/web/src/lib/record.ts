export const displayField = (key: string, value: unknown) =>
  value !== null &&
  !['id', 'image_key', 'active'].includes(key) &&
  !key.endsWith('_id') &&
  typeof value !== 'object';
