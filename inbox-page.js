import { ready, db, currentUser, watchUser, wireAccountNav, isAdmin } from './firebase-init.js?v=7';
import {
    collection,
    doc,
    query,
    orderBy,
    limit,
    onSnapshot,
    writeBatch,
    updateDoc,
    getDocs,
    serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';
import { el, millis, shortTime, longTime, statusChip, renderMessages, wireComposer, setPane, TEAM_NAME, MAX_MESSAGE } from './chat-ui.js?v=7';

const $ = (id) => document.getElementById(id);
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
        window.location.href = 'account.html?next=inbox.html';
        return;
    }
    wireAccountNav(user);
    watchUser((u) => {
        if (!u) window.location.href = 'account.html?next=inbox.html';
    });
    if (!isAdmin(user)) {
        $('loading').classList.add('hidden');
        $('not-admin').classList.remove('hidden');
        return;
    }

    let chats = [];
    let activeId = null;
    let stopMessages = null;
    let filter = 'open';
    let search = '';
    let firstLoad = true;

    const chatsQuery = query(collection(db, 'chats'), orderBy('updatedAt', 'desc'), limit(500));
    onSnapshot(
        chatsQuery,
        (snap) => {
            chats = snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => millis(b.updatedAt) - millis(a.updatedAt));
            if (activeId && !chats.some((c) => c.id === activeId)) closeThread();
            renderList();
            if (activeId) {
                renderHeader();
                markRead();
            }
            if (firstLoad) {
                firstLoad = false;
                $('loading').classList.add('hidden');
                $('inbox-app').classList.remove('hidden');
                const wanted = new URLSearchParams(location.search).get('c');
                if (wanted && chats.some((c) => c.id === wanted)) openChat(wanted);
                else setPane(listPane, threadPane, 'list');
            }
        },
        (error) => {
            console.error(error);
            $('loading').textContent = 'Couldn’t load the inbox. Check the security rules are published, then refresh.';
        }
    );

    function matches(chat) {
        if (filter === 'open' && chat.status !== 'open') return false;
        if (filter === 'closed' && chat.status === 'open') return false;
        if (filter === 'unread' && !chat.unreadForAdmin) return false;
        if (!search) return true;
        const haystack = [chat.userName, chat.userEmail, chat.subject, chat.lastMessage].join(' ').toLowerCase();
        return haystack.includes(search);
    }

    function renderCounts() {
        const counts = {
            open: chats.filter((c) => c.status === 'open').length,
            unread: chats.filter((c) => c.unreadForAdmin).length,
            closed: chats.filter((c) => c.status !== 'open').length,
            all: chats.length,
        };
        document.querySelectorAll('[data-count]').forEach((span) => (span.textContent = counts[span.dataset.count]));
        $('unread-total').textContent = counts.unread ? `${counts.unread} unread` : 'All caught up';
        document.title = (counts.unread ? `(${counts.unread}) ` : '') + 'Inbox | Website Requests +';
    }

    function renderList() {
        renderCounts();
        const list = $('chat-list');
        list.textContent = '';
        const shown = chats.filter(matches);
        if (!shown.length) {
            const empty = search ? 'No chats match that search.' : filter === 'unread' ? 'No unread chats.' : 'Nothing here yet.';
            list.appendChild(el('li', 'px-4 py-10 text-center text-sm text-muted', empty));
            return;
        }
        shown.forEach((chat) => {
            const li = el('li');
            const button = el(
                'button',
                'flex w-full flex-col gap-1 border-b border-line px-4 py-3.5 text-left transition-colors hover:bg-mist ' +
                    (chat.id === activeId ? 'bg-brand-light/60' : '')
            );
            button.type = 'button';
            const top = el('div', 'flex items-center gap-2');
            if (chat.unreadForAdmin) top.appendChild(el('span', 'h-2 w-2 flex-none rounded-full bg-brand'));
            top.appendChild(el('span', 'min-w-0 flex-1 truncate text-sm ' + (chat.unreadForAdmin ? 'font-semibold text-ink' : 'font-medium text-ink'), chat.userName || chat.userEmail || 'Customer'));
            top.appendChild(el('span', 'flex-none text-xs text-subtle', shortTime(chat.updatedAt)));
            const subject = el('div', 'flex items-center gap-2');
            subject.appendChild(el('span', 'min-w-0 flex-1 truncate text-sm text-ink', chat.subject));
            if (chat.status !== 'open') subject.appendChild(statusChip(chat.status));
            const who = chat.lastSender === 'admin' ? 'You: ' : '';
            const preview = el('span', 'truncate text-sm text-muted', who + (chat.lastMessage || ''));
            button.append(top, subject, preview);
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
        $('thread-name').textContent = chat.userName || 'Customer';
        const email = $('thread-email');
        email.textContent = chat.userEmail || 'no email';
        email.href = chat.userEmail ? `mailto:${chat.userEmail}?subject=${encodeURIComponent('Re: ' + chat.subject)}` : '#';
        $('thread-started').textContent = `Started ${longTime(chat.createdAt)}`;
        $('thread-status').replaceChildren(statusChip(chat.status));
        const open = chat.status === 'open';
        $('toggle-status').textContent = open ? 'Close chat' : 'Reopen chat';
        $('reopen-hint').classList.toggle('hidden', open);
    }

    function markRead() {
        const chat = activeChat();
        if (chat && chat.unreadForAdmin && !document.hidden) {
            updateDoc(doc(db, 'chats', chat.id), { unreadForAdmin: false }).catch((e) => console.error(e));
        }
    }
    document.addEventListener('visibilitychange', markRead);

    function openChat(id) {
        activeId = id;
        if (stopMessages) stopMessages();
        $('empty-view').classList.add('hidden');
        $('thread-view').classList.remove('hidden');
        $('thread-view').classList.add('flex');
        setPane(listPane, threadPane, 'thread');
        renderList();
        renderHeader();
        const box = $('messages');
        box.textContent = '';
        box.dataset.fresh = '1';
        stopMessages = onSnapshot(
            query(collection(db, 'chats', id, 'messages'), orderBy('createdAt')),
            (snap) => renderMessages(box, snap.docs.map((d) => d.data()), 'admin'),
            (error) => console.error(error)
        );
        markRead();
        history.replaceState(null, '', `inbox.html?c=${encodeURIComponent(id)}`);
    }

    function closeThread() {
        activeId = null;
        if (stopMessages) stopMessages();
        stopMessages = null;
        $('thread-view').classList.add('hidden');
        $('thread-view').classList.remove('flex');
        $('empty-view').classList.remove('hidden');
        setPane(listPane, threadPane, 'list');
        history.replaceState(null, '', 'inbox.html');
    }

    // Filters + search
    document.querySelectorAll('[data-filter]').forEach((button) => {
        button.addEventListener('click', () => {
            filter = button.dataset.filter;
            document.querySelectorAll('[data-filter]').forEach((b) => b.classList.toggle('is-active', b === button));
            renderList();
        });
    });
    $('search').addEventListener('input', (event) => {
        search = event.target.value.trim().toLowerCase();
        renderList();
    });
    document.querySelectorAll('[data-back]').forEach((b) => b.addEventListener('click', closeThread));

    // Close / reopen
    $('toggle-status').addEventListener('click', async () => {
        const chat = activeChat();
        if (!chat) return;
        try {
            await updateDoc(doc(db, 'chats', chat.id), { status: chat.status === 'open' ? 'closed' : 'open' });
        } catch (e) {
            console.error(e);
            alert('Couldn’t change that chat. Try again.');
        }
    });

    // Mark unread: goes back to the list so it stays unread
    $('mark-unread').addEventListener('click', async () => {
        const chat = activeChat();
        if (!chat) return;
        closeThread();
        try {
            await updateDoc(doc(db, 'chats', chat.id), { unreadForAdmin: true });
        } catch (e) {
            console.error(e);
        }
    });

    // Delete the chat and every message in it
    $('delete-chat').addEventListener('click', async () => {
        const chat = activeChat();
        if (!chat) return;
        if (!confirm(`Delete the chat “${chat.subject}” with ${chat.userName || chat.userEmail}? This can't be undone.`)) return;
        try {
            const chatRef = doc(db, 'chats', chat.id);
            const messages = await getDocs(collection(chatRef, 'messages'));
            const refs = messages.docs.map((d) => d.ref);
            for (let i = 0; i < refs.length; i += 400) {
                const batch = writeBatch(db);
                refs.slice(i, i + 400).forEach((ref) => batch.delete(ref));
                await batch.commit();
            }
            const last = writeBatch(db);
            last.delete(chatRef);
            await last.commit();
            closeThread();
        } catch (e) {
            console.error(e);
            alert('Couldn’t delete that chat. Try again.');
        }
    });

    // Reply as the team (reopens a closed chat)
    const input = $('composer-input');
    const composer = wireComposer(input, send);
    $('composer').addEventListener('submit', (event) => {
        event.preventDefault();
        send();
    });

    async function send() {
        const chat = activeChat();
        const text = input.value.trim().slice(0, MAX_MESSAGE);
        if (!chat || !text) return;
        composer.reset();
        try {
            const chatRef = doc(db, 'chats', chat.id);
            const batch = writeBatch(db);
            batch.set(doc(collection(chatRef, 'messages')), {
                senderId: user.uid,
                senderRole: 'admin',
                senderName: TEAM_NAME,
                text,
                createdAt: serverTimestamp(),
            });
            batch.update(chatRef, {
                lastMessage: text.slice(0, 300),
                lastSender: 'admin',
                unreadForUser: true,
                unreadForAdmin: false,
                status: 'open',
                updatedAt: serverTimestamp(),
            });
            $('messages').dataset.fresh = '1';
            await batch.commit();
        } catch (e) {
            console.error(e);
            input.value = text;
            alert('Couldn’t send that reply. Check your connection and try again.');
        }
    }
}
