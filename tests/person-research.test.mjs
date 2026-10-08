import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {PERSON_RESEARCH_VERSION,PERSON_UNCERTAIN,resolvePersonTarget,linkedinProfileUrl,normalizeSearchSources,validatePersonProfile,visiblePersonResearch,researchPerson} from '../supabase/functions/signal-layer/person-research.ts';
import {personPillHtml,personProfileBody} from '../person-profile-ui.mjs';
const now=new Date('2026-10-08T12:00:00Z');
const target={articleId:'a',name:'Nina Beispiel',company:'Beispiel AG',role:'CMO',mode:'simple'};
const linkedin='https://www.linkedin.com/in/nina-beispiel';
const sources=[{url:linkedin,title:'Nina Beispiel - Beispiel AG',text:'Nina Beispiel ist aktuell CMO bei Beispiel AG. Ihre Verantwortung umfasst Marke und Customer Experience.',date:null},{url:'https://beispiel.com/news/marke',title:'Nina Beispiel bei Beispiel AG',text:'Nina Beispiel, CMO bei Beispiel AG, stellte am 21. Juli 2026 die neue Markenstrategie des Unternehmens vor.',date:'2026-07-21'}];
const google={identity_unique:true,current_company_match:true,current_role_verified:true,recent_information_found:true,linkedin_url:linkedin,uncertainties:[]};
const raw=()=>({status:'verified',confidence:1,identity_unique:true,current_company_match:true,current_role_verified:true,name:target.name,company:target.company,linkedin_url:linkedin,uncertainties:[],facts:[{kind:'current_role',label:'Aktuelle Rolle',value:'CMO bei Beispiel AG',source_url:linkedin,quote:sources[0].text,verified:true},{kind:'recent_activity',label:'Aktuelle Markenstrategie',value:'Neue Markenstrategie vorgestellt',source_url:sources[1].url,quote:sources[1].text,verified:true}]});
const validate=(r=raw(),g=google,s=sources,urls=[linkedin])=>validatePersonProfile(target,r,g,s,urls,now);
test('official employer management plus a recent interview verifies Frida without Google or a LinkedIn profile',()=>{
 const t={...target,name:'Frida Elisson',company:'Immowelt'};
 const s=[{url:'https://www.immowelt.de/ueberuns/management',title:'immowelt Management',text:'Frida Elisson\n\nChief Marketing Officer',date:null},{url:'https://www.wuv.de/podcast/frida',title:'Immowelt-CMO Frida Elisson',text:'Frida Elisson ist seit Dezember 2025 CMO von Immowelt und dort Teil eines komplett neu aufgesetzten Führungsteams.',date:'2026-07-30'}];
 const r={...raw(),name:t.name,company:t.company,linkedin_url:'',facts:[{kind:'current_role',label:'Aktuelle Rolle',value:'Chief Marketing Officer',source_url:s[0].url,quote:s[0].text,verified:true},{kind:'recent_activity',label:'Interview',value:'Aktuelles Fachinterview',source_url:s[1].url,quote:s[1].text,verified:true}]};
 assert.equal(validatePersonProfile(t,r,null,s,[],now).name,'Frida Elisson');
 assert.throws(()=>validatePersonProfile(t,r,null,s.map((v,i)=>i?{...v,date:'2025-01-01'}:v),[],now),{message:PERSON_UNCERTAIN});
});
test('signal supplies the name/company; arbitrary client targets and roles alone are rejected',()=>{
 const a={id:'a'},s={status:'signal',person_name:target.name,company:target.company,person_role:'CMO'};
 assert.deepEqual(resolvePersonTarget(a,s,target.name,'simple'),target);
 for(const [name,signal]of [['Anderer Name',s],[target.name,{...s,company:null}],[target.name,{...s,status:'rejected'}],['CMO',s]])assert.throws(()=>resolvePersonTarget(a,signal,name,'simple'),{message:PERSON_UNCERTAIN});
 assert.equal(resolvePersonTarget({id:'a',primary_company:'Beispiel AG',classification_status:'reliable',buying_center_candidate:true,person_mentions:[{name:target.name,role:'CMO'}]},null,target.name,'advanced').company,'Beispiel AG');
});
test('LinkedIn URLs must be genuine individual profile URLs, not company/search/spoofed domains',()=>{
 assert.equal(linkedinProfileUrl('https://de.linkedin.com/in/Nina-Beispiel/?trk=x'),linkedin);
 for(const u of ['https://linkedin.com.evil.com/in/nina-beispiel','https://linkedin.com/company/beispiel','https://linkedin.com/search/results/people','http://linkedin.com/in/nina-beispiel','https://user:pass@linkedin.com/in/nina-beispiel'])assert.equal(linkedinProfileUrl(u),'');
});
test('only actual search snippets and source publication dates are normalized',()=>{
 const result=normalizeSearchSources([{url:linkedin,snippet:'Actual text',title:'Nina',last_updated:'2026-10-08'},{url:linkedin,snippet:'duplicate'},{url:'https://a.test',snippet:'',date:'2026-10-08'}]);
 assert.equal(result.length,1);assert.equal(result[0].date,null);
});
test('verified profile needs LinkedIn company evidence, independent Google confirmation, exact quotes and dated recent information',()=>{
 const p=validate();assert.equal(p.name,target.name);assert.equal(p.facts.length,2);assert.equal(Date.parse(p.expires_at)-Date.parse(p.researched_at),86400000);
});
for(const [name,change]of [['wrong company',r=>r.company='Anderes Unternehmen'],['namesake',r=>r.identity_unique=false],['tiny uncertainty',r=>r.uncertainties=['same name possible']],['confidence below absolute',r=>r.confidence=.999],['non-current affiliation',r=>r.current_company_match=false],['future role',r=>r.current_role_verified=false],['invented quote',r=>r.facts[0].quote='Nina Beispiel leitet bereits die gesamte internationale Strategie.'],['invented URL',r=>r.facts[0].source_url='https://fake.test/nina'],['unsupported fact',r=>r.facts[0].verified=false],['private field',r=>r.facts[0].kind='private_contact'],['invented role value',r=>r.facts[0].value='Global Chief Executive Officer'],['no recent facts',r=>r.facts.pop()]])test(name+' fails closed',()=>{const r=raw();change(r);assert.throws(()=>validate(r),{message:PERSON_UNCERTAIN});});
test('old content, future dates, and crawler timestamps cannot establish fresh information',()=>{
 for(const date of ['2025-01-01','2026-12-01',null])assert.throws(()=>validate(raw(),google,sources.map((s,i)=>i?{...s,date,last_updated:'2026-10-08'}:s)),{message:PERSON_UNCERTAIN});
});
test('LinkedIn historical roles without an explicit present marker fail closed',()=>{const historic=sources.map((s,i)=>!i?{...s,text:s.text.replace('aktuell','früher')}:s);const r=raw();r.facts[0].quote=historic[0].text;assert.throws(()=>validate(r,google,historic),{message:PERSON_UNCERTAIN});});

test('Google disagreement, missing grounding, another LinkedIn profile or absence of company in LinkedIn evidence fails closed',()=>{
 for(const g of [{...google,current_company_match:false},{...google,linkedin_url:linkedin+'-other'},{...google,uncertainties:['Maybe']},{...google,recent_information_found:false}])assert.throws(()=>validate(raw(),g),{message:PERSON_UNCERTAIN});
 assert.throws(()=>validate(raw(),google,sources,[]),{message:PERSON_UNCERTAIN});
 assert.throws(()=>validate(raw(),google,sources.map((s,i)=>!i?{...s,text:'Nina Beispiel arbeitet bei anderem Unternehmen.'}:s)),{message:PERSON_UNCERTAIN});
});
test('unverified, expired, wrong-company and stale jobs never expose a profile',()=>{
 const profile=validate(),row={id:'r',person_name:target.name,company:target.company,status:'verified',profile};
 assert.equal(visiblePersonResearch(row,target,now.getTime()).profile.name,target.name);
 for(const variant of [{...row,status:'uncertain'},{...row,company:'Other'},{...row,profile:{...profile,expires_at:'2026-01-01'}},{...row,profile:{...profile,version:'old'}}])assert.equal(visiblePersonResearch(variant,target,now.getTime()).profile,null);
 assert.equal(visiblePersonResearch({status:'running',created_at:'2026-10-08T11:50:00Z'},target,now.getTime()).status,'error');
});
test('research always includes the company and checks employer sources when LinkedIn is absent',async()=>{
 let calls=0;await assert.rejects(()=>researchPerson({stage:async()=>{},search:async input=>{calls++;assert((Array.isArray(input.query)?input.query:[input.query]).every(q=>q.includes(target.name)&&q.includes(target.company)));return {results:[]};},google:()=>{throw Error('must not call')},verify:()=>{throw Error('must not call')}},target),{message:PERSON_UNCERTAIN});assert.equal(calls,2);
});
test('full pipeline independently searches Google and then verifies all facts',async()=>{
 let search=0,verified=0;const stages=[];
 // A deterministic current date source supports this test without real requests.
 const fresh=sources.map((s,i)=>i?{...s,date:new Date().toISOString().slice(0,10)}:s);
 const p=await researchPerson({stage:async s=>stages.push(s),search:async input=>{const queries=Array.isArray(input.query)?input.query:[input.query];assert(queries.every(q=>q.includes(target.name)&&q.includes(target.company)));return {results:[fresh[search++]].map(s=>({...s,snippet:s.text}))};},google:async prompt=>{assert(prompt.includes(target.name)&&prompt.includes(target.company));return {text:JSON.stringify(google),urls:[linkedin],searchQueries:2};},verify:async()=>{verified++;return JSON.stringify(raw());}},target);
 assert.equal(p.name,target.name);assert.equal(search,2);assert.equal(verified,1);assert.deepEqual(stages,['linkedin','aktualitaet','google','gegenpruefung']);
});
test('frontend failure ignores any attached facts; role-only/company-less pills cannot launch research',()=>{
 assert(!personPillHtml({name:'Nina Beispiel',company:''}).includes('data-person-profile'));
 assert(personPillHtml({...target,articleId:'a'}).includes('data-person-profile="Nina Beispiel"'));
 const html=personProfileBody({status:'uncertain',profile:{facts:[{value:'SECRET UNVERIFIED'}]}});assert(html.includes(PERSON_UNCERTAIN));assert(!html.includes('SECRET UNVERIFIED'));
});
test('database and endpoints keep reads free, restrict starts, deduplicate jobs and book every research step',()=>{
 const backend=readFileSync(new URL('../supabase/functions/signal-layer/index.ts',import.meta.url),'utf8');
 assert.match(backend,/"start_person_research",/);
 assert.match(backend,/action === "get_person_profile" \|\| existing\?\.status === "running"/);
 assert.match(backend,/if \(action === "start_person_research"\) await db\.from\("person_researches"\)\.update/);
 assert.match(backend,/person_research_id: assetUsageContext\.getStore\(\)\?\.personResearchId/);
 assert.match(backend,/usd: \.005, toolUsd: \.005/);
 const migration=readFileSync(new URL('../supabase/migrations/20261008141439_person_research.sql',import.meta.url),'utf8');assert.match(migration,/enable row level security/);assert.match(migration,/revoke all.*authenticated/);assert.match(migration,/create unique index person_research_one_running_idx/);assert.match(migration,/status<>'verified' and profile is null/);
});
