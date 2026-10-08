import test from 'node:test';
import assert from 'node:assert/strict';
import { removeDuplicateMemoPhotos, similarPixels } from '../memo-image-identity.mjs';
import { ROOTS_MEMO_LOGO } from '../roots-logo.mjs';

test('same photograph cannot fill two recommendation tiles, logos remain reusable', async () => {
  const memo = { potentials: [{image:{src:'photo'}},{image:{src:'photo'}}], benchmarks:[{image:{src:'photo'}}] };
  assert.equal(await removeDuplicateMemoPhotos(memo, async () => null), 1);
  assert.equal(memo.potentials[1].image.src, '');
  assert.equal(memo.benchmarks[0].image.src, 'photo');
});
test('compression copies are detected; different photos and flat backgrounds survive', async () => {
  const a = Array.from({length:1728},(_,i)=>i%256), b = a.map(v=>Math.min(255,v+2));
  assert.ok(similarPixels(a,b));
  assert.ok(!similarPixels(a,a.map(v=>255-v)));
  assert.ok(!similarPixels(Array(1728).fill(255),Array(1728).fill(255)));
  const memo={potentials:[{image:{src:'a'}},{image:{src:'b'}},{image:{src:'c'}}]};
  assert.equal(await removeDuplicateMemoPhotos(memo,async src=>src==='a'?a:src==='b'?b:a.map(v=>255-v)),1);
  assert.equal(memo.potentials[2].image.src,'c');
});
test('the official black logo includes its subtitle without an opacity mask', () => {
  assert.match(ROOTS_MEMO_LOGO,/viewBox="0 0 402.6 95"/);
  assert.match(ROOTS_MEMO_LOGO,/fill="#0E0E09"/);
  assert.doesNotMatch(ROOTS_MEMO_LOGO,/<mask|opacity=/);
});
