
/* ============================================================
 * OFESTRA PRO — PROFILE LEVELS
 * الملف: profile-levels.js
 *
 * المسؤولية:
 * - حساب خبرة اللاعب XP
 * - حساب المستوى والتقدم
 * - تجهيز إحصائيات اللاعب
 * - حساب نسبة الفوز والتعادل والخسارة
 * - عرض معلومات المستوى بشكل موحد
 *
 * يعتمد على:
 * - profile-core.js
 * ============================================================ */

(function () {

    'use strict';


    /* ========================================================
       01 — LEVEL CONFIGURATION
       ======================================================== */

    var LEVEL_CONFIG = {

        START_LEVEL: 1,

        START_XP: 0,

        FIRST_LEVEL_XP: 100,

        XP_GROWTH: 50,

        WIN_XP: 30,

        DRAW_XP: 15,

        LOSS_XP: 5,

        MAX_LEVEL: 1000

    };


    /* ========================================================
       02 — SAFE NUMBER
       ======================================================== */

    function number(value) {

        var result = Number(value);

        return Number.isFinite(result) && result >= 0
            ? result
            : 0;

    }


    /* ========================================================
       03 — PLAYER STATS
       ======================================================== */

    function getStats(player) {

        player = player || PF;

        var wins = number(player.w);

        var losses = number(player.l);

        var draws = number(player.d);

        var played = number(player.played);


        /*
         * إذا لم تكن قيمة played محفوظة بصورة صحيحة،
         * نحسبها من النتائج.
         */

        if (played < wins + losses + draws) {

            played = wins + losses + draws;

        }


        var winRate = played > 0
            ? (wins / played) * 100
            : 0;

        var drawRate = played > 0
            ? (draws / played) * 100
            : 0;

        var lossRate = played > 0
            ? (losses / played) * 100
            : 0;


        return {

            wins: wins,

            losses: losses,

            draws: draws,

            played: played,

            minutes: number(player.mins),

            winRate: Number(winRate.toFixed(1)),

            drawRate: Number(drawRate.toFixed(1)),

            lossRate: Number(lossRate.toFixed(1))

        };

    }


    /* ========================================================
       04 — XP REQUIRED FOR LEVEL
       ======================================================== */

    function xpForLevel(level) {

        level = Math.max(
            LEVEL_CONFIG.START_LEVEL,
            Math.floor(number(level))
        );


        /*
         * XP المطلوب للانتقال من المستوى الحالي
         * إلى المستوى التالي.
         */

        return (
            LEVEL_CONFIG.FIRST_LEVEL_XP +
            ((level - 1) * LEVEL_CONFIG.XP_GROWTH)
        );

    }


    /* ========================================================
       05 — XP FROM MATCH
       ======================================================== */

    function xpForResult(result) {

        result = String(result || '').toLowerCase();


        if (
            result === 'win' ||
            result === 'winner' ||
            result === 'won'
        ) {

            return LEVEL_CONFIG.WIN_XP;

        }


        if (
            result === 'draw' ||
            result === 'tie'
        ) {

            return LEVEL_CONFIG.DRAW_XP;

        }


        if (
            result === 'loss' ||
            result === 'lose' ||
            result === 'lost'
        ) {

            return LEVEL_CONFIG.LOSS_XP;

        }


        return 0;

    }


    /* ========================================================
       06 — XP PROGRESS
       ======================================================== */

    function getProgress(totalXP) {

        var xp = number(totalXP);

        var level = LEVEL_CONFIG.START_LEVEL;

        var remaining = xp;

        var required = xpForLevel(level);


        while (
            remaining >= required &&
            level < LEVEL_CONFIG.MAX_LEVEL
        ) {

            remaining -= required;

            level++;

            required = xpForLevel(level);

        }


        var percentage = level >= LEVEL_CONFIG.MAX_LEVEL
            ? 100
            : (remaining / required) * 100;


        return {

            level: level,

            xp: xp,

            currentXP: remaining,

            requiredXP: required,

            nextLevelXP: required - remaining,

            percentage: Number(
                Math.max(
                    0,
                    Math.min(100, percentage)
                ).toFixed(1)
            ),

            isMaxLevel:
                level >= LEVEL_CONFIG.MAX_LEVEL

        };

    }


    /* ========================================================
       07 — PLAYER EXPERIENCE
       ======================================================== */

    function getPlayerXP(player) {

        player = player || PF;

        return number(
            player.xp !== undefined
                ? player.xp
                : player.experience
        );

    }


    /* ========================================================
       08 — BUILD PROFILE LEVEL DATA
       ======================================================== */

    function getLevelData(player) {

        player = player || PF;

        var xp = getPlayerXP(player);

        var progress = getProgress(xp);

        var stats = getStats(player);


        return {

            level: progress.level,

            xp: progress.xp,

            currentXP: progress.currentXP,

            requiredXP: progress.requiredXP,

            nextLevelXP: progress.nextLevelXP,

            percentage: progress.percentage,

            isMaxLevel: progress.isMaxLevel,

            stats: stats

        };

    }


    /* ========================================================
       09 — APPLY MATCH RESULT
       ======================================================== */

    function applyMatchResult(result, player) {

        player = player || PF;

        if (!player || typeof player !== 'object') {

            throw new Error(
                'بيانات اللاعب غير متاحة.'
            );

        }


        var xpGain = xpForResult(result);


        if (!xpGain) {

            throw new Error(
                'نتيجة المباراة غير معروفة.'
            );

        }


        var normalized = String(
            result
        ).toLowerCase();


        if (
            normalized === 'win' ||
            normalized === 'winner' ||
            normalized === 'won'
        ) {

            player.w = number(player.w) + 1;

        } else if (
            normalized === 'draw' ||
            normalized === 'tie'
        ) {

            player.d = number(player.d) + 1;

        } else {

            player.l = number(player.l) + 1;

        }


        player.played = number(player.played) + 1;

        player.xp = getPlayerXP(player) + xpGain;


        return {

            xpGained: xpGain,

            totalXP: player.xp,

            levelData: getLevelData(player)

        };

    }


    /* ========================================================
       10 — FORMATTERS
       ======================================================== */

    function formatNumber(value) {

        return number(value).toLocaleString('en-US');

    }


    function formatPercentage(value) {

        return number(value).toFixed(1) + '%';

    }


    function formatPlayTime(minutes) {

        minutes = Math.floor(number(minutes));

        var hours = Math.floor(minutes / 60);

        var remaining = minutes % 60;


        if (hours <= 0) {

            return remaining + ' دقيقة';

        }

        if (remaining <= 0) {

            return hours + ' ساعة';

        }

        return hours + ' ساعة و' + remaining + ' دقيقة';

    }


    /* ========================================================
       11 — PUBLIC API
       ======================================================== */

    var LEVELS = {

        config: LEVEL_CONFIG,

        getStats: getStats,

        xpForLevel: xpForLevel,

        xpForResult: xpForResult,

        getProgress: getProgress,

        getPlayerXP: getPlayerXP,

        getLevelData: getLevelData,

        applyMatchResult: applyMatchResult,

        formatNumber: formatNumber,

        formatPercentage: formatPercentage,

        formatPlayTime: formatPlayTime

    };


    /* ========================================================
       12 — REGISTER
       ======================================================== */

    window.OFESTRA_PROFILE_LEVELS = LEVELS;


    console.log(
        '[OFESTRA] Profile Levels Ready'
    );


})();

