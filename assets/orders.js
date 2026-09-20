/* Orders page: the group order form, amending your own order, and everyone's order tables.
   Each person has ONE current order (matched by name). Saving replaces it; removing deletes it. */
(function () {
  'use strict';
  var $ = Site.$, el = Site.el, B = Site.bi, setStatus = Site.setStatus;

  // ---- Edit these -------------------------------------------------------
  // Prices marked null were not in the sample data yet: fill them in.
  // Item names are what is stored in the Sheet; their Japanese names live in assets/site.js.
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

  var M = {
    needName:   B('Enter your name.', 'お名前を入力してください。'),
    needPlace:  B('Choose where you will collect.', '受け取り場所を選んでください。'),
    needItem:   B('Choose at least one item.', '商品を1つ以上選んでください。'),
    needItemAm: B('Choose at least one item, or use “Remove my order”.', '商品を1つ以上選ぶか、「注文を取り消す」を使ってください。'),
    noChange:   B('No changes to save.', '変更はありません。'),
    removed:    B('Your order has been removed.', '注文を取り消しました。'),
    rejected:   B('The order was not accepted. Check your name, collection and quantities.', '注文を受け付けられませんでした。お名前、受け取り場所、数量をご確認ください。'),
    sendFail:   B('Could not send the order. Check your connection and try again.', '注文を送信できませんでした。接続を確認してもう一度お試しください。'),
    removeFail: B('Could not remove the order. Check your connection and try again.', '注文を取り消せませんでした。接続を確認してもう一度お試しください。')
  };

  function money(n) { return '£' + n.toFixed(2); }
  function keyOf(name) { return String(name || '').trim().toLowerCase(); }

  // Section heading: icon + Japanese name + English name
  function headingParts(sec) {
    var parts = [];
    var ic = Site.sectionIcon(sec.key);
    if (ic) parts.push(Icons.el(ic));
    var jp = document.createElement('span');
    jp.lang = 'ja';
    jp.textContent = sec.key;
    var gl = document.createElement('span');
    gl.className = 'gloss';
    gl.textContent = sec.gloss;
    parts.push(jp, document.createTextNode(' '), gl);
    return parts;
  }

  function sectionIndex(key) {
    for (var i = 0; i < CONFIG.sections.length; i++) if (CONFIG.sections[i].key === key) return i;
    return -1;
  }

  // ---- State ------------------------------------------------------------------
  var lastOrders = [];    // every order row from the Sheet
  var canAmend = false;   // true when Code.gs is the version that can replace/remove orders
  var prefilledKey = '';  // whose order is currently loaded into the form
  var extras = [];        // rows of the loaded order for items no longer on the form (kept as they are)
  var gate;

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
        var jaName = Site.itemJa(p.name);
        if (jaName) nm.appendChild(Site.jaInline(jaName));
        var detail = (p.price == null)
          ? 'Price to be confirmed · 価格未定'
          : money(p.price) + (sec.unit ? ' per ' + sec.unit + ' · 1パック' : '');
        var d = el('div', detail, 'product-detail');
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
      nl.appendChild(Site.jaInline('メモ（任意）'));
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
    var note = $('#total-note');
    note.textContent = '';
    if (unknown) {
      note.appendChild(document.createTextNode('+ items with no price yet'));
      note.appendChild(Site.jaInline('+ 価格未定の商品'));
    }
  }

  // ---- Amending your own order ------------------------------------------------
  function existingFor(name) {
    var k = keyOf(name);
    if (!k) return null;
    var rows = lastOrders.filter(function (o) { return keyOf(o.name) === k && o.item && Number(o.qty) >= 1; });
    return rows.length ? rows : null;
  }

  function resetForm() {
    Site.$all('#sections input[data-item]').forEach(function (inp) { inp.value = '0'; });
    CONFIG.sections.forEach(function (s, si) { $('#note-' + si).value = ''; });
    extras = [];
  }

  // Switches the wording between a first order and amending an existing one.
  function setAmendUi(amending) {
    $('#amend-banner').hidden = !amending;
    $('#remove').hidden = !amending;
    $('#remove-confirm').hidden = true;
    var h = $('#order-heading');
    h.textContent = amending ? 'Amend your order ' : 'Your order ';
    h.appendChild(Site.jaInline(amending ? '注文の変更' : 'あなたの注文'));
    Site.setLabel($('#send'), amending ? 'Update my order' : 'Send order', amending ? '注文を更新' : '注文を送信');
  }

  // Loads the person's current order (if any) into the form so they can change it.
  function applyExisting(force) {
    if (!canAmend) { setAmendUi(false); return; }
    var name = $('#name').value;
    var k = keyOf(name);
    var rows = existingFor(name);

    if (!rows) {
      if (prefilledKey) { resetForm(); updateTotal(); }   // do not carry someone else's order over to a new name
      prefilledKey = '';
      setAmendUi(false);
      return;
    }
    if (k === prefilledKey && !force) return;             // already loaded: keep any edits in progress

    resetForm();
    var inputs = {};
    Site.$all('#sections input[data-item]').forEach(function (inp) { inputs[inp.dataset.section + '|' + inp.dataset.item] = inp; });
    var collection = '';
    rows.forEach(function (o) {
      var si = sectionIndex(o.section);
      var inp = inputs[si + '|' + o.item];
      var qty = Number(o.qty);
      if (inp) inp.value = String(Math.min(99, (parseInt(inp.value, 10) || 0) + qty));
      else extras.push({ section: o.section, item: o.item, qty: qty, note: o.note || '' });
      if (si >= 0 && o.note) $('#note-' + si).value = o.note;
      if (o.collection) collection = o.collection;
    });
    Site.$all('input[name="collection"]').forEach(function (r) { r.checked = (r.value === collection); });

    updateTotal();
    prefilledKey = k;
    setAmendUi(true);
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
        var key = keyOf(o.name);
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
        var none = el('p', 'No orders yet.', 'empty');
        none.appendChild(Site.jaLine('まだ注文はありません。'));
        block.appendChild(none);
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

      function th(en, ja) {
        var c = el('th', en);
        c.scope = 'col';
        if (ja) { var j = el('span', ja, 'th-ja'); j.lang = 'ja'; c.appendChild(j); }
        return c;
      }

      var wrap = el('div', null, 'table-wrap');
      var table = document.createElement('table');
      table.appendChild(el('caption', sec.key + ' orders', 'sr-only'));

      var head = document.createElement('tr');
      head.appendChild(th('Name', 'お名前'));
      head.appendChild(th('Collect', '受取'));
      columns.forEach(function (c) { head.appendChild(th(c, Site.itemJa(c))); });
      head.appendChild(th('£', ''));
      head.appendChild(th('Note', 'メモ'));
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
      var totalCell = el('td', 'Total');
      totalCell.appendChild(Site.jaInline('合計'));
      foot.appendChild(totalCell);
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

    var bn = $('#board-note');
    bn.textContent = '';
    if (anyUnknown) {
      bn.appendChild(document.createTextNode('A + after a total means some items don’t have a price yet.'));
      bn.appendChild(Site.jaLine('合計の後の + は、価格未定の商品が含まれることを示します。'));
    }
  }

  function stamp() {
    var t = Site.shortTime(new Date());
    var node = $('#updated');
    node.textContent = 'Updated ' + t;
    node.appendChild(Site.jaInline('更新'));
  }

  // ---- Talking to the sheet -----------------------------------------------
  function takeData(data) {
    lastOrders = data.orders || [];
    canAmend = data.version >= 2;      // older Code.gs has no version: orders can only be added
    render(lastOrders);
    stamp();
  }

  gate = Site.gate({
    verify: function (code) { return Site.get({ code: code }); },
    onOpen: function (data) { takeData(data); applyExisting(true); }
  });

  function refresh() {
    var code = Site.getCode();
    if (!Site.configured() || !code) return Promise.resolve();
    return Site.get({ code: code }).then(function (data) {
      if (!data.ok) {
        if (data.error === 'bad_code') gate.lock(Site.MSG.badCode);
        return;
      }
      takeData(data);
    }).catch(function () {
      var node = $('#updated');
      node.textContent = Site.MSG.retrying.en;
      node.appendChild(Site.jaLine(Site.MSG.retrying.ja));
    });
  }

  function collectItems() {
    var items = [], perSection = {};
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
    return { items: items, perSection: perSection };
  }

  $('#order-form').addEventListener('submit', function (ev) {
    ev.preventDefault();
    var status = $('#order-status');
    var name = $('#name').value.trim();
    var chosen = document.querySelector('input[name="collection"]:checked');
    var collected = collectItems();
    var items = collected.items;
    var amending = canAmend && !!existingFor(name);

    // Items that were in the old order but are no longer on the form stay exactly as they were.
    if (amending && keyOf(name) === prefilledKey) items = items.concat(extras);

    if (!name) { setStatus(status, M.needName, true); return; }
    if (!chosen) { setStatus(status, M.needPlace, true); return; }
    if (items.length === 0) { setStatus(status, amending ? M.needItemAm : M.needItem, true); return; }
    for (var i = 0; i < CONFIG.sections.length; i++) {
      if (!collected.perSection[i] && $('#note-' + i).value.trim()) {
        setStatus(status, B('You wrote a note for ' + CONFIG.sections[i].key + ' but chose no items there. Add an item or clear the note.',
          CONFIG.sections[i].key + ' にメモがありますが、商品が選ばれていません。商品を追加するか、メモを消してください。'), true);
        return;
      }
    }

    var btn = $('#send');
    btn.disabled = true;
    Site.setLabel(btn, 'Sending…', '送信中…');
    setStatus(status, '');

    var body = { code: Site.getCode(), name: name, collection: chosen.value, items: items };
    if (canAmend) body.action = 'saveOrder';     // replaces this person's order; older Code.gs just adds

    var message = null;
    Site.post(body)
      .then(function (data) {
        if (data.ok) {
          Site.setName(name);
          Site.store.set('order_collection', chosen.value);
          if (data.result === 'unchanged') message = M.noChange;
          else if (data.result === 'changed') message = B('Order updated. Thanks, ' + name + '.', 'ご注文を更新しました。ありがとうございます、' + name + 'さん。');
          else message = B('Order sent. Thanks, ' + name + '.', 'ご注文を送信しました。ありがとうございます、' + name + 'さん。');
          if (!canAmend) { resetForm(); updateTotal(); }
          return refresh().then(function () { applyExisting(true); setStatus(status, message); });
        }
        if (data.error === 'bad_code') gate.lock(Site.MSG.codeChanged);
        else setStatus(status, M.rejected, true);
      })
      .catch(function () { setStatus(status, M.sendFail, true); })
      .then(function () {
        btn.disabled = false;
        setAmendUi(canAmend && !!existingFor($('#name').value));
      });
  });

  // ---- Removing your order (with a confirmation step) -----------------------------
  $('#remove').addEventListener('click', function () { $('#remove-confirm').hidden = false; });
  $('#remove-no').addEventListener('click', function () { $('#remove-confirm').hidden = true; });
  $('#remove-yes').addEventListener('click', function () {
    var status = $('#order-status');
    var name = $('#name').value.trim();
    $('#remove-confirm').hidden = true;
    if (!name) { setStatus(status, M.needName, true); return; }
    setStatus(status, '');

    Site.post({ action: 'removeOrder', code: Site.getCode(), name: name })
      .then(function (data) {
        if (data.ok) {
          return refresh().then(function () {
            resetForm(); updateTotal(); prefilledKey = '';
            applyExisting(true);
            setStatus(status, M.removed);
          });
        }
        if (data.error === 'bad_code') gate.lock(Site.MSG.codeChanged);
        else setStatus(status, M.removeFail, true);
      })
      .catch(function () { setStatus(status, M.removeFail, true); });
  });

  // Changing the name loads that person's current order (if they have one)
  $('#name').addEventListener('change', function () { applyExisting(false); });
  $('#refresh').addEventListener('click', refresh);

  // ---- Start --------------------------------------------------------------
  buildForm();
  $('#name').value = Site.getName();
  setInterval(function () {
    if (!document.hidden && !$('#app').hidden) refresh();
  }, 30000);
})();
