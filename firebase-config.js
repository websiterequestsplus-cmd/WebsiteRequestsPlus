// ===== Chat + sign-in settings =====
// Paste your Firebase web app config here (Firebase console → Project settings →
// General → Your apps → Web app → "SDK setup and configuration" → Config).
// These values are meant to be public; the security rules protect the data.
// While apiKey is empty, the Chat links stay hidden and the site works as before.
window.FIREBASE_CONFIG = {
    apiKey: 'AIzaSyBtRvHNQb7Jwl0tFnKqWcMvapa3eabE92U',
    authDomain: 'website-requests-plus.firebaseapp.com',
    projectId: 'website-requests-plus',
    appId: '1:1065081721115:web:cb4f8fd8686748cad383be',
};

// The official business account(s). They get the Inbox with every chat.
// Must match the list in setup/firestore.rules.
window.SITE_ADMINS = ['websiterequestsplus@gmail.com'];

// Sign-in buttons to show. Turn one on only after enabling it in Firebase
// (Authentication → Sign-in method). Microsoft needs an Azure app first.
window.SIGN_IN_PROVIDERS = {
    google: true,
    microsoft: false,
    email: true,
};

// ----- Don't edit below this line -----
(function () {
    // Local testing only: open a page on localhost with ?emulators to use the Firebase emulators
    const local = ['localhost', '127.0.0.1'].includes(location.hostname);
    let emulators = false;
    try {
        if (local && new URLSearchParams(location.search).has('emulators')) sessionStorage.setItem('wr-emulators', '1');
        emulators = local && sessionStorage.getItem('wr-emulators') === '1';
    } catch (e) {
        emulators = false;
    }
    window.FIREBASE_EMULATORS = emulators;
    if (emulators && !window.FIREBASE_CONFIG.apiKey) {
        window.FIREBASE_CONFIG = { apiKey: 'demo-key', authDomain: 'demo-wrplus.firebaseapp.com', projectId: 'demo-wrplus', appId: 'demo' };
        window.SIGN_IN_PROVIDERS = { google: true, microsoft: true, email: true };
    }
    if (window.FIREBASE_CONFIG.apiKey) document.documentElement.classList.add('chat-on');
})();
