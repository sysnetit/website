/* Links page: nothing to load, it only needs the passcode gate. */
(function () {
  'use strict';
  Site.gate({
    verify: function (code) { return Site.get({ action: 'check', code: code }); },
    onOpen: function () {}
  });
})();
