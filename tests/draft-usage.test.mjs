import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { assetUsageSummary } from '../supabase/functions/signal-layer/asset-usage.ts';
import { draftMetadataHtml, draftCost, draftTokens } from '../draft-usage.mjs';
const event = (extra = {}) => ({step:'entwurf',model:'claude',status:'success',input_tokens:100,cached_input_tokens:40,output_tokens:20,thinking_tokens:10,total_tokens:130,estimated_cost_eur:.006,estimated_cost_usd:.007,pricing_version:'provider-reported',...extra});
test('ledger totals include all steps, models and consumed failed attempts without double-counting cache',()=>{
 const summary=assetUsageSummary([event(),event({step:'kritik',status:'error'}),event({step:'bildsuche',model:'sonar',estimated_cost_eur:.004})]);
 assert.equal(summary.total_tokens,390);assert.equal(summary.cost_eur,.016);assert.equal(summary.steps.length,3);assert.equal(summary.steps[1].calls_error,1);
 assert.equal(summary.steps[0].input_tokens,100);assert.equal(summary.steps[0].cached_input_tokens,40);
});
test('same step/model aggregates calls while mixed price sources remain identified',()=>{
 const summary=assetUsageSummary([event(),event({pricing_version:'official'})]);assert.equal(summary.steps.length,1);assert.equal(summary.steps[0].calls,2);assert.equal(summary.steps[0].total_tokens,260);assert.equal(summary.steps[0].cost_reported_by_provider,false);
});
test('display rounds only at presentation: EUR two decimals and tokens integers',()=>{
 assert.equal(draftCost(.016),'0,02 €');assert.equal(draftCost(0),'0,00 €');assert.equal(draftTokens(187901),'187.901');assert.equal(draftTokens(100.2),'100');
 const row={id:'test',creator_name:'Test Person',total_tokens:130,cost_eur:.006,usage_summary:assetUsageSummary([event(),event({step:'marktrecherche'})])};
 const html=draftMetadataHtml(row,{when:'08.10., 12:00',duration:'2 Min'});assert.match(html,/260 Token/);assert.match(html,/0,01 €/);assert.match(html,/Marktrecherche/);assert.match(html,/davon Cache 40/);assert.match(html,/popover="manual"/);assert.match(html,/fa-user/);assert.match(html,/fa-calendar-days/);assert.match(html,/fa-stopwatch/);
});
test('legacy counters remain visible and missing details are explicit, all strings escaped',()=>{
 const html=draftMetadataHtml({id:'old',creator_name:'<script>',total_tokens:999,cost_eur:.23});assert.match(html,/999 Token/);assert.match(html,/0,23 €/);assert.match(html,/keine Aufschlüsselung/);assert.doesNotMatch(html,/<script>/);
});
test('API pages ledger and preserves historical links without guessing research attribution',()=>{
 const edge=readFileSync(new URL('../supabase/functions/signal-layer/index.ts',import.meta.url),'utf8');assert.match(edge,/range\(offset, offset \+ 999\)/);assert.match(edge,/usage_summary: usageByAsset/);assert.match(edge,/source: "legacy_ledger"/);
 const writer=edge.slice(edge.indexOf('async function recordStandaloneAiUsage('),edge.indexOf('async function pricedSimpleModelCatalog('));assert.match(writer,/pricing_version: "provider-reported"/);assert.match(writer,/\.\.\.costs, \.\.\.grounding/);
});
