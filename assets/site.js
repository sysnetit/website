/* Shared helpers for every page: talking to the Google Sheet backend, remembering the group
   passcode, UK dates, and the English + Japanese wording used across the site. */
(function (global) {
  'use strict';

  // ---- Edit this -------------------------------------------------------------
  // The web app URL you get after deploying Code.gs in Apps Script.
  // The same URL serves orders, notices, logs and haircut bookings.
  var CONFIG = {
    scriptUrl: 'https://script.google.com/macros/s/AKfycbysNROtNlGHorncvatWNSC4YUrFzJT4Tv67s24zGaq_ai-n8eNAoq3e8B49clJudjXZIw/exec'
  };
  // ----------------------------------------------------------------------------

  var TZ = 'Europe/London';
  var KEY_CODE = 'order_code';   // same keys as the original order page,
  var KEY_NAME = 'order_name';   // so people stay signed in

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function el(tag, text, cls) {
    var n = document.createElement(tag);
    if (text != null) n.textContent = text;
    if (cls) n.className = cls;
    return n;
  }

  // ---- English + Japanese wording ------------------------------------------------
  // A message is {en, ja}. It is shown as the English text with the Japanese underneath.
  function bi(en, ja) { return { en: en, ja: ja }; }

  function jaLine(text) {
    var s = el('span', text, 'ja-line');
    s.lang = 'ja';
    return s;
  }
  function jaInline(text) {
    var s = el('span', text, 'ja');
    s.lang = 'ja';
    return s;
  }

  // Shows a message (a plain string, or {en, ja}) in a status element.
  function setStatus(node, msg, isError) {
    node.textContent = '';
    if (msg && typeof msg === 'object') {
      node.appendChild(document.createTextNode(msg.en));
      if (msg.ja) node.appendChild(jaLine(msg.ja));
    } else {
      node.textContent = msg || '';
    }
    node.classList.toggle('error', !!isError);
  }

  // Sets a button or label to English text followed by a small Japanese label.
  function setLabel(node, en, ja) {
    node.textContent = en;
    if (ja) node.appendChild(jaInline(ja));
  }

  // Wording used on more than one page.
  var MSG = {
    checking:     bi('Checking…', '確認中…'),
    badCode:      bi('That passcode was not accepted. Try again.', 'パスコードが正しくありません。もう一度お試しください。'),
    needCode:     bi('Enter the group passcode to continue.', '続けるにはグループのパスコードを入力してください。'),
    codeChanged:  bi('The passcode changed. Enter the new one.', 'パスコードが変更されました。新しいパスコードを入力してください。'),
    wentWrong:    bi('Something went wrong. Please try again in a moment.', '問題が発生しました。しばらくしてからもう一度お試しください。'),
    unreachable:  bi('Could not reach the sheet. Check your connection and try again.', 'スプレッドシートに接続できませんでした。接続を確認してもう一度お試しください。'),
    notConnected: bi('This page is not connected to a sheet yet. Add the web app URL in assets/site.js.', 'このページはまだスプレッドシートに接続されていません。assets/site.js にウェブアプリのURLを追加してください。'),
    retrying:     bi('Could not reach the sheet. Retrying soon.', 'スプレッドシートに接続できませんでした。まもなく再試行します。'),
    needUpdate:   bi('The site owner needs to update the Apps Script (see Code.gs) and deploy a new version.', 'サイト管理者が Apps Script（Code.gs）を更新し、新しいバージョンをデプロイする必要があります。')
  };

  // Japanese names for the items on the order form. The English name is what is stored in the Sheet.
  var ITEM_JA = {
    'Chocolate': 'チョコレート', 'Matcha': '抹茶', 'Shiro': '白', 'Yuzu': '柚子',
    'Kuromame': '黒豆', 'Calamansi': 'カラマンシー', 'Dango': '団子',
    'Tofu': '豆腐', 'Ganmodoki': 'がんもどき', 'Atsuage': '厚揚げ',
    'Azuki Donuts': '小豆ドーナツ', 'Cinnamon Donuts': 'シナモンドーナツ',
    'Soya milk': '豆乳', 'Soya pulp': 'おから', 'Soya beans': '大豆', 'Aduki beans': '小豆',
    'Nigari': 'にがり',
    'Natto': '納豆', 'Salt koji': '塩麹', 'Soy sauce koji': '醤油麹', 'Onion koji': '玉ねぎ麹',
    'Kimchi': 'キムチ', 'Amazake': '甘酒', 'Red bean': '小豆', 'Karaage': '唐揚げ',
    'Item 9 (name to be confirmed)': '9番目の商品（名前は未定）'
  };
  function itemJa(name) { return ITEM_JA[name] || ''; }

  // Icon for each order section (the section names are what is stored in the Sheet).
  var SECTION_ICON = { '大福': 'daifuku', 'お豆腐': 'tofu', '納豆': 'natto' };

  var store = {
    get: function (k) { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
    del: function (k) { try { localStorage.removeItem(k); } catch (e) {} }
  };

  function configured() {
    return !!CONFIG.scriptUrl && CONFIG.scriptUrl.indexOf('PASTE_') === -1;
  }

  // ---- Backend --------------------------------------------------------------
  function get(params) {
    var q = Object.keys(params).map(function (k) {
      return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]);
    }).join('&');
    return fetch(CONFIG.scriptUrl + '?' + q).then(function (res) {
      if (!res.ok) throw new Error('http ' + res.status);
      return res.json();
    });
  }
  function post(body) {
    // No custom headers: keeps this a simple request that Apps Script accepts from any site.
    return fetch(CONFIG.scriptUrl, { method: 'POST', body: JSON.stringify(body) })
      .then(function (res) { return res.json(); });
  }

  // ---- Dates (always UK time, whatever the visitor's device says) --------------
  function parts(date, opts) {
    var o = {};
    new Intl.DateTimeFormat('en-GB', Object.assign({ timeZone: TZ, hourCycle: 'h23' }, opts))
      .formatToParts(date).forEach(function (p) { o[p.type] = p.value; });
    return o;
  }
  // 21/09/26
  function shortDate(date) {
    var p = parts(date, { day: '2-digit', month: '2-digit', year: '2-digit' });
    return p.day + '/' + p.month + '/' + p.year;
  }
  // 14:32
  function shortTime(date) {
    var p = parts(date, { hour: '2-digit', minute: '2-digit' });
    return p.hour + ':' + p.minute;
  }
  // Sat 19 Sept, 11:00 · 9月19日(土)
  function friendlyWhen(date) {
    var d = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short' }).format(date);
    var ja = new Intl.DateTimeFormat('ja-JP', { timeZone: TZ, month: 'numeric', day: 'numeric', weekday: 'short' }).format(date);
    return d.replace(/,/g, '') + ', ' + shortTime(date) + ' · ' + ja;
  }

  // ---- Passcode gate ------------------------------------------------------------
  // Expects #gate (with #gate-form, #code, #gate-status) and #app in the page.
  // opts.verify(code) -> Promise<{ok, error?, message?, ...}>; opts.onOpen(data) shows the page.
  function gate(opts) {
    var gateEl = $('#gate'), appEl = $('#app');
    var form = $('#gate-form'), input = $('#code'), status = $('#gate-status');

    // While locked, the page shows only the passcode box (the menu is hidden too).
    function show(msg, isError) {
      document.body.classList.add('locked');
      appEl.hidden = true;
      gateEl.hidden = false;
      setStatus(status, msg, isError);
    }
    function open(data) {
      document.body.classList.remove('locked');
      gateEl.hidden = true;
      appEl.hidden = false;
      opts.onOpen(data);
    }
    function attempt(code, silent) {
      if (!configured()) {
        show(MSG.notConnected, true);
        return Promise.resolve(false);
      }
      setStatus(status, MSG.checking);
      return opts.verify(code).then(function (data) {
        if (data && data.ok) { store.set(KEY_CODE, code); open(data); return true; }
        if (data && data.error === 'bad_code') {
          store.del(KEY_CODE);
          show(silent ? MSG.needCode : MSG.badCode, !silent);
          return false;
        }
        show((data && data.message) || MSG.wentWrong, true);
        return false;
      }).catch(function () {
        show(MSG.unreachable, true);
        return false;
      });
    }

    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var typed = input.value.trim();
      if (!typed) { setStatus(status, MSG.needCode, true); input.focus(); return; }
      attempt(typed, false);
    });

    var saved = store.get(KEY_CODE);
    if (saved) attempt(saved, true); else show('');

    return {
      lock: function (msg) { store.del(KEY_CODE); show(msg, true); }
    };
  }

  global.Site = {
    config: CONFIG,
    $: $, $all: $all, el: el,
    bi: bi, jaLine: jaLine, jaInline: jaInline, setStatus: setStatus, setLabel: setLabel, MSG: MSG,
    itemJa: itemJa, sectionIcon: function (key) { return SECTION_ICON[key] || ''; },
    configured: configured,
    get: get, post: post,
    getCode: function () { return store.get(KEY_CODE); },
    setCode: function (c) { store.set(KEY_CODE, c); },
    clearCode: function () { store.del(KEY_CODE); },
    getName: function () { return store.get(KEY_NAME); },
    setName: function (n) { store.set(KEY_NAME, n); },
    store: store,
    shortDate: shortDate, shortTime: shortTime, friendlyWhen: friendlyWhen,
    gate: gate
  };
})(window);
