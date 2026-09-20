/* Haircut page: one schedule of one-hour slots from 09:00 to 17:00, booked by name. */
(function () {
  'use strict';
  var $ = Site.$, el = Site.el, B = Site.bi;

  // Slot start times: 09:00, 10:00 ... 16:00 (the last slot ends at 17:00).
  var FIRST_HOUR = 9, LAST_END_HOUR = 17;

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  var TIMES = [];
  for (var h = FIRST_HOUR; h < LAST_END_HOUR; h++) TIMES.push(pad(h) + ':00');
  function slotLabel(t) { return t + ' – ' + pad(parseInt(t, 10) + 1) + ':00'; }

  var bookings = [];
  var busy = false;

  var nameInput = $('#hc-name'), status = $('#hc-status');

  var M = {
    needName:  B('Please enter your name first.', '先にお名前を入力してください。'),
    saving:    B('Saving…', '保存中…'),
    taken:     B('Sorry, someone has just booked that slot. Please choose another.', '申し訳ありません、その枠はたった今予約されました。別の枠をお選びください。'),
    notYours:  B('Only the person who booked can cancel this slot.', '予約した本人のみキャンセルできます。'),
    rejected:  B('That was not accepted. Check your name and try again.', '受け付けられませんでした。お名前を確認してもう一度お試しください。'),
    notReady:  B('The haircut schedule is not set up yet. ' + Site.MSG.needUpdate.en, '散髪のスケジュールはまだ設定されていません。' + Site.MSG.needUpdate.ja)
  };

  function bookingAt(t) {
    for (var i = 0; i < bookings.length; i++) if (bookings[i].time === t) return bookings[i];
    return null;
  }

  function render() {
    var me = nameInput.value.trim().toLowerCase();
    var body = $('#slots');
    body.textContent = '';

    TIMES.forEach(function (t) {
      var b = bookingAt(t);
      var tr = document.createElement('tr');

      var th = document.createElement('th');
      th.scope = 'row';
      var wrap = el('span', null, 'slot-time');
      wrap.appendChild(document.createTextNode(slotLabel(t)));
      th.appendChild(wrap);
      tr.appendChild(th);

      var nameCell = document.createElement('td');
      var actionCell = el('td', null, 'action');
      if (b) {
        nameCell.appendChild(el('span', b.name, 'slot-name'));
        if (me && b.name.trim().toLowerCase() === me) {
          var cancel = el('button', 'Cancel', 'btn btn-quiet btn-small');
          cancel.type = 'button';
          cancel.appendChild(Site.jaInline('キャンセル'));
          cancel.setAttribute('aria-label', 'Cancel ' + slotLabel(t));
          cancel.addEventListener('click', function () { cancelSlot(t, b.name); });
          actionCell.appendChild(cancel);
        }
      } else {
        var free = el('span', 'Available', 'slot-free');
        free.appendChild(Site.jaInline('空き'));
        nameCell.appendChild(free);
        var book = el('button', 'Book', 'btn btn-green btn-small');
        book.type = 'button';
        book.appendChild(Site.jaInline('予約'));
        book.setAttribute('aria-label', 'Book ' + slotLabel(t));
        book.addEventListener('click', function () { bookSlot(t); });
        actionCell.appendChild(book);
      }
      tr.appendChild(nameCell);
      tr.appendChild(actionCell);
      body.appendChild(tr);
    });
  }

  function stamp() {
    var t = Site.shortTime(new Date());
    var node = $('#hc-updated');
    node.textContent = 'Updated ' + t;
    node.appendChild(Site.jaInline('更新'));
  }

  // ---- Talking to the sheet ------------------------------------------------
  function fetchBookings(code) {
    return Site.get({ action: 'haircut', code: code }).then(function (data) {
      // Only the current Code.gs answers with version 2 and a date-free list of bookings.
      if (data && data.ok && (data.version !== 2 || !Array.isArray(data.bookings))) {
        return { ok: false, error: 'not_ready', message: M.notReady };
      }
      return data;
    });
  }

  var gate = Site.gate({
    verify: fetchBookings,
    onOpen: function (data) { bookings = data.bookings; stamp(); render(); }
  });

  function refresh() {
    var code = Site.getCode();
    if (!Site.configured() || !code) return Promise.resolve();
    return fetchBookings(code).then(function (data) {
      if (data && data.ok) { bookings = data.bookings; stamp(); render(); }
      else if (data && data.error === 'bad_code') gate.lock(Site.MSG.badCode);
    }).catch(function () {
      var node = $('#hc-updated');
      node.textContent = '';
      node.appendChild(Site.jaLine(Site.MSG.retrying.ja));
      node.insertBefore(document.createTextNode(Site.MSG.retrying.en), node.firstChild);
    });
  }

  function send(body, okMessage) {
    if (busy) return;
    busy = true;
    Site.setStatus(status, M.saving);
    Site.post(body).then(function (data) {
      if (data && data.ok) Site.setStatus(status, okMessage);
      else if (data && data.error === 'bad_code') gate.lock(Site.MSG.codeChanged);
      else if (data && data.error === 'taken') Site.setStatus(status, M.taken, true);
      else if (data && data.error === 'not_yours') Site.setStatus(status, M.notYours, true);
      else Site.setStatus(status, M.rejected, true);
      return refresh();
    }).catch(function () {
      Site.setStatus(status, Site.MSG.unreachable, true);
    }).then(function () { busy = false; });
  }

  function bookSlot(t) {
    var name = nameInput.value.trim();
    if (!name) {
      Site.setStatus(status, M.needName, true);
      nameInput.focus();
      return;
    }
    Site.setName(name);
    send({ action: 'bookHaircut', code: Site.getCode(), time: t, name: name },
      B('Booked! ' + name + ', ' + slotLabel(t) + '.', '予約しました！' + name + 'さん、' + slotLabel(t) + '。'));
  }

  function cancelSlot(t, name) {
    send({ action: 'cancelHaircut', code: Site.getCode(), time: t, name: name },
      B('Cancelled ' + slotLabel(t) + '.', slotLabel(t) + ' の予約をキャンセルしました。'));
  }

  nameInput.addEventListener('input', render);
  $('#hc-refresh').addEventListener('click', refresh);

  nameInput.value = Site.getName();
  setInterval(function () { if (!document.hidden && !$('#app').hidden && !busy) refresh(); }, 30000);
})();
