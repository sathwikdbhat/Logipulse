// LogiPulse — shipments.js

var API_BASE = window.API_BASE || window.location.origin;

var allShipments  = [];
var activeFilter  = 'ALL';
var searchQuery   = '';

var STATUS_COLORS   = { 'IN_TRANSIT':'#4fc3f7','DELAYED':'#ef4444','REROUTED':'#a78bfa','DELIVERED':'#10b981' };
var PRIORITY_COLORS = { 'HIGH':'#ef4444','NORMAL':'#f59e0b','LOW':'#10b981' };

document.addEventListener('DOMContentLoaded', function () {
    if (typeof requireAuth === 'function' && !requireAuth()) return;

    var user = getCurrentUser ? getCurrentUser() : null;
    if (user) {
        var av = document.getElementById('navAvatar');
        var nm = document.getElementById('navName');
        var rl = document.getElementById('navRole');
        if (av) av.textContent = (user.fullName || user.username).charAt(0).toUpperCase();
        if (nm) nm.textContent = user.fullName || user.username;
        if (rl) { rl.textContent = user.role; rl.style.color = user.role === 'ADMIN' ? '#ef4444' : '#4fc3f7'; }
    }

    loadShipments();
    setInterval(loadShipments, 15000);
});

// DISTANCE (Haversine)
function calcDistanceKm(lat1, lng1, lat2, lng2) {
    if (!lat1 || !lat2) return null;
    var R = 6371, dLat = (lat2-lat1)*Math.PI/180, dLng = (lng2-lng1)*Math.PI/180;
    var a = Math.sin(dLat/2)*Math.sin(dLat/2) +
        Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)*Math.sin(dLng/2);
    return Math.round(R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a)));
}

function calcProgress(s) {
    if (s.status === 'DELIVERED') return 100;
    if (!s.originLat || !s.destLat) return 0;
    var total   = euclidDist(s.originLat,s.originLng,s.destLat,s.destLng);
    var covered = euclidDist(s.originLat,s.originLng,s.currentLat,s.currentLng);
    return total === 0 ? 0 : Math.min(99,Math.round((covered/total)*100));
}

function euclidDist(a,b,c,d) { return Math.sqrt(Math.pow(c-a,2)+Math.pow(d-b,2)); }

// LOAD SHIPMENTS
async function loadShipments() {
    try {
        var resp = await fetch(API_BASE + '/api/shipments', { credentials: 'include' });
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        allShipments = await resp.json();
        updateStats(allShipments);
        renderTable(getFiltered());
    } catch (e) { console.error('loadShipments:', e); }
}

function getFiltered() {
    return allShipments.filter(function (s) {
        var mf = activeFilter === 'ALL' || s.status === activeFilter;
        var q  = searchQuery.toLowerCase();
        var ms = !q || (s.trackingId   && s.trackingId.toLowerCase().includes(q)) ||
            (s.cargoType    && s.cargoType.toLowerCase().includes(q)) ||
            (s.customerName && s.customerName.toLowerCase().includes(q)) ||
            (s.origin       && s.origin.toLowerCase().includes(q)) ||
            (s.destination  && s.destination.toLowerCase().includes(q));
        return mf && ms;
    });
}

// STATS
function updateStats(shipments) {
    var c = { IN_TRANSIT:0, DELAYED:0, REROUTED:0, DELIVERED:0 };
    shipments.forEach(function (s) { if (c[s.status]!==undefined) c[s.status]++; });
    document.getElementById('statTotal').textContent    = shipments.length;
    document.getElementById('statTransit').textContent  = c.IN_TRANSIT;
    document.getElementById('statDelayed').textContent  = c.DELAYED;
    document.getElementById('statRerouted').textContent = c.REROUTED;
    document.getElementById('statDelivered').textContent= c.DELIVERED;
}

// RENDER TABLE — Columns: Tracking | Customer | Cargo | Route | Progress | Priority | Distance | Driver | ETA | actions
function renderTable(shipments) {
    var tbody = document.getElementById('shipmentsBody');
    if (shipments.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" class="table-empty">No shipments match this filter.</td></tr>';
        return;
    }

    var user    = getCurrentUser ? getCurrentUser() : null;
    var isAdmin = user && user.role === 'ADMIN';
    var html    = '';

    shipments.forEach(function (s) {
        var color    = STATUS_COLORS[s.status]     || '#94a3b8';
        var pColor   = PRIORITY_COLORS[s.priority] || '#94a3b8';
        var progress = calcProgress(s);
        var distKm   = calcDistanceKm(s.originLat, s.originLng, s.destLat, s.destLng);
        var originCity = s.origin      ? s.origin.split(',')[0]      : '--';
        var destCity   = s.destination ? s.destination.split(',')[0] : '--';
        var etaDate    = s.estimatedDeliveryTime
            ? new Date(s.estimatedDeliveryTime).toLocaleString('en-IN',
                { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit', hour12:true })
            : 'N/A';
        var driverName = s.assignedDriverName && s.assignedDriverName.trim()
            ? s.assignedDriverName
            : '<em style="color:var(--text-muted)">Unassigned</em>';

        html +=
            '<tr class="table-row" onclick="openShipmentDetail(' + s.id + ')">' +
            '<td><span class="tracking-cell">' + s.trackingId + '</span></td>' +
            '<td class="text-secondary">' + (s.customerName || '--') + '</td>' +
            '<td class="text-secondary">' + s.cargoType + '</td>' +
            '<td class="route-cell"><span class="route-from">' + originCity + '</span><span class="route-arrow">&#8594;</span><span class="route-to">' + destCity + '</span></td>' +
            '<td class="progress-cell">' +
            '<div class="progress-bar-wrap"><div class="progress-bar-fill" style="width:' + progress + '%;background:' + color + ';"></div></div>' +
            '<span class="progress-pct">' + progress + '%</span>' +
            '</td>' +
            '<td><span class="priority-badge" style="color:' + pColor + ';border-color:' + pColor + '44;background:' + pColor + '11;">' + (s.priority || 'NORMAL') + '</span></td>' +
            '<td style="font-family:var(--font-mono);font-size:12px;color:var(--text-secondary);">' + (distKm !== null ? distKm + ' km' : '<em style="color:var(--text-muted)">N/A</em>') + '</td>' +
            '<td style="font-size:12px;">' + driverName + '</td>' +
            '<td class="eta-cell">' + etaDate + '</td>' +
            '<td class="actions-cell" onclick="event.stopPropagation()">' +
            (s.status === 'DELAYED' ? '<button class="btn-action reroute" onclick="quickReroute(' + s.id + ')">&#128260; Reroute</button>' : '') +
            (isAdmin ? '<button onclick="quickDelete(' + s.id + ',\'' + s.trackingId + '\')" title="Delete" style="margin-left:4px;padding:4px 8px;font-size:14px;cursor:pointer;background:rgba(239,68,68,0.1);color:#ef4444;border:1px solid rgba(239,68,68,0.3);border-radius:6px;">&#128465;</button>' : '') +
            '</td>' +
            '</tr>';
    });

    tbody.innerHTML = html;
}

// FILTER & SEARCH
function setTableFilter(f, btn) {
    activeFilter = f;
    document.querySelectorAll('.filter-chip').forEach(function (b) { b.classList.toggle('active', b.dataset.f === f); });
    renderTable(getFiltered());
}

function filterTable() {
    searchQuery = document.getElementById('searchInput').value;
    renderTable(getFiltered());
}

// QUICK REROUTE
async function quickReroute(id) {
    try {
        var resp = await fetch(API_BASE + '/api/shipments/' + id + '/reroute',
            { method:'POST', headers:{'Content-Type':'application/json'}, credentials:'include' });
        if (resp.ok) { showToast('success', '&#128260; Rerouted', 'Shipment rerouted — ETA +2 days'); await loadShipments(); }
    } catch (e) { showToast('danger', 'Error', e.message); }
}

// DELETE
async function quickDelete(id, trackingId) {
    if (!confirm('Delete shipment ' + trackingId + '?\nThis cannot be undone.')) return;
    try {
        var resp = await fetch(API_BASE + '/api/shipments/' + id, { method:'DELETE', credentials:'include' });
        if (resp.ok) { showToast('success', '&#128465; Deleted', trackingId + ' removed.'); await loadShipments(); }
        else { var d = await resp.json(); showToast('danger', 'Delete Failed', d.error || 'Error'); }
    } catch (e) { showToast('danger', 'Error', e.message); }
}

// OPEN DETAIL
function openShipmentDetail(id) { window.location.href = '/index.html#shipment-' + id; }

// CREATE MODAL
function openCreateModal() {
    document.getElementById('createModal').style.display = 'flex';
    if (typeof buildCityDropdown === 'function') {
        buildCityDropdown('mOrigin', 'Bengaluru');
        buildCityDropdown('mDest',   'Thirthahalli');
        onCitySelect('mOrigin', 'mOriginCoords');
        onCitySelect('mDest',   'mDestCoords');
    }
    loadAvailableVehicles();
    loadCargoTypes();
    hideFormError('createError');
    hideFormError('createSuccess');
}

function closeCreateModal() {
    document.getElementById('createModal').style.display = 'none';
    ['mCustomer','mWeight'].forEach(function (id) { var el=document.getElementById(id); if(el) el.value=''; });
    var etaEl = document.getElementById('mEta');
    if (etaEl) etaEl.value = '12';
}

function onCitySelect(selectId, hintId) {
    var sel = document.getElementById(selectId);
    var hint = document.getElementById(hintId);
    if (!sel || !hint) return;
    var opt = sel.options[sel.selectedIndex];
    hint.textContent = (opt && opt.dataset.lat)
        ? opt.dataset.lat + '°N, ' + opt.dataset.lng + '°E — ' + opt.dataset.state
        : '';
}

// LOAD AVAILABLE VEHICLES — only vehicles NOT already assigned to active shipments
async function loadAvailableVehicles() {
    try {
        var [vehiclesResp, shipmentsResp] = await Promise.all([
            fetch(API_BASE + '/api/vehicles', { credentials: 'include' }),
            fetch(API_BASE + '/api/shipments', { credentials: 'include' })
        ]);

        var allVehicles  = await vehiclesResp.json();
        var allShipmentsData = await shipmentsResp.json();

        // Find vehicle IDs that are already assigned to active (non-delivered) shipments
        var busyVehicleIds = new Set();
        allShipmentsData.forEach(function (s) {
            if (s.vehicleId && s.status !== 'DELIVERED') {
                busyVehicleIds.add(String(s.vehicleId));
            }
        });

        var sel = document.getElementById('mVehicle');
        if (!sel) return;
        sel.innerHTML = '<option value="">-- No vehicle --</option>';

        // Sort vehicles: available first, then others
        var sorted = allVehicles.sort(function (a, b) {
            var aBusy = busyVehicleIds.has(String(a.id));
            var bBusy = busyVehicleIds.has(String(b.id));
            return aBusy === bBusy ? 0 : (aBusy ? 1 : -1);
        });

        sorted.forEach(function (v) {
            var isBusy = busyVehicleIds.has(String(v.id));
            var opt    = document.createElement('option');
            opt.value           = v.id;
            opt.dataset.driver  = v.assignedDriverName || '';
            opt.disabled        = isBusy;
            opt.textContent     = v.registrationNumber + ' (' + v.vehicleType.replace(/_/g,' ') + ')' +
                (v.assignedDriverName ? ' — ' + v.assignedDriverName : ' — No driver') +
                (isBusy ? ' [IN USE]' : '');
            if (isBusy) opt.style.color = '#475569';
            sel.appendChild(opt);
        });

    } catch (e) { console.error('Could not load vehicles:', e); }
}

// LOAD CARGO TYPES
async function loadCargoTypes() {
    try {
        var resp  = await fetch(API_BASE + '/api/cargo-types', { credentials: 'include' });
        var types = await resp.json();
        var el    = document.getElementById('mCargo');
        if (!el) return;

        if (el.tagName === 'INPUT') {
            var parent = el.parentNode;
            var sel    = document.createElement('select');
            sel.className = 'form-input'; sel.id = 'mCargo';
            sel.innerHTML = '<option value="">-- Select cargo type --</option>';
            types.forEach(function (t) {
                var opt = document.createElement('option');
                opt.value = t; opt.textContent = t;
                if (t === 'Bulk Copper Sulphate') opt.selected = true;
                sel.appendChild(opt);
            });
            parent.replaceChild(sel, el);
        } else {
            // Already a select — just update options
            el.innerHTML = '<option value="">-- Select cargo type --</option>';
            types.forEach(function (t) {
                var opt = document.createElement('option');
                opt.value = t; opt.textContent = t;
                if (t === 'Bulk Copper Sulphate') opt.selected = true;
                el.appendChild(opt);
            });
        }
    } catch (e) { console.error('Could not load cargo types:', e); }
}

// SUBMIT CREATE SHIPMENT
async function submitCreateShipment() {
    hideFormError('createError');

    var customer   = document.getElementById('mCustomer').value.trim();
    var cargoEl    = document.getElementById('mCargo');
    var cargo      = cargoEl ? cargoEl.value.trim() : '';
    var weight     = document.getElementById('mWeight').value;
    var priority   = document.getElementById('mPriority').value;
    var eta        = document.getElementById('mEta').value || '12';
    var vehicleId  = document.getElementById('mVehicle').value;

    var originSel = document.getElementById('mOrigin');
    var destSel   = document.getElementById('mDest');
    if (!originSel || !destSel) return;
    var originOpt = originSel.options[originSel.selectedIndex];
    var destOpt   = destSel.options[destSel.selectedIndex];

    if (!customer || !cargo) {
        showFormError('createError', 'Customer name and cargo type are required.');
        return;
    }
    if (!originOpt || !originOpt.value) { showFormError('createError', 'Please select an origin city.'); return; }
    if (!destOpt   || !destOpt.value)   { showFormError('createError', 'Please select a destination city.'); return; }
    if (originOpt.value === destOpt.value) { showFormError('createError', 'Origin and destination must be different.'); return; }

    // Check vehicle busy
    if (vehicleId) {
        var selEl = document.getElementById('mVehicle');
        var selOpt = selEl.options[selEl.selectedIndex];
        if (selOpt && selOpt.disabled) {
            showFormError('createError', 'This vehicle is already assigned to an active shipment. Please select another.');
            return;
        }
    }

    var driverName = vehicleId
        ? (document.getElementById('mVehicle').options[document.getElementById('mVehicle').selectedIndex].dataset.driver || '')
        : '';

    var payload = {
        customerName:       customer,
        cargoType:          cargo,
        weightKg:           weight ? parseFloat(weight) : 0,
        priority:           priority,
        origin:             originOpt.value + ', ' + originOpt.dataset.state,
        originLat:          parseFloat(originOpt.dataset.lat),
        originLng:          parseFloat(originOpt.dataset.lng),
        destination:        destOpt.value  + ', ' + destOpt.dataset.state,
        destLat:            parseFloat(destOpt.dataset.lat),
        destLng:            parseFloat(destOpt.dataset.lng),
        etaHours:           parseInt(eta),
        vehicleId:          vehicleId   || null,
        assignedDriverName: driverName
    };

    var btn = document.getElementById('createSubmitBtn');
    btn.disabled = true; btn.textContent = 'Creating...';

    try {
        var resp = await fetch(API_BASE + '/api/shipments', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            credentials: 'include', body: JSON.stringify(payload)
        });
        var data = await resp.json();

        if (resp.ok || resp.status === 201) {
            var suc = document.getElementById('createSuccess');
            suc.textContent = '✓ Shipment ' + data.shipment.trackingId + ' created!';
            suc.style.display = 'block';
            setTimeout(function () { closeCreateModal(); loadShipments(); }, 1500);
        } else {
            showFormError('createError', data.error || 'Failed to create shipment.');
        }
    } catch (e) {
        showFormError('createError', 'Network error: ' + e.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = '&#128666; Create Shipment';
    }
}

// HELPERS
function showToast(type, title, message) {
    var c = document.getElementById('toastContainer');
    var t = document.createElement('div');
    t.className = 'toast ' + type;
    t.innerHTML = '<div class="toast-title">' + title + '</div><div class="toast-message">' + message + '</div>';
    c.appendChild(t);
    setTimeout(function () { t.style.opacity='0'; t.style.transform='translateX(110%)'; t.style.transition='all 0.3s ease'; setTimeout(function(){if(t.parentNode)t.parentNode.removeChild(t);},300); }, 5000);
}

function showFormError(id, msg) { var el=document.getElementById(id); if(el){el.textContent=msg;el.style.display='block';} }
function hideFormError(id)      { var el=document.getElementById(id); if(el)el.style.display='none'; }