const progress = document.querySelector('.progress');
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabPanels = document.querySelectorAll('.tab-content');
    const flipCards = document.querySelectorAll('.flip-card');
    const revealItems = document.querySelectorAll('.reveal');
    const brainImg = document.getElementById('brain-visual-img');
    const brainBox = document.getElementById('brain-visual-box');
    const brainImages = {
      asd: { src: 'images/brain-illustration-asd.png', alt: 'ASD 自閉症光譜示意插畫' },
      adhd: { src: 'images/brain-illustration-adhd.png', alt: 'ADHD 注意力不足過動症示意插畫' },
      dyslexia: { src: 'images/brain-illustration-dyslexia.png', alt: '讀寫障礙示意插畫' }
    };
    function updateProgress() {
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      const ratio = scrollable > 0 ? window.scrollY / scrollable : 0;
      progress.style.width = Math.min(100, Math.max(0, ratio * 100)) + '%';
    }
    tabButtons.forEach((button) => {
      button.addEventListener('click', () => {
        const target = button.dataset.tab;
        tabButtons.forEach((item) => item.classList.toggle('active', item === button));
        tabPanels.forEach((panel) => panel.classList.toggle('active', panel.id === target));
        if (brainImg && brainImages[target]) {
          brainImg.src = brainImages[target].src;
          brainImg.alt = brainImages[target].alt;
        }
        if (brainBox) {
          brainBox.classList.remove('bg-asd', 'bg-adhd', 'bg-dyslexia');
          brainBox.classList.add('bg-' + target);
        }
      });
    });
    flipCards.forEach((card) => {
      const toggle = () => card.classList.toggle('flipped');
      card.addEventListener('click', toggle);
      card.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); toggle(); } });
    });
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => { if (entry.isIntersecting) { entry.target.classList.add('visible'); observer.unobserve(entry.target); } });
    }, { threshold: 0.12 });
    revealItems.forEach((item) => observer.observe(item));
    /* 統計數字：捲到該區塊時由 0 遞增至目標值（只跑一次）。
       設計原則：數字「預設維持正確最終值」，只有真正要播動畫時才歸零遞增 —— 這樣即使動畫在某些
       裝置沒跑（不支援、被節流、JS 出錯），使用者看到的仍是正確數字，絕不會卡在 0。
       FORCE_ANIMATE=true 時連「減少動態效果」的裝置也一律播放。 */
    (function initStatCountUp() {
      const FORCE_ANIMATE = true; /* 一律播放動畫（含開啟「減少動態」的裝置）；改 false 則尊重系統設定 */
      const targets = [];
      document.querySelectorAll('.stat-number').forEach((el) => {
        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        const digits = [];
        let node;
        while ((node = walker.nextNode())) {
          const raw = node.textContent.trim();
          // 只跑純數字且 >= 5 的節點：「1/36」的 1 不動，36 才遞增
          if (/^\d+$/.test(raw) && Number(raw) >= 5) digits.push({ node, text: raw, value: Number(raw) });
        }
        if (digits.length) targets.push({ el, digits, done: false });
      });
      if (!targets.length) return;

      const setZero = (t) => t.digits.forEach((d) => { d.node.textContent = '0'; });
      const setFinal = (t) => t.digits.forEach((d) => { d.node.textContent = d.text; });

      const start = () => {
        // 鎖住寬度，遞增時位數變化才不會左右跳動（此時數字仍是最終值）
        targets.forEach((t) => { t.el.style.minWidth = t.el.getBoundingClientRect().width + 'px'; });

        const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        // 不支援 IntersectionObserver，或尊重「減少動態」設定 → 直接顯示最終數字、不動畫（永不卡 0）
        if ((!FORCE_ANIMATE && reduce) || !('IntersectionObserver' in window)) return;

        // 只把「目前還在畫面下方、使用者還沒看到」的數字歸零；已在畫面上的保留最終值，避免閃動
        const vh = window.innerHeight || document.documentElement.clientHeight;
        targets.forEach((t) => { if (t.el.getBoundingClientRect().top > vh) setZero(t); });

        const easeOutCubic = (x) => 1 - Math.pow(1 - x, 3);
        const DURATION = 1300;
        function run(t) {
          setZero(t);
          const t0 = performance.now();
          (function step(now) {
            const p = Math.min(1, (now - t0) / DURATION);
            const e = easeOutCubic(p);
            t.digits.forEach((d) => { d.node.textContent = String(Math.round(d.value * e)); });
            if (p < 1) requestAnimationFrame(step); else setFinal(t);
          })(performance.now());
        }
        const obs = new IntersectionObserver((entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            const t = targets.find((x) => x.el === entry.target);
            if (t && !t.done) { t.done = true; run(t); }
            obs.unobserve(entry.target);
          });
        }, { threshold: 0.35 });
        targets.forEach((t) => obs.observe(t.el));
      };

      // 等字體就緒再量寬度；但即使 fonts.ready 遲遲不 resolve，也在 1.5 秒後照常啟動
      let started = false;
      const kick = () => { if (started) return; started = true; start(); };
      if (document.fonts && document.fonts.ready) { document.fonts.ready.then(kick); setTimeout(kick, 1500); }
      else kick();
    })();

    /* 延伸閱讀輪播：一次顯示 N 張（桌機3／平板2／手機1），箭頭與圓點以「頁」為單位 */
    (function initRelatedCarousel() {
      const root = document.querySelector('.related-reading');
      if (!root) return;
      const track = root.querySelector('.rr-track');
      const viewport = root.querySelector('.rr-viewport');
      const cards = Array.from(root.querySelectorAll('.rr-card'));
      const prev = root.querySelector('.rr-prev');
      const next = root.querySelector('.rr-next');
      const dotsWrap = root.querySelector('.rr-dots');
      if (!track || !cards.length) return;
      const GAP = 24;
      let perView = 3;
      let pages = 1;
      let page = 0;

      function calcPerView() {
        const w = window.innerWidth;
        return w < 600 ? 1 : w < 900 ? 2 : 3;
      }
      function layout() {
        perView = calcPerView();
        const vw = viewport.clientWidth;
        const cardW = (vw - GAP * (perView - 1)) / perView;
        cards.forEach((c) => { c.style.setProperty('--rr-card-w', cardW + 'px'); });
        // 圖片高度 = 卡片寬 × (10/16)（.rr-card-image aspect-ratio 16/10），供箭頭對齊圖片中線
        root.style.setProperty('--rr-img-h', (cardW * 10 / 16) + 'px');
        pages = Math.max(1, Math.ceil(cards.length / perView));
        if (page > pages - 1) page = pages - 1;
        buildDots();
        goto(page, false);
      }
      function buildDots() {
        dotsWrap.innerHTML = '';
        for (let i = 0; i < pages; i++) {
          const b = document.createElement('button');
          b.type = 'button';
          b.className = 'rr-dot' + (i === page ? ' active' : '');
          b.setAttribute('aria-label', '第 ' + (i + 1) + ' 頁');
          b.addEventListener('click', () => goto(i, true));
          dotsWrap.appendChild(b);
        }
      }
      function goto(p, animate) {
        page = Math.min(Math.max(0, p), pages - 1);
        const vw = viewport.clientWidth;
        const x = -page * (vw + GAP);
        track.style.transition = animate ? '' : 'none';
        track.style.transform = 'translateX(' + x + 'px)';
        if (!animate) { void track.offsetHeight; track.style.transition = ''; }
        Array.from(dotsWrap.children).forEach((d, i) => d.classList.toggle('active', i === page));
        if (prev) prev.disabled = page === 0;
        if (next) next.disabled = page === pages - 1;
      }
      if (prev) prev.addEventListener('click', () => goto(page - 1, true));
      if (next) next.addEventListener('click', () => goto(page + 1, true));
      let rz;
      window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(layout, 150); });
      // 用 ResizeObserver 監看 viewport：初次量到寬度、或寬度變動時才重算（避免 clientWidth 尚為 0 時算錯）
      if ('ResizeObserver' in window) {
        let lastW = 0;
        new ResizeObserver(() => {
          const w = viewport.clientWidth;
          if (w && Math.abs(w - lastW) > 1) { lastW = w; layout(); }
        }).observe(viewport);
      }
      layout();
    })();

    window.addEventListener('scroll', updateProgress, { passive: true });
    updateProgress();

