// LogiPulse — tracking.js — Fixed: Hackathon Highway Speeds (80–100 km/h)

var API_BASE = window.API_BASE || window.location.origin;

var persistentMarkers  = {};
var positionHistory    = {};
var speedData          = {};
var replayTimers       = {};
var liveCountdownTimer = null;

var TRACKING_STATUS_COLORS = {
    'IN_TRANSIT': '#4fc3f7',
    'DELAYED':    '#ef4444',
    'REROUTED':   '#a78bfa',
    'DELIVERED':  '#10b981'
};

// MAIN ENTRY — called by app.js after every loadShipments()
function notifyTrackingUpdate(shipments, mapRef) {
    if (!mapRef) return;

    startLiveCountdown();

    var currentIds = new Set(shipments.map(function (s) { return String(s.id); }));

    // Remove stale markers
    Object.keys(persistentMarkers).forEach(function (id) {
        if (!currentIds.has(id)) {
            try { mapRef.removeLayer(persistentMarkers[id].marker); } catch (e) {}
            delete persistentMarkers[id];
        }
    });

    shipments.forEach(function (s) {
        var id   = String(s.id);
        var prev = persistentMarkers[id];

        // Record position history
        if (!positionHistory[id]) positionHistory[id] = [];
        positionHistory[id].push({
            lat: s.currentLat, lng: s.currentLng, ts: Date.now()
        });
        if (positionHistory[id].length > 60) positionHistory[id].shift();

        // Calculate visual speed (80-100 km/h)
        calculateRealisticSpeed(id, s);

        if (prev) {
            var moved =
                Math.abs(prev.lat - s.currentLat) > 0.00005 ||
                Math.abs(prev.lng - s.currentLng) > 0.00005;

            if (moved && s.status !== 'DELIVERED') {
                smoothMoveMarker(id, prev.lat, prev.lng, s.currentLat, s.currentLng);
            }

            if (prev.status !== s.status) {
                prev.marker.setIcon(buildShipmentIcon(s));
                if (s.status === 'DELIVERED' && s.destLat) {
                    smoothMoveMarker(id, s.currentLat, s.currentLng, s.destLat, s.destLng);
                    showDeliveryCelebration(prev.marker);
                }
            }

            persistentMarkers[id].lat    = s.currentLat;
            persistentMarkers[id].lng    = s.currentLng;
            persistentMarkers[id].status = s.status;
            prev.marker.setPopupContent(buildPopupHtml(s));

        } else {
            createTrackingMarker(s, mapRef);
        }
    });
}

// REALISTIC SPEED — Hackathon Mode (80-100 km/h)
function calculateRealisticSpeed(id, s) {
    // Only meaningful for active shipments
    if (s.status === 'DELIVERED' || !s.destLat || !s.currentLat) {
        speedData[id] = { speedKmh: 0, ts: Date.now() };
        return;
    }

    // Initialize with a random cruising speed between 85 and 95
    var prevSpeed = speedData[id] && speedData[id].speedKmh > 0
        ? speedData[id].speedKmh
        : (85 + Math.random() * 10);

    // Add small variation (±3 km/h) for realism on each tick
    var variation = (Math.random() - 0.5) * 6;
    var smoothedSpeed = prevSpeed + variation;

    // Clamp strictly to highway speeds: 80 to 100 km/h
    smoothedSpeed = Math.max(80, Math.min(100, smoothedSpeed));
    smoothedSpeed = Math.round(smoothedSpeed);

    // Override if shipment is DELAYED (stuck in traffic / weather)
    if (s.status === 'DELAYED') {
        var delayedPrev = speedData[id] && speedData[id].speedKmh < 25 ? speedData[id].speedKmh : 10;
        smoothedSpeed = Math.max(0, Math.min(15, delayedPrev + (Math.random() - 0.5) * 4));
        smoothedSpeed = Math.round(smoothedSpeed);
    }

    // Override if shipment is REROUTED (slower secondary roads)
    if (s.status === 'REROUTED') {
        smoothedSpeed = Math.max(65, Math.min(80, smoothedSpeed));
    }

    speedData[id] = { speedKmh: smoothedSpeed, ts: Date.now() };
}

// CREATE marker
function createTrackingMarker(s, mapRef) {
    var id     = String(s.id);
    var icon   = buildShipmentIcon(s);
    var marker = L.marker([s.currentLat, s.currentLng], { icon: icon })
        .addTo(mapRef)
        .bindPopup(buildPopupHtml(s));

    marker.on('popupopen', function () {
        if (typeof fetchWeatherForPopup === 'function') {
            fetchWeatherForPopup(s.id, s.currentLat, s.currentLng);
        }
    });
    marker.on('click', function () {
        if (typeof selectShipment === 'function') selectShipment(s.id);
    });

    persistentMarkers[id] = {
        marker: marker,
        lat:    s.currentLat,
        lng:    s.currentLng,
        status: s.status
    };
}

// BUILD marker icon
function buildShipmentIcon(s) {
    var color     = TRACKING_STATUS_COLORS[s.status] || '#94a3b8';
    var isDelayed = s.status === 'DELAYED';

    var html;
    if (isDelayed) {
        html =
            '<div style="position:relative;width:22px;height:22px;">' +
            '<div style="position:absolute;top:-4px;left:-4px;width:30px;height:30px;' +
            'border-radius:50%;border:2px solid #ef4444;opacity:0.6;' +
            'animation:pulseRing 1.4s ease-out infinite;"></div>' +
            '<div style="width:22px;height:22px;background:#ef4444;border:2.5px solid #fff;' +
            'border-radius:50%;display:flex;align-items:center;justify-content:center;' +
            'font-size:11px;box-shadow:0 0 0 3px rgba(239,68,68,0.3),' +
            '0 0 14px rgba(239,68,68,0.7);cursor:pointer;">&#9888;</div>' +
            '</div>';
    } else {
        html = '<div class="ship-dot' +
            (s.status === 'IN_TRANSIT' ? ' ship-dot-moving' : '') + '" ' +
            'style="background:' + color + ';box-shadow:0 0 0 3px ' + color +
            '44,0 0 12px ' + color + '88;"></div>';
    }

    return L.divIcon({
        className:   '',
        html:        html,
        iconSize:    isDelayed ? [22, 22] : [14, 14],
        iconAnchor:  isDelayed ? [11, 11] : [7, 7],
        popupAnchor: [0, -14]
    });
}

// BUILD popup HTML
function buildPopupHtml(s) {
    var color        = TRACKING_STATUS_COLORS[s.status] || '#94a3b8';
    var statusLabels = {
        'IN_TRANSIT': 'In Transit', 'DELAYED': 'Delayed',
        'REROUTED': 'Rerouted',     'DELIVERED': 'Delivered'
    };
    var eta = s.estimatedDeliveryTime
        ? new Date(s.estimatedDeliveryTime).toLocaleString('en-IN')
        : 'Unknown';
    var originCity = s.origin      ? s.origin.split(',')[0]      : '';
    var destCity   = s.destination ? s.destination.split(',')[0] : '';

    // Speed display
    var speedHtml = '';
    var sd = speedData[String(s.id)];
    if (sd && sd.speedKmh > 0 &&
        (s.status === 'IN_TRANSIT' || s.status === 'REROUTED')) {
        speedHtml =
            '<div style="font-size:11px;color:#10b981;margin-top:3px;">' +
            '&#128663; Speed: ~' + sd.speedKmh + ' km/h</div>';
    } else if (s.status === 'DELAYED') {
        speedHtml =
            '<div style="font-size:11px;color:#f59e0b;margin-top:3px;">' +
            '&#128663; Speed: ~0–15 km/h (disrupted)</div>';
    }

    // Distance remaining
    var distRem = '';
    if (s.currentLat && s.destLat && s.status !== 'DELIVERED') {
        var km = Math.round(
            haversineKmT(s.currentLat, s.currentLng, s.destLat, s.destLng)
        );
        distRem =
            '<div style="font-size:11px;color:#94a3b8;">' +
            '&#128204; ' + km.toLocaleString() + ' km remaining</div>';
    }

    return '<div style="font-family:Inter,sans-serif;line-height:1.8;min-width:210px;">' +
        '<div style="font-weight:700;font-size:13px;color:' + color +
        ';margin-bottom:4px;">&#128666; ' + s.trackingId + '</div>' +
        '<div style="font-size:12px;color:#cbd5e1;">' + s.cargoType + '</div>' +
        '<hr style="border:none;border-top:1px solid #252550;margin:6px 0;">' +
        '<div style="font-size:12px;"><strong>Status:</strong> ' +
        '<span style="color:' + color + '">' +
        (statusLabels[s.status] || s.status) + '</span></div>' +
        '<div style="font-size:12px;"><strong>Route:</strong> ' +
        originCity + ' → ' + destCity + '</div>' +
        '<div style="font-size:12px;"><strong>ETA:</strong> ' + eta + '</div>' +
        speedHtml + distRem +
        '<div id="wpop-' + s.id + '" style="margin-top:4px;font-size:11px;color:#64748b;">' +
        '&#127777; Loading weather...</div>' +
        (s.status === 'DELAYED'
            ? '<div style="margin-top:8px;padding:6px;background:rgba(239,68,68,0.1);' +
            'border:1px solid rgba(239,68,68,0.3);border-radius:4px;font-size:11px;' +
            'color:#fca5a5;">&#9889; Disruption active — auto-rerouting shortly</div>'
            : '') +
        '<div style="margin-top:8px;display:flex;gap:6px;">' +
        '<button onclick="selectShipment(' + s.id + ')" ' +
        'style="flex:1;background:rgba(79,195,247,0.15);color:#4fc3f7;' +
        'border:1px solid rgba(79,195,247,0.3);padding:4px;border-radius:4px;' +
        'font-size:11px;cursor:pointer;">Details</button>' +
        '<button onclick="replayJourney(' + s.id + ')" ' +
        'style="flex:1;background:rgba(167,139,250,0.15);color:#a78bfa;' +
        'border:1px solid rgba(167,139,250,0.3);padding:4px;border-radius:4px;' +
        'font-size:11px;cursor:pointer;">&#9654; Replay</button>' +
        '</div></div>';
}

// SMOOTH MOVEMENT
function smoothMoveMarker(id, fromLat, fromLng, toLat, toLng) {
    var pm = persistentMarkers[id];
    if (!pm) return;
    if (pm._animTimer) clearInterval(pm._animTimer);

    var steps    = 25;
    var stepNum  = 0;
    var interval = 600 / steps;

    pm._animTimer = setInterval(function () {
        stepNum++;
        var t    = stepNum / steps;
        var ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
        var lat  = fromLat + (toLat - fromLat) * ease;
        var lng  = fromLng + (toLng - fromLng) * ease;

        if (persistentMarkers[id] && persistentMarkers[id].marker) {
            persistentMarkers[id].marker.setLatLng([lat, lng]);
        }

        if (stepNum >= steps) {
            clearInterval(pm._animTimer);
            if (persistentMarkers[id]) delete persistentMarkers[id]._animTimer;
        }
    }, interval);
}

// DELIVERY CELEBRATION
function showDeliveryCelebration(marker) {
    if (!marker || !marker._icon) return;
    var el = marker._icon;
    el.style.transition = 'transform 0.25s ease-out';
    el.style.transform  = 'scale(3)';
    setTimeout(function () {
        el.style.transform = 'scale(1.5)';
        setTimeout(function () { el.style.transform = 'scale(1)'; }, 200);
    }, 250);
}

// JOURNEY REPLAY
function replayJourney(shipmentId) {
    var id = String(shipmentId);
    var s  = null;

    if (typeof allShipments !== 'undefined') {
        s = allShipments.find(function (x) { return x.id === shipmentId; });
    }
    if (!s || !s.originLat) { console.warn('No origin data for replay'); return; }

    if (replayTimers[id]) { clearInterval(replayTimers[id]); delete replayTimers[id]; }

    var history   = positionHistory[id] || [];
    var waypoints = [{ lat: s.originLat, lng: s.originLng }];

    history.filter(function (_, i) { return i % 4 === 0; })
        .forEach(function (h) { waypoints.push({ lat: h.lat, lng: h.lng }); });

    waypoints.push({ lat: s.currentLat, lng: s.currentLng });

    if (waypoints.length < 2) return;

    showReplayBanner(true, s.trackingId);

    var step = 0;
    replayTimers[id] = setInterval(function () {
        if (step >= waypoints.length) {
            clearInterval(replayTimers[id]);
            delete replayTimers[id];
            showReplayBanner(false, '');
            if (persistentMarkers[id] && persistentMarkers[id].marker) {
                persistentMarkers[id].marker.setLatLng([s.currentLat, s.currentLng]);
            }
            return;
        }
        var wp = waypoints[step];
        if (persistentMarkers[id] && persistentMarkers[id].marker) {
            persistentMarkers[id].marker.setLatLng([wp.lat, wp.lng]);
        }
        step++;
    }, 280);
}

function showReplayBanner(visible, trackingId) {
    var el = document.getElementById('replayBanner');
    if (!el) return;
    el.style.display = visible ? 'flex' : 'none';
    if (visible) {
        var tid = document.getElementById('replayTrackingId');
        if (tid) tid.textContent = trackingId;
    }
}

function stopReplay() {
    Object.keys(replayTimers).forEach(function (id) {
        clearInterval(replayTimers[id]);
        delete replayTimers[id];
    });
    showReplayBanner(false, '');

    if (typeof allShipments !== 'undefined') {
        allShipments.forEach(function (s) {
            var id = String(s.id);
            if (persistentMarkers[id] && persistentMarkers[id].marker) {
                persistentMarkers[id].marker.setLatLng([s.currentLat, s.currentLng]);
            }
        });
    }
}

// LIVE COUNTDOWN
function startLiveCountdown() {
    clearInterval(liveCountdownTimer);
    var el = document.getElementById('liveCountdown');
    if (!el) return;
    el.textContent = 'Live · just now';
    var secs = 0;
    liveCountdownTimer = setInterval(function () {
        secs++;
        el.textContent = secs < 60
            ? 'Live · ' + secs + 's ago'
            : 'Live · ' + Math.floor(secs / 60) + 'm ago';
    }, 1000);
}

// GET SPEED for detail panel
function getShipmentSpeedKmh(shipmentId) {
    var sd = speedData[String(shipmentId)];
    return (sd && sd.speedKmh > 0) ? sd.speedKmh : null;
}

// HAVERSINE (local)
function haversineKmT(lat1, lng1, lat2, lng2) {
    if (!lat1 || !lat2) return 0;
    var R    = 6371;
    var dLat = (lat2 - lat1) * Math.PI / 180;
    var dLng = (lng2 - lng1) * Math.PI / 180;
    var a    = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Inject CSS
(function injectTrackingCSS() {
    if (document.getElementById('trackingCSS')) return;
    var st  = document.createElement('style');
    st.id   = 'trackingCSS';
    st.textContent =
        '.ship-dot{width:14px;height:14px;border:2px solid #fff;border-radius:50%;cursor:pointer;}' +
        '.ship-dot-moving{animation:shipPulse 2s ease-in-out infinite;}' +
        '@keyframes shipPulse{0%,100%{opacity:1}50%{opacity:0.65}}' +
        '@keyframes pulseRing{0%{transform:scale(0.8);opacity:0.8}' +
        '70%{transform:scale(1.6);opacity:0}100%{transform:scale(0.8);opacity:0}}';
    document.head.appendChild(st);
})();