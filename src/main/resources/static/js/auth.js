// LogiPulse — auth.js

var AUTH_KEY = 'logipulse_user';

function getCurrentUser() {
    try {
        var raw = localStorage.getItem(AUTH_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
}

function storeUser(user) {
    localStorage.setItem(AUTH_KEY, JSON.stringify(user));
}

function clearUser() {
    localStorage.removeItem(AUTH_KEY);
}

function isLoggedIn() {
    return getCurrentUser() !== null;
}

// Require login — redirect to login if not logged in
function requireAuth() {
    if (!isLoggedIn()) {
        window.location.href = '/login.html';
        return false;
    }
    // If DRIVER tries to access index.html, redirect to driver dashboard
    var user = getCurrentUser();
    if (user && user.role === 'DRIVER' &&
        (window.location.pathname === '/index.html' ||
            window.location.pathname === '/shipments.html' ||
            window.location.pathname === '/fleet.html')) {
        window.location.href = '/driver.html';
        return false;
    }
    return true;
}

// Require DRIVER role — redirect non-drivers away from driver page
function requireDriverAuth() {
    if (!isLoggedIn()) {
        window.location.href = '/login.html';
        return false;
    }
    var user = getCurrentUser();
    if (!user || user.role !== 'DRIVER') {
        window.location.href = '/index.html';
        return false;
    }
    return true;
}

function redirectIfLoggedIn() {
    if (isLoggedIn()) {
        var user = getCurrentUser();
        if (user && user.role === 'DRIVER') {
            window.location.href = '/driver.html';
        } else {
            window.location.href = '/index.html';
        }
    }
}

function getRoleColor(role) {
    var colors = {
        'ADMIN':    '#ef4444',
        'OPERATOR': '#4fc3f7',
        'DRIVER':   '#10b981'
    };
    return colors[role] || '#94a3b8';
}

async function apiLogin(username, password) {
    var response = await fetch('/api/auth/login', {
        method:      'POST',
        headers:     { 'Content-Type': 'application/json' },
        credentials: 'include',
        body:        JSON.stringify({ username: username, password: password })
    });
    var data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Login failed');
    return data;
}

async function apiRegister(userData) {
    var response = await fetch('/api/auth/register', {
        method:      'POST',
        headers:     { 'Content-Type': 'application/json' },
        credentials: 'include',
        body:        JSON.stringify(userData)
    });
    var data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Registration failed');
    return data;
}

async function apiLogout() {
    try {
        await fetch('/api/auth/logout', {
            method:      'POST',
            credentials: 'include'
        });
    } catch (e) { console.error('Logout error:', e); }
    clearUser();
    window.location.href = '/welcome.html';
}

async function apiRegisterDriver(driverData) {
    var response = await fetch('/api/auth/register-driver', {
        method:      'POST',
        headers:     { 'Content-Type': 'application/json' },
        credentials: 'include',
        body:        JSON.stringify(driverData)
    });
    var data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to create driver');
    return data;
}

function showFormError(elementId, message) {
    var el = document.getElementById(elementId);
    if (el) { el.textContent = message; el.style.display = 'block'; }
}

function hideFormError(elementId) {
    var el = document.getElementById(elementId);
    if (el) el.style.display = 'none';
}

function setButtonLoading(buttonId, loading, originalText) {
    var btn = document.getElementById(buttonId);
    if (!btn) return;
    btn.disabled    = loading;
    btn.textContent = loading ? 'Please wait...' : originalText;
}