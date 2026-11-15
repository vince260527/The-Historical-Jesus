// Renders entries and news from /data/*.json and provides search + filters.
// All content is inserted with textContent (never innerHTML), so text from
// the data files can't inject scripts or markup.
(function () {
  'use strict';

  const SECTIONS = ['Non-Christian Writers', 'Archaeology', 'Manuscripts', 'Earliest Christian Texts',
    'Shroud of Turin & Relics', 'Ark of the Covenant', 'Hebrew Bible Archaeology'];
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
    card.dataset.section = e.section || '';
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
      const gt = el('h3', 'group-title', s);
      gt.dataset.section = s;
      root.appendChild(gt);
      items.forEach((e, i) => {
        const card = renderCard(e);
        // An odd card out at the end of a group stretches across both columns.
        if (items.length % 2 === 1 && i === items.length - 1) card.classList.add('span-last');
        root.appendChild(card);
      });
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

  // Newsletter, donation, and sponsors, all driven by data/site.json.
  // Anything left blank there stays hidden on the page.
  function show(id) { const n = document.getElementById(id); if (n) n.hidden = false; return n; }

  function renderSite(site) {
    site = site || {};
    const newsletter = safeUrl(site.newsletterUrl || '');
    const donate = safeUrl(site.donationUrl || '');
    const footer = document.getElementById('footer-links');

    function footerLink(text, href) {
      const a = el('a', null, text);
      a.href = href; a.target = '_blank'; a.rel = 'noopener noreferrer';
      if (footer.childNodes.length) footer.appendChild(document.createTextNode(' · '));
      footer.appendChild(a);
      footer.hidden = false;
    }

    if (site.newsletterUrl && newsletter) {
      show('support'); show('newsletter-box'); show('nav-subscribe');
      document.getElementById('newsletter-blurb').textContent = site.newsletterBlurb || '';
      document.getElementById('subscribe-button').href = newsletter;
      footerLink('Subscribe', newsletter);
    }
    if (site.donationUrl && donate) {
      show('support'); show('donate-box');
      document.getElementById('donate-blurb').textContent = site.donationBlurb || '';
      document.getElementById('donate-button').href = donate;
      footerLink('Support this site', donate);
    }
    // Sponsors & Partners. This section is always shown. Each group lists
    // the entries of that type from site.json. The three educational ad
    // groups show an "Advertise here" spot until they have an advertiser.
    const contact = (site.sponsorContact || '').trim();
    let contactHref = null;
    if (/^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(contact)) contactHref = 'mailto:' + contact;
    else if (contact) contactHref = safeUrl(contact);

    // [type in site.json, heading, card label, placeholder text (or null = hide group when empty)]
    const GROUPS = [
      ['Sponsor', 'Our Sponsors', 'Sponsor', null],
      ['Christian University / College', 'Christian Universities & Colleges', 'Ad', 'Your university or college here'],
      ['Bible School / Course', 'Bible Schools & Courses', 'Ad', 'Your Bible school or course here'],
      ['Study Bible / Bible Website', 'Study Bibles & Bible Websites', 'Ad', 'Your study Bible or Bible website here'],
      ['Advertisement', 'Other Advertisements', 'Ad', null],
      ['Affiliate / reseller', 'Recommended Resources', 'Affiliate link', null]
    ];
    const sponsors = Array.isArray(site.sponsors) ? site.sponsors.filter(s => s && s.name) : [];
    const groupsRoot = document.getElementById('partner-groups');
    for (const [type, heading, tag, placeholder] of GROUPS) {
      const items = sponsors.filter(s => (s.type || 'Sponsor') === type);
      if (!items.length && !placeholder) continue;
      const group = el('div', 'partner-group');
      group.appendChild(el('h3', 'group-title', heading));
      const list = el('div', 'sponsor-list');
      for (const s of items) {
        const href = s.url ? safeUrl(s.url) : null;
        const item = el(href ? 'a' : 'div', 'sponsor');
        if (href) { item.href = href; item.target = '_blank'; item.rel = 'noopener noreferrer sponsored'; }
        item.appendChild(el('span', 'sponsor-tag', tag));
        const logo = safeImage(s.logo);
        if (logo) {
          const i = el('img'); i.src = logo; i.alt = s.name + ' logo'; i.loading = 'lazy';
          item.appendChild(i);
        }
        item.appendChild(el('strong', null, s.name));
        if (s.blurb) item.appendChild(el('span', null, s.blurb));
        list.appendChild(item);
      }
      if (!items.length) {
        const spot = el(contactHref ? 'a' : 'div', 'sponsor placeholder');
        if (contactHref) spot.href = contactHref;
        spot.appendChild(el('strong', null, placeholder));
        spot.appendChild(el('span', null, contactHref ? 'Advertise with us →' : 'Advertising spots available'));
        list.appendChild(spot);
      }
      group.appendChild(list);
      groupsRoot.appendChild(group);
      if (type === 'Affiliate / reseller') show('affiliate-disclosure');
    }

    if (contactHref) {
      document.getElementById('sponsor-contact').href = contactHref;
      show('sponsor-contact-line');
    }
  }

  // Videos: each card links out to YouTube in a new tab. Thumbnails are
  // stored on this site, so nothing is requested from YouTube until the
  // visitor chooses to watch.
  function renderVideos(items) {
    const list = document.getElementById('video-list');
    const filters = document.getElementById('video-filters');
    items = (Array.isArray(items) ? items : []).filter(v => v && /^[\w-]{11}$/.test(v.youtubeId || ''));
    if (!items.length) { document.getElementById('videos').hidden = true; return; }

    function draw(topic) {
      list.replaceChildren();
      for (const v of items.filter(v => !topic || v.topic === topic)) {
        const url = 'https://www.youtube.com/watch?v=' + v.youtubeId;
        const card = el('article', 'video-card');
        const player = el('a', 'video-frame');
        player.href = url; player.target = '_blank'; player.rel = 'noopener noreferrer';
        player.setAttribute('aria-label', 'Watch on YouTube: ' + v.title);
        const thumb = safeImage(v.thumbnail);
        if (thumb) {
          const i = el('img'); i.src = thumb; i.alt = ''; i.loading = 'lazy';
          player.appendChild(i);
        }
        const overlay = el('span', 'video-play');
        overlay.appendChild(el('span', 'play-icon', '▶'));
        overlay.appendChild(el('span', 'play-label', 'Watch on YouTube'));
        player.appendChild(overlay);
        card.appendChild(player);
        const body = el('div', 'card-body');
        body.appendChild(el('h3', null, v.title));
        body.appendChild(el('p', 'meta', [v.channel, v.topic].filter(Boolean).join(' · ')));
        if (v.description) body.appendChild(el('p', null, v.description));
        card.appendChild(body);
        list.appendChild(card);
      }
    }

    const topics = [...new Set(items.map(v => v.topic).filter(Boolean))];
    if (topics.length > 1) {
      for (const t of [''].concat(topics)) {
        const b = el('button', 'chip' + (t ? '' : ' active'), t || 'All videos');
        b.type = 'button';
        b.addEventListener('click', () => {
          filters.querySelectorAll('.chip').forEach(x => x.classList.toggle('active', x === b));
          draw(t);
        });
        filters.appendChild(b);
      }
    }
    draw('');
  }

  // "Also from VSC" questionnaire box. Hidden until surveyUrl is filled in.
  function renderSurvey(site) {
    const href = safeUrl(site.surveyUrl || '');
    if (!site.surveyUrl || !href || !/^https?:/i.test(site.surveyUrl.trim())) return;
    document.getElementById('survey-title').textContent = site.surveyTitle || 'Take our questionnaire';
    document.getElementById('survey-blurb').textContent = site.surveyBlurb || '';
    const b = document.getElementById('survey-button');
    b.href = href;
    b.textContent = site.surveyButton || 'Take the questionnaire →';
    show('survey');
  }

  // ---------- Comments and "Advertise with us" (Cloudflare Pages Functions) ----------
  // Both stay off until data/site.json has a turnstileSiteKey AND the /api
  // functions answer. Visitors don't need an account; Cloudflare Turnstile
  // (a free, privacy-friendly "are you human?" check) stops spam bots.
  let turnstileLoading = null;
  function loadTurnstile() {
    if (window.turnstile) return Promise.resolve(window.turnstile);
    if (!turnstileLoading) {
      turnstileLoading = new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
        s.async = true;
        s.addEventListener('load', () => resolve(window.turnstile));
        s.addEventListener('error', reject);
        document.head.appendChild(s);
      });
    }
    return turnstileLoading;
  }

  async function postJson(url, data) {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    const out = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(out.error || 'Something went wrong. Please try again.');
    return out;
  }

  // Wires a form to an API endpoint with its own Turnstile widget.
  async function setupForm(form, siteKey, url, onSuccess) {
    const ts = await loadTurnstile();
    const widget = ts.render(form.querySelector('.turnstile-slot'), { sitekey: siteKey, theme: 'auto', size: 'flexible' });
    const status = form.querySelector('.form-status');
    const btn = form.querySelector('button[type=submit]');
    form.addEventListener('submit', async ev => {
      ev.preventDefault();
      const data = Object.fromEntries(new FormData(form).entries());
      data.token = ts.getResponse(widget);
      if (!data.token) { status.textContent = 'Please complete the human check above.'; return; }
      btn.disabled = true;
      status.textContent = 'Sending…';
      try {
        const out = await postJson(url, data);
        form.reset();
        onSuccess(out, status);
      } catch (e) {
        status.textContent = e.message;
      } finally {
        btn.disabled = false;
        ts.reset(widget);
      }
    });
  }

  function commentCard(c) {
    const card = el('article', 'comment');
    const head = el('div', 'comment-head');
    head.appendChild(el('strong', null, c.name));
    const d = new Date(c.created_at * 1000);
    head.appendChild(el('span', 'meta', d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })));
    const rep = el('button', 'link-button', 'Report');
    rep.type = 'button';
    rep.title = 'Flag this comment for the site owner to review';
    rep.addEventListener('click', async () => {
      if (!confirm('Report this comment to the site owner?')) return;
      rep.disabled = true;
      try { await postJson('/api/report', { id: c.id }); rep.textContent = 'Reported. Thank you.'; }
      catch { rep.disabled = false; }
    });
    head.appendChild(rep);
    card.appendChild(head);
    card.appendChild(el('p', 'comment-text', c.message));
    return card;
  }

  async function renderComments(site) {
    const key = (site.turnstileSiteKey || '').trim();
    if (!key) return;
    let data;
    try {
      const r = await fetch('/api/comments', { cache: 'no-store' });
      if (!r.ok) return;
      data = await r.json();
    } catch { return; }

    document.getElementById('discussion-pending').hidden = true;
    show('comments-app');
    const list = document.getElementById('comment-list');
    const count = document.getElementById('comment-count');
    const comments = Array.isArray(data.comments) ? data.comments : [];
    function updateCount() {
      const n = list.children.length;
      count.textContent = n ? n + (n === 1 ? ' comment' : ' comments') : 'No comments yet. Be the first!';
    }
    comments.forEach(c => list.appendChild(commentCard(c)));
    updateCount();

    setupForm(document.getElementById('comment-form'), key, '/api/comments', (out, status) => {
      if (out.status === 'visible' && out.comment) {
        list.prepend(commentCard(out.comment));
        updateCount();
        status.textContent = 'Thank you! Your comment is posted.';
      } else {
        status.textContent = 'Thank you! Your comment will appear once it is approved.';
      }
    }).catch(() => { document.getElementById('comments-app').hidden = true; show('discussion-pending'); });

    // The same check also powers the "Advertise with us" form.
    show('advertise');
    const toggle = document.getElementById('advertise-toggle');
    const form = document.getElementById('advertise-form');
    let ready = false;
    function openForm() {
      form.hidden = false;
      toggle.setAttribute('aria-expanded', 'true');
      if (!ready) {
        ready = true;
        setupForm(form, key, '/api/contact', (out, status) => {
          status.textContent = 'Thank you! Your message was sent. We will reply by email.';
        });
      }
    }
    toggle.addEventListener('click', () => {
      if (form.hidden) openForm();
      else { form.hidden = true; toggle.setAttribute('aria-expanded', 'false'); }
    });
    document.querySelectorAll('.sponsor.placeholder').forEach(spot => {
      if (spot.tagName === 'A') return;  // already links to an email contact
      spot.classList.add('clickable');
      spot.tabIndex = 0;
      spot.setAttribute('role', 'button');
      const label = spot.querySelector('span');
      if (label) label.textContent = 'Advertise with us →';
      const go = () => { openForm(); form.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
      spot.addEventListener('click', go);
      spot.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
    });
  }

  function wireControls() {
    let t;
    document.getElementById('search').addEventListener('input', ev => {
      clearTimeout(t);
      t = setTimeout(() => {
        state.query = ev.target.value.trim().toLowerCase();
        renderEntries();
        if (state.query) document.getElementById('evidence').scrollIntoView({ block: 'start' });
      }, 250);
    });
    document.querySelectorAll('#evidence .chip').forEach(btn => btn.addEventListener('click', () => {
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
      const [e, n, s] = await Promise.all([
        load('/data/entries.json'),
        load('/data/news.json'),
        load('/data/site.json').catch(() => ({}))
      ]);
      load('/data/videos.json').then(renderVideos).catch(() => renderVideos([]));
      entries = e;
      renderEntries();
      renderNews(n);
      renderSite(s);
      renderComments(s || {});
      renderSurvey(s || {});
    } catch (err) {
      document.getElementById('entries').appendChild(
        el('p', 'note', 'Could not load content. If you opened the file directly, run a local server instead (see README).'));
      console.error(err);
    }
  });
})();
