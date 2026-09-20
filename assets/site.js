/* Shared helpers for every page: talking to the Google Sheet backend,
   remembering the group passcode, and formatting dates in UK time. */
(function (global) {
  'use strict';

  // ---- Edit this -------------------------------------------------------------
  // The web app URL you get after deploying Code.gs in Apps Script.
  // The same URL serves orders, notices and haircut bookings.
  var CONFIG = {
    scriptUrl: 'https://script.google.com/macros/s/AKfycbysNROtNlGHorncvatWNSC4YUrFzJT4Tv67s24zGaq_ai-n8eNAoq3e8B49clJudjXZIw/exec'
  };
  // ----------------------------------------------------------------------------

  var TZ = 'Europe/London';
  var KEY_CODE = 'order_code';   // same keys the original order page used,
  var KEY_NAME = 'order_name';   // so people stay signed in

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function el(tag, text, cls) {
    var n = document.createElement(tag);
    if (text != null) n.textContent = text;
    if (cls) n.className = cls;
    return n;
  }
  function setStatus(node, msg, isError) {
    node.textContent = msg || '';
    node.classList.toggle('error', !!isError);
  }

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
  // Sun 20 Sep, 14:32
  function friendlyWhen(date) {
    var d = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short' }).format(date);
    return d.replace(/,/g, '') + ', ' + shortTime(date);
  }
  // 2026-09-20 (today in the UK)
  function todayISO() {
    var p = parts(new Date(), { year: 'numeric', month: '2-digit', day: '2-digit' });
    return p.year + '-' + p.month + '-' + p.day;
  }
  function londonHour() {
    return parseInt(parts(new Date(), { hour: '2-digit' }).hour, 10);
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
        show('This page is not connected to a sheet yet. Add the web app URL in assets/site.js.', true);
        return Promise.resolve(false);
      }
      setStatus(status, 'Checking…');
      return opts.verify(code).then(function (data) {
        if (data && data.ok) { store.set(KEY_CODE, code); open(data); return true; }
        if (data && data.error === 'bad_code') {
          store.del(KEY_CODE);
          show(silent ? 'Enter the group passcode to continue.' : 'That passcode was not accepted. Try again.', !silent);
          return false;
        }
        show((data && data.message) || 'Something went wrong. Please try again in a moment.', true);
        return false;
      }).catch(function () {
        show('Could not reach the sheet. Check your connection and try again.', true);
        return false;
      });
    }

    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      attempt(input.value.trim(), false);
    });

    var saved = store.get(KEY_CODE);
    if (saved) attempt(saved, true); else show('');

    return {
      lock: function (msg) { store.del(KEY_CODE); show(msg, true); }
    };
  }

  global.Site = {
    config: CONFIG,
    $: $, $all: $all, el: el, setStatus: setStatus,
    configured: configured,
    get: get, post: post,
    getCode: function () { return store.get(KEY_CODE); },
    setCode: function (c) { store.set(KEY_CODE, c); },
    clearCode: function () { store.del(KEY_CODE); },
    getName: function () { return store.get(KEY_NAME); },
    setName: function (n) { store.set(KEY_NAME, n); },
    store: store,
    shortDate: shortDate, shortTime: shortTime, friendlyWhen: friendlyWhen,
    todayISO: todayISO, londonHour: londonHour,
    gate: gate
  };
})(window);
