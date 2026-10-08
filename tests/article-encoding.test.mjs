import assert from 'node:assert/strict';
import test from 'node:test';
import { readResponseText, repairArticleEncoding } from '../supabase/functions/signal-layer/pipeline-core.ts';

test('Latin-1 bytes recover even with a false UTF-8 header', async () => {
  const bytes = Uint8Array.from([...'<meta charset="iso-8859-1">Vorst', 0xe4, ...'ndin'].map(c => typeof c === 'number' ? c : c.charCodeAt(0)));
  const decoded = await readResponseText(new Response(bytes, {headers: {'content-type': 'text/html; charset=utf-8'}}));
  assert.match(decoded, /Vorständin/);
  assert.ok(!decoded.includes('�'));
});

test('valid UTF-8 survives a stale Latin-1 header', async () => {
  assert.equal(await readResponseText(new Response('Ä Ö Ü ä ö ü ß', {headers: {'content-type': 'text/html; charset=iso-8859-1'}})), 'Ä Ö Ü ä ö ü ß');
});

test('reversible mojibake repairs quotes and umlauts without changing intact text', () => {
  assert.equal(repairArticleEncoding('VorstÃ¤ndin â€“ Ã„nderung'), 'Vorständin – Änderung');
  assert.equal(repairArticleEncoding('Änderung – São Paulo?'), 'Änderung – São Paulo?');
  assert.equal(repairArticleEncoding(repairArticleEncoding('VorstÃ¤ndin')), 'Vorständin');
});

test('lost characters require a unique intact word, never guessed replacements', () => {
  assert.equal(repairArticleEncoding('Ergo holt Vorst�ndin', 'Die Vorständin übernimmt das Marketing.'), 'Ergo holt Vorständin');
  assert.equal(repairArticleEncoding('M�ller', 'Müller und Möller'), 'M�ller');
  assert.equal(repairArticleEncoding('F�r wen?', ''), 'F�r wen?');
});

test('lost short words and punctuation recover only with intact source evidence', () => {
  assert.equal(repairArticleEncoding('F�r Marken', 'Für Marken zählt Qualität.'), 'Für Marken');
  assert.equal(repairArticleEncoding('Produkte aus verschiedenen Warengruppen � darunter auch Lebensmittel.', 'Produkte aus verschiedenen Warengruppen – darunter auch Lebensmittel.'), 'Produkte aus verschiedenen Warengruppen – darunter auch Lebensmittel.');
});

test('binary PDF payloads are not handled as article text', () => {
  assert.equal(repairArticleEncoding('%PDF-1.5 Ã¤'), '%PDF-1.5 Ã¤');
});
