export async function scanVault(provider, root = '') {
  const files = [];
  const queue = [root];
  while (queue.length) {
    const dir = queue.shift();
    let entries;
    try { entries = await provider.list(dir); }
    catch { entries = []; }
    for (const e of entries) {
      if (e.type === 'dir') queue.push(e.path);
      else files.push(e);
    }
  }
  return files;
}
