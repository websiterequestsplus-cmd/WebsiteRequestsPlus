// Shared Firebase setup for the sign-in, chat, and inbox pages.
// Settings live in firebase-config.js (loaded first as a normal script).
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import {
    getAuth,
    connectAuthEmulator,
    onAuthStateChanged,
    signOut as firebaseSignOut,
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import { getFirestore, connectFirestoreEmulator } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';

const config = window.FIREBASE_CONFIG || {};
const admins = (window.SITE_ADMINS || []).map((email) => email.toLowerCase());

export const ready = Boolean(config.apiKey);
export const providers = window.SIGN_IN_PROVIDERS || { google: true, microsoft: false, email: true };

export let auth = null;
export let db = null;

if (ready) {
    const app = initializeApp(config);
    auth = getAuth(app);
    db = getFirestore(app);
    if (window.FIREBASE_EMULATORS) {
        connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
        connectFirestoreEmulator(db, '127.0.0.1', 8080);
    }
}

export function isAdmin(user) {
    return Boolean(user && user.emailVerified && admins.includes((user.email || '').toLowerCase()));
}

export function nameOf(user) {
    if (!user) return '';
    return (user.displayName || (user.email || '').split('@')[0] || 'Customer').slice(0, 80);
}

// Resolves once Firebase knows whether someone is signed in
export function currentUser() {
    return new Promise((resolve) => {
        if (!ready) return resolve(null);
        const stop = onAuthStateChanged(auth, (user) => {
            stop();
            resolve(user);
        });
    });
}

export function watchUser(callback) {
    if (!ready) return () => {};
    return onAuthStateChanged(auth, callback);
}

export async function signOut() {
    if (ready) await firebaseSignOut(auth);
    window.location.href = 'index.html';
}

// Fills in the signed-in parts of the nav on app pages
export function wireAccountNav(user) {
    document.querySelectorAll('[data-account-email]').forEach((el) => {
        el.textContent = user ? user.email || nameOf(user) : '';
    });
    document.querySelectorAll('[data-signed-in]').forEach((el) => el.classList.toggle('hidden', !user));
    document.querySelectorAll('[data-signed-out]').forEach((el) => el.classList.toggle('hidden', Boolean(user)));
    document.querySelectorAll('[data-admin-only]').forEach((el) => el.classList.toggle('hidden', !isAdmin(user)));
    document.querySelectorAll('[data-sign-out]').forEach((button) => {
        if (button.dataset.wired) return;
        button.dataset.wired = '1';
        button.addEventListener('click', () => signOut());
    });
}
