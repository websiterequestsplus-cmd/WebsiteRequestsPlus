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

    let contactMethod = 'discord';

    function setContactMethod(method) {
        contactMethod = method;

        const isDiscord = method === 'discord';
        methodDiscord.classList.toggle('method-active', isDiscord);
        methodEmail.classList.toggle('method-active', !isDiscord);
        emailFieldWrap.classList.toggle('hidden', isDiscord);
        emailNotice.classList.toggle('hidden', isDiscord);

        submitBtn.textContent = isDiscord ? 'Submit & Open Discord' : 'Compose Email';
        submitHint.textContent = isDiscord
            ? 'Recommended — connect with us instantly in our Discord workspace.'
            : 'This will open your email client so you can send the request directly to our inbox.';
    }

    methodDiscord.addEventListener('click', () => setContactMethod('discord'));
    methodEmail.addEventListener('click', () => setContactMethod('email'));
    setContactMethod('discord');

    function buildRequestSummary(data) {
        return [
            'New Website Request — WEBSITE REQUESTS +',
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
        const subject = encodeURIComponent(`Website Request: ${data.websiteName}`);
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

    requestForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        const data = collectFormData();

        if (!data.name || !data.websiteName || !data.description) {
            window.showToast('Please fill in your name, website name, and description.');
            return;
        }

        if (contactMethod === 'email' && !data.replyEmail) {
            window.showToast('Add your email so we can reply to your request.');
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
                setContactMethod('discord');
                return;
            }

            requestForm.reset();
            setContactMethod('discord');
        } catch (error) {
            console.error(error);
            window.showToast('Something went wrong. Try Discord for the fastest response.');
        } finally {
            submitBtn.disabled = false;
            submitBtn.classList.remove('opacity-70', 'cursor-wait');
        }
    });
})();
