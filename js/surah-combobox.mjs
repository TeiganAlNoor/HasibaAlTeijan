import { normalizeName } from './quran-search.mjs';
import { fitPopup } from './popup-position.mjs';

/** APG editable listbox: typing never commits; only Enter or a tap does. */
export class SurahCombobox {
  constructor(container, onSelect) {
    this.container = container;
    this.input = container.querySelector('[role="combobox"]');
    this.list = container.querySelector('[role="listbox"]');
    this.status = container.querySelector('[role="status"]');
    this.onSelect = onSelect;
    this.surahs = [];
    this.selected = null;
    this.active = -1;
    this.input.addEventListener('focus', () => { this.open(''); this.input.select(); });
    this.input.addEventListener('click', () => { if (this.list.hidden) { this.open(''); this.input.select(); } });
    this.input.addEventListener('input', () => this.open(this.input.value));
    this.input.addEventListener('keydown', event => this.keydown(event));
    this.input.addEventListener('blur', () => { this.close(); this.restoreLabel(); });
    this.list.addEventListener('pointerdown', event => event.preventDefault());
    this.list.addEventListener('click', event => {
      const option = event.target.closest('[role="option"]');
      if (option) this.commit(Number(option.dataset.number));
    });
    document.addEventListener('pointerdown', event => {
      if (!container.contains(event.target)) { this.close(); this.restoreLabel(); }
    });
  }
  setSurahs(surahs) {
    this.surahs = surahs;
    this.input.disabled = false;
    this.input.placeholder = 'اكتب اسم السورة أو تصفّح السور';
  }
  label(surah) { return `${surah.number}. ${surah.name}`; }
  restoreLabel() { this.input.value = this.selected ? this.label(this.selected) : ''; }
  setSelected(number) {
    this.selected = this.surahs.find(surah => surah.number === number) ?? null;
    this.restoreLabel();
  }
  open(query) {
    if (!this.surahs.length) return;
    const normalized = normalizeName(query);
    this.filtered = this.surahs.filter(surah => !normalized || normalizeName(surah.name).includes(normalized) || String(surah.number) === query.trim());
    this.list.replaceChildren();
    this.active = -1;
    this.input.removeAttribute('aria-activedescendant');
    for (const surah of this.filtered) {
      const option = document.createElement('li');
      option.role = 'option';
      option.id = `${this.list.id}-${surah.number}`;
      option.dataset.number = surah.number;
      option.setAttribute('aria-selected', String(this.selected?.number === surah.number));
      option.className = 'surah-option';
      option.textContent = this.label(surah);
      this.list.append(option);
    }
    if (!this.filtered.length) {
      const empty = document.createElement('li');
      empty.className = 'no-options';
      empty.textContent = 'لا توجد سورة بهذا الاسم. جرّب جزءًا آخر من الاسم.';
      empty.role = 'presentation';
      this.list.append(empty);
    }
    this.status.textContent = `${this.filtered.length} سورة متاحة`;
    this.list.hidden = false;
    this.input.setAttribute('aria-expanded', 'true');
    fitPopup(this.container, this.list);
  }
  close() {
    this.list.hidden = true;
    this.input.setAttribute('aria-expanded', 'false');
    this.input.removeAttribute('aria-activedescendant');
    this.active = -1;
  }
  commit(number) {
    this.setSelected(number);
    this.close();
    this.onSelect(this.selected);
  }
  keydown(event) {
    if (event.key === 'Escape') { this.close(); this.restoreLabel(); event.preventDefault(); return; }
    if (event.key === 'Tab') { this.close(); this.restoreLabel(); return; }
    if (event.key === 'Enter' && !this.list.hidden) {
      event.preventDefault();
      if (this.active >= 0) this.commit(this.filtered[this.active].number);
      return;
    }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    if (this.list.hidden && ['Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    if (this.list.hidden) this.open('');
    if (!this.filtered.length) return;
    if (event.key === 'Home') this.active = 0;
    else if (event.key === 'End') this.active = this.filtered.length - 1;
    else if (this.active < 0) this.active = event.key === 'ArrowDown' ? 0 : this.filtered.length - 1;
    else this.active = (this.active + (event.key === 'ArrowDown' ? 1 : -1) + this.filtered.length) % this.filtered.length;
    [...this.list.children].forEach((node, i) => node.classList.toggle('option-active', i === this.active));
    const option = this.list.children[this.active];
    this.input.setAttribute('aria-activedescendant', option.id);
    option.scrollIntoView({ block: 'nearest', behavior: 'instant' });
  }
}
