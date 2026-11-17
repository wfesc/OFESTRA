
/* ============================================================
 * WFESCTRA — CENTRAL SERVER CONFIG (config.js)
 * الملف المركزي الوحيد للاتصال بالسيرفر. كل الوحدات تمر من هنا.
 *
 * المسؤوليات:
 * 1. الاتصال بسيرفر WFESCTRA.
 * 2. إرسال طلبات API ومعالجة أخطاء الاتصال.
 * 3. إدارة Bearer Token.
 * 4. التسجيل والتحقق وإكمال إنشاء الحساب.
 * 5. تسجيل الدخول واسترجاع بيانات المستخدم.
 * 6. جلب الملف الشخصي وتحديثه.
 *
 * SECURITY:
 * - لا توجد مفاتيح سرية داخل المتصفح.
 * - WFESCTRA_SECRET_KEY يبقى داخل .env على السيرفر.
 * - لا يتم تخزين كلمات المرور محلياً.
 * - التخزين المحلي مخصص لتوكن الجلسة فقط.
 * ============================================================ */

(function (window) {

  'use strict';

  /* ==========================================================
     01 — SERVER ADDRESS
     ========================================================== */

  /* ----------------------------------------------------------
     عنوان السيرفر: غيّره من هنا فقط، أو بدون تعديل الملف:
       - افتح الموقع بالرابط  ?server=https://عنوان-السيرفر
       - أو من الكونسول:  WFESCTRA_SERVER.setBaseURL('https://...')
     (روابط trycloudflare المؤقتة تتغير كل تشغيل — هذا غالباً سبب
      "لا يتصل بالسيرفر")
     ---------------------------------------------------------- */
  const DEFAULT_BASE_URL =
    'https://how-preservation-wesley-tribunal.trycloudflare.com';

  const BASE_KEY = 'wfesctra_server_url';
  const USER_CFG = window.WFESCTRA_CONFIG || {};

  function readBaseURL() {
    try {
      const q = new URLSearchParams(location.search).get('server');
      if (q && /^https?:\/\//i.test(q)) {
        localStorage.setItem(BASE_KEY, q);
      }
      const saved = localStorage.getItem(BASE_KEY);
      if (saved) return saved;
    } catch (e) {}
    return USER_CFG.baseUrl || DEFAULT_BASE_URL;
  }

  let BASE_URL = readBaseURL().replace(/\/+$/, '');

  const TOKEN_KEY = 'wfesctra_auth_token';

  const REQUEST_TIMEOUT = 25000;

  /* ----------------------------------------------------------
     جدول المسارات (Endpoints) — عدّل أي مسار من هنا فقط
     ---------------------------------------------------------- */
  const ENDPOINTS = Object.assign({
    health: '/health',
    registerRequest: '/auth/register/request',
    registerVerify: '/auth/register/verify',
    registerComplete: '/auth/register/complete',
    login: '/auth/login',
    me: '/auth/me',
    profile: '/profile',
    stats: '/profile/stats',
    achievements: '/profile/achievements',
    matchResult: '/games/result',
    friends: '/friends',
    messages: '/messages'
  }, USER_CFG.endpoints || {});

  /* ----------------------------------------------------------
     سجل الأخطاء (لتتبع أي مشكلة بسهولة)
       WFESCTRA_SERVER.logs()      آخر 200 سجل
       WFESCTRA_SERVER.diagnose()  فحص كل المسارات
       افتح الموقع بـ ?debug=1 لإظهار لوحة التتبع
     ---------------------------------------------------------- */
  const LOGS = [];

  function log(level, tag, message, data) {
    const entry = {
      time: new Date().toISOString(),
      level: level,
      tag: tag,
      message: message,
      data: data === undefined ? null : data
    };
    LOGS.push(entry);
    if (LOGS.length > 200) LOGS.shift();
    (console[level] || console.log).call(
      console,
      '[WFESCTRA][' + tag + ']',
      message,
      data === undefined ? '' : data
    );
    try {
      window.dispatchEvent(new CustomEvent('wfesctra:log', { detail: entry }));
    } catch (e) {}
    return entry;
  }


  let authToken = null;

  function getToken() {

    if (authToken) {
      return authToken;
    }

    try {
      authToken = localStorage.getItem(TOKEN_KEY) ||
        localStorage.getItem('ofestra_auth_token');
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
        '[WFESCTRA] تعذر حفظ رمز الجلسة محلياً.'
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
      return 'حدث خطأ داخل سيرفر WFESCTRA.';
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

      log(
        response.ok ? 'info' : 'warn',
        'NET',
        (fetchOptions.method || 'GET') + ' /' + cleanPath +
          ' → ' + response.status
      );

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

      log('error', 'NET', 'E-NET فشل الطلب /' + cleanPath, {
        name: error && error.name,
        message: error && error.message,
        server: BASE_URL
      });

      if (error.name === 'AbortError') {
        throw new Error(
          'انتهت مهلة الاتصال بالسيرفر. حاول مجدداً.'
        );
      }

      throw new Error(
        'تعذر الاتصال بخادم WFESCTRA. تحقق من الإنترنت وحالة السيرفر.'
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
        ENDPOINTS.registerRequest,
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
        ENDPOINTS.registerVerify,
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
        ENDPOINTS.registerComplete,
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
        ENDPOINTS.login,
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
        ENDPOINTS.me,
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
        ENDPOINTS.profile,
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
        ENDPOINTS.profile,
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
      ENDPOINTS.health,
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
     10B — FRIENDS / MESSAGES / GAMES  (كلها عبر هذا الملف)
     ==========================================================
     soft(): ينفذ الطلب ولا يرمي خطأ أبداً. إذا السيرفر ما يدعم
     المسار (404/405) أو غير متصل يرجع { ok:false, unsupported }
     والتطبيق يكمل بالتخزين المحلي بدل ما ينهار. */

  async function soft(tag, fn) {
    try {
      return { ok: true, data: await fn() };
    } catch (error) {
      const status = error && error.status ? error.status : 0;
      const unsupported = status === 404 || status === 405;
      log(
        unsupported ? 'warn' : 'error',
        tag,
        unsupported
          ? 'المسار غير موجود على السيرفر (' + status + ')'
          : (error && error.message) || 'خطأ',
        { status: status }
      );
      return { ok: false, unsupported: unsupported, status: status, error: error };
    }
  }

  function seg(value) {
    return encodeURIComponent(String(value));
  }

  const friends = {
    list: function () {
      return soft('FRIENDS', function () {
        return requestJSON(ENDPOINTS.friends, { method: 'GET' });
      });
    },
    add: function (uid, name) {
      return soft('FRIENDS', function () {
        return requestJSON(ENDPOINTS.friends, {
          method: 'POST',
          body: { friend_id: String(uid), name: String(name || '') }
        });
      });
    },
    remove: function (uid) {
      return soft('FRIENDS', function () {
        return requestJSON(ENDPOINTS.friends + '/' + seg(uid), { method: 'DELETE' });
      });
    }
  };

  const messages = {
    history: function (uid) {
      return soft('MESSAGES', function () {
        return requestJSON(ENDPOINTS.messages + '/' + seg(uid), { method: 'GET' });
      });
    },
    send: function (uid, text) {
      return soft('MESSAGES', function () {
        return requestJSON(ENDPOINTS.messages, {
          method: 'POST',
          body: { to: String(uid), message: String(text) }
        });
      });
    }
  };

  const games = {
    submitResult: function (payload) {
      return soft('GAMES', function () {
        return requestJSON(ENDPOINTS.matchResult, { method: 'POST', body: payload });
      });
    }
  };

  /* فحص كل المسارات وطباعة جدول واضح بالنتائج */
  async function diagnose() {
    const checks = [
      ['health', 'GET', ENDPOINTS.health, false],
      ['me', 'GET', ENDPOINTS.me, true],
      ['profile', 'GET', ENDPOINTS.profile, true],
      ['stats', 'GET', ENDPOINTS.stats, true],
      ['achievements', 'GET', ENDPOINTS.achievements, true],
      ['friends', 'GET', ENDPOINTS.friends, true]
    ];
    const report = [];
    for (const c of checks) {
      let status = 0, note = '';
      try {
        const r = await request(c[2], { method: c[1], auth: c[3], timeoutMs: 8000 });
        status = r.status;
        note = r.ok ? 'يعمل'
          : status === 401 ? 'موجود (يحتاج تسجيل دخول)'
          : status === 404 ? 'غير موجود على السيرفر'
          : 'خطأ ' + status;
      } catch (e) {
        note = 'لا يوجد اتصال: ' + e.message;
      }
      report.push({ name: c[0], path: c[2], status: status, note: note });
    }
    log('info', 'DIAG', 'نتيجة الفحص', report);
    if (console.table) console.table(report);
    return report;
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

    // الأصدقاء والرسائل والمباريات.
    friends: friends,
    messages: messages,
    games: games,
    soft: soft,

    // أدوات التتبع.
    endpoints: ENDPOINTS,
    log: log,
    logs: function () { return LOGS.slice(); },
    diagnose: diagnose,
    getErrorMessage: function (error) {
      if (!error) return 'تعذر تنفيذ الطلب.';
      return error.message || getErrorMessage(error.data, error.status);
    },
    setBaseURL: function (url) {
      if (!/^https?:\/\//i.test(String(url || ''))) return false;
      BASE_URL = String(url).replace(/\/+$/, '');
      try { localStorage.setItem(BASE_KEY, BASE_URL); } catch (e) {}
      log('info', 'CONFIG', 'تم تغيير عنوان السيرفر', BASE_URL);
      return true;
    },

    // حالة السيرفر.
    health: health,
    checkConnection: checkConnection,

    // عنوان السيرفر.
    getBaseURL: function () {
      return BASE_URL;
    },

    // معلومات الإصدار.
    version: '2.0.0',

    name: 'WFESCTRA CENTRAL SERVER'

  };


  /* ==========================================================
     12 — REGISTER GLOBAL CONNECTOR
     ========================================================== */

  Object.defineProperty(window, 'WFESCTRA_SERVER', {
    value: SERVER,
    writable: false,
    configurable: false,
    enumerable: true
  });



  /* ==========================================================
     13 — READY
     ========================================================== */

  console.log(
    '%c WFESCTRA SERVER CONNECTOR READY ',
    'background:#101827;color:#55e6a5;padding:7px 12px;border-radius:5px;font-weight:bold;'
  );

})(window);
