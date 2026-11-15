
/* =========================================================
   WFESCTRA — PROFILE SERVER ADAPTER
   Central Connector Adapter
   Version: 1.0.0

   Connection:
   profile-config.js
        ↓
   window.OFESTRA_SERVER
        ↓
   profile-server.js
        ↓
   Profile Modules

   لا يحتوي عنوان السيرفر.
   لا ينشئ اتصالاً مستقلاً.
   لا يخزن بيانات الحساب.
   ========================================================= */

(() => {
  'use strict';

  if (window.OFESTRA_PROFILE_SERVER) {
    console.warn('[WFESCTRA] Profile Server already initialized.');
    return;
  }

  /* =======================================================
     1. CENTRAL CONFIG
     ======================================================= */

  const CENTRAL = window.OFESTRA_SERVER;

  if (!CENTRAL || typeof CENTRAL !== 'object') {
    console.error(
      '[WFESCTRA] OFESTRA_SERVER is missing. Load profile-config.js first.'
    );
    return;
  }

  if (
    typeof CENTRAL.request !== 'function' &&
    typeof CENTRAL.requestJSON !== 'function'
  ) {
    console.error(
      '[WFESCTRA] Central Config has no supported request method.'
    );
    return;
  }

  /* =======================================================
     2. STATE
     ======================================================= */

  const state = {
    ready: true,
    connected: false,
    checking: false,

    lastError: null,
    lastCheck: null
  };

  /* =======================================================
     3. ERROR HANDLING
     ======================================================= */

  class ProfileServerError extends Error {
    constructor(message, options = {}) {
      super(message);

      this.name = 'ProfileServerError';
      this.status = options.status ?? null;
      this.code = options.code ?? null;
      this.data = options.data ?? null;
      this.originalError = options.originalError ?? null;
    }
  }

  function normalizeError(error) {
    if (error instanceof ProfileServerError) {
      return error;
    }

    const status =
      error?.status ??
      error?.response?.status ??
      error?.data?.status ??
      null;

    const message = getErrorMessage(error);

    return new ProfileServerError(message, {
      status,
      code: error?.code || null,
      data: error?.data || null,
      originalError: error
    });
  }

  function getErrorMessage(error) {
    if (typeof CENTRAL.getErrorMessage === 'function') {
      try {
        const message = CENTRAL.getErrorMessage(error);

        if (message) return String(message);
      } catch (_) {}
    }

    if (error?.data?.message) {
      return String(error.data.message);
    }

    if (error?.message) {
      return String(error.message);
    }

    return 'تعذر الاتصال بالسيرفر. حاول مرة أخرى.';
  }

  /* =======================================================
     4. RESPONSE NORMALIZATION
     ======================================================= */

  async function parseResponse(response) {
    if (response instanceof Response) {
      let data = null;

      try {
        data = await response.json();
      } catch (_) {
        data = null;
      }

      if (!response.ok) {
        throw new ProfileServerError(
          data?.message || `Server error: ${response.status}`,
          {
            status: response.status,
            code: data?.code || null,
            data
          }
        );
      }

      return data;
    }

    if (
      response &&
      typeof response === 'object' &&
      response.ok === false
    ) {
      throw new ProfileServerError(
        response.message || 'فشل طلب السيرفر.',
        {
          status: response.status ?? null,
          code: response.code ?? null,
          data: response
        }
      );
    }

    return response;
  }

  /* =======================================================
     5. CENTRAL REQUEST
     ======================================================= */

  async function request(path, options = {}) {
    if (typeof path !== 'string' || !path.trim()) {
      throw new ProfileServerError('مسار الطلب غير صالح.');
    }

    const method = String(
      options.method || 'GET'
    ).toUpperCase();

    const requestOptions = {
      ...options,
      method
    };

    delete requestOptions.method;

    try {
      let response;

      /*
       * الأفضلية لمحرك requestJSON المركزي.
       * إذا لم يكن موجوداً نستخدم request.
       */

      if (typeof CENTRAL.requestJSON === 'function') {
        response = await CENTRAL.requestJSON(
          path,
          {
            ...requestOptions,
            method
          }
        );
      } else {
        response = await CENTRAL.request(
          path,
          {
            ...requestOptions,
            method
          }
        );
      }

      return await parseResponse(response);
    } catch (error) {
      const normalized = normalizeError(error);

      state.lastError = normalized;

      if (isUnauthorized(normalized)) {
        window.dispatchEvent(
          new CustomEvent('wfesctra:server-unauthorized', {
            detail: {
              error: normalized
            }
          })
        );
      }

      throw normalized;
    }
  }

  /* =======================================================
     6. HTTP METHODS
     ======================================================= */

  function get(path, options = {}) {
    return request(path, {
      ...options,
      method: 'GET'
    });
  }

  function post(path, body = {}, options = {}) {
    return request(path, {
      ...options,
      method: 'POST',
      body
    });
  }

  function put(path, body = {}, options = {}) {
    return request(path, {
      ...options,
      method: 'PUT',
      body
    });
  }

  function patch(path, body = {}, options = {}) {
    return request(path, {
      ...options,
      method: 'PATCH',
      body
    });
  }

  function del(path, options = {}) {
    return request(path, {
      ...options,
      method: 'DELETE'
    });
  }

  /* =======================================================
     7. TOKEN MANAGEMENT
     ======================================================= */

  function getToken() {
    if (typeof CENTRAL.getToken === 'function') {
      return CENTRAL.getToken();
    }

    return null;
  }

  function setToken(token) {
    if (typeof CENTRAL.setToken !== 'function') {
      throw new ProfileServerError(
        'إدارة Token غير متاحة في Config المركزي.'
      );
    }

    return CENTRAL.setToken(token);
  }

  function clearToken() {
    if (typeof CENTRAL.clearToken === 'function') {
      return CENTRAL.clearToken();
    }

    throw new ProfileServerError(
      'مسح Token غير متاح في Config المركزي.'
    );
  }

  function hasToken() {
    return Boolean(getToken());
  }

  function isAuthenticated() {
    return hasToken();
  }

  /* =======================================================
     8. STATUS HELPERS
     ======================================================= */

  function isUnauthorized(error) {
    const status =
      error?.status ??
      error?.response?.status ??
      null;

    return (
      status === 401 ||
      status === 403 ||
      error?.code === 'UNAUTHORIZED'
    );
  }

  function isNetworkError(error) {
    return (
      error instanceof TypeError ||
      error?.name === 'NetworkError' ||
      error?.name === 'AbortError' ||
      error?.code === 'NETWORK_ERROR'
    );
  }

  function isReady() {
    return state.ready;
  }

  function isConnected() {
    return state.connected;
  }

  /* =======================================================
     9. HEALTH CHECK
     ======================================================= */

  async function health() {
    if (typeof CENTRAL.health === 'function') {
      try {
        const result = await CENTRAL.health();

        state.connected = true;
        state.lastCheck = Date.now();
        state.lastError = null;

        return result;
      } catch (error) {
        state.connected = false;
        state.lastError = normalizeError(error);
        throw state.lastError;
      }
    }

    return get('/health');
  }

  async function checkConnection() {
    if (state.checking) {
      return state.connected;
    }

    state.checking = true;

    try {
      await health();

      state.connected = true;

      window.dispatchEvent(
        new CustomEvent('wfesctra:server-connected')
      );

      return true;
    } catch (error) {
      state.connected = false;

      window.dispatchEvent(
        new CustomEvent('wfesctra:server-disconnected', {
          detail: {
            message: getErrorMessage(error)
          }
        })
      );

      return false;
    } finally {
      state.checking = false;
      state.lastCheck = Date.now();
    }
  }

  /* =======================================================
     10. PUBLIC API
     ======================================================= */

  const API = {
    state,

    request,
    get,
    post,
    put,
    patch,
    delete: del,

    getToken,
    setToken,
    clearToken,

    hasToken,
    isAuthenticated,

    isUnauthorized,
    isNetworkError,

    getErrorMessage,
    parseResponse,

    health,
    checkConnection,

    isReady,
    isConnected
  };

  window.OFESTRA_PROFILE_SERVER = API;

  console.log(
    '[WFESCTRA] Profile Server Adapter initialized.'
  );

})();
