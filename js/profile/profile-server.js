
/* ============================================================
 * OFESTRA PRO — PROFILE SERVER
 * الملف: profile-server.js
 *
 * المسؤولية:
 * - الربط مع OFESTRA_SERVER
 * - قراءة JSON من استجابات الخادم
 * - معالجة أخطاء HTTP
 * - توحيد شكل البيانات المرسلة للبروفايل
 *
 * يعتمد على:
 * - config.js
 * - profile-core.js
 * ============================================================ */

(function () {

    'use strict';


    /* ========================================================
       01 — CONNECTOR
       ======================================================== */

    function getServer() {

        var server = window.OFESTRA_SERVER;

        if (
            !server ||
            typeof server.request !== 'function'
        ) {

            throw new Error(
                'اتصال خادم OFESTRA غير جاهز. تحقق من تحميل config.js.'
            );

        }

        return server;

    }


    /* ========================================================
       02 — ERROR OBJECT
       ======================================================== */

    function createServerError(message, status, data) {

        var error = new Error(
            message || 'حدث خطأ أثناء الاتصال بالخادم.'
        );

        error.status = Number(status || 0);

        error.data = data || null;

        error.isServerError = true;

        return error;

    }


    /* ========================================================
       03 — RESPONSE PARSER
       ======================================================== */

    async function parseResponse(response) {

        if (!response) {

            throw createServerError(
                'لم يستلم التطبيق استجابة من الخادم.',
                0
            );

        }


        var status = Number(response.status || 0);

        var payload = null;

        var rawText = '';


        try {

            if (status !== 204) {

                rawText = await response.text();

            }

        } catch (error) {

            throw createServerError(
                'تعذرت قراءة استجابة الخادم.',
                status
            );

        }


        if (rawText) {

            try {

                payload = JSON.parse(rawText);

            } catch (error) {

                /*
                 * قد يرجع الخادم نصاً بدلاً من JSON.
                 * لا نعتبر النص استجابة ناجحة تلقائياً.
                 */

                payload = {
                    message: rawText
                };

            }

        }


        if (
            !response.ok
        ) {

            var message = 'تعذر تنفيذ الطلب.';

            if (payload) {

                message =
                    payload.detail ||
                    payload.message ||
                    payload.error ||
                    message;

            }

            if (Array.isArray(message)) {

                message = message.map(function (item) {

                    return (
                        item.msg ||
                        String(item)
                    );

                }).join('، ');

            }

            if (typeof message !== 'string') {

                message = JSON.stringify(message);

            }

            throw createServerError(
                message,
                status,
                payload
            );

        }


        /*
         * الاستجابة الناجحة:
         * نعيد بيانات JSON مباشرة حتى تكون سهلة الاستخدام
         * داخل ملفات المصادقة والبروفايل.
         */

        if (
            payload === null ||
            payload === undefined
        ) {

            payload = {};

        }


        if (
            typeof payload !== 'object' ||
            Array.isArray(payload)
        ) {

            payload = {
                result: payload
            };

        }


        /*
         * بيانات مساعدة لا تتعارض مع حقول API العادية.
         */

        try {

            Object.defineProperty(
                payload,
                '_serverStatus',
                {
                    value: status,
                    enumerable: false
                }
            );

        } catch (error) {}


        return payload;

    }


    /* ========================================================
       04 — REQUEST
       ======================================================== */

    async function request(path, options) {

        options = options || {};

        var server = getServer();


        if (
            typeof path !== 'string' ||
            !path.trim()
        ) {

            throw new Error(
                'مسار الطلب غير صالح.'
            );

        }


        var method = String(
            options.method || 'GET'
        ).toUpperCase();


        var response = await server.request(
            path,
            Object.assign(
                {},
                options,
                {
                    method: method
                }
            )
        );


        return await parseResponse(response);

    }


    /* ========================================================
       05 — HTTP HELPERS
       ======================================================== */

    function get(path, options) {

        return request(
            path,
            Object.assign(
                {},
                options || {},
                {
                    method: 'GET'
                }
            )
        );

    }


    function post(path, body, options) {

        return request(
            path,
            Object.assign(
                {},
                options || {},
                {
                    method: 'POST',
                    body: body === undefined ? {} : body
                }
            )
        );

    }


    function put(path, body, options) {

        return request(
            path,
            Object.assign(
                {},
                options || {},
                {
                    method: 'PUT',
                    body: body === undefined ? {} : body
                }
            )
        );

    }


    function patch(path, body, options) {

        return request(
            path,
            Object.assign(
                {},
                options || {},
                {
                    method: 'PATCH',
                    body: body === undefined ? {} : body
                }
            )
        );

    }


    function remove(path, options) {

        return request(
            path,
            Object.assign(
                {},
                options || {},
                {
                    method: 'DELETE'
                }
            )
        );

    }


    /* ========================================================
       06 — TOKEN HELPERS
       ======================================================== */

    function getToken() {

        var server = getServer();

        return typeof server.getToken === 'function'
            ? server.getToken()
            : null;

    }


    function setToken(token) {

        var server = getServer();

        if (
            typeof server.setToken !== 'function'
        ) {

            throw new Error(
                'إدارة جلسة الحساب غير متاحة.'
            );

        }

        return server.setToken(token);

    }


    function clearToken() {

        var server = getServer();

        if (
            typeof server.clearToken === 'function'
        ) {

            return server.clearToken();

        }

        if (
            typeof server.setToken === 'function'
        ) {

            return server.setToken(null);

        }

        return null;

    }


    function isAuthenticated() {

        try {

            return !!getToken();

        } catch (error) {

            return false;

        }

    }


    /* ========================================================
       07 — HEALTH CHECK
       ======================================================== */

    async function health() {

        return get('/health');

    }


    /* ========================================================
       08 — ERROR HELPERS
       ======================================================== */

    function isUnauthorized(error) {

        return !!(
            error &&
            Number(error.status) === 401
        );

    }


    function isNetworkError(error) {

        return !!(
            error &&
            !error.status
        );

    }


    function getErrorMessage(error) {

        if (!error) {

            return 'حدث خطأ غير معروف.';

        }

        return String(
            error.message ||
            'تعذر تنفيذ العملية.'
        );

    }


    /* ========================================================
       09 — PUBLIC API
       ======================================================== */

    var API = {

        request: request,

        get: get,

        post: post,

        put: put,

        patch: patch,

        delete: remove,

        getToken: getToken,

        setToken: setToken,

        clearToken: clearToken,

        isAuthenticated: isAuthenticated,

        health: health,

        isUnauthorized: isUnauthorized,

        isNetworkError: isNetworkError,

        getErrorMessage: getErrorMessage,

        parseResponse: parseResponse

    };


    /* ========================================================
       10 — REGISTER
       ======================================================== */

    window.OFESTRA_PROFILE_SERVER = API;


    console.log(
        '[OFESTRA] Profile Server Layer Ready'
    );


})();

