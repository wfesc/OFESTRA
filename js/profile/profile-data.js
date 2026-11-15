
/* =========================================================
   WFESCTRA — PROFILE DATA
   File: js/profile/profile-data.js
   Version: 1.0.0
   Role: Profile information and player data management
   ========================================================= */

(function (window, document) {
  "use strict";

  if (window.WFESCTRA_PROFILE_DATA) {
    return;
  }

  const STORAGE_KEY = "wfesctra_profile_data";

  /* =======================================================
     1. DEFAULT PROFILE
  ======================================================= */

  function createDefaultProfile() {
    return {
      id: null,

      displayName: "لاعب جديد",
      username: "",
      email: "",

      avatar: null,
      bio: "",
      country: "",
      city: "",

      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),

      level: 1,
      experience: 0,

      stats: {
        gamesPlayed: 0,
        gamesWon: 0,
        gamesLost: 0,
        gamesDrawn: 0,

        totalPoints: 0,
        currentStreak: 0,
        bestStreak: 0
      },

      achievements: [],

      preferences: {
        showCountry: true,
        showStats: true,
        showAchievements: true
      },

      metadata: {
        version: 1,
        source: "local-prototype"
      }
    };
  }

  /* =======================================================
     2. INTERNAL STATE
  ======================================================= */

  let profile = createDefaultProfile();
  let initialized = false;

  /* =======================================================
     3. SAFE HELPERS
  ======================================================= */

  function isObject(value) {
    return (
      value !== null &&
      typeof value === "object" &&
      !Array.isArray(value)
    );
  }

  function clone(value) {
    if (typeof structuredClone === "function") {
      return structuredClone(value);
    }

    return JSON.parse(JSON.stringify(value));
  }

  function cleanText(value, maxLength) {
    if (typeof value !== "string") {
      return "";
    }

    return value
      .trim()
      .replace(/[\u0000-\u001F\u007F]/g, "")
      .slice(0, maxLength || 500);
  }

  function safeNumber(value, min, max) {
    const number = Number(value);

    if (!Number.isFinite(number)) {
      return min;
    }

    return Math.max(
      min,
      Math.min(max, Math.floor(number))
    );
  }

  function safeBoolean(value, fallback) {
    return typeof value === "boolean"
      ? value
      : fallback;
  }

  function safeDate(value, fallback) {
    if (!value) return fallback;

    const date = new Date(value);

    return Number.isNaN(date.getTime())
      ? fallback
      : date.toISOString();
  }

  /* =======================================================
     4. PROFILE VALIDATION
  ======================================================= */

  function normalizeStats(value) {
    const defaults = createDefaultProfile().stats;

    if (!isObject(value)) {
      return defaults;
    }

    return {
      gamesPlayed: safeNumber(
        value.gamesPlayed, 0, 100000000
      ),

      gamesWon: safeNumber(
        value.gamesWon, 0, 100000000
      ),

      gamesLost: safeNumber(
        value.gamesLost, 0, 100000000
      ),

      gamesDrawn: safeNumber(
        value.gamesDrawn, 0, 100000000
      ),

      totalPoints: safeNumber(
        value.totalPoints, 0, 1000000000
      ),

      currentStreak: safeNumber(
        value.currentStreak, 0, 1000000
      ),

      bestStreak: safeNumber(
        value.bestStreak, 0, 1000000
      )
    };
  }

  function normalizeAchievements(value) {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .filter(isObject)
      .slice(0, 500)
      .map(function (item) {
        return {
          id: cleanText(item.id, 100),
          title: cleanText(item.title, 100),
          description: cleanText(
            item.description, 300
          ),
          icon: cleanText(item.icon, 30),
          unlockedAt: safeDate(
            item.unlockedAt, null
          ),
          unlocked: item.unlocked === true
        };
      });
  }

  function normalizeProfile(value) {
    const defaults = createDefaultProfile();

    if (!isObject(value)) {
      return defaults;
    }

    const result = {
      ...defaults,

      id: cleanText(value.id, 120) || null,

      displayName:
        cleanText(value.displayName, 40) ||
        defaults.displayName,

      username: cleanText(value.username, 30),
      email: cleanText(value.email, 254),

      avatar: cleanText(value.avatar, 200000) || null,

      bio: cleanText(value.bio, 300),
      country: cleanText(value.country, 80),
      city: cleanText(value.city, 80),

      createdAt: safeDate(
        value.createdAt,
        defaults.createdAt
      ),

      updatedAt: safeDate(
        value.updatedAt,
        defaults.updatedAt
      ),

      level: safeNumber(value.level, 1, 100000),
      experience: safeNumber(
        value.experience, 0, 1000000000
      ),

      stats: normalizeStats(value.stats),

      achievements: normalizeAchievements(
        value.achievements
      ),

      preferences: {
        showCountry: safeBoolean(
          value.preferences?.showCountry, true
        ),

        showStats: safeBoolean(
          value.preferences?.showStats, true
        ),

        showAchievements: safeBoolean(
          value.preferences?.showAchievements, true
        )
      },

      metadata: {
        version: 1,
        source: "local-prototype"
      }
    };

    return result;
  }

  /* =======================================================
     5. STORAGE ADAPTER
  ======================================================= */

  function readLegacyProfile() {
    if (!isObject(window.PF)) {
      return null;
    }

    const old = window.PF;

    return {
      displayName:
        old.displayName ||
        old.name ||
        old.nick ||
        "لاعب جديد",

      username: old.username || "",
      avatar: old.avatar || null,
      bio: old.bio || "",
      country: old.country || "",
      city: old.city || "",

      level: old.level || 1,
      experience: old.experience || 0
    };
  }

  function readStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);

      if (raw) {
        return JSON.parse(raw);
      }

      return readLegacyProfile();

    } catch (error) {
      console.warn(
        "[WFESCTRA DATA] Storage read failed:",
        error
      );

      return readLegacyProfile();
    }
  }

  function writeStorage() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(profile)
      );

      return true;

    } catch (error) {
      console.error(
        "[WFESCTRA DATA] Storage write failed:",
        error
      );

      return false;
    }
  }

  /* =======================================================
     6. PROFILE EVENTS
  ======================================================= */

  function emit(eventName, detail) {
    const core = window.WFESCTRA_PROFILE;

    if (
      core &&
      typeof core.emit === "function"
    ) {
      core.emit(eventName, detail);
    }

    try {
      document.dispatchEvent(
        new CustomEvent(
          "wfesctra:profile-data:" + eventName,
          { detail: detail }
        )
      );
    } catch (_) {}
  }

  /* =======================================================
     7. INITIALIZATION
  ======================================================= */

  function init() {
    if (initialized) {
      return true;
    }

    const saved = readStorage();

    profile = normalizeProfile(saved);

    initialized = true;

    emit("loaded", {
      profile: get()
    });

    console.info(
      "[WFESCTRA DATA] Profile data initialized."
    );

    return true;
  }

  /* =======================================================
     8. GET PROFILE DATA
  ======================================================= */

  function get() {
    return clone(profile);
  }

  function getField(field) {
    if (
      typeof field !== "string" ||
      !field.trim()
    ) {
      return undefined;
    }

    const parts = field.split(".");
    let value = profile;

    for (const part of parts) {
      if (
        !isObject(value) ||
        !Object.prototype.hasOwnProperty.call(
          value, part
        )
      ) {
        return undefined;
      }

      value = value[part];
    }

    return clone(value);
  }

  /* =======================================================
     9. UPDATE PROFILE
  ======================================================= */

  const ALLOWED_FIELDS = [
    "displayName",
    "username",
    "avatar",
    "bio",
    "country",
    "city"
  ];

  function update(changes) {
    if (!isObject(changes)) {
      return false;
    }

    const updated = { ...profile };

    ALLOWED_FIELDS.forEach(function (field) {
      if (
        Object.prototype.hasOwnProperty.call(
          changes, field
        )
      ) {
        if (field === "avatar") {
          const value = changes[field];

          updated.avatar =
            typeof value === "string" &&
            value.length <= 200000
              ? value
              : null;

        } else {
          updated[field] = cleanText(
            changes[field],
            field === "bio" ? 300 : 254
          );
        }
      }
    });

    updated.updatedAt = new Date().toISOString();

    profile = normalizeProfile(updated);

    const saved = writeStorage();

    emit("updated", {
      profile: get(),
      saved: saved
    });

    return true;
  }

  /* =======================================================
     10. STATISTICS
  ======================================================= */

  function updateStats(changes) {
    if (!isObject(changes)) {
      return false;
    }

    const next = {
      ...profile.stats
    };

    const allowed = [
      "gamesPlayed",
      "gamesWon",
      "gamesLost",
      "gamesDrawn",
      "totalPoints",
      "currentStreak",
      "bestStreak"
    ];

    allowed.forEach(function (key) {
      if (
        Object.prototype.hasOwnProperty.call(
          changes, key
        )
      ) {
        next[key] = safeNumber(
          changes[key],
          0,
          1000000000
        );
      }
    });

    profile.stats = normalizeStats(next);
    profile.updatedAt = new Date().toISOString();

    writeStorage();

    emit("stats-updated", {
      stats: clone(profile.stats)
    });

    return true;
  }

  function recordGame(result, points) {
    if (
      !["win", "loss", "draw"].includes(result)
    ) {
      return false;
    }

    const stats = { ...profile.stats };

    stats.gamesPlayed += 1;

    stats.totalPoints += safeNumber(
      points, 0, 1000000
    );

    if (result === "win") {
      stats.gamesWon += 1;
      stats.currentStreak += 1;

      stats.bestStreak = Math.max(
        stats.bestStreak,
        stats.currentStreak
      );

    } else if (result === "loss") {
      stats.gamesLost += 1;
      stats.currentStreak = 0;

    } else {
      stats.gamesDrawn += 1;
      stats.currentStreak = 0;
    }

    return updateStats(stats);
  }

  /* =======================================================
     11. ACHIEVEMENTS
  ======================================================= */

  function addAchievement(achievement) {
    if (!isObject(achievement)) {
      return false;
    }

    const id = cleanText(achievement.id, 100);

    if (!id) {
      return false;
    }

    const exists = profile.achievements.some(
      function (item) {
        return item.id === id;
      }
    );

    if (exists) {
      return false;
    }

    profile.achievements.push({
      id: id,
      title: cleanText(
        achievement.title, 100
      ),
      description: cleanText(
        achievement.description, 300
      ),
      icon: cleanText(
        achievement.icon, 30
      ),
      unlockedAt: new Date().toISOString(),
      unlocked: true
    });

    profile.updatedAt = new Date().toISOString();

    writeStorage();

    emit("achievement-unlocked", {
      achievement: clone(
        profile.achievements[
          profile.achievements.length - 1
        ]
      )
    });

    return true;
  }

  function getAchievements() {
    return clone(profile.achievements);
  }

  /* =======================================================
     12. PREFERENCES
  ======================================================= */

  function updatePreferences(changes) {
    if (!isObject(changes)) {
      return false;
    }

    const allowed = [
      "showCountry",
      "showStats",
      "showAchievements"
    ];

    allowed.forEach(function (key) {
      if (
        allowed.includes(key) &&
        typeof changes[key] === "boolean"
      ) {
        profile.preferences[key] = changes[key];
      }
    });

    profile.updatedAt = new Date().toISOString();

    writeStorage();

    emit("preferences-updated", {
      preferences: clone(profile.preferences)
    });

    return true;
  }

  /* =======================================================
     13. RESET PROFILE
  ======================================================= */

  function reset() {
    const previousCreatedAt = profile.createdAt;

    profile = createDefaultProfile();
    profile.createdAt = previousCreatedAt;
    profile.updatedAt = new Date().toISOString();

    writeStorage();

    emit("reset", {
      profile: get()
    });

    return true;
  }

  /* =======================================================
     14. PUBLIC API
  ======================================================= */

  const api = {
    version: "1.0.0",

    init: init,

    get: get,
    getField: getField,

    update: update,

    updateStats: updateStats,
    recordGame: recordGame,

    addAchievement: addAchievement,
    getAchievements: getAchievements,

    updatePreferences: updatePreferences,

    reset: reset,

    isInitialized: function () {
      return initialized;
    }
  };

  window.WFESCTRA_PROFILE_DATA = api;

  /* التسجيل داخل النظام المركزي */
  const core = window.WFESCTRA_PROFILE;

  if (core && typeof core.registerModule === "function") {
    core.registerModule("data", api, 20);
  }

  console.info(
    "[WFESCTRA DATA] Module loaded."
  );

})(window, document);
