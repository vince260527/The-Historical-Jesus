// Renders entries and news from /data/*.json and provides search + filters.
// All content is inserted with textContent (never innerHTML), so text from
// the data files can't inject scripts or markup.
(function () {
  'use strict';

  const SECTIONS = ['Non-Christian Writers', 'Archaeology', 'Manuscripts', 'Earliest Christian Texts'];
  const BADGE_CLASS = { 'Widely accepted': 'strong', 'Debated': 'debated', 'Context': 'context' };
  const state = { query: '', section: '', badge: '' };
  let entries = [];

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text) n.textContent = text;
    return n;
  }

  // Only allow http(s) links and same-site image paths.
  function safeUrl(u) {
    try {
      const url = new URL(u, location.href);
      return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
    } catch { return null; }
  }
  function safeImage(src) {
    return typeof src === 'string' && /^\/?images\/[\w\-./]+\.(jpe?g|png|webp|gif|svg)$/i.test(src) && !src.includes('..') ? src : null;
  }

  function renderCard(e) {
    const card = el('article', 'card');
    const img = safeImage(e.image);
    if (img) {
      const fig = el('figure');
      const i = el('img');
      i.src = img; i.alt = e.imageAlt || e.title; i.loading = 'lazy';
      fig.appendChild(i);
      if (e.credit) {
        const cap = el('figcaption');
        const href = safeUrl(e.creditUrl);
        if (href) {
          const a = el('a', null, e.credit);
          a.href = href; a.rel = 'noopener noreferrer'; a.target = '_blank';
          cap.appendChild(a);
        } else cap.textContent = e.credit;
        fig.appendChild(cap);
      }
      card.appendChild(fig);
      card.classList.add('has-image');
    }
    const body = el('div', 'card-body');
    const h = el('h3', null, e.title + ' ');
    if (e.badge) h.appendChild(el('span', 'badge ' + (BADGE_CLASS[e.badge] || ''), e.badge));
    body.appendChild(h);
    if (e.meta) body.appendChild(el('p', 'meta', e.meta));
    if (e.summary) body.appendChild(el('p', null, e.summary));
    if (e.significance) {
      const p = el('p');
      p.appendChild(el('strong', null, 'Significance: '));
      p.appendChild(document.createTextNode(e.significance));
      body.appendChild(p);
    }
    card.appendChild(body);
    return card;
  }

  function matches(e) {
    if (state.section && e.section !== state.section) return false;
    if (state.badge && e.badge !== state.badge) return false;
    if (!state.query) return true;
    const hay = [e.title, e.meta, e.summary, e.significance, e.section].join(' ').toLowerCase();
    return state.query.split(/\s+/).every(w => hay.includes(w));
  }

  function renderEntries() {
    const root = document.getElementById('entries');
    root.replaceChildren();
    const shown = entries.filter(matches);
    const groups = SECTIONS.concat([...new Set(entries.map(e => e.section))].filter(s => !SECTIONS.includes(s)));
    for (const s of groups) {
      const items = shown.filter(e => e.section === s);
      if (!items.length) continue;
      root.appendChild(el('h3', 'group-title', s));
      items.forEach(e => root.appendChild(renderCard(e)));
    }
    document.getElementById('count').textContent =
      shown.length === entries.length ? `${entries.length} entries` : `Showing ${shown.length} of ${entries.length} entries`;
    if (!shown.length) root.appendChild(el('p', 'note', 'No entries match your search.'));
  }

  function renderNews(items) {
    const root = document.getElementById('news-list');
    root.replaceChildren();
    items.sort((a, b) => String(b.date).localeCompare(String(a.date)));
    for (const n of items) {
      const card = el('article', 'card news');
      const body = el('div', 'card-body');
      const h = el('h3');
      const href = safeUrl(n.url);
      if (href) {
        const a = el('a', null, n.title);
        a.href = href; a.rel = 'noopener noreferrer'; a.target = '_blank';
        h.appendChild(a);
      } else h.textContent = n.title;
      body.appendChild(h);
      const d = n.date ? new Date(n.date + 'T12:00:00').toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : '';
      body.appendChild(el('p', 'meta', [n.outlet, d].filter(Boolean).join(' · ')));
      if (n.summary) body.appendChild(el('p', null, n.summary));
      card.appendChild(body);
      root.appendChild(card);
    }
  }

  function wireControls() {
    let t;
    document.getElementById('search').addEventListener('input', ev => {
      clearTimeout(t);
      t = setTimeout(() => { state.query = ev.target.value.trim().toLowerCase(); renderEntries(); }, 120);
    });
    document.querySelectorAll('.chip').forEach(btn => btn.addEventListener('click', () => {
      const key = btn.dataset.badge !== undefined ? 'badge' : 'section';
      state[key] = btn.dataset[key];
      btn.parentElement.querySelectorAll('.chip').forEach(b => b.classList.toggle('active', b === btn));
      renderEntries();
    }));
  }

  async function load(path) {
    const r = await fetch(path, { cache: 'no-cache' });
    if (!r.ok) throw new Error(path + ': ' + r.status);
    return r.json();
  }

  document.addEventListener('DOMContentLoaded', async () => {
    wireControls();
    try {
      const [e, n] = await Promise.all([load('/data/entries.json'), load('/data/news.json')]);
      entries = e;
      renderEntries();
      renderNews(n);
    } catch (err) {
      document.getElementById('entries').appendChild(
        el('p', 'note', 'Could not load content. If you opened the file directly, run a local server instead (see README).'));
      console.error(err);
    }
  });
})();
