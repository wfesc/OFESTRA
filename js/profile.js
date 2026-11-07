/* ============================================================
 * profile.js
 * الملف الشخصي: الإحصائيات، المستوى واللقب، الأفاتار، تغيير الاسم، بطاقة التعريف
 * يعتمد على: core.js, storage.js, audio.js, online.js (publishDir)
 * ============================================================ */

function renderProf(){
  $('pfName').value = PF.name;

  var leftMs = 3600000 - (Date.now() - (PF.lastNamed||0));

  if(leftMs > 0){
    var mins = Math.ceil(leftMs/60000);
    $('nameChangeNotice').textContent = 'متبقي ' + mins + ' دقيقة لتغيير الاسم مجدداً.';
    $('pfName').disabled = true;
  } else {
    $('nameChangeNotice').textContent = '';
    $('pfName').disabled = false;
  }

  var rate = (PF.w + PF.l) ? Math.round(PF.w * 100 / (PF.w + PF.l)) : 0;

  var it = [
    ['مباريات', PF.played],
    ['فوز', PF.w],
    ['خسارة', PF.l],
    ['نسبة الفوز', rate + '%']
  ];

  $('pfStats').innerHTML = it.map(function(x){
    return '<div class="st"><b>' + x[1] + '</b><small>' + x[0] + '</small></div>';
  }).join('');

  decorProf();
}

function openProf(){
  renderProf();
  $('prof').classList.add('on');
  document.body.classList.add('so');
  X.ui();
}

function closeProf(){
  $('prof').classList.remove('on');
  document.body.classList.remove('so');
  X.sw();
}

function calcLv(P){
  P = P || PF;

  var pl = P.played || 0;
  var rate = pl ? (P.w || 0) / pl : 0;

  var pts =
    (P.w || 0) * 30 +
    (P.d || 0) * 12 +
    (P.l || 0) * 8 +
    Math.floor((P.mins || 0) / 2) +
    Math.round(rate * Math.min(pl, 50) * 4);

  var lv = Math.min(99, 1 + Math.floor(Math.sqrt(pts / 40)));

  var cur = 40 * (lv - 1) * (lv - 1);
  var nx = 40 * lv * lv;

  return {
    lv: lv,
    pct: Math.max(0, Math.min(100, Math.round((pts - cur) / (nx - cur) * 100)))
  };
}

function titleOf(l){
  return l >= 22 ? 'أسطورة' :
         l >= 15 ? 'خبير' :
         l >= 10 ? 'محترف' :
         l >= 6 ? 'ماهر' :
         l >= 3 ? 'هاوي' : 'مبتدئ';
}

function myInfo(){
  var pl = PF.played || 0;

  return {
    av: PF.av,
    lv: calcLv().lv,
    wr: pl ? Math.round((PF.w || 0) * 100 / pl) : 0,
    pl: pl
  };
}

function cleanInfo(o){
  return {
    av: (Number.isInteger(o.av) && o.av >= 0 && o.av < AV.length) ? o.av : 0,
    lv: Math.max(1, Math.min(99, parseInt(o.lv) || 1)),
    wr: Math.max(0, Math.min(100, parseInt(o.wr) || 0)),
    pl: Math.max(0, Math.min(99999, parseInt(o.pl) || 0))
  };
}

function infoOf(u){
  var x = ONLINE_PLAYERS[u] || SEEN[u];

  return x && x.info
    ? x.info
    : { av: 0, lv: 1, wr: 0, pl: 0 };
}

function decorProf(){
  var c = calcLv();
  var pl = PF.played || 0;

  $('pfCard').innerHTML =
    '<div class="lvcard">' +
      '<div class="avbig">' + AV[PF.av] + '</div>' +
      '<div class="lvinfo">' +
        '<b>' + titleOf(c.lv) + ' • المستوى ' + c.lv + '</b>' +
        '<small>نسبة الفوز ' +
        (pl ? Math.round(PF.w * 100 / pl) : 0) +
        '% • تواجد ' + (PF.mins || 0) + ' دقيقة</small>' +
        '<div class="lvbar"><i style="width:' + c.pct + '%"></i></div>' +
      '</div>' +
    '</div>';

  var g = $('avGrid');
  g.textContent = '';

  AV.forEach(function(e, i){
    var b = document.createElement('button');

    b.textContent = e;
    b.className = i === PF.av ? 'on' : '';

    b.onclick = function(){
      PF.av = i;
      savePF();
      X.sw();
      decorProf();
      refresh();
      publishDir();
    };

    g.appendChild(b);
  });
}

/* ربط أزرار الملف الشخصي + عدّاد دقائق التواجد */

function initProfile(){

  $('xP').onclick = closeProf;
  $('bkP').onclick = closeProf;

  $('pfName').onchange = function(){

    var now = Date.now();

    if(now - (PF.lastNamed || 0) < 3600000){
      showToastNotification('عذراً، لا يمكنك تغيير اسمك إلا بعد مرور ساعة كاملة!');
      renderProf();
      return;
    }

    var v = $('pfName').value.trim().slice(0, 14);

    if(v){
      PF.name = v;
      PF.lastNamed = now;
      savePF();
      publishDir();
    }

    renderProf();
  };

  $('pfReset').onclick = function(){

    showToastNotification('مسح الإحصائيات بالكامل؟', function(){

      PF.played = PF.w = PF.l = PF.d = 0;

      savePF();
      renderProf();

    });

  };

  setInterval(function(){

    if(!document.hidden){
      PF.mins = (PF.mins || 0) + 1;
      savePF();
    }

  }, 60000);

}

/* أول تشغيل: افتح الملف الشخصي مرة وحدة */

function firstRunProfile(){

  if(!PF.seen){
    PF.seen = 1;
    savePF();
    setTimeout(openProf, 600);
  }

}
