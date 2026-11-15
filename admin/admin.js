// Admin page: lists comments and advertising messages from /api/admin/*.
// All text is inserted with textContent, so nothing a visitor typed can run as code.
(function () {
  'use strict';
  let password = sessionStorage.getItem('vsc-admin-pw') || '';

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined && text !== null) n.textContent = text;
    return n;
  }
  function when(t) { return new Date(t * 1000).toLocaleString(); }

  async function api(path, body) {
    const headers = { 'X-VSC-Admin': '1' };
    if (password) headers.Authorization = 'Bearer ' + password;
    if (body) headers['Content-Type'] = 'application/json';
    const r = await fetch('/api/admin/' + path, { method: body ? 'POST' : 'GET', headers, body: body ? JSON.stringify(body) : undefined, credentials: 'same-origin' });
    if (r.status === 401) throw new Error('auth');
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || ('Error ' + r.status));
    return data;
  }

  function button(label, cls, onClick, confirmText) {
    const b = el('button', 'chip ' + (cls || ''), label);
    b.type = 'button';
    b.addEventListener('click', async () => {
      if (confirmText && !confirm(confirmText)) return;
      b.disabled = true;
      try { await onClick(); await loadAll(); } catch (e) { alert('Something went wrong: ' + e.message); b.disabled = false; }
    });
    return b;
  }

  const STATUS = { visible: ['Public', 'strong'], held: ['Waiting for approval', 'debated'], hidden: ['Hidden', 'context'] };

  function renderComments(list) {
    const root = document.getElementById('comment-admin-list');
    root.replaceChildren();
    const waiting = list.filter(c => c.status === 'held' || c.reports > 0).length;
    document.getElementById('c-count').textContent = waiting ? '(' + waiting + ' need attention)' : '';
    if (!list.length) { root.appendChild(el('p', 'note', 'No comments yet.')); return; }
    for (const c of list) {
      const card = el('article', 'card admin-card');
      const h = el('h3', null, c.name + ' ');
      const [label, cls] = STATUS[c.status] || [c.status, ''];
      h.appendChild(el('span', 'badge ' + cls, label));
      if (c.reports > 0) h.appendChild(el('span', 'badge debated', 'Reported ×' + c.reports));
      card.appendChild(h);
      card.appendChild(el('p', 'meta', when(c.created_at) + (c.hold_reason ? ' · held because it ' + c.hold_reason : '')));
      card.appendChild(el('p', 'comment-text', c.message));
      const actions = el('div', 'filters');
      if (c.status !== 'visible') actions.appendChild(button('Approve', '', () => api('comments', { id: c.id, action: 'show' })));
      if (c.status === 'visible') actions.appendChild(button('Hide', '', () => api('comments', { id: c.id, action: 'hide' })));
      if (c.reports > 0 && c.status === 'visible') actions.appendChild(button('Keep (clear reports)', '', () => api('comments', { id: c.id, action: 'clear' })));
      actions.appendChild(button('Delete', 'danger', () => api('comments', { id: c.id, action: 'delete' }), 'Delete this comment permanently?'));
      card.appendChild(actions);
      root.appendChild(card);
    }
  }

  function renderMessages(list) {
    const root = document.getElementById('message-admin-list');
    root.replaceChildren();
    const unread = list.filter(m => !m.is_read).length;
    document.getElementById('m-count').textContent = unread ? '(' + unread + ' new)' : '';
    if (!list.length) { root.appendChild(el('p', 'note', 'No messages yet.')); return; }
    for (const m of list) {
      const card = el('article', 'card admin-card' + (m.is_read ? '' : ' unread'));
      const h = el('h3', null, (m.organization || m.name) + ' ');
      if (!m.is_read) h.appendChild(el('span', 'badge debated', 'New'));
      card.appendChild(h);
      card.appendChild(el('p', 'meta', [m.category, when(m.created_at)].filter(Boolean).join(' · ')));
      const who = el('p');
      who.appendChild(el('strong', null, 'From: '));
      who.appendChild(document.createTextNode(m.name + ' — '));
      const mail = el('a', null, m.email);
      mail.href = 'mailto:' + encodeURIComponent(m.email).replace(/%40/g, '@');
      who.appendChild(mail);
      card.appendChild(who);
      if (m.website && /^https?:\/\//i.test(m.website)) {
        const p = el('p');
        p.appendChild(el('strong', null, 'Website: '));
        const a = el('a', null, m.website);
        a.href = m.website; a.target = '_blank'; a.rel = 'noopener noreferrer nofollow';
        p.appendChild(a);
        card.appendChild(p);
      }
      card.appendChild(el('p', 'comment-text', m.message));
      if (m.agreed_terms_at) card.appendChild(el('p', 'hint', '✓ Agreed to the Advertising Policy and Advertiser Terms on ' + when(m.agreed_terms_at)));
      const actions = el('div', 'filters');
      actions.appendChild(m.is_read
        ? button('Mark as new', '', () => api('messages', { id: m.id, action: 'unread' }))
        : button('Mark as read', '', () => api('messages', { id: m.id, action: 'read' })));
      actions.appendChild(button('Delete', 'danger', () => api('messages', { id: m.id, action: 'delete' }), 'Delete this message permanently?'));
      card.appendChild(actions);
      root.appendChild(card);
    }
  }

  async function loadAll() {
    const [c, m] = await Promise.all([api('comments'), api('messages')]);
    renderComments(c.comments || []);
    renderMessages(m.messages || []);
  }

  async function start() {
    try {
      await loadAll();
      document.getElementById('login').hidden = true;
      document.getElementById('panels').hidden = false;
    } catch (e) {
      document.getElementById('panels').hidden = true;
      document.getElementById('login').hidden = false;
      document.getElementById('login-msg').textContent =
        e.message === 'auth' ? (password ? 'That password was not accepted.' : '') : 'Could not reach the server: ' + e.message;
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    const go = () => {
      password = document.getElementById('pw').value;
      sessionStorage.setItem('vsc-admin-pw', password);
      start();
    };
    document.getElementById('pw-go').addEventListener('click', go);
    document.getElementById('pw').addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
    document.querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', () => {
      document.querySelectorAll('[data-tab]').forEach(x => x.classList.toggle('active', x === b));
      document.getElementById('tab-comments').hidden = b.dataset.tab !== 'comments';
      document.getElementById('tab-messages').hidden = b.dataset.tab !== 'messages';
    }));
    start();
  });
})();
