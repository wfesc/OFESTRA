/* ============================================================
 * WFESCTRA — debug.js  (لوحة تتبع الأخطاء)
 * تظهر فقط عند فتح الموقع بالرابط  ?debug=1
 * (لإخفائها: ?debug=0).  تعرض آخر السجلات وزر فحص السيرفر.
 * ============================================================ */

(function (window, document) {
  'use strict';

  var KEY = 'wfesctra_debug';
  var q = new URLSearchParams(location.search).get('debug');
  try {
    if (q === '1') localStorage.setItem(KEY, '1');
    if (q === '0') localStorage.removeItem(KEY);
    if (localStorage.getItem(KEY) !== '1') return;
  } catch (e) { if (q !== '1') return; }

  var S = window.WFESCTRA_SERVER;
  if (!S) return;

  var box = document.createElement('div');
  box.style.cssText = 'position:fixed;bottom:0;left:0;right:0;max-height:42vh;overflow:auto;' +
    'z-index:99999;background:#000d;color:#9fe;font:11px/1.5 monospace;direction:ltr;padding:6px';

  var bar = document.createElement('div');
  bar.style.cssText = 'position:sticky;top:0;display:flex;gap:6px;margin-bottom:4px';

  function btn(label, fn) {
    var b = document.createElement('button');
    b.textContent = label;
    b.style.cssText = 'padding:3px 8px;font:inherit';
    b.onclick = fn;
    bar.appendChild(b);
  }

  var list = document.createElement('div');

  function line(e) {
    var d = document.createElement('div');
    d.style.color = e.level === 'error' ? '#f77' : e.level === 'warn' ? '#fd6' : '#9fe';
    d.textContent = e.time.slice(11, 19) + ' [' + e.tag + '] ' + e.message +
      (e.data ? ' ' + JSON.stringify(e.data) : '');
    list.appendChild(d);
    list.parentNode && (box.scrollTop = box.scrollHeight);
  }

  btn('Diagnose', function () {
    S.diagnose().then(function (r) {
      r.forEach(function (x) { line({ time: new Date().toISOString(), level: x.status === 404 || !x.status ? 'warn' : 'info', tag: 'DIAG', message: x.name + ' ' + x.path + ' → ' + (x.status || '—') + ' ' + x.note }); });
    });
  });
  btn('Copy', function () {
    var t = S.logs().map(function (e) { return e.time + ' [' + e.tag + '] ' + e.message + (e.data ? ' ' + JSON.stringify(e.data) : ''); }).join('\n');
    if (navigator.clipboard) navigator.clipboard.writeText(t);
  });
  btn('Close', function () { box.remove(); });

  var info = document.createElement('span');
  info.textContent = S.name + ' v' + S.version + ' → ' + S.getBaseURL();
  bar.appendChild(info);

  box.appendChild(bar);
  box.appendChild(list);
  document.body.appendChild(box);

  S.logs().forEach(line);
  window.addEventListener('wfesctra:log', function (ev) { line(ev.detail); });
})(window, document);
