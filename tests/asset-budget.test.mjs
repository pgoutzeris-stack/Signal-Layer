import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {billingProvider,balanceVerdict,recentBudgetFailure,conservativeForecast} from '../supabase/functions/signal-layer/asset-budget.ts';
test('memo models use the Perplexity billing account',()=>{
 for(const model of ['anthropic/claude-opus-5-5','openai/gpt-5.4','sonar']) assert.equal(billingProvider(model),'perplexity');
 assert.equal(billingProvider('deepseek-v4-pro'),'deepseek');assert.equal(billingProvider('gemini-2.5-flash-image'),'gemini');
});
test('balance blocks depleted credit, warns on expected shortfall, validates malformed replies',()=>{
 assert.equal(balanceVerdict({is_available:false},1,.14).status,'blocked');
 const data=n=>({is_available:true,balance_infos:[{currency:'USD',total_balance:n}]});
 assert.equal(balanceVerdict(data('0'),1,.14).status,'blocked');
 assert.equal(balanceVerdict(data('.50'),1,.14).status,'warning');
 assert.equal(balanceVerdict(data('2'),1,.14).status,'ok');
 for(const n of ['',null,'invalid',-1]) assert.equal(balanceVerdict(data(n),1,.14).status,'unknown');
 assert.equal(balanceVerdict({},1,.14).status,'unknown');
 assert.equal(balanceVerdict({is_available:true,balance_infos:[{currency:'CNY',total_balance:5}]},1,.14).status,'warning');
 assert.equal(balanceVerdict({is_available:true,balance_infos:[{currency:'CNY',total_balance:5}]},1,NaN).status,'unknown');
});
test('payment failure is account-wide, expires and is cleared by subsequent paid success; rate limit is not empty credit',()=>{
 const now=Date.now(),event=(offset,fields)=>({model:'anthropic/claude-opus-5-5',created_at:new Date(now+offset).toISOString(),status:'error',error_code:'insufficient_balance',...fields});
 assert.equal(recentBudgetFailure([event(-1000,{})],'perplexity',now),true);
 assert.equal(recentBudgetFailure([event(-1000,{})],'gemini',now),false);
 assert.equal(recentBudgetFailure([event(-7*3600000,{})],'perplexity',now),false);
 assert.equal(recentBudgetFailure([event(-1000,{error_code:'http_429',error_message:'rate limit exceeded'})],'perplexity',now),false);
 assert.equal(recentBudgetFailure([event(-2000,{}),event(-1000,{model:'sonar',status:'success',total_tokens:123})],'perplexity',now),false);
 assert.equal(recentBudgetFailure([event(-2000,{}),event(-1000,{status:'success',total_tokens:0})],'perplexity',now),true);
});
test('forecast uses historical p90 with reserve without treating unknown costs as zero',()=>{
 assert.equal(conservativeForecast([],null),null);assert.equal(conservativeForecast([1,2,3],1),4.5);assert.equal(conservativeForecast([1],3),3);
});
test('preflight only reads; backend enforces credit guard before creating an asset',()=>{
 const source=readFileSync(new URL('../supabase/functions/signal-layer/index.ts',import.meta.url),'utf8');
 const helper=source.slice(source.indexOf('async function checkAssetBudget'),source.indexOf('// Renders a Gemini response schema'));
 assert.doesNotMatch(helper,/\.insert\(|\.update\(|callModel\(/);
 assert.match(helper,/api\.deepseek\.com\/user\/balance/);
 const generation=source.slice(source.indexOf('case "generate_asset"'));
 assert(generation.indexOf('checkAssetBudget')<generation.indexOf('.insert({'));
 assert.match(generation,/budget\.blocked \|\| \(budget\.warning && body\.accept_budget_warning !== true\)/);
 const ui=readFileSync(new URL('../asset-studio.js',import.meta.url),'utf8');
 const start=ui.slice(ui.indexOf('async function generate()'),ui.indexOf('async function warteAufAsset'));
 assert(start.indexOf('api("preflight_asset"')<start.indexOf('api("generate_asset"'));
 assert.match(start,/if \(preflightPending \|\| state\.busy\) return/);
});
test('viewport fullscreen hides and restores high-layer signal modals',()=>{
 const ui=readFileSync(new URL('../asset-studio.js',import.meta.url),'utf8');
 assert.match(ui,/#as-overlay\.as-fs-open\{position:fixed; z-index:100030/);
 assert.match(ui,/body\.as-asset-fullscreen #article-detail-modal/);
 assert.match(ui,/classList\.remove\("as-asset-fullscreen"\)/);
});
