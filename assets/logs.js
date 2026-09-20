/* Logs page: turns the rows of the Orders sheet into readable lines such as
   "21/09/26 14:32  Takako added 2 tofu and 3 natto". */
(function () {
  'use strict';
  var $ = Site.$, el = Site.el;

  function joinList(parts) {
    if (parts.length <= 1) return parts.join('');
    return parts.slice(0, -1).join(', ') + ' and ' + parts[parts.length - 1];
  }

  // One order is saved as one row per item, all sharing the same time and name.
  function buildLog(orders) {
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
        g = { ts: ts, date: ts ? d : null, name: name, items: [], byItem: Object.create(null), collection: '', notes: [] };
        groups.set(key, g);
      }
      if (g.byItem[o.item] == null) { g.byItem[o.item] = 0; g.items.push(o.item); }
      g.byItem[o.item] += qty;
      if (o.collection) g.collection = o.collection;
      if (o.note && g.notes.indexOf(o.note) === -1) g.notes.push(o.note);
    });

    return Array.from(groups.values()).sort(function (a, b) { return b.ts - a.ts; });
  }

  function render(orders) {
    var list = $('#log-list');
    list.textContent = '';
    var entries = buildLog(orders);
    $('#log-empty').hidden = entries.length > 0;

    entries.forEach(function (g) {
      var li = el('li', null, 'log');

      var when = el('time', g.date ? Site.shortDate(g.date) + ' ' + Site.shortTime(g.date) : 'Unknown time', 'log-when');
      if (g.date) when.dateTime = g.date.toISOString();
      li.appendChild(when);

      var text = el('p', null, 'log-text');
      text.appendChild(el('strong', g.name));
      var what = g.items.map(function (item) { return g.byItem[item] + ' ' + item.toLowerCase(); });
      text.appendChild(document.createTextNode(' added ' + joinList(what)));
      li.appendChild(text);

      var meta = [];
      if (g.collection) meta.push('Collect from ' + g.collection);
      if (g.notes.length) meta.push('Note: ' + g.notes.join(' / '));
      if (meta.length) li.appendChild(el('p', meta.join(' · '), 'log-meta'));

      list.appendChild(li);
    });
  }

  function stamp() {
    $('#updated').textContent = 'Updated ' + Site.shortTime(new Date());
  }

  var gate = Site.gate({
    verify: function (code) { return Site.get({ code: code }); },
    onOpen: function (data) { render(data.orders || []); stamp(); }
  });

  function refresh() {
    var code = Site.getCode();
    if (!Site.configured() || !code) return Promise.resolve();
    return Site.get({ code: code }).then(function (data) {
      if (!data.ok) {
        if (data.error === 'bad_code') gate.lock('That passcode was not accepted. Try again.');
        return;
      }
      render(data.orders || []);
      stamp();
    }).catch(function () {
      $('#updated').textContent = 'Could not reach the sheet. Retrying soon.';
    });
  }

  $('#refresh').addEventListener('click', refresh);
  setInterval(function () { if (!document.hidden && !$('#app').hidden) refresh(); }, 30000);
})();
