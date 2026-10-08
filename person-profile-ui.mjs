import { confirmAssetBudget } from './asset-budget-ui.mjs?v=20261008-6';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const PERSON_FAILURE='Person nicht zweifelsfrei recherchierbar – bitte manuell prüfen';
export function personPillHtml({name,role='',company='',articleId='',mode='simple',candidate=true}) {
  if(!name)return '';
  const clickable=Boolean(candidate&&company&&articleId);
  return `<span class="tag tag--person${clickable?' tag--person-action':''}" ${clickable?`data-person-profile="${esc(name)}" data-person-company="${esc(company)}" data-person-article="${esc(articleId)}" data-person-mode="${esc(mode)}" role="button"`:''} data-pill-info="${esc(clickable?'Personen-Steckbrief öffnen':'Einstufung: Person')}${role?` · ${esc(role)}`:''}" tabindex="0"><i class="fa-solid fa-user"></i> ${esc(name)}${clickable?'<i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i>':''}</span>`;
}
const stages={start:'Recherche wird vorbereitet',linkedin:'LinkedIn und Unternehmenszugehörigkeit',aktualitaet:'Aktuelle Informationen und mögliche Rollenwechsel',google:'Unabhängige Google-Recherche',gegenpruefung:'Identität und einzelne Fakten gegenprüfen'};
function safeLink(value) { try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password?u.href:'';}catch{return '';} }
export function personProfileBody(row) {
  if(row.status==='running')return `<div class="cp-state" role="status"><div class="roots-loader"></div><p>${esc(stages[row.stage]||'Recherche läuft')}</p></div>`;
  if(row.status==='verified'&&row.profile&&Date.parse(row.profile.expires_at)>Date.now()) {
    const p=row.profile;
    return `<div class="pr-status"><i class="fa-solid fa-shield-halved"></i> Identität und aktuelle Unternehmenszugehörigkeit geprüft · Stand ${esc(new Date(p.researched_at).toLocaleString('de-DE'))}</div>
      ${safeLink(p.linkedin_url)?`<a class="cp-pill" href="${esc(safeLink(p.linkedin_url))}" target="_blank" rel="noopener noreferrer"><i class="fa-brands fa-linkedin"></i> LinkedIn-Profil öffnen</a>`:''}
      <div class="pr-facts">${(p.facts||[]).map(f=>`<article><h3>${esc(f.label)}</h3><p>${esc(f.value)}</p><details><summary>Quellenbeleg${f.date?` · ${esc(new Date(f.date).toLocaleDateString('de-DE'))}`:''}</summary><blockquote>${esc(f.quote)}</blockquote>${safeLink(f.source_url)?`<a href="${esc(safeLink(f.source_url))}" target="_blank" rel="noopener noreferrer">${esc(f.source_title||'Quelle öffnen')} <i class="fa-solid fa-arrow-up-right-from-square"></i></a>`:''}</details></article>`).join('')}</div>`;
  }
  if(['uncertain','error'].includes(row.status))return `<div class="pr-error" role="alert"><i class="fa-solid fa-triangle-exclamation"></i><p>${PERSON_FAILURE}</p></div>`;
  if(row.status==='expired'||row.status==='verified')return '<div class="cp-state">Der gespeicherte Recherche-Stand ist abgelaufen. Bitte erneut recherchieren.</div>';
  return '<div class="cp-state">Noch kein recherchierter Personen-Steckbrief vorhanden.</div>';
}
export function installPersonProfiles({callApi,doc=document}) {
  let host=null,target=null,sequence=0,timer=null,starting=false,lastRow={status:"empty"};
  function close(){sequence++;clearTimeout(timer);host?.remove();host=null;starting=false;}
  function render(row={status:'empty'}) {
    if(!host)return;
    lastRow=row;
    const busy=starting||row.status==='running';
    host.innerHTML=`<div class="cp-card pr-card" role="dialog" aria-modal="true" aria-labelledby="pr-title"><header class="cp-head"><div class="cp-head-main"><span class="cp-eyebrow"><i class="fa-solid fa-user-tie"></i> Buying Center · Personen-Steckbrief</span><h2 id="pr-title">${esc(target.name)}</h2><p class="cp-head-sub">${esc(target.company)}</p></div><button type="button" class="cp-close" data-person-close aria-label="Schließen"><i class="fa-solid fa-xmark"></i></button></header><div class="cp-body">${personProfileBody(row)}<div class="pr-actions"><button class="cp-pill cp-pill--action" data-person-start ${busy?'disabled':''}><i class="fa-solid ${busy?'fa-spinner fa-spin':'fa-magnifying-glass'}"></i> ${starting?'Guthaben wird geprüft …':row.status==='running'?'Recherche läuft':row.status==='verified'?'Erneut recherchieren':'Recherche manuell starten'}</button><small>Öffentliche berufliche Informationen · LinkedIn, Perplexity und unabhängige Google-Prüfung. Die Recherche verbraucht KI-Budget.</small></div></div></div>`;
  }
  function args(){return {article_id:target.articleId,person_name:target.name,mode:target.mode};}
  async function load(token) {
    try {
      const row=await callApi('get_person_profile',args());
      if(token!==sequence||!host)return;
      render(row);
      if(row.status==='running')timer=setTimeout(()=>load(token),1500);
    }catch{if(token===sequence&&host)render({status:'error'});}
  }
  async function open(pill) {
    close();target={articleId:pill.dataset.personArticle,name:pill.dataset.personProfile,company:pill.dataset.personCompany,mode:pill.dataset.personMode};
    const token=sequence;
    host=doc.createElement('div');host.className='cp-overlay pr-overlay open';host.id='person-profile-overlay';doc.body.append(host);
    host.addEventListener('click',e=>{if(e.target===host||e.target.closest('[data-person-close]'))close();else if(e.target.closest('[data-person-start]'))void start();});
    render({status:'running',stage:'start'});await load(token);
    if(host)host.querySelector('[data-person-close]')?.focus();
  }
  async function start() {
    if(starting||!host)return;
    starting=true;const token=sequence;clearTimeout(timer);render(lastRow);
    let accept=false;
    try {
      const budget=await callApi('preflight_person_research',args());
      if(token!==sequence||!host)return;
      if(budget.status==='uncertain'){render({status:'uncertain'});return;}
      if(budget.warning||budget.blocked){accept=await confirmAssetBudget(budget,host);if(!accept)return;}
      if(token!==sequence||!host)return;
      const row=await callApi('start_person_research',{...args(),accept_budget_warning:accept});
      if(token!==sequence||!host)return;
      if(row.blocked==='provider_budget'){await confirmAssetBudget({...row.preflight,blocked:true},host);return;}
      starting=false;render(row);if(row.status==='running')timer=setTimeout(()=>load(token),1500);
    }catch{if(token===sequence&&host)render({status:'error'});}
    finally{if(token===sequence&&host){starting=false;render(lastRow);}}
  }
  const click=e=>{const pill=e.target.closest('[data-person-profile]');if(!pill)return;e.preventDefault();e.stopImmediatePropagation();void open(pill);};
  const keys=e=>{
    if(host&&e.key==='Escape'){
      if(host.querySelector('.as-budget-dialog[open]')){e.preventDefault();e.stopImmediatePropagation();host.querySelector('.as-budget-dialog').dispatchEvent(new Event('cancel',{cancelable:true}));return;}
      e.preventDefault();e.stopImmediatePropagation();close();return;
    }
    if(host?.querySelector('.as-budget-dialog[open]'))return;
    if(['Enter',' '].includes(e.key)&&e.target.matches('[data-person-profile]')){e.preventDefault();e.stopImmediatePropagation();void open(e.target);}
    if(host&&e.key==='Tab'){
      const items=[...host.querySelectorAll('button:not([disabled]),a[href],summary')].filter(el=>el.getClientRects().length);const first=items[0],last=items.at(-1);
      if(e.shiftKey&&doc.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&doc.activeElement===last){e.preventDefault();first?.focus();}
    }
  };
  doc.addEventListener('click',click,true);doc.defaultView.addEventListener('keydown',keys,true);
  return {close,destroy(){close();doc.removeEventListener('click',click,true);doc.defaultView.removeEventListener('keydown',keys,true);}};
}
