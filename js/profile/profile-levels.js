
/* =========================================================
   WFESCTRA — PROFILE LEVELS
   File: js/profile/profile-levels.js
   Version: 1.0.0
   Role: XP, levels, ranks and player progression
   ========================================================= */

(function (window, document) {
  "use strict";

  if (window.WFESCTRA_PROFILE_LEVELS) {
    return;
  }

  /* =======================================================
     1. CONFIGURATION
  ======================================================= */

  const CONFIG = {
    maxLevel: 100,
    baseXP: 100,
    growth: 1.35,
    maxXP: 1000000000
  };

  /* =======================================================
     2. RANK DEFINITIONS
  ======================================================= */

  const RANKS = [
    {
      minLevel: 1,
      name: "مبتدئ",
      title: "بداية الرحلة",
      icon: "🌱"
    },
    {
      minLevel: 5,
      name: "هاوٍ",
      title: "بدأت تتقن اللعب",
      icon: "🎯"
    },
    {
      minLevel: 10,
      name: "متمرس",
      title: "خبرة متقدمة",
      icon: "⚡"
    },
    {
      minLevel: 20,
      name: "محترف",
      title: "لاعب محترف",
      icon: "🏅"
    },
    {
      minLevel: 35,
      name: "خبير",
      title: "خبرة عالية",
      icon: "💎"
    },
    {
      minLevel: 50,
      name: "نخبة",
      title: "من نخبة اللاعبين",
      icon: "👑"
    },
    {
      minLevel: 75,
      name: "أسطوري",
      title: "مستوى استثنائي",
      icon: "🔥"
    },
    {
      minLevel: 100,
      name: "بطل WFESCTRA",
      title: "قمة التقدم",
      icon: "🏆"
    }
  ];

  /* =======================================================
     3. HELPERS
  ======================================================= */

  function getDataModule() {
    return window.WFESCTRA_PROFILE_DATA || null;
  }

  function safeNumber(value, fallback) {
    const number = Number(value);

    return Number.isFinite(number)
      ? Math.max(0, Math.floor(number))
      : fallback;
  }

  function getProfile() {
    const data = getDataModule();

    if (!data || typeof data.get !== "function") {
      return null;
    }

    return data.get();
  }

  /* =======================================================
     4. XP REQUIREMENTS
  ======================================================= */

  function xpForLevel(level) {
    level = safeNumber(level, 1);

    if (level <= 1) {
      return 0;
    }

    if (level > CONFIG.maxLevel) {
      level = CONFIG.maxLevel;
    }

    let total = 0;

    for (let i = 1; i < level; i++) {
      total += Math.floor(
        CONFIG.baseXP *
        Math.pow(CONFIG.growth, i - 1)
      );
    }

    return Math.min(total, CONFIG.maxXP);
  }

  function xpToNextLevel(level) {
    level = safeNumber(level, 1);

    if (level >= CONFIG.maxLevel) {
      return 0;
    }

    return Math.floor(
      CONFIG.baseXP *
      Math.pow(CONFIG.growth, level - 1)
    );
  }

  /* =======================================================
     5. LEVEL CALCULATION
  ======================================================= */

  function calculate(experience) {
    let xp = safeNumber(experience, 0);

    xp = Math.min(xp, CONFIG.maxXP);

    let level = 1;

    while (
      level < CONFIG.maxLevel &&
      xp >= xpToNextLevel(level)
    ) {
      xp -= xpToNextLevel(level);
      level++;
    }

    const needed = xpToNextLevel(level);

    const progress = level >= CONFIG.maxLevel
      ? 100
      : Math.min(
          100,
          Math.floor((xp / needed) * 100)
        );

    return {
      level: level,
      experience: xp,
      currentXP: xp,
      requiredXP: needed,
      totalXP: safeNumber(experience, 0),
      progress: progress,
      isMaxLevel: level >= CONFIG.maxLevel
    };
  }

  /* =======================================================
     6. RANK SYSTEM
  ======================================================= */

  function getRank(level) {
    level = safeNumber(level, 1);

    let selected = RANKS[0];

    for (const rank of RANKS) {
      if (level >= rank.minLevel) {
        selected = rank;
      }
    }

    return { ...selected };
  }

  function getNextRank(level) {
    level = safeNumber(level, 1);

    return RANKS.find(function (rank) {
      return rank.minLevel > level;
    }) || null;
  }

  /* =======================================================
     7. PLAYER PROGRESSION
  ======================================================= */

  function getProgress() {
    const profile = getProfile();

    if (!profile) {
      return calculate(0);
    }

    return calculate(profile.experience);
  }

  function getOverview() {
    const progress = getProgress();
    const rank = getRank(progress.level);
    const nextRank = getNextRank(progress.level);

    return {
      ...progress,
      rank: rank,
      nextRank: nextRank
        ? { ...nextRank }
        : null
    };
  }

  /* =======================================================
     8. ADD EXPERIENCE
  ======================================================= */

  function addXP(amount, reason) {
    const data = getDataModule();

    if (!data || typeof data.get !== "function") {
      return {
        success: false,
        error: "DATA_MODULE_UNAVAILABLE"
      };
    }

    amount = safeNumber(amount, 0);

    if (amount <= 0) {
      return {
        success: false,
        error: "INVALID_XP"
      };
    }

    const profile = data.get();
    const oldProgress = calculate(profile.experience);

    const newTotal = Math.min(
      profile.experience + amount,
      CONFIG.maxXP
    );

    const newProgress = calculate(newTotal);

    const saved = data.update({
      experience: newTotal,
      level: newProgress.level
    });

    if (!saved) {
      return {
        success: false,
        error: "SAVE_FAILED"
      };
    }

    const result = {
      success: true,
      added: amount,
      totalXP: newTotal,
      oldLevel: oldProgress.level,
      newLevel: newProgress.level,
      levelUp: newProgress.level > oldProgress.level,
      progress: newProgress,
      reason: typeof reason === "string"
        ? reason.slice(0, 100)
        : ""
    };

    const core = window.WFESCTRA_PROFILE;

    if (core && typeof core.emit === "function") {
      core.emit("xp-added", result);

      if (result.levelUp) {
        core.emit("level-up", {
          oldLevel: result.oldLevel,
          newLevel: result.newLevel,
          rank: getRank(result.newLevel)
        });
      }
    }

    return result;
  }

  /* =======================================================
     9. GAME REWARDS
  ======================================================= */

  const REWARDS = {
    win: 35,
    loss: 10,
    draw: 20
  };

  function rewardForGame(result) {
    if (!Object.prototype.hasOwnProperty.call(
      REWARDS, result
    )) {
      return {
        success: false,
        error: "INVALID_RESULT"
      };
    }

    return addXP(
      REWARDS[result],
      "game_" + result
    );
  }

  /* =======================================================
     10. RANK LIST
  ======================================================= */

  function getAllRanks() {
    return RANKS.map(function (rank) {
      return { ...rank };
    });
  }

  /* =======================================================
     11. PUBLIC API
  ======================================================= */

  const api = {
    version: "1.0.0",

    config: { ...CONFIG },

    calculate: calculate,
    xpForLevel: xpForLevel,
    xpToNextLevel: xpToNextLevel,

    getProgress: getProgress,
    getOverview: getOverview,

    getRank: getRank,
    getNextRank: getNextRank,
    getAllRanks: getAllRanks,

    addXP: addXP,
    rewardForGame: rewardForGame
  };

  window.WFESCTRA_PROFILE_LEVELS = api;

  const core = window.WFESCTRA_PROFILE;

  if (core && typeof core.registerModule === "function") {
    core.registerModule("levels", api, 30);
  }

  console.info(
    "[WFESCTRA LEVELS] Module loaded."
  );

})(window, document);
