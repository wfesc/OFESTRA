
/* ============================================================
 * OFESTRA PRO — SETTINGS.JS
 * WFESC ENGINE
 * SETTINGS / THEMES / COLORS / AUDIO / BLOCKED USERS
 * PROFILE MOTION INTEGRATION
 * ============================================================ */


/* ============================================================
   01 — COLOR PALETTE
   ============================================================ */

var CL = {
  blue: ['أزرق', '#3b82f6'],
  red: ['أحمر', '#e63946'],
  orange: ['برتقالي', '#f08a24'],
  purple: ['بنفسجي', '#8e5cf0'],
  teal: ['تيركوازي', '#14b8a6'],
  pink: ['وردي', '#ec4899'],
  slate: ['فضي', '#94a3b8']
};


/* ============================================================
   02 — PROFILE ANIMATION BRIDGE
   يربط S.enh مع نظام حركة البروفايل.
   ============================================================ */

function notifyProfileSettings(){

  var motion = S.enh
    ? 'enhanced'
    : 'classic';

  window.OFESTRA_SETTINGS = Object.assign(
    {},
    window.OFESTRA_SETTINGS || {},
    {
      animationMode: motion,
      motionMode: motion
    }
  );

  window.dispatchEvent(
    new CustomEvent('ofestra:settings-change', {
      detail: {
        animationMode: motion,
        motionMode: motion
      }
    })
  );

}


/* ============================================================
   03 — COLOR VALIDATION
   ============================================================ */

function ensureDistinctColors(){

  if(S.cMe === S.cOp){

    var keys = Object.keys(CL);

    for(var i = 0; i < keys.length; i++){

      if(keys[i] !== S.cMe){

        S.cOp = keys[i];

        break;

      }

    }

  }

}


/* ============================================================
   04 — APPLY SETTINGS
   ============================================================ */

function paint(){

  ensureDistinctColors();

  var a = CL[S.cMe][1];
  var b = CL[S.cOp][1];

  var r = document.documentElement.style;

  if(mode === 'online' && myRole === 'B'){

    var temp = a;

    a = b;

    b = temp;

  }

  r.setProperty('--c1', a);
  r.setProperty('--c2', b);

  document.body.classList.toggle(
    'enh',
    !!S.enh
  );

  notifyProfileSettings();

}


/* ============================================================
   05 — ANIMATION THEMES
   ============================================================ */

function setAnimTheme(n){

  n = Number(n);

  if(!Number.isInteger(n) || n < 1 || n > 3){

    return;

  }

  S.animTheme = n;

  saveS();

  [1, 2, 3].forEach(function(i){

    document.body.classList.remove(
      'theme-' + i
    );

  });

  document.body.classList.add(
    'theme-' + n
  );

  X.sw();

}


/* ============================================================
   06 — SETTINGS ROWS
   ============================================================ */

function renderSettingsRows(){

  var ROWS = [

    [
      'enh',
      'الأنيميشن المعزز',
      'حركات وتأثيرات واجهة أكثر سلاسة'
    ],

    [
      'snd',
      'المؤثرات الصوتية',
      'أصوات مريحة وناعمة وملحمية'
    ],

    [
      'vib',
      'تفعيل الاهتزاز',
      'تشغيل محرك الاهتزاز عند الحركة والتوجيه'
    ]

  ];


  var html = ROWS.map(function(r){

    var isSnd = r[0] === 'snd';

    var extraSlider = isSnd

      ?

      '<div id="volSliderWrap" style="display:' +
      (S.snd ? 'block' : 'none') +
      ';margin-top:8px">' +

        '<small style="color:var(--gold)">' +

          'مستوى صوت المؤثرات الصوتية (' +

          Math.round(
            (S.sfxVol !== undefined ? S.sfxVol : 1) * 100
          ) +

          '%)' +

        '</small>' +

        '<div class="slider-container">' +

          '<input type="range" class="vol-slider" ' +
          'id="volSlider" min="0" max="1" step="0.05" value="' +

          (S.sfxVol !== undefined ? S.sfxVol : 1) +

          '">' +

        '</div>' +

      '</div>'

      : '';


    return (

      '<div class="row" style="flex-direction:column;align-items:stretch">' +

        '<div style="display:flex;align-items:center">' +

          '<div>' +

            r[1] +

            '<small>' + r[2] + '</small>' +

          '</div>' +

          '<button class="sw' +

            (S[r[0]] ? ' on' : '') +

            '" data-k="' + r[0] + '">' +

          '</button>' +

        '</div>' +

        extraSlider +

      '</div>'

    );

  }).join('');


  /* ANIMATION THEME SELECTOR */

  html +=

    '<div class="cr row">' +

      '<div>' +

        '<b>شكل وأنيميشن الواجهة (3 أنماط احترافية)</b>' +

        '<div class="cs" id="animThemeSelector" ' +

          'style="justify-content:flex-start;gap:10px;margin-top:8px">' +

          [1, 2, 3].map(function(n){

            var active = Number(S.animTheme || 1) === n;

            return (

              '<button type="button" ' +

                'style="width:40px;height:40px;' +

                'background:var(--card);' +

                'border:2px solid ' +

                (active ? 'var(--gold)' : 'var(--border, #555)') +

                ';color:var(--gold);font-weight:800;border-radius:10px;" ' +

                'onclick="setAnimTheme(' + n + ')">' +

                n +

              '</button>'

            );

          }).join('') +

        '</div>' +

      '</div>' +

    '</div>';


  $('rows').innerHTML = html;


  /* SETTINGS SWITCHES */

  document.querySelectorAll('.sw').forEach(function(b){

    b.onclick = function(){

      var k = b.getAttribute('data-k');

      S[k] = S[k] ? 0 : 1;

      b.classList.toggle(
        'on',
        !!S[k]
      );

      if(k === 'snd'){

        var wrap = $('volSliderWrap');

        if(wrap){

          wrap.style.display = S.snd
            ? 'block'
            : 'none';

        }

      }

      saveS();

      paint();

      X.sw();

    };

  });


  /* SOUND VOLUME */

  var vSlider = $('volSlider');

  if(vSlider){

    vSlider.oninput = function(){

      S.sfxVol = parseFloat(vSlider.value);

      saveS();

      var txt = vSlider.parentNode.previousElementSibling;

      if(txt){

        txt.textContent =

          'مستوى صوت المؤثرات الصوتية (' +

          Math.round(S.sfxVol * 100) +

          '%)';

      }

    };

  }


  renderBlocked();

}


/* ============================================================
   07 — COLOR SWATCHES
   ============================================================ */

function swatches(id, key, othKey){

  var el = $(id);

  if(!el) return;

  el.innerHTML = '';

  Object.keys(CL).forEach(function(c){

    var b = document.createElement('button');

    b.style.background = CL[c][1];

    b.title = CL[c][0];

    b.className = S[key] === c
      ? 'on'
      : '';

    if(key === 'cOp' && c === S.cMe){

      b.disabled = true;

      b.style.opacity = '0.2';

    }

    if(key === 'cMe' && c === S.cOp){

      b.disabled = true;

      b.style.opacity = '0.2';

    }

    b.onclick = function(){

      if(key === 'cMe' && c === S.cOp) return;

      if(key === 'cOp' && c === S.cMe) return;

      S[key] = c;

      saveS();

      paint();

      X.sw();

      colors();

    };

    el.appendChild(b);

  });

}


/* ============================================================
   08 — COLORS
   ============================================================ */

function colors(){

  swatches('cMe', 'cMe', 'cOp');

  swatches('cOp', 'cOp', 'cMe');

}


/* ============================================================
   09 — BLOCKED USERS
   ============================================================ */

function renderBlocked(){

  var d = document.createElement('div');

  d.className = 'cr';

  var h = document.createElement('b');

  h.textContent = 'المستخدمون المحظورون';

  d.appendChild(h);


  var ids = Object.keys(BLOCKED);


  if(!ids.length){

    var s = document.createElement('div');

    s.className = 'nt';

    s.textContent = 'لا يوجد مستخدمون محظورون.';

    d.appendChild(s);

  }


  ids.forEach(function(id){

    d.appendChild(

      uItem(

        id,

        typeof BLOCKED[id] === 'string'
          ? BLOCKED[id]
          : 'مستخدم',

        'محظور',

        [

          [

            'فك الحظر',

            function(){

              delete BLOCKED[id];

              saveBlocked();

              renderSettingsRows();

              showToastNotification(
                'تم فك الحظر، تقدر تلعب وياه الآن'
              );

            }

          ]

        ],

        null,

        false

      )

    );

  });


  stag(d);

  $('rows').appendChild(d);

}


/* ============================================================
   10 — RESTORE ANIMATION THEME
   ============================================================ */

function restoreAnimTheme(){

  var n = Number(S.animTheme || 1);

  if(!Number.isInteger(n) || n < 1 || n > 3){

    n = 1;

    S.animTheme = 1;

  }

  [1, 2, 3].forEach(function(i){

    document.body.classList.remove(
      'theme-' + i
    );

  });

  document.body.classList.add(
    'theme-' + n
  );

}


/* ============================================================
   11 — INITIALIZE SETTINGS
   ============================================================ */

function initSettings(){

  ensureDistinctColors();

  restoreAnimTheme();

  /*
     تطبيق الإعدادات عند بدء اللعبة.
     هذا يزامن حركة البروفايل مع S.enh.
  */

  paint();


  /* OPEN SETTINGS */

  $('bSet').onclick = function(){

    cx();

    renderSettingsRows();

    $('sheet').classList.add('on');

    document.body.classList.add('so');

    colors();

    X.ui();

  };


  /* CLOSE SETTINGS */

  $('xS').onclick = function(){

    $('sheet').classList.remove('on');

    document.body.classList.remove('so');

    X.sw();

  };


  $('bkS').onclick = function(){

    $('sheet').classList.remove('on');

    document.body.classList.remove('so');

    X.sw();

  };

}


/* ============================================================
   12 — END OF SETTINGS ENGINE
   ============================================================ */
      
