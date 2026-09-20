/* Simple flat icons, drawn as inline SVG so they need no image files.
   In HTML:     <span class="icon" data-icon="tofu"></span>
   In scripts:  Icons.el('tofu')  or  Icons.svg('tofu')                                        */
(function (global) {
  'use strict';

  var INK = '#8A6248';   // soft brown outline shared by every icon

  var ICONS = {
    // A block of tofu with a sprinkle of spring onion
    tofu:
      '<path d="M8 27 L34 16 L57 25 L31 37 Z" fill="#FFF9E8" stroke="' + INK + '" stroke-width="2" stroke-linejoin="round"/>' +
      '<path d="M8 27 L31 37 L31 55 L8 45 Z" fill="#F3E3BE" stroke="' + INK + '" stroke-width="2" stroke-linejoin="round"/>' +
      '<path d="M31 37 L57 25 L57 43 L31 55 Z" fill="#E4CE9C" stroke="' + INK + '" stroke-width="2" stroke-linejoin="round"/>' +
      '<ellipse cx="29" cy="24" rx="3" ry="1.4" fill="#6E9B3E" transform="rotate(-20 29 24)"/>' +
      '<ellipse cx="38" cy="26.5" rx="3" ry="1.4" fill="#6E9B3E" transform="rotate(15 38 26.5)"/>' +
      '<ellipse cx="24" cy="29" rx="2.6" ry="1.3" fill="#6E9B3E" transform="rotate(10 24 29)"/>',

    // A small blue bowl of natto beans with sticky strings
    natto:
      '<path d="M30 25 C27 17 36 13 33 6" fill="none" stroke="#D9C58F" stroke-width="1.8" stroke-linecap="round"/>' +
      '<path d="M37 26 C41 18 31 15 37 9" fill="none" stroke="#D9C58F" stroke-width="1.8" stroke-linecap="round"/>' +
      '<rect x="23" y="53" width="18" height="5" rx="2" fill="#3E5F86"/>' +
      '<path d="M8 35 H56 C56 48 46 56 32 56 C18 56 8 48 8 35 Z" fill="#5F84AD" stroke="#3E5F86" stroke-width="2" stroke-linejoin="round"/>' +
      '<ellipse cx="32" cy="35" rx="24" ry="5" fill="#E9EEF5" stroke="#3E5F86" stroke-width="2"/>' +
      '<g fill="#A9743F" stroke="#7A4E28" stroke-width="1.4">' +
      '<ellipse cx="21" cy="32" rx="6" ry="4.5"/><ellipse cx="43" cy="32" rx="6" ry="4.5"/>' +
      '<ellipse cx="32" cy="28" rx="7" ry="5"/><ellipse cx="32" cy="35" rx="8" ry="4"/></g>' +
      '<ellipse cx="28" cy="29" rx="2.4" ry="1.1" fill="#6E9B3E"/><ellipse cx="37" cy="32" rx="2.4" ry="1.1" fill="#6E9B3E"/>',

    // Ichigo daifuku: a soft white rice cake with a strawberry peeking out
    daifuku:
      '<g transform="translate(0,-5)">' +
      '<path d="M23 27 C23 15 41 15 41 27 C41 33 34 37 32 37 C30 37 23 33 23 27 Z" fill="#D8434F" stroke="#A82E3A" stroke-width="1.6"/>' +
      '<path d="M27 17 L32 10 L37 17 L32 19 Z" fill="#5E9B3A"/>' +
      '<circle cx="28.5" cy="26" r="1" fill="#FFE3A3"/><circle cx="35.5" cy="26" r="1" fill="#FFE3A3"/><circle cx="32" cy="30" r="1" fill="#FFE3A3"/></g>' +
      '<path d="M7 46 C7 30 18 23 32 23 C46 23 57 30 57 46 C57 54 46 57 32 57 C18 57 7 54 7 46 Z" fill="#FFFDF8" stroke="' + INK + '" stroke-width="2" stroke-linejoin="round"/>' +
      '<path d="M12 50 C22 54 42 54 52 50" fill="none" stroke="#F3D5D0" stroke-width="3" stroke-linecap="round"/>' +
      '<path d="M15 36 C18 31 23 29 27 29" fill="none" stroke="#EFE6DA" stroke-width="2.4" stroke-linecap="round"/>',

    // Scissors for the haircut page
    scissors:
      '<circle cx="18" cy="48" r="7.5" fill="none" stroke="#B84A1F" stroke-width="4"/>' +
      '<circle cx="46" cy="48" r="7.5" fill="none" stroke="#B84A1F" stroke-width="4"/>' +
      '<path d="M22 42 L45 8" stroke="#8E9BA8" stroke-width="5.5" stroke-linecap="round"/>' +
      '<path d="M42 42 L19 8" stroke="#BFC9D2" stroke-width="5.5" stroke-linecap="round"/>' +
      '<circle cx="32" cy="26" r="2.8" fill="' + INK + '"/>',

    // A Japanese teacup (yunomi) of green tea, with steam
    tea:
      '<path d="M24 19 C21 15 27 12 24 7" fill="none" stroke="#C9B79C" stroke-width="2" stroke-linecap="round"/>' +
      '<path d="M37 19 C34 15 40 12 37 7" fill="none" stroke="#C9B79C" stroke-width="2" stroke-linecap="round"/>' +
      '<path d="M12 27 H50 V35 C50 48 42 57 31 57 C20 57 12 48 12 35 Z" fill="#F8F1E4" stroke="' + INK + '" stroke-width="2" stroke-linejoin="round"/>' +
      '<path d="M14 39 C22 43 40 43 48 39" fill="none" stroke="#8DB65A" stroke-width="3.2" stroke-linecap="round"/>' +
      '<ellipse cx="31" cy="27" rx="19" ry="5" fill="#8DB65A" stroke="' + INK + '" stroke-width="2"/>',

    // A shopping basket for orders
    basket:
      '<path d="M20 27 C20 11 44 11 44 27" fill="none" stroke="' + INK + '" stroke-width="3.6" stroke-linecap="round"/>' +
      '<path d="M8 27 H56 L50 56 H14 Z" fill="#DDA75F" stroke="' + INK + '" stroke-width="2" stroke-linejoin="round"/>' +
      '<path d="M11 36 H53 M12.5 45 H51.5 M25 27 L26.5 56 M32 27 V56 M39 27 L37.5 56" fill="none" stroke="#B9803C" stroke-width="1.7"/>',

    // A notebook for the logs
    notebook:
      '<rect x="13" y="7" width="38" height="50" rx="4" fill="#FFFDF8" stroke="' + INK + '" stroke-width="2"/>' +
      '<path d="M17 7 H26 V57 H17 A4 4 0 0 1 13 53 V11 A4 4 0 0 1 17 7 Z" fill="#C2526A"/>' +
      '<path d="M32 30 H44 M32 38 H44 M32 46 H40" fill="none" stroke="#C9B79C" stroke-width="2.6" stroke-linecap="round"/>' +
      '<path d="M38 7 V22 L42 18.5 L46 22 V7 Z" fill="#B84A1F"/>',

    // Two chain links
    link:
      '<rect x="4" y="21" width="32" height="19" rx="9.5" transform="rotate(-35 20 30.5)" fill="none" stroke="#52713B" stroke-width="5.5"/>' +
      '<rect x="28" y="24" width="32" height="19" rx="9.5" transform="rotate(-35 44 33.5)" fill="none" stroke="#8DB65A" stroke-width="5.5"/>',

    // A torii gate
    torii:
      '<path d="M3 11 C17 19 47 19 61 11 L59 21 C46 27 18 27 5 21 Z" fill="#B84A1F"/>' +
      '<rect x="15" y="24" width="6" height="34" rx="1.2" fill="#B84A1F"/>' +
      '<rect x="43" y="24" width="6" height="34" rx="1.2" fill="#B84A1F"/>' +
      '<rect x="10" y="35" width="44" height="5" rx="1.2" fill="#963A15"/>',

    // A bell for notices
    bell:
      '<circle cx="32" cy="7" r="3.2" fill="' + INK + '"/>' +
      '<path d="M32 9 C21 9 15 17 15 28 V37 L9 46 H55 L49 37 V28 C49 17 43 9 32 9 Z" fill="#E8B93D" stroke="' + INK + '" stroke-width="2" stroke-linejoin="round"/>' +
      '<circle cx="32" cy="53" r="5" fill="#B84A1F"/>' +
      '<path d="M22 22 C23 18 26 15 29 14" fill="none" stroke="#FFF3C9" stroke-width="2.4" stroke-linecap="round"/>',

    // A comb (used on the haircut rows)
    comb:
      '<rect x="6" y="14" width="52" height="14" rx="5" fill="#E2A04C" stroke="' + INK + '" stroke-width="2"/>' +
      '<path d="M12 28 V50 M19 28 V54 M26 28 V50 M33 28 V54 M40 28 V50 M47 28 V54 M53 28 V50" fill="none" stroke="' + INK + '" stroke-width="3" stroke-linecap="round"/>'
  };

  function svg(name) {
    var body = ICONS[name];
    if (!body) return '';
    return '<svg viewBox="0 0 64 64" focusable="false" aria-hidden="true">' + body + '</svg>';
  }

  // A ready-made <span class="icon"> element for scripts to insert.
  function el(name, extraClass) {
    var s = document.createElement('span');
    s.className = 'icon' + (extraClass ? ' ' + extraClass : '');
    s.setAttribute('aria-hidden', 'true');
    s.innerHTML = svg(name);
    return s;
  }

  // Fills every <span data-icon="..."> that is still empty.
  function fill(root) {
    var nodes = (root || document).querySelectorAll('[data-icon]');
    for (var i = 0; i < nodes.length; i++) {
      if (!nodes[i].firstChild) {
        nodes[i].innerHTML = svg(nodes[i].getAttribute('data-icon'));
        nodes[i].setAttribute('aria-hidden', 'true');
      }
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { fill(); });
  else fill();

  global.Icons = { svg: svg, el: el, fill: fill, names: Object.keys(ICONS) };
})(window);
