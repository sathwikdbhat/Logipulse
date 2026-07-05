// LogiPulse — fleet.js (Perfect 5-Column Alignment for HTML)

var API_BASE = window.API_BASE || window.location.origin;

var allVehicles        = [];
var allDrivers         = [];
var assigningVehicleId = null;
var assigningDriverId  = null;

document.addEventListener('DOMContentLoaded', function () {
    if (typeof requireAuth === 'function' && !requireAuth()) return;

    var user = getCurrentUser ? getCurrentUser() : null;
    if (user) {
        var av = document.getElementById('navAvatar');
        var nm = document.getElementById('navName');
        var rl = document.getElementById('navRole');
        if (av) av.textContent = (user.fullName || user.username).charAt(0).toUpperCase();
        if (nm) nm.textContent = user.fullName || user.username;
        if (rl) {
            rl.textContent = user.role;
            rl.style.color = user.role === 'ADMIN' ? '#ef4444' :
                user.role === 'OPERATOR' ? '#4fc3f7' : '#10b981';
        }
    }

    loadAll();
    setInterval(loadAll, 20000);

    // Initialize on Vehicle Registry tab
    var firstTabBtn = document.querySelector('.page-tab-btn');
    if (firstTabBtn) switchTab('vehicles', firstTabBtn);
});

// LOAD ALL DATA
async function loadAll() {
    await Promise.all([loadVehicles(), loadDrivers()]);
}

// LOAD VEHICLES
async function loadVehicles() {
    var grid = document.getElementById('vehiclesGrid');
    try {
        var resp = await fetch(API_BASE + '/api/vehicles', { credentials: 'include' });
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        var data = await resp.json();
        allVehicles = Array.isArray(data) ? data : [];
        renderVehicleGrid(allVehicles);
    } catch (e) {
        console.error('Failed to load vehicles:', e);
        if (grid) grid.innerHTML =
            '<p style="color:#ef4444;padding:20px;">Failed to load vehicles: ' + e.message + '</p>';
    }
}

function renderVehicleGrid(vehicles) {
    var grid = document.getElementById('vehiclesGrid');
    if (!grid) return;

    if (vehicles.length === 0) {
        grid.innerHTML =
            '<p style="color:var(--text-muted);font-size:13px;padding:20px;">' +
            'No vehicles registered yet. Click "+ Register Vehicle" above to add one.</p>';
        return;
    }

    var user    = getCurrentUser ? getCurrentUser() : null;
    var isAdmin = user && user.role === 'ADMIN';
    var html    = '';

    vehicles.forEach(function (v) {
        html +=
            '<div class="vehicle-card ' + v.status + '">' +
            '<div class="vehicle-card-top">' +
            '<span class="vehicle-reg">' + v.registrationNumber + '</span>' +
            '<span class="vehicle-status-badge ' + v.status + '">' +
            v.status.replace(/_/g,' ') +
            '</span>' +
            '</div>' +
            '<div class="vehicle-detail-row"><strong>Type:</strong> ' +
            v.vehicleType.replace(/_/g,' ') + '</div>' +
            '<div class="vehicle-detail-row"><strong>Capacity:</strong> ' +
            (v.capacityTons || '--') + ' tons</div>' +
            '<div class="vehicle-detail-row"><strong>Make:</strong> ' +
            (v.manufacturerName || '--') + ' ' + (v.modelYear || '') + '</div>' +

            '<div class="vehicle-driver-row">' +
            (v.assignedDriverName
                    ?   '<div>' +
                    '<div class="driver-name">&#128100; ' + v.assignedDriverName + '</div>' +
                    '<div style="font-size:11px;color:var(--text-muted);">Assigned driver</div>' +
                    '</div>' +
                    (isAdmin
                        ? '<button class="btn-assign" ' +
                        'style="background:rgba(239,68,68,0.1);color:#ef4444;border-color:rgba(239,68,68,0.3);" ' +
                        'onclick="unassignDriverFromVehicle(' + v.id + ')">&#10005; Remove</button>'
                        : '')
                    :   '<span class="no-driver">No driver assigned</span>' +
                    (isAdmin
                        ? '<button class="btn-assign" ' +
                        'onclick="openAssignDriverToVehicleModal(' + v.id + ',\'' + v.registrationNumber + '\')">' +
                        '&#43; Assign Driver</button>'
                        : '')
            ) +
            '</div>' +

            (isAdmin
                ? '<div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border-dim);display:flex;gap:6px;">' +
                '<button onclick="deleteVehicle(' + v.id + ',\'' + v.registrationNumber + '\')" ' +
                'style="padding:4px 12px;font-size:11px;font-weight:600;cursor:pointer;' +
                'background:rgba(239,68,68,0.1);color:#ef4444;border:1px solid rgba(239,68,68,0.3);' +
                'border-radius:6px;font-family:var(--font-main);">&#128465; Delete</button>' +
                '</div>'
                : '') +
            '</div>';
    });

    grid.innerHTML = html;
}

// LOAD DRIVERS (Table Alignment Fixed)
async function loadDrivers() {
    try {
        var resp = await fetch(API_BASE + '/api/auth/users', { credentials: 'include' });
        if (!resp.ok) return;
        var users  = await resp.json();
        allDrivers = users.filter(function (u) { return u.role === 'DRIVER'; });
        renderDriversTable();
    } catch (e) {
        console.error('Failed to load drivers:', e);
    }
}

function renderDriversTable() {
    var tbody = document.getElementById('driversBody');
    if (!tbody) return;

    if (allDrivers.length === 0) {
        // Colspan changed to 5 to match the 5 table headers
        tbody.innerHTML =
            '<tr><td colspan="5" class="table-empty" style="text-align:center; padding:20px; color:var(--text-muted);">' +
            'No drivers registered. Click "+ Register Driver" to create a driver account.' +
            '</td></tr>';
        return;
    }

    var user    = getCurrentUser ? getCurrentUser() : null;
    var isAdmin = user && user.role === 'ADMIN';
    var html    = '';

    allDrivers.forEach(function (d) {
        var assignedVehicle = allVehicles.find(function (v) {
            return v.assignedDriverId === d.id;
        });

        html += '<tr class="table-row">';

        // Column 1: Driver (Name & Username)
        html += '<td>' +
            '<div style="font-weight:500; color:var(--text-primary);">' + (d.fullName || '--') + '</div>' +
            '<div style="font-size:11px; color:var(--text-muted);">@' + (d.username || '--') + '</div>' +
            '</td>';

        // Column 2: Contact (Phone & Email)
        html += '<td style="font-size:12px;">' +
            (d.phoneNumber && d.phoneNumber.trim()
                ? '<div style="color:var(--text-primary);">' + d.phoneNumber + '</div>'
                : '') +
            (d.email && d.email.trim()
                ? '<div style="font-size:11px;color:var(--text-muted);">' + d.email + '</div>'
                : '') +
            (!d.phoneNumber && !d.email
                ? '<span style="color:var(--text-muted);">--</span>'
                : '') +
            '</td>';

        // Column 3: Assigned Vehicle (Registration Number Only)
        html += '<td>' +
            (assignedVehicle
                ? '<span style="font-weight:600; font-size:13px; color:var(--text-primary);">' + assignedVehicle.registrationNumber + '</span>'
                : '<span style="color:var(--text-muted); font-size:13px;">No Vehicle</span>') +
            '</td>';

        // Column 4: Vehicle Status (Status Badge Only)
        html += '<td>' +
            (assignedVehicle
                ? '<span class="vehicle-status-badge ' + assignedVehicle.status + '">' + assignedVehicle.status.replace(/_/g,' ') + '</span>'
                : '<span style="color:var(--text-muted);">--</span>') +
            '</td>';

        // Column 5: Action (Assign/Remove Vehicle + Delete Driver)
        html += '<td>' +
            (isAdmin
                ? (assignedVehicle
                        ? '<button onclick="unassignDriverFromVehicle(' + assignedVehicle.id + ')" ' +
                        'style="padding:4px 10px;font-size:11px;font-weight:600;cursor:pointer;' +
                        'background:rgba(239,68,68,0.1);color:#ef4444;border:1px solid rgba(239,68,68,0.3);' +
                        'border-radius:6px;font-family:var(--font-main);margin-right:4px;">Remove</button>'
                        : '<button onclick="openAssignVehicleToDriverModal(' + d.id + ',\'' + d.fullName + '\')" ' +
                        'style="padding:4px 10px;font-size:11px;font-weight:600;cursor:pointer;' +
                        'background:rgba(167,139,250,0.1);color:#a78bfa;border:1px solid rgba(167,139,250,0.3);' +
                        'border-radius:6px;font-family:var(--font-main);margin-right:4px;">Assign Vehicle</button>'
                ) +
                '<button onclick="deleteDriver(' + d.id + ',\'' + d.fullName + '\')" ' +
                'style="padding:4px 8px;font-size:13px;cursor:pointer;' +
                'background:rgba(239,68,68,0.1);color:#ef4444;border:1px solid rgba(239,68,68,0.3);' +
                'border-radius:6px;" title="Delete driver">&#128465;</button>'
                : '--') +
            '</td>';

        html += '</tr>';
    });

    tbody.innerHTML = html;
}

// TAB SWITCHING
function switchTab(name, btn) {
    document.querySelectorAll('.tab-pane').forEach(function (p) {
        p.classList.remove('active');
    });
    document.querySelectorAll('.page-tab-btn').forEach(function (b) {
        b.classList.remove('active');
    });

    var pane = document.getElementById('tab-' + name);
    if (pane) pane.classList.add('active');
    if (btn)  btn.classList.add('active');

    var user    = getCurrentUser ? getCurrentUser() : null;
    var isAdmin = user && user.role === 'ADMIN';

    var regVehicleBtn = document.getElementById('regVehicleBtn');
    var regDriverBtn  = document.getElementById('regDriverBtn');

    if (regVehicleBtn) {
        regVehicleBtn.style.display = (name === 'vehicles' && isAdmin) ? 'inline-block' : 'none';
    }
    if (regDriverBtn) {
        regDriverBtn.style.display = (name === 'drivers' && isAdmin) ? 'inline-block' : 'none';
    }
}

// MODAL: Assign Driver TO Vehicle (from Vehicle Registry)
function openAssignDriverToVehicleModal(vehicleId, regNumber) {
    assigningVehicleId = vehicleId;

    var regEl = document.getElementById('assignVehicleReg');
    if (regEl) regEl.textContent = regNumber;

    var sel = document.getElementById('assignDriverSelect');
    sel.innerHTML = '<option value="">-- Select a driver --</option>';

    var available = allDrivers.filter(function (d) {
        return !allVehicles.some(function (v) { return v.assignedDriverId === d.id; });
    });

    if (available.length === 0) {
        sel.innerHTML += '<option disabled>All drivers are currently assigned</option>';
    } else {
        available.forEach(function (d) {
            var opt = document.createElement('option');
            opt.value = d.id;
            opt.textContent = d.fullName + ' (@' + d.username + ')';
            sel.appendChild(opt);
        });
    }

    document.getElementById('assignDriverModal').style.display = 'flex';
    hideMsg('assignError');
}

function closeAssignModal() {
    document.getElementById('assignDriverModal').style.display = 'none';
    assigningVehicleId = null;
}

async function submitAssignDriver() {
    var driverId = document.getElementById('assignDriverSelect').value;
    if (!driverId) {
        showMsg('assignError', 'Please select a driver.');
        return;
    }

    var btn = document.getElementById('assignSubmitBtn');
    btn.disabled = true; btn.textContent = 'Assigning...';

    try {
        var resp = await fetch(
            API_BASE + '/api/vehicles/' + assigningVehicleId + '/assign-driver',
            {
                method:      'PUT',
                headers:     { 'Content-Type': 'application/json' },
                credentials: 'include',
                body:        JSON.stringify({ driverId: parseInt(driverId) })
            }
        );
        var data = await resp.json();

        if (resp.ok) {
            showToast('success', '&#128100; Driver Assigned',
                'Driver assigned to vehicle successfully.');
            closeAssignModal();
            loadAll();
        } else {
            showMsg('assignError', data.error || 'Failed to assign driver.');
        }
    } catch (e) {
        showMsg('assignError', 'Network error: ' + e.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = '&#128100; Assign Driver';
    }
}

// MODAL: Assign Vehicle TO Driver (from Driver Assignment tab)
function openAssignVehicleToDriverModal(driverId, driverName) {
    assigningDriverId = driverId;

    var nameEl = document.getElementById('assignDriverName');
    if (nameEl) nameEl.textContent = driverName;

    var sel = document.getElementById('assignVehicleSelect');
    sel.innerHTML = '<option value="">-- Select a vehicle --</option>';

    var available = allVehicles.filter(function (v) {
        return !v.assignedDriverId;
    });

    if (available.length === 0) {
        sel.innerHTML += '<option disabled>No unassigned vehicles available</option>';
    } else {
        available.forEach(function (v) {
            var opt = document.createElement('option');
            opt.value = v.id;
            opt.textContent = v.registrationNumber + ' (' +
                v.vehicleType.replace(/_/g,' ') + ') — ' +
                (v.capacityTons || '') + ' tons';
            sel.appendChild(opt);
        });
    }

    document.getElementById('assignVehicleToDriverModal').style.display = 'flex';
    hideMsg('vehicleAssignError');
}

function closeAssignVehicleModal() {
    document.getElementById('assignVehicleToDriverModal').style.display = 'none';
    assigningDriverId = null;
}

async function submitAssignVehicleToDriver() {
    var vehicleId = document.getElementById('assignVehicleSelect').value;
    if (!vehicleId) {
        showMsg('vehicleAssignError', 'Please select a vehicle.');
        return;
    }

    var btn = document.getElementById('assignVehicleSubmitBtn');
    btn.disabled = true; btn.textContent = 'Assigning...';

    try {
        var resp = await fetch(
            API_BASE + '/api/vehicles/' + vehicleId + '/assign-driver',
            {
                method:      'PUT',
                headers:     { 'Content-Type': 'application/json' },
                credentials: 'include',
                body:        JSON.stringify({ driverId: parseInt(assigningDriverId) })
            }
        );
        var data = await resp.json();

        if (resp.ok) {
            showToast('success', '&#128663; Vehicle Assigned',
                'Vehicle assigned to driver successfully.');
            closeAssignVehicleModal();
            loadAll();
        } else {
            showMsg('vehicleAssignError', data.error || 'Failed to assign vehicle.');
        }
    } catch (e) {
        showMsg('vehicleAssignError', 'Network error: ' + e.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = '&#128663; Assign Vehicle';
    }
}

// UNASSIGN DRIVER
async function unassignDriverFromVehicle(vehicleId) {
    if (!confirm('Remove the driver assignment from this vehicle?')) return;

    try {
        var resp = await fetch(
            API_BASE + '/api/vehicles/' + vehicleId + '/unassign-driver',
            { method: 'PUT', credentials: 'include' }
        );
        if (resp.ok) {
            showToast('success', 'Driver Removed', 'Driver unassigned successfully.');
            loadAll();
        } else {
            var data = await resp.json();
            showToast('danger', 'Error', data.error || 'Could not unassign driver.');
        }
    } catch (e) {
        showToast('danger', 'Error', e.message);
    }
}

// DELETE VEHICLE
async function deleteVehicle(vehicleId, regNumber) {
    if (!confirm('Delete vehicle ' + regNumber + '?\nThis action cannot be undone.')) return;

    try {
        var resp = await fetch(
            API_BASE + '/api/vehicles/' + vehicleId,
            { method: 'DELETE', credentials: 'include' }
        );
        if (resp.ok) {
            showToast('success', '&#128465; Deleted', regNumber + ' removed from fleet.');
            loadAll();
        } else {
            var data = await resp.json();
            showToast('danger', 'Delete Failed', data.error || 'Could not delete vehicle.');
        }
    } catch (e) {
        showToast('danger', 'Error', e.message);
    }
}

// REGISTER VEHICLE MODAL
function openRegisterModal() {
    document.getElementById('registerVehicleModal').style.display = 'flex';
    document.getElementById('vReg').value      = '';
    document.getElementById('vCapacity').value = '';
    document.getElementById('vYear').value     = '';
    document.getElementById('vMake').value     = '';
    hideMsg('vehicleError');
    hideMsg('vehicleSuccess');
}

function closeRegisterModal() {
    document.getElementById('registerVehicleModal').style.display = 'none';
}

async function submitRegisterVehicle() {
    hideMsg('vehicleError');

    var reg  = document.getElementById('vReg').value.trim().toUpperCase();
    var type = document.getElementById('vType').value;
    var cap  = document.getElementById('vCapacity').value;
    var year = document.getElementById('vYear').value;
    var make = document.getElementById('vMake').value.trim();

    if (!reg || !type) {
        showMsg('vehicleError', 'Registration number and vehicle type are required.');
        return;
    }

    var btn = document.getElementById('regVehicleBtnModal');
    btn.disabled = true; btn.textContent = 'Registering...';

    try {
        var resp = await fetch(API_BASE + '/api/vehicles', {
            method:      'POST',
            headers:     { 'Content-Type': 'application/json' },
            credentials: 'include',
            body:        JSON.stringify({
                registrationNumber: reg,
                vehicleType:        type,
                capacityTons:       cap  ? parseFloat(cap)  : 10,
                modelYear:          year ? parseInt(year)   : 2020,
                manufacturerName:   make
            })
        });
        var data = await resp.json();

        if (resp.ok || resp.status === 201) {
            showMsg('vehicleSuccess', '✓ Vehicle ' + reg + ' registered successfully!');
            setTimeout(function () { closeRegisterModal(); loadAll(); }, 1500);
        } else {
            showMsg('vehicleError', data.error || 'Failed to register vehicle.');
        }
    } catch (e) {
        showMsg('vehicleError', 'Network error: ' + e.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = '&#128663; Register';
    }
}

// REGISTER DRIVER MODAL
function openRegisterDriverModal() {
    document.getElementById('registerDriverModal').style.display = 'flex';
    ['drFullName','drUsername','drEmail','drPhone','drPassword'].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.value = '';
    });
    hideMsg('driverRegError');
    hideMsg('driverRegSuccess');
}

function closeRegisterDriverModal() {
    document.getElementById('registerDriverModal').style.display = 'none';
}

async function registerDriver() {
    hideMsg('driverRegError');

    var fullName = document.getElementById('drFullName').value.trim();
    var username = document.getElementById('drUsername').value.trim();
    var email    = document.getElementById('drEmail').value.trim();
    var phone    = document.getElementById('drPhone').value.trim();
    var password = document.getElementById('drPassword').value;

    if (!fullName || !username || !email || !password) {
        showMsg('driverRegError', 'All required fields must be filled.');
        return;
    }

    if (password.length < 6) {
        showMsg('driverRegError', 'Password must be at least 6 characters.');
        return;
    }

    var btn = document.getElementById('registerDriverBtnModal');
    btn.disabled = true; btn.textContent = 'Creating...';

    try {
        var resp = await fetch(API_BASE + '/api/auth/register-driver', {
            method:      'POST',
            headers:     { 'Content-Type': 'application/json' },
            credentials: 'include',
            body:        JSON.stringify({
                fullName:    fullName,
                username:    username,
                email:       email,
                password:    password,
                phoneNumber: phone
            })
        });
        var data = await resp.json();

        if (resp.ok || resp.status === 201) {
            showMsg('driverRegSuccess',
                '✓ Driver account created for ' + fullName +
                '. They can login with username: ' + username);
            setTimeout(function () { closeRegisterDriverModal(); loadAll(); }, 2000);
        } else {
            showMsg('driverRegError', data.error || 'Failed to create driver account.');
        }
    } catch (e) {
        showMsg('driverRegError', 'Network error: ' + e.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = '&#128100; Create Driver Account';
    }
}

// HELPERS
function showMsg(id, msg) {
    var el = document.getElementById(id);
    if (el) { el.textContent = msg; el.style.display = 'block'; }
}

function hideMsg(id) {
    var el = document.getElementById(id);
    if (el) el.style.display = 'none';
}

function showToast(type, title, message) {
    var c = document.getElementById('toastContainer');
    if (!c) return;
    var t = document.createElement('div');
    t.className = 'toast ' + type;
    t.innerHTML =
        '<div class="toast-title">'   + title   + '</div>' +
        '<div class="toast-message">' + message + '</div>';
    c.appendChild(t);
    setTimeout(function () {
        t.style.opacity    = '0';
        t.style.transform  = 'translateX(110%)';
        t.style.transition = 'all 0.3s ease';
        setTimeout(function () {
            if (t.parentNode) t.parentNode.removeChild(t);
        }, 300);
    }, 5000);
}

async function deleteDriver(driverId, fullName) {
    if (!confirm('Delete driver "' + fullName + '"?\n\nThis will remove their account permanently.\nThis cannot be undone.')) return;

    try {
        var resp = await fetch(API_BASE + '/api/auth/users/' + driverId,
            { method: 'DELETE', credentials: 'include' });
        if (resp.ok) {
            showToast('success', '&#128465; Driver Deleted',
                '"' + fullName + '" account removed from system.');
            loadAll();
        } else {
            var data = await resp.json();
            showToast('danger', 'Delete Failed', data.error || 'Could not delete driver.');
        }
    } catch (e) {
        showToast('danger', 'Error', e.message);
    }
}