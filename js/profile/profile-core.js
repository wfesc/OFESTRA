/* =========================================================
   WFESCTRA — PROFILE CORE (profile-core.js)
   الدور:
   1) واجهة CORE التي تعتمد عليها بقية وحدات البروفايل.
   2) الدوال التي تحتاجها اللعبة (calcLv, titleOf, infoOf, myInfo,
      cleanInfo, pfNotify) — كانت مفقودة وهي سبب الأخطاء.
   3) مزامنة هوية اللاعب (UID + الاسم) مع حساب السيرفر.
   ترتيب التحميل: بعد friends.js وقبل profile-server.js
   ========================================================= */

(function (window, document) {
  'use strict';

  if (window.WFESCTRA_PROFILE_CORE) return;

  var TAG = 'PROFILE';
  var AV_COUNT = (window.AV && window.AV.length) || 20;

  function log(level, msg, data) {
    var S = window.WFESCTRA_SERVER;
    if (S && S.log) S.log(level, TAG, msg, data);
    else (console[level] || console.log)('[WFESCTRA][' + TAG + ']', msg, data || '');
  }

  /* -------------------------------------------------------
     1. بيانات البروفايل (ذاكرة فقط — المصدر الأساسي السيرفر)
     ------------------------------------------------------- */

  var profile = {};

  function emit(name, detail) {
    try {
      window.dispatchEvent(new CustomEvent(name, { detail: detail || {} }));
    } catch (e) {}
  }

  function isObj(v) {
    return v && typeof v === 'object' && !Array.isArray(v);
  }

  function setProfile(patch, meta) {
    if (!isObj(patch)) return profile;
    Object.keys(patch).forEach(function (k) { profile[k] = patch[k]; });
    emit('wfesctra:profile-change', { profile: profile, meta: meta || {} });
    return profile;
  }

  function clearProfile() {
    Object.keys(profile).forEach(function (k) { delete profile[k]; });
    emit('wfesctra:profile-change', { profile: profile, meta: { source: 'clear' } });
  }

  function get(path, fallback) {
    var cur = profile;
    String(path || '').split('.').forEach(function (key) {
      cur = cur && typeof cur === 'object' ? cur[key] : undefined;
    });
    return cur === undefined || cur === null ? fallback : cur;
  }

  /* -------------------------------------------------------
     2. أدوات مساعدة
     ------------------------------------------------------- */

  function notify(message) {
    if (typeof window.showToastNotification === 'function') {
      window.showToastNotification(String(message));
    } else {
      log('info', String(message));
    }
  }

  function setLoading(value) {
    document.body.classList.toggle('wfesctra-loading', !!value);
  }

  function emailValid(v) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || '').trim());
  }

  function displayNameValid(v) {
    var n = String(v || '').trim();
    return n.length >= 2 && n.length <= 32;
  }

  function usernameValid(v) {
    return /^[A-Za-z0-9_]{3,24}$/.test(String(v || ''));
  }

  function initials(name) {
    var n = String(name || '').trim();
    return n ? n.slice(0, 2).toUpperCase() : '👤';
  }

  function formatNumber(v) {
    var n = Number(v);
    return Number.isFinite(n) ? n.toLocaleString('ar-EG') : '0';
  }

  function formatDate(v) {
    if (!v) return '—';
    var d = new Date(v);
    return isNaN(d) ? '—' : d.toLocaleDateString('ar-EG');
  }

  /* -------------------------------------------------------
     3. دوال اللعبة (المستوى / المعلومات / الألقاب)
     ------------------------------------------------------- */

  function loggedIn() {
    var A = window.WFESCTRA_PROFILE_AUTH;
    return !!(A && A.isLoggedIn && A.isLoggedIn());
  }

  /* إحصائيات معتمدة: من السيرفر إذا مسجّل، وإلا محلية. */
  function currentStats() {
    var st = get('stats', null);
    if (loggedIn() && isObj(st)) {
      return {
        games: Number(st.games) || 0,
        wins: Number(st.wins) || 0,
        losses: Number(st.losses) || 0,
        draws: Number(st.draws) || 0,
        winRate: Number(st.win_rate) || 0,
        server: true
      };
    }
    var PF = window.PF || {};
    var games = Number(PF.played) || 0;
    var wins = Number(PF.w) || 0;
    return {
      games: games,
      wins: wins,
      losses: Number(PF.l) || 0,
      draws: Number(PF.d) || 0,
      winRate: games ? Math.round((wins / games) * 100) : 0,
      server: false
    };
  }

  function calcLv() {
    var serverLevel = Number(get('level', 0));
    if (loggedIn() && serverLevel > 0) {
      return {
        lv: serverLevel,
        xp: Number(get('xp', 0)),
        next: Number(get('next_level_xp', 0))
      };
    }
    var s = currentStats();
    var xp = s.wins * 30 + s.draws * 10 + s.losses * 5;
    var lv = 1, need = 100, left = xp;
    while (left >= need && lv < 99) {
      left -= need;
      lv++;
      need = 100 + (lv - 1) * 50;
    }
    return { lv: lv, xp: left, next: need };
  }

  function titleOf(lv) {
    lv = Number(lv) || 1;
    if (lv >= 30) return 'أسطورة';
    if (lv >= 20) return 'خبير';
    if (lv >= 10) return 'محترف';
    if (lv >= 5) return 'متوسط';
    return 'مبتدئ';
  }

  function cleanInfo(o) {
    o = isObj(o) ? o : {};
    var clampInt = function (v, min, max) {
      v = Math.floor(Number(v));
      return Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : min;
    };
    return {
      av: clampInt(o.av, 0, AV_COUNT - 1),
      lv: clampInt(o.lv, 1, 99),
      wr: clampInt(o.wr, 0, 100),
      pl: clampInt(o.pl, 0, 1e6)
    };
  }

  function myInfo() {
    var s = currentStats();
    return cleanInfo({
      av: (window.PF && window.PF.av) || 0,
      lv: calcLv().lv,
      wr: s.winRate,
      pl: s.games
    });
  }

  function infoOf(uid) {
    var on = window.ONLINE_PLAYERS && window.ONLINE_PLAYERS[uid];
    if (on && on.info) return on.info;
    var seen = window.SEEN && window.SEEN[uid];
    if (seen && seen.info) return seen.info;
    return cleanInfo({});
  }

  /* -------------------------------------------------------
     4. هوية اللاعب (حساب السيرفر ↔ الأونلاين والأصدقاء)
     ------------------------------------------------------- */

  var GUEST_UID = window.UID;

  function applyIdentity(user) {
    var PF = window.PF;
    var uid = user && (user.id || user.user_id || user.uid);
    var newUid = uid ? 'u' + String(uid).replace(/\W/g, '').slice(0, 24) : GUEST_UID;
    var name = user && (user.display_name || get('display_name', '') || user.username);

    var changed = window.UID !== newUid;
    window.UID = newUid;

    if (PF && name && typeof window.cleanName === 'function') {
      PF.name = window.cleanName(name);
      if (typeof window.savePF === 'function') window.savePF();
    }

    if (changed) {
      log('info', 'تغيرت هوية اللاعب', { uid: newUid });
      if (typeof window.netReset === 'function') window.netReset();
      if (typeof window.syncFriendsFromServer === 'function') {
        window.syncFriendsFromServer();
      }
    }
  }

  window.addEventListener('wfesctra:auth-change', function (event) {
    var user = event.detail && event.detail.user ? event.detail.user : null;
    applyIdentity(user);
    if (!user) clearProfile();
  });

  window.addEventListener('wfesctra:profile-change', function () {
    var name = get('display_name', '');
    if (loggedIn() && name && window.PF && typeof window.cleanName === 'function') {
      var clean = window.cleanName(name);
      if (window.PF.name !== clean) {
        window.PF.name = clean;
        if (typeof window.savePF === 'function') window.savePF();
        if (typeof window.publishDir === 'function') window.publishDir();
      }
    }
  });

  /* -------------------------------------------------------
     5. تشغيل النظام
     ------------------------------------------------------- */

  var started = false;

  function start() {
    if (started) return true;
    started = true;

    var A = window.WFESCTRA_PROFILE_AUTH;
    if (A && A.init) {
      A.init().catch(function (e) {
        log('error', 'E-AUTH فشل استرجاع الجلسة', e && e.message);
      });
    } else {
      log('error', 'E-AUTH وحدة الحسابات غير محمّلة (profile-auth.js)');
    }

    var UI = window.WFESCTRA_PROFILE_UI;
    if (UI && UI.init) UI.init();

    return true;
  }

  var CORE = {
    version: '2.0.0',
    get profile() { return profile; },
    setProfile: setProfile,
    clearProfile: clearProfile,
    get: get,
    notify: notify,
    setLoading: setLoading,
    emailValid: emailValid,
    displayNameValid: displayNameValid,
    usernameValid: usernameValid,
    initials: initials,
    formatNumber: formatNumber,
    formatDate: formatDate,
    currentStats: currentStats,
    isLoggedIn: loggedIn,
    start: start
  };

  window.WFESCTRA_PROFILE_CORE = CORE;
  window.WFESCTRA_PROFILE = CORE;

  /* دوال عامة تستخدمها game.js / online.js / friends.js / ui.js / main.js */
  window.calcLv = calcLv;
  window.titleOf = titleOf;
  window.infoOf = infoOf;
  window.myInfo = myInfo;
  window.cleanInfo = cleanInfo;
  window.pfNotify = notify;
  window.initProfile = start;
  window.firstRunProfile = function () {};

  log('info', 'Profile Core جاهز');

})(window, document);
