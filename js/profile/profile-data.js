
/* =========================================================
   WFESCTRA — PROFILE DATA
   Server Profile Data Manager
   Version: 1.0.0
   Storage: SERVER DATABASE ONLY
   ========================================================= */

(() => {
  'use strict';

  if (window.WFESCTRA_PROFILE_DATA) {
    console.warn('[WFESCTRA] Profile Data already initialized.');
    return;
  }

  const CORE = window.WFESCTRA_PROFILE_CORE;
  const SERVER = window.WFESCTRA_PROFILE_SERVER;
  const AUTH = window.WFESCTRA_PROFILE_AUTH;

  if (!CORE || !SERVER || !AUTH) {
    console.error(
      '[WFESCTRA] Profile Data requires Core, Server and Auth.'
    );
    return;
  }

  const CONFIG = Object.freeze({
    PROFILE_PATH: (SERVER.endpoints && SERVER.endpoints.profile) || '/profile',
    UPDATE_METHOD: 'put',

    AUTO_REFRESH: false,
    CACHE_TTL: 0,

    EVENTS: {
      LOADED: 'wfesctra:profile-loaded',
      UPDATED: 'wfesctra:profile-updated',
      FAILED: 'wfesctra:profile-load-failed'
    }
  });

  const state = {
    loading: false,
    saving: false,

    loaded: false,
    lastLoadedAt: null,

    lastError: null,
    requestId: 0
  };

  let profileSnapshot = null;

  /* =======================================================
     HELPERS
     ======================================================= */

  function emit(name, detail = {}) {
    window.dispatchEvent(
      new CustomEvent(name, { detail })
    );
  }

  function clone(value) {
    if (typeof structuredClone === 'function') {
      return structuredClone(value);
    }

    return JSON.parse(JSON.stringify(value));
  }

  function getErrorMessage(error) {
    return SERVER.getErrorMessage
      ? SERVER.getErrorMessage(error)
      : error?.message || 'حدث خطأ أثناء الاتصال بالسيرفر.';
  }

  function normalizeProfile(response) {
    if (!response || typeof response !== 'object') {
      throw new Error('استجابة البروفايل غير صالحة.');
    }

    const profile =
      response.profile ||
      response.data?.profile ||
      response.data ||
      response.user ||
      response;

    if (!profile || typeof profile !== 'object') {
      throw new Error('لم يتم العثور على بيانات البروفايل.');
    }

    return profile;
  }

  function requireLogin() {
    if (!AUTH.isLoggedIn()) {
      throw new Error('يجب تسجيل الدخول أولاً.');
    }
  }

  function updateRuntime(profile, source = 'server') {
    const normalized = normalizeProfile(profile);

    profileSnapshot = clone(normalized);

    CORE.setProfile(normalized, {
      authenticated: true,
      user: AUTH.getUser(),
      source
    });

    state.loaded = true;
    state.lastLoadedAt = Date.now();
    state.lastError = null;

    emit(CONFIG.EVENTS.LOADED, {
      profile: CORE.profile,
      source
    });

    return CORE.profile;
  }

  /* =======================================================
     SERVER REQUESTS
     ======================================================= */

  async function fetchProfile(options = {}) {
    requireLogin();

    if (state.loading && !options.force) {
      return CORE.profile;
    }

    const requestId = ++state.requestId;

    state.loading = true;
    state.lastError = null;

    CORE.setLoading(true);

    try {
      const response = await SERVER.get(CONFIG.PROFILE_PATH);

      if (requestId !== state.requestId) {
        return CORE.profile;
      }

      return updateRuntime(response, 'server');
    } catch (error) {
      state.lastError = error;

      emit(CONFIG.EVENTS.FAILED, {
        error,
        message: getErrorMessage(error)
      });

      throw error;
    } finally {
      if (requestId === state.requestId) {
        state.loading = false;
        CORE.setLoading(false);
      }
    }
  }

  async function updateProfile(changes) {
    requireLogin();

    if (!changes || typeof changes !== 'object' || Array.isArray(changes)) {
      throw new Error('بيانات التعديل غير صالحة.');
    }

    if (state.saving) {
      throw new Error('هناك عملية حفظ قيد التنفيذ.');
    }

    /*
     * قائمة الحقول التي يسمح للواجهة بطلب تعديلها.
     * الإحصائيات والمستوى والإنجازات لا تعدل من الواجهة.
     */

    const allowedFields = [
      'display_name',
      'username',
      'avatar',
      'cover',
      'country',
      'bio'
    ];

    const payload = {};

    for (const field of allowedFields) {
      if (Object.prototype.hasOwnProperty.call(changes, field)) {
        payload[field] = changes[field];
      }
    }

    if (!Object.keys(payload).length) {
      throw new Error('لا توجد بيانات مسموح بتعديلها.');
    }

    if (
      payload.display_name !== undefined &&
      !CORE.displayNameValid(payload.display_name)
    ) {
      throw new Error('الاسم الظاهر يجب أن يكون بين حرفين و32 حرفاً.');
    }

    if (
      payload.username !== undefined &&
      !CORE.usernameValid(payload.username)
    ) {
      throw new Error(
        'اسم المستخدم يجب أن يكون 3 إلى 24 حرفاً إنكليزياً أو رقماً.'
      );
    }

    if (
      payload.bio !== undefined &&
      String(payload.bio).length > 180
    ) {
      throw new Error('النبذة لا يمكن أن تتجاوز 180 حرفاً.');
    }

    state.saving = true;

    try {
      const response = await SERVER.put(
        CONFIG.PROFILE_PATH,
        payload
      );

      const updated = normalizeProfile(response);

      updateRuntime(updated, 'server-update');

      emit(CONFIG.EVENTS.UPDATED, {
        profile: CORE.profile,
        changes: payload
      });

      return CORE.profile;
    } catch (error) {
      state.lastError = error;
      throw error;
    } finally {
      state.saving = false;
    }
  }

  /* =======================================================
     FIELD HELPERS
     ======================================================= */

  async function updateAvatar(url) {
    return updateProfile({ avatar: url });
  }

  async function updateCover(url) {
    return updateProfile({ cover: url });
  }

  async function updateDisplayName(name) {
    return updateProfile({ display_name: name });
  }

  async function updateUsername(username) {
    return updateProfile({ username });
  }

  async function updateCountry(country) {
    return updateProfile({ country });
  }

  async function updateBio(bio) {
    return updateProfile({ bio });
  }

  /* =======================================================
     SESSION EVENTS
     ======================================================= */

  window.addEventListener(
    'wfesctra:auth-change',
    event => {
      const user = event.detail?.user || null;

      if (!user) {
        state.loaded = false;
        state.lastLoadedAt = null;
        state.lastError = null;
        profileSnapshot = null;

        CORE.clearProfile();
      }
    }
  );

  /* =======================================================
     PUBLIC API
     ======================================================= */

  const API = {
    config: CONFIG,
    state,

    fetch: fetchProfile,
    refresh: () => fetchProfile({ force: true }),

    update: updateProfile,

    updateAvatar,
    updateCover,
    updateDisplayName,
    updateUsername,
    updateCountry,
    updateBio,

    get: () => CORE.profile,
    getSnapshot: () => profileSnapshot
      ? clone(profileSnapshot)
      : null,

    isLoaded: () => state.loaded,
    isLoading: () => state.loading,
    isSaving: () => state.saving,

    getError: () => state.lastError
      ? getErrorMessage(state.lastError)
      : null
  };

  window.WFESCTRA_PROFILE_DATA = API;

  console.log('[WFESCTRA] Profile Data initialized.');

})();
