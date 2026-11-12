
/* ============================================================
 * OFESTRA PRO — STORAGE.JS
 * WFESC ENGINE
 *
 * SETTINGS
 * FRIENDS
 * CHAT HISTORY
 * UNREAD MESSAGES
 * GUEST PROFILE
 * GUEST UID
 * BLOCKED USERS
 *
 * يعتمد على: core.js
 * ============================================================ */


/* ============================================================
   01 — SETTINGS
   ============================================================ */

var S = {
  enh: 1,
  snd: 1,
  sfxVol: 1.0,
  vib: 1,
  cMe: 'blue',
  cOp: 'red',
  animTheme: 1
};


/* تحميل الإعدادات السابقة */

try {

  var sv = JSON.parse(
    localStorage.getItem('ofestra_s') || '{}'
  );

  if(sv && typeof sv === 'object'){

    Object.keys(S).forEach(function(key){

      if(
        Object.prototype.hasOwnProperty.call(sv, key)
      ){

        S[key] = sv[key];

      }

    });

  }

} catch(e){

  console.warn(
    '[OFESTRA] Settings load error:',
    e
  );

}


/* التحقق من صحة الإعدادات */

S.enh = Number(S.enh) ? 1 : 0;
S.snd = Number(S.snd) ? 1 : 0;
S.vib = Number(S.vib) ? 1 : 0;

S.sfxVol = Number(S.sfxVol);

if(!Number.isFinite(S.sfxVol)){

  S.sfxVol = 1;

}

S.sfxVol = Math.max(
  0,
  Math.min(1, S.sfxVol)
);


S.animTheme = parseInt(
  S.animTheme,
  10
);

if(
  !Number.isInteger(S.animTheme) ||
  S.animTheme < 1 ||
  S.animTheme > 3
){

  S.animTheme = 1;

}


/* ============================================================
   02 — PROFILE SETTINGS BRIDGE
   ============================================================ */

function syncOfestraSettings(){

  var motion = S.enh
    ? 'enhanced'
    : 'classic';

  window.OFESTRA_SETTINGS = Object.assign(
    {},
    window.OFESTRA_SETTINGS || {},
    {
      animationMode: motion,
      motionMode: motion
    }
  );

  try {

    localStorage.setItem(
      'OFESTRA_SETTINGS',
      JSON.stringify(window.OFESTRA_SETTINGS)
    );

  } catch(e){}

}


/* ============================================================
   03 — SAVE SETTINGS
   ============================================================ */

function saveS(){

  try {

    localStorage.setItem(
      'ofestra_s',
      JSON.stringify(S)
    );

  } catch(e){

    console.warn(
      '[OFESTRA] Settings save error:',
      e
    );

  }

  syncOfestraSettings();

}


/* مزامنة أولية */

syncOfestraSettings();


/* ============================================================
   04 — FRIENDS
   ============================================================ */

var MY_FRIENDS = [];

try {

  var savedFriends = JSON.parse(
    localStorage.getItem('ofestra_friends') || '[]'
  );

  if(Array.isArray(savedFriends)){

    MY_FRIENDS = savedFriends;

  }

} catch(e){

  MY_FRIENDS = [];

}


function saveFriends(){

  try {

    localStorage.setItem(
      'ofestra_friends',
      JSON.stringify(MY_FRIENDS)
    );

  } catch(e){

    console.warn(
      '[OFESTRA] Friends save error:',
      e
    );

  }

}


/* ============================================================
   05 — CHAT HISTORY
   ============================================================ */

var CHAT_HISTORY = {};

try {

  var savedChats = JSON.parse(
    localStorage.getItem('ofestra_chats') || '{}'
  );

  if(
    savedChats &&
    typeof savedChats === 'object' &&
    !Array.isArray(savedChats)
  ){

    CHAT_HISTORY = savedChats;

  }

} catch(e){

  CHAT_HISTORY = {};

}


function saveChats(){

  try {

    localStorage.setItem(
      'ofestra_chats',
      JSON.stringify(CHAT_HISTORY)
    );

  } catch(e){

    console.warn(
      '[OFESTRA] Chat save error:',
      e
    );

  }

}


/* ============================================================
   06 — UNREAD MESSAGES
   ============================================================ */

var UNREAD_MSGS = {};

try {

  var savedUnread = JSON.parse(
    localStorage.getItem('ofestra_unread') || '{}'
  );

  if(
    savedUnread &&
    typeof savedUnread === 'object' &&
    !Array.isArray(savedUnread)
  ){

    UNREAD_MSGS = savedUnread;

  }

} catch(e){

  UNREAD_MSGS = {};

}


function saveUnread(){

  try {

    localStorage.setItem(
      'ofestra_unread',
      JSON.stringify(UNREAD_MSGS)
    );

  } catch(e){

    console.warn(
      '[OFESTRA] Unread messages save error:',
      e
    );

  }

}


/* ============================================================
   07 — LOCAL PLAYER PROFILE
   ============================================================ */

/*
 * هذا الملف يحتفظ ببيانات الملف المحلي القديمة
 * للتوافق مع أجزاء اللعبة الحالية.
 *
 * الحسابات المسجلة يجب أن تعتمد على الخادم،
 * وليس على هذه البيانات باعتبارها المصدر الأساسي.
 */

var PF = {

  name: 'لاعب',

  played: 0,

  w: 0,

  l: 0,

  d: 0,

  lastNamed: 0

};


try {

  var pv = JSON.parse(
    localStorage.getItem('ofestra_p') || '{}'
  );

  if(
    pv &&
    typeof pv === 'object' &&
    !Array.isArray(pv)
  ){

    Object.keys(pv).forEach(function(key){

      PF[key] = pv[key];

    });

  }

} catch(e){

  console.warn(
    '[OFESTRA] Local profile load error:',
    e
  );

}


function savePF(){

  try {

    localStorage.setItem(
      'ofestra_p',
      JSON.stringify(PF)
    );

  } catch(e){

    console.warn(
      '[OFESTRA] Local profile save error:',
      e
    );

  }

}


/* ============================================================
   08 — GUEST PLAYER UID
   ============================================================ */

/*
 * UID محلي للضيف.
 * لا يعتبر UID الحساب المسجل في الخادم.
 */

var UID = (function(){

  try {

    var u = localStorage.getItem(
      'ofestra_uid'
    );

    if(!u){

      u =
        Math.random().toString(36).slice(2, 10) +
        Date.now().toString(36).slice(-3);

      localStorage.setItem(
        'ofestra_uid',
        u
      );

    }

    return u;

  } catch(e){

    return (
      Math.random().toString(36).slice(2, 10)
    );

  }

})();


/* ============================================================
   09 — DEFAULT AVATAR
   ============================================================ */

if(
  typeof AV !== 'undefined' &&
  Array.isArray(AV) &&
  AV.length > 0
){

  if(
    !Number.isInteger(Number(PF.av)) ||
    Number(PF.av) < 0 ||
    Number(PF.av) >= AV.length
  ){

    var avatarSeed = parseInt(
      UID.slice(0, 2),
      36
    );

    if(!Number.isFinite(avatarSeed)){

      avatarSeed = 0;

    }

    PF.av = avatarSeed % AV.length;

  }

}


/* ============================================================
   10 — BLOCKED USERS
   ============================================================ */

var BLOCKED = {};

try {

  var savedBlocked = JSON.parse(
    localStorage.getItem('ofestra_blocked') || '{}'
  );

  if(
    savedBlocked &&
    typeof savedBlocked === 'object' &&
    !Array.isArray(savedBlocked)
  ){

    BLOCKED = savedBlocked;

  }

} catch(e){

  BLOCKED = {};

}


function saveBlocked(){

  try {

    localStorage.setItem(
      'ofestra_blocked',
      JSON.stringify(BLOCKED)
    );

  } catch(e){

    console.warn(
      '[OFESTRA] Blocked users save error:',
      e
    );

  }

}


/* ============================================================
   11 — STORAGE ENGINE READY
   ============================================================ */

window.OFESTRA_STORAGE = {

  saveSettings: saveS,

  syncSettings: syncOfestraSettings,

  saveProfile: savePF,

  saveFriends: saveFriends,

  saveChats: saveChats,

  saveUnread: saveUnread,

  saveBlocked: saveBlocked,

  getMotionMode: function(){

    return S.enh
      ? 'enhanced'
      : 'classic';

  }

};

console.log(
  '[OFESTRA] Storage Engine Ready'
);
