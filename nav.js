(function () {
    // Mobile menu
    const menuBtn = document.getElementById('mobile-menu-button');
    const menu = document.getElementById('mobile-menu');
    const menuIcon = document.getElementById('menu-icon');
    const MENU_OPEN = 'M6 6l12 12M18 6 6 18';
    const MENU_CLOSED = 'M4 7h16M4 12h16M4 17h16';

    function setMenu(open) {
        menu.classList.toggle('hidden', !open);
        menuIcon.setAttribute('d', open ? MENU_OPEN : MENU_CLOSED);
        menuBtn.setAttribute('aria-expanded', String(open));
        menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    }

    if (menuBtn && menu) {
        menuBtn.addEventListener('click', () => setMenu(menu.classList.contains('hidden')));
        menu.querySelectorAll('a').forEach((link) => {
            link.addEventListener('click', () => setMenu(false));
        });
    }

    // Nav border once the page scrolls
    const nav = document.getElementById('site-nav');
    if (nav) {
        const updateNav = () => nav.classList.toggle('border-line', window.scrollY > 8);
        window.addEventListener('scroll', updateNav, { passive: true });
        updateNav();
    }
})();
