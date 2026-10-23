/**
 * Custom Page settings panel for the MindTouch editor.
 *
 * Replaces MindTouch's built-in Page settings (#mt-summary) with a panel built from
 * the data the PageSettings DekiScript template emits in #cps-data. Every change is
 * saved straight to the MindTouch API (page tags, the overview property and the
 * thumbnail file), so nothing depends on the removed panel.
 *
 * The tag fields (Article type, Author, ...) are defined in FIELDS below; nothing is
 * read from the default panel. Each field stores its value as a page tag made of
 * its prefix and value, e.g. "article:topic" or "author@<authorKey>". The Author field is a searchable combobox backed by the authors API.
 *
 * Authors API: GET https://knitcanvas.fun/api/v1/authors/search?q=<query>&limit=<n>
 *   -> { err: false, authors: [{ nameKey, name, nameURL, campusName, isGroup }] }
 */
(function () {
  'use strict';

  const DEKI = '/@api/deki';
  const DEKI_HEADERS = { 'X-Deki-Client': 'mindtouch-martian', 'X-Deki-Requested-With': 'XMLHttpRequest' };
  const AUTHORS_API = 'https://knitcanvas.fun/api/v1/authors/search';
  const OVERVIEW_PROPERTY = 'mindtouch.page#overview';
  const THUMBNAIL_FILE = 'mindtouch.page#thumbnail';
  const NOT_SET = 'not-set';
  const ARTICLE_PREFIX = 'article:';
  const GUIDE_TAG = 'article:topic-guide';
  // Tag added when a guide is set to "Tabbed". Check what your site uses and change it here.
  const GUIDE_TABBED_TAG = 'guide:tabbed';
  // The panel's tag fields, in display order. `prefix` includes its separator, and
  // each option is [tag, label] with the tag starting with that prefix. A field with
  // type 'author' is the author search box and saves prefix + nameKey (its options
  // just give names for known authors). The first tag matching a field's prefix is
  // its value; any other matching tags stay in the tag list below.
  // To add a field, copy an entry, e.g.
  //   { label: 'Override', prefix: 'override:', options: [['override:yes', 'Yes']] },
  const FIELDS = [
    {
      label: 'Article type', prefix: 'article:', options: [
        ['article:topic', 'Topic'], ['article:topic-guide', 'Guide'],
        ['article:topic-category', 'Category'], ['article:topic-portal', 'Portal'],
      ],
    },
    { label: 'Author', prefix: 'author@', type: 'author', options: [] },
  ];
  const TAG_SAVE_DELAY_MS = 600;
  const SUMMARY_SAVE_DELAY_MS = 1500;
  const AUTHOR_LIMIT = 10;
  const AUTHOR_MIN_CHARS = 2;
  const AUTHOR_DEBOUNCE_MS = 250;

  // The editor renders #mt-summary on demand, so wait for both it and the data.
  const tryMount = () => {
    const original = document.getElementById('mt-summary');
    const data = document.getElementById('cps-data');
    if (original && data && !data.dataset.cpsMounted) {
      data.dataset.cpsMounted = 'true';
      mount(original, data);
    }
  };
  new MutationObserver(tryMount).observe(document.documentElement, { childList: true, subtree: true });
  tryMount();

  // #cps-data holds the template's settings as a JSON object in its text.
  function mount(original, data) {
    const settings = parseSettings(data.textContent);
    const page = {
      id: Number(settings.pageId) || 0,
      summary: String(settings.summary || ''),
      thumbnail: String(settings.thumbnail || ''),
      tags: Array.isArray(settings.tags) ? settings.tags.map(String).filter(Boolean) : [],
    };
    original.replaceWith(buildPanel(page, FIELDS));
  }

  function parseSettings(json) {
    try {
      const settings = JSON.parse(json.trim() || '{}');
      return settings && typeof settings === 'object' ? settings : {};
    } catch (err) {
      console.warn('[page-settings] could not read page settings', err);
      return {};
    }
  }

  // ---------- panel ----------

  function buildPanel(page, fields) {
    const panel = el('section', 'cps-panel');
    panel.setAttribute('aria-label', 'Page settings');

    const header = el('div', 'cps-header');
    const toggle = el('button', 'cps-toggle');
    toggle.type = 'button';
    toggle.setAttribute('aria-expanded', 'true');
    const toggleIcon = el('span', 'cps-toggle-icon', '−');
    toggleIcon.setAttribute('aria-hidden', 'true');
    toggle.append(toggleIcon, el('span', null, 'Page settings'));
    const status = el('span', 'cps-status');
    status.setAttribute('role', 'status');
    header.append(toggle, status);

    const body = el('div', 'cps-body');
    toggle.addEventListener('click', () => {
      const opening = body.hidden;
      body.hidden = !opening;
      toggle.setAttribute('aria-expanded', String(opening));
      toggleIcon.textContent = opening ? '−' : '+';
    });
    panel.append(header, body);

    if (!page.id) {
      body.append(el('p', 'cps-note', 'Save the page once to edit its settings.'));
      return panel;
    }

    // Saves run one at a time, in order, so a slow request can't overwrite a newer one.
    let queue = Promise.resolve();
    const setStatus = (text, kind) => {
      status.textContent = text;
      status.dataset.kind = kind || '';
    };
    const save = (task, onError) => {
      setStatus('Saving…');
      queue = queue.then(task).then(
        () => setStatus('Saved', 'ok'),
        (err) => {
          console.warn('[page-settings]', err);
          setStatus("Couldn't save. Try again.", 'error');
          if (onError) onError();
        },
      );
    };

    // --- thumbnail + summary ---
    const top = el('div', 'cps-top');
    top.append(thumbnailField(page, save, setStatus), summaryField(page, save));

    // --- live-tag fields ---
    const scheduleTags = debounce(() => save(() => putTags(page.id, collectTags())), TAG_SAVE_DELAY_MS);

    const row = el('div', 'cps-fields');
    const fieldStates = fields.map((field, i) => {
      const current = page.tags.find((t) => hasPrefix(t, field.prefix)) || '';
      const state = field.type === 'author'
        ? authorField(field, current, `cps-field-${i}`, scheduleTags)
        : selectField(field, current, `cps-field-${i}`, () => { updateGuide(); scheduleTags(); });
      row.append(state.node);
      return { field, current, value: state.value };
    });

    // --- guide listing display (only for guides) ---
    const guide = el('fieldset', 'cps-guide');
    guide.append(el('legend', 'cps-heading', 'Guide listing display :'));
    const single = radio('cps-guide', 'single', 'Single', 'Topic hierarchy');
    const tabbed = radio('cps-guide', 'tabbed', 'Tabbed');
    (page.tags.includes(GUIDE_TABBED_TAG) ? tabbed : single).input.checked = true;
    [single, tabbed].forEach((r) => r.input.addEventListener('change', scheduleTags));
    guide.append(single.node, tabbed.node);
    const articleState = fieldStates.find((s) => s.field.prefix.toLowerCase() === ARTICLE_PREFIX);
    const isGuide = () => !!articleState && articleState.value() === GUIDE_TAG;
    function updateGuide() { guide.hidden = !isGuide(); }
    updateGuide();

    // --- free tags: everything except the tags the fields above hold ---
    const fieldTags = new Set(fieldStates.map((s) => s.current).filter(Boolean));
    const freeTags = page.tags.filter((t) => !fieldTags.has(t) && t !== GUIDE_TABBED_TAG);
    const tagsNode = tagsField(freeTags, scheduleTags);

    function collectTags() {
      const all = [...freeTags];
      fieldStates.forEach((s) => { const v = s.value(); if (v) all.push(v); });
      if (isGuide() && tabbed.input.checked) all.push(GUIDE_TABBED_TAG);
      return [...new Set(all)];
    }

    body.append(top, guide, row, tagsNode);
    return panel;
  }

  function thumbnailField(page, save, setStatus) {
    const wrap = el('div', 'cps-thumb');
    wrap.append(el('span', 'cps-label', 'Thumbnail'));

    const box = el('div', 'cps-thumb-box');
    const pick = el('button', 'cps-thumb-pick');
    pick.type = 'button';
    const img = el('img', 'cps-thumb-img');
    img.alt = '';
    const text = el('span', 'cps-thumb-text', 'Add page thumbnail');
    pick.append(img, text);
    const remove = el('button', 'cps-thumb-remove', '×');
    remove.type = 'button';
    remove.setAttribute('aria-label', 'Remove thumbnail');
    const file = el('input');
    Object.assign(file, { type: 'file', accept: 'image/*', hidden: true });
    box.append(pick, remove, file);
    wrap.append(box);

    let current = page.thumbnail;
    const show = (src) => {
      img.hidden = !src;
      if (src) img.src = src; else img.removeAttribute('src');
      text.hidden = !!src;
      remove.hidden = !src;
      pick.setAttribute('aria-label', src ? 'Change page thumbnail' : 'Add page thumbnail');
    };
    show(current);

    const path = `/pages/${page.id}/files/=${enc(THUMBNAIL_FILE)}`;
    pick.addEventListener('click', () => file.click());
    file.addEventListener('change', () => {
      const chosen = file.files[0];
      file.value = '';
      if (!chosen) return;
      if (!chosen.type.startsWith('image/')) return setStatus('Thumbnail must be an image.', 'error');
      const previous = current;
      show(URL.createObjectURL(chosen));
      save(async () => {
        await deki('PUT', path, { body: chosen, type: chosen.type });
        current = `${DEKI}${path}?t=${Date.now()}`;
      }, () => show(previous));
    });
    remove.addEventListener('click', () => {
      const previous = current;
      show('');
      save(async () => {
        await deki('DELETE', path);
        current = '';
      }, () => show(previous));
      pick.focus();
    });
    return wrap;
  }

  function summaryField(page, save) {
    const wrap = el('div', 'cps-summary');
    const label = el('label', 'cps-label', 'Summary');
    label.htmlFor = 'cps-summary-input';
    const area = el('textarea', 'cps-summary-input');
    area.id = 'cps-summary-input';
    area.rows = 4;
    area.value = page.summary;
    wrap.append(label, area);

    let saved = page.summary;
    const saveSummary = () => {
      const text = area.value;
      if (text === saved) return;
      const previous = saved;
      saved = text;
      save(() => putOverview(page.id, text), () => { saved = previous; });
    };
    area.addEventListener('input', debounce(saveSummary, SUMMARY_SAVE_DELAY_MS));
    area.addEventListener('blur', saveSummary);
    return wrap;
  }

  function selectField(field, current, id, onChange) {
    const select = el('select', 'cps-select');
    select.id = id;
    const options = field.options.some(([v]) => v === NOT_SET)
      ? field.options
      : [[NOT_SET, '(not set)'], ...field.options];
    options.forEach(([value, text]) => select.add(new Option(text, value)));
    // Keep a saved value the site no longer lists, so saving doesn't drop it.
    if (current && !options.some(([v]) => v === current)) {
      select.add(new Option(current.slice(field.prefix.length), current));
    }
    select.value = current || NOT_SET;
    select.addEventListener('change', onChange);
    return {
      node: labelled(field.label, select, id),
      value: () => (select.value === NOT_SET ? '' : select.value),
    };
  }

  function authorField(field, current, id, onChange) {
    const prefix = field.prefix;
    const known = new Map(field.options.filter(([v]) => v !== NOT_SET));
    const listId = `${id}-list`;
    let value = current;
    let name = value ? known.get(value) || value.slice(prefix.length) : '';

    const wrap = el('div', 'cps-combo');
    const input = el('input', 'cps-input');
    input.id = id;
    Object.assign(input, { type: 'text', autocomplete: 'off', spellcheck: false, placeholder: 'Search authors…' });
    setAttrs(input, {
      role: 'combobox',
      'aria-autocomplete': 'list',
      'aria-expanded': 'false',
      'aria-controls': listId,
    });
    const clear = el('button', 'cps-combo-clear', '×');
    clear.type = 'button';
    clear.setAttribute('aria-label', 'Clear author');
    const list = el('ul', 'cps-combo-list');
    list.id = listId;
    list.setAttribute('role', 'listbox');
    list.hidden = true;
    const live = el('div', 'cps-sr-only');
    live.setAttribute('aria-live', 'polite');
    wrap.append(input, clear, list, live);

    const show = () => {
      input.value = name;
      clear.hidden = !name;
    };
    show();

    // A saved author missing from the site's list only has its key; look up the name.
    if (value && !known.has(value)) {
      const key = value.slice(prefix.length);
      findAuthor(key).then((author) => {
        if (!author || value !== current) return;
        name = author.name;
        if (document.activeElement !== input) show();
      });
    }

    let results = [];
    let active = -1;
    let controller = null;

    const open = () => { list.hidden = false; input.setAttribute('aria-expanded', 'true'); };
    const close = () => {
      list.hidden = true;
      input.setAttribute('aria-expanded', 'false');
      input.removeAttribute('aria-activedescendant');
      active = -1;
    };
    const message = (text) => {
      list.replaceChildren(el('li', 'cps-combo-msg', text));
      live.textContent = text;
      open();
    };
    const renderList = () => {
      if (!results.length) return message('No authors found');
      list.replaceChildren(...results.map((a, i) => {
        const li = el('li', 'cps-combo-option');
        li.id = `${listId}-opt-${i}`;
        setAttrs(li, { role: 'option', 'aria-selected': 'false' });
        li.append(el('span', 'cps-combo-name', a.name + (a.isGroup ? ' (group)' : '')));
        if (a.campusName) li.append(el('span', 'cps-combo-campus', a.campusName));
        // mousedown + preventDefault keeps focus in the input so blur doesn't close first
        li.addEventListener('mousedown', (e) => { e.preventDefault(); choose(results[i]); });
        return li;
      }));
      live.textContent = `${results.length} author${results.length === 1 ? '' : 's'} found`;
      open();
    };
    const setActive = (i) => {
      const opts = list.querySelectorAll('.cps-combo-option');
      if (!opts.length) return;
      active = (i + opts.length) % opts.length;
      opts.forEach((o, j) => {
        o.classList.toggle('cps-active', j === active);
        o.setAttribute('aria-selected', String(j === active));
      });
      input.setAttribute('aria-activedescendant', opts[active].id);
      opts[active].scrollIntoView({ block: 'nearest' });
    };

    function choose(author) {
      value = prefix + author.nameKey;
      name = author.name;
      show();
      close();
      onChange();
    }

    const search = debounce(async (q) => {
      if (controller) controller.abort();
      controller = new AbortController();
      message('Searching…');
      try {
        results = await searchAuthors(q, controller.signal);
        renderList();
      } catch (err) {
        if (err.name === 'AbortError') return;
        console.warn('[page-settings]', err);
        message('Could not load authors. Try again.');
      }
    }, AUTHOR_DEBOUNCE_MS);

    input.addEventListener('input', () => {
      const q = input.value.trim();
      clear.hidden = !input.value;
      if (q.length < AUTHOR_MIN_CHARS) {
        if (controller) controller.abort();
        results = [];
        close();
        return;
      }
      search(q);
    });
    input.addEventListener('keydown', (e) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          if (list.hidden && results.length) renderList();
          setActive(active + 1);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setActive(active - 1);
          break;
        case 'Enter':
          // never let Enter submit the editor form from this field
          e.preventDefault();
          if (!list.hidden && active >= 0 && results[active]) choose(results[active]);
          break;
        case 'Escape':
          if (!list.hidden) {
            e.preventDefault();
            e.stopPropagation(); // close the list, not the editor
            close();
          }
          break;
      }
    });
    // Don't leave half-typed text that looks like a saved value.
    input.addEventListener('blur', () => { close(); show(); });
    clear.addEventListener('click', () => {
      value = '';
      name = '';
      results = [];
      show();
      close();
      onChange();
      input.focus();
    });

    return { node: labelled(field.label, wrap, id), value: () => value };
  }

  function tagsField(tags, onChange) {
    const wrap = el('div', 'cps-tags');
    const label = el('label', 'cps-heading', 'Tags');
    label.htmlFor = 'cps-tag-input';
    const adder = el('div', 'cps-tag-adder');
    const plus = el('span', 'cps-tag-plus', '+');
    plus.setAttribute('aria-hidden', 'true');
    const input = el('input', 'cps-tag-input');
    Object.assign(input, { id: 'cps-tag-input', type: 'text', autocomplete: 'off', placeholder: 'Add new tag here' });
    adder.append(plus, input);
    const list = el('ul', 'cps-chips');
    list.setAttribute('aria-label', 'Page tags');
    wrap.append(label, adder, list);

    const render = () => {
      list.replaceChildren(...tags.map((tag) => {
        const li = el('li', 'cps-chip');
        const remove = el('button', 'cps-chip-remove', '×');
        remove.type = 'button';
        remove.setAttribute('aria-label', `Remove tag ${tag}`);
        remove.addEventListener('click', () => {
          tags.splice(tags.indexOf(tag), 1);
          render();
          onChange();
          input.focus();
        });
        li.append(remove, el('span', 'cps-chip-text', tag));
        return li;
      }));
    };

    // Accepts "a, b, c" so pasted lists become separate tags.
    const addFromInput = () => {
      const added = input.value.split(',').map((t) => t.trim()).filter((t) =>
        t && !tags.some((x) => x.toLowerCase() === t.toLowerCase()));
      input.value = '';
      if (!added.length) return;
      tags.push(...new Set(added));
      render();
      onChange();
    };
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        addFromInput();
      }
    });
    input.addEventListener('blur', addFromInput);

    render();
    return wrap;
  }

  function radio(name, value, text, hint) {
    const label = el('label', 'cps-radio');
    const input = el('input');
    Object.assign(input, { type: 'radio', name, value });
    label.append(input, el('span', null, text));
    if (hint) label.append(el('span', 'cps-hint', `(${hint})`));
    return { node: label, input };
  }

  function labelled(text, control, id) {
    const wrap = el('div', 'cps-field');
    const label = el('label', 'cps-heading', `${text}:`);
    label.htmlFor = id;
    wrap.append(label, control);
    return wrap;
  }

  // ---------- API ----------

  // No auth token is put in the page: the signed-in user's session cookie, sent via
  // credentials: 'same-origin', authenticates these calls.

  async function deki(method, path, { body, type, headers } = {}) {
    const res = await fetch(DEKI + path, {
      method,
      body,
      credentials: 'same-origin',
      headers: { ...DEKI_HEADERS, ...(type ? { 'Content-Type': type } : {}), ...headers },
    });
    if (!res.ok) throw new Error(`${method} ${path}: HTTP ${res.status}`);
    return res;
  }

  function putTags(pageId, tags) {
    const doc = document.implementation.createDocument(null, 'tags', null);
    tags.forEach((tag) => {
      const node = doc.createElement('tag');
      node.setAttribute('value', tag);
      doc.documentElement.appendChild(node);
    });
    return deki('PUT', `/pages/${pageId}/tags`, {
      body: new XMLSerializer().serializeToString(doc),
      type: 'application/xml',
    });
  }

  // Updating an existing property needs its current ETag; a new one doesn't.
  async function putOverview(pageId, text) {
    const path = `/pages/${pageId}/properties/${enc(OVERVIEW_PROPERTY)}`;
    const current = await fetch(DEKI + path, { credentials: 'same-origin', headers: DEKI_HEADERS });
    const etag = current.ok ? current.headers.get('ETag') : null;
    return deki('PUT', path, {
      body: text,
      type: 'text/plain; charset=utf-8',
      headers: etag ? { ETag: etag } : {},
    });
  }

  async function searchAuthors(q, signal) {
    const res = await fetch(`${AUTHORS_API}?q=${encodeURIComponent(q)}&limit=${AUTHOR_LIMIT}`, { signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.err) throw new Error('API returned err');
    return Array.isArray(data.authors) ? data.authors.filter((a) => a && a.nameKey) : [];
  }

  async function findAuthor(key) {
    try {
      return (await searchAuthors(key)).find((a) => a.nameKey === key) || null;
    } catch (err) {
      console.warn('[page-settings] could not resolve saved author', err);
      return null;
    }
  }

  // ---------- helpers ----------

  // MindTouch wants names with "#" double-encoded in API paths (# -> %2523).
  function enc(name) {
    return encodeURIComponent(encodeURIComponent(name));
  }

  function hasPrefix(tag, prefix) {
    return tag.toLowerCase().startsWith(prefix.toLowerCase());
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function setAttrs(node, attrs) {
    Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, v));
  }

  function debounce(fn, ms) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  }
})();
