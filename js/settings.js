/* ============================================================
 * settings.js
 * الإعدادات: الألوان، الثيمات، الصوت/الاهتزاز، قائمة المحظورين
 * يعتمد على: core.js, storage.js, audio.js, friends.js (uItem)
 * ============================================================ */

var CL = {
  blue: ['أزرق', '#3b82f6'],
  red: ['أحمر', '#e63946'],
  orange: ['برتقالي', '#f08a24'],
  purple: ['بنفسجي', '#8e5cf0'],
  teal: ['تيركوازي', '#14b8a6'],
  pink: ['وردي', '#ec4899'],
  slate: ['فضي', '#94a3b8']
};

function ensureDistinctColors(){
  if(S.cMe === S.cOp){
    var keys = Object.keys(CL);
    for(var i=0; i<keys.length; i++){
      if(keys[i] !== S.cMe){ S.cOp = keys[i]; break; }
    }
  }
}

function paint(){
  ensureDistinctColors();
  var a = CL[S.cMe][1], b = CL[S.cOp][1], r = document.documentElement.style;
  if(mode === 'online' && myRole === 'B'){
    var _t = a; a = b; b = _t;
  }
  r.setProperty('--c1', a); r.setProperty('--c2', b);
  document.body.classList.toggle('enh', !!S.enh);
}

function setAnimTheme(n){
  S.animTheme = n; saveS();
  [1,2,3].forEach(function(i){ document.body.classList.remove('theme-' + i); });
  document.body.classList.add('theme-' + n);
}

function renderSettingsRows(){
  var ROWS = [
    ['enh', 'الأنيميشن المعزز (120fps)', 'حركات فائقة السرعة والنعومة'],
    ['snd', 'المؤثرات الصوتية', 'أصوات مريحة وناعمة وملحمية'],
    ['vib', 'تفعيل الاهتزاز', 'تشغيل محرك الاهتزاز عند الحركة والتوجيه']
  ];
  
  var html = ROWS.map(function(r){
    var isSnd = (r[0] === 'snd');
    var extraSlider = isSnd ? 
      '<div id="volSliderWrap" style="display:' + (S.snd ? 'block' : 'none') + ';margin-top:8px">' +
        '<small style="color:var(--gold)">مستوى صوت المؤثرات الصوتية (' + Math.round((S.sfxVol!==undefined?S.sfxVol:1.0)*100) + '%)</small>' +
        '<div class="slider-container"><input type="range" class="vol-slider" id="volSlider" min="0" max="1" step="0.05" value="' + (S.sfxVol!==undefined?S.sfxVol:1.0) + '"></div>' +
      '</div>' : '';
      
    return '<div class="row" style="flex-direction:column;align-items:stretch"> <div style="display:flex;align-items:center"><div>' + r[1] + '<small>' + r[2] + '</small></div><button class="sw' + (S[r[0]] ? ' on' : '') + '" data-k="' + r[0] + '"></button></div>' + extraSlider + '</div>';
  }).join('');
  
  html += '<div class="cr row"><div><b>شكل وأنيميشن الواجهة (3 أنماط احترافية)</b><div class="cs" id="animThemeSelector" style="justify-content:flex-start;gap:10px;margin-top:8px">' +
  '<button style="width:40px;height:40px;background:var(--card);border:2px solid var(--gold);color:var(--gold);font-weight:800;border-radius:10px;" onclick="setAnimTheme(1);X.sw();">1</button>' +
  '<button style="width:40px;height:40px;background:var(--card);border:2px solid var(--gold);color:var(--gold);font-weight:800;border-radius:10px;" onclick="setAnimTheme(2);X.sw();">2</button>' +
  '<button style="width:40px;height:40px;background:var(--card);border:2px solid var(--gold);color:var(--gold);font-weight:800;border-radius:10px;" onclick="setAnimTheme(3);X.sw();">3</button>' +
  '</div></div></div>';
  
  $('rows').innerHTML = html;
  
  document.querySelectorAll('.sw').forEach(function(b){
    b.onclick = function(){
      var k = b.getAttribute('data-k'); S[k] = S[k] ? 0 : 1;
      b.classList.toggle('on', !!S[k]);
      if(k === 'snd'){
        var wrap = $('volSliderWrap');
        if(wrap) wrap.style.display = S.snd ? 'block' : 'none';
      }
      saveS(); paint(); X.sw();
    };
  });
  
  var vSlider = $('volSlider');
  if(vSlider){
    vSlider.oninput = function(){
      S.sfxVol = parseFloat(vSlider.value);
      saveS();
      var txt = vSlider.parentNode.previousElementSibling;
      if(txt) txt.textContent = 'مستوى صوت المؤثرات الصوتية (' + Math.round(S.sfxVol * 100) + '%)';
    };
  }
  renderBlocked(); /* كانت تُضاف بالتغليف في آخر الملف الأصلي */
}

function swatches(id, key, othKey){
  var el = $(id); el.innerHTML = '';
  Object.keys(CL).forEach(function(c){
    var b = document.createElement('button');
    b.style.background = CL[c][1]; b.title = CL[c][0];
    b.className = S[key] === c ? 'on' : '';
    if(key === 'cOp' && c === S.cMe){ b.disabled = true; b.style.opacity = '0.2'; }
    if(key === 'cMe' && c === S.cOp){ b.disabled = true; b.style.opacity = '0.2'; }
    b.onclick = function(){
      if(key === 'cMe' && c === S.cOp) return;
      if(key === 'cOp' && c === S.cMe) return;
      S[key] = c; saveS(); paint(); X.sw(); colors();
    };
    el.appendChild(b);
  });
}

function colors(){ swatches('cMe', 'cMe', 'cOp'); swatches('cOp', 'cOp', 'cMe'); }

function renderBlocked(){
  var d = document.createElement('div'); d.className = 'cr'; var h = document.createElement('b'); h.textContent = 'المستخدمون المحظورون'; d.appendChild(h);
  var ids = Object.keys(BLOCKED);
  if(!ids.length){ var s = document.createElement('div'); s.className = 'nt'; s.textContent = 'لا يوجد مستخدمون محظورون.'; d.appendChild(s); }
  ids.forEach(function(id){
    d.appendChild(uItem(id, typeof BLOCKED[id] === 'string' ? BLOCKED[id] : 'مستخدم', 'محظور', [['فك الحظر', function(){
      delete BLOCKED[id]; saveBlocked(); renderSettingsRows(); showToastNotification('تم فك الحظر، تقدر تلعب وياه الآن');
    }]], null, false));
  });
  stag(d); $('rows').appendChild(d);
}

/* ربط نافذة الإعدادات + ضمان اختلاف لوني اللاعبين */
function initSettings(){
  ensureDistinctColors();
  $('bSet').onclick = function(){ cx(); renderSettingsRows(); $('sheet').classList.add('on'); document.body.classList.add('so'); colors(); X.ui(); };
  $('xS').onclick = function(){ $('sheet').classList.remove('on'); document.body.classList.remove('so'); X.sw(); };
  $('bkS').onclick = function(){ $('sheet').classList.remove('on'); document.body.classList.remove('so'); X.sw(); };
}
