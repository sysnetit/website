/* Logs page: a readable record of changes on the Orders page, e.g.
   "21/09/26 14:32  Takako added 2 tofu and 3 natto". */
(function () {
  'use strict';
  var $ = Site.$, el = Site.el;

  function joinEn(parts) {
    if (parts.length <= 1) return parts.join('');
    return parts.slice(0, -1).join(', ') + ' and ' + parts[parts.length - 1];
  }
  function itemsEn(items) {
    return joinEn(items.map(function (i) { return i.qty + ' ' + String(i.item).toLowerCase(); }));
  }
  function itemsJa(items) {
    return items.map(function (i) { return (Site.itemJa(i.item) || i.item) + '×' + i.qty; }).join('、');
  }

  // Older Code.gs has no change log: rebuild "added" entries from the order rows
  // (one order is saved as one row per item, all sharing the same time and name).
  function eventsFromOrders(orders) {
    var groups = new Map();
    orders.forEach(function (o) {
      var name = String(o.name || '').trim();
      var qty = Number(o.qty) || 0;
      if (!name || !o.item || qty < 1) return;
      var d = new Date(o.time);
      var ts = isNaN(d.getTime()) ? 0 : d.getTime();
      var key = Math.floor(ts / 1000) + '|' + name.toLowerCase() + '|' + (ts ? '' : o.time);
      var g = groups.get(key);
      if (!g) {
        g = { time: o.time, name: name, action: 'added', items: [], before: [], collection: '', notes: [] };
        groups.set(key, g);
      }
      g.items.push({ section: o.section, item: o.item, qty: qty });
      if (o.collection) g.collection = o.collection;
      if (o.note && g.notes.indexOf(o.note) === -1) g.notes.push(o.note);
    });
    return Array.from(groups.values()).map(function (g) {
      return { time: g.time, name: g.name, action: g.action, items: g.items, before: [], collection: g.collection, note: g.notes.join(' / ') };
    });
  }

  function normalise(data) {
    if (Array.isArray(data.events)) return data.events;
    if (Array.isArray(data.orders)) return eventsFromOrders(data.orders);
    return [];
  }

  function sentence(ev) {
    var n = ev.name;
    switch (ev.action) {
      case 'added':
        return { en: ' added ' + itemsEn(ev.items), ja: n + 'さんが' + itemsJa(ev.items) + 'を追加しました。' };
      case 'changed':
        return { en: ' changed their order to ' + itemsEn(ev.items), ja: n + 'さんが注文を変更しました：' + itemsJa(ev.items) };
      case 'removed':
        return { en: ' removed their order', ja: n + 'さんが注文を取り消しました。' };
      default:
        return { en: ' ' + ev.action, ja: '' };
    }
  }

  function metaLines(ev) {
    var en = [], ja = [];
    if (ev.action === 'changed' && ev.before.length) {
      en.push('Before: ' + itemsEn(ev.before)); ja.push('変更前：' + itemsJa(ev.before));
    }
    if (ev.action === 'removed' && ev.before.length) {
      en.push('Was: ' + itemsEn(ev.before)); ja.push('取り消した注文：' + itemsJa(ev.before));
    }
    if (ev.action !== 'removed' && ev.collection) {
      en.push('Collect from ' + ev.collection); ja.push('受け取り：' + ev.collection);
    }
    if (ev.action !== 'removed' && ev.note) {
      en.push('Note: ' + ev.note); ja.push('メモ：' + ev.note);
    }
    return { en: en.join(' · '), ja: ja.join(' ・ ') };
  }

  function render(events) {
    var list = $('#log-list');
    list.textContent = '';

    var rows = events.map(function (ev, i) {
      var d = new Date(ev.time);
      return { ev: ev, i: i, date: isNaN(d.getTime()) ? null : d, ts: isNaN(d.getTime()) ? 0 : d.getTime() };
    }).sort(function (a, b) { return (b.ts - a.ts) || (b.i - a.i); });   // newest first

    $('#log-empty').hidden = rows.length > 0;

    rows.forEach(function (r) {
      var ev = r.ev;
      var li = el('li', null, 'log');

      var when = el('time', r.date ? Site.shortDate(r.date) + ' ' + Site.shortTime(r.date) : 'Unknown time', 'log-when');
      if (r.date) when.dateTime = r.date.toISOString();
      li.appendChild(when);

      // Small icons for the kinds of things involved (daifuku, tofu, natto)
      var seen = {}, icons = el('span', null, 'log-icons');
      (ev.items.length ? ev.items : ev.before).forEach(function (it) {
        var name = Site.sectionIcon(it.section);
        if (name && !seen[name]) { seen[name] = true; icons.appendChild(Icons.el(name)); }
      });
      if (icons.children.length) li.appendChild(icons);

      var s = sentence(ev);
      var text = el('p', null, 'log-text');
      text.appendChild(el('strong', ev.name));
      text.appendChild(document.createTextNode(s.en));
      if (s.ja) text.appendChild(Site.jaLine(s.ja));
      li.appendChild(text);

      var m = metaLines(ev);
      if (m.en) {
        var meta = el('p', m.en, 'log-meta');
        meta.appendChild(Site.jaLine(m.ja));
        li.appendChild(meta);
      }
      list.appendChild(li);
    });
  }

  function stamp() {
    var t = Site.shortTime(new Date());
    var node = $('#updated');
    node.textContent = 'Updated ' + t;
    node.appendChild(Site.jaInline('更新'));
  }

  var gate = Site.gate({
    verify: function (code) { return Site.get({ action: 'log', code: code }); },
    onOpen: function (data) { render(normalise(data)); stamp(); }
  });

  function refresh() {
    var code = Site.getCode();
    if (!Site.configured() || !code) return Promise.resolve();
    return Site.get({ action: 'log', code: code }).then(function (data) {
      if (!data.ok) {
        if (data.error === 'bad_code') gate.lock(Site.MSG.badCode);
        return;
      }
      render(normalise(data));
      stamp();
    }).catch(function () {
      var node = $('#updated');
      node.textContent = Site.MSG.retrying.en;
      node.appendChild(Site.jaLine(Site.MSG.retrying.ja));
    });
  }

  $('#refresh').addEventListener('click', refresh);
  setInterval(function () { if (!document.hidden && !$('#app').hidden) refresh(); }, 30000);
})();
