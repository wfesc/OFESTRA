
/* =========================================================
   WFESCTRA — PROFILE UI
   Authentication & Profile Interface Controller
   Version: 1.0.0

   Dependencies:
   profile-core.js
   profile-auth.js
   profile-data.js
   profile-levels.js
   profile-server.js

   Storage: NO LOCAL PROFILE STORAGE
   ========================================================= */

(() => {
  'use strict';

  if (window.OFESTRA_PROFILE_UI) {
    console.warn('[WFESCTRA] Profile UI already initialized.');
    return;
  }

  const CORE = window.OFESTRA_PROFILE_CORE;
  const AUTH = window.OFESTRA_PROFILE_AUTH;
  const DATA = window.OFESTRA_PROFILE_DATA;
  const LEVELS = window.OFESTRA_PROFILE_LEVELS;

  if (!CORE || !AUTH || !DATA || !LEVELS) {
    console.error(
      '[WFESCTRA] Profile UI dependencies are missing.'
    );
    return;
  }

  const CONFIG = Object.freeze({
    ROOT: '[data-wfesctra-profile]',
    AUTH_ROOT: '[data-wfesctra-auth]',

    EVENTS: {
      READY: 'wfesctra:profile-ui-ready',
      LOGIN: 'wfesctra:ui-login',
      LOGOUT: 'wfesctra:ui-logout',
      ERROR: 'wfesctra:ui-error'
    }
  });

  const state = {
    initialized: false,
    busy: false,
    currentView: 'profile',
    lastError: null
  };

  /* =======================================================
     1. HELPERS
     ======================================================= */

  function $(selector, root = document) {
    return root.querySelector(selector);
  }

  function $$(selector, root = document) {
    return Array.from(root.querySelectorAll(selector));
  }

  function emit(name, detail = {}) {
    window.dispatchEvent(
      new CustomEvent(name, { detail })
    );
  }

  function notify(message, type = 'info') {
    CORE.notify(message, type);
  }

  function setText(element, value) {
    if (!element) return;

    element.textContent =
      value === null || value === undefined || value === ''
        ? '—'
        : String(value);
  }

  function setValue(element, value) {
    if (!element) return;

    element.value = value ?? '';
  }

  function setBusy(value) {
    state.busy = Boolean(value);

    $$('[data-wfesctra-submit]').forEach(button => {
      button.disabled = state.busy;
      button.setAttribute(
        'aria-busy',
        state.busy ? 'true' : 'false'
      );
    });

    CORE.setLoading(state.busy);
  }

  function getFormData(form) {
    const data = new FormData(form);
    return Object.fromEntries(data.entries());
  }

  function getInput(form, name) {
    return $(`[name="${name}"]`, form);
  }

  function clearPasswordFields(form) {
    $$('input[type="password"]', form).forEach(input => {
      input.value = '';
    });
  }

  function showError(message, target = document) {
    state.lastError = String(message || 'حدث خطأ غير متوقع.');

    const errorElement = $(
      '[data-wfesctra-error]',
      target
    );

    if (errorElement) {
      errorElement.textContent = state.lastError;
      errorElement.hidden = false;
    } else {
      notify(state.lastError, 'error');
    }

    emit(CONFIG.EVENTS.ERROR, {
      message: state.lastError
    });
  }

  function clearError(target = document) {
    const errorElement = $(
      '[data-wfesctra-error]',
      target
    );

    if (!errorElement) return;

    errorElement.textContent = '';
    errorElement.hidden = true;
  }

  function showView(view) {
    state.currentView = view;

    $$('[data-wfesctra-view]').forEach(element => {
      const active =
        element.dataset.wfesctraView === view;

      element.hidden = !active;
      element.setAttribute(
        'aria-hidden',
        active ? 'false' : 'true'
      );
    });

    $$('[data-wfesctra-view-button]').forEach(button => {
      const active =
        button.dataset.wfesctraViewButton === view;

      button.classList.toggle('active', active);
      button.setAttribute(
        'aria-current',
        active ? 'page' : 'false'
      );
    });
  }

  /* =======================================================
     2. PROFILE RENDERING
     ======================================================= */

  function renderProfile() {
    const profile = CORE.profile;

    $$('[data-wfesctra-field]').forEach(element => {
      const path = element.dataset.wfesctraField;

      if (!path) return;

      const value = CORE.get(path, null);

      if (
        element instanceof HTMLInputElement ||
        element instanceof HTMLTextAreaElement
      ) {
        setValue(element, value);
      } else {
        setText(element, value);
      }
    });

    $$('[data-wfesctra-avatar]').forEach(element => {
      const avatar = profile.avatar;

      if (avatar) {
        element.src = avatar;
        element.hidden = false;
      } else {
        element.removeAttribute('src');
        element.hidden = false;
      }
    });

    $$('[data-wfesctra-initials]').forEach(element => {
      setText(
        element,
        CORE.initials(
          profile.display_name ||
          profile.username
        )
      );
    });

    $$('[data-wfesctra-authenticated]').forEach(element => {
      element.hidden = !AUTH.isLoggedIn();
    });

    $$('[data-wfesctra-guest]').forEach(element => {
      element.hidden = AUTH.isLoggedIn();
    });

    $$('[data-wfesctra-level]').forEach(element => {
      setText(element, profile.level || 1);
    });

    $$('[data-wfesctra-xp]').forEach(element => {
      setText(element, CORE.formatNumber(profile.xp || 0));
    });

    $$('[data-wfesctra-created]').forEach(element => {
      setText(
        element,
        CORE.formatDate(profile.created_at)
      );
    });

    renderStats();
    renderAchievements();
  }

  function renderStats() {
    const stats = LEVELS.getStats() || CORE.get('stats', {});

    const fields = {
      games: stats.games,
      wins: stats.wins,
      losses: stats.losses,
      draws: stats.draws,
      win_rate: `${Number(stats.win_rate || 0)}%`,
      total_score: stats.total_score
    };

    for (const [key, value] of Object.entries(fields)) {
      $$(`[data-wfesctra-stat="${key}"]`).forEach(element => {
        setText(element, CORE.formatNumber(value ?? 0));
      });
    }

    const progress = LEVELS.getProgress();

    if (progress) {
      $$('[data-wfesctra-xp-progress]').forEach(element => {
        const percentage = Math.max(
          0,
          Math.min(100, progress.percentage)
        );

        element.style.width = `${percentage}%`;
        element.setAttribute(
          'aria-valuenow',
          String(percentage)
        );
      });

      $$('[data-wfesctra-xp-label]').forEach(element => {
        setText(
          element,
          `${CORE.formatNumber(progress.xp)} / ${CORE.formatNumber(progress.next_level_xp)} XP`
        );
      });
    }
  }

  function renderAchievements() {
    const achievements = LEVELS.getAchievements();

    $$('[data-wfesctra-achievements]').forEach(container => {
      container.replaceChildren();

      if (!achievements.length) {
        const empty = document.createElement('p');
        empty.textContent = 'لا توجد إنجازات لعرضها حالياً.';
        container.appendChild(empty);
        return;
      }

      achievements.forEach(achievement => {
        const item = document.createElement('div');

        item.className = 'wfesctra-achievement';
        item.dataset.unlocked = achievement.unlocked
          ? 'true'
          : 'false';

        const icon = document.createElement('span');
        icon.className = 'wfesctra-achievement-icon';
        icon.textContent = achievement.icon;

        const details = document.createElement('div');

        const title = document.createElement('strong');
        title.textContent = achievement.title || 'إنجاز';

        const description = document.createElement('p');
        description.textContent =
          achievement.description || '';

        details.append(title, description);
        item.append(icon, details);

        container.appendChild(item);
      });
    });
  }

  /* =======================================================
     3. LOGIN
     ======================================================= */

  async function login(form) {
    clearError(form);

    const values = getFormData(form);

    const email = String(values.email || '').trim();
    const password = String(values.password || '');

    if (!CORE.emailValid(email)) {
      showError('أدخل بريداً إلكترونياً صحيحاً.', form);
      return;
    }

    if (!password) {
      showError('أدخل كلمة المرور.', form);
      return;
    }

    setBusy(true);

    try {
      await AUTH.login(email, password);

      clearPasswordFields(form);

      await DATA.fetch();
      await LEVELS.refresh();

      renderProfile();

      showView('profile');

      emit(CONFIG.EVENTS.LOGIN, {
        user: AUTH.getUser()
      });

      notify('تم تسجيل الدخول بنجاح.', 'success');
    } catch (error) {
      showError(
        error?.message || 'تعذر تسجيل الدخول.',
        form
      );
    } finally {
      setBusy(false);
    }
  }

  /* =======================================================
     4. REGISTER REQUEST
     ======================================================= */

  async function registerRequest(form) {
    clearError(form);

    const values = getFormData(form);

    const email = String(values.email || '').trim();
    const password = String(values.password || '');

    if (!CORE.emailValid(email)) {
      showError('أدخل بريداً إلكترونياً صحيحاً.', form);
      return;
    }

    if (password.length < 8) {
      showError('كلمة المرور يجب أن تكون 8 أحرف على الأقل.', form);
      return;
    }

    setBusy(true);

    try {
      await AUTH.registerRequest(email, password);

      clearPasswordFields(form);

      showView('register-verify');

      notify(
        'تم إرسال طلب التسجيل. تحقق من بريدك الإلكتروني.',
        'success'
      );
    } catch (error) {
      showError(
        error?.message || 'تعذر إرسال رمز التحقق.',
        form
      );
    } finally {
      setBusy(false);
    }
  }

  /* =======================================================
     5. EMAIL VERIFICATION
     ======================================================= */

  async function registerVerify(form) {
    clearError(form);

    const values = getFormData(form);

    const email = String(values.email || '').trim();
    const code = String(values.code || '').trim();

    if (!CORE.emailValid(email)) {
      showError('أدخل البريد الإلكتروني المستخدم بالتسجيل.', form);
      return;
    }

    if (!code) {
      showError('أدخل رمز التحقق.', form);
      return;
    }

    setBusy(true);

    try {
      await AUTH.registerVerify(email, code);

      showView('register-complete');

      notify('تم التحقق من البريد الإلكتروني.', 'success');
    } catch (error) {
      showError(
        error?.message || 'رمز التحقق غير صحيح أو منتهي.',
        form
      );
    } finally {
      setBusy(false);
    }
  }

  /* =======================================================
     6. COMPLETE REGISTRATION
     ======================================================= */

  async function registerComplete(form) {
    clearError(form);

    const values = getFormData(form);

    const email = String(values.email || '').trim();
    const password = String(values.password || '');
    const displayName = String(
      values.display_name || ''
    ).trim();

    if (!CORE.emailValid(email)) {
      showError('البريد الإلكتروني غير صحيح.', form);
      return;
    }

    if (password.length < 8) {
      showError('كلمة المرور يجب أن تكون 8 أحرف على الأقل.', form);
      return;
    }

    if (!CORE.displayNameValid(displayName)) {
      showError('الاسم يجب أن يكون بين حرفين و32 حرفاً.', form);
      return;
    }

    setBusy(true);

    try {
      await AUTH.registerComplete(
        email,
        password,
        displayName
      );

      clearPasswordFields(form);

      await DATA.fetch();
      await LEVELS.refresh();

      renderProfile();
      showView('profile');

      notify('تم إنشاء حسابك بنجاح.', 'success');
    } catch (error) {
      showError(
        error?.message || 'تعذر إكمال إنشاء الحساب.',
        form
      );
    } finally {
      setBusy(false);
    }
  }

  /* =======================================================
     7. PROFILE UPDATE
     ======================================================= */

  async function updateProfile(form) {
    clearError(form);

    const values = getFormData(form);

    const changes = {};

    const allowed = [
      'display_name',
      'username',
      'avatar',
      'cover',
      'country',
      'bio'
    ];

    for (const field of allowed) {
      if (Object.prototype.hasOwnProperty.call(values, field)) {
        changes[field] = values[field];
      }
    }

    setBusy(true);

    try {
      await DATA.update(changes);

      renderProfile();

      notify('تم تحديث الملف الشخصي.', 'success');
    } catch (error) {
      showError(
        error?.message || 'تعذر تحديث الملف الشخصي.',
        form
      );
    } finally {
      setBusy(false);
    }
  }

  /* =======================================================
     8. LOGOUT
     ======================================================= */

  async function logout() {
    setBusy(true);

    try {
      await AUTH.logout();

      renderProfile();
      showView('login');

      emit(CONFIG.EVENTS.LOGOUT);

      notify('تم تسجيل الخروج.', 'success');
    } catch (error) {
      showError(
        error?.message || 'تعذر تسجيل الخروج.'
      );
    } finally {
      setBusy(false);
    }
  }

  /* =======================================================
     9. FORM ROUTER
     ======================================================= */

  async function handleFormSubmit(event) {
    const form = event.target.closest(
      '[data-wfesctra-form]'
    );

    if (!form) return;

    event.preventDefault();

    if (state.busy) return;

    const type = form.dataset.wfesctraForm;

    switch (type) {
      case 'login':
        return login(form);

      case 'register-request':
        return registerRequest(form);

      case 'register-verify':
        return registerVerify(form);

      case 'register-complete':
        return registerComplete(form);

      case 'profile-update':
        return updateProfile(form);

      default:
        console.warn(
          '[WFESCTRA] Unknown form type:',
          type
        );
    }
  }

  /* =======================================================
     10. ACTION ROUTER
     ======================================================= */

  async function handleAction(event) {
    const button = event.target.closest(
      '[data-wfesctra-action]'
    );

    if (!button) return;

    const action = button.dataset.wfesctraAction;

    switch (action) {
      case 'logout':
        event.preventDefault();
        return logout();

      case 'show-login':
        event.preventDefault();
        return showView('login');

      case 'show-register':
        event.preventDefault();
        return showView('register-request');

      case 'show-profile':
        event.preventDefault();

        if (!AUTH.isLoggedIn()) {
          showView('login');
          return;
        }

        showView('profile');
        return;

      case 'refresh-profile':
        event.preventDefault();

        if (!AUTH.isLoggedIn()) {
          notify('سجّل الدخول أولاً.', 'warning');
          return;
        }

        setBusy(true);

        try {
          await DATA.refresh();
          await LEVELS.refresh();

          renderProfile();

          notify('تم تحديث البيانات.', 'success');
        } catch (error) {
          showError(error?.message);
        } finally {
          setBusy(false);
        }

        return;

      default:
        return;
    }
  }

  /* =======================================================
     11. EVENT BINDING
     ======================================================= */

  function bindEvents() {
    document.addEventListener(
      'submit',
      handleFormSubmit
    );

    document.addEventListener(
      'click',
      handleAction
    );

    window.addEventListener(
      'wfesctra:profile-change',
      renderProfile
    );

    window.addEventListener(
      'wfesctra:stats-updated',
      renderStats
    );

    window.addEventListener(
      'wfesctra:achievements-updated',
      renderAchievements
    );

    window.addEventListener(
      'wfesctra:auth-change',
      async event => {
        if (!event.detail?.user) {
          renderProfile();
          showView('login');
        }
      }
    );
  }

  /* =======================================================
     12. INITIALIZATION
     ======================================================= */

  async function init() {
    if (state.initialized) return;

    bindEvents();

    state.initialized = true;

    if (AUTH.isLoggedIn()) {
      try {
        await DATA.fetch();
        await LEVELS.refresh();

        showView('profile');
      } catch (error) {
        showError(error?.message);
      }
    } else {
      showView('login');
    }

    renderProfile();

    emit(CONFIG.EVENTS.READY, {
      authenticated: AUTH.isLoggedIn()
    });

    console.log('[WFESCTRA] Profile UI initialized.');
  }

  /* =======================================================
     13. PUBLIC API
     ======================================================= */

  const API = {
    config: CONFIG,
    state,

    init,

    render: renderProfile,
    renderStats,
    renderAchievements,

    showView,

    login,
    registerRequest,
    registerVerify,
    registerComplete,

    updateProfile,
    logout,

    isInitialized: () => state.initialized,
    isBusy: () => state.busy
  };

  window.OFESTRA_PROFILE_UI = API;

  if (document.readyState === 'loading') {
    document.addEventListener(
      'DOMContentLoaded',
      init,
      { once: true }
    );
  } else {
    init();
  }

})();
