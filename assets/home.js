/* Landing page: read and post community notices (behind the passcode gate). */
(function () {
  'use strict';
  var $ = Site.$, el = Site.el;

  var list = $('#notice-list'), state = $('#notice-state');
  var form = $('#notice-form'), status = $('#n-status'), sendBtn = $('#n-send');
  var nameInput = $('#n-name'), msg = $('#n-message'), count = $('#n-count');

  function showState(text, isError) {
    list.textContent = '';
    state.hidden = false;
    state.textContent = text;
    state.classList.toggle('error', !!isError);
  }

  function render(notices) {
    list.textContent = '';
    if (!notices.length) {
      showState('No notices yet. Be the first to share something!');
      return;
    }
    state.hidden = true;
    notices.forEach(function (n) {
      var li = el('li', null, 'notice');
      var meta = el('div', null, 'notice-meta');
      meta.appendChild(el('span', n.name, 'notice-name'));
      var d = new Date(n.time);
      if (!isNaN(d.getTime())) {
        var t = el('time', Site.friendlyWhen(d));
        t.dateTime = d.toISOString();
        meta.appendChild(t);
      }
      li.appendChild(meta);
      li.appendChild(el('p', n.message, 'notice-body'));
      list.appendChild(li);
    });
  }

  function fetchNotices(code) {
    return Site.get({ action: 'notices', code: code }).then(function (data) {
      if (data && data.ok && !Array.isArray(data.notices)) {
        // An older Code.gs answered: the passcode is right, but it has no notices yet.
        return { ok: true, notices: null };
      }
      return data;
    });
  }

  function show(data) {
    if (data.notices === null) {
      showState('Notices are not set up yet. The site owner needs to update the Apps Script (see Code.gs) and deploy a new version.');
    } else {
      render(data.notices);
    }
  }

  var gate = Site.gate({
    verify: fetchNotices,
    onOpen: show
  });

  function load() {
    var code = Site.getCode();
    if (!Site.configured() || !code) return Promise.resolve();
    return fetchNotices(code).then(function (data) {
      if (data && data.ok) {
        show(data);
      } else if (data && data.error === 'bad_code') {
        gate.lock('That passcode was not accepted. Try again.');
      }
    }).catch(function () {
      // Keep whatever is already on screen; only say something if there is nothing to show.
      if (!list.children.length) showState('Could not load the notices. Please try again in a moment.', true);
    });
  }

  // ---- Posting -------------------------------------------------------------
  msg.addEventListener('input', function () { count.textContent = msg.value.length + ' / 500'; });

  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    var name = nameInput.value.trim();
    var message = msg.value.trim();
    var code = Site.getCode();

    if (!name) { Site.setStatus(status, 'Please enter your name.', true); return; }
    if (!message) { Site.setStatus(status, 'Please write a message.', true); return; }
    if (!code) { gate.lock('Please enter the group passcode.'); return; }

    sendBtn.disabled = true;
    sendBtn.textContent = 'Posting…';
    Site.setStatus(status, '');

    Site.post({ action: 'addNotice', code: code, name: name, message: message })
      .then(function (data) {
        if (data && data.ok) {
          Site.setName(name);
          msg.value = '';
          count.textContent = '0 / 500';
          Site.setStatus(status, 'Thank you, ' + name + '. Your notice is posted.');
          return load();
        }
        if (data && data.error === 'bad_code') {
          gate.lock('The passcode changed. Enter the new one.');
        } else {
          Site.setStatus(status, 'The notice was not accepted. Check your name and message, and that the site has been updated.', true);
        }
      })
      .catch(function () {
        Site.setStatus(status, 'Could not post the notice. Check your connection and try again.', true);
      })
      .then(function () {
        sendBtn.disabled = false;
        sendBtn.textContent = 'Post notice';
      });
  });

  $('#notices-refresh').addEventListener('click', load);

  // ---- Start ----------------------------------------------------------------
  nameInput.value = Site.getName();
  setInterval(function () { if (!document.hidden && !$('#app').hidden) load(); }, 60000);
})();
