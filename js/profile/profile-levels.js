
/* =========================================================
   WFESCTRA — PROFILE LEVELS
   XP / Levels / Statistics / Achievements
   Version: 1.0.0
   Authority: SERVER ONLY
   ========================================================= */

(() => {
  'use strict';

  if (window.WFESCTRA_PROFILE_LEVELS) {
    console.warn('[WFESCTRA] Profile Levels already initialized.');
    return;
  }

  const CORE = window.WFESCTRA_PROFILE_CORE;
  const DATA = window.WFESCTRA_PROFILE_DATA;
  const SERVER = window.WFESCTRA_PROFILE_SERVER;
  const AUTH = window.WFESCTRA_PROFILE_AUTH;

  if (!CORE || !DATA || !SERVER || !AUTH) {
    console.error(
      '[WFESCTRA] Profile Levels requires Core, Data, Server and Auth.'
    );
    return;
  }

  const CONFIG = Object.freeze({
    STATS_PATH: (SERVER.endpoints && SERVER.endpoints.stats) || '/profile/stats',
    ACHIEVEMENTS_PATH: (SERVER.endpoints && SERVER.endpoints.achievements) || '/profile/achievements',
    MATCH_RESULT_PATH: (SERVER.endpoints && SERVER.endpoints.matchResult) || '/games/result',

    /*
     * لا نعتمد على حساب XP من المتصفح.
     * السيرفر هو الذي يحسبه ويعتمده.
     */
    SERVER_AUTHORITATIVE: true,

    EVENTS: {
      STATS_UPDATED: 'wfesctra:stats-updated',
      LEVEL_UP: 'wfesctra:level-up',
      ACHIEVEMENTS_UPDATED: 'wfesctra:achievements-updated',
      MATCH_SUBMITTED: 'wfesctra:match-submitted'
    }
  });

  const state = {
    loading: false,
    submitting: false,

    stats: null,
    achievements: [],

    lastError: null,
    lastSync: null
  };

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

  function requireLogin() {
    if (!AUTH.isLoggedIn()) {
      throw new Error('يجب تسجيل الدخول أولاً.');
    }
  }

  function errorMessage(error) {
    return SERVER.getErrorMessage
      ? SERVER.getErrorMessage(error)
      : error?.message || 'تعذر إكمال العملية.';
  }

  function extractPayload(response) {
    if (!response || typeof response !== 'object') {
      throw new Error('استجابة السيرفر غير صالحة.');
    }

    return (
      response.data ||
      response.result ||
      response
    );
  }

  function normalizeStats(raw) {
    if (!raw || typeof raw !== 'object') {
      throw new Error('بيانات الإحصائيات غير صالحة.');
    }

    const number = value => {
      const parsed = Number(value);
      return Number.isFinite(parsed) && parsed >= 0
        ? parsed
        : 0;
    };

    return {
      games: number(raw.games),
      wins: number(raw.wins),
      losses: number(raw.losses),
      draws: number(raw.draws),

      win_rate: number(raw.win_rate),
      total_score: number(raw.total_score),

      xp: number(raw.xp),
      level: Math.max(1, number(raw.level) || 1),
      next_level_xp: number(raw.next_level_xp),

      updated_at: raw.updated_at || null
    };
  }

  function normalizeAchievements(raw) {
    if (!Array.isArray(raw)) return [];

    return raw
      .filter(item => item && typeof item === 'object')
      .map(item => ({
        id: String(item.id || ''),
        title: String(item.title || ''),
        description: String(item.description || ''),
        icon: String(item.icon || '🏆'),
        unlocked: Boolean(item.unlocked),
        unlocked_at: item.unlocked_at || null,
        progress: Math.max(0, Number(item.progress) || 0),
        target: Math.max(0, Number(item.target) || 0)
      }));
  }

  /* =======================================================
     FETCH STATISTICS
     ======================================================= */

  async function fetchStats() {
    requireLogin();

    state.loading = true;
    state.lastError = null;

    try {
      const response = await SERVER.get(CONFIG.STATS_PATH);
      const payload = extractPayload(response);

      const rawStats = payload.stats || payload;

      state.stats = normalizeStats(rawStats);

      /*
       * مزامنة الإحصائيات في ذاكرة البروفايل فقط.
       */

      CORE.setProfile({
        stats: {
          games: state.stats.games,
          wins: state.stats.wins,
          losses: state.stats.losses,
          draws: state.stats.draws,
          win_rate: state.stats.win_rate,
          total_score: state.stats.total_score
        },

        xp: state.stats.xp,
        level: state.stats.level,
        next_level_xp: state.stats.next_level_xp
      }, {
        authenticated: true,
        source: 'server-stats'
      });

      state.lastSync = Date.now();

      emit(CONFIG.EVENTS.STATS_UPDATED, {
        stats: clone(state.stats)
      });

      return clone(state.stats);
    } catch (error) {
      state.lastError = error;
      throw error;
    } finally {
      state.loading = false;
    }
  }

  /* =======================================================
     FETCH ACHIEVEMENTS
     ======================================================= */

  async function fetchAchievements() {
    requireLogin();

    try {
      const response = await SERVER.get(
        CONFIG.ACHIEVEMENTS_PATH
      );

      const payload = extractPayload(response);

      state.achievements = normalizeAchievements(
        payload.achievements || payload.items || []
      );

      CORE.setProfile({
        achievements: clone(state.achievements)
      }, {
        authenticated: true,
        source: 'server-achievements'
      });

      emit(CONFIG.EVENTS.ACHIEVEMENTS_UPDATED, {
        achievements: clone(state.achievements)
      });

      return clone(state.achievements);
    } catch (error) {
      state.lastError = error;
      throw error;
    }
  }

  /* =======================================================
     SUBMIT MATCH RESULT
     ======================================================= */

  async function submitMatchResult(result) {
    requireLogin();

    if (state.submitting) {
      throw new Error('توجد نتيجة مباراة قيد الإرسال.');
    }

    if (!result || typeof result !== 'object') {
      throw new Error('بيانات المباراة غير صالحة.');
    }

    /*
     * نرسل الحد الأدنى من معلومات النتيجة.
     * السيرفر يجب أن يتحقق من المباراة واللاعب والنتيجة.
     *
     * لا نرسل XP أو level أو المكافآت من العميل.
     */

    const payload = {
      match_id: String(result.match_id || ''),
      game_mode: String(result.game_mode || 'unknown'),
      opponent_type: String(result.opponent_type || 'unknown'),
      outcome: String(result.outcome || ''),
      duration_seconds: Math.max(
        0,
        Math.floor(Number(result.duration_seconds) || 0)
      )
    };

    if (!payload.match_id) {
      throw new Error('معرّف المباراة مطلوب.');
    }

    if (!['win', 'loss', 'draw'].includes(payload.outcome)) {
      throw new Error('نتيجة المباراة غير صحيحة.');
    }

    state.submitting = true;
    state.lastError = null;

    try {
      const response = await SERVER.post(
        CONFIG.MATCH_RESULT_PATH,
        payload
      );

      const data = extractPayload(response);

      /*
       * لا نقبل القيم التي يحسبها العميل.
       * نقرأ القيم المعتمدة التي يرجعها السيرفر.
       */

      const previousLevel = Number(CORE.get('level', 1));

      if (data.stats) {
        state.stats = normalizeStats(data.stats);

        CORE.setProfile({
          stats: {
            games: state.stats.games,
            wins: state.stats.wins,
            losses: state.stats.losses,
            draws: state.stats.draws,
            win_rate: state.stats.win_rate,
            total_score: state.stats.total_score
          },

          xp: state.stats.xp,
          level: state.stats.level,
          next_level_xp: state.stats.next_level_xp
        }, {
          authenticated: true,
          source: 'match-result'
        });

        if (state.stats.level > previousLevel) {
          emit(CONFIG.EVENTS.LEVEL_UP, {
            previousLevel,
            newLevel: state.stats.level
          });
        }
      } else {
        /*
         * إذا لم يرجع السيرفر الإحصائيات،
         * نعيد جلبها بدلاً من التخمين.
         */
        await fetchStats();
      }

      if (data.achievements) {
        state.achievements = normalizeAchievements(
          data.achievements
        );

        CORE.setProfile({
          achievements: clone(state.achievements)
        }, {
          authenticated: true,
          source: 'match-achievements'
        });
      } else {
        await fetchAchievements();
      }

      emit(CONFIG.EVENTS.MATCH_SUBMITTED, {
        result: data,
        stats: state.stats
      });

      return data;
    } catch (error) {
      state.lastError = error;
      throw error;
    } finally {
      state.submitting = false;
    }
  }

  /* =======================================================
     DISPLAY HELPERS
     ======================================================= */

  function getStats() {
    return state.stats ? clone(state.stats) : null;
  }

  function getAchievements() {
    return clone(state.achievements);
  }

  function getUnlockedAchievements() {
    return state.achievements.filter(item => item.unlocked);
  }

  function getProgress() {
    if (!state.stats) return null;

    const currentXP = state.stats.xp;
    const nextXP = state.stats.next_level_xp;

    return {
      level: state.stats.level,
      xp: currentXP,
      next_level_xp: nextXP,

      percentage: nextXP > 0
        ? Math.min(100, Math.round((currentXP / nextXP) * 100))
        : 0
    };
  }

  /* =======================================================
     SESSION CLEANUP
     ======================================================= */

  window.addEventListener(
    'wfesctra:auth-change',
    event => {
      if (event.detail?.user) return;

      state.stats = null;
      state.achievements = [];
      state.lastSync = null;
      state.lastError = null;
    }
  );

  /* =======================================================
     PUBLIC API
     ======================================================= */

  const API = {
    config: CONFIG,
    state,

    fetchStats,
    fetchAchievements,

    refresh: async () => {
      requireLogin();

      const [stats, achievements] = await Promise.all([
        fetchStats(),
        fetchAchievements()
      ]);

      return { stats, achievements };
    },

    submitMatchResult,

    getStats,
    getAchievements,
    getUnlockedAchievements,
    getProgress,

    isLoading: () => state.loading,
    isSubmitting: () => state.submitting,

    getError: () => state.lastError
      ? errorMessage(state.lastError)
      : null
  };

  window.WFESCTRA_PROFILE_LEVELS = API;

  console.log('[WFESCTRA] Profile Levels initialized.');

})();
