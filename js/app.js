/* ===========================================================================
   منطق التجربة: التنقل بين الشاشات، تحديد النتيجة، ودورة الإيفنت.
   =========================================================================== */
(function () {
  'use strict';

  const stage = document.getElementById('stage');
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.prototype.slice.call((r || document).querySelectorAll(s));

  const state = { gender: 'm', persona: null };
  let current = null, idleTimer = null, loadTimer = null, loadToken = 0;
  const trail = [];                 /* سجلّ الخطوات عشان زر الرجوع */

  /* ------------------------- التنقل ------------------------- */
  /* الأسماء المنطقية للشاشات → عناصر الـDOM */
  function screenId(name) {
    if (name === 'q2' || name === 'q3') return 's-' + name + '-' + state.gender;
    return 's-' + name;
  }

  function show(name, viaBack) {
    const el = document.getElementById(screenId(name));
    if (!el || el === current) return;
    /* شاشة الانتقال مش خطوة يرجعلها المستخدم */
    if (!viaBack && current && current.dataset.step && current.dataset.step !== 'loading') {
      trail.push(current.dataset.step);
    }
    if (current) current.classList.remove('on');
    current = el;
    el.dataset.step = name;
    el.classList.add('on');
    paint(el);                      /* لون الشرائط فوق وتحت */
    resetIdle(name);
  }

  /* الشرائط اللي فوق وتحت المسرح تاخد لون خلفية الشاشة الحالية */
  function paint(el) {
    const cs = getComputedStyle(el);
    document.body.style.setProperty('--pad-top',    cs.getPropertyValue('--pad-top').trim()    || '#000');
    document.body.style.setProperty('--pad-bottom', cs.getPropertyValue('--pad-bottom').trim() || '#000');
  }

  function back() {
    clearTimeout(loadTimer); loadToken++;   /* لو رجع من شاشة الانتقال، ما تروحش للنتيجة */
    const prev = trail.pop();
    if (prev) show(prev, true); else reset();
  }

  function reset() {
    clearTimeout(loadTimer); loadToken++;
    trail.length = 0;
    state.gender = 'm';
    state.persona = null;
    show('landing');
  }

  /* ------------------- صفحة النتيجة ------------------- */
  /* بيحمّل صورة النتيجة ويستنّاها تخلص فك تشفير — عشان ما تظهرش
     الصورة القديمة لحظة ثم تتبدّل. بيرجّع Promise بتخلص دايماً. */
  function preloadPhoto(photo) {
    const im = new Image();
    im.src = 'assets/photos/' + photo + '.webp';
    return (im.decode ? im.decode() : Promise.resolve()).catch(() => {});
  }

  function showResult() {
    const p = PERSONAS[state.persona];
    const v = p[state.gender];
    const s = document.getElementById('s-result');

    const bg = $('.bg', s);
    /* الإطار الأول ثم المصدر — عشان الصورة ما تتعرضش بمقاس غلط للحظة */
    bg.style.cssText = v.bg
      ? 'left:' + v.bg[0] + 'px;top:' + v.bg[1] + 'px;' +
        'width:' + v.bg[2] + 'px;height:' + v.bg[3] + 'px;object-fit:fill'
      : '';
    bg.src = 'assets/photos/' + v.photo + '.webp';
    $('.name', s).innerHTML = v.name;
    $('.desc', s).innerHTML = v.desc;
    const badge = $('.badge', s);
    badge.textContent = p.flavor;
    badge.style.background = p.color;
    $('.cta', s).textContent = CTA[state.gender];
    s.style.setProperty('--dy', ((p.offset && p.offset[state.gender]) || 0) + 'px');
    if (v.pad) s.style.setProperty('--pad-top', v.pad);   /* الشريط العلوي بلون الصورة */

    show('result');
  }

  /* ------------------- شبكة النكهات ------------------- */
  function buildGrid() {
    const wrap = $('#s-grid .cards');
    wrap.innerHTML = FLAVORS.map(f => `
      <div class="card">
        <img src="assets/flavors/${f.img}.webp" alt="">
        <div class="en">${f.en}</div>
        <div class="note">${f.note}</div>
        <div class="int">
          <span class="dot">${f.intensity}</span>
          <span class="bar"><i style="width:${Math.round(f.intensity / 13 * 100)}%"></i></span>
        </div>
      </div>`).join('');
  }

  /* ---------------------- الضغط ---------------------- */
  /* الفعل نفسه على click — بيشتغل على أي متصفح ولمس أو ماوس.
     رد الفعل البصري على mouse/touch (Pointer Events مش موجودة في المتصفحات القديمة). */
  function pressStart(e) { const b = e.target.closest('.btn'); if (b) b.classList.add('down'); }
  function pressEnd()    { $$('.btn.down').forEach(function (x) { x.classList.remove('down'); }); }
  stage.addEventListener('mousedown',  pressStart);
  stage.addEventListener('touchstart', pressStart, { passive: true });
  stage.addEventListener('mouseup',    pressEnd);
  stage.addEventListener('touchend',   pressEnd);
  stage.addEventListener('touchcancel',pressEnd);

  stage.addEventListener('click', function (e) {
    const b = e.target.closest('.btn');
    if (!b) return;

    if (b.dataset.gender) state.gender = b.dataset.gender;

    if (b.dataset.persona) {                    /* السؤال الثالث يحدد الشخصية */
      state.persona = b.dataset.persona;
      show('loading');
      clearTimeout(loadTimer);
      /* الصورة بتتحمّل جوّه شاشة الانتقال — النتيجة ما تظهرش قبل ما تجهز */
      const token = ++loadToken;
      /* سقف زمني: لو الصورة اتأخرت لأي سبب، النتيجة تظهر برضه ما تعلّقش */
      const ready  = Promise.race([
        preloadPhoto(PERSONAS[state.persona][state.gender].photo),
        new Promise(function (r) { setTimeout(r, SETTINGS.PHOTO_WAIT_MS); })
      ]);
      const waited = new Promise(function (r) { loadTimer = setTimeout(r, SETTINGS.LOADING_MS); });
      Promise.all([ready, waited]).then(function () { if (token === loadToken) showResult(); });
      return;
    }
    if (b.dataset.back !== undefined)    { back();  return; }
    if (b.dataset.restart !== undefined) { reset(); return; }
    if (b.dataset.go) show(b.dataset.go);
  });

  /* ------------------ دورة الإيفنت ------------------ */
  function resetIdle(name) {
    clearTimeout(idleTimer);
    if (name === 'landing') return;             /* شاشة الهبوط تفضل مفتوحة */
    idleTimer = setTimeout(reset, SETTINGS.IDLE_MS);
  }
  ['mousedown', 'mousemove', 'touchstart', 'keydown'].forEach(function (ev) {
    window.addEventListener(ev, function () { if (current && current.id !== 's-landing') resetIdle(); }, { passive: true });
  });

  window.addEventListener('keydown', e => { if (e.key === 'Escape') reset(); });

  /* --------------- تحجيم المسرح --------------- */
  /* أجهزة العرض الرقمية بترجّع مقاسات صفر قبل أول رسم — لازم نتعامل مع ده،
     غير كده المقياس بيطلع رقم خيالي والشاشة تطلع لون واحد من غير محتوى. */
  var fitTries = 0;
  function viewport() {
    var de = document.documentElement, b = document.body;
    var w = de.clientWidth  || window.innerWidth  || (b && b.clientWidth)  || 0;
    var h = de.clientHeight || window.innerHeight || (b && b.clientHeight) || 0;
    /* آخر ملجأ: مقاس الشاشة نفسها */
    if (!w && window.screen) w = screen.width  || 0;
    if (!h && window.screen) h = screen.height || 0;
    return [w, h];
  }
  function fit() {
    var v = viewport(), w = v[0], h = v[1];
    if (!w || !h) {                       /* لسه مش جاهز — جرّب تاني */
      if (fitTries++ < 40) { setTimeout(fit, 100); return; }
      w = 1080; h = 1920;                 /* استسلمنا — اعرض المحتوى بدل شاشة فاضية */
    }
    var s = Math.min(w / 1080, h / 1920);
    if (!isFinite(s) || s <= 0) s = 1;
    s = Math.max(0.05, Math.min(s, 8));   /* حدود عاقلة تمنع أي رقم شاذ */
    var dx = Math.round((w - 1080 * s) / 2);
    var dy = Math.round((h - 1920 * s) / 2);
    stage.style.transform = 'translate(' + dx + 'px,' + dy + 'px) scale(' + s + ')';
    stage.style.visibility = 'visible';
  }
  addEventListener('resize', fit);
  addEventListener('orientationchange', function () { setTimeout(fit, 120); });
  addEventListener('load', function () { fitTries = 0; fit(); });
  if (window.visualViewport && window.visualViewport.addEventListener)
    window.visualViewport.addEventListener('resize', fit);

  /* ------------------- التشخيص على الشاشة ------------------- */
  /* لو حصل أي خطأ، اعرضه بخط كبير على الشاشة — الجهاز يقولنا المشكلة بنفسه */
  function diagBox() {
    let d = document.getElementById('diag');
    if (!d) {
      d = document.createElement('pre'); d.id = 'diag';
      d.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:99999;margin:0;padding:14px 18px;' +
        'background:rgba(0,0,0,.85);color:#9EFFA8;font:15px/1.5 monospace;white-space:pre-wrap;direction:ltr;text-align:left';
      document.body.appendChild(d);
    }
    return d;
  }
  window.onerror = function (msg, src, line) {
    diagBox().textContent += 'ERROR: ' + msg + '  @' + (src || '').split('/').pop() + ':' + line + '\n';
  };
  function diagInfo() {
    const v = viewport();
    diagBox().textContent =
      'UA: ' + navigator.userAgent + '\n' +
      'viewport: ' + v[0] + 'x' + v[1] + '   screen: ' + screen.width + 'x' + screen.height + '\n' +
      'transform: ' + stage.style.transform + '\n' +
      'screen on: ' + (current ? current.id : '-') + '\n';
  }

  /* -------------------- الإقلاع -------------------- */
  buildGrid();
  fit();

  const qs = new URLSearchParams(location.search);
  if (qs.get('debug') === '1') document.body.classList.add('debug');
  if (qs.get('diag')  === '1') { diagInfo(); setInterval(diagInfo, 1000); }
  if (qs.get('nohero') === '1') document.body.classList.add('nohero');
  const jump = qs.get('screen');
  if (qs.get('g')) state.gender = qs.get('g');       /* يشتغل مع كل الشاشات مش النتيجة بس */
  if (jump === 'result') { state.persona = qs.get('p') || 'mughamer'; showResult(); }
  else show(jump || 'landing');
})();
