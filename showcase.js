(function () {
    const root = document.documentElement;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    if (reduce) root.classList.add('reduce');

    // Where the browser supports scroll-driven animations, CSS moves everything
    // off the main thread; JS then only flips the few on/off bits.
    const cssScroll = !reduce && !!(window.CSS && CSS.supports('animation-timeline: view()'));

    const clamp = (v, min = 0, max = 1) => Math.min(max, Math.max(min, v));
    const $ = (selector, el = document) => el.querySelector(selector);
    const $$ = (selector, el = document) => [...el.querySelectorAll(selector)];

    // ---------------------------------------------------------------------
    // Scroll scenes. Layout is measured once (load/resize); each frame only
    // reads scrollY and writes transform/opacity, which phones run on the GPU.
    // ---------------------------------------------------------------------
    const factories = {
        zoom(scene) {
            const frame = $('[data-zoom-frame]', scene);
            const intro = $('[data-zoom-intro]', scene);
            const caption = $('[data-zoom-caption]', scene);
            return {
                render(p, s) {
                    if (cssScroll) return;
                    const start = s.small ? 0.72 : 0.6;
                    const scale = start + (1 - start) * p;
                    frame.style.transform = `translate3d(0, ${((1 - p) * 0.09 * s.h).toFixed(1)}px, 0) scale(${scale.toFixed(4)})`;
                    intro.style.opacity = clamp(1 - p * 3).toFixed(3);
                    intro.style.transform = `translate3d(0, ${(-80 * p).toFixed(1)}px, 0)`;
                    caption.style.opacity = clamp((p - 0.85) * 7).toFixed(3);
                },
            };
        },

        story(scene) {
            const steps = $$('[data-step]', scene);
            const screens = $$('[data-screen]', scene);
            const bars = steps.map((step) => $('.story-bar > span', step));
            let index = 0;

            if (reduce) {
                steps.forEach((step) => step.classList.add('is-active'));
                bars.forEach((bar) => (bar.style.transform = 'scaleX(1)'));
                return { render() {} };
            }

            return {
                render(p) {
                    const n = steps.length;
                    if (!cssScroll) bars.forEach((bar, i) => (bar.style.transform = `scaleX(${clamp(p * n - i).toFixed(3)})`));
                    const next = Math.min(n - 1, Math.floor(p * n));
                    if (next === index) return;
                    index = next;
                    steps.forEach((step, i) => step.classList.toggle('is-active', i === index));
                    screens.forEach((screen, i) => screen.classList.toggle('is-active', i === index));
                },
            };
        },

        sideways(scene) {
            const track = $('.hs-track', scene);
            const bar = $('.hs-progress > span', scene);
            const count = $('[data-hs-count]', scene);
            const cards = $$('[data-hs-card]', scene);
            let shift = 0;
            let shown = '';
            return {
                measure() {
                    // The track is as wide as its cards; it slides until its end meets the viewport's
                    shift = Math.max(0, track.offsetWidth - track.parentElement.clientWidth);
                },
                render(p) {
                    if (reduce) return;
                    if (!cssScroll) {
                        track.style.transform = `translate3d(${(-shift * p).toFixed(1)}px, 0, 0)`;
                        bar.style.transform = `scaleX(${p.toFixed(4)})`;
                    }
                    const label = String(Math.round(p * (cards.length - 1)) + 1).padStart(2, '0');
                    if (count && label !== shown) {
                        shown = label;
                        count.textContent = label;
                    }
                },
            };
        },

        devices(scene) {
            const devs = $$('.dev', scene).map((el) => ({
                el,
                ex: 0,
                ey: 0,
                sz: parseFloat(el.style.getPropertyValue('--sz')) || 0,
            }));
            return {
                measure() {
                    devs.forEach((d) => {
                        const cs = getComputedStyle(d.el);
                        d.ex = parseFloat(cs.getPropertyValue('--ex')) || 0;
                        d.ey = parseFloat(cs.getPropertyValue('--ey')) || 0;
                    });
                },
                render(p) {
                    if (cssScroll) return;
                    const q = 1 - p;
                    devs.forEach((d) => {
                        // Own perspective per device: they layer in page order and never intersect
                        d.el.style.transform =
                            `translate(-50%, -50%) perspective(1600px) ` +
                            `translate3d(${(d.ex * p).toFixed(1)}px, ${(d.ey * p).toFixed(1)}px, 0) ` +
                            `rotateX(${(55 * q).toFixed(2)}deg) rotateZ(${(-35 * q).toFixed(2)}deg) ` +
                            `translateZ(${(d.sz * q).toFixed(1)}px)`;
                    });
                },
            };
        },

        reveal(scene) {
            const blob = $('[data-circle-blob]', scene);
            const intro = $('[data-circle-intro]', scene);
            const cta = $('[data-circle-cta]', scene);
            let clickable = null;
            return {
                render(p) {
                    const show = clamp((p - 0.55) / 0.3);
                    if (!cssScroll) {
                        const grow = clamp((p - 0.05) / 0.75);
                        blob.style.transform = `scale(${grow.toFixed(4)})`;
                        intro.style.opacity = clamp(1 - p * 2.2).toFixed(3);
                        intro.style.transform = `scale(${(1 - p * 0.15).toFixed(4)})`;
                        cta.style.opacity = show.toFixed(3);
                        cta.style.transform = `translate3d(0, ${((1 - show) * 24).toFixed(1)}px, 0)`;
                    }
                    // Buttons only take taps once they're mostly visible
                    const next = show > 0.5;
                    if (next !== clickable) {
                        clickable = next;
                        cta.style.pointerEvents = next ? 'auto' : 'none';
                    }
                },
            };
        },
    };

    const scenes = $$('[data-scene]')
        .filter((el) => factories[el.id])
        .map((el) => ({
            el,
            sticky: $('.scene-sticky', el),
            ctrl: factories[el.id](el),
            top: 0,
            range: 1,
            h: 0,
            small: false,
            p: -1,
        }));

    // --- Text that lights up word by word ---
    const lit = $('[data-lit]');
    const words = [];
    let litTop = 0;
    let litHeight = 0;
    if (lit) {
        const parts = lit.textContent.trim().split(/\s+/);
        lit.textContent = '';
        parts.forEach((part, i) => {
            const span = document.createElement('span');
            span.className = 'lit-word';
            span.textContent = part;
            lit.appendChild(span);
            if (i < parts.length - 1) lit.appendChild(document.createTextNode(' '));
            words.push({ el: span, o: 0.14 });
            if (cssScroll) {
                // Each word lights during its own slice of the paragraph's trip up the screen
                const start = 12 + (53 * i) / parts.length;
                const end = start + 53 / parts.length;
                span.style.animationRange = `cover ${start.toFixed(2)}% cover ${end.toFixed(2)}%`;
            }
        });
    }

    function updateLit(y, vh) {
        const top = litTop - y;
        if (top > vh || top + litHeight < 0) return;
        // Starts lighting when the paragraph enters the lower screen, done by the middle
        const p = clamp((vh * 0.85 - top) / (vh * 0.4 + litHeight));
        const n = words.length;
        words.forEach((w, i) => {
            const o = Math.round((0.14 + 0.86 * clamp(p * n - i)) * 50) / 50;
            if (o === w.o) return;
            w.o = o;
            w.el.style.opacity = o;
        });
    }

    let vh = window.innerHeight;

    function measure() {
        const y = window.scrollY;
        vh = window.innerHeight;
        const small = window.innerWidth < 768;
        scenes.forEach((s) => {
            s.top = s.el.getBoundingClientRect().top + y;
            s.h = s.sticky.offsetHeight;
            s.range = Math.max(1, s.el.offsetHeight - s.h);
            s.small = small;
            if (s.ctrl.measure) s.ctrl.measure(s);
            s.p = -1;
        });
        if (lit) {
            litTop = lit.getBoundingClientRect().top + y;
            litHeight = lit.offsetHeight;
        }
    }

    let ticking = false;
    function frame() {
        ticking = false;
        const y = window.scrollY;
        scenes.forEach((s) => {
            const p = reduce ? 1 : clamp((y - s.top) / s.range);
            if (p === s.p) return;
            s.p = p;
            s.ctrl.render(p, s);
        });
        if (lit && !reduce && !cssScroll) updateLit(y, vh);
    }

    function requestFrame() {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(frame);
    }

    let lastWidth = window.innerWidth;
    let lastHeight = window.innerHeight;
    function onResize() {
        // Phone URL bars resize the window while scrolling; only re-measure on real changes
        const w = window.innerWidth;
        const h = window.innerHeight;
        if (w === lastWidth && Math.abs(h - lastHeight) < 120) return;
        lastWidth = w;
        lastHeight = h;
        measure();
        requestFrame();
    }

    measure();
    frame();
    window.addEventListener('scroll', requestFrame, { passive: true });
    window.addEventListener('resize', onResize);
    window.addEventListener('load', () => {
        measure();
        frame();
    });
    if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(() => {
            measure();
            frame();
        });
    }

    // ---------------------------------------------------------------------
    // Micro-interactions
    // ---------------------------------------------------------------------

    // Hover demos say something different on touch screens
    if (!canHover) {
        $$('[data-touch-text]').forEach((el) => {
            el.innerHTML = el.dataset.touchText;
        });
    }

    // Count-up numbers + bar chart
    const countCard = $('[data-count-card]');
    if (countCard) {
        const numbers = $$('[data-count]', countCard);
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

    // 3D tilt card: follows the mouse, or a finger dragged across it
    $$('[data-tilt]').forEach((card) => {
        if (reduce) return;
        const apply = (e) => {
            const r = card.getBoundingClientRect();
            const x = clamp((e.clientX - r.left) / r.width);
            const y = clamp((e.clientY - r.top) / r.height);
            card.style.setProperty('--ry', `${((x - 0.5) * 18).toFixed(2)}deg`);
            card.style.setProperty('--rx', `${((0.5 - y) * 14).toFixed(2)}deg`);
            card.style.setProperty('--mx', `${(x * 100).toFixed(1)}%`);
            card.style.setProperty('--my', `${(y * 100).toFixed(1)}%`);
            card.classList.add('is-tilting');
        };
        const reset = () => {
            card.style.setProperty('--rx', '0deg');
            card.style.setProperty('--ry', '0deg');
            card.classList.remove('is-tilting');
        };
        card.addEventListener('pointerdown', apply);
        card.addEventListener('pointermove', apply);
        card.addEventListener('pointerleave', reset);
        card.addEventListener('pointercancel', reset);
        card.addEventListener('pointerup', (e) => {
            if (e.pointerType !== 'mouse') reset();
        });
    });

    // Magnetic button: pulls toward the mouse, or follows a finger dragged near it.
    // A plain tap still opens Contact sales.
    $$('[data-magnet-area]').forEach((area) => {
        const button = $('[data-magnet]', area);
        if (!button || reduce) return;
        let home = null;
        const pull = (e) => {
            const touch = e.pointerType !== 'mouse';
            // Measure from the resting spot, not the moved button, so it doesn't drift away
            if (!home) {
                const r = button.getBoundingClientRect();
                const t = new DOMMatrixReadOnly(getComputedStyle(button).transform);
                home = { x: r.left + r.width / 2 - t.m41, y: r.top + r.height / 2 - t.m42 };
            }
            const dx = e.clientX - home.x;
            const dy = e.clientY - home.y;
            const strength = clamp(1 - Math.hypot(dx, dy) / (touch ? 260 : 170));
            const factor = touch ? 0.55 : 0.4;
            button.style.transform = `translate3d(${(dx * factor * strength).toFixed(1)}px, ${(dy * factor * strength).toFixed(1)}px, 0)`;
        };
        const release = () => {
            button.style.transform = '';
            home = null;
        };
        area.addEventListener('pointerdown', pull);
        area.addEventListener('pointermove', pull);
        area.addEventListener('pointerleave', release);
        area.addEventListener('pointercancel', release);
        area.addEventListener('pointerup', (e) => {
            if (e.pointerType !== 'mouse') release();
        });
    });

    // Ticker: hover pauses on desktop; click or tap holds it, tap again to play
    $$('[data-marquee]').forEach((marquee) => {
        const toggle = () => {
            const paused = marquee.classList.toggle('is-paused');
            marquee.setAttribute('aria-pressed', String(paused));
        };
        marquee.addEventListener('click', toggle);
        marquee.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggle();
            }
        });
    });

    // Typing text
    $$('[data-typing]').forEach((el) => {
        const list = (el.dataset.words || '').split('|').filter(Boolean);
        if (!list.length || reduce) return;
        let word = 0;
        let chars = list[0].length;
        let deleting = true;

        // Hold the full word, delete it, then type the next one
        const step = () => {
            let delay;
            if (deleting) {
                chars -= 1;
                delay = 35;
                if (chars === 0) {
                    deleting = false;
                    word = (word + 1) % list.length;
                    delay = 300;
                }
            } else {
                chars += 1;
                delay = 70;
                if (chars === list[word].length) {
                    deleting = true;
                    delay = 1600;
                }
            }
            el.textContent = list[word].slice(0, chars);
            setTimeout(step, delay);
        };
        setTimeout(step, 1600);
    });

    // Dark mode switch
    $$('[data-theme-demo]').forEach((demo) => {
        const toggle = $('[data-theme-toggle]', demo);
        if (!toggle) return;
        toggle.addEventListener('click', () => {
            const dark = demo.dataset.dark !== 'true';
            demo.dataset.dark = String(dark);
            toggle.setAttribute('aria-pressed', String(dark));
        });
    });
})();
