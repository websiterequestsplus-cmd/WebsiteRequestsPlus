(function () {
    const DISCORD_URL = 'https://discord.gg/3CdYWtE7K3';
    const BUSINESS_EMAIL = 'websiterequestsplus@gmail.com';

    const requestForm = document.getElementById('request-form');
    const methodDiscord = document.getElementById('method-discord');
    const methodEmail = document.getElementById('method-email');
    const emailFieldWrap = document.getElementById('email-field-wrap');
    const emailNotice = document.getElementById('email-notice');
    const submitBtn = document.getElementById('request-submit-btn');
    const submitHint = document.getElementById('submit-hint');

    if (!requestForm) return;

    // Discord can be switched off site-wide in site-config.js
    const DISCORD_ON = !window.SITE || window.SITE.discord !== false;
    // Once chat is set up (firebase-config.js adds .chat-on), the form starts a chat instead
    const CHAT_ON = document.documentElement.classList.contains('chat-on');
    const DEFAULT_METHOD = CHAT_ON ? 'chat' : DISCORD_ON ? 'discord' : 'email';

    let contactMethod = DEFAULT_METHOD;

    if (CHAT_ON) {
        // The chat account already knows the name and email
        document.getElementById('method-group').classList.add('hidden');
        document.getElementById('name-wrap').classList.add('hidden');
        document.getElementById('title-wrap').classList.add('sm:col-span-2');
        document.getElementById('ticket-name').required = false;
    }

    function setContactMethod(method) {
        contactMethod = method;

        if (method === 'chat') {
            emailFieldWrap.classList.add('hidden');
            emailNotice.classList.add('hidden');
            submitBtn.textContent = 'Continue to chat';
            submitHint.textContent = 'Sign in with Google or email, then send it. We reply right in the chat.';
            return;
        }

        const isDiscord = method === 'discord';
        methodDiscord.classList.toggle('method-active', isDiscord);
        methodEmail.classList.toggle('method-active', !isDiscord);
        methodDiscord.setAttribute('aria-pressed', String(isDiscord));
        methodEmail.setAttribute('aria-pressed', String(!isDiscord));
        emailFieldWrap.classList.toggle('hidden', isDiscord);
        emailNotice.classList.toggle('hidden', isDiscord);

        submitBtn.textContent = isDiscord ? 'Send via Discord' : 'Send via Email';
        submitHint.textContent = isDiscord
            ? 'Your details are copied, then Discord opens so you can paste them.'
            : 'Your email app opens with the request ready to send to our inbox.';
    }

    methodDiscord.addEventListener('click', () => setContactMethod('discord'));
    methodEmail.addEventListener('click', () => setContactMethod('email'));
    setContactMethod(DEFAULT_METHOD);

    function buildRequestSummary(data) {
        return [
            'Quote Request — Website Requests +',
            '',
            `Name: ${data.name}`,
            `Reply Email: ${data.replyEmail || 'Not provided'}`,
            `Website Type: ${data.type}`,
            `Website Name: ${data.websiteName}`,
            '',
            'Description:',
            data.description
        ].join('\n');
    }

    async function copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch {
            return false;
        }
    }


    function openMailClient(data) {
        const subject = encodeURIComponent(`Quote Request: ${data.websiteName}`);
        const body = encodeURIComponent(buildRequestSummary(data));
        window.location.href = `mailto:${BUSINESS_EMAIL}?subject=${subject}&body=${body}`;
    }

    function collectFormData() {
        return {
            name: document.getElementById('ticket-name').value.trim(),
            type: document.getElementById('ticket-category').value,
            websiteName: document.getElementById('ticket-title').value.trim(),
            description: document.getElementById('ticket-prompt').value.trim(),
            replyEmail: document.getElementById('ticket-email').value.trim()
        };
    }

    // Hands the request to chat.html, which opens a new chat already filled in
    function startChat(data) {
        const select = document.getElementById('ticket-category');
        const typeLabel = select.options[select.selectedIndex].textContent.trim();
        const draft = {
            subject: `${data.websiteName} (${typeLabel})`.slice(0, 120),
            message: `${data.description}\n\nWebsite type: ${typeLabel}`.slice(0, 2000),
        };
        try {
            sessionStorage.setItem('wr-chat-draft', JSON.stringify(draft));
        } catch (e) {
            // Storage blocked: they'll type it into the chat instead
        }
        window.location.href = 'chat.html';
    }

    requestForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        const data = collectFormData();

        if (contactMethod === 'chat') {
            if (!data.websiteName || !data.description) {
                window.showToast('Please fill in your website name and what you want.');
                return;
            }
            startChat(data);
            return;
        }

        if (!data.name || !data.websiteName || !data.description) {
            window.showToast('Please fill in your name, website name, and description.');
            return;
        }

        if (contactMethod === 'email' && !data.replyEmail) {
            window.showToast('Add your email so we can reply to your request.');
            return;
        }

        if (contactMethod === 'email' && !document.getElementById('ticket-email').checkValidity()) {
            window.showToast('That email address doesn’t look right.');
            return;
        }

        submitBtn.disabled = true;
        submitBtn.classList.add('opacity-70', 'cursor-wait');

        try {
            const summary = buildRequestSummary(data);

            if (contactMethod === 'discord') {
                const copied = await copyToClipboard(summary);
                window.open(DISCORD_URL, '_blank', 'noopener,noreferrer');
                window.showToast(
                    copied
                        ? 'Request ready! Details copied — paste them in Discord.'
                        : 'Request ready! Share your details in Discord.'
                );
            } else {
                openMailClient(data);
                requestForm.reset();
                setContactMethod(DEFAULT_METHOD);
                return;
            }

            requestForm.reset();
            setContactMethod(DEFAULT_METHOD);
        } catch (error) {
            console.error(error);
            window.showToast('Something went wrong. Try Discord for the fastest response.');
        } finally {
            submitBtn.disabled = false;
            submitBtn.classList.remove('opacity-70', 'cursor-wait');
        }
    });
})();
