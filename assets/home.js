/* Landing page: read and post community notices (behind the passcode gate). */
(function () {
  'use strict';
  var $ = Site.$, el = Site.el, B = Site.bi;

  var list = $('#notice-list'), state = $('#notice-state');
  var form = $('#notice-form'), status = $('#n-status'), sendBtn = $('#n-send');
  var nameInput = $('#n-name'), msg = $('#n-message'), count = $('#n-count');

  var M = {
    none:      B('No notices yet. Be the first to share something!', 'まだお知らせはありません。最初の投稿をしてみませんか？'),
    notReady:  B('Notices are not set up yet. ' + Site.MSG.needUpdate.en, 'お知らせはまだ設定されていません。' + Site.MSG.needUpdate.ja),
    loadFail:  B('Could not load the notices. Please try again in a moment.', 'お知らせを読み込めませんでした。しばらくしてからもう一度お試しください。'),
    needName:  B('Please enter your name.', 'お名前を入力してください。'),
    needText:  B('Please write a message.', 'メッセージを入力してください。'),
    rejected:  B('The notice was not accepted. Check your name and message, and that the site has been updated.', 'お知らせを投稿できませんでした。お名前とメッセージ、およびサイトが更新されているかご確認ください。'),
    sendFail:  B('Could not post the notice. Check your connection and try again.', 'お知らせを投稿できませんでした。接続を確認してもう一度お試しください。')
  };

  function showState(m, isError) {
    list.textContent = '';
    state.hidden = false;
    Site.setStatus(state, m, isError);
    state.classList.toggle('error', !!isError);
  }

  function render(notices) {
    list.textContent = '';
    if (!notices.length) { showState(M.none); return; }
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
    if (data.notices === null) showState(M.notReady);
    else render(data.notices);
  }

  var gate = Site.gate({ verify: fetchNotices, onOpen: show });

  function load() {
    var code = Site.getCode();
    if (!Site.configured() || !code) return Promise.resolve();
    return fetchNotices(code).then(function (data) {
      if (data && data.ok) show(data);
      else if (data && data.error === 'bad_code') gate.lock(Site.MSG.badCode);
    }).catch(function () {
      // Keep whatever is already on screen; only say something if there is nothing to show.
      if (!list.children.length) showState(M.loadFail, true);
    });
  }

  // ---- Posting -------------------------------------------------------------
  msg.addEventListener('input', function () { count.textContent = msg.value.length + ' / 500'; });

  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    var name = nameInput.value.trim();
    var message = msg.value.trim();
    var code = Site.getCode();

    if (!name) { Site.setStatus(status, M.needName, true); return; }
    if (!message) { Site.setStatus(status, M.needText, true); return; }
    if (!code) { gate.lock(Site.MSG.needCode); return; }

    sendBtn.disabled = true;
    Site.setLabel(sendBtn, 'Posting…', '投稿中…');
    Site.setStatus(status, '');

    Site.post({ action: 'addNotice', code: code, name: name, message: message })
      .then(function (data) {
        if (data && data.ok) {
          Site.setName(name);
          msg.value = '';
          count.textContent = '0 / 500';
          Site.setStatus(status, B('Thank you, ' + name + '. Your notice is posted.', 'ありがとうございます、' + name + 'さん。お知らせを投稿しました。'));
          return load();
        }
        if (data && data.error === 'bad_code') gate.lock(Site.MSG.codeChanged);
        else Site.setStatus(status, M.rejected, true);
      })
      .catch(function () { Site.setStatus(status, M.sendFail, true); })
      .then(function () {
        sendBtn.disabled = false;
        Site.setLabel(sendBtn, 'Post notice', 'お知らせを投稿');
      });
  });

  $('#notices-refresh').addEventListener('click', load);

  // ---- Start ----------------------------------------------------------------
  nameInput.value = Site.getName();
  setInterval(function () { if (!document.hidden && !$('#app').hidden) load(); }, 60000);
})();
