export async function createStarterVault(repo) {
  const existing = await repo.listNoteTypes();
  if (existing.length > 0) return;
  const basic = await repo.createNoteType({
    name: 'Basic', css: '.card { font-size: 22px; text-align: center; }\nhr { margin: 16px 0; }',
    fields: [{ name: 'Front' }, { name: 'Back' }],
    templates: [{ name: 'Card 1', frontHtml: '{{Front}}', backHtml: '{{Front}}\n<hr>\n{{Back}}' }],
  });
  const spanish = await repo.createDeck({ name: 'Spanish' });
  await repo.createDeck({ name: 'Spanish::Verbs' });
  const math = await repo.createDeck({ name: 'Math' });
  await repo.createNote({ noteTypeId: basic.id, deckId: spanish.id, values: { Front: '**hola**', Back: 'hello' } });
  const verbs = (await repo.listDecks()).find(d => d.name === 'Spanish::Verbs');
  await repo.createNote({ noteTypeId: basic.id, deckId: verbs.id, values: { Front: 'comer', Back: 'to eat' } });
  await repo.createNote({ noteTypeId: basic.id, deckId: math.id, values: { Front: 'Area of a circle of radius $r$?', Back: '$$A = \\pi r^2$$' } });
}
