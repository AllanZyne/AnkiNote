export async function loadSettings(db) {
  const row = await db.get('meta', 'settings');
  return row ? row.value : null;
}

export async function saveSettings(db, config) {
  await db.put('meta', { key: 'settings', value: config });
}
