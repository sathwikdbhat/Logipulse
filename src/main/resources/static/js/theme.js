// LogiPulse — theme.js — Light / Dark theme toggle — works on ALL pages

(function () {
    // Apply theme immediately to prevent flash of wrong theme
    var saved = localStorage.getItem('logipulse-theme') || 'dark';
    if (saved === 'light') {
        document.documentElement.classList.add('light-theme');
    }

    document.addEventListener('DOMContentLoaded', function () {
        // Apply to body as well
        if (saved === 'light') {
            document.body.classList.add('light-theme');
        }
        injectThemeToggle();
    });

    // Inject the toggle button into whatever nav exists on this page
    function injectThemeToggle() {
        // Try all known nav right-side containers
        var target =
            document.querySelector('.nav-right') ||
            document.querySelector('.header-actions') ||
            document.querySelector('.nav-actions');

        if (!target) return;
        if (document.getElementById('themeToggleBtn')) return;

        var btn = document.createElement('button');
        btn.id        = 'themeToggleBtn';
        btn.title     = 'Toggle Light/Dark Mode';
        btn.style.cssText =
            'width:36px;height:36px;border-radius:8px;border:1px solid var(--border-normal);' +
            'background:var(--bg-card);cursor:pointer;font-size:17px;' +
            'display:flex;align-items:center;justify-content:center;' +
            'transition:all 0.2s;flex-shrink:0;margin-right:8px;' +
            'color:var(--text-primary);';
        btn.addEventListener('mouseenter', function () {
            btn.style.borderColor = 'var(--accent-blue)';
        });
        btn.addEventListener('mouseleave', function () {
            btn.style.borderColor = 'var(--border-normal)';
        });
        btn.addEventListener('click', toggleTheme);
        updateIcon(btn);

        // Insert as first child of the target container
        target.insertBefore(btn, target.firstChild);
    }

    // Toggle between dark and light
    function toggleTheme() {
        var isLight = document.body.classList.toggle('light-theme');
        document.documentElement.classList.toggle('light-theme', isLight);
        localStorage.setItem('logipulse-theme', isLight ? 'light' : 'dark');
        saved = isLight ? 'light' : 'dark';
        var btn = document.getElementById('themeToggleBtn');
        if (btn) updateIcon(btn);
    }

    function updateIcon(btn) {
        var isLight = document.body.classList.contains('light-theme');
        btn.innerHTML  = isLight ? '🌙' : '☀️';
        btn.title      = isLight ? 'Switch to Dark Mode' : 'Switch to Light Mode';
    }

    // Expose globally so pages can call it directly if needed
    window.toggleTheme = toggleTheme;
})();