
/* ============================================================
 * OFESTRA PRO — CONFIG.JS
 * WFESC CENTRAL SERVER CONNECTOR
 *
 * مسؤول عن:
 * - الاتصال بخادم OFESTRA
 * - إرسال طلبات API
 * - إدارة توكن جلسة الحساب
 * - توفير OFESTRA_SERVER لملف profile.js
 *
 * لا يخزن كلمات المرور أو بيانات الحساب محلياً.
 * ============================================================ */


/* ============================================================
   01 — SERVER CONFIGURATION
   ============================================================ */

(function(){

  'use strict';

  var BASE_URL =
    'https://how-preservation-wesley-tribunal.trycloudflare.com';


  /* ==========================================================
     02 — TOKEN STORAGE
     ========================================================== */

  var TOKEN_KEY = 'ofestra_auth_token';

  var authToken = null;


  function getToken(){

    if(authToken){

      return authToken;

    }

    try {

      authToken = localStorage.getItem(TOKEN_KEY);

    } catch(e){

      authToken = null;

    }

    return authToken || null;

  }


  function setToken(token){

    authToken = (
      typeof token === 'string' &&
      token.trim()
    ) ? token.trim() : null;

    try {

      if(authToken){

        localStorage.setItem(
          TOKEN_KEY,
          authToken
        );

      } else {

        localStorage.removeItem(
          TOKEN_KEY
        );

      }

    } catch(e){

      console.warn(
        '[OFESTRA SERVER] Token storage unavailable'
      );

    }

    return authToken;

  }


  function clearToken(){

    setToken(null);

  }


  /* ==========================================================
     03 — API REQUEST
     ========================================================== */

  async function request(path, options){

    options = options || {};

    if(
      typeof path !== 'string' ||
      !path.trim()
    ){

      throw new Error(
        'مسار الطلب غير صالح'
      );

    }


    /* منع إرسال الطلبات إلى نطاقات خارج خادم اللعبة */

    if(
      /^https?:\/\//i.test(path)
    ){

      throw new Error(
        'مسار API يجب أن يكون داخلياً'
      );

    }


    var endpoint =
      BASE_URL.replace(/\/+$/, '') +
      '/' +
      path.replace(/^\/+/, '');


    var headers = new Headers(
      options.headers || {}
    );


    if(!headers.has('Accept')){

      headers.set(
        'Accept',
        'application/json'
      );

    }


    var body = options.body;

    var isFormData =
      typeof FormData !== 'undefined' &&
      body instanceof FormData;


    if(
      body !== undefined &&
      body !== null &&
      !isFormData &&
      typeof body !== 'string'
    ){

      body = JSON.stringify(body);

      if(!headers.has('Content-Type')){

        headers.set(
          'Content-Type',
          'application/json'
        );

      }

    }


    /* إضافة توكن الحساب عند توفره */

    var token = getToken();

    if(token){

      headers.set(
        'Authorization',
        'Bearer ' + token
      );

    } else {

      headers.delete(
        'Authorization'
      );

    }


    var config = Object.assign(
      {},
      options,
      {
        headers: headers,
        body: body
      }
    );


    try {

      var response = await fetch(
        endpoint,
        config
      );


      /*
       * نرجع Response الأصلي حتى يستطيع profile.js
       * استخدام response.ok و response.json().
       */

      return response;

    } catch(error){

      console.error(
        '[OFESTRA SERVER] Connection error:',
        error
      );

      throw new Error(
        'تعذر الاتصال بخادم OFESTRA. تحقق من الإنترنت وحاول مجدداً.'
      );

    }

  }


  /* ==========================================================
     04 — SERVER STATUS
     ========================================================== */

  async function health(){

    var response = await request(
      '/health',
      {
        method: 'GET'
      }
    );

    return response;

  }


  /* ==========================================================
     05 — SERVER CONNECTOR
     ========================================================== */

  var SERVER = {

    request: request,

    getToken: getToken,

    setToken: setToken,

    clearToken: clearToken,

    health: health,

    getBaseURL: function(){

      return BASE_URL;

    },

    isAuthenticated: function(){

      return !!getToken();

    }

  };


  /* ==========================================================
     06 — REGISTER GLOBAL CONNECTOR
     ========================================================== */

  window.OFESTRA_SERVER = SERVER;


  /* ==========================================================
     07 — READY
     ========================================================== */

  console.log(
    '[OFESTRA] Central Server Connector Ready'
  );

})();
  
