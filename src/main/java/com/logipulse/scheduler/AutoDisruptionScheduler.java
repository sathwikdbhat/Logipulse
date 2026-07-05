package com.logipulse.scheduler;

import com.logipulse.model.RouteAnomaly;
import com.logipulse.model.Shipment;
import com.logipulse.repository.RouteAnomalyRepository;
import com.logipulse.repository.ShipmentRepository;
import com.logipulse.service.NewsService;
import com.logipulse.service.ShipmentService;
import com.logipulse.service.WeatherService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Component
public class AutoDisruptionScheduler {

    @Autowired
    private ShipmentRepository shipmentRepository;

    @Autowired
    private RouteAnomalyRepository routeAnomalyRepository;

    @Autowired
    private NewsService newsService;

    @Autowired
    private WeatherService weatherService;

    @Autowired
    private ShipmentService shipmentService;

    // AUTO-DISRUPTION — runs every 3 minutes — Max 1 disruption per cycle to avoid flooding
    @Scheduled(fixedRate = 180000)
    public void checkForRealDisruptions() {
        List<Shipment> inTransit = shipmentRepository.findByStatus("IN_TRANSIT");
        if (inTransit.isEmpty()) return;

        int disrupted = 0;

        for (Shipment s : inTransit) {
            if (disrupted >= 1) break;

            // Skip if recently disrupted (within last 10 minutes)
            boolean recentAnomaly = routeAnomalyRepository
                    .findByShipmentId(s.getId()).stream()
                    .anyMatch(a -> a.getDetectedAt() != null
                            && a.getDetectedAt().isAfter(LocalDateTime.now().minusMinutes(10)));
            if (recentAnomaly) continue;

            if (checkWeatherDisruption(s)) { disrupted++; continue; }
            if (checkNewsDisruption(s))    { disrupted++; }
        }
    }

    // AUTO-REROUTE — runs every 5 seconds — reroutes DELAYED shipments after 10 seconds of being delayed
    @Scheduled(fixedRate = 5000)
    public void autoRerouteDelayedShipments() {
        List<Shipment> delayed = shipmentRepository.findByStatus("DELAYED");

        for (Shipment s : delayed) {
            List<RouteAnomaly> anomalies =
                    routeAnomalyRepository.findByShipmentId(s.getId());
            if (anomalies.isEmpty()) {
                // No anomaly record but status is DELAYED — reroute immediately
                performAutoReroute(s);
                continue;
            }

            RouteAnomaly latest = anomalies.stream()
                    .filter(a -> a.getDetectedAt() != null)
                    .max((a, b) -> a.getDetectedAt().compareTo(b.getDetectedAt()))
                    .orElse(null);

            if (latest == null) { performAutoReroute(s); continue; }

            // Auto-reroute after 10 seconds of being DELAYED
            boolean shouldReroute = latest.getDetectedAt()
                    .isBefore(LocalDateTime.now().minusSeconds(10));

            if (shouldReroute) performAutoReroute(s);
        }
    }

    // WEATHER-BASED DISRUPTION
    private boolean checkWeatherDisruption(Shipment s) {
        if (s.getCurrentLat() == null || s.getCurrentLng() == null) return false;

        try {
            Map<String, Object> weather =
                    weatherService.getWeather(s.getCurrentLat(), s.getCurrentLng());

            if (!Boolean.TRUE.equals(weather.get("isHazardous"))) return false;

            String main        = (String) weather.getOrDefault("main", "Storm");
            String description = (String) weather.getOrDefault("description", "severe weather");
            String origin      = s.getOrigin()      != null
                    ? s.getOrigin().split(",")[0]      : "origin";
            String dest        = s.getDestination() != null
                    ? s.getDestination().split(",")[0] : "destination";

            String anomalyDesc =
                    "⛈ Weather alert: " + description + " detected on the " +
                            origin + " → " + dest + " corridor. " +
                            "Heavy vehicle movement restricted by local authorities.";

            createAnomalyAndDisrupt(s, "HIGH", anomalyDesc);
            System.out.println("AutoDisruption [WEATHER]: " + s.getTrackingId()
                    + " — " + main);
            return true;

        } catch (Exception e) {
            System.err.println("AutoDisruption weather check failed: " + e.getMessage());
            return false;
        }
    }

    // NEWS-BASED DISRUPTION
    private boolean checkNewsDisruption(Shipment s) {
        try {
            Map<String, String> news =
                    newsService.getNewsForRoute(s.getOrigin(), s.getDestination());

            if (news == null) return false;

            String combined = (news.getOrDefault("title", "") + " " +
                    news.getOrDefault("description", "")).toLowerCase();

            if (!isRouteRelevantDisruption(combined, s)) return false;

            String severity = (combined.contains("flood")    ||
                    combined.contains("cyclone")  ||
                    combined.contains("landslide")||
                    combined.contains("storm")    ||
                    combined.contains("collapse"))
                    ? "HIGH" : "MEDIUM";

            String desc = news.getOrDefault("description",
                    "Route disruption on " + getRouteLabel(s) + " corridor.");

            createAnomalyAndDisrupt(s, severity, desc);
            System.out.println("AutoDisruption [NEWS]: " + s.getTrackingId()
                    + " — " + news.getOrDefault("title", "disruption"));
            return true;

        } catch (Exception e) {
            System.err.println("AutoDisruption news check failed: " + e.getMessage());
            return false;
        }
    }

    // Relevance check
    private boolean isRouteRelevantDisruption(String newsText, Shipment s) {
        if (newsText == null || newsText.isBlank()) return false;

        boolean hasKeyword =
                newsText.contains("road") || newsText.contains("highway") ||
                        newsText.contains("flood") || newsText.contains("accident") ||
                        newsText.contains("traffic") || newsText.contains("landslide") ||
                        newsText.contains("blocked") || newsText.contains("bridge") ||
                        newsText.contains("storm") || newsText.contains("cyclone") ||
                        newsText.contains("diversion") || newsText.contains("closed");

        if (!hasKeyword) return false;

        String originState = extractState(s.getOrigin()).toLowerCase();
        String destState   = extractState(s.getDestination()).toLowerCase();

        boolean routeMatch =
                (!originState.isBlank() && newsText.contains(originState)) ||
                        (!destState.isBlank()   && newsText.contains(destState));

        // 25% chance for generic national disruptions even if no route match
        return routeMatch || Math.random() < 0.25;
    }

    // Create anomaly + disrupt
    private void createAnomalyAndDisrupt(Shipment s, String severity, String description) {
        s.setStatus("DELAYED");
        shipmentRepository.save(s);

        RouteAnomaly anomaly = new RouteAnomaly();
        anomaly.setShipmentId(s.getId());
        anomaly.setSeverity(severity);
        anomaly.setDescription(description);
        anomaly.setDetectedAt(LocalDateTime.now());
        routeAnomalyRepository.save(anomaly);

        shipmentService.addMilestone(s.getId(), "DELAYED", description, s.getOrigin());
    }

    // AUTO-REROUTE — delegates to the same reroute logic used everywhere else
    // (fetches a real alternate route geometry for the map, extends ETA consistently)
    private void performAutoReroute(Shipment s) {
        try {
            shipmentService.rerouteShipment(s.getId());
            System.out.println("AutoReroute: " + s.getTrackingId()
                    + " → REROUTED automatically");
        } catch (Exception e) {
            System.err.println("AutoReroute failed for " + s.getTrackingId()
                    + ": " + e.getMessage());
        }
    }

    private String extractState(String location) {
        if (location == null || location.isBlank()) return "";
        String[] parts = location.split(",");
        return parts.length > 1 ? parts[parts.length - 1].trim() : location.trim();
    }

    private String getRouteLabel(Shipment s) {
        String from = s.getOrigin()      != null ? s.getOrigin().split(",")[0]      : "?";
        String to   = s.getDestination() != null ? s.getDestination().split(",")[0] : "?";
        return from + " → " + to;
    }
}