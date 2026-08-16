// Executive Memo, drei A4-Seiten. Markup und CSS stammen aus dem Desktop-
// Dokument ROOTS_*_Executive-Memo_v6; Inhalte sind Platzhalter. Die Form
// ist fest: Deckblatt, Marktdynamik + Benchmarks, Potenziale + CTA.

const ICO_ARROW = `<svg class="em-ico" viewBox="0 0 448 512" aria-hidden="true"><path d="M438.6 278.6c12.5-12.5 12.5-32.8 0-45.3l-160-160c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L338.8 224 32 224c-17.7 0-32 14.3-32 32s14.3 32 32 32l306.7 0L233.4 393.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0l160-160z" fill="currentColor"/></svg>`;
const ICO_FIND = `<svg class="em-ico" viewBox="0 0 512 512" aria-hidden="true"><path d="M416 208c0 45.9-14.9 88.3-40 122.7L502.6 457.4c12.5 12.5 12.5 32.8 0 45.3s-32.8 12.5-45.3 0L330.7 376c-34.4 25.2-76.8 40-122.7 40C93.1 416 0 322.9 0 208S93.1 0 208 0S416 93.1 416 208zM208 352a144 144 0 1 0 0-288 144 144 0 1 0 0 288z" fill="#8899a6"/></svg>`;
const ICO_POT = `<svg class="em-ico" viewBox="0 0 384 512" aria-hidden="true"><path d="M272 384c9.6-31.9 29.5-59.1 49.2-86.2c5.2-7.1 10.4-14.2 15.4-21.4c19.8-28.5 31.4-63 31.4-100.3C368 78.8 289.2 0 192 0S16 78.8 16 176c0 37.3 11.6 71.9 31.4 100.3c5 7.2 10.2 14.3 15.4 21.4c19.8 27.1 39.7 54.4 49.2 86.2H272zM192 512c44.2 0 80-35.8 80-80V416H112v16c0 44.2 35.8 80 80 80z" fill="#206efb"/></svg>`;
const ICO_WEB = `<svg class="em-ico" viewBox="0 0 512 512" aria-hidden="true"><path d="M352 256c0 22.2-1.2 43.6-3.3 64H163.3c-2.2-20.4-3.3-41.8-3.3-64s1.2-43.6 3.3-64H348.7c2.2 20.4 3.3 41.8 3.3 64zm28.8-64H503.9c5.3 20.5 8.1 41.9 8.1 64s-2.8 43.5-8.1 64H380.8c2.1-20.6 3.2-42 3.2-64s-1.1-43.4-3.2-64zm112.6-32H376.7c-10-63.9-29.8-117.4-55.3-151.6c78.3 20.7 142 77.5 171.9 151.6zm-149.1 0H167.7c6.1-36.4 15.5-68.6 27-94.7c10.5-23.6 22.2-40.7 33.5-51.5C239.4 3.2 248.7 0 256 0s16.6 3.2 27.8 13.8c11.3 10.8 23 27.9 33.5 51.5c11.6 26 20.9 58.2 27 94.7zm-209 0H18.6C48.6 85.9 112.2 29.1 190.6 8.4C165.1 42.6 145.3 96.1 135.3 160zM8.1 192H131.2c-2.1 20.6-3.2 42-3.2 64s1.1 43.4 3.2 64H8.1C2.8 299.5 0 278.1 0 256s2.8-43.5 8.1-64zM194.7 446.6c-11.6-26-20.9-58.2-27-94.6H344.3c-6.1 36.4-15.5 68.6-27 94.6c-10.5 23.6-22.2 40.7-33.5 51.5C272.6 508.8 263.3 512 256 512s-16.6-3.2-27.8-13.8c-11.3-10.8-23-27.9-33.5-51.5zM135.3 352c10 63.9 29.8 117.4 55.3 151.6C112.2 482.9 48.6 426.1 18.6 352H135.3zm358.1 0c-30 74.1-93.6 130.9-171.9 151.6c25.5-34.2 45.2-87.7 55.3-151.6H493.4z" fill="#6ea3ff"/></svg>`;
const ICO_MAIL = `<svg class="em-ico" viewBox="0 0 512 512" aria-hidden="true"><path d="M48 64C21.5 64 0 85.5 0 112c0 15.1 7.1 29.3 19.2 38.4L236.8 313.6c11.4 8.5 27 8.5 38.4 0L492.8 150.4c12.1-9.1 19.2-23.3 19.2-38.4c0-26.5-21.5-48-48-48L48 64zM0 176L0 384c0 35.3 28.7 64 64 64l384 0c35.3 0 64-28.7 64-64l0-208L294.4 339.2c-22.8 17.1-54 17.1-76.8 0L0 176z" fill="#6ea3ff"/></svg>`;
const ICO_PHONE = `<svg class="em-ico" viewBox="0 0 512 512" aria-hidden="true"><path d="M164.9 24.6c-7.7-18.6-28-28.5-47.4-23.2l-88 24C12.1 30.2 0 46 0 64C0 311.4 200.6 512 448 512c18 0 33.8-12.1 38.6-29.5l24-88c5.3-19.4-4.6-39.7-23.2-47.4l-96-40c-16.3-6.8-35.2-2.1-46.3 11.6L304.7 368C234.3 334.7 177.3 277.7 144 207.3L193.3 167c13.7-11.2 18.4-30 11.6-46.3l-40-96z" fill="#6ea3ff"/></svg>`;
const ICO_PIN = `<svg class="em-ico" viewBox="0 0 384 512" aria-hidden="true"><path d="M215.7 499.2C267 435 384 279.4 384 192C384 86 298 0 192 0S0 86 0 192c0 87.4 117 243 168.3 307.2c12.3 15.3 35.1 15.3 47.4 0zM192 128a64 64 0 1 1 0 128 64 64 0 1 1 0-128z" fill="#6ea3ff"/></svg>`;

function kpi(i) {
  return `<div class="em-kpi">
    <div class="n" data-field="kpis.${i}.value">{{kpi${i + 1}_value}}</div>
    <div class="l" data-field="kpis.${i}.label">{{kpi${i + 1}_label}}</div>
  </div>`;
}

function benchmark(i) {
  return `<div class="em-bm">
    <div class="em-shot" data-imgslot data-imgkey="benchmarks.${i - 1}">
      <img data-imgsrc data-imgkey="benchmarks.${i - 1}" src="{{bm${i}_image}}" alt="" style="object-position:{{bm${i}_pos}}">
      <span class="em-shot-hint" data-field="benchmarks.${i - 1}.image_hint">{{bm${i}_hint}}</span>
    </div>
    <div>
      <p><b data-field="benchmarks.${i - 1}.name">{{bm${i}_name}}</b> <span data-field="benchmarks.${i - 1}.text">{{bm${i}_text}}</span></p>
      <span class="em-tag">${ICO_ARROW}<span data-field="benchmarks.${i - 1}.tag">{{bm${i}_tag}}</span></span>
    </div>
  </div>`;
}

function potential(i) {
  return `<div class="em-pot">
    <div>
      <div class="em-pot-hd"><span class="em-pnum">${i}</span><h3 data-field="potentials.${i - 1}.title">{{pot${i}_title}}</h3></div>
      <div class="em-row em-row-bef">${ICO_FIND}<div><p class="k">Befund</p><p data-field="potentials.${i - 1}.finding">{{pot${i}_finding}}</p></div></div>
      <div class="em-row em-row-pot">${ICO_POT}<div><p class="k">Potenzial</p><p data-field="potentials.${i - 1}.potential">{{pot${i}_potential}}</p></div></div>
    </div>
    <div class="em-shot" data-imgslot data-imgkey="potentials.${i - 1}">
      <img data-imgsrc data-imgkey="potentials.${i - 1}" src="{{pot${i}_image}}" alt="" style="object-position:{{pot${i}_pos}}">
      <span class="em-shot-hint" data-field="potentials.${i - 1}.image_hint">{{pot${i}_hint}}</span>
    </div>
  </div>`;
}

export const MEMO_TEMPLATE_CSS = `
.as-stage--memo{
  --brand:#206efb; --brand-dark:#165fd9; --brand-light:#eff6ff;
  --ink:#0f172a; --muted:#475569; --extra-muted:#8899a6;
  --bg:#ffffff; --line:#e2e8f0; --status-bg:#f8fafc; --navy:#0b1f45;
  width:210mm; height:891mm; background:#eef2f7; color:var(--ink);
  font-family:'Circular Std', system-ui, -apple-system, sans-serif;
  font-variant-numeric:tabular-nums; -webkit-font-smoothing:antialiased;
  position:relative; overflow:hidden;
}
.as-stage--memo *{box-sizing:border-box;}
.as-stage--memo .em-page{
  width:210mm; height:297mm; padding:17mm 16mm 16mm;
  background:var(--bg); position:relative; display:flex; flex-direction:column; overflow:hidden;
}
.as-stage--memo .em-ico{display:block; flex:0 0 auto;}
.as-stage--memo .em-logo{width:118px; height:auto; display:block; margin-left:auto;}
.as-stage--memo .em-sub{width:118px; margin-left:auto; margin-top:4px; font-size:5.9px; font-weight:400;
  text-transform:uppercase; color:var(--extra-muted); text-align:left; letter-spacing:0.97px; text-indent:-0.8px; white-space:nowrap;}
.as-stage--memo .em-cover{background:var(--navy); padding:17mm 16mm;}
.as-stage--memo .em-cover-top{display:flex; justify-content:space-between; align-items:flex-start;}
.as-stage--memo .em-claim{font-size:13px; font-weight:700; line-height:1.35; color:#5a9bff; margin:0; max-width:70mm;}
.as-stage--memo .em-cover-mid{margin-top:auto; margin-bottom:auto;}
.as-stage--memo .em-rule{width:64px; height:4px; border-radius:999px; background:#5a9bff; margin-bottom:24px;}
.as-stage--memo .em-cover-kicker{font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:1.5px; color:#6ea3ff; margin:0 0 12px;}
.as-stage--memo .em-cover-title{font-size:40px; line-height:1.1; letter-spacing:-1px; font-weight:700; color:#fff; margin:0 0 24px; max-width:168mm; text-wrap:balance;}
.as-stage--memo .em-cover-sub{font-size:14px; line-height:1.65; color:#fff; margin:0; max-width:132mm;}
.as-stage--memo .em-cover .em-logo{filter:brightness(0) invert(1);}
.as-stage--memo .em-cover .em-sub{color:rgba(255,255,255,.6);}
.as-stage--memo .em-kick{width:max-content; max-width:100%; margin:0 0 12px;}
.as-stage--memo .em-kick-tx{display:block; font-size:11px; font-weight:700; letter-spacing:1.6px; text-transform:uppercase; color:var(--brand);}
.as-stage--memo .em-krule{display:block; width:100%; height:2px; border-radius:2px; background:var(--brand); margin-top:6px;}
.as-stage--memo h2{font-size:21px; font-weight:700; line-height:1.24; letter-spacing:-0.35px; color:var(--ink); margin:0 0 16px; max-width:160mm; text-wrap:balance;}
.as-stage--memo .em-body p{font-size:11px; line-height:1.62; color:var(--ink); margin:0 0 8px; max-width:132mm;}
.as-stage--memo .em-body p:last-child{margin-bottom:0;}
.as-stage--memo .em-kpi-row{display:flex; gap:8px; margin:24px 0 0;}
.as-stage--memo .em-kpi{flex:1 1 0; min-width:0; container-type:inline-size; background:var(--status-bg); border:1px solid var(--line); border-radius:10px; padding:12px 10px;}
.as-stage--memo .em-kpi:has(.n:empty):has(.l:empty){display:none;}
.as-stage--memo .em-kpi .n{font-size:clamp(12px, 12cqi, 21px); font-weight:700; color:var(--brand); line-height:1.05; letter-spacing:-.4px; white-space:nowrap; overflow:hidden;}
.as-stage--memo .em-kpi .l{font-size:8.5px; line-height:1.45; color:var(--muted); margin-top:7px;}
.as-stage--memo .em-sec2{margin-top:24px;}
.as-stage--memo .em-blist{margin-top:12px;}
.as-stage--memo .em-bm{display:grid; grid-template-columns:46mm 1fr; gap:24px; align-items:center;}
.as-stage--memo .em-bm + .em-bm{border-top:1px solid var(--line); padding-top:12px; margin-top:12px;}
.as-stage--memo .em-shot{width:100%; height:28mm; border-radius:10px; border:1px solid var(--line); background:#fff; overflow:hidden; position:relative;}
.as-stage--memo .em-shot img, .as-stage--memo .em-shot .as-img--tpl{display:block; width:100%; height:100%; object-fit:contain; object-position:center; padding:8px 12px; background:#fff; box-sizing:border-box;}
.as-stage--memo .em-shot .as-img--tpl{position:absolute; inset:0; border-radius:inherit;}
.as-stage--memo .em-shot img[src=""], .as-stage--memo .em-shot img:not([src]){display:none;}
.as-stage--memo .em-shot-hint{display:block; font-size:8px; line-height:1.4; color:var(--extra-muted); padding:10px 12px;}
.as-stage--memo .em-shot:has(img[src]:not([src=""])) .em-shot-hint{display:none;}
.as-stage--memo .em-bm p{font-size:10.5px; line-height:1.58; color:var(--muted); margin:0;}
.as-stage--memo .em-bm p b{color:var(--ink);}
.as-stage--memo .em-tag{display:inline-flex; align-items:center; gap:7px; background:var(--brand-light); border:1px solid #cfe0fd; color:var(--brand-dark); font-size:9px; font-weight:700; padding:6px 12px; border-radius:8px; margin-top:12px;}
.as-stage--memo .em-tag .em-ico{width:9px; height:9px; color:var(--brand-dark);}
.as-stage--memo .em-plist{display:flex; flex-direction:column; gap:8px; margin-top:12px; flex:1 1 auto; min-height:0; overflow:hidden;}
.as-stage--memo .em-pot{display:grid; grid-template-columns:1fr 48mm; gap:16px; align-items:center; border:1px solid var(--line); border-radius:12px; padding:10px 14px; flex:1 1 0; min-height:0; overflow:hidden;}
.as-stage--memo .em-pot > div:first-child{min-height:0; overflow:hidden;}
.as-stage--memo .em-pot-hd{display:flex; align-items:center; gap:11px; margin:0 0 6px;}
.as-stage--memo .em-pnum{flex:0 0 auto; width:26px; height:26px; border-radius:8px; background:var(--navy); color:#fff; font-size:11px; font-weight:700; display:inline-flex; align-items:center; justify-content:center;}
.as-stage--memo .em-pot-hd h3{font-size:12.5px; font-weight:700; line-height:1.25; color:var(--navy); margin:0; display:-webkit-box; -webkit-box-orient:vertical; -webkit-line-clamp:2; overflow:hidden;}
.as-stage--memo .em-row{display:grid; grid-template-columns:16px 1fr; gap:11px; align-items:start; padding-top:8px; margin-top:6px; border-top:1px solid var(--line);}
.as-stage--memo .em-row .em-ico{width:13px; height:13px; margin-top:2px;}
.as-stage--memo .em-row .k{font-size:8px; font-weight:700; text-transform:uppercase; letter-spacing:.9px; margin:0 0 3px;}
.as-stage--memo .em-row p{margin:0;}
.as-stage--memo .em-row-bef .k{color:var(--extra-muted);}
.as-stage--memo .em-row-bef p:not(.k){font-size:10px; line-height:1.5; color:var(--muted); display:-webkit-box; -webkit-box-orient:vertical; -webkit-line-clamp:3; overflow:hidden;}
.as-stage--memo .em-row-pot .k{color:var(--brand);}
.as-stage--memo .em-row-pot p:not(.k){font-size:10.5px; line-height:1.5; color:var(--navy); font-weight:500; display:-webkit-box; -webkit-box-orient:vertical; -webkit-line-clamp:3; overflow:hidden;}
.as-stage--memo .em-p3{padding-bottom:72mm;}
.as-stage--memo .em-pot .em-shot{height:32mm;}
.as-stage--memo .em-foot-abs{position:absolute; left:0; right:0; bottom:0; background:var(--navy); color:#fff; padding:58px 16mm 13mm;}
.as-stage--memo .em-cta{position:absolute; left:16mm; right:16mm; top:0; transform:translateY(calc(-50% - 10px)); background:var(--brand); border-radius:8px; padding:22px 26px; display:flex; align-items:center; gap:24px;}
.as-stage--memo .em-cta p{margin:0; font-size:16px; line-height:1.32; font-weight:700; color:#fff; letter-spacing:-.2px;}
.as-stage--memo .em-cta-btn{margin-left:auto; display:inline-flex; align-items:center; gap:10px; background:#fff; color:var(--navy); border-radius:10px; padding:12px 25px; font-size:11.5px; font-weight:700; white-space:nowrap;}
.as-stage--memo .em-cta-btn .em-ico{width:12px; height:12px; color:var(--navy);}
.as-stage--memo .em-nv{display:grid; grid-template-columns:1fr 66mm; gap:40px; align-items:start;}
.as-stage--memo .em-nv h4{font-size:9px; font-weight:700; text-transform:uppercase; letter-spacing:1.4px; color:#fff; margin:0 0 8px;}
.as-stage--memo .em-nv p{font-size:9.5px; line-height:1.7; color:#fff; margin:0; max-width:112mm;}
.as-stage--memo .em-contact{display:flex; flex-direction:column; gap:10px; margin-top:1px;}
.as-stage--memo .em-cl{display:grid; grid-template-columns:14px 1fr; gap:11px; align-items:start;}
.as-stage--memo .em-cl .em-ico{width:11px; height:11px; margin-top:3px;}
.as-stage--memo .em-cl span{font-size:9.5px; line-height:1.5; color:#fff; font-weight:500;}
.as-stage--memo .em-nv-no{position:absolute; right:16mm; bottom:12mm; font-size:10px; font-weight:700; color:rgba(255,255,255,.55);}
.as-stage--memo .em-footer{margin-top:auto; padding-top:24px; border-top:1px solid var(--line); display:flex; justify-content:space-between; align-items:center;}
.as-stage--memo .em-footer .em-logo{width:78px; margin:0 auto 0 0;}
.as-stage--memo .em-fno{font-size:10px; font-weight:700; color:var(--muted);}
.as-stage--memo .em-fnote{font-size:8px; line-height:1.55; color:var(--extra-muted); margin:8px 0 0; max-width:172mm;}
@media print{
  .as-stage--memo{height:auto; background:#fff;}
  .as-stage--memo .em-page{break-after:page; page-break-after:always;}
  .as-stage--memo .em-page:last-child{break-after:auto; page-break-after:auto;}
}
`;

export const MEMO_TEMPLATE = `<div class="as-stage as-stage--memo" data-stage data-uid="{{uid}}">
  <div class="em-page em-cover">
    <div class="em-cover-top">
      <p class="em-claim">Helping You<br>Outperform the Market</p>
      <div><img class="em-logo" src="{{logo}}" alt="ROOTS"><div class="em-sub">Brand Strategy Consultants</div></div>
    </div>
    <div class="em-cover-mid">
      <div class="em-rule"></div>
      <p class="em-cover-kicker">Executive Memo</p>
      <h1 class="em-cover-title" data-field="title">{{title}}</h1>
      <p class="em-cover-sub" data-field="standfirst">{{standfirst}}</p>
    </div>
  </div>
  <div class="em-page">
    <div class="em-kick"><span class="em-kick-tx">01 · Marktdynamik</span><span class="em-krule"></span></div>
    <h2 data-field="market_title">{{market_title}}</h2>
    <div class="em-body">
      <p data-field="market_p1">{{market_p1}}</p>
      <p data-field="market_p2">{{market_p2}}</p>
    </div>
    <div class="em-kpi-row">${kpi(0)}${kpi(1)}${kpi(2)}${kpi(3)}</div>
    <div class="em-sec2">
      <div class="em-kick"><span class="em-kick-tx">02 · Benchmarks</span><span class="em-krule"></span></div>
      <h2 data-field="benchmark_title">{{benchmark_title}}</h2>
      <div class="em-body"><p data-field="benchmark_lead">{{benchmark_lead}}</p></div>
      <div class="em-blist">${benchmark(1)}${benchmark(2)}${benchmark(3)}</div>
    </div>
    <p class="em-fnote" data-field="sources">{{sources}}</p>
    <div class="em-footer"><img class="em-logo" src="{{logo}}" alt="ROOTS"><span class="em-fno">02</span></div>
  </div>
  <div class="em-page em-p3">
    <div class="em-kick"><span class="em-kick-tx">03 · Potenziale</span><span class="em-krule"></span></div>
    <h2 data-field="potentials_title">{{potentials_title}}</h2>
    <div class="em-body"><p data-field="potentials_lead">{{potentials_lead}}</p></div>
    <div class="em-plist">${potential(1)}${potential(2)}${potential(3)}</div>
    <div class="em-foot-abs">
      <div class="em-cta">
        <p data-field="cta">{{cta}}</p>
        <span class="em-cta-btn">Kontakt aufnehmen ${ICO_ARROW}</span>
      </div>
      <div class="em-nv">
        <div>
          <h4>Über ROOTS</h4>
          <p>KI-optimierte Markenstrategien und Marketing Operations für mehr Wirksamkeit, Effizienz und Speed im Marketing, mit Managementerfahrung bis CMO-Ebene im Handel. <span data-field="about_fit">{{about_fit}}</span></p>
        </div>
        <div class="em-contact">
          <div class="em-cl">${ICO_WEB}<span>roots-consultants.com</span></div>
          <div class="em-cl">${ICO_MAIL}<span>hello@roots-consultants.com</span></div>
          <div class="em-cl">${ICO_PHONE}<span>+49 211 976 338 30</span></div>
          <div class="em-cl">${ICO_PIN}<span>Erkrather Straße 401, 40231 Düsseldorf</span></div>
        </div>
      </div>
      <span class="em-nv-no">03</span>
    </div>
  </div>
</div>`;
