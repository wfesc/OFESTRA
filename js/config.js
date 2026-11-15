
/* ============================================================
 * OFESTRA PRO — CENTRAL SERVER CONFIG
 * WFESC — OFFICIAL API CONNECTOR
 *
 * المسؤوليات:
 * 1. الاتصال بسيرفر OFESTRA.
 * 2. إرسال طلبات API ومعالجة أخطاء الاتصال.
 * 3. إدارة Bearer Token.
 * 4. التسجيل والتحقق وإكمال إنشاء الحساب.
 * 5. تسجيل الدخول واسترجاع بيانات المستخدم.
 * 6. جلب الملف الشخصي وتحديثه.
 *
 * SECURITY:
 * - لا توجد مفاتيح سرية داخل المتصفح.
 * - OFESTRA_SECRET_KEY يبقى داخل .env على السيرفر.
 * - لا يتم تخزين كلمات المرور محلياً.
 * - التخزين المحلي مخصص لتوكن الجلسة فقط.
 * ============================================================ */

(function (window) {

  'use strict';

  /* ==========================================================
     01 — SERVER ADDRESS
     ========================================================== */

  const BASE_URL =
    'https://how-preservation-wesley-tribunal.trycloudflare.com'
      .replace(/\/+$/, '');

  const TOKEN_KEY = 'ofestra_auth_token';

  const REQUEST_TIMEOUT = 25000;


  /* ==========================================================
     02 — TOKEN MANAGEMENT
     ========================================================== */

  let authToken = null;

  function getToken() {

    if (authToken) {
      return authToken;
    }

    try {
      authToken = localStorage.getItem(TOKEN_KEY);
    } catch (error) {
      authToken = null;
    }

    return authToken || null;
  }


  function setToken(token) {

    authToken =
      typeof token === 'string' && token.trim()
        ? token.trim()
        : null;

    try {

      if (authToken) {
        localStorage.setItem(TOKEN_KEY, authToken);
      } else {
        localStorage.removeItem(TOKEN_KEY);
      }

    } catch (error) {

      console.warn(
        '[OFESTRA] تعذر حفظ رمز الجلسة محلياً.'
      );

    }

    return authToken;
  }


  function clearToken() {

    authToken = null;

    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch (error) {}

  }


  function isAuthenticated() {
    return !!getToken();
  }


  /* ==========================================================
     03 — PATH VALIDATION
     ========================================================== */

  function normalizePath(path) {

    if (
      typeof path !== 'string' ||
      !path.trim()
    ) {
      throw new Error('مسار الطلب غير صالح.');
    }

    path = path.trim();

    if (
      /^https?:\/\//i.test(path) ||
      path.startsWith('//')
    ) {
      throw new Error(
        'غير مسموح بإرسال طلب إلى خادم خارجي.'
      );
    }

    const pathname = path.split(/[?#]/)[0];

    if (
      pathname.split('/').some(function (part) {
        return part === '..';
      })
    ) {
      throw new Error('مسار الطلب غير مسموح.');
    }

    return path.replace(/^\/+/, '');
  }


  /* ==========================================================
     04 — ERROR HANDLING
     ========================================================== */

  function createApiError(message, response, data) {

    const error = new Error(
      message || 'حدث خطأ أثناء الاتصال بالسيرفر.'
    );

    error.status = response ? response.status : 0;
    error.data = data || null;
    error.response = response || null;

    return error;
  }


  async function readResponse(response) {

    try {

      const text = await response.clone().text();

      if (!text) {
        return null;
      }

      try {
        return JSON.parse(text);
      } catch (error) {
        return {
          detail: text
        };
      }

    } catch (error) {

      return null;

    }
  }


  function getErrorMessage(data, status) {

    if (data && typeof data === 'object') {

      const detail =
        data.detail ||
        data.message ||
        data.error;

      if (typeof detail === 'string') {
        return detail;
      }

      if (detail) {
        try {
          return JSON.stringify(detail);
        } catch (error) {}
      }

    }

    if (status === 401) {
      return 'انتهت صلاحية الجلسة أو بيانات تسجيل الدخول غير صحيحة.';
    }

    if (status === 403) {
      return 'ليس لديك صلاحية لتنفيذ هذا الطلب.';
    }

    if (status === 404) {
      return 'المسار المطلوب غير موجود على السيرفر.';
    }

    if (status >= 500) {
      return 'حدث خطأ داخل سيرفر OFESTRA.';
    }

    return 'تعذر تنفيذ الطلب. حاول مرة أخرى.';
  }


  /* ==========================================================
     05 — CENTRAL REQUEST ENGINE
     ========================================================== */

  async function request(path, options) {

    options = options || {};

    const cleanPath = normalizePath(path);

    const endpoint =
      BASE_URL + '/' + cleanPath;

    const headers = new Headers(
      options.headers || {}
    );

    if (!headers.has('Accept')) {
      headers.set(
        'Accept',
        'application/json'
      );
    }

    let body = options.body;

    const isFormData =
      typeof FormData !== 'undefined' &&
      body instanceof FormData;

    const isNativeBody =
      isFormData ||
      (
        typeof Blob !== 'undefined' &&
        body instanceof Blob
      ) ||
      (
        typeof URLSearchParams !== 'undefined' &&
        body instanceof URLSearchParams
      ) ||
      (
        typeof ArrayBuffer !== 'undefined' &&
        body instanceof ArrayBuffer
      );

    if (
      body !== undefined &&
      body !== null &&
      typeof body === 'object' &&
      !isNativeBody
    ) {

      body = JSON.stringify(body);

      if (!headers.has('Content-Type')) {
        headers.set(
          'Content-Type',
          'application/json'
        );
      }

    }


    /* --------------------------------------------------------
       Authentication
       -------------------------------------------------------- */

    const useAuthentication =
      options.auth !== false;

    const token = getToken();

    if (useAuthentication && token) {

      headers.set(
        'Authorization',
        'Bearer ' + token
      );

    } else {

      headers.delete('Authorization');

    }


    /* --------------------------------------------------------
       Fetch configuration
       -------------------------------------------------------- */

    const fetchOptions = Object.assign(
      {},
      options,
      {
        headers: headers,
        body: body,
        credentials: 'omit',
        cache: 'no-store'
      }
    );

    // خيارات خاصة بنا وليست خيارات fetch.
    delete fetchOptions.auth;
    delete fetchOptions.timeoutMs;


    /* --------------------------------------------------------
       Timeout
       -------------------------------------------------------- */

    const controller =
      typeof AbortController !== 'undefined'
        ? new AbortController()
        : null;

    const timeoutMs =
      Number(options.timeoutMs) > 0
        ? Number(options.timeoutMs)
        : REQUEST_TIMEOUT;

    let timeoutId = null;

    if (controller) {

      fetchOptions.signal = controller.signal;

      timeoutId = setTimeout(function () {
        controller.abort();
      }, timeoutMs);

    }


    /* --------------------------------------------------------
       Send request
       -------------------------------------------------------- */

    try {

      const response = await fetch(
        endpoint,
        fetchOptions
      );

      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      // إبطال التوكن عند رفض الجلسة من السيرفر.
      if (
        response.status === 401 &&
        useAuthentication
      ) {
        clearToken();
      }

      return response;

    } catch (error) {

      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      console.error(
        '[OFESTRA SERVER] Request failed:',
        error
      );

      if (error.name === 'AbortError') {
        throw new Error(
          'انتهت مهلة الاتصال بالسيرفر. حاول مجدداً.'
        );
      }

      throw new Error(
        'تعذر الاتصال بخادم OFESTRA. تحقق من الإنترنت وحالة السيرفر.'
      );

    }

  }


  /* ==========================================================
     06 — JSON REQUEST HELPER
     ========================================================== */

  async function requestJSON(path, options) {

    const response = await request(
      path,
      options
    );

    const data = await readResponse(response);

    if (!response.ok) {

      throw createApiError(
        getErrorMessage(data, response.status),
        response,
        data
      );

    }

    return data;

  }


  /* ==========================================================
     07 — TOKEN EXTRACTION
     ========================================================== */

  function extractToken(data, depth) {

    depth = depth || 0;

    if (
      !data ||
      typeof data !== 'object' ||
      depth > 5
    ) {
      return null;
    }

    const possibleKeys = [
      'access_token',
      'token',
      'session_token'
    ];

    for (const key of possibleKeys) {

      if (
        typeof data[key] === 'string' &&
        data[key].trim()
      ) {
        return data[key].trim();
      }

    }

    const nestedKeys = [
      'data',
      'session',
      'result',
      'auth'
    ];

    for (const key of nestedKeys) {

      const token = extractToken(
        data[key],
        depth + 1
      );

      if (token) {
        return token;
      }

    }

    return null;

  }


  /* ==========================================================
     08 — AUTHENTICATION API
     ========================================================== */

  const auth = {

    /*
     * الخطوة الأولى:
     * طلب إرسال رمز التحقق إلى البريد.
     */

    registerRequest: function (payload) {

      return requestJSON(
        '/auth/register/request',
        {
          method: 'POST',
          body: payload,
          auth: false
        }
      );

    },


    /*
     * الخطوة الثانية:
     * التحقق من رمز البريد الإلكتروني.
     */

    registerVerify: function (payload) {

      return requestJSON(
        '/auth/register/verify',
        {
          method: 'POST',
          body: payload,
          auth: false
        }
      );

    },


    /*
     * الخطوة الثالثة:
     * إكمال إنشاء الحساب.
     */

    registerComplete: async function (payload) {

      const data = await requestJSON(
        '/auth/register/complete',
        {
          method: 'POST',
          body: payload,
          auth: false
        }
      );

      const token = extractToken(data);

      if (token) {
        setToken(token);
      }

      return data;

    },


    /*
     * تسجيل الدخول.
     */

    login: async function (payload) {

      const data = await requestJSON(
        '/auth/login',
        {
          method: 'POST',
          body: payload,
          auth: false
        }
      );

      const token = extractToken(data);

      if (token) {
        setToken(token);
      }

      return data;

    },


    /*
     * جلب بيانات الحساب الحالي.
     */

    me: function () {

      return requestJSON(
        '/auth/me',
        {
          method: 'GET'
        }
      );

    },


    /*
     * تسجيل الخروج محلياً.
     *
     * لا يفترض وجود مسار logout على السيرفر.
     */

    logout: function () {

      clearToken();

      return true;

    }

  };


  /* ==========================================================
     09 — PROFILE API
     ========================================================== */

  const profile = {

    /*
     * جلب الملف الشخصي.
     */

    get: function () {

      return requestJSON(
        '/profile',
        {
          method: 'GET'
        }
      );

    },


    /*
     * تحديث الملف الشخصي.
     */

    update: function (payload) {

      return requestJSON(
        '/profile',
        {
          method: 'PUT',
          body: payload
        }
      );

    }

  };


  /* ==========================================================
     10 — SERVER HEALTH
     ========================================================== */

  async function health() {

    return request(
      '/health',
      {
        method: 'GET',
        auth: false
      }
    );

  }


  async function checkConnection() {

    const response = await health();

    const data = await readResponse(response);

    if (!response.ok) {

      throw createApiError(
        getErrorMessage(data, response.status),
        response,
        data
      );

    }

    return data;

  }


  /* ==========================================================
     11 — CENTRAL SERVER OBJECT
     ========================================================== */

  const SERVER = {

    // الاتصال الأساسي.
    request: request,
    requestJSON: requestJSON,

    // إدارة الجلسة.
    getToken: getToken,
    setToken: setToken,
    clearToken: clearToken,
    isAuthenticated: isAuthenticated,

    // الحساب.
    auth: auth,

    // الملف الشخصي.
    profile: profile,

    // حالة السيرفر.
    health: health,
    checkConnection: checkConnection,

    // عنوان السيرفر.
    getBaseURL: function () {
      return BASE_URL;
    },

    // معلومات الإصدار.
    version: '1.0.0',

    name: 'OFESTRA CENTRAL SERVER'

  };


  /* ==========================================================
     12 — REGISTER GLOBAL CONNECTOR
     ========================================================== */

  Object.defineProperty(
    window,
    'OFESTRA_SERVER',
    {
      value: SERVER,
      writable: false,
      configurable: false,
      enumerable: true
    }
  );


  /* ==========================================================
     13 — READY
     ========================================================== */

  console.log(
    '%c OFESTRA SERVER CONNECTOR READY ',
    'background:#101827;color:#55e6a5;padding:7px 12px;border-radius:5px;font-weight:bold;'
  );

})(window);
