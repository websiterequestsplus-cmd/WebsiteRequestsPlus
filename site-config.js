// Site-wide switches, loaded in <head> on every page.
// Discord is turned off for now — set discord: true to bring it back everywhere
// (nav links, buttons, the reply-method toggle, FAQ entry, footer link).
window.SITE = {
    discord: false,
};

if (!window.SITE.discord) document.documentElement.classList.add('no-discord');
