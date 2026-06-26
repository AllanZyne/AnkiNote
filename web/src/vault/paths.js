export const ANKINOTE_DIR = '.ankinote';
export const DECKS_PATH = '.ankinote/decks.json';
export const INDEX_PATH = '.ankinote/index.json';
export const SETTINGS_PATH = '.ankinote/settings.json';

export function deckPathToDir(deckPath) {
  if (!deckPath) return '';
  return deckPath.split('::').join('/');
}

export function dirToDeckPath(dir) {
  if (!dir) return '';
  return dir.split('/').join('::');
}

export function noteFilePath(deckPath, id) {
  const dir = deckPathToDir(deckPath);
  return dir ? `${dir}/${id}.md` : `${id}.md`;
}

export function noteTypePath(name) {
  return `${ANKINOTE_DIR}/note-types/${name}.md`;
}

export function isAnkinotePath(path) {
  return path === ANKINOTE_DIR || path.startsWith(ANKINOTE_DIR + '/');
}
