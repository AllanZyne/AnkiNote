async function req(url, opts) {
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error(`${opts?.method || 'GET'} ${url} -> ${res.status}`);
  if (res.status === 204) return undefined;
  return res.json();
}
const json = (method, body) => ({
  method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});

export const api = {
  listBoxes: () => req('/api/boxes'),
  createBox: (b) => req('/api/boxes', json('POST', b)),
  renameBox: (id, name) => req(`/api/boxes/${id}`, json('PATCH', { name })),
  deleteBox: (id) => req(`/api/boxes/${id}`, { method: 'DELETE' }),

  listNoteTypes: () => req('/api/note-types'),
  getNoteType: (id) => req(`/api/note-types/${id}`),
  createNoteType: (nt) => req('/api/note-types', json('POST', nt)),
  updateNoteType: (id, nt) => req(`/api/note-types/${id}`, json('PUT', nt)),
  deleteNoteType: (id) => req(`/api/note-types/${id}`, { method: 'DELETE' }),

  listNotesInBox: (boxId) => req(`/api/notes?box=${boxId}`),
  searchNotes: (q) => req(`/api/notes?q=${encodeURIComponent(q)}`),
  getNote: (id) => req(`/api/notes/${id}`),
  createNote: (n) => req('/api/notes', json('POST', n)),
  updateNote: (id, n) => req(`/api/notes/${id}`, json('PUT', n)),
  deleteNote: (id) => req(`/api/notes/${id}`, { method: 'DELETE' }),
};
