/* =========================================================
   WFESCTRA — PROFILE UI (profile-ui.js)
   يربط الواجهة الموجودة في index.html (نافذة الحساب #accountModal
   والملف الشخصي #prof) بوحدات الحساب والبيانات والمستويات.
   لا يخزن بيانات حساب محلياً (التوكن فقط عبر config.js).
   ========================================================= */

(function (window, document) {
  'use strict';

  if (window.WFESCTRA_PROFILE_UI) return;

  var TAG = 'PROFILE-UI';
  var $ = function (id) { return document.getElementById(id); };

  function log(level, msg, data) {
    var S = window.WFESCTRA_SERVER;
    if (S && S.log) S.log(level, TAG, msg, data);
    else (console[level] || console.log)('[WFESCTRA][' + TAG + ']', msg, data || '');
  }

  var CORE = function () { return window.WFESCTRA_PROFILE_CORE; };
  var AUTH = function () { return window.WFESCTRA_PROFILE_AUTH; };
  var DATA = function () { return window.WFESCTRA_PROFILE_DATA; };
  var LEVELS = function () { return window.WFESCTRA_PROFILE_LEVELS; };

  var state = {
    initialized: false,
    view: 'login',      /* login | register */
    step: 'form',       /* form | verify | complete */
    password: '',       /* يُحفظ بالذاكرة فقط أثناء خطوات التسجيل */
    busy: false
  };

  /* -------------------------------------------------------
     أدوات صغيرة
     ------------------------------------------------------- */

  function feedback(message, kind) {
    var el = $('accountFeedback');
    if (!el) return;
    el.textContent = message || '';
    el.style.color = kind === 'error' ? 'var(--bad)' :
                     kind === 'ok' ? 'var(--ok)' : '';
  }

  function setBusy(value) {
    state.busy = !!value;
    var b = $('accountSubmit');
    if (b) {
      b.disabled = state.busy;
      b.setAttribute('aria-busy', state.busy ? 'true' : 'false');
    }
  }

  function show(id, visible) {
    var el = $(id);
    if (el) el.hidden = !visible;
  }

  function showLabel(forId, visible) {
    var l = document.querySelector('label[for="' + forId + '"]');
    if (l) l.hidden = !visible;
  }

  function errText(error) {
    var S = window.WFESCTRA_SERVER;
    return (S && S.getErrorMessage && S.getErrorMessage(error)) ||
      (error && error.message) || 'حدث خطأ غير متوقع.';
  }

  /* -------------------------------------------------------
     نافذة الحساب (تسجيل دخول / إنشاء حساب بثلاث خطوات)
     ------------------------------------------------------- */

  function renderAccountForm() {
    var reg = state.view === 'register';
    var step = reg ? state.step : 'form';
    var early = step === 'form';

    $('accountLoginTab').classList.toggle('on', !reg);
    $('accountRegisterTab').classList.toggle('on', reg);

    show('accountEmail', early || step === 'verify');
    showLabel('accountEmail', early || step === 'verify');
    $('accountEmail').readOnly = step !== 'form';

    show('accountPassword', early);
    showLabel('accountPassword', early);
    show('accountPasswordConfirm', reg && early);
    show('accountConfirmLabel', reg && early);

    show('accountCode', step === 'verify');
    showLabel('accountCode', step === 'verify');
    show('accountName', step === 'complete');
    showLabel('accountName', step === 'complete');

    show('accountForgotPassword', !reg);

    $('accountSubmit').textContent =
      !reg ? 'تسجيل الدخول' :
      step === 'form' ? 'إرسال رمز التحقق' :
      step === 'verify' ? 'تأكيد الرمز' : 'إنشاء الحساب';

    $('accountPassword').autocomplete = reg ? 'new-password' : 'current-password';

    $('accountModalSubtitle').textContent =
      !reg ? 'سجّل دخولك لحفظ تقدمك والوصول إلى حسابك من أجهزتك' :
      step === 'form' ? 'أدخل بريدك وكلمة مرور جديدة وسنرسل لك رمز تحقق' :
      step === 'verify' ? 'أدخل الرمز الذي وصل إلى بريدك الإلكتروني' :
      'آخر خطوة: اختر اسم اللاعب';
  }

  function setView(view) {
    state.view = view === 'register' ? 'register' : 'login';
    state.step = 'form';
    state.password = '';
    feedback('');
    renderAccountForm();
  }

  function openAccount(view) {
    var m = $('accountModal');
    if (!m) return;
    setView(view || 'login');
    m.classList.add('on');
    m.setAttribute('aria-hidden', 'false');
  }

  function closeAccount() {
    var m = $('accountModal');
    if (!m) return;
    m.classList.remove('on');
    m.setAttribute('aria-hidden', 'true');
    ['accountPassword', 'accountPasswordConfirm', 'accountCode'].forEach(function (id) {
      if ($(id)) $(id).value = '';
    });
    state.password = '';
  }

  async function refreshServerData() {
    var d = DATA(), l = LEVELS();
    if (d) {
      try { await d.refresh(); }
      catch (e) { log('warn', 'E-PROFILE تعذر جلب الملف الشخصي', errText(e)); }
    }
    if (l) {
      try { await l.refresh(); }
      catch (e) { log('warn', 'E-STATS تعذر جلب الإحصائيات', errText(e)); }
    }
    renderProfile();
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (state.busy) return;

    var A = AUTH();
    if (!A) { feedback('وحدة الحسابات غير محمّلة.', 'error'); return; }

    var email = $('accountEmail').value.trim();
    var password = $('accountPassword').value;
    var reg = state.view === 'register';

    setBusy(true);
    feedback('');

    try {
      if (!reg) {
        await A.login({ email: email, password: password });
        $('accountPassword').value = '';
        closeAccount();
        await refreshServerData();
        return;
      }

      if (state.step === 'form') {
        if (password !== $('accountPasswordConfirm').value) {
          throw new Error('كلمتا المرور غير متطابقتين.');
        }
        await A.registerRequest({ email: email, password: password });
        state.password = password;
        state.step = 'verify';
        $('accountPassword').value = '';
        $('accountPasswordConfirm').value = '';
        renderAccountForm();
        feedback('تم إرسال الرمز إلى بريدك. تحقق من صندوق الوارد أو الرسائل المزعجة.', 'ok');
        return;
      }

      if (state.step === 'verify') {
        await A.registerVerify({ email: email, code: $('accountCode').value.trim() });
        state.step = 'complete';
        renderAccountForm();
        feedback('تم التحقق من البريد. اختر اسمك.', 'ok');
        return;
      }

      if (!state.password) {
        state.step = 'form';
        renderAccountForm();
        throw new Error('انتهت الجلسة المؤقتة، أعد إدخال كلمة المرور.');
      }

      await A.registerComplete({
        email: email,
        password: state.password,
        displayName: $('accountName').value
      });
      state.password = '';
      closeAccount();
      await refreshServerData();

    } catch (error) {
      log('error', 'E-AUTH ' + (reg ? 'التسجيل' : 'الدخول'), errText(error));
      feedback(errText(error), 'error');
    } finally {
      setBusy(false);
    }
  }

  /* -------------------------------------------------------
     الملف الشخصي
     ------------------------------------------------------- */

  function renderEntry() {
    var A = AUTH();
    var user = A && A.getUser ? A.getUser() : null;
    var title = $('accountEntryTitle'), status = $('accountEntryStatus'), btn = $('openAccountAuth');
    if (!title) return;

    if (user) {
      title.textContent = CORE().get('display_name', user.display_name || 'حسابي');
      status.textContent = (user.email || '') + ' · تقدمك محفوظ على السيرفر';
      btn.textContent = 'تسجيل الخروج';
    } else {
      title.textContent = 'حساب اللاعب';
      status.textContent = 'غير مسجل الدخول · احفظ تقدمك واربط حسابك';
      btn.textContent = 'تسجيل الدخول';
    }
  }

  function renderCard() {
    var box = $('pfCard');
    if (!box) return;
    var lv = window.calcLv();
    var PF = window.PF;
    var pct = lv.next > 0 ? Math.max(0, Math.min(100, Math.round((lv.xp / lv.next) * 100))) : 0;

    box.textContent = '';
    var wrap = document.createElement('div');
    wrap.style.cssText = 'text-align:center;margin:8px 0 14px';

    var av = document.createElement('div');
    av.style.fontSize = '48px';
    av.textContent = window.AV[PF.av] || '👤';

    var nm = document.createElement('b');
    nm.style.cssText = 'display:block;font-size:18px';
    nm.textContent = PF.name;

    var sub = document.createElement('small');
    sub.className = 'nt';
    sub.textContent = window.titleOf(lv.lv) + ' • المستوى ' + lv.lv;

    var bar = document.createElement('div');
    bar.style.cssText = 'height:8px;border-radius:6px;background:var(--card);margin:8px 12px 2px;overflow:hidden';
    var fill = document.createElement('div');
    fill.style.cssText = 'height:100%;background:var(--gold);width:' + pct + '%';
    bar.appendChild(fill);

    var xp = document.createElement('small');
    xp.className = 'nt';
    xp.textContent = lv.next ? lv.xp + ' / ' + lv.next + ' XP' : '';

    [av, nm, sub, bar, xp].forEach(function (e) { wrap.appendChild(e); });
    box.appendChild(wrap);
  }

  function renderAvatars() {
    var grid = $('avGrid');
    if (!grid) return;
    grid.textContent = '';
    window.AV.forEach(function (emoji, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = emoji;
      b.className = window.PF.av === i ? 'on' : '';
      b.onclick = function () {
        window.PF.av = i;
        window.savePF();
        if (typeof window.publishDir === 'function') window.publishDir();
        window.X.sw();
        renderProfile();
      };
      grid.appendChild(b);
    });
  }

  function renderStats() {
    var box = $('pfStats');
    if (!box) return;
    var s = CORE().currentStats();
    box.textContent = '';
    [['المباريات', s.games], ['الفوز', s.wins], ['الخسارة', s.losses], ['نسبة الفوز', s.winRate + '%']]
      .forEach(function (row) {
        var d = document.createElement('div');
        d.className = 'st';
        var b = document.createElement('b');
        b.textContent = row[1];
        var sm = document.createElement('small');
        sm.textContent = row[0];
        d.appendChild(b);
        d.appendChild(sm);
        box.appendChild(d);
      });
  }

  function renderProfile() {
    if (!window.PF || !CORE()) return;
    renderEntry();
    renderCard();
    renderAvatars();
    renderStats();
    var inp = $('pfName');
    if (inp && document.activeElement !== inp) inp.value = window.PF.name;
  }

  async function saveName() {
    var inp = $('pfName'), note = $('nameChangeNotice');
    var PF = window.PF;
    var name = window.cleanName(inp.value);
    note.textContent = '';

    if (name === PF.name) return;

    var wait = 3600000 - (Date.now() - (Number(PF.lastNamed) || 0));
    if (wait > 0) {
      note.textContent = 'يمكنك تغيير الاسم بعد ' + Math.ceil(wait / 60000) + ' دقيقة.';
      inp.value = PF.name;
      return;
    }

    if (AUTH() && AUTH().isLoggedIn() && DATA()) {
      try {
        await DATA().updateDisplayName(name);
      } catch (error) {
        log('error', 'E-PROFILE تعذر حفظ الاسم', errText(error));
        note.textContent = errText(error);
        inp.value = PF.name;
        return;
      }
    }

    PF.name = name;
    PF.lastNamed = Date.now();
    window.savePF();
    if (typeof window.publishDir === 'function') window.publishDir();
    renderProfile();
    window.X.ui();
  }

  function resetStats() {
    var note = $('nameChangeNotice');
    if (AUTH() && AUTH().isLoggedIn()) {
      note.textContent = 'إحصائيات الحساب محفوظة على السيرفر ولا يمكن مسحها من هنا.';
      return;
    }
    if (!window.confirm('مسح الإحصائيات المحلية؟')) return;
    var PF = window.PF;
    PF.played = PF.w = PF.l = PF.d = 0;
    window.savePF();
    renderProfile();
  }

  async function onEntryAction() {
    var A = AUTH();
    if (A && A.isLoggedIn()) {
      await A.logout();
      renderProfile();
    } else {
      openAccount('login');
    }
  }

  /* -------------------------------------------------------
     الربط
     ------------------------------------------------------- */

  function openProfile() {
    window.cx();
    window.openProf();
    renderProfile();

    var A = AUTH();
    if (A && !A.isLoggedIn() && window.WFESCTRA_SERVER.getToken()) {
      /* توكن محفوظ لكن الجلسة لم تُسترجع (غالباً السيرفر كان غير متصل) */
      A.restoreSession().then(refreshServerData).catch(function (e) {
        log('warn', 'E-AUTH تعذر استرجاع الجلسة', errText(e));
      });
    } else if (A && A.isLoggedIn()) {
      refreshServerData();
    }
  }

  function bind() {
    $('btnProfileOpen').onclick = openProfile;
    $('xP').onclick = $('bkP').onclick = window.closeProf;

    $('openAccountAuth').onclick = onEntryAction;
    $('closeAccountModal').onclick = closeAccount;
    $('bkAccount').onclick = closeAccount;
    $('accountLoginTab').onclick = function () { setView('login'); };
    $('accountRegisterTab').onclick = function () { setView('register'); };
    $('accountAuthForm').addEventListener('submit', handleSubmit);
    $('accountForgotPassword').onclick = function () {
      feedback('استعادة كلمة المرور غير متوفرة حالياً في السيرفر.', 'error');
    };

    $('pfName').onchange = saveName;
    $('pfName').onkeydown = function (e) { if (e.key === 'Enter') $('pfName').blur(); };
    $('pfReset').onclick = resetStats;

    window.addEventListener('wfesctra:auth-change', renderProfile);
    window.addEventListener('wfesctra:profile-change', renderProfile);
    window.addEventListener('wfesctra:stats-updated', renderProfile);

    window.addEventListener('wfesctra:auth-change', function (e) {
      if (e.detail && e.detail.user) refreshServerData();
    });

    window.addEventListener('online', function () {
      var A = AUTH();
      if (A && !A.isLoggedIn() && window.WFESCTRA_SERVER.getToken()) {
        A.restoreSession().catch(function () {});
      }
    });
  }

  function init() {
    if (state.initialized) return;
    state.initialized = true;

    try {
      bind();
      renderAccountForm();
      renderProfile();
      log('info', 'Profile UI جاهز');
    } catch (error) {
      log('error', 'E-UI فشل ربط واجهة الملف الشخصي', error && error.message);
      throw error;
    }
  }

  window.WFESCTRA_PROFILE_UI = {
    init: init,
    render: renderProfile,
    openAccount: openAccount,
    closeAccount: closeAccount,
    openProfile: openProfile
  };

})(window, document);
