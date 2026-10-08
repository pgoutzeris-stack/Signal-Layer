import test from 'node:test';
import assert from 'node:assert/strict';
import {matchesDropdownSearch} from '../dropdown-search.mjs';

test('dropdown search matches German names and multiple words',()=>{
  assert.equal(matchesDropdownSearch('Müller Milch Deutschland','muller deutsch'),true);
  assert.equal(matchesDropdownSearch('Straße & Partner','strasse'),true);
  assert.equal(matchesDropdownSearch('Customer Insights','insights customer'),true);
  assert.equal(matchesDropdownSearch('New Business','marken'),false);
  assert.equal(matchesDropdownSearch('Alle Quellen','   '),true);
});
