
/* =========================================================
   WFESCTRA — PROFILE CORE
   File: js/profile/profile-core.js
   Version: 1.0.0
   Role: Profile system core and module manager
   ========================================================= */

(function (window, document) {
  "use strict";

  /* منع إنشاء النظام أكثر من مرة */
  if (window.WFESCTRA_PROFILE) {
    return;
  }

  /* =======================================================
     1. CORE STATE
  ======================================================= */

  const state = {
    initialized: false,
    started: false,
    loggedIn: false,
    user: null,

    loading: false,
    error: null,

    currentPage: "profile",
    mode: "local",

    modules: {},
    moduleStatus: {},

    createdAt: Date.now()
  };

  /* =======================================================
     2. EVENT SYSTEM
  ======================================================= */

  const events = {};

  function on(eventName, callback) {
    if (
      typeof eventName !== "string" ||
      typeof callback !== "function"
    ) {
      return function () {};
    }

    if (!events[eventName]) {
      events[eventName] = new Set();
    }

    events[eventName].add(callback);

    return function unsubscribe() {
      off(eventName, callback);
    };
  }

  function off(eventName, callback) {
    if (!events[eventName]) return;

    events[eventName].delete(callback);

    if (events[eventName].size === 0) {
      delete events[eventName];
    }
  }

  function emit(eventName, detail) {
    const listeners = events[eventName];

    if (listeners) {
      [...listeners].forEach(function (callback) {
        try {
          callback(detail, api);
        } catch (error) {
          console.error(
            "[WFESCTRA PROFILE] Event error:",
            eventName,
            error
          );
        }
      });
    }

    try {
      document.dispatchEvent(
        new CustomEvent("wfesctra:profile:" + eventName, {
          detail: detail
        })
      );
    } catch (error) {
      console.warn(
        "[WFESCTRA PROFILE] Could not dispatch event:",
        error
      );
    }
  }

  /* =======================================================
     3. STATE MANAGEMENT
  ======================================================= */

  function getState() {
    return {
      initialized: state.initialized,
      started: state.started,
      loggedIn: state.loggedIn,
      user: state.user
        ? { ...state.user }
        : null,

      loading: state.loading,
      error: state.error,
      currentPage: state.currentPage,
      mode: state.mode
    };
  }

  function setLoading(value) {
    state.loading = Boolean(value);

    emit("loading-change", {
      loading: state.loading
    });
  }

  function setError(error) {
    state.error = error
      ? String(error)
      : null;

    emit("error-change", {
      error: state.error
    });
  }

  function clearError() {
    setError(null);
  }

  function setPage(page) {
    if (typeof page !== "string" || !page.trim()) {
      return false;
    }

    state.currentPage = page.trim();

    emit("page-change", {
      page: state.currentPage
    });

    return true;
  }

  function setMode(mode) {
    if (!["local", "server", "guest"].includes(mode)) {
      return false;
    }

    state.mode = mode;

    emit("mode-change", {
      mode: state.mode
    });

    return true;
  }

  /* =======================================================
     4. AUTHENTICATION BRIDGE
  ======================================================= */

  function updateAuth(user) {
    const previousLoginState = state.loggedIn;

    state.user = user && typeof user === "object"
      ? { ...user }
      : null;

    state.loggedIn = Boolean(state.user);

    if (state.loggedIn) {
      state.mode = "local";
    } else {
      state.mode = "guest";
    }

    emit("auth-change", {
      loggedIn: state.loggedIn,
      user: state.user
        ? { ...state.user }
        : null,
      previousLoginState: previousLoginState
    });

    if (previousLoginState !== state.loggedIn) {
      emit(
        state.loggedIn ? "login" : "logout",
        {
          user: state.user
            ? { ...state.user }
            : null
        }
      );
    }
  }

  function connectAuth() {
    const auth = window.WFESCTRA_AUTH;

    if (!auth) {
      console.warn(
        "[WFESCTRA PROFILE] Authentication module not found."
      );

      updateAuth(null);
      return false;
    }

    try {
      if (typeof auth.init === "function") {
        auth.init();
      }

      if (typeof auth.getCurrentUser === "function") {
        updateAuth(auth.getCurrentUser());
      }

      document.addEventListener(
        "wfesctra:auth-change",
        function (event) {
          const user = event.detail &&
            event.detail.user
            ? event.detail.user
            : null;

          updateAuth(user);
        }
      );

      return true;

    } catch (error) {
      console.error(
        "[WFESCTRA PROFILE] Auth connection failed:",
        error
      );

      setError("تعذر تهيئة نظام الحسابات");
      return false;
    }
  }

  /* =======================================================
     5. MODULE MANAGER
  ======================================================= */

  function registerModule(name, module, priority) {
    if (
      typeof name !== "string" ||
      !name.trim() ||
      !module
    ) {
      return false;
    }

    name = name.trim();

    if (state.modules[name]) {
      console.warn(
        "[WFESCTRA PROFILE] Module already registered:",
        name
      );

      return false;
    }

    state.modules[name] = {
      instance: module,
      priority: Number.isFinite(priority)
        ? priority
        : 100,
      initialized: false
    };

    state.moduleStatus[name] = "registered";

    emit("module-registered", {
      name: name
    });

    return true;
  }

  function getModule(name) {
    const module = state.modules[name];

    return module
      ? module.instance
      : null;
  }

  function getModuleStatus(name) {
    return state.moduleStatus[name] || "missing";
  }

  function initializeModules() {
    const modules = Object.keys(state.modules)
      .map(function (name) {
        return {
          name: name,
          ...state.modules[name]
        };
      })
      .sort(function (a, b) {
        return a.priority - b.priority;
      });

    modules.forEach(function (entry) {
      const name = entry.name;
      const module = entry.instance;

      if (entry.initialized) return;

      try {
        state.moduleStatus[name] = "initializing";

        if (typeof module === "function") {
          module(api);
        } else if (
          typeof module.init === "function"
        ) {
          module.init(api);
        }

        state.modules[name].initialized = true;
        state.moduleStatus[name] = "ready";

        emit("module-ready", {
          name: name
        });

      } catch (error) {
        state.moduleStatus[name] = "error";

        console.error(
          "[WFESCTRA PROFILE] Module initialization failed:",
          name,
          error
        );

        emit("module-error", {
          name: name,
          error: error
        });
      }
    });
  }

  /* =======================================================
     6. CORE INITIALIZATION
  ======================================================= */

  function init() {
    if (state.initialized) {
      return true;
    }

    state.initialized = true;

    connectAuth();

    emit("initialized", getState());

    console.info(
      "[WFESCTRA PROFILE] Core initialized."
    );

    return true;
  }

  /* =======================================================
     7. START PROFILE SYSTEM
  ======================================================= */

  function start() {
    if (state.started) {
      return true;
    }

    if (!state.initialized) {
      init();
    }

    initializeModules();

    state.started = true;

    emit("started", getState());

    console.info(
      "[WFESCTRA PROFILE] Profile system started."
    );

    return true;
  }

  /* =======================================================
     8. FIRST RUN BRIDGE
  ======================================================= */

  function firstRun() {
    emit("first-run", getState());

    const ui = getModule("ui");

    if (ui && typeof ui.firstRun === "function") {
      try {
        ui.firstRun(api);
      } catch (error) {
        console.error(
          "[WFESCTRA PROFILE] First run error:",
          error
        );
      }
    }
  }

  /* =======================================================
     9. PUBLIC API
  ======================================================= */

  const api = {
    version: "1.0.0",

    init: init,
    start: start,

    on: on,
    off: off,
    emit: emit,

    getState: getState,

    setLoading: setLoading,
    setError: setError,
    clearError: clearError,

    setPage: setPage,
    setMode: setMode,

    updateAuth: updateAuth,

    registerModule: registerModule,
    getModule: getModule,
    getModuleStatus: getModuleStatus,

    firstRun: firstRun,

    isLoggedIn: function () {
      return state.loggedIn;
    },

    getUser: function () {
      return state.user
        ? { ...state.user }
        : null;
    },

    isReady: function () {
      return state.started;
    }
  };

  /* =======================================================
     10. GLOBAL REGISTRATION
  ======================================================= */

  window.WFESCTRA_PROFILE = api;

  /*
    توافق مبدئي مع main.js القديم.
    يبقى initProfile() موجوداً حتى لا نحتاج
    تعديل index.html حالياً.
  */

  window.initProfile = function () {
    return api.start();
  };

  /*
    توافق مع استدعاء firstRunProfile()
    الموجود في main.js.
  */

  window.firstRunProfile = function () {
    return api.firstRun();
  };

  console.info(
    "[WFESCTRA PROFILE] Core module loaded."
  );

})(window, document);
