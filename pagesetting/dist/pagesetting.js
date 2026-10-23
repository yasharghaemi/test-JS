"use strict";
(() => {
  // src/config.ts
  var DEKI = "/@api/deki";
  var DEKI_HEADERS = {
    "X-Deki-Client": "mindtouch-martian",
    "X-Deki-Requested-With": "XMLHttpRequest"
  };
  var AUTHORS_API = "https://knitcanvas.fun/api/v1/authors/search";
  var OVERVIEW_PROPERTY = "mindtouch.page#overview";
  var THUMBNAIL_FILE = "mindtouch.page#thumbnail";
  var NOT_SET = "not-set";
  var ARTICLE_PREFIX = "article:";
  var GUIDE_TAG = "article:topic-guide";
  var GUIDE_TABBED_TAG = "guide:tabbed";
  var role = (label, prefix) => ({
    label,
    prefix,
    type: "author",
    group: "attribution",
    askApplyToSubpages: true,
    options: []
  });
  var FIELDS = [
    {
      label: "Article type",
      prefix: "article:",
      options: [
        ["article:topic", "Topic"],
        ["article:topic-guide", "Guide"],
        ["article:topic-category", "Category"],
        ["article:topic-portal", "Portal"]
      ]
    },
    role("Author", "author@"),
    role("Editor", "editor@"),
    role("Remixer", "remixer@"),
    role("Translator", "translator@"),
    role("Contributor", "contributor@"),
    role("Illustrator", "illustrator@"),
    role("Reviewer", "reviewedBy@")
  ];
  var TAG_SAVE_DELAY_MS = 600;
  var SUMMARY_SAVE_DELAY_MS = 1500;
  var AUTHOR_LIMIT = 10;
  var AUTHOR_MIN_CHARS = 2;
  var AUTHOR_DEBOUNCE_MS = 250;
  var SUBPAGE_CONCURRENCY = 4;

  // src/util.ts
  function enc(name) {
    return encodeURIComponent(encodeURIComponent(name));
  }
  function hasPrefix(tag, prefix) {
    return tag.toLowerCase().startsWith(prefix.toLowerCase());
  }
  function debounce(fn, ms) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
  }
  async function runPool(items, limit, fn) {
    let next = 0;
    const worker = async () => {
      while (next < items.length) await fn(items[next++]);
    };
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  }

  // src/api.ts
  async function deki(method, path, { body, type, headers } = {}) {
    const res = await fetch(DEKI + path, {
      method,
      body,
      credentials: "same-origin",
      headers: { ...DEKI_HEADERS, ...type ? { "Content-Type": type } : {}, ...headers }
    });
    if (!res.ok) throw new Error(`${method} ${path}: HTTP ${res.status}`);
    return res;
  }
  async function dekiJson(path) {
    const sep = path.includes("?") ? "&" : "?";
    return (await deki("GET", `${path}${sep}dream.out.format=json`)).json();
  }
  function asArray(value) {
    return value == null ? [] : Array.isArray(value) ? value : [value];
  }
  async function getTags(pageId) {
    const data = await dekiJson(`/pages/${pageId}/tags`);
    return asArray(data.tag).map((t) => t["@value"] || "").filter(Boolean);
  }
  function putTags(pageId, tags) {
    const doc = document.implementation.createDocument(null, "tags", null);
    tags.forEach((tag) => {
      const node = doc.createElement("tag");
      node.setAttribute("value", tag);
      doc.documentElement.appendChild(node);
    });
    return deki("PUT", `/pages/${pageId}/tags`, {
      body: new XMLSerializer().serializeToString(doc),
      type: "application/xml"
    });
  }
  async function replaceFieldTag(pageId, prefix, tag) {
    const tags = await getTags(pageId);
    const i = tags.findIndex((t) => hasPrefix(t, prefix));
    if (i >= 0) {
      if (tags[i] === tag) return;
      if (tag) tags.splice(i, 1, tag);
      else tags.splice(i, 1);
    } else {
      if (!tag) return;
      tags.push(tag);
    }
    await putTags(pageId, [...new Set(tags)]);
  }
  async function putOverview(pageId, text) {
    const path = `/pages/${pageId}/properties/${enc(OVERVIEW_PROPERTY)}`;
    const current = await fetch(DEKI + path, { credentials: "same-origin", headers: DEKI_HEADERS });
    const etag = current.ok ? current.headers.get("ETag") : null;
    return deki("PUT", path, {
      body: text,
      type: "text/plain; charset=utf-8",
      headers: etag ? { ETag: etag } : {}
    });
  }
  async function getDescendantIds(pageId) {
    const ids = /* @__PURE__ */ new Set();
    collectPageIds(await dekiJson(`/pages/${pageId}/tree`), ids);
    ids.delete(String(pageId));
    return [...ids];
  }
  function collectPageIds(node, out) {
    if (Array.isArray(node)) {
      node.forEach((n) => collectPageIds(n, out));
      return;
    }
    if (!node || typeof node !== "object") return;
    const obj = node;
    if (obj["@id"] != null) out.add(String(obj["@id"]));
    for (const key of ["page", "pages", "subpages", "page.subpage"]) {
      if (key in obj) collectPageIds(obj[key], out);
    }
  }

  // src/dom.ts
  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }
  function setAttrs(node, attrs) {
    Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, v));
  }
  function labelled(text, control, id) {
    const wrap = el("div", "cps-field");
    const label = el("label", "cps-heading", `${text}:`);
    label.htmlFor = id;
    wrap.append(label, control);
    return wrap;
  }
  function radio(name, value, text, hint) {
    const label = el("label", "cps-radio");
    const input = el("input");
    Object.assign(input, { type: "radio", name, value });
    label.append(input, el("span", null, text));
    if (hint) label.append(el("span", "cps-hint", `(${hint})`));
    return { node: label, input };
  }

  // src/authors.ts
  async function searchAuthors(q, signal) {
    const res = await fetch(`${AUTHORS_API}?q=${encodeURIComponent(q)}&limit=${AUTHOR_LIMIT}`, { signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.err) throw new Error("API returned err");
    return Array.isArray(data.authors) ? data.authors.filter((a) => a && a.nameKey) : [];
  }
  async function findAuthor(key) {
    try {
      return (await searchAuthors(key)).find((a) => a.nameKey === key) || null;
    } catch (err) {
      console.warn("[page-settings] could not resolve saved author", err);
      return null;
    }
  }

  // src/fields/author.ts
  function authorField(field, current, id, onChange) {
    const prefix = field.prefix;
    const known = new Map(field.options.filter(([v]) => v !== NOT_SET));
    const listId = `${id}-list`;
    let value = current;
    let name = value ? known.get(value) || value.slice(prefix.length) : "";
    const wrap = el("div", "cps-combo");
    const input = el("input", "cps-input");
    input.id = id;
    Object.assign(input, { type: "text", autocomplete: "off", spellcheck: false, placeholder: "\u2014" });
    input.addEventListener("focus", () => {
      input.placeholder = "Search people\u2026";
    });
    setAttrs(input, {
      role: "combobox",
      "aria-autocomplete": "list",
      "aria-expanded": "false",
      "aria-controls": listId
    });
    const clear = el("button", "cps-combo-clear", "\xD7");
    clear.type = "button";
    clear.setAttribute("aria-label", `Clear ${field.label}`);
    const list = el("ul", "cps-combo-list");
    list.id = listId;
    list.setAttribute("role", "listbox");
    list.hidden = true;
    const live = el("div", "cps-sr-only");
    live.setAttribute("aria-live", "polite");
    wrap.append(input, clear, list, live);
    const show = () => {
      input.value = name;
      clear.hidden = !name;
    };
    show();
    if (value && !known.has(value)) {
      findAuthor(value.slice(prefix.length)).then((author) => {
        if (!author || value !== current) return;
        name = author.name;
        if (document.activeElement !== input) show();
      });
    }
    let results = [];
    let active = -1;
    let controller = null;
    const open = () => {
      list.hidden = false;
      input.setAttribute("aria-expanded", "true");
    };
    const close = () => {
      list.hidden = true;
      input.setAttribute("aria-expanded", "false");
      input.removeAttribute("aria-activedescendant");
      active = -1;
    };
    const message = (text) => {
      list.replaceChildren(el("li", "cps-combo-msg", text));
      live.textContent = text;
      open();
    };
    const renderList = () => {
      if (!results.length) return message("No authors found");
      list.replaceChildren(...results.map((a, i) => {
        const li = el("li", "cps-combo-option");
        li.id = `${listId}-opt-${i}`;
        setAttrs(li, { role: "option", "aria-selected": "false" });
        li.append(el("span", "cps-combo-name", a.name + (a.isGroup ? " (group)" : "")));
        if (a.campusName) li.append(el("span", "cps-combo-campus", a.campusName));
        li.addEventListener("mousedown", (e) => {
          e.preventDefault();
          choose(results[i]);
        });
        return li;
      }));
      live.textContent = `${results.length} author${results.length === 1 ? "" : "s"} found`;
      open();
    };
    const setActive = (i) => {
      const opts = list.querySelectorAll(".cps-combo-option");
      if (!opts.length) return;
      active = (i + opts.length) % opts.length;
      opts.forEach((o, j) => {
        o.classList.toggle("cps-active", j === active);
        o.setAttribute("aria-selected", String(j === active));
      });
      input.setAttribute("aria-activedescendant", opts[active].id);
      opts[active].scrollIntoView({ block: "nearest" });
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
      message("Searching\u2026");
      try {
        results = await searchAuthors(q, controller.signal);
        renderList();
      } catch (err) {
        if (err.name === "AbortError") return;
        console.warn("[page-settings]", err);
        message("Could not load authors. Try again.");
      }
    }, AUTHOR_DEBOUNCE_MS);
    input.addEventListener("input", () => {
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
    input.addEventListener("keydown", (e) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          if (list.hidden && results.length) renderList();
          setActive(active + 1);
          break;
        case "ArrowUp":
          e.preventDefault();
          setActive(active - 1);
          break;
        case "Enter":
          e.preventDefault();
          if (!list.hidden && active >= 0 && results[active]) choose(results[active]);
          break;
        case "Escape":
          if (!list.hidden) {
            e.preventDefault();
            e.stopPropagation();
            close();
          }
          break;
      }
    });
    input.addEventListener("blur", () => {
      close();
      show();
      input.placeholder = "\u2014";
    });
    clear.addEventListener("click", () => {
      value = "";
      name = "";
      results = [];
      show();
      close();
      onChange();
      input.focus();
    });
    return { node: labelled(field.label, wrap, id), value: () => value, display: () => name };
  }

  // src/fields/select.ts
  function selectField(field, current, id, onChange) {
    const select = el("select", "cps-select");
    select.id = id;
    const options = field.options.some(([v]) => v === NOT_SET) ? field.options : [[NOT_SET, "(not set)"], ...field.options];
    options.forEach(([value, text]) => select.add(new Option(text, value)));
    if (current && !options.some(([v]) => v === current)) {
      select.add(new Option(current.slice(field.prefix.length), current));
    }
    select.value = current || NOT_SET;
    select.addEventListener("change", onChange);
    return {
      node: labelled(field.label, select, id),
      value: () => select.value === NOT_SET ? "" : select.value,
      display: () => {
        var _a, _b;
        return select.value === NOT_SET ? "" : ((_b = (_a = select.selectedOptions[0]) == null ? void 0 : _a.textContent) == null ? void 0 : _b.trim()) || "";
      }
    };
  }

  // src/fields/summary.ts
  function summaryField(page, save) {
    const wrap = el("div", "cps-summary");
    const label = el("label", "cps-label", "Summary");
    label.htmlFor = "cps-summary-input";
    const area = el("textarea", "cps-summary-input");
    area.id = "cps-summary-input";
    area.rows = 4;
    area.value = page.summary;
    wrap.append(label, area);
    let saved = page.summary;
    const saveSummary = () => {
      const text = area.value;
      if (text === saved) return;
      const previous = saved;
      saved = text;
      save(() => putOverview(page.id, text), () => {
        saved = previous;
      });
    };
    area.addEventListener("input", debounce(saveSummary, SUMMARY_SAVE_DELAY_MS));
    area.addEventListener("blur", saveSummary);
    return wrap;
  }

  // src/fields/tags.ts
  function tagsField(tags, onChange) {
    const wrap = el("div", "cps-tags");
    const label = el("label", "cps-heading", "Tags");
    label.htmlFor = "cps-tag-input";
    const adder = el("div", "cps-tag-adder");
    const plus = el("span", "cps-tag-plus", "+");
    plus.setAttribute("aria-hidden", "true");
    const input = el("input", "cps-tag-input");
    Object.assign(input, { id: "cps-tag-input", type: "text", autocomplete: "off", placeholder: "Add new tag here" });
    adder.append(plus, input);
    const list = el("ul", "cps-chips");
    list.setAttribute("aria-label", "Page tags");
    wrap.append(label, adder, list);
    const render = () => {
      list.replaceChildren(...tags.map((tag) => {
        const li = el("li", "cps-chip");
        const remove = el("button", "cps-chip-remove", "\xD7");
        remove.type = "button";
        remove.setAttribute("aria-label", `Remove tag ${tag}`);
        remove.addEventListener("click", () => {
          tags.splice(tags.indexOf(tag), 1);
          render();
          onChange();
          input.focus();
        });
        li.append(remove, el("span", "cps-chip-text", tag));
        return li;
      }));
    };
    const addFromInput = () => {
      const added = input.value.split(",").map((t) => t.trim()).filter((t) => t && !tags.some((x) => x.toLowerCase() === t.toLowerCase()));
      input.value = "";
      if (!added.length) return;
      tags.push(...new Set(added));
      render();
      onChange();
    };
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === ",") {
        e.preventDefault();
        addFromInput();
      }
    });
    input.addEventListener("blur", addFromInput);
    render();
    return wrap;
  }

  // src/fields/thumbnail.ts
  function thumbnailField(page, save, setStatus) {
    const wrap = el("div", "cps-thumb");
    wrap.append(el("span", "cps-label", "Thumbnail"));
    const box = el("div", "cps-thumb-box");
    const pick = el("button", "cps-thumb-pick");
    pick.type = "button";
    const img = el("img", "cps-thumb-img");
    img.alt = "";
    const text = el("span", "cps-thumb-text", "Add page thumbnail");
    pick.append(img, text);
    const remove = el("button", "cps-thumb-remove", "\xD7");
    remove.type = "button";
    remove.setAttribute("aria-label", "Remove thumbnail");
    const file = el("input");
    Object.assign(file, { type: "file", accept: "image/*", hidden: true });
    box.append(pick, remove, file);
    wrap.append(box);
    let current = page.thumbnail;
    const show = (src) => {
      img.hidden = !src;
      if (src) img.src = src;
      else img.removeAttribute("src");
      text.hidden = !!src;
      remove.hidden = !src;
      pick.setAttribute("aria-label", src ? "Change page thumbnail" : "Add page thumbnail");
    };
    show(current);
    const path = `/pages/${page.id}/files/=${enc(THUMBNAIL_FILE)}`;
    pick.addEventListener("click", () => file.click());
    file.addEventListener("change", () => {
      const chosen = file.files && file.files[0];
      file.value = "";
      if (!chosen) return;
      if (!chosen.type.startsWith("image/")) return setStatus("Thumbnail must be an image.", "error");
      const previous = current;
      show(URL.createObjectURL(chosen));
      save(async () => {
        await deki("PUT", path, { body: chosen, type: chosen.type });
        current = `${DEKI}${path}?t=${Date.now()}`;
      }, () => show(previous));
    });
    remove.addEventListener("click", () => {
      const previous = current;
      show("");
      save(async () => {
        await deki("DELETE", path);
        current = "";
      }, () => show(previous));
      pick.focus();
    });
    return wrap;
  }

  // src/dialog.ts
  function confirmDialog({ title, message, confirmText, cancelText }) {
    const dialog = el("dialog", "cps-dialog");
    if (typeof dialog.showModal !== "function") {
      return Promise.resolve(window.confirm(`${title}

${message}`));
    }
    const heading = el("h2", "cps-dialog-title", title);
    heading.id = "cps-dialog-title";
    dialog.setAttribute("aria-labelledby", heading.id);
    const actions = el("div", "cps-dialog-actions");
    const cancel = el("button", "cps-btn", cancelText);
    cancel.type = "button";
    const confirm = el("button", "cps-btn cps-btn-primary", confirmText);
    confirm.type = "button";
    actions.append(cancel, confirm);
    dialog.append(heading, el("p", "cps-dialog-message", message), actions);
    document.body.append(dialog);
    const returnFocus = document.activeElement;
    return new Promise((resolve) => {
      let settled = false;
      const finish = (result) => {
        if (settled) return;
        settled = true;
        dialog.close();
        dialog.remove();
        if (returnFocus && returnFocus.isConnected) returnFocus.focus();
        resolve(result);
      };
      cancel.addEventListener("click", () => finish(false));
      confirm.addEventListener("click", () => finish(true));
      dialog.addEventListener("cancel", (e) => {
        e.preventDefault();
        finish(false);
      });
      dialog.addEventListener("keydown", (e) => {
        if (e.key === "Escape") e.stopPropagation();
      });
      dialog.showModal();
      cancel.focus();
    });
  }

  // src/subpages.ts
  var descendantsCache = /* @__PURE__ */ new Map();
  var offers = Promise.resolve();
  function descendants(pageId) {
    let ids = descendantsCache.get(pageId);
    if (!ids) {
      ids = getDescendantIds(pageId);
      descendantsCache.set(pageId, ids);
      ids.catch(() => descendantsCache.delete(pageId));
    }
    return ids;
  }
  function offerApplyToSubpages(pageId, field, control, setStatus) {
    const tag = control.value();
    offers = offers.then(() => offer(pageId, field, control, setStatus, tag));
    return offers;
  }
  async function offer(pageId, field, control, setStatus, tag) {
    if (control.value() !== tag) return;
    let ids;
    try {
      ids = await descendants(pageId);
    } catch (err) {
      console.warn("[page-settings] could not list subpages", err);
      return;
    }
    if (!ids.length || control.value() !== tag) return;
    const label = field.label.toLowerCase();
    const pages = `${ids.length} subpage${ids.length === 1 ? "" : "s"}`;
    const apply = await confirmDialog(tag ? {
      title: `Apply ${label} to subpages?`,
      message: `This page has ${pages}. Set their ${label} to \u201C${control.display()}\u201D too?`,
      confirmText: `Apply to ${pages}`,
      cancelText: "Only this page"
    } : {
      title: `Clear ${label} on subpages?`,
      message: `This page has ${pages}. Clear their ${label} too?`,
      confirmText: `Clear on ${pages}`,
      cancelText: "Only this page"
    });
    if (!apply) return;
    let done = 0;
    const failed = [];
    setStatus(`Updating subpages 0/${ids.length}\u2026`);
    await runPool(ids, SUBPAGE_CONCURRENCY, async (id) => {
      try {
        await replaceFieldTag(id, field.prefix, tag);
      } catch (err) {
        failed.push(id);
        console.warn(`[page-settings] could not update subpage ${id}`, err);
      }
      done++;
      setStatus(`Updating subpages ${done}/${ids.length}\u2026`);
    });
    if (failed.length) {
      setStatus(`Updated ${ids.length - failed.length} of ${pages}; ${failed.length} failed.`, "error");
    } else {
      setStatus(`Updated ${pages}.`, "ok");
    }
  }

  // src/panel.ts
  function buildPanel(page, fields) {
    const panel = el("section", "cps-panel");
    panel.setAttribute("aria-label", "Page settings");
    const header = el("div", "cps-header");
    const toggle = el("button", "cps-toggle");
    toggle.type = "button";
    toggle.setAttribute("aria-expanded", "true");
    const toggleIcon = el("span", "cps-toggle-icon", "\u2212");
    toggleIcon.setAttribute("aria-hidden", "true");
    toggle.append(toggleIcon, el("span", null, "Page settings"));
    const status = el("span", "cps-status");
    status.setAttribute("role", "status");
    header.append(toggle, status);
    const body = el("div", "cps-body");
    toggle.addEventListener("click", () => {
      const opening = body.hidden;
      body.hidden = !opening;
      toggle.setAttribute("aria-expanded", String(opening));
      toggleIcon.textContent = opening ? "\u2212" : "+";
    });
    panel.append(header, body);
    if (!page.id) {
      body.append(el("p", "cps-note", "Save the page once to edit its settings."));
      return panel;
    }
    let queue = Promise.resolve();
    const setStatus = (text, kind = "") => {
      status.textContent = text;
      status.dataset.kind = kind;
    };
    const save = (task, onError) => {
      setStatus("Saving\u2026");
      queue = queue.then(task).then(
        () => setStatus("Saved", "ok"),
        (err) => {
          console.warn("[page-settings]", err);
          setStatus("Couldn't save. Try again.", "error");
          if (onError) onError();
        }
      );
    };
    const top = el("div", "cps-top");
    top.append(thumbnailField(page, save, setStatus), summaryField(page, save));
    const scheduleTags = debounce(() => save(() => putTags(page.id, collectTags())), TAG_SAVE_DELAY_MS);
    const row = el("div", "cps-fields");
    const attribution = el("details", "cps-attribution");
    const attributionSummary = el("summary", "cps-attribution-summary");
    const attributionCount = el("span", "cps-attribution-count");
    attributionSummary.append(el("span", null, "Attribution Manager"), attributionCount);
    const roles = el("div", "cps-roles");
    attribution.append(attributionSummary, roles);
    const fieldStates = fields.map((field, i) => {
      const current = page.tags.find((t) => hasPrefix(t, field.prefix)) || "";
      const id = `cps-field-${i}`;
      const onChange = () => {
        updateGuide();
        updateAttributionCount();
        scheduleTags();
        if (field.askApplyToSubpages) offerApplyToSubpages(page.id, field, control, setStatus);
      };
      const control = field.type === "author" ? authorField(field, current, id, onChange) : selectField(field, current, id, onChange);
      (field.group === "attribution" ? roles : row).append(control.node);
      return { field, current, control };
    });
    const roleStates = fieldStates.filter((s) => s.field.group === "attribution");
    function updateAttributionCount() {
      const set = roleStates.filter((s) => s.control.value()).length;
      attributionCount.textContent = `\xB7 ${set} of ${roleStates.length} set`;
    }
    updateAttributionCount();
    attribution.hidden = !roleStates.length;
    const guide = el("fieldset", "cps-guide");
    guide.append(el("legend", "cps-heading", "Guide listing display :"));
    const single = radio("cps-guide", "single", "Single", "Topic hierarchy");
    const tabbed = radio("cps-guide", "tabbed", "Tabbed");
    (page.tags.includes(GUIDE_TABBED_TAG) ? tabbed : single).input.checked = true;
    [single, tabbed].forEach((r) => r.input.addEventListener("change", scheduleTags));
    guide.append(single.node, tabbed.node);
    const articleState = fieldStates.find((s) => s.field.prefix.toLowerCase() === ARTICLE_PREFIX);
    const isGuide = () => !!articleState && articleState.control.value() === GUIDE_TAG;
    function updateGuide() {
      guide.hidden = !isGuide();
    }
    updateGuide();
    const fieldTags = new Set(fieldStates.map((s) => s.current).filter(Boolean));
    const freeTags = page.tags.filter((t) => !fieldTags.has(t) && t !== GUIDE_TABBED_TAG);
    const tagsNode = tagsField(freeTags, scheduleTags);
    function collectTags() {
      const all = [...freeTags];
      fieldStates.forEach((s) => {
        const v = s.control.value();
        if (v) all.push(v);
      });
      if (isGuide() && tabbed.input.checked) all.push(GUIDE_TABBED_TAG);
      return [...new Set(all)];
    }
    body.append(top, guide, row, attribution, tagsNode);
    return panel;
  }

  // src/index.ts
  var tryMount = () => {
    const original = document.getElementById("mt-summary");
    const data = document.getElementById("cps-data");
    if (original && data && !data.dataset.cpsMounted) {
      data.dataset.cpsMounted = "true";
      mount(original, data);
    }
  };
  new MutationObserver(tryMount).observe(document.documentElement, { childList: true, subtree: true });
  tryMount();
  function mount(original, data) {
    const settings = parseSettings(data.textContent || "");
    const page = {
      id: Number(settings.pageId) || 0,
      summary: String(settings.summary || ""),
      thumbnail: String(settings.thumbnail || ""),
      tags: Array.isArray(settings.tags) ? settings.tags.map(String).filter(Boolean) : []
    };
    original.replaceWith(buildPanel(page, FIELDS));
  }
  function parseSettings(json) {
    try {
      const settings = JSON.parse(json.trim() || "{}");
      return settings && typeof settings === "object" ? settings : {};
    } catch (err) {
      console.warn("[page-settings] could not read page settings", err);
      return {};
    }
  }
})();
