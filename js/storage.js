/* ============================================================
 * storage.js
 * كل ما يخص الحفظ والتحميل من localStorage (الإعدادات، الأصدقاء، المحادثات، الملف الشخصي، المحظورين، UID)
 * يعتمد على: core.js
 * ============================================================ */

/* Saved Settings with Volume Control */

var S = { enh: 1, snd: 1, sfxVol: 1.0, vib: 1, cMe: 'blue', cOp: 'red', animTheme: 1 };

try { var sv = JSON.parse(localStorage.getItem('ofestra_s') || '{}'); for(var k in sv) S[k] = sv[k]; } catch(e){}

function saveS(){ try{ localStorage.setItem('ofestra_s', JSON.stringify(S)); }catch(e){} }

/* Saved Friends Local Storage & Chat History */

var MY_FRIENDS = [];

try { MY_FRIENDS = JSON.parse(localStorage.getItem('ofestra_friends') || '[]'); } catch(e){}

function saveFriends(){ try{ localStorage.setItem('ofestra_friends', JSON.stringify(MY_FRIENDS)); }catch(e){} }

var CHAT_HISTORY = {};

try { CHAT_HISTORY = JSON.parse(localStorage.getItem('ofestra_chats') || '{}'); } catch(e){}

function saveChats(){ try{ localStorage.setItem('ofestra_chats', JSON.stringify(CHAT_HISTORY)); }catch(e){} }

var UNREAD_MSGS = {};

try { UNREAD_MSGS = JSON.parse(localStorage.getItem('ofestra_unread') || '{}'); } catch(e){}

function saveUnread(){ try{ localStorage.setItem('ofestra_unread', JSON.stringify(UNREAD_MSGS)); }catch(e){} }

var PF = { name: 'لاعب', played: 0, w: 0, l: 0, d: 0, lastNamed: 0 };

try { var pv = JSON.parse(localStorage.getItem('ofestra_p') || '{}'); for(var kk in pv) PF[kk] = pv[kk]; } catch(e){}

function savePF(){ try{ localStorage.setItem('ofestra_p', JSON.stringify(PF)); }catch(e){} }

/* معرّف اللاعب الفريد */
var UID = (function(){ try{ var u = localStorage.getItem('ofestra_uid'); if(!u){ u = Math.random().toString(36).slice(2,10) + Date.now().toString(36).slice(-3); localStorage.setItem('ofestra_uid', u); } return u; }catch(e){ return Math.random().toString(36).slice(2,10); } })();

if(!(PF.av >= 0 && PF.av < AV.length)) PF.av = parseInt(UID.slice(0, 2), 36) % AV.length;

var BLOCKED = {};

try{ BLOCKED = JSON.parse(localStorage.getItem('ofestra_blocked') || '{}'); }catch(e){}

function saveBlocked(){ try{ localStorage.setItem('ofestra_blocked', JSON.stringify(BLOCKED)); }catch(e){} }
