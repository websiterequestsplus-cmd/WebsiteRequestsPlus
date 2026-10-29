import { ready, db, currentUser, watchUser, wireAccountNav, nameOf, isAdmin } from './firebase-init.js?v=14';
import {
    collection,
    doc,
    query,
    where,
    orderBy,
    onSnapshot,
    writeBatch,
    updateDoc,
    serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';
import { el, millis, shortTime, longTime, statusChip, renderMessages, wireComposer, setPane, TEAM_NAME, MAX_MESSAGE } from './chat-ui.js?v=14';

const $ = (id) => document.getElementById(id);

// A quote request handed over from the home page form (contact.js)
function takeDraft() {
    try {
        const raw = sessionStorage.getItem('wr-chat-draft');
        sessionStorage.removeItem('wr-chat-draft');
        return raw ? JSON.parse(raw) : null;
    } catch (e) {
        return null;
    }
}
const listPane = $('list-pane');
const threadPane = $('thread-pane');

if (!ready) {
    $('loading').classList.add('hidden');
    $('setup-notice').classList.remove('hidden');
} else {
    start();
}

async function start() {
    const user = await currentUser();
    if (!user) {
        window.location.href = 'account.html?next=chat.html';
        return;
    }
    // The official account's chats are the customers' chats: those live in the Inbox
    if (isAdmin(user) && new URLSearchParams(location.search).get('view') !== 'customer') {
        window.location.replace('inbox.html');
        return;
    }
    wireAccountNav(user);
    watchUser((u) => {
        if (!u) window.location.href = 'account.html?next=chat.html';
    });

    let chats = [];
    let activeId = null;
    let stopMessages = null;
    let firstLoad = true;

    const chatsQuery = query(collection(db, 'chats'), where('userId', '==', user.uid));
    onSnapshot(
        chatsQuery,
        (snap) => {
            chats = snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => millis(b.updatedAt) - millis(a.updatedAt));
            renderList();
            if (activeId) {
                renderHeader();
                markRead();
            }
            if (firstLoad) {
                firstLoad = false;
                $('loading').classList.add('hidden');
                $('chat-app').classList.remove('hidden');
                const wanted = new URLSearchParams(location.search).get('c');
                const draft = takeDraft();
                if (draft) {
                    // Came from the quote form on the home page
                    openNew();
                    $('new-subject').value = draft.subject || '';
                    $('new-message').value = draft.message || '';
                    $('new-message').focus();
                } else if (wanted && chats.some((c) => c.id === wanted)) openChat(wanted);
                else if (!chats.length) openNew();
                else if (window.matchMedia('(min-width: 1024px)').matches) openChat(chats[0].id);
                else setPane(listPane, threadPane, 'list');
            }
        },
        (error) => {
            console.error(error);
            if (firstLoad) $('loading').textContent = 'Couldn’t load your chats. Refresh the page to try again.';
            else showLiveError();
        }
    );

    // Emails the team about a new chat or message via the Apps Script in setup/chat-alerts.gs.
    // Only the chat ID + sign-in token go out; the script reads the real chat from
    // Firebase itself and limits it to one email per chat every 10 minutes.
    // Fire-and-forget: the message is already saved either way.
    async function notifyTeam(chatId) {
        const url = window.CHAT_ALERT_URL;
        if (!url) return;
        try {
            const token = await user.getIdToken();
            await fetch(url, {
                method: 'POST',
                mode: 'no-cors',
                keepalive: true,
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({ chatId, token }),
            });
        } catch (e) {
            console.warn('Chat alert not sent', e);
        }
    }

    // If live updates ever stop, say so instead of showing a frozen chat
    function showLiveError() {
        $('live-error').classList.remove('hidden');
        $('live-error').classList.add('flex');
    }

    function renderList() {
        const list = $('chat-list');
        list.textContent = '';
        if (!chats.length) {
            list.appendChild(el('li', 'px-4 py-10 text-center text-sm text-muted', 'No chats yet. Start one and we’ll reply here.'));
            return;
        }
        chats.forEach((chat) => {
            const li = el('li');
            const button = el(
                'button',
                'flex w-full flex-col gap-1 border-b border-line px-4 py-3.5 text-left transition-colors hover:bg-mist ' +
                    (chat.id === activeId ? 'bg-brand-light/60' : '')
            );
            button.type = 'button';
            const top = el('div', 'flex items-center gap-2');
            if (chat.unreadForUser) top.appendChild(el('span', 'h-2 w-2 flex-none rounded-full bg-brand'));
            top.appendChild(el('span', 'min-w-0 flex-1 truncate text-sm ' + (chat.unreadForUser ? 'font-semibold text-ink' : 'font-medium text-ink'), chat.subject));
            top.appendChild(el('span', 'flex-none text-xs text-subtle', shortTime(chat.updatedAt)));
            const bottom = el('div', 'flex items-center gap-2');
            const who = chat.lastSender === 'admin' ? `${TEAM_NAME}: ` : 'You: ';
            bottom.appendChild(el('span', 'min-w-0 flex-1 truncate text-sm text-muted', who + (chat.lastMessage || '')));
            if (chat.status !== 'open') bottom.appendChild(statusChip(chat.status));
            button.append(top, bottom);
            button.addEventListener('click', () => openChat(chat.id));
            li.appendChild(button);
            list.appendChild(li);
        });
    }

    function activeChat() {
        return chats.find((c) => c.id === activeId);
    }

    function renderHeader() {
        const chat = activeChat();
        if (!chat) return;
        $('thread-subject').textContent = chat.subject;
        $('thread-started').textContent = `Started ${longTime(chat.createdAt)}`;
        $('thread-status').replaceChildren(statusChip(chat.status));
        const open = chat.status === 'open';
        $('composer').classList.toggle('hidden', !open);
        $('composer').classList.toggle('flex', open);
        $('closed-note').classList.toggle('hidden', open);
    }

    function markRead() {
        const chat = activeChat();
        if (chat && chat.unreadForUser && !document.hidden) {
            updateDoc(doc(db, 'chats', chat.id), { unreadForUser: false }).catch((e) => console.error(e));
        }
    }
    document.addEventListener('visibilitychange', markRead);

    function openChat(id) {
        activeId = id;
        if (stopMessages) stopMessages();
        $('new-view').classList.add('hidden');
        $('thread-view').classList.remove('hidden');
        $('thread-view').classList.add('flex');
        setPane(listPane, threadPane, 'thread');
        renderList();
        renderHeader();
        const box = $('messages');
        box.textContent = '';
        box.dataset.fresh = '1';
        const messagesQuery = query(collection(db, 'chats', id, 'messages'), orderBy('createdAt'));
        stopMessages = onSnapshot(
            messagesQuery,
            (snap) => renderMessages(box, snap.docs.map((d) => d.data()), 'user'),
            (error) => {
                console.error(error);
                showLiveError();
            }
        );
        markRead();
        history.replaceState(null, '', `chat.html?c=${encodeURIComponent(id)}`);
    }

    function openNew() {
        activeId = null;
        if (stopMessages) stopMessages();
        stopMessages = null;
        $('thread-view').classList.add('hidden');
        $('thread-view').classList.remove('flex');
        $('new-view').classList.remove('hidden');
        setPane(listPane, threadPane, 'thread');
        renderList();
        $('new-subject').focus();
        history.replaceState(null, '', 'chat.html');
    }

    $('new-chat-btn').addEventListener('click', openNew);
    document.querySelectorAll('[data-start-new]').forEach((b) => b.addEventListener('click', openNew));
    document.querySelectorAll('[data-back]').forEach((b) =>
        b.addEventListener('click', () => {
            setPane(listPane, threadPane, 'list');
        })
    );

    // Start a chat: the chat and its first message are saved together
    $('new-form').addEventListener('submit', async (event) => {
        event.preventDefault();
        const subject = $('new-subject').value.trim().slice(0, 120);
        const text = $('new-message').value.trim().slice(0, MAX_MESSAGE);
        const error = $('new-error');
        error.classList.add('hidden');
        if (!subject || !text) {
            error.textContent = 'Add a subject and a message.';
            error.classList.remove('hidden');
            return;
        }
        const submit = $('new-submit');
        submit.disabled = true;
        try {
            const chatRef = doc(collection(db, 'chats'));
            const batch = writeBatch(db);
            batch.set(chatRef, {
                userId: user.uid,
                userEmail: user.email || '',
                userName: nameOf(user),
                subject,
                status: 'open',
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                lastMessage: text.slice(0, 300),
                lastSender: 'user',
                unreadForAdmin: true,
                unreadForUser: false,
            });
            batch.set(doc(collection(chatRef, 'messages')), {
                senderId: user.uid,
                senderRole: 'user',
                senderName: nameOf(user),
                text,
                createdAt: serverTimestamp(),
            });
            await batch.commit();
            notifyTeam(chatRef.id);
            $('new-subject').value = '';
            $('new-message').value = '';
            openChat(chatRef.id);
        } catch (e) {
            console.error(e);
            error.textContent = 'Couldn’t send that. Check your connection and try again.';
            error.classList.remove('hidden');
        }
        submit.disabled = false;
    });

    // Reply in the open chat
    const input = $('composer-input');
    const composer = wireComposer(input, send);
    $('composer').addEventListener('submit', (event) => {
        event.preventDefault();
        send();
    });

    async function send() {
        const chat = activeChat();
        const text = input.value.trim().slice(0, MAX_MESSAGE);
        if (!chat || !text || chat.status !== 'open') return;
        composer.reset();
        try {
            const chatRef = doc(db, 'chats', chat.id);
            const batch = writeBatch(db);
            batch.set(doc(collection(chatRef, 'messages')), {
                senderId: user.uid,
                senderRole: 'user',
                senderName: nameOf(user),
                text,
                createdAt: serverTimestamp(),
            });
            batch.update(chatRef, {
                lastMessage: text.slice(0, 300),
                lastSender: 'user',
                unreadForAdmin: true,
                unreadForUser: false,
                updatedAt: serverTimestamp(),
            });
            $('messages').dataset.fresh = '1';
            await batch.commit();
            notifyTeam(chat.id);
        } catch (e) {
            console.error(e);
            input.value = text;
            alert('Couldn’t send that message. Check your connection and try again.');
        }
    }
}
