/* ==========================================================================
   Lexicon - UI Toast Module
   Stacked, accessible notifications (success | error | info | warning)
   ========================================================================== */

window.Lexicon = window.Lexicon || {};
window.Lexicon.UI = window.Lexicon.UI || {};

(function() {
    const MAX_VISIBLE = 4;

    const THEMES = {
        success: { icon: 'ph ph-check-circle text-xl text-leaf', bg: 'bg-soil text-white' },
        info: { icon: 'ph ph-info text-xl text-leaf', bg: 'bg-soil text-white' },
        warning: { icon: 'ph ph-warning text-xl text-yellow-300', bg: 'bg-earth text-white' },
        error: { icon: 'ph ph-warning-circle text-xl text-white', bg: 'bg-terracotta text-white' }
    };

    function getContainer() {
        let el = document.getElementById('toast-stack');
        if (!el) {
            el = document.createElement('div');
            el.id = 'toast-stack';
            el.className = 'fixed bottom-6 right-6 z-[10000] flex flex-col items-end gap-2 pointer-events-none max-w-[min(92vw,28rem)]';
            el.setAttribute('aria-live', 'polite');
            el.setAttribute('aria-atomic', 'false');
            document.body.appendChild(el);
            // The legacy single #toast element is no longer used
            const legacy = document.getElementById('toast');
            if (legacy) legacy.classList.add('hidden');
        }
        return el;
    }

    function dismiss(node) {
        if (!node || node._dismissed) return;
        node._dismissed = true;
        node.classList.add('opacity-0', 'translate-y-2');
        setTimeout(() => node.remove(), 250);
    }

    window.Lexicon.UI.Toast = {
        /**
         * Display a floating toast notification
         * @param {string} message - Notification text (rendered as plain text)
         * @param {'success'|'error'|'info'|'warning'} type - Toast type
         * @param {number} [duration] - Milliseconds before auto-dismiss
         */
        show(message, type = 'success', duration) {
            if (!document.body) return;
            const theme = THEMES[type] || THEMES.info;
            const ms = duration || (type === 'error' ? 6000 : type === 'warning' ? 5000 : 3200);
            const container = getContainer();

            // Collapse identical consecutive messages
            const last = container.lastElementChild;
            if (last && last._message === message && !last._dismissed) {
                clearTimeout(last._timer);
                last._timer = setTimeout(() => dismiss(last), ms);
                return;
            }

            const node = document.createElement('div');
            node._message = message;
            node.className = `${theme.bg} pointer-events-auto border border-wood/60 rounded-xl shadow-2xl p-4 flex items-center gap-3 transition-all duration-300 opacity-0 translate-y-2 text-sm`;
            node.setAttribute('role', type === 'error' ? 'alert' : 'status');

            const icon = document.createElement('i');
            icon.className = theme.icon;
            icon.setAttribute('aria-hidden', 'true');

            const text = document.createElement('span');
            text.className = 'font-medium break-words min-w-0';
            text.textContent = String(message === undefined || message === null ? '' : message);

            const close = document.createElement('button');
            close.type = 'button';
            close.className = 'ml-1 opacity-70 hover:opacity-100 shrink-0 cursor-pointer';
            close.setAttribute('aria-label', 'Close');
            close.innerHTML = '<i class="ph ph-x" aria-hidden="true"></i>';
            close.addEventListener('click', () => dismiss(node));

            node.append(icon, text, close);
            container.appendChild(node);

            const live = Array.from(container.children).filter(c => !c._dismissed);
            live.slice(0, Math.max(0, live.length - MAX_VISIBLE)).forEach(dismiss);

            requestAnimationFrame(() => node.classList.remove('opacity-0', 'translate-y-2'));
            node._timer = setTimeout(() => dismiss(node), ms);
            node.addEventListener('mouseenter', () => clearTimeout(node._timer));
            node.addEventListener('mouseleave', () => { node._timer = setTimeout(() => dismiss(node), 1500); });
        }
    };

    // Global shortcut (bound so `this` is not required)
    window.showToast = (m, t, d) => window.Lexicon.UI.Toast.show(m, t, d);
})();
