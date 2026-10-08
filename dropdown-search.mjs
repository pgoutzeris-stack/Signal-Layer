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
  wrap.append(icon, input);
  return { wrap, input };
}
