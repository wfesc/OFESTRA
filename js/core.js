/* ============================================================
 * core.js
 * الأساسيات المشتركة: $ ، الثوابت (الأفاتارات، الإيموجي، لوحة اللعب) ودوال مساعدة صغيرة
 * يعتمد على: — (أول ملف يُحمّل)
 * ============================================================ */

var $ = function(i){ return document.getElementById(i); }, app = $('app'), vig = $('vig');

var AV = ['🦁','🐯','🦅','🐺','🦊','🐼','🐲','🦄','🤖','👾','🎯','👑','⚡','🔥','🌙','⭐','🏆','🎮','🧠','🦉'];

var EMOJI_MAP = { joy: "😂", pray: "🙏", cry: "😭", rage: "😡" };

/* احداثيات نقاط اللوحة + خطوط الفوز */
var P = [], i;
for(i = 0; i < 9; i++){ P.push([52 + (i%3)*126, 52 + Math.floor(i/3)*126]); }
var LINES = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8]];

function other(p){ return p === 'R' ? 'B' : 'R'; }

function cleanName(s){ return String(s == null ? '' : s).replace(/[\u0000-\u001f<>&"'`\\]/g, '').trim().slice(0, 14) || 'لاعب'; }

function ago(t){ var m = Math.max(1, Math.round((Date.now() - t) / 60000)); return m < 60 ? 'قبل ' + m + ' د' : m < 1440 ? 'قبل ' + Math.round(m / 60) + ' س' : 'قبل ' + Math.round(m / 1440) + ' يوم'; }

function stag(c){ Array.prototype.forEach.call(c.children, function(e, k){ e.style.setProperty('--i', Math.min(k, 8)); }); }
