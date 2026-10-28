import { ready, auth, providers, currentUser, watchUser, wireAccountNav, nameOf } from './firebase-init.js?v=7';
import {
    GoogleAuthProvider,
    OAuthProvider,
    signInWithPopup,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    sendPasswordResetEmail,
    sendEmailVerification,
    updateProfile,
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';

const $ = (id) => document.getElementById(id);

// Only ever send people on to one of our own pages
function safeNext(value) {
    return value && /^[a-z0-9-]+\.html(#[\w-]*)?$/i.test(value) ? value : 'chat.html';
}
const next = safeNext(new URLSearchParams(location.search).get('next'));

const ERRORS = {
    'auth/invalid-credential': 'Wrong email or password.',
    'auth/wrong-password': 'Wrong email or password.',
    'auth/user-not-found': 'No account with that email yet. Create one instead.',
    'auth/invalid-email': 'That email address doesn’t look right.',
    'auth/missing-password': 'Enter your password.',
    'auth/weak-password': 'Use a password with at least 6 characters.',
    'auth/email-already-in-use': 'That email already has an account. Sign in instead.',
    'auth/account-exists-with-different-credential':
        'That email already signed up another way (Google, Microsoft, or email + password). Use that one.',
    'auth/too-many-requests': 'Too many tries. Wait a minute and try again.',
    'auth/network-request-failed': 'No connection. Check your internet and try again.',
    'auth/operation-not-allowed': 'This sign-in option isn’t turned on yet. Try another one.',
    'auth/unauthorized-domain': 'Sign-in isn’t allowed on this web address yet.',
    'auth/user-disabled': 'This account has been turned off. Email us for help.',
    'auth/popup-blocked': 'Your browser blocked the sign-in window. Allow pop-ups for this site and tap the button again, or use email below.',
    'auth/operation-not-supported-in-this-environment':
        'This browser can’t open the sign-in window. Open the site in Chrome or Safari, or use email below.',
};
const SILENT = ['auth/popup-closed-by-user', 'auth/cancelled-popup-request', 'auth/user-cancelled'];

const message = $('auth-message');
function say(text, tone = 'error') {
    message.textContent = text;
    message.className =
        'mt-5 rounded-md px-4 py-3 text-sm leading-relaxed ' + (tone === 'error' ? 'bg-red-50 text-red-700' : 'bg-brand-light text-ink');
}
function quiet() {
    message.className = 'mt-5 hidden';
}
function sayError(error) {
    if (SILENT.includes(error.code)) return;
    console.error(error);
    say(ERRORS[error.code] || 'Something went wrong. Please try again.');
}

function show(id) {
    ['auth-box', 'signed-in-box'].forEach((box) => $(box).classList.toggle('hidden', box !== id));
}

function finish() {
    window.location.href = next;
}

if (!ready) {
    $('setup-notice').classList.remove('hidden');
} else {
    init();
}

async function init() {
    $('continue-link').href = next;
    $('continue-link').textContent = next === 'chat.html' ? 'Go to chat' : 'Continue';

    // Hide sign-in options that aren't switched on
    document.querySelectorAll('[data-provider]').forEach((button) => {
        button.classList.toggle('hidden', !providers[button.dataset.provider]);
    });
    const anyProvider = providers.google || providers.microsoft;
    $('provider-buttons').classList.toggle('hidden', !anyProvider);
    $('email-section').classList.toggle('hidden', !providers.email);
    $('or-divider').classList.toggle('hidden', !anyProvider);

    watchUser((user) => wireAccountNav(user));

    const user = await currentUser();
    show(user ? 'signed-in-box' : 'auth-box');
    wireForms();
}

let busy = false;
function setBusy(value) {
    busy = value;
    document.querySelectorAll('#auth-box button').forEach((button) => (button.disabled = value));
    $('email-submit').classList.toggle('opacity-70', value);
}

let mode = 'signin';
function setMode(nextMode) {
    mode = nextMode;
    const signup = mode === 'signup';
    document.querySelectorAll('[data-mode]').forEach((button) => {
        const active = button.dataset.mode === mode;
        button.classList.toggle('method-active', active);
        button.setAttribute('aria-pressed', String(active));
    });
    $('name-wrap').classList.toggle('hidden', !signup);
    $('forgot-link').classList.toggle('invisible', signup);
    $('auth-password').autocomplete = signup ? 'new-password' : 'current-password';
    $('email-submit').textContent = signup ? 'Create account' : 'Sign in';
    $('auth-title').textContent = signup ? 'Create your account' : 'Sign in to chat with us';
    quiet();
}

function wireForms() {
    document.querySelectorAll('[data-mode]').forEach((button) => {
        button.addEventListener('click', () => setMode(button.dataset.mode));
    });

    document.querySelectorAll('[data-provider]').forEach((button) => {
        button.addEventListener('click', async () => {
            if (busy) return;
            quiet();
            const provider =
                button.dataset.provider === 'google' ? new GoogleAuthProvider() : new OAuthProvider('microsoft.com');
            provider.setCustomParameters({ prompt: 'select_account' });
            setBusy(true);
            // A pop-up, not a full-page redirect: redirects lose the sign-in in today's browsers
            // unless the site is hosted on Firebase itself.
            try {
                await signInWithPopup(auth, provider);
                finish();
            } catch (error) {
                sayError(error);
                setBusy(false);
            }
        });
    });

    $('email-form').addEventListener('submit', async (event) => {
        event.preventDefault();
        if (busy) return;
        quiet();
        const email = $('auth-email').value.trim();
        const password = $('auth-password').value;
        if (!email || !$('auth-email').checkValidity()) return say(ERRORS['auth/invalid-email']);
        if (password.length < 6) return say(ERRORS['auth/weak-password']);

        setBusy(true);
        try {
            if (mode === 'signup') {
                const { user } = await createUserWithEmailAndPassword(auth, email, password);
                const name = $('auth-name').value.trim() || nameOf(user);
                await updateProfile(user, { displayName: name.slice(0, 80) });
                sendEmailVerification(user).catch(() => {});
            } else {
                await signInWithEmailAndPassword(auth, email, password);
            }
            finish();
        } catch (error) {
            sayError(error);
            setBusy(false);
        }
    });

    $('forgot-link').addEventListener('click', async () => {
        if (busy) return;
        const email = $('auth-email').value.trim();
        if (!email || !$('auth-email').checkValidity()) {
            $('auth-email').focus();
            return say('Type your email above first, then tap “Forgot password?” again.');
        }
        setBusy(true);
        try {
            await sendPasswordResetEmail(auth, email);
            say('If that email has an account, a reset link is on its way. Check your inbox.', 'info');
        } catch (error) {
            sayError(error);
        }
        setBusy(false);
    });
}
