/* Orders page: the group order form and everyone's order tables.
   Ported from the original single-page order form; behaviour is unchanged. */
(function () {
  'use strict';
  var $ = Site.$, el = Site.el, setStatus = Site.setStatus;

  // ---- Edit these -------------------------------------------------------
  // Prices marked null were not in the sample data yet: fill them in.
  var CONFIG = {
    collections: [
      { value: 'Takako', label: 'Takako’s house  貴子さん宅' },
      { value: 'Emiko', label: 'Emiko’s house  恵美子さん宅' }
    ],
    sections: [
      {
        key: '大福', gloss: 'Daifuku', unit: 'pack',
        products: [
          { name: 'Chocolate', price: 3.80 },
          { name: 'Matcha', price: 4.00 },
          { name: 'Shiro', price: 3.50 },
          { name: 'Yuzu', price: null },
          { name: 'Kuromame', price: 3.00 },
          { name: 'Calamansi', price: 3.50 },
          { name: 'Dango', price: 7.00 }
        ]
      },
      {
        key: 'お豆腐', gloss: 'Tofu',
        products: [
          { name: 'Tofu', price: 3.00 },
          { name: 'Ganmodoki', price: 3.50 },
          { name: 'Atsuage', price: 3.30 },
          { name: 'Azuki Donuts', price: 2.50 },
          { name: 'Cinnamon Donuts', price: 2.00 },
          { name: 'Soya milk', price: 2.30 },
          { name: 'Soya pulp', price: 0.50 },
          { name: 'Soya beans', price: 2.00 },
          { name: 'Aduki beans', price: 2.50 },
          { name: 'Nigari', price: 1.50 }
        ]
      },
      {
        key: '納豆', gloss: 'Natto',
        products: [
          { name: 'Natto', price: 3.20 },
          { name: 'Salt koji', price: 3.70 },
          { name: 'Soy sauce koji', price: null },
          { name: 'Onion koji', price: 4.20 },
          { name: 'Kimchi', price: 4.50 },
          { name: 'Amazake', price: 5.50 },
          { name: 'Red bean', price: null },
          { name: 'Karaage', price: 5.50 },
          { name: 'Item 9 (name to be confirmed)', price: 7.00 }
        ]
      }
    ]
  };
  // -----------------------------------------------------------------------

  function money(n) { return '£' + n.toFixed(2); }
  function headingParts(sec) {
    var jp = document.createElement('span');
    jp.lang = 'ja';
    jp.textContent = sec.key;
    var gl = document.createElement('span');
    gl.className = 'gloss';
    gl.textContent = sec.gloss;
    return [jp, document.createTextNode(' '), gl];
  }

  // ---- Order form ---------------------------------------------------------
  function buildForm() {
    var choices = $('#collection-choices');
    var savedCollection = Site.store.get('order_collection');
    CONFIG.collections.forEach(function (c) {
      var label = document.createElement('label');
      label.className = 'choice';
      var radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = 'collection';
      radio.value = c.value;
      radio.checked = (c.value === savedCollection);
      var span = document.createElement('span');
      span.textContent = c.label;
      label.appendChild(radio);
      label.appendChild(span);
      choices.appendChild(label);
    });

    var host = $('#sections');
    CONFIG.sections.forEach(function (sec, si) {
      var fs = document.createElement('fieldset');
      fs.className = 'section';
      var lg = document.createElement('legend');
      headingParts(sec).forEach(function (n) { lg.appendChild(n); });
      fs.appendChild(lg);

      var list = document.createElement('ul');
      list.className = 'products';
      sec.products.forEach(function (p, pi) {
        var id = 'p-' + si + '-' + pi;
        var li = document.createElement('li');
        li.className = 'product';

        var text = document.createElement('div');
        var nm = el('div', p.name, 'product-name');
        nm.id = id + '-name';
        var d = el('div', (p.price == null)
          ? 'Price to be confirmed'
          : money(p.price) + (sec.unit ? ' per ' + sec.unit : ''), 'product-detail');
        text.appendChild(nm);
        text.appendChild(d);

        var step = document.createElement('div');
        step.className = 'stepper';
        var minus = document.createElement('button');
        minus.type = 'button';
        minus.textContent = '−';
        minus.setAttribute('aria-label', 'One fewer ' + p.name);
        var input = document.createElement('input');
        input.type = 'number';
        input.min = '0';
        input.max = '99';
        input.value = '0';
        input.inputMode = 'numeric';
        input.dataset.section = String(si);
        input.dataset.item = p.name;
        input.dataset.price = (p.price == null) ? '' : String(p.price);
        input.setAttribute('aria-labelledby', id + '-name');
        var plus = document.createElement('button');
        plus.type = 'button';
        plus.textContent = '+';
        plus.setAttribute('aria-label', 'One more ' + p.name);

        function bump(delta) {
          var v = Math.max(0, Math.min(99, (parseInt(input.value, 10) || 0) + delta));
          input.value = String(v);
          updateTotal();
        }
        minus.addEventListener('click', function () { bump(-1); });
        plus.addEventListener('click', function () { bump(1); });

        step.appendChild(minus);
        step.appendChild(input);
        step.appendChild(plus);
        li.appendChild(text);
        li.appendChild(step);
        list.appendChild(li);
      });
      fs.appendChild(list);

      var field = document.createElement('div');
      field.className = 'field';
      var nl = document.createElement('label');
      nl.htmlFor = 'note-' + si;
      nl.textContent = 'Note (optional)';
      var note = document.createElement('input');
      note.type = 'text';
      note.id = 'note-' + si;
      note.maxLength = 200;
      field.appendChild(nl);
      field.appendChild(note);
      fs.appendChild(field);

      host.appendChild(fs);
    });

    $('#sections').addEventListener('input', updateTotal);
  }

  function updateTotal() {
    var sum = 0, unknown = false;
    Site.$all('#sections input[data-item]').forEach(function (inp) {
      var q = parseInt(inp.value, 10) || 0;
      if (q < 1) return;
      if (inp.dataset.price === '') { unknown = true; return; }
      sum += Math.min(q, 99) * parseFloat(inp.dataset.price);
    });
    $('#total').textContent = money(sum);
    $('#total-note').textContent = unknown ? '+ items with no price yet' : '';
  }

  function stamp() {
    $('#updated').textContent = 'Updated ' + Site.shortTime(new Date());
  }

  // ---- Rendering the order tables -------------------------------------------
  function render(orders) {
    var board = $('#board');
    board.textContent = '';
    var anyUnknown = false;

    CONFIG.sections.forEach(function (sec) {
      var prices = Object.create(null);
      sec.products.forEach(function (p) { prices[p.name] = p.price; });

      var columns = sec.products.map(function (p) { return p.name; });
      var colTotals = Object.create(null);
      var people = new Map();

      orders.forEach(function (o) {
        if (o.section !== sec.key || !o.item) return;
        var key = String(o.name || '').trim().toLowerCase();
        var qty = Number(o.qty) || 0;
        if (!key || qty < 1) return;
        if (columns.indexOf(o.item) === -1) columns.push(o.item); // item no longer in CONFIG
        var p = people.get(key);
        if (!p) {
          p = { name: String(o.name).trim(), collection: '', items: Object.create(null), notes: [] };
          people.set(key, p);
        }
        p.items[o.item] = (p.items[o.item] || 0) + qty;
        colTotals[o.item] = (colTotals[o.item] || 0) + qty;
        if (o.collection) p.collection = o.collection;
        if (o.note && p.notes.indexOf(o.note) === -1) p.notes.push(o.note);
      });

      var block = el('section', null, 'board-block');
      var h = el('h3');
      headingParts(sec).forEach(function (n) { h.appendChild(n); });
      block.appendChild(h);

      if (people.size === 0) {
        block.appendChild(el('p', 'No orders yet.', 'empty'));
        board.appendChild(block);
        return;
      }

      function sumFor(items) {
        var sum = 0, unknown = false;
        Object.keys(items).forEach(function (item) {
          var price = prices[item];
          if (price == null) unknown = true; else sum += items[item] * price;
        });
        if (unknown) anyUnknown = true;
        return money(sum) + (unknown ? '+' : '');
      }

      var wrap = el('div', null, 'table-wrap');
      var table = document.createElement('table');
      table.appendChild(el('caption', sec.key + ' orders', 'sr-only'));

      var head = document.createElement('tr');
      ['Name', 'Collect'].concat(columns, ['£', 'Note']).forEach(function (t) {
        var th = el('th', t);
        th.scope = 'col';
        head.appendChild(th);
      });
      var thead = document.createElement('thead');
      thead.appendChild(head);
      table.appendChild(thead);

      var tbody = document.createElement('tbody');
      people.forEach(function (p) {
        var tr = document.createElement('tr');
        tr.appendChild(el('td', p.name));
        tr.appendChild(el('td', p.collection));
        columns.forEach(function (c) { tr.appendChild(el('td', p.items[c] ? String(p.items[c]) : '')); });
        tr.appendChild(el('td', sumFor(p.items), 'money'));
        tr.appendChild(el('td', p.notes.join(' / '), 'note'));
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);

      var foot = document.createElement('tr');
      foot.appendChild(el('td', 'Total'));
      foot.appendChild(el('td', ''));
      columns.forEach(function (c) { foot.appendChild(el('td', String(colTotals[c] || 0))); });
      foot.appendChild(el('td', sumFor(colTotals), 'money'));
      foot.appendChild(el('td', ''));
      var tfoot = document.createElement('tfoot');
      tfoot.appendChild(foot);
      table.appendChild(tfoot);

      wrap.appendChild(table);
      block.appendChild(wrap);
      board.appendChild(block);
    });

    $('#board-note').textContent = anyUnknown
      ? 'A + after a total means some items don’t have a price yet.'
      : '';
  }

  // ---- Talking to the sheet -----------------------------------------------
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

  $('#order-form').addEventListener('submit', function (ev) {
    ev.preventDefault();
    var status = $('#order-status');
    var name = $('#name').value.trim();
    var chosen = document.querySelector('input[name="collection"]:checked');

    var items = [];
    var perSection = {};
    Site.$all('#sections input[data-item]').forEach(function (inp) {
      var q = parseInt(inp.value, 10) || 0;
      if (q < 1) return;
      var si = Number(inp.dataset.section);
      perSection[si] = true;
      items.push({
        section: CONFIG.sections[si].key,
        item: inp.dataset.item,
        qty: Math.min(q, 99),
        note: $('#note-' + si).value.trim()
      });
    });

    if (!name) { setStatus(status, 'Enter your name.', true); return; }
    if (!chosen) { setStatus(status, 'Choose where you will collect.', true); return; }
    if (items.length === 0) { setStatus(status, 'Choose at least one item.', true); return; }
    for (var i = 0; i < CONFIG.sections.length; i++) {
      if (!perSection[i] && $('#note-' + i).value.trim()) {
        setStatus(status, 'You wrote a note for ' + CONFIG.sections[i].key + ' but chose no items there. Add an item or clear the note.', true);
        return;
      }
    }

    var btn = $('#send');
    btn.disabled = true;
    btn.textContent = 'Sending…';
    setStatus(status, '');

    Site.post({ code: Site.getCode(), name: name, collection: chosen.value, items: items })
      .then(function (data) {
        if (data.ok) {
          Site.setName(name);
          Site.store.set('order_collection', chosen.value);
          Site.$all('#sections input[data-item]').forEach(function (inp) { inp.value = '0'; });
          CONFIG.sections.forEach(function (s, si) { $('#note-' + si).value = ''; });
          updateTotal();
          setStatus(status, 'Order sent. Thanks, ' + name + '.');
          return refresh();
        }
        if (data.error === 'bad_code') {
          gate.lock('The passcode changed. Enter the new one.');
        } else {
          setStatus(status, 'The order was not accepted. Check your name, collection and quantities.', true);
        }
      })
      .catch(function () {
        setStatus(status, 'Could not send the order. Check your connection and try again.', true);
      })
      .then(function () {
        btn.disabled = false;
        btn.textContent = 'Send order';
      });
  });

  $('#refresh').addEventListener('click', refresh);

  // ---- Start --------------------------------------------------------------
  buildForm();
  $('#name').value = Site.getName();
  setInterval(function () {
    if (!document.hidden && !$('#app').hidden) refresh();
  }, 30000);
})();
