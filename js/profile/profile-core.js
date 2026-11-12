
/* ============================================================
 * OFESTRA PRO — PROFILE CORE
 * الملف: profile-core.js
 * المسؤولية: المتغيرات المشتركة والقواعد والدوال الأساسية
 * ============================================================ */


/* ============================================================
   01 — PLAYER DATA
   ============================================================ */

/*
 * نحافظ على بيانات PF الموجودة في storage.js.
 * لا نستبدل بيانات اللاعب القديمة.
 */

if (
    !window.PF ||
    typeof window.PF !== 'object'
) {
    window.PF = {};
}

var PF = window.PF;

var PF_DEFAULTS = {
    name: 'Player',
    av: 0,
    avatarUrl: 'images/default-avatar.jpg',
    info: '',
    w: 0,
    l: 0,
    d: 0,
    played: 0,
    mins: 0,
    seen: 0,
    lastNamed: 0
};

Object.keys(PF_DEFAULTS).forEach(function (key) {

    if (
        PF[key] === undefined ||
        PF[key] === null
    ) {
        PF[key] = PF_DEFAULTS[key];
    }

});


/* ============================================================
   02 — DEFAULT ASSETS
   ============================================================ */

var PF_DEFAULT_AVATAR = 'images/default-avatar.jpg';

var PF_LOGIN_ICON = 'images/account-login.jpg';


/* ============================================================
   03 — RULES
   ============================================================ */

var PF_RULES = {

    USERNAME_MIN: 4,
    USERNAME_MAX: 10,

    PASSWORD_MIN: 8,
    PASSWORD_MAX: 20,

    DISPLAY_NAME_MIN: 2,
    DISPLAY_NAME_MAX: 20,

    BIO_MAX: 250,

    USERNAME_CHANGE_DAYS: 7,

    AVATAR_MAX_BYTES: 2 * 1024 * 1024,

    AVATAR_MAX_SIZE: 512

};


var PF_USERNAME_PATTERN = /^[A-Za-z0-9]+$/;

var PF_PASSWORD_PATTERN = /^[A-Za-z0-9]+$/;

var PF_EMAIL_PATTERN =
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/;


/* ============================================================
   04 — AUTHENTICATION STATE
   ============================================================ */

var PF_AUTH = {

    token: '',
    user: null,

    ready: false,
    busy: false,
    restoring: false

};


var PF_VIEW = 'home';


var PF_PENDING = {

    email: '',
    password: '',

    ticket: '',
    resetTicket: ''

};


var PF_PROFILE_TIMER = null;

var PF_SYNC_TIMER = null;

var PF_AVATAR_UPLOAD_BUSY = false;


/* ============================================================
   05 — BASIC HELPERS
   ============================================================ */

function pfGet(id) {

    return document.getElementById(id);

}


function pfEscape(value) {

    return String(
        value === undefined || value === null
            ? ''
            : value
    ).replace(/[&<>"']/g, function (char) {

        return {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        }[char];

    });

}


function pfNotify(message) {

    if (
        typeof showToastNotification === 'function'
    ) {

        showToastNotification(message);

    } else if (
        typeof showToast === 'function'
    ) {

        showToast(message);

    } else {

        console.log('[OFESTRA]', message);

    }

}


function pfSound() {

    if (
        typeof X !== 'undefined' &&
        X &&
        typeof X.sw === 'function'
    ) {

        X.sw();

    }

}


function pfSaveLocal() {

    if (typeof savePF === 'function') {

        savePF();

    }

}


function pfPublish() {

    if (typeof publishDir === 'function') {

        publishDir();

    }

}


function pfRefresh() {

    if (typeof refresh === 'function') {

        refresh();

    }

}


/* ============================================================
   06 — INPUT VALIDATION
   ============================================================ */

function pfEmailValid(email) {

    return PF_EMAIL_PATTERN.test(
        String(email || '').trim()
    );

}


function pfUsernameError(username) {

    username = String(username || '');

    if (!username) {

        return 'يرجى إدخال اسم المستخدم.';

    }

    if (/\s/.test(username)) {

        return 'اسم المستخدم لا يقبل الفراغات.';

    }

    if (username.length === 3) {

        return 'الأسماء المكوّنة من 3 خانات محجوزة للإدارة.';

    }

    if (
        username.length < PF_RULES.USERNAME_MIN
    ) {

        return 'اسم المستخدم يجب أن يحتوي على 4 خانات على الأقل.';

    }

    if (
        username.length > PF_RULES.USERNAME_MAX
    ) {

        return 'الحد الأقصى لاسم المستخدم هو 10 خانات.';

    }

    if (!PF_USERNAME_PATTERN.test(username)) {

        return 'استخدم الحروف الإنجليزية والأرقام فقط.';

    }

    return '';

}


function pfPasswordError(password) {

    password = String(password || '');

    if (
        password.length < PF_RULES.PASSWORD_MIN
    ) {

        return 'كلمة المرور يجب أن تحتوي على 8 خانات على الأقل.';

    }

    if (
        password.length > PF_RULES.PASSWORD_MAX
    ) {

        return 'الحد الأقصى لكلمة المرور هو 20 خانة.';

    }

    if (!PF_PASSWORD_PATTERN.test(password)) {

        return 'كلمة المرور تقبل الحروف الإنجليزية والأرقام فقط.';

    }

    return '';

}


function pfDisplayNameError(name) {

    name = String(name || '').trim();

    if (
        name.length < PF_RULES.DISPLAY_NAME_MIN
    ) {

        return 'اسم العرض يجب أن يحتوي على حرفين على الأقل.';

    }

    if (
        name.length > PF_RULES.DISPLAY_NAME_MAX
    ) {

        return 'اسم العرض طويل جداً.';

    }

    return '';

}


/* ============================================================
   07 — ERROR MESSAGE NORMALIZATION
   ============================================================ */

function pfErrorText(error) {

    if (!error) {

        return 'حدث خطأ غير معروف.';

    }

    var message = error.message || '';

    if (Array.isArray(message)) {

        return message.map(function (item) {

            return item.msg || String(item);

        }).join('، ');

    }

    if (typeof message === 'object') {

        return JSON.stringify(message);

    }

    return String(message);

}


/* ============================================================
   08 — NUMBER HELPERS
   ============================================================ */

function pfNumber(value, fallback) {

    var number = Number(value);

    return Number.isFinite(number)
        ? number
        : (fallback || 0);

}


function pfClamp(value, minimum, maximum) {

    return Math.max(
        minimum,
        Math.min(maximum, value)
    );

}


/* ============================================================
   09 — DATE HELPERS
   ============================================================ */

function pfTimeValue(value) {

    if (!value) return 0;

    if (typeof value === 'number') {

        return value < 1000000000000
            ? value * 1000
            : value;

    }

    var parsed = Date.parse(value);

    return Number.isFinite(parsed)
        ? parsed
        : 0;

}


function pfFormatWait(milliseconds) {

    var seconds = Math.ceil(
        milliseconds / 1000
    );

    var days = Math.floor(
        seconds / 86400
    );

    seconds %= 86400;

    var hours = Math.floor(
        seconds / 3600
    );

    seconds %= 3600;

    var minutes = Math.floor(
        seconds / 60
    );

    if (days > 0) {

        return days + ' يوم و' + hours + ' ساعة';

    }

    if (hours > 0) {

        return hours + ' ساعة و' + minutes + ' دقيقة';

    }

    return minutes + ' دقيقة';

}


/* ============================================================
   10 — MOTION SETTINGS
   ============================================================ */

function pfReadSavedSettings() {

    try {

        var raw = localStorage.getItem(
            'OFESTRA_SETTINGS'
        );

        return raw
            ? JSON.parse(raw)
            : {};

    } catch (error) {

        return {};

    }

}


function pfGetMotionMode() {

    var stored = pfReadSavedSettings();

    var mode = 'classic';

    if (
        window.OFESTRA_SETTINGS &&
        window.OFESTRA_SETTINGS.animationMode
    ) {

        mode =
            window.OFESTRA_SETTINGS.animationMode;

    } else if (
        window.OFESTRA_SETTINGS &&
        window.OFESTRA_SETTINGS.motionMode
    ) {

        mode =
            window.OFESTRA_SETTINGS.motionMode;

    } else if (stored.animationMode) {

        mode = stored.animationMode;

    } else if (stored.motionMode) {

        mode = stored.motionMode;

    } else {

        try {

            mode = localStorage.getItem(
                'OFESTRA_MOTION_MODE'
            ) || 'classic';

        } catch (error) {}

        /*
         * توافق احتياطي مع S.enh الموجود في storage.js.
         */

        if (
            mode === 'classic' &&
            typeof S !== 'undefined' &&
            S &&
            Number(S.enh) === 1
        ) {

            mode = 'enhanced';

        }

    }

    return mode === 'enhanced'
        ? 'enhanced'
        : 'classic';

}


/* ============================================================
   11 — APPLY VISUAL SETTINGS
   ============================================================ */

function pfApplyVisualSettings(settings) {

    settings = settings || {};

    var root = pfGet('prof');

    var panel = pfGet('pfAccountPanel');

    var stored = pfReadSavedSettings();

    var mode =

        settings.animationMode ||

        settings.motionMode ||

        (
            window.OFESTRA_SETTINGS
                ? window.OFESTRA_SETTINGS.animationMode
                : ''
        ) ||

        (
            window.OFESTRA_SETTINGS
                ? window.OFESTRA_SETTINGS.motionMode
                : ''
        ) ||

        stored.animationMode ||

        stored.motionMode ||

        pfGetMotionMode();


    mode = mode === 'enhanced'
        ? 'enhanced'
        : 'classic';


    try {

        localStorage.setItem(
            'OFESTRA_MOTION_MODE',
            mode
        );

    } catch (error) {}


    if (root) {

        root.dataset.pfMotion = mode;

    }

    if (panel) {

        panel.dataset.pfMotion = mode;

    }


    /* ألوان قابلة للتخصيص من الإعدادات */

    var colors =
        settings.colors ||
        settings.palette ||
        {};

    var colorMap = {

        accent: '--ofestra-accent',

        accent2: '--ofestra-accent-2',

        background: '--ofestra-bg',

        surface: '--ofestra-surface',

        text: '--ofestra-text',

        muted: '--ofestra-muted',

        border: '--ofestra-border',

        danger: '--ofestra-danger',

        success: '--ofestra-success'

    };


    Object.keys(colorMap).forEach(function (key) {

        var value = colors[key];

        if (
            typeof value === 'string' &&
            /^#[0-9a-fA-F]{3,8}$/.test(value)
        ) {

            document.documentElement.style.setProperty(
                colorMap[key],
                value
            );

        }

    });

}


/* ============================================================
   12 — PROFILE ANIMATION
   ============================================================ */

function pfAnimatePanel() {

    var panel = pfGet('pfAccountPanel');

    if (!panel) return;

    var mode = pfGetMotionMode();

    panel.dataset.pfMotion = mode;

    panel.classList.remove('pf-entering');

    /*
     * إعادة تشغيل الحركة عند تغيير محتوى البروفايل.
     */

    void panel.offsetWidth;

    panel.classList.add('pf-entering');

    if (panel._pfAnimationTimer) {

        clearTimeout(
            panel._pfAnimationTimer
        );

    }

    panel._pfAnimationTimer = setTimeout(
        function () {

            panel.classList.remove(
                'pf-entering'
            );

        },
        mode === 'enhanced' ? 850 : 400
    );

}


/* ============================================================
   13 — SETTINGS EVENT
   ============================================================ */

window.OFESTRA_PROFILE_UI =
    window.OFESTRA_PROFILE_UI || {};


window.OFESTRA_PROFILE_UI.apply =
    pfApplyVisualSettings;


window.addEventListener(
    'ofestra:settings-change',
    function (event) {

        pfApplyVisualSettings(
            event.detail || {}
        );

        pfAnimatePanel();

    }
);


/* ============================================================
   14 — PROFILE READY
   ============================================================ */

console.log(
    '[OFESTRA] Profile Core Ready'
);

