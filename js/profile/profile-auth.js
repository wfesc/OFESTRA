
/* ============================================================
   WFESCTRA — PROFILE AUTH
   File: js/profile/profile-auth.js

   DEMO AUTHENTICATION ENGINE
   - Local prototype only
   - No server connection
   - No real email delivery
   - Passwords remain in memory only
   ============================================================ */

(function (window, document) {
  'use strict';

  if (window.WFESCTRA_AUTH) {
    console.warn('[WFESCTRA AUTH] Already initialized.');
    return;
  }

  var $ = function (id) {
    return document.getElementById(id);
  };

  var accounts = new Map();

  var state = {
    initialized: false,
    mode: 'login',
    stage: 'credentials',
    currentUser: null,
    pendingUser: null,
    verificationCode: null,
    attempts: 0
  };

  var MAX_ATTEMPTS = 5;

  /* =========================================================
     01 — UTILITIES
     ========================================================= */

  function normalizeEmail(email) {
    return String(email || '')
      .trim()
      .toLowerCase();
  }

  function makeId() {
    var random = Math.random()
      .toString(36)
      .slice(2, 9)
      .toUpperCase();

    var time = Date.now()
      .toString(36)
      .slice(-5)
      .toUpperCase();

    return 'WFS-' + time + random;
  }

  function makeVerificationCode() {
    return String(
      Math.floor(100000 + Math.random() * 900000)
    );
  }

  function validEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
  }

  function validPassword(password) {
    return typeof password === 'string' &&
      password.length >= 8 &&
      password.length <= 72;
  }

  function validName(name) {
    name = String(name || '').trim();

    return name.length >= 2 &&
      name.length <= 14;
  }

  function setFeedback(message, type) {
    var box = $('accountFeedback');

    if (!box) return;

    box.textContent = message || '';

    box.style.color =
      type === 'error'
        ? 'var(--bad)'
        : type === 'success'
          ? 'var(--ok)'
          : 'var(--mut)';
  }

  function setBusy(busy) {
    var button = $('accountSubmit');

    if (!button) return;

    button.disabled = !!busy;

    button.style.opacity = busy ? '.6' : '';

    button.style.pointerEvents = busy
      ? 'none'
      : '';
  }

  /* =========================================================
     02 — MODAL CONTROL
     ========================================================= */

  function openModal(mode) {
    var modal = $('accountModal');

    if (!modal) {
      console.warn(
        '[WFESCTRA AUTH] accountModal not found.'
      );
      return false;
    }

    setMode(mode || 'login');

    modal.classList.add('on');

    modal.setAttribute('aria-hidden', 'false');

    setFeedback('', 'normal');

    var email = $('accountEmail');

    if (email) {
      window.setTimeout(function () {
        try {
          email.focus({ preventScroll: true });
        } catch (error) {
          email.focus();
        }
      }, 150);
    }

    return true;
  }

  function closeModal() {
    var modal = $('accountModal');

    if (modal) {
      modal.classList.remove('on');

      modal.setAttribute('aria-hidden', 'true');
    }

    resetVerification();

    setBusy(false);

    setFeedback('', 'normal');
  }

  function setMode(mode) {
    state.mode = mode === 'register'
      ? 'register'
      : 'login';

    state.stage = 'credentials';

    var loginTab = $('accountLoginTab');
    var registerTab = $('accountRegisterTab');

    if (loginTab) {
      loginTab.classList.toggle(
        'on',
        state.mode === 'login'
      );
    }

    if (registerTab) {
      registerTab.classList.toggle(
        'on',
        state.mode === 'register'
      );
    }

    var title = $('accountModalTitle');
    var subtitle = $('accountModalSubtitle');
    var confirm = $('accountPasswordConfirm');
    var confirmLabel = $('accountConfirmLabel');
    var submit = $('accountSubmit');
    var forgot = $('accountForgotPassword');

    if (title) {
      title.textContent = state.mode === 'login'
        ? 'تسجيل الدخول'
        : 'إنشاء حساب جديد';
    }

    if (subtitle) {
      subtitle.textContent = state.mode === 'login'
        ? 'أهلاً بعودتك إلى WFESCTRA'
        : 'أنشئ حسابك وابدأ رحلتك';
    }

    if (confirm) {
      confirm.hidden = state.mode !== 'register';
      confirm.required = state.mode === 'register';
    }

    if (confirmLabel) {
      confirmLabel.hidden = state.mode !== 'register';
    }

    if (submit) {
      submit.textContent = state.mode === 'login'
        ? 'دخول'
        : 'إنشاء الحساب';
    }

    if (forgot) {
      forgot.hidden = state.mode !== 'login';
    }

    var nameField = $('accountDisplayName');
    var nameLabel = $('accountDisplayNameLabel');

    if (nameField) {
      nameField.hidden = state.mode !== 'register';
      nameField.required = state.mode === 'register';
    }

    if (nameLabel) {
      nameLabel.hidden = state.mode !== 'register';
    }

    var otp = $('accountOtpWrap');

    if (otp) {
      otp.hidden = true;
    }

    setFeedback('', 'normal');
  }

  /* =========================================================
     03 — VERIFICATION UI
     ========================================================= */

  function ensureVerificationUI() {
    var form = $('accountAuthForm');

    if (!form) return null;

    var wrap = $('accountOtpWrap');

    if (wrap) return wrap;

    wrap = document.createElement('div');

    wrap.id = 'accountOtpWrap';

    wrap.hidden = true;

    var label = document.createElement('label');

    label.className = 'account-label';

    label.htmlFor = 'accountOtp';

    label.textContent = 'رمز التحقق التجريبي';

    var input = document.createElement('input');

    input.id = 'accountOtp';

    input.className = 'inp';

    input.type = 'text';

    input.inputMode = 'numeric';

    input.autocomplete = 'one-time-code';

    input.maxLength = 6;

    input.placeholder = 'أدخل الرمز المكوّن من 6 أرقام';

    var hint = document.createElement('small');

    hint.id = 'accountOtpHint';

    hint.className = 'nt';

    hint.style.display = 'block';

    hint.style.textAlign = 'center';

    hint.textContent =
      'رمز محلي للاختبار فقط، لا يتم إرسال بريد إلكتروني.';

    wrap.appendChild(label);
    wrap.appendChild(input);
    wrap.appendChild(hint);

    var submit = $('accountSubmit');

    if (submit && submit.parentNode === form) {
      form.insertBefore(wrap, submit);
    } else {
      form.appendChild(wrap);
    }

    return wrap;
  }

  function showVerification(code) {
    var wrap = ensureVerificationUI();

    if (!wrap) return;

    wrap.hidden = false;

    var hint = $('accountOtpHint');

    if (hint) {
      hint.textContent =
        'رمز الاختبار الخاص بك: ' + code;
    }

    var input = $('accountOtp');

    if (input) {
      input.value = '';
      input.focus();
    }

    state.stage = 'verification';

    var button = $('accountSubmit');

    if (button) {
      button.textContent = 'تأكيد الحساب';
    }

    setFeedback(
      'تم إنشاء الحساب. أدخل رمز التحقق الظاهر أدناه.',
      'success'
    );
  }

  function resetVerification() {
    state.stage = 'credentials';

    state.pendingUser = null;

    state.verificationCode = null;

    state.attempts = 0;

    var wrap = $('accountOtpWrap');

    if (wrap) {
      wrap.hidden = true;
    }

    var input = $('accountOtp');

    if (input) {
      input.value = '';
    }
  }

  /* =========================================================
     04 — REGISTRATION
     ========================================================= */

  function beginRegistration() {
    var email = normalizeEmail(
      $('accountEmail') && $('accountEmail').value
    );

    var password = String(
      $('accountPassword') &&
      $('accountPassword').value || ''
    );

    var confirm = String(
      $('accountPasswordConfirm') &&
      $('accountPasswordConfirm').value || ''
    );

    var name = String(
      $('accountDisplayName') &&
      $('accountDisplayName').value || ''
    ).trim();

    if (!validName(name)) {
      setFeedback(
        'اسم اللاعب يجب أن يكون بين حرفين و14 حرفاً.',
        'error'
      );
      return;
    }

    if (!validEmail(email)) {
      setFeedback(
        'يرجى إدخال بريد إلكتروني صحيح.',
        'error'
      );
      return;
    }

    if (!validPassword(password)) {
      setFeedback(
        'كلمة المرور يجب أن تكون 8 أحرف على الأقل.',
        'error'
      );
      return;
    }

    if (password !== confirm) {
      setFeedback(
        'كلمتا المرور غير متطابقتين.',
        'error'
      );
      return;
    }

    if (accounts.has(email)) {
      setFeedback(
        'هذا البريد مسجل مسبقاً في هذه الجلسة.',
        'error'
      );
      return;
    }

    state.pendingUser = {
      id: makeId(),
      email: email,
      password: password,
      name: name,
      createdAt: new Date().toISOString(),
      verified: false
    };

    state.verificationCode = makeVerificationCode();

    state.attempts = 0;

    showVerification(state.verificationCode);
  }

  function finishRegistration() {
    var input = $('accountOtp');

    var entered = String(
      input && input.value || ''
    ).trim();

    if (!state.pendingUser) {
      setFeedback(
        'انتهت عملية التسجيل. ابدأ من جديد.',
        'error'
      );
      resetVerification();
      return;
    }

    if (!/^\d{6}$/.test(entered)) {
      setFeedback(
        'أدخل رمزاً صحيحاً مكوّناً من 6 أرقام.',
        'error'
      );
      return;
    }

    state.attempts++;

    if (entered !== state.verificationCode) {
      if (state.attempts >= MAX_ATTEMPTS) {
        resetVerification();

        setMode('register');

        setFeedback(
          'تجاوزت عدد المحاولات. أعد التسجيل.',
          'error'
        );

        return;
      }

      setFeedback(
        'الرمز غير صحيح. المحاولة ' +
        state.attempts + ' من ' + MAX_ATTEMPTS,
        'error'
      );

      return;
    }

    var account = Object.assign(
      {},
      state.pendingUser,
      {
        verified: true
      }
    );

    accounts.set(account.email, account);

    state.pendingUser = null;

    state.verificationCode = null;

    state.attempts = 0;

    activate(account);

    closeModal();

    setFeedback(
      'تم إنشاء الحساب وتسجيل الدخول بنجاح.',
      'success'
    );

    notify('تم إنشاء حسابك التجريبي بنجاح.');
  }

  /* =========================================================
     05 — LOGIN
     ========================================================= */

  function login() {
    var email = normalizeEmail(
      $('accountEmail') && $('accountEmail').value
    );

    var password = String(
      $('accountPassword') &&
      $('accountPassword').value || ''
    );

    if (!validEmail(email)) {
      setFeedback(
        'تحقق من البريد الإلكتروني.',
        'error'
      );
      return;
    }

    if (!password) {
      setFeedback(
        'أدخل كلمة المرور.',
        'error'
      );
      return;
    }

    var account = accounts.get(email);

    if (!account || account.password !== password) {
      setFeedback(
        'البريد الإلكتروني أو كلمة المرور غير صحيحة.',
        'error'
      );
      return;
    }

    if (!account.verified) {
      setFeedback(
        'هذا الحساب لم يكتمل التحقق منه.',
        'error'
      );
      return;
    }

    activate(account);

    closeModal();

    notify('أهلاً بعودتك ' + account.name);
  }

  /* =========================================================
     06 — ACCOUNT SESSION
     ========================================================= */

  function activate(account) {
    if (!account || !account.verified) return false;

    state.currentUser = {
      id: account.id,
      email: account.email,
      name: account.name,
      createdAt: account.createdAt,
      verified: true
    };

    window.dispatchEvent(
      new CustomEvent('wfesctra:auth-change', {
        detail: {
          authenticated: true,
          user: Object.assign({}, state.currentUser)
        }
      })
    );

    return true;
  }

  function logout() {
    var previous = state.currentUser;

    state.currentUser = null;

    closeModal();

    window.dispatchEvent(
      new CustomEvent('wfesctra:auth-change', {
        detail: {
          authenticated: false,
          user: null,
          previousUser: previous
        }
      })
    );

    notify('تم تسجيل الخروج.');

    return true;
  }

  function getCurrentUser() {
    return state.currentUser
      ? Object.assign({}, state.currentUser)
      : null;
  }

  function isLoggedIn() {
    return !!state.currentUser;
  }

  /* =========================================================
     07 — FORM SUBMISSION
     ========================================================= */

  function handleSubmit(event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    if (state.stage === 'verification') {
      finishRegistration();
      return;
    }

    if (state.mode === 'register') {
      beginRegistration();
      return;
    }

    login();
  }

  /* =========================================================
     08 — NOTIFICATIONS
     ========================================================= */

  function notify(message) {
    if (typeof window.showToast === 'function') {
      window.showToast(message);
      return;
    }

    var toast = $('toastNotif');

    if (toast) {
      toast.textContent = message;

      toast.classList.add('show');

      window.setTimeout(function () {
        toast.classList.remove('show');
      }, 2600);

      return;
    }

    console.info('[WFESCTRA]', message);
  }

  /* =========================================================
     09 — INITIALIZATION
     ========================================================= */

  function init() {
    if (state.initialized) return true;

    var form = $('accountAuthForm');

    if (form) {
      form.addEventListener('submit', handleSubmit);
    }

    var loginTab = $('accountLoginTab');

    if (loginTab) {
      loginTab.addEventListener('click', function () {
        resetVerification();
        setMode('login');
      });
    }

    var registerTab = $('accountRegisterTab');

    if (registerTab) {
      registerTab.addEventListener('click', function () {
        resetVerification();
        setMode('register');
      });
    }

    var openButton = $('openAccountAuth');

    if (openButton) {
      openButton.addEventListener('click', function () {
        openModal('login');
      });
    }

    var closeButton = $('closeAccountModal');

    if (closeButton) {
      closeButton.addEventListener('click', closeModal);
    }

    var backdrop = $('bkAccount');

    if (backdrop) {
      backdrop.addEventListener('click', closeModal);
    }

    var forgot = $('accountForgotPassword');

    if (forgot) {
      forgot.addEventListener('click', function (event) {
        if (event) event.preventDefault();

        setFeedback(
          'استعادة كلمة المرور غير متاحة في النسخة التجريبية.',
          'normal'
        );
      });
    }

    state.initialized = true;

    console.log('[WFESCTRA AUTH] Ready.');

    return true;
  }

  /* =========================================================
     10 — PUBLIC API
     ========================================================= */

  window.WFESCTRA_AUTH = {
    init: init,

    open: openModal,

    close: closeModal,

    setMode: setMode,

    login: login,

    register: beginRegistration,

    verify: finishRegistration,

    logout: logout,

    isLoggedIn: isLoggedIn,

    getCurrentUser: getCurrentUser,

    getState: function () {
      return {
        initialized: state.initialized,
        mode: state.mode,
        stage: state.stage,
        authenticated: isLoggedIn()
      };
    }
  };

})(window, document);
