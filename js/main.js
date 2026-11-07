/* ============================================================
 * main.js
 * نقطة البداية: يشغّل كل الملفات بالترتيب الصحيح (آخر ملف يُحمّل)
 * يعتمد على: كل الملفات السابقة
 * ============================================================ */

function boot(){
  initSettings();   /* settings.js : ألوان + ربط نافذة الإعدادات */
  buildBoard();     /* game.js    : بناء اللوحة */

  /* حالة البداية */
  pos = { R: [-1,-1,-1], B: [-1,-1,-1] };
  derive(); paint(); refresh();
  setAnimTheme(S.animTheme || 1);
  requestAnimationFrame(frame);

  initGame();       /* game.js    */
  initAI();         /* ai.js      */
  initOnline();     /* online.js  */
  initFriends();    /* friends.js */
  initProfile();    /* profile.js */
  initUI();         /* ui.js      */

  refresh();
  firstRunProfile(); /* profile.js */
  netConnect();      /* online.js  */
}

if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
