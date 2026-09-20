/* Haircut page: one-hour slots from 09:00 to 17:00, booked by name. */
(function () {
  'use strict';
  var $ = Site.$, el = Site.el, setStatus = Site.setStatus;

  // Slot start times: 09:00, 10:00 ... 16:00 (the last slot ends at 17:00).
  var FIRST_HOUR = 9, LAST_END_HOUR = 17;

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  var TIMES = [];
  for (var h = FIRST_HOUR; h < LAST_END_HOUR; h++) TIMES.push(pad(h) + ':00');
  function slotLabel(t) { return t + ' – ' + pad(parseInt(t, 10) + 1) + ':00'; }

  var bookings = [];
  var day = Site.todayISO();
  var busy = false;

  var nameInput = $('#hc-name'), dayInput = $('#hc-day'), status = $('#hc-status');
  var prevBtn = $('#hc-prev'), nextBtn = $('#hc-next');

  function addDays(iso, n) {
    var d = new Date(iso + 'T12:00:00Z');
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  }
  function longDate(iso) {
    return new Date(iso + 'T12:00:00Z').toLocaleDateString('en-GB', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC'
    });
  }

  function bookingAt(t) {
    for (var i = 0; i < bookings.length; i++) {
      if (bookings[i].date === day && bookings[i].time === t) return bookings[i];
    }
    return null;
  }

  function render() {
    var today = Site.todayISO();
    var hour = Site.londonHour();
    var me = nameInput.value.trim().toLowerCase();

    dayInput.min = today;
    dayInput.value = day;
    prevBtn.disabled = day <= today;
    $('#day-heading').textContent = longDate(day) + (day === today ? ' (today)' : '');

    var body = $('#slots');
    body.textContent = '';
    TIMES.forEach(function (t) {
      var b = bookingAt(t);
      var passed = day < today || (day === today && parseInt(t, 10) <= hour);
      var tr = document.createElement('tr');

      var th = el('th', slotLabel(t));
      th.scope = 'row';
      tr.appendChild(th);

      var nameCell = document.createElement('td');
      var actionCell = el('td', null, 'action');
      if (b) {
        nameCell.appendChild(el('span', b.name, 'slot-name'));
        if (me && b.name.trim().toLowerCase() === me && !passed) {
          var cancel = el('button', 'Cancel', 'btn btn-quiet btn-small');
          cancel.type = 'button';
          cancel.setAttribute('aria-label', 'Cancel ' + slotLabel(t));
          cancel.addEventListener('click', function () { cancelSlot(t, b.name); });
          actionCell.appendChild(cancel);
        }
      } else if (passed) {
        nameCell.appendChild(el('span', 'Passed', 'slot-past'));
      } else {
        nameCell.appendChild(el('span', 'Available', 'slot-free'));
        var book = el('button', 'Book', 'btn btn-green btn-small');
        book.type = 'button';
        book.setAttribute('aria-label', 'Book ' + slotLabel(t));
        book.addEventListener('click', function () { bookSlot(t); });
        actionCell.appendChild(book);
      }
      tr.appendChild(nameCell);
      tr.appendChild(actionCell);
      body.appendChild(tr);
    });
  }

  // ---- Talking to the sheet ------------------------------------------------
  function fetchBookings(code) {
    return Site.get({ action: 'haircut', code: code }).then(function (data) {
      if (data && data.ok && !Array.isArray(data.bookings)) {
        // An older Code.gs answered: it does not know about haircut bookings yet.
        return { ok: false, error: 'not_ready', message: 'The haircut schedule is not set up yet. The site owner needs to update the Apps Script (see Code.gs) and deploy a new version.' };
      }
      return data;
    });
  }

  var gate = Site.gate({
    verify: fetchBookings,
    onOpen: function (data) {
      bookings = data.bookings;
      $('#hc-updated').textContent = 'Updated ' + Site.shortTime(new Date());
      render();
    }
  });

  function refresh() {
    var code = Site.getCode();
    if (!Site.configured() || !code) return Promise.resolve();
    return fetchBookings(code).then(function (data) {
      if (data && data.ok) {
        bookings = data.bookings;
        $('#hc-updated').textContent = 'Updated ' + Site.shortTime(new Date());
        render();
      } else if (data && data.error === 'bad_code') {
        gate.lock('That passcode was not accepted. Try again.');
      }
    }).catch(function () {
      $('#hc-updated').textContent = 'Could not reach the sheet. Retrying soon.';
    });
  }

  function send(body, okMessage) {
    if (busy) return;
    busy = true;
    setStatus(status, 'Saving…');
    Site.post(body).then(function (data) {
      if (data && data.ok) {
        setStatus(status, okMessage);
      } else if (data && data.error === 'bad_code') {
        gate.lock('The passcode changed. Enter the new one.');
      } else if (data && data.error === 'taken') {
        setStatus(status, 'Sorry, someone has just booked that slot. Please choose another.', true);
      } else if (data && data.error === 'not_yours') {
        setStatus(status, 'Only the person who booked can cancel this slot.', true);
      } else {
        setStatus(status, 'That was not accepted. Check your name and try again.', true);
      }
      return refresh();
    }).catch(function () {
      setStatus(status, 'Could not reach the sheet. Check your connection and try again.', true);
    }).then(function () { busy = false; });
  }

  function bookSlot(t) {
    var name = nameInput.value.trim();
    if (!name) {
      setStatus(status, 'Please enter your name first.', true);
      nameInput.focus();
      return;
    }
    Site.setName(name);
    send({ action: 'bookHaircut', code: Site.getCode(), date: day, time: t, name: name },
      'Booked! ' + name + ', ' + slotLabel(t) + ' on ' + longDate(day) + '.');
  }

  function cancelSlot(t, name) {
    send({ action: 'cancelHaircut', code: Site.getCode(), date: day, time: t, name: name },
      'Cancelled ' + slotLabel(t) + ' on ' + longDate(day) + '.');
  }

  // ---- Controls -----------------------------------------------------------
  function setDay(iso) {
    var today = Site.todayISO();
    day = (!iso || iso < today) ? today : iso;
    setStatus(status, '');
    render();
  }
  dayInput.addEventListener('change', function () { setDay(dayInput.value); });
  prevBtn.addEventListener('click', function () { setDay(addDays(day, -1)); });
  nextBtn.addEventListener('click', function () { setDay(addDays(day, 1)); });
  nameInput.addEventListener('input', render);
  $('#hc-refresh').addEventListener('click', refresh);

  nameInput.value = Site.getName();
  setInterval(function () { if (!document.hidden && !$('#app').hidden && !busy) refresh(); }, 30000);
})();
