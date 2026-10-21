(function () {
    const root = document.documentElement;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    if (reduce) root.classList.add('reduce');

    const clamp = (v, min = 0, max = 1) => Math.min(max, Math.max(min, v));

    // --- Scroll scenes: each [data-scene] gets --p = 0..1 while its sticky panel is held ---
    const scenes = [...document.querySelectorAll('[data-scene]')];

    const story = document.querySelector('[data-story]');
    const steps = story ? [...story.querySelectorAll('[data-step]')] : [];
    const screens = story ? [...story.querySelectorAll('[data-screen]')] : [];
    let storyIndex = 0;

    const hs = document.querySelector('[data-hs]');
    const hsTrack = hs ? hs.querySelector('.hs-track') : null;
    const hsCards = hs ? [...hs.querySelectorAll('[data-hs-card]')] : [];
    const hsCount = hs ? hs.querySelector('[data-hs-count]') : null;

    function measureHs() {
        if (!hsTrack || !hsCards.length) return;
        const last = hsCards[hsCards.length - 1];
        const padRight = parseFloat(getComputedStyle(hsTrack).paddingRight) || 0;
        const shift = Math.max(0, last.offsetLeft + last.offsetWidth + padRight - hsTrack.clientWidth);
        hs.style.setProperty('--hs-shift', `${shift}px`);
    }

    function updateStory(p) {
        const n = steps.length;
        const index = Math.min(n - 1, Math.floor(p * n));
        steps.forEach((step, i) => step.style.setProperty('--sp', clamp(p * n - i).toFixed(3)));
        if (index === storyIndex) return;
        storyIndex = index;
        steps.forEach((step, i) => step.classList.toggle('is-active', i === index));
        screens.forEach((screen, i) => screen.classList.toggle('is-active', i === index));
    }

    function updateHs(p) {
        if (!hsCount) return;
        const index = Math.round(p * (hsCards.length - 1)) + 1;
        hsCount.textContent = String(index).padStart(2, '0');
    }

    // --- Text that lights up word by word ---
    const lit = document.querySelector('[data-lit]');
    let litWords = [];
    if (lit) {
        const words = lit.textContent.trim().split(/\s+/);
        lit.textContent = '';
        words.forEach((word, i) => {
            const span = document.createElement('span');
            span.className = 'lit-word';
            span.textContent = word;
            lit.appendChild(span);
            if (i < words.length - 1) lit.appendChild(document.createTextNode(' '));
        });
        litWords = [...lit.querySelectorAll('.lit-word')];
    }

    function updateLit(vh) {
        const r = lit.getBoundingClientRect();
        if (r.bottom < 0 || r.top > vh) return;
        // Starts lighting when the paragraph enters the lower screen, done by the middle
        const p = clamp((vh * 0.85 - r.top) / (vh * 0.4 + r.height));
        const n = litWords.length;
        litWords.forEach((word, i) => {
            word.style.opacity = (0.14 + 0.86 * clamp(p * n - i)).toFixed(3);
        });
    }

    let ticking = false;
    function update() {
        ticking = false;
        const vh = window.innerHeight;
        scenes.forEach((scene) => {
            const r = scene.getBoundingClientRect();
            if (r.bottom < -vh || r.top > vh * 1.5) return;
            const range = scene.offsetHeight - vh;
            const p = range > 0 ? clamp(-r.top / range) : 1;
            scene.style.setProperty('--p', p.toFixed(4));
            if (scene === story && !reduce) updateStory(p);
            if (scene === hs) updateHs(p);
        });
        if (litWords.length && !reduce) updateLit(vh);
    }

    function requestUpdate() {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(update);
    }

    if (reduce) {
        // Show every step at once instead of swapping them on scroll
        steps.forEach((step) => {
            step.classList.add('is-active');
            step.style.setProperty('--sp', '1');
        });
    }

    measureHs();
    update();
    window.addEventListener('scroll', requestUpdate, { passive: true });
    window.addEventListener('resize', () => {
        measureHs();
        requestUpdate();
    });
    window.addEventListener('load', () => {
        measureHs();
        requestUpdate();
    });

    // --- Count-up numbers + bar chart ---
    const countCard = document.querySelector('[data-count-card]');
    if (countCard) {
        const numbers = [...countCard.querySelectorAll('[data-count]')];
        const format = (value, decimals) =>
            value.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

        const run = () => {
            countCard.classList.add('is-in');
            numbers.forEach((el) => {
                const target = parseFloat(el.dataset.count);
                const decimals = parseInt(el.dataset.decimals || '0', 10);
                if (reduce) {
                    el.textContent = format(target, decimals);
                    return;
                }
                const start = performance.now();
                const duration = 1600;
                const tick = (now) => {
                    const t = clamp((now - start) / duration);
                    const eased = 1 - Math.pow(1 - t, 3);
                    el.textContent = format(target * eased, decimals);
                    if (t < 1) requestAnimationFrame(tick);
                };
                requestAnimationFrame(tick);
            });
        };

        const io = new IntersectionObserver(
            (entries) => {
                if (entries.some((e) => e.isIntersecting)) {
                    io.disconnect();
                    run();
                }
            },
            { threshold: 0.4 }
        );
        io.observe(countCard);
    }

    // Hover demos say something different on touch screens
    if (!canHover) {
        document.querySelectorAll('[data-touch-text]').forEach((el) => {
            el.innerHTML = el.dataset.touchText;
        });
    }

    // --- 3D tilt card ---
    document.querySelectorAll('[data-tilt]').forEach((card) => {
        if (reduce || !canHover) return;
        card.addEventListener('pointermove', (e) => {
            const r = card.getBoundingClientRect();
            const x = (e.clientX - r.left) / r.width;
            const y = (e.clientY - r.top) / r.height;
            card.style.setProperty('--ry', `${((x - 0.5) * 18).toFixed(2)}deg`);
            card.style.setProperty('--rx', `${((0.5 - y) * 14).toFixed(2)}deg`);
            card.style.setProperty('--mx', `${(x * 100).toFixed(1)}%`);
            card.style.setProperty('--my', `${(y * 100).toFixed(1)}%`);
        });
        card.addEventListener('pointerleave', () => {
            card.style.setProperty('--rx', '0deg');
            card.style.setProperty('--ry', '0deg');
        });
    });

    // --- Magnetic button ---
    document.querySelectorAll('[data-magnet-area]').forEach((area) => {
        const button = area.querySelector('[data-magnet]');
        if (!button || reduce || !canHover) return;
        area.addEventListener('pointermove', (e) => {
            const r = button.getBoundingClientRect();
            const dx = e.clientX - (r.left + r.width / 2);
            const dy = e.clientY - (r.top + r.height / 2);
            const reach = 170;
            const pull = clamp(1 - Math.hypot(dx, dy) / reach);
            button.style.transform = `translate(${(dx * 0.4 * pull).toFixed(1)}px, ${(dy * 0.4 * pull).toFixed(1)}px)`;
        });
        area.addEventListener('pointerleave', () => {
            button.style.transform = '';
        });
    });

    // --- Typing text ---
    document.querySelectorAll('[data-typing]').forEach((el) => {
        const words = (el.dataset.words || '').split('|').filter(Boolean);
        if (!words.length || reduce) return;
        let word = 0;
        let chars = words[0].length;
        let deleting = true;

        // Hold the full word, delete it, then type the next one
        const step = () => {
            let delay;
            if (deleting) {
                chars -= 1;
                delay = 35;
                if (chars === 0) {
                    deleting = false;
                    word = (word + 1) % words.length;
                    delay = 300;
                }
            } else {
                chars += 1;
                delay = 70;
                if (chars === words[word].length) {
                    deleting = true;
                    delay = 1600;
                }
            }
            el.textContent = words[word].slice(0, chars);
            setTimeout(step, delay);
        };
        setTimeout(step, 1600);
    });

    // --- Dark mode switch ---
    document.querySelectorAll('[data-theme-demo]').forEach((demo) => {
        const toggle = demo.querySelector('[data-theme-toggle]');
        if (!toggle) return;
        toggle.addEventListener('click', () => {
            const dark = demo.dataset.dark !== 'true';
            demo.dataset.dark = String(dark);
            toggle.setAttribute('aria-pressed', String(dark));
        });
    });
})();
