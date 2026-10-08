/** Menu-only search: selected filter values never change while typing. */
export function normalizeDropdownSearch(value) {
  return String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/ß/g, 'ss').trim();
}

export function matchesDropdownSearch(label, query) {
  const text = normalizeDropdownSearch(label);
  return normalizeDropdownSearch(query).split(/\s+/).filter(Boolean).every(word => text.includes(word));
}

export function createDropdownSearch(placeholder, onSearch) {
  const wrap = document.createElement('label');
  wrap.className = 'roots-select-search';
  const icon = document.createElement('i');
  icon.className = 'fa-solid fa-magnifying-glass';
  icon.setAttribute('aria-hidden', 'true');
  const input = document.createElement('input');
  input.type = 'search';
  input.placeholder = placeholder;
  input.setAttribute('aria-label', placeholder);
  input.autocomplete = 'off';
  input.addEventListener('input', () => onSearch(input.value));
  wrap.append(input, icon);
  bindDropdownSearch(wrap);
  return { wrap, input };
}

/** Expand to the left on hover/focus; a short leave delay bridges small pointer slips. */
export function bindDropdownSearch(wrap) {
  if (!wrap || wrap.dataset.searchBound) return;
  wrap.dataset.searchBound = 'true';
  const input = wrap.querySelector('input');
  wrap.tabIndex = 0;
  wrap.setAttribute('aria-label', input.getAttribute('aria-label'));
  input.tabIndex = -1;
  let hovered = false, timer;
  const expand = () => {
    clearTimeout(timer);
    wrap.classList.add('is-expanded');
    input.tabIndex = 0;
  };
  const leave = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (hovered || wrap.contains(document.activeElement)) return;
      wrap.classList.remove('is-expanded');
      input.tabIndex = -1;
    }, 450);
  };
  wrap.addEventListener('pointerenter', () => { hovered = true; expand(); });
  wrap.addEventListener('pointerleave', () => { hovered = false; leave(); });
  wrap.addEventListener('focusin', expand);
  wrap.addEventListener('focusout', leave);
  wrap.addEventListener('click', () => { expand(); input.focus(); });
  wrap.addEventListener('keydown', event => {
    if (event.target === wrap && ['Enter', ' '].includes(event.key)) { event.preventDefault(); expand(); input.focus(); }
  });
  input.addEventListener('input', () => wrap.classList.toggle('has-query', Boolean(input.value)));
}
