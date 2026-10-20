/**
 * Author autocomplete for the LibreTexts Page Settings "live tag" Author field.
 *
 * Replaces the visible <select id="live-tag-authorname-select"> with a searchable
 * combobox backed by the authors API. The original <select> stays in the DOM
 * (hidden) and remains the source of truth, so the existing live-tag save logic
 * keeps working: picking an author sets select.value to "authorname:<nameKey>"
 * (adding the <option> if it isn't already in the list) and fires "change".
 *
 * API: GET https://knitcanvas.fun/api/v1/authors/search?q=<query>&limit=<n>
 *   -> { err: false, authors: [{ nameKey, name, nameURL, campusName, isGroup }] }
 */
(function () {
    'use strict';
  
    const API = 'https://knitcanvas.fun/api/v1/authors/search';
    const LIMIT = 10;
    const MIN_CHARS = 2;
    const DEBOUNCE_MS = 250;
    const SELECT_ID = 'live-tag-authorname-select';
    const LABEL_ID = 'live-tag-authorname-label';
    const PREFIX = 'authorname:';
    const NOT_SET = 'not-set';
    // Page tag holding the saved author: author:{authorKey} (authorname: also accepted).
    const AUTHOR_TAG = /^author(?:name)?:(.+)$/i;
  
    injectStyles();
  
    // The settings dialog is rendered on demand, so watch for the select to appear
    // (and re-appear, if the dialog is closed and reopened).
    const tryMount = () => {
      const select = document.getElementById(SELECT_ID);
      if (select && !select.dataset.aaMounted) mount(select);
    };
    new MutationObserver(tryMount).observe(document.body, { childList: true, subtree: true });
    tryMount();
  
    function mount(select) {
      select.dataset.aaMounted = 'true';
      const section = select.closest('.live-tag-special-section') || select.parentElement;
  
      // Hide the native control but keep it in the form.
      select.style.display = 'none';
      select.setAttribute('aria-hidden', 'true');
      select.tabIndex = -1;
      const arrow = section.querySelector('.mt-select-box-arrow');
      if (arrow) arrow.style.display = 'none';
  
      const listId = SELECT_ID + '-aa-list';
  
      const wrap = el('div', 'aa-wrap');
      const input = el('input', 'aa-input mt-input');
      Object.assign(input, { type: 'text', autocomplete: 'off', spellcheck: false, placeholder: 'Search authors…' });
      setAttrs(input, {
        role: 'combobox',
        'aria-autocomplete': 'list',
        'aria-expanded': 'false',
        'aria-controls': listId,
        'aria-labelledby': LABEL_ID,
      });
  
      const clearBtn = el('button', 'aa-clear');
      clearBtn.type = 'button';
      clearBtn.textContent = '×';
      clearBtn.setAttribute('aria-label', 'Clear author');
  
      const list = el('ul', 'aa-list');
      list.id = listId;
      list.setAttribute('role', 'listbox');
      list.hidden = true;
  
      const status = el('div', 'aa-sr-only');
      status.setAttribute('aria-live', 'polite');
  
      wrap.append(input, clearBtn, list, status);
      select.insertAdjacentElement('afterend', wrap);
  
      let results = [];
      let active = -1;
      let controller = null;
  
      const currentName = () => {
        const opt = select.selectedOptions[0];
        return opt && opt.value !== NOT_SET ? opt.textContent.trim() : '';
      };
      const syncFromSelect = () => {
        if (document.activeElement === input) return; // don't clobber what the user is typing
        input.value = currentName();
        clearBtn.hidden = !input.value;
      };

      // After a reload the saved author may not be among the server-rendered <option>s
      // (e.g. it was picked from the API), so the browser falls back to "not-set".
      // Restore it from the page's author:{key} tag (or data-old-value), adding the
      // option and resolving its display name.
      const restoreSaved = async () => {
        if (select.value !== NOT_SET) return;
        const key = (await savedAuthorKey()) || keyFromValue(select.dataset.oldValue);
        if (!key) return;
        const saved = PREFIX + key;
        let opt = Array.from(select.options).find((o) => o.value === saved);
        if (!opt) {
          opt = new Option(key, saved);
          select.add(opt);
        }
        select.value = saved; // restoring saved state, so no change event
        syncFromSelect();
        if (opt.textContent !== key) return;
        try {
          const res = await fetch(`${API}?q=${encodeURIComponent(key)}&limit=${LIMIT}`);
          const data = await res.json();
          const match = (data.authors || []).find((a) => a && a.nameKey === key);
          if (match) {
            opt.textContent = match.name;
            syncFromSelect();
          }
        } catch (err) {
          console.warn('[author-autocomplete] could not resolve saved author', err);
        }
      };

      // Keep the input in step if the page's own script changes the select later.
      select.addEventListener('change', syncFromSelect);
      new MutationObserver(syncFromSelect).observe(select, {
        childList: true, subtree: true, attributes: true, attributeFilter: ['selected', 'data-old-value'],
      });

      syncFromSelect();
      restoreSaved();

      const open = () => { list.hidden = false; input.setAttribute('aria-expanded', 'true'); };
      const close = () => {
        list.hidden = true;
        input.setAttribute('aria-expanded', 'false');
        input.removeAttribute('aria-activedescendant');
        active = -1;
      };
  
      const message = (text) => {
        list.replaceChildren(Object.assign(el('li', 'aa-msg'), { textContent: text }));
        status.textContent = text;
        open();
      };
  
      const renderList = () => {
        if (!results.length) return message('No authors found');
        list.replaceChildren(...results.map((a, i) => {
          const li = el('li', 'aa-option');
          li.id = `${listId}-opt-${i}`;
          li.setAttribute('role', 'option');
          li.setAttribute('aria-selected', 'false');
          const name = el('span', 'aa-name');
          name.textContent = a.name + (a.isGroup ? ' (group)' : '');
          li.append(name);
          if (a.campusName) {
            const campus = el('span', 'aa-campus');
            campus.textContent = a.campusName;
            li.append(campus);
          }
          // mousedown + preventDefault keeps focus in the input so blur doesn't close first
          li.addEventListener('mousedown', (e) => { e.preventDefault(); choose(results[i]); });
          return li;
        }));
        status.textContent = `${results.length} author${results.length === 1 ? '' : 's'} found`;
        open();
      };
  
      const setActive = (i) => {
        const opts = list.querySelectorAll('.aa-option');
        if (!opts.length) return;
        active = (i + opts.length) % opts.length;
        opts.forEach((o, j) => {
          o.classList.toggle('aa-active', j === active);
          o.setAttribute('aria-selected', String(j === active));
        });
        input.setAttribute('aria-activedescendant', opts[active].id);
        opts[active].scrollIntoView({ block: 'nearest' });
      };
  
      const setSelectValue = (value) => {
        select.value = value;
        select.dispatchEvent(new Event('input', { bubbles: true }));
        select.dispatchEvent(new Event('change', { bubbles: true }));
      };
  
      function choose(author) {
        const value = PREFIX + author.nameKey;
        let opt = Array.from(select.options).find((o) => o.value === value);
        if (!opt) {
          opt = new Option(author.name, value);
          select.add(opt);
        }
        setSelectValue(value);
        input.value = author.name;
        clearBtn.hidden = false;
        close();
      }
  
      const search = debounce(async (q) => {
        if (controller) controller.abort();
        controller = new AbortController();
        message('Searching…');
        try {
          const res = await fetch(`${API}?q=${encodeURIComponent(q)}&limit=${LIMIT}`, { signal: controller.signal });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json();
          if (data.err) throw new Error('API returned err');
          results = Array.isArray(data.authors) ? data.authors.filter((a) => a && a.nameKey) : [];
          renderList();
        } catch (err) {
          if (err.name === 'AbortError') return;
          console.warn('[author-autocomplete]', err);
          message('Could not load authors. Try again.');
        }
      }, DEBOUNCE_MS);
  
      input.addEventListener('input', () => {
        const q = input.value.trim();
        clearBtn.hidden = !input.value;
        if (q.length < MIN_CHARS) {
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
            // never let Enter submit the settings form from this field
            e.preventDefault();
            if (!list.hidden && active >= 0 && results[active]) choose(results[active]);
            break;
          case 'Escape':
            if (!list.hidden) {
              e.preventDefault();
              e.stopPropagation(); // close the list, not the whole dialog
              close();
            }
            break;
        }
      });
  
      input.addEventListener('blur', () => {
        close();
        // Don't leave half-typed text that looks like a saved value.
        input.value = currentName();
        clearBtn.hidden = !input.value;
      });
  
      clearBtn.addEventListener('click', () => {
        setSelectValue(NOT_SET);
        input.value = '';
        clearBtn.hidden = true;
        results = [];
        close();
        input.focus();
      });
    }
  
    // ---------- helpers ----------

    function keyFromValue(value) {
      const m = AUTHOR_TAG.exec((value || '').trim());
      return m ? m[1].trim() : '';
    }

    // Saved author key from the page's tags. LibreTexts renders the tags as a JSON
    // array in #pageTagsHolder; otherwise ask the MindTouch API for this page's tags.
    async function savedAuthorKey() {
      let tags = [];
      const holder = document.getElementById('pageTagsHolder');
      try {
        if (holder) {
          tags = JSON.parse(holder.textContent);
        } else {
          const path = encodeURIComponent(encodeURIComponent(location.pathname.replace(/^\/+/, '')));
          const res = await fetch(`/@api/deki/pages/=${path}/tags?dream.out.format=json`, { credentials: 'same-origin' });
          if (!res.ok) return '';
          const data = await res.json();
          tags = [].concat(data.tag || []).map((t) => t['@value']);
        }
      } catch (err) {
        console.warn('[author-autocomplete] could not read page tags', err);
        return '';
      }
      for (const tag of tags) {
        const key = keyFromValue(String(tag));
        if (key) return key;
      }
      return '';
    }
  
    function el(tag, className) {
      const node = document.createElement(tag);
      if (className) node.className = className;
      return node;
    }
  
    function setAttrs(node, attrs) {
      Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, v));
    }
  
    function debounce(fn, ms) {
      let t;
      return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
    }
  
    function injectStyles() {
      if (document.getElementById('aa-styles')) return;
      const style = document.createElement('style');
      style.id = 'aa-styles';
      style.textContent = `
        .aa-wrap { position: relative; width: 100%; }
        .aa-input { width: 100%; box-sizing: border-box; padding: 6px 28px 6px 8px; }
        .aa-clear { position: absolute; right: 4px; top: 50%; transform: translateY(-50%);
                    border: 0; background: none; font-size: 18px; line-height: 1; cursor: pointer; color: #666; }
        .aa-list { position: absolute; z-index: 100000; left: 0; right: 0; margin: 2px 0 0; padding: 0;
                   list-style: none; max-height: 260px; overflow-y: auto; background: #fff;
                   border: 1px solid #ccc; border-radius: 4px; box-shadow: 0 4px 12px rgba(0,0,0,.15); }
        .aa-option { padding: 6px 10px; cursor: pointer; display: flex; flex-direction: column; }
        .aa-option:hover, .aa-option.aa-active { background: #e8f0fe; }
        .aa-campus { font-size: 12px; color: #666; }
        .aa-msg { padding: 6px 10px; color: #666; font-style: italic; }
        .aa-sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
      `;
      document.head.appendChild(style);
    }
  })();