/* ===========================================================================
   منطق التجربة: التنقل بين الشاشات، تحديد النتيجة، ودورة الإيفنت.
   =========================================================================== */
(function () {
  'use strict';

  const stage = document.getElementById('stage');
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => [...(r || document).querySelectorAll(s)];

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
  /* رد فعل بصري خفيف — شاشة اللمس محتاجة تأكيد إن اللمسة وصلت */
  stage.addEventListener('pointerdown', e => {
    const b = e.target.closest('.btn');
    if (b) b.classList.add('down');
  });
  stage.addEventListener('pointerup', e => {
    const b = e.target.closest('.btn');
    $$('.btn.down').forEach(x => x.classList.remove('down'));
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
        new Promise(r => setTimeout(r, SETTINGS.PHOTO_WAIT_MS))
      ]);
      const waited = new Promise(r => { loadTimer = setTimeout(r, SETTINGS.LOADING_MS); });
      Promise.all([ready, waited]).then(() => { if (token === loadToken) showResult(); });
      return;
    }
    if (b.dataset.back !== undefined)    { back();  return; }
    if (b.dataset.restart !== undefined) { reset(); return; }
    if (b.dataset.go) show(b.dataset.go);
  });
  stage.addEventListener('pointercancel', () => $$('.btn.down').forEach(x => x.classList.remove('down')));

  /* ------------------ دورة الإيفنت ------------------ */
  function resetIdle(name) {
    clearTimeout(idleTimer);
    if (name === 'landing') return;             /* شاشة الهبوط تفضل مفتوحة */
    idleTimer = setTimeout(reset, SETTINGS.IDLE_MS);
  }
  ['pointerdown', 'pointermove'].forEach(ev =>
    window.addEventListener(ev, () => { if (current && current.id !== 's-landing') resetIdle(); }, { passive: true }));

  window.addEventListener('keydown', e => { if (e.key === 'Escape') reset(); });

  /* --------------- تحجيم المسرح --------------- */
  function fit() {
    const de = document.documentElement;
    const w = Math.min(innerWidth  || 1e9, de.clientWidth  || 1e9);
    const h = Math.min(innerHeight || 1e9, de.clientHeight || 1e9);
    const s = Math.min(w / 1080, h / 1920);
    /* التوسيط بالبكسل — أوضح وأأمن من النِسب مع الـtransform */
    const dx = Math.round((w - 1080 * s) / 2);
    const dy = Math.round((h - 1920 * s) / 2);
    stage.style.transform = `translate(${dx}px, ${dy}px) scale(${s})`;
  }
  addEventListener('resize', fit);
  addEventListener('orientationchange', () => setTimeout(fit, 120));
  if (window.visualViewport) window.visualViewport.addEventListener('resize', fit);

  /* -------------------- الإقلاع -------------------- */
  buildGrid();
  fit();

  const qs = new URLSearchParams(location.search);
  if (qs.get('debug') === '1') document.body.classList.add('debug');
  if (qs.get('nohero') === '1') document.body.classList.add('nohero');
  const jump = qs.get('screen');
  if (qs.get('g')) state.gender = qs.get('g');       /* يشتغل مع كل الشاشات مش النتيجة بس */
  if (jump === 'result') { state.persona = qs.get('p') || 'mughamer'; showResult(); }
  else show(jump || 'landing');
})();
