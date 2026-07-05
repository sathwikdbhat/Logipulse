// LogiPulse — analytics.js  (Day 15)

var API_BASE = window.API_BASE || window.location.origin;

var shipments  = [];
var anomalies  = [];
var vehicles   = [];
var heatmap    = null;

// Chart instances
var statusDonutChart  = null;
var onTrendChart      = null;
var cargoChart        = null;
var disruptionChart   = null;
var distanceChart     = null;

// ENTRY POINT
document.addEventListener('DOMContentLoaded', function () {
    if (typeof requireAuth === 'function' && !requireAuth()) return;

    var user = getCurrentUser ? getCurrentUser() : null;
    if (user) {
        var av = document.getElementById('navAvatar');
        var nm = document.getElementById('navName');
        var rl = document.getElementById('navRole');
        if (av) av.textContent = (user.fullName || user.username).charAt(0).toUpperCase();
        if (nm) nm.textContent = user.fullName  || user.username;
        if (rl) {
            rl.textContent = user.role;
            rl.style.color = user.role === 'ADMIN' ? '#ef4444' : '#4fc3f7';
        }
    }

    Chart.defaults.color       = '#475569';
    Chart.defaults.font.family = 'Inter, sans-serif';

    initHeatmap();
    loadAllAnalytics();
    setInterval(loadAllAnalytics, 30000);
});

// LOAD ALL DATA
async function loadAllAnalytics() {
    var lbl = document.getElementById('lastUpdatedLabel');
    if (lbl) lbl.textContent = 'Updating...';

    try {
        var [sResp, aResp, vResp] = await Promise.all([
            fetch(API_BASE + '/api/shipments', { credentials: 'include' }),
            fetch(API_BASE + '/api/anomalies', { credentials: 'include' }),
            fetch(API_BASE + '/api/vehicles',  { credentials: 'include' })
        ]);

        shipments = sResp.ok ? await sResp.json() : [];
        anomalies = aResp.ok ? await aResp.json() : [];
        vehicles  = vResp.ok ? await vResp.json() : [];

        renderKPIs();
        renderInsights();
        renderStatusDonut();
        renderOnTimeTrend();
        renderCargoChart();
        renderDisruptionTimeline();
        renderDistanceChart();
        renderHeatmapData();
        renderDriverPerformance();
        renderCorridorPerformance();

        if (lbl) lbl.textContent = 'Updated ' + new Date().toLocaleTimeString('en-IN',
            { hour:'2-digit', minute:'2-digit', hour12: true });

    } catch (e) {
        console.error('Analytics load failed:', e);
        if (lbl) lbl.textContent = 'Update failed';
    }
}

// HAVERSINE
function haversineKm(lat1, lng1, lat2, lng2) {
    if (!lat1 || !lat2) return 0;
    var R    = 6371;
    var dLat = (lat2 - lat1) * Math.PI / 180;
    var dLng = (lng2 - lng1) * Math.PI / 180;
    var a    = Math.sin(dLat/2)*Math.sin(dLat/2) +
        Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*
        Math.sin(dLng/2)*Math.sin(dLng/2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// KPI CARDS
function renderKPIs() {
    var total     = shipments.length;
    var delivered = shipments.filter(function(s){ return s.status==='DELIVERED'; }).length;
    var delayed   = shipments.filter(function(s){ return s.status==='DELAYED'; }).length;
    var rerouted  = shipments.filter(function(s){ return s.status==='REROUTED'; }).length;
    var inTransit = shipments.filter(function(s){ return s.status==='IN_TRANSIT'; }).length;
    var active    = inTransit + delayed + rerouted;

    var onTimeRate  = total > 0 ? Math.round(((delivered + inTransit + rerouted * 0.5) / total) * 100) : 0;
    var delayRate   = total > 0 ? Math.round((delayed / total) * 100) : 0;

    var totalDistKm = shipments.reduce(function(sum, s) {
        return sum + haversineKm(s.originLat, s.originLng, s.destLat, s.destLng);
    }, 0);

    var totalCargoTons = shipments.reduce(function(sum, s) {
        return sum + (s.weightKg || 0);
    }, 0) / 1000;

    var availVehicles = vehicles.filter(function(v){ return v.status==='AVAILABLE'; }).length;

    set('kpiTotalShipments', total);
    set('kpiActiveShipments', active + ' active');
    set('kpiOnTimeRate',  onTimeRate + '%');
    set('kpiOnTimeSub',   delivered + ' delivered');
    set('kpiDelayRate',   delayRate + '%');
    set('kpiDelayedCount', delayed + ' shipments');
    set('kpiTotalDistance', Math.round(totalDistKm).toLocaleString() + ' km');
    set('kpiTotalCargo',   totalCargoTons.toFixed(1) + ' t');
    set('kpiActiveVehicles', vehicles.length);
    set('kpiVehicleSub',   availVehicles + ' available');

    // Color on-time rate
    var ontimeEl = document.getElementById('kpiOnTimeRate');
    if (ontimeEl) {
        ontimeEl.style.color = onTimeRate >= 70 ? '#10b981' :
            onTimeRate >= 40 ? '#f59e0b' : '#ef4444';
    }
}

function set(id, val) {
    var el = document.getElementById(id);
    if (el) el.textContent = val;
}

// AI INSIGHTS
function renderInsights() {
    var row = document.getElementById('insightsRow');
    if (!row) return;

    var total     = shipments.length || 1;
    var delayed   = shipments.filter(function(s){ return s.status==='DELAYED'; }).length;
    var delivered = shipments.filter(function(s){ return s.status==='DELIVERED'; }).length;
    var rerouted  = shipments.filter(function(s){ return s.status==='REROUTED'; }).length;
    var inTransit = shipments.filter(function(s){ return s.status==='IN_TRANSIT'; }).length;
    var highPrio  = shipments.filter(function(s){ return s.priority==='HIGH'; }).length;

    var onTimeRate = Math.round(((delivered + inTransit) / total) * 100);
    var delayRate  = Math.round((delayed / total) * 100);

    var chips = [];

    if (delayed === 0) {
        chips.push({ type:'good', text:'✅ Zero active delays — fleet operating normally' });
    } else if (delayRate >= 30) {
        chips.push({ type:'danger', text:'🚨 ' + delayRate + '% delay rate — immediate rerouting recommended' });
    } else {
        chips.push({ type:'warn', text:'⚠️ ' + delayed + ' shipment(s) delayed — monitor closely' });
    }

    if (rerouted > 0) {
        chips.push({ type:'warn', text:'🔄 ' + rerouted + ' rerouted shipment(s) en route via alternate corridors' });
    }

    if (onTimeRate >= 80) {
        chips.push({ type:'good', text:'📈 On-time rate ' + onTimeRate + '% — above target' });
    } else if (onTimeRate < 50) {
        chips.push({ type:'danger', text:'📉 On-time rate ' + onTimeRate + '% — below 50% threshold' });
    }

    if (highPrio > 0) {
        chips.push({ type:'warn', text:'⚡ ' + highPrio + ' HIGH priority shipment(s) in network' });
    }

    if (anomalies.length > 0) {
        chips.push({ type:'danger', text:'⚡ ' + anomalies.length + ' total disruption(s) recorded' });
    }

    var available = vehicles.filter(function(v){ return v.status==='AVAILABLE'; }).length;
    if (available > 0) {
        chips.push({ type:'good', text:'🚛 ' + available + ' vehicle(s) available for new assignments' });
    }

    if (chips.length === 0) chips.push({ type:'good', text:'✅ All systems operational' });

    row.innerHTML = chips.map(function(c) {
        return '<span class="insight-chip ' + c.type + '">' + c.text + '</span>';
    }).join('');
}

// STATUS DONUT CHART
function renderStatusDonut() {
    var counts = { IN_TRANSIT:0, DELAYED:0, REROUTED:0, DELIVERED:0 };
    shipments.forEach(function(s) { if (counts[s.status]!==undefined) counts[s.status]++; });

    var data = [counts.IN_TRANSIT, counts.DELAYED, counts.REROUTED, counts.DELIVERED];

    if (statusDonutChart) {
        statusDonutChart.data.datasets[0].data = data;
        statusDonutChart.update();
        return;
    }

    var ctx = document.getElementById('statusDonut');
    if (!ctx) return;

    statusDonutChart = new Chart(ctx.getContext('2d'), {
        type: 'doughnut',
        data: {
            labels: ['In Transit','Delayed','Rerouted','Delivered'],
            datasets: [{
                data: data,
                backgroundColor: [
                    'rgba(79,195,247,0.8)',
                    'rgba(239,68,68,0.8)',
                    'rgba(167,139,250,0.8)',
                    'rgba(16,185,129,0.8)'
                ],
                borderColor:  ['#4fc3f7','#ef4444','#a78bfa','#10b981'],
                borderWidth: 2,
                hoverOffset: 6
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false, cutout: '65%',
            plugins: {
                legend: { position:'right', labels:{ color:'#94a3b8', font:{size:11}, boxWidth:12, padding:12, usePointStyle:true } },
                tooltip: { backgroundColor:'#111130', borderColor:'#252550', borderWidth:1, titleColor:'#e2e8f0', bodyColor:'#94a3b8' }
            }
        }
    });
}

// ON-TIME TREND (last 7 days — simulated from current data)
function renderOnTimeTrend() {
    // Generate simulated 7-day trend based on current state
    var days   = [];
    var onTime = [];
    var delays = [];
    var today  = new Date();

    for (var i = 6; i >= 0; i--) {
        var d = new Date(today);
        d.setDate(d.getDate() - i);
        days.push(d.toLocaleDateString('en-IN', { day:'2-digit', month:'short' }));

        // Simulate variation around current rates
        var total   = shipments.length || 5;
        var delBase = shipments.filter(function(s){ return s.status==='DELAYED'; }).length;
        var variation = (Math.random() - 0.5) * 2;
        var del  = Math.max(0, Math.round(delBase + variation));
        var good = Math.max(0, total - del);
        delays.push(del);
        onTime.push(good);
    }

    if (onTrendChart) {
        onTrendChart.data.labels              = days;
        onTrendChart.data.datasets[0].data    = onTime;
        onTrendChart.data.datasets[1].data    = delays;
        onTrendChart.update();
        return;
    }

    var ctx = document.getElementById('onTimeTrend');
    if (!ctx) return;

    onTrendChart = new Chart(ctx.getContext('2d'), {
        type: 'bar',
        data: {
            labels: days,
            datasets: [
                {
                    label: 'On-Time',
                    data: onTime,
                    backgroundColor: 'rgba(16,185,129,0.6)',
                    borderColor: '#10b981',
                    borderWidth: 1.5,
                    borderRadius: 4
                },
                {
                    label: 'Delayed',
                    data: delays,
                    backgroundColor: 'rgba(239,68,68,0.5)',
                    borderColor: '#ef4444',
                    borderWidth: 1.5,
                    borderRadius: 4
                }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { labels:{ color:'#94a3b8', font:{size:11}, boxWidth:12, usePointStyle:true } },
                tooltip: { backgroundColor:'#111130', borderColor:'#252550', borderWidth:1, titleColor:'#e2e8f0', bodyColor:'#94a3b8' }
            },
            scales: {
                x: { stacked:true, ticks:{color:'#475569',font:{size:10}}, grid:{color:'rgba(255,255,255,0.03)'} },
                y: { stacked:true, beginAtZero:true, ticks:{color:'#475569',font:{size:11},stepSize:1}, grid:{color:'rgba(255,255,255,0.05)'} }
            }
        }
    });
}

// CARGO TYPE DISTRIBUTION
function renderCargoChart() {
    var counts = {};
    shipments.forEach(function(s) {
        var ct = s.cargoType || 'Unknown';
        counts[ct] = (counts[ct] || 0) + 1;
    });

    var sorted  = Object.entries(counts).sort(function(a,b){ return b[1]-a[1]; }).slice(0,7);
    var labels  = sorted.map(function(e){ return e[0].length > 18 ? e[0].substring(0,16)+'…' : e[0]; });
    var data    = sorted.map(function(e){ return e[1]; });

    var palette = ['#4fc3f7','#a78bfa','#10b981','#f59e0b','#ef4444','#06b6d4','#ec4899'];

    if (cargoChart) {
        cargoChart.data.labels              = labels;
        cargoChart.data.datasets[0].data   = data;
        cargoChart.update();
        return;
    }

    var ctx = document.getElementById('cargoChart');
    if (!ctx) return;

    cargoChart = new Chart(ctx.getContext('2d'), {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Shipments',
                data:  data,
                backgroundColor: data.map(function(_,i){ return palette[i % palette.length].replace(')',',0.7)').replace('rgb','rgba'); }),
                borderColor:     data.map(function(_,i){ return palette[i % palette.length]; }),
                borderWidth: 1.5,
                borderRadius: 5
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { backgroundColor:'#111130', borderColor:'#252550', borderWidth:1, titleColor:'#e2e8f0', bodyColor:'#94a3b8' }
            },
            scales: {
                x: { beginAtZero:true, ticks:{color:'#475569',font:{size:10},stepSize:1}, grid:{color:'rgba(255,255,255,0.05)'} },
                y: { ticks:{color:'#94a3b8',font:{size:11}}, grid:{display:false} }
            }
        }
    });
}

// DISRUPTION TIMELINE
function renderDisruptionTimeline() {
    if (anomalies.length === 0) {
        if (disruptionChart) return;
        var ctx = document.getElementById('disruptionChart');
        if (ctx) {
            var parent = ctx.parentNode;
            parent.innerHTML = '<div class="no-data-state"><div style="font-size:28px;">✅</div><p>No disruptions recorded yet.<br>Trigger a simulation to see data here.</p></div>';
        }
        return;
    }

    // Group by day
    var dayCounts = {};
    anomalies.forEach(function(a) {
        var day = a.detectedAt
            ? new Date(a.detectedAt).toLocaleDateString('en-IN',{day:'2-digit',month:'short'})
            : 'Unknown';
        dayCounts[day] = (dayCounts[day] || 0) + 1;
    });

    var labels = Object.keys(dayCounts).slice(-10);
    var data   = labels.map(function(l){ return dayCounts[l]; });

    if (disruptionChart) {
        disruptionChart.data.labels           = labels;
        disruptionChart.data.datasets[0].data = data;
        disruptionChart.update();
        return;
    }

    var ctx = document.getElementById('disruptionChart');
    if (!ctx) return;

    disruptionChart = new Chart(ctx.getContext('2d'), {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Disruptions',
                data:  data,
                borderColor: '#ef4444',
                backgroundColor: 'rgba(239,68,68,0.1)',
                borderWidth: 2.5,
                tension: 0.4,
                fill: true,
                pointBackgroundColor: '#ef4444',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointRadius: 5,
                pointHoverRadius: 7
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { display:false },
                tooltip: { backgroundColor:'#111130', borderColor:'#252550', borderWidth:1, titleColor:'#e2e8f0', bodyColor:'#94a3b8' }
            },
            scales: {
                x: { ticks:{color:'#475569',font:{size:10}}, grid:{color:'rgba(255,255,255,0.03)'} },
                y: { beginAtZero:true, ticks:{color:'#475569',font:{size:11},stepSize:1}, grid:{color:'rgba(255,255,255,0.05)'} }
            }
        }
    });
}

// DISTANCE PER CORRIDOR
function renderDistanceChart() {
    var corridors = {};
    shipments.forEach(function(s) {
        var origin = s.origin      ? s.origin.split(',')[0]      : 'Unknown';
        var dest   = s.destination ? s.destination.split(',')[0] : 'Unknown';
        var key    = origin + ' → ' + dest;
        var km     = haversineKm(s.originLat, s.originLng, s.destLat, s.destLng);
        if (!corridors[key]) corridors[key] = { total: 0, count: 0 };
        corridors[key].total += km;
        corridors[key].count++;
    });

    var sorted = Object.entries(corridors)
        .sort(function(a,b){ return b[1].total - a[1].total; })
        .slice(0, 7);

    var labels = sorted.map(function(e){ return e[0].length > 20 ? e[0].substring(0,18)+'…' : e[0]; });
    var data   = sorted.map(function(e){ return Math.round(e[1].total); });

    if (distanceChart) {
        distanceChart.data.labels           = labels;
        distanceChart.data.datasets[0].data = data;
        distanceChart.update();
        return;
    }

    var ctx = document.getElementById('distanceChart');
    if (!ctx) return;

    distanceChart = new Chart(ctx.getContext('2d'), {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Distance (km)',
                data:  data,
                backgroundColor: 'rgba(6,182,212,0.6)',
                borderColor: '#06b6d4',
                borderWidth: 1.5,
                borderRadius: 5
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { display:false },
                tooltip: { backgroundColor:'#111130', borderColor:'#252550', borderWidth:1, titleColor:'#e2e8f0', bodyColor:'#94a3b8',
                    callbacks: { label: function(ctx){ return ' ' + ctx.parsed.x.toLocaleString() + ' km'; } }
                }
            },
            scales: {
                x: { beginAtZero:true, ticks:{color:'#475569',font:{size:10}}, grid:{color:'rgba(255,255,255,0.05)'} },
                y: { ticks:{color:'#94a3b8',font:{size:10}}, grid:{display:false} }
            }
        }
    });
}

// HEATMAP (Leaflet)
function initHeatmap() {
    heatmap = L.map('heatmapContainer', { center:[20.5, 78.9], zoom:5, zoomControl:true });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap &copy; CARTO',
        subdomains: 'abcd', maxZoom: 19
    }).addTo(heatmap);
}

function renderHeatmapData() {
    if (!heatmap) return;

    // Remove existing circles
    heatmap.eachLayer(function(l) {
        if (l instanceof L.Circle || l instanceof L.CircleMarker) heatmap.removeLayer(l);
    });

    // Count disruptions per location
    var locationCounts = {};
    shipments.forEach(function(s) {
        var key = s.currentLat.toFixed(2) + ',' + s.currentLng.toFixed(2);
        if (!locationCounts[key]) {
            locationCounts[key] = { lat: s.currentLat, lng: s.currentLng, count: 0, delayed: 0 };
        }
        locationCounts[key].count++;
        if (s.status === 'DELAYED') locationCounts[key].delayed++;
    });

    // Add anomaly positions
    anomalies.forEach(function(a) {
        var s = shipments.find(function(x){ return x.id === a.shipmentId; });
        if (!s) return;
        var key = s.currentLat.toFixed(2) + ',' + s.currentLng.toFixed(2);
        if (!locationCounts[key]) {
            locationCounts[key] = { lat: s.currentLat, lng: s.currentLng, count: 1, delayed: 1 };
        } else {
            locationCounts[key].delayed++;
        }
    });

    Object.values(locationCounts).forEach(function(loc) {
        var isHot   = loc.delayed > 0;
        var radius  = 30000 + loc.count * 20000;
        var color   = isHot ? '#ef4444' : '#4fc3f7';
        var opacity = isHot ? 0.18 : 0.10;

        L.circle([loc.lat, loc.lng], {
            radius:      radius,
            color:       color,
            fillColor:   color,
            fillOpacity: opacity,
            weight:      1.5,
            opacity:     isHot ? 0.6 : 0.3
        }).addTo(heatmap)
            .bindPopup(
                '<div style="font-family:Inter,sans-serif;font-size:12px;">' +
                '<strong style="color:' + color + '">' + (isHot ? '🔴 Disruption Zone' : '🔵 Active Zone') + '</strong><br>' +
                loc.count + ' shipment(s) in area<br>' +
                (loc.delayed > 0 ? '<span style="color:#ef4444">' + loc.delayed + ' delayed</span>' : '✅ No delays') +
                '</div>'
            );
    });
}

// DRIVER PERFORMANCE TABLE
function renderDriverPerformance() {
    var el = document.getElementById('driverPerfTable');
    if (!el) return;

    // Aggregate by driver
    var drivers = {};
    shipments.forEach(function(s) {
        var name = s.assignedDriverName || 'Unassigned';
        if (!drivers[name]) drivers[name] = { total:0, delivered:0, delayed:0, rerouted:0 };
        drivers[name].total++;
        if (s.status === 'DELIVERED') drivers[name].delivered++;
        if (s.status === 'DELAYED')   drivers[name].delayed++;
        if (s.status === 'REROUTED')  drivers[name].rerouted++;
    });

    var driverList = Object.entries(drivers)
        .map(function(e) {
            var d = e[1];
            var score = d.total > 0
                ? Math.round(((d.delivered + d.total * 0.5 - d.delayed) / d.total) * 100)
                : 50;
            return { name: e[0], score: Math.max(0, Math.min(100, score)),
                total: d.total, delivered: d.delivered, delayed: d.delayed };
        })
        .sort(function(a,b){ return b.score - a.score; });

    if (driverList.length === 0) {
        el.innerHTML = '<div class="no-data-state">No driver data available. Assign drivers to shipments to see performance metrics.</div>';
        return;
    }

    var html =
        '<table class="perf-table">' +
        '<thead><tr>' +
        '<th>#</th><th>Driver</th><th>Shipments</th>' +
        '<th>Delivered</th><th>Delayed</th><th>Performance</th>' +
        '</tr></thead><tbody>';

    driverList.forEach(function(d, i) {
        var scoreColor = d.score >= 70 ? '#10b981' : d.score >= 40 ? '#f59e0b' : '#ef4444';
        html +=
            '<tr>' +
            '<td style="color:var(--text-muted);font-size:12px;">' + (i+1) + '</td>' +
            '<td style="font-weight:600;">' +
            (d.name === 'Unassigned'
                ? '<em style="color:var(--text-muted)">' + d.name + '</em>'
                : '&#128100; ' + d.name) +
            '</td>' +
            '<td style="font-family:var(--font-mono);">' + d.total + '</td>' +
            '<td style="color:#10b981;font-family:var(--font-mono);">' + d.delivered + '</td>' +
            '<td style="color:' + (d.delayed > 0 ? '#ef4444' : '#10b981') + ';font-family:var(--font-mono);">' + d.delayed + '</td>' +
            '<td>' +
            '<div class="score-bar-wrap">' +
            '<div class="score-bar-bg">' +
            '<div class="score-bar-fill" style="width:' + d.score + '%;background:' + scoreColor + ';"></div>' +
            '</div>' +
            '<span class="score-num" style="color:' + scoreColor + '">' + d.score + '</span>' +
            '</div>' +
            '</td>' +
            '</tr>';
    });

    html += '</tbody></table>';
    el.innerHTML = html;
}

// ROUTE CORRIDOR PERFORMANCE TABLE
function renderCorridorPerformance() {
    var el = document.getElementById('corridorTable');
    if (!el) return;

    var corridors = {};
    shipments.forEach(function(s) {
        var origin = s.origin      ? s.origin.split(',')[0]      : 'Unknown';
        var dest   = s.destination ? s.destination.split(',')[0] : 'Unknown';
        var key    = origin + ' → ' + dest;
        var km     = Math.round(haversineKm(s.originLat, s.originLng, s.destLat, s.destLng));

        if (!corridors[key]) corridors[key] = { total:0, delivered:0, delayed:0, rerouted:0, km:km };
        corridors[key].total++;
        if (s.status === 'DELIVERED') corridors[key].delivered++;
        if (s.status === 'DELAYED')   corridors[key].delayed++;
        if (s.status === 'REROUTED')  corridors[key].rerouted++;
    });

    var list = Object.entries(corridors)
        .map(function(e) {
            var c = e[1];
            var reliability = c.total > 0
                ? Math.round(((c.total - c.delayed) / c.total) * 100) : 100;
            return { route: e[0], reliability: reliability, km: c.km,
                total: c.total, delayed: c.delayed };
        })
        .sort(function(a,b){ return b.total - a.total; });

    if (list.length === 0) {
        el.innerHTML = '<div class="no-data-state">No corridor data available yet.</div>';
        return;
    }

    var html =
        '<table class="perf-table">' +
        '<thead><tr>' +
        '<th>Corridor</th><th>Distance</th><th>Shipments</th>' +
        '<th>Delayed</th><th>Reliability</th>' +
        '</tr></thead><tbody>';

    list.forEach(function(c) {
        var rColor = c.reliability >= 80 ? '#10b981' : c.reliability >= 50 ? '#f59e0b' : '#ef4444';
        var rLabel = c.reliability >= 80 ? 'HIGH'     : c.reliability >= 50 ? 'MEDIUM'  : 'LOW';

        html +=
            '<tr>' +
            '<td style="font-weight:600;font-size:12px;">' + c.route + '</td>' +
            '<td style="font-family:var(--font-mono);color:var(--text-secondary);">' +
            (c.km > 0 ? c.km.toLocaleString() + ' km' : 'N/A') +
            '</td>' +
            '<td style="font-family:var(--font-mono);">' + c.total + '</td>' +
            '<td style="color:' + (c.delayed > 0 ? '#ef4444' : '#10b981') + ';font-family:var(--font-mono);">' + c.delayed + '</td>' +
            '<td>' +
            '<span class="corridor-badge" style="color:' + rColor + ';border:1px solid ' + rColor + '33;background:' + rColor + '11;">' +
            '&#9679; ' + rLabel + ' (' + c.reliability + '%)' +
            '</span>' +
            '</td>' +
            '</tr>';
    });

    html += '</tbody></table>';
    el.innerHTML = html;
}

// EXPORT CSV
function exportCSV() {
    if (shipments.length === 0) {
        showToast('warning', 'No Data', 'No shipments to export.');
        return;
    }

    var headers = [
        'Tracking ID','Customer','Cargo Type','Status','Priority',
        'Origin','Destination','Distance (km)','Weight (kg)',
        'Driver','ETA','Dispatched'
    ];

    var rows = shipments.map(function(s) {
        var km = Math.round(haversineKm(s.originLat, s.originLng, s.destLat, s.destLng));
        return [
            s.trackingId          || '',
            s.customerName        || '',
            s.cargoType           || '',
            s.status              || '',
            s.priority            || '',
            s.origin              || '',
            s.destination         || '',
            km                    || '',
            s.weightKg            || '',
            s.assignedDriverName  || 'Unassigned',
            s.estimatedDeliveryTime ? new Date(s.estimatedDeliveryTime).toLocaleString('en-IN') : '',
            s.dispatchTime          ? new Date(s.dispatchTime).toLocaleString('en-IN') : ''
        ].map(function(v) { return '"' + String(v).replace(/"/g, '""') + '"'; });
    });

    var csv     = [headers.join(',')]
        .concat(rows.map(function(r){ return r.join(','); }))
        .join('\n');

    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    var url  = URL.createObjectURL(blob);
    var a    = document.createElement('a');
    a.href     = url;
    a.download = 'logipulse_analytics_' +
        new Date().toISOString().slice(0,10) + '.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast('success', '&#8659; Exported', 'Analytics CSV downloaded successfully.');
}

// TOAST
function showToast(type, title, message) {
    var c = document.getElementById('toastContainer');
    if (!c) return;
    var t = document.createElement('div');
    t.className = 'toast ' + type;
    t.innerHTML = '<div class="toast-title">' + title + '</div><div class="toast-message">' + message + '</div>';
    c.appendChild(t);
    setTimeout(function() {
        t.style.opacity='0'; t.style.transform='translateX(110%)'; t.style.transition='all 0.3s';
        setTimeout(function(){ if(t.parentNode) t.parentNode.removeChild(t); }, 300);
    }, 5000);
}