// Small helpers shared by the customer chat page and the team inbox.
// Everything user-written goes in with textContent, never innerHTML.

export const TEAM_NAME = 'Website Requests +';
export const MAX_MESSAGE = 2000;

export function millis(ts) {
    if (!ts) return Date.now(); // a write that hasn't reached the server yet
    if (typeof ts.toMillis === 'function') return ts.toMillis();
    return new Date(ts).getTime();
}

export function shortTime(ts) {
    if (!ts) return 'Sending…';
    const date = new Date(millis(ts));
    const now = new Date();
    const seconds = (now - date) / 1000;
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (date.toDateString() === now.toDateString()) {
        return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    }
    if (seconds < 6 * 86400) return date.toLocaleDateString([], { weekday: 'short' });
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export function longTime(ts) {
    if (!ts) return 'Sending…';
    return new Date(millis(ts)).toLocaleString([], {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    });
}

export function el(tag, className = '', text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
}

export function statusChip(status) {
    const open = status === 'open';
    return el(
        'span',
        'inline-flex flex-none items-center rounded-full px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider ' +
            (open ? 'bg-emerald-50 text-emerald-700' : 'bg-mist text-muted'),
        open ? 'Open' : 'Closed'
    );
}

// Renders a thread. `mine` is the senderRole drawn on the right in blue.
export function renderMessages(container, messages, mine) {
    const nearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 120;
    container.textContent = '';
    let lastDay = '';
    messages.forEach((message) => {
        const day = new Date(millis(message.createdAt)).toDateString();
        if (day !== lastDay) {
            lastDay = day;
            const label = day === new Date().toDateString() ? 'Today' : new Date(millis(message.createdAt)).toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
            container.appendChild(el('p', 'py-2 text-center font-mono text-[11px] uppercase tracking-wider text-subtle', label));
        }
        const isMine = message.senderRole === mine;
        const row = el('div', 'flex ' + (isMine ? 'justify-end' : 'justify-start'));
        const wrap = el('div', 'max-w-[85%] sm:max-w-[70%]');
        const bubble = el(
            'div',
            'whitespace-pre-wrap break-words rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed ' +
                (isMine ? 'rounded-br-md bg-brand text-white' : 'rounded-bl-md border border-line bg-white text-ink'),
            message.text
        );
        const who = message.senderRole === 'admin' ? TEAM_NAME : message.senderName || 'Customer';
        const meta = el('p', 'mt-1 px-1 text-[11px] text-subtle ' + (isMine ? 'text-right' : ''), `${who} · ${shortTime(message.createdAt)}`);
        meta.title = longTime(message.createdAt);
        wrap.append(bubble, meta);
        row.appendChild(wrap);
        container.appendChild(row);
    });
    if (nearBottom || container.dataset.fresh === '1') {
        container.scrollTop = container.scrollHeight;
        container.dataset.fresh = '';
    }
}

// Textarea grows with its text; Enter sends on computers, Shift+Enter adds a line
export function wireComposer(textarea, onSend) {
    const grow = () => {
        textarea.style.height = 'auto';
        textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`;
    };
    textarea.addEventListener('input', grow);
    textarea.addEventListener('keydown', (event) => {
        const desktop = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
        if (event.key === 'Enter' && !event.shiftKey && desktop) {
            event.preventDefault();
            onSend();
        }
    });
    return { reset: () => ((textarea.value = ''), grow()) };
}

// Two-pane layout: on phones only one pane shows at a time
export function setPane(listPane, threadPane, view) {
    listPane.classList.toggle('hidden', view === 'thread');
    threadPane.classList.toggle('hidden', view === 'list');
    threadPane.classList.toggle('flex', view === 'thread');
}
