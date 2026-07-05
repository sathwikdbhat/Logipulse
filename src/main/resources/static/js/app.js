// VSST — app.js  (Rebranded Version)

var API_BASE = window.API_BASE || window.location.origin;
var LOCAL_API_URL = 'http://localhost:9090';
var PROD_API_URL  = 'https://your-app-name.onrender.com';


// GLOBAL STATE
var map                  = null;
var activeMarkersLayer   = [];
var selectedShipmentId   = null;
var allShipments         = [];
var autoRefreshInterval  = null;
var activeFilter         = 'ALL';

var STATUS_COLORS = {
    'IN_TRANSIT': '#4fc3f7',
    'DELAYED':    '#ef4444',
    'REROUTED':   '#a78bfa',
    'DELIVERED':  '#10b981'
};

var STATUS_LABELS = {
    'IN_TRANSIT': 'In Transit',
    'DELAYED':    'Delayed',
    'REROUTED':   'Rerouted',
    'DELIVERED':  'Delivered'
};

// ENTRY POINT
document.addEventListener('DOMContentLoaded', function () {
    console.log('%c VSST Control Tower ', 'background:#0d0d26;color:#4fc3f7;font-weight:bold;font-size:13px;padding:4px 8px;');

    if (typeof requireAuth === 'function' && !requireAuth()) return;

    var currentUser = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
    if (currentUser) {
        var avatarEl = document.getElementById('userAvatar');
        var nameEl   = document.getElementById('userNameText');
        var roleEl   = document.getElementById('userRoleText');
        if (avatarEl) avatarEl.textContent = (currentUser.fullName || currentUser.username).charAt(0).toUpperCase();
        if (nameEl)   nameEl.textContent   = currentUser.fullName || currentUser.username;
        if (roleEl) {
            roleEl.textContent = currentUser.role;
            roleEl.style.color = typeof getRoleColor === 'function' ? getRoleColor(currentUser.role) : '#4fc3f7';
        }
    }

    initClock();
    initMap();
    injectFilterBar();
    loadShipments();
    wireButtons();
    startAutoRefresh();
});

// CLOCK
function initClock() {
    function tick() {
        var el = document.getElementById('currentTime');
        if (el) el.textContent = new Date().toLocaleTimeString('en-IN', {
            hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
        });
    }
    setInterval(tick, 1000);
    tick();
}

// AUTO REFRESH
function startAutoRefresh() {
    autoRefreshInterval = setInterval(function () {
        loadShipments();
    }, 15000);
}

// MAP INIT
function initMap() {
    map = L.map('map', { center: [20.5, 78.9], zoom: 5, zoomControl: true });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap &copy; CARTO',
        subdomains: 'abcd', maxZoom: 19
    }).addTo(map);
    console.log('Map initialised.');
}

// LOAD SHIPMENTS
async function loadShipments() {
    try {
        var response = await fetch(API_BASE + '/api/shipments', { credentials: 'include' });
        if (!response.ok) throw new Error('Status ' + response.status);
        var shipments = await response.json();
        allShipments  = shipments;
        applyFilterAndRender(shipments);
        renderMapMarkers(shipments);
        updateKpiCards(shipments);
        renderAnalytics(shipments);
        // Day 14: update live tracking markers
        if (typeof notifyTrackingUpdate === 'function') {
            notifyTrackingUpdate(shipments, map);
        }
    } catch (error) {
        console.error('Failed to load shipments:', error);
        var listEl = document.getElementById('shipmentList');
        if (listEl) listEl.innerHTML =
            '<div class="loading-state"><p style="color:#ef4444;">&#9888; Could not connect to API.<br>' +
            error.message + '</p></div>';
    }
}

// FILTER BAR
function injectFilterBar() {
    var sidebar = document.getElementById('sidebar');
    var list    = document.getElementById('shipmentList');
    if (!sidebar || !list || document.getElementById('filterBar')) return;

    var bar = document.createElement('div');
    bar.className = 'filter-bar';
    bar.id        = 'filterBar';
    bar.innerHTML =
        '<button class="filter-btn active" data-filter="ALL"       onclick="setFilter(\'ALL\')">All</button>' +
        '<button class="filter-btn" data-filter="IN_TRANSIT"       onclick="setFilter(\'IN_TRANSIT\')">Transit</button>' +
        '<button class="filter-btn" data-filter="DELAYED"          onclick="setFilter(\'DELAYED\')">Delayed</button>' +
        '<button class="filter-btn" data-filter="REROUTED"         onclick="setFilter(\'REROUTED\')">Rerouted</button>' +
        '<button class="filter-btn" data-filter="DELIVERED"        onclick="setFilter(\'DELIVERED\')">Delivered</button>';
    sidebar.insertBefore(bar, list);
}

function setFilter(status) {
    activeFilter = status;
    document.querySelectorAll('.filter-btn').forEach(function (b) {
        b.classList.toggle('active', b.dataset.filter === status);
    });
    applyFilterAndRender(allShipments);
}

function applyFilterAndRender(shipments) {
    var filtered = (activeFilter === 'ALL')
        ? shipments
        : shipments.filter(function (s) { return s.status === activeFilter; });
    renderSidebar(filtered);
}

// RENDER SIDEBAR
function renderSidebar(shipments) {
    var listEl  = document.getElementById('shipmentList');
    var countEl = document.getElementById('shipmentCount');
    if (countEl) countEl.textContent = allShipments.length;
    if (!listEl) return;

    if (shipments.length === 0) {
        listEl.innerHTML = '<div class="empty-state"><p>No shipments match this filter.</p></div>';
        return;
    }

    var html = '';
    shipments.forEach(function (s) {
        var isDelayed = s.status === 'DELAYED';
        html +=
            '<div class="shipment-card ' + s.status + '" id="card-' + s.id + '" onclick="selectShipment(' + s.id + ')">' +
            '<div class="shipment-card-top">' +
            '<span class="tracking-id">' + s.trackingId + '</span>' +
            '<span class="status-badge ' + s.status + '">' + (STATUS_LABELS[s.status] || s.status) + '</span>' +
            '</div>' +
            '<div class="shipment-card-body">' +
            '<p><strong>Cargo:</strong> ' + s.cargoType + '</p>' +
            '<p><strong>From:</strong> '  + s.origin    + '</p>' +
            '<p><strong>To:</strong> '    + s.destination + '</p>' +
            '</div>';

        if (isDelayed) {
            html +=
                '<div class="reroute-action" onclick="event.stopPropagation()">' +
                '<div class="disruption-banner"><span class="disruption-icon">&#9889;</span><span>Active disruption — auto-rerouting shortly</span></div>' +
                '</div>';
        }
        html += '</div>';
    });
    listEl.innerHTML = html;
}

// MAP MARKERS
function renderMapMarkers(shipments) {
    // Remove old route layers (NOT markers — tracking.js manages those)
    activeMarkersLayer.forEach(function (m) { map.removeLayer(m); });
    activeMarkersLayer = [];

    shipments.forEach(function (s) {
        if (!s.originLat || !s.destLat) return;

        var isRerouted  = s.status === 'REROUTED';
        var isDelivered = s.status === 'DELIVERED';

        // Colour: rerouted = purple, delivered = faded green, others = blue
        var routeColor  = isRerouted  ? '#a78bfa' :
            isDelivered ? '#10b981'  : '#4fc3f7';
        var routeOpacity = isDelivered ? 0.2 : (isRerouted ? 0.7 : 0.45);

        // Draw road polyline if route geometry is available
        if (s.routeGeometry && s.routeGeometry.length > 10) {
            try {
                var coords = JSON.parse(s.routeGeometry);  // [[lat,lng],...]
                if (coords && coords.length > 1) {
                    var line = L.polyline(coords, {
                        color:     routeColor,
                        weight:    isRerouted ? 3.5 : 2.5,
                        opacity:   routeOpacity,
                        dashArray: isRerouted ? '10,5' : null,
                        lineJoin:  'round',
                        lineCap:   'round'
                    }).addTo(map);

                    line.bindPopup(
                        '<div style="font-family:Inter,sans-serif;font-size:12px;">' +
                        '<b style="color:' + routeColor + '">' +
                        (isRerouted ? '🔄 Rerouted via alternate corridor' : '🛣 Route: ') +
                        '</b><br>' +
                        (s.origin      ? s.origin.split(',')[0]      : '') + ' → ' +
                        (s.destination ? s.destination.split(',')[0] : '') +
                        '</div>'
                    );

                    activeMarkersLayer.push(line);
                }
            } catch (e) {
                // Fallback to straight line if parse fails
                drawStraightLine(s, routeColor, routeOpacity, isRerouted);
            }
        } else {
            // No stored geometry yet — draw straight line
            drawStraightLine(s, routeColor, routeOpacity, isRerouted);
        }

        // Origin dot
        activeMarkersLayer.push(
            L.circleMarker([s.originLat, s.originLng], {
                radius: 4, color: routeColor,
                fillColor: routeColor, fillOpacity: 0.6, weight: 1.5
            }).addTo(map)
        );

        // Destination diamond
        activeMarkersLayer.push(
            L.circleMarker([s.destLat, s.destLng], {
                radius: 5, color: '#fff',
                fillColor: routeColor, fillOpacity: 0.9, weight: 2
            }).addTo(map)
        );
    });

    // Update live tracking markers
    if (typeof notifyTrackingUpdate === 'function') {
        notifyTrackingUpdate(shipments, map);
    }
}

function drawStraightLine(s, color, opacity, isDashed) {
    var line = L.polyline(
        [[s.originLat, s.originLng], [s.destLat, s.destLng]],
        {
            color:     color,
            weight:    2,
            opacity:   opacity,
            dashArray: isDashed ? '10,5' : '6,5'
        }
    ).addTo(map);
    activeMarkersLayer.push(line);
}

// FETCH WEATHER FOR POPUP
async function fetchWeatherForPopup(shipmentId, lat, lng) {
    try {
        var resp = await fetch(API_BASE + '/api/weather/' + lat + '/' + lng, { credentials: 'include' });
        if (!resp.ok) return;
        var w  = await resp.json();
        var el = document.getElementById('wpop-' + shipmentId);
        if (el) {
            var wColor = w.severity === 'HIGH' ? '#ef4444' : w.severity === 'MEDIUM' ? '#f59e0b' : '#10b981';
            el.innerHTML = (w.icon || '🌤') + ' ' + (w.description || w.main || 'N/A') +
                ' · ' + (w.temp ? w.temp.toFixed(1) + '°C' : '--') +
                ' · Wind: ' + (w.wind_speed ? w.wind_speed.toFixed(1) + ' km/h' : '--');
            el.style.color = wColor;
        }
    } catch (e) {
        console.warn('Weather fetch failed:', e);
    }
}

// SELECT SHIPMENT — detail panel with milestones + weather
async function selectShipment(id) {
    document.querySelectorAll('.shipment-card').forEach(function (c) { c.classList.remove('active'); });
    var card = document.getElementById('card-' + id);
    if (card) { card.classList.add('active'); card.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }

    selectedShipmentId = id;
    document.getElementById('detailPanel').classList.add('open');
    document.getElementById('panelBody').innerHTML = '<div class="loading-state"><p>Loading details...</p></div>';
    document.getElementById('panelActions').style.display = 'none';

    try {
        var response = await fetch(API_BASE + '/api/shipments/' + id, { credentials: 'include' });
        if (!response.ok) throw new Error('Status ' + response.status);
        var data      = await response.json();
        var s         = data.shipment;
        var anomalies = data.anomalies || [];
        var color     = STATUS_COLORS[s.status] || '#94a3b8';

        var dispatchDate = s.dispatchTime ? new Date(s.dispatchTime).toLocaleString('en-IN') : 'N/A';
        var etaDate      = s.estimatedDeliveryTime ? new Date(s.estimatedDeliveryTime).toLocaleString('en-IN') : 'N/A';

        var html =
            '<div class="detail-group"><div class="detail-label">Tracking ID</div>' +
            '<div class="detail-value" style="color:' + color + '">' + s.trackingId + '</div></div>' +
            '<div class="detail-group"><div class="detail-label">Status</div>' +
            '<div><span class="status-badge ' + s.status + '">' + (STATUS_LABELS[s.status] || s.status) + '</span></div></div>' +
            '<div class="detail-group"><div class="detail-label">Cargo</div>' +
            '<div class="detail-value">' + s.cargoType + '</div></div>' +
            (s.customerName ? '<div class="detail-group"><div class="detail-label">Customer</div><div class="detail-value">' + s.customerName + '</div></div>' : '') +
            (s.weightKg > 0 ? '<div class="detail-group"><div class="detail-label">Weight</div><div class="detail-value">' + s.weightKg.toLocaleString() + ' kg</div></div>' : '') +
            '<div class="detail-divider"></div>' +
            '<div class="detail-group"><div class="detail-label">Origin</div><div class="detail-value">' + s.origin + '</div></div>' +
            '<div class="detail-group"><div class="detail-label">Destination</div><div class="detail-value">' + s.destination + '</div></div>' +
            '<div class="detail-group"><div class="detail-label">Current Position</div>' +
            '<div class="detail-value">' + s.currentLat.toFixed(4) + '°N, ' + s.currentLng.toFixed(4) + '°E</div></div>' +
            '<div class="detail-divider"></div>' +
            '<div class="detail-group"><div class="detail-label">Dispatched</div><div class="detail-value">' + dispatchDate + '</div></div>' +
            '<div class="detail-group"><div class="detail-label">Estimated Delivery</div>' +
            '<div class="detail-value" style="color:' + color + '">' + etaDate + '</div></div>';

        if (anomalies.length > 0) {
            html += '<div class="detail-divider"></div><div class="detail-label" style="margin-bottom:8px;">&#9888; Active Anomalies</div>';
            anomalies.forEach(function (a) {
                html += '<div class="anomaly-card"><div class="anomaly-severity">&#128308; ' + a.severity + ' SEVERITY</div>' +
                    '<div class="anomaly-desc">' + a.description + '</div></div>';
            });
        } else {
            html += '<div class="detail-divider"></div><div class="detail-label">Anomalies</div>' +
                '<div class="detail-value" style="color:#10b981;font-size:12px;margin-top:4px;">&#9989; No active anomalies</div>';
        }

        // Placeholder for weather (loads async below)
        html += '<div class="detail-divider"></div>' +
            '<div class="detail-label" style="margin-bottom:8px;">&#127777; Current Weather</div>' +
            '<div id="weatherDetail" style="font-size:13px;color:var(--text-muted);">Loading weather data...</div>';

        // Milestones
        try {
            var mResp = await fetch(API_BASE + '/api/shipments/' + id + '/milestones', { credentials: 'include' });
            if (mResp.ok) {
                var milestones = await mResp.json();
                if (milestones && milestones.length > 0) {
                    html += '<div class="detail-divider"></div><div class="detail-label" style="margin-bottom:10px;">&#128198; Journey Timeline</div><div class="milestone-timeline">';
                    var eventIcons  = { 'DISPATCHED':'&#128666;','CHECKPOINT':'&#128205;','WEATHER_ALERT':'&#9928;','DELAYED':'&#9888;','REROUTED':'&#128260;','ARRIVED_HUB':'&#127981;','OUT_FOR_DELIVERY':'&#128230;','DELIVERED':'&#9989;' };
                    var eventColors = { 'DISPATCHED':'#4fc3f7','CHECKPOINT':'#94a3b8','WEATHER_ALERT':'#f59e0b','DELAYED':'#ef4444','REROUTED':'#a78bfa','ARRIVED_HUB':'#4fc3f7','OUT_FOR_DELIVERY':'#f59e0b','DELIVERED':'#10b981' };
                    milestones.forEach(function (m, i) {
                        var mIcon  = eventIcons[m.eventType]  || '&#9679;';
                        var mColor = eventColors[m.eventType] || '#94a3b8';
                        var mTime  = new Date(m.occurredAt).toLocaleString('en-IN', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' });
                        html += '<div class="milestone-item">' +
                            '<div class="milestone-line-wrap">' +
                            '<div class="milestone-dot" style="background:var(--bg-card);border:2px solid ' + mColor + ';color:' + mColor + ';">' + mIcon + '</div>' +
                            (i < milestones.length - 1 ? '<div class="milestone-connector"></div>' : '') +
                            '</div>' +
                            '<div class="milestone-body">' +
                            '<div class="milestone-event" style="color:' + mColor + '">' + m.eventType.replace(/_/g,' ') + '</div>' +
                            '<div class="milestone-desc">' + m.description + '</div>' +
                            '<div class="milestone-time">' + mTime + (m.location ? ' &bull; ' + m.location : '') + '</div>' +
                            '</div></div>';
                    });
                    html += '</div>';
                }
            }
        } catch (mErr) { console.warn('Milestones:', mErr); }

        // Day 14: Add speed + distance + replay button
        var speedKmh  = typeof getShipmentSpeedKmh === 'function' ? getShipmentSpeedKmh(id) : null;
        var distRemKm = (s.currentLat && s.destLat && s.status !== 'DELIVERED')
            ? Math.round(haversineKmHelper(s.currentLat, s.currentLng, s.destLat, s.destLng))
            : null;

        var liveStatsHtml = '';
        if (s.status === 'IN_TRANSIT' || s.status === 'REROUTED') {
            liveStatsHtml =
                '<div class="detail-divider"></div>' +
                '<div class="detail-label" style="margin-bottom:8px;">&#128663; Live Tracking</div>' +
                '<div class="live-stats-row">' +
                '<div class="live-stat-box">' +
                '<div class="live-stat-value">' + (speedKmh ? speedKmh + ' km/h' : '~60 km/h') + '</div>' +
                '<div class="live-stat-label">Current Speed</div>' +
                '</div>' +
                '<div class="live-stat-box">' +
                '<div class="live-stat-value">' + (distRemKm !== null ? distRemKm + ' km' : 'N/A') + '</div>' +
                '<div class="live-stat-label">Distance Remaining</div>' +
                '</div>' +
                '</div>' +
                '<button onclick="replayJourney(' + id + ')" ' +
                'style="margin-top:10px;width:100%;padding:8px;background:rgba(167,139,250,0.1);' +
                'color:#a78bfa;border:1px solid rgba(167,139,250,0.3);border-radius:6px;' +
                'font-size:12px;font-weight:600;cursor:pointer;font-family:var(--font-main);">' +
                '&#9654; Replay Journey' +
                '</button>';
        }

        document.getElementById('panelBody').innerHTML = html + liveStatsHtml;
        if (s.status === 'DELAYED') document.getElementById('panelActions').style.display = 'flex';

        // Load weather AFTER setting innerHTML so the element exists
        loadWeatherForDetail(s.currentLat, s.currentLng);

    } catch (error) {
        console.error('Detail load failed:', error);
        document.getElementById('panelBody').innerHTML = '<div class="empty-state"><p style="color:#ef4444;">Failed to load details.</p></div>';
    }
}

// WEATHER FOR DETAIL PANEL
async function loadWeatherForDetail(lat, lng) {
    var el = document.getElementById('weatherDetail');
    if (!el) return;
    try {
        var resp = await fetch(API_BASE + '/api/weather/' + lat + '/' + lng, { credentials: 'include' });
        if (!resp.ok) { el.textContent = 'Weather data unavailable'; return; }
        var w      = await resp.json();
        var wColor = w.severity === 'HIGH' ? '#ef4444' : w.severity === 'MEDIUM' ? '#f59e0b' : '#10b981';

        el.innerHTML =
            '<div style="background:rgba(79,195,247,0.06);border:1px solid rgba(79,195,247,0.15);border-radius:8px;padding:10px 12px;">' +
            '<div style="font-size:16px;margin-bottom:6px;">' + (w.icon || '🌤') + ' <strong style="color:' + wColor + '">' + (w.description || w.main || 'N/A') + '</strong></div>' +
            '<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:12px;color:var(--text-secondary);">' +
            '<span>&#127777; ' + (w.temp ? w.temp.toFixed(1) + '°C' : '--') + '</span>' +
            '<span>&#128168; Humidity: ' + (w.humidity || '--') + '%</span>' +
            '<span>&#127787; Wind: ' + (w.wind_speed ? w.wind_speed.toFixed(1) + ' km/h' : '--') + '</span>' +
            '<span style="color:' + wColor + ';font-weight:600;">Risk: ' + (w.severity || 'LOW') + '</span>' +
            '</div>' +
            (w.isHazardous ? '<div style="margin-top:6px;font-size:11px;color:#fca5a5;">&#9888; Hazardous conditions — delay risk increased</div>' : '') +
            '</div>';
    } catch (e) {
        if (el) el.textContent = 'Weather data unavailable';
    }
}

// FORCE DISRUPTION — manual trigger, bypasses weather/news checks entirely
async function forceDisruption() {
    var btn = document.getElementById('forceDisruptionBtn');
    if (btn) { btn.disabled = true; btn.innerHTML = '⚡ Triggering...'; }

    try {
        var response = await fetch(API_BASE + '/api/disruptions/trigger', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include'
        });
        var data = await response.json();

        if (!response.ok) {
            showToast('danger', 'Trigger Failed', data.error || 'Could not trigger disruption.');
        } else if (!data.anomaly) {
            showToast('warning', '&#9888; No Targets', data.message || 'No IN_TRANSIT shipments available.');
        } else {
            var anomaly = data.anomaly;
            showToast('danger',
                '&#9889; Disruption — Shipment #' + anomaly.shipmentId,
                anomaly.description + '<br><em style="color:#94a3b8;font-size:11px;">Severity: ' + anomaly.severity + '</em>');

            await loadShipments();
            if (selectedShipmentId === anomaly.shipmentId) await selectShipment(anomaly.shipmentId);
        }
    } catch (error) {
        showToast('danger', 'API Error', 'Could not reach the server.');
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '⚡ Force Disruption'; }
    }
}

// WIRE BUTTONS
function wireButtons() {
    var cb = document.getElementById('closePanelBtn');
    if (cb) cb.addEventListener('click', function () {
        document.getElementById('detailPanel').classList.remove('open');
        document.querySelectorAll('.shipment-card').forEach(function (c) { c.classList.remove('active'); });
        selectedShipmentId = null;
    });
}

// KPI CARDS
function updateKpiCards(shipments) {
    var c = { IN_TRANSIT:0, DELAYED:0, REROUTED:0, DELIVERED:0 };
    shipments.forEach(function (s) { if (c[s.status] !== undefined) c[s.status]++; });
    var set = function (id, val) { var el = document.getElementById(id); if (el) el.textContent = val; };
    set('kpiInTransit', c.IN_TRANSIT);
    set('kpiDelayed',   c.DELAYED);
    set('kpiRerouted',  c.REROUTED);
    set('kpiDelivered', c.DELIVERED);
    var dc = document.getElementById('kpiDelayed');
    if (dc) {
        var kc = dc.closest('.kpi-card');
        if (kc) { kc.style.borderColor = c.DELAYED > 0 ? 'rgba(239,68,68,0.5)' : ''; kc.style.boxShadow = c.DELAYED > 0 ? '0 0 12px rgba(239,68,68,0.15)' : ''; }
    }
}

// ANALYTICS
function renderAnalytics(shipments) {
    var c = { IN_TRANSIT:0, DELAYED:0, REROUTED:0, DELIVERED:0 };
    shipments.forEach(function (s) { if (c[s.status] !== undefined) c[s.status]++; });
    var total = shipments.length || 1;
    var health = Math.round(((c.IN_TRANSIT + c.DELIVERED + (c.REROUTED * 0.6)) / total) * 100);

    var se = document.getElementById('healthScore');
    if (se) { se.textContent = health + '%'; se.style.color = health >= 70 ? '#10b981' : health >= 40 ? '#f59e0b' : '#ef4444'; }
    var he = document.getElementById('healthScoreHeader');
    if (he) { he.textContent = health + '%'; he.style.color = health >= 70 ? '#10b981' : health >= 40 ? '#f59e0b' : '#ef4444'; }
    var fe = document.getElementById('healthFill');
    if (fe) fe.style.width = health + '%';
}

// TOAST
function showToast(type, title, message) {
    var container = document.getElementById('toastContainer');
    if (!container) return;
    var toast = document.createElement('div');
    toast.className = 'toast ' + type;
    toast.innerHTML = '<div class="toast-title">' + title + '</div><div class="toast-message">' + message + '</div>';
    container.appendChild(toast);
    setTimeout(function () {
        toast.style.opacity = '0'; toast.style.transform = 'translateX(110%)'; toast.style.transition = 'all 0.3s ease';
        setTimeout(function () { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 300);
    }, 6000);
}

function haversineKmHelper(lat1, lng1, lat2, lng2) {
    var R    = 6371;
    var dLat = (lat2-lat1)*Math.PI/180;
    var dLng = (lng2-lng1)*Math.PI/180;
    var a    = Math.sin(dLat/2)*Math.sin(dLat/2) +
        Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*
        Math.sin(dLng/2)*Math.sin(dLng/2);
    return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}