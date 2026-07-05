package com.logipulse.service;

import com.logipulse.model.RouteAnomaly;
import com.logipulse.model.Shipment;
import com.logipulse.model.ShipmentMilestone;
import com.logipulse.model.User;
import com.logipulse.repository.MilestoneRepository;
import com.logipulse.repository.RouteAnomalyRepository;
import com.logipulse.repository.ShipmentRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Random;

@Service
public class ShipmentService {

    @Autowired private ShipmentRepository    shipmentRepository;
    @Autowired private RouteAnomalyRepository routeAnomalyRepository;
    @Autowired private MilestoneRepository   milestoneRepository;
    @Autowired private NewsService           newsService;
    @Autowired private RouteGeometryService  routeGeometryService;
    @Autowired private UserService           userService;

    // CREATE SHIPMENT — isolated by owner
    public Shipment createShipment(Map<String, Object> data, User currentUser) {
        LocalDateTime now = LocalDateTime.now();

        // BRANDING UPDATE: Tracking IDs now start with VSST-
        String trackingId = "VSST-" + System.currentTimeMillis() % 100000;

        double originLat = Double.parseDouble(data.get("originLat").toString());
        double originLng = Double.parseDouble(data.get("originLng").toString());
        double destLat   = Double.parseDouble(data.get("destLat").toString());
        double destLng   = Double.parseDouble(data.get("destLng").toString());

        int etaHours = 24;
        if (data.get("etaHours") != null) {
            try { etaHours = Integer.parseInt(data.get("etaHours").toString()); }
            catch (NumberFormatException ignored) {}
        }
        etaHours = Math.max(1, Math.min(720, etaHours)); // Allow up to 720 hours (30 days)

        Shipment s = new Shipment();
        s.setTrackingId(trackingId);
        s.setCargoType((String) data.getOrDefault("cargoType", "General Cargo"));
        s.setCustomerName((String) data.getOrDefault("customerName", "Unknown"));
        s.setWeightKg(data.get("weightKg") != null
                ? Double.parseDouble(data.get("weightKg").toString()) : 0.0);
        s.setPriority((String) data.getOrDefault("priority", "NORMAL"));
        s.setOrigin((String) data.get("origin"));
        s.setOriginLat(originLat);
        s.setOriginLng(originLng);
        s.setDestination((String) data.get("destination"));
        s.setDestLat(destLat);
        s.setDestLng(destLng);
        s.setCurrentLat(originLat);
        s.setCurrentLng(originLng);
        s.setStatus("IN_TRANSIT");
        s.setDispatchTime(now);

        s.setEstimatedDeliveryTime(now.plusHours(etaHours));

        // Set tenant ownership
        Long ownerId = userService.resolveOwnerId(currentUser);
        s.setOwnerId(ownerId);

        if (data.get("vehicleId") != null && !data.get("vehicleId").toString().isBlank()) {
            s.setVehicleId(Long.parseLong(data.get("vehicleId").toString()));
        }
        if (data.get("assignedDriverName") != null) {
            s.setAssignedDriverName((String) data.get("assignedDriverName"));
        }

        // Fetch real road route from ORS API
        String routeGeometry = routeGeometryService.fetchRoadRoute(
                originLat, originLng, destLat, destLng
        );

        // Fallback to interpolated straight line if ORS fails
        if (routeGeometry == null) {
            routeGeometry = routeGeometryService.straightLineWithPoints(
                    originLat, originLng, destLat, destLng
            );
        }
        s.setRouteGeometry(routeGeometry);

        Shipment saved = shipmentRepository.save(s);
        addMilestone(saved.getId(), "DISPATCHED",
                "Shipment dispatched from " + saved.getOrigin(), saved.getOrigin());

        System.out.println("✅ Created: " + trackingId + " | owner: " + ownerId +
                " | ETA: " + etaHours + " hours" +
                " | route: " + (routeGeometry != null ? "road" : "straight"));
        return saved;
    }

    // GET ALL — filtered by owner
    public List<Shipment> getShipmentsForUser(User user) {
        Long ownerId = userService.resolveOwnerId(user);
        return shipmentRepository.findByOwnerId(ownerId);
    }

    // GET ALL (used by scheduler — no tenant filter needed)
    public List<Shipment> getAllShipments() {
        return shipmentRepository.findAll();
    }

    public Optional<Shipment> getShipmentById(Long id) {
        return shipmentRepository.findById(id);
    }

    public List<RouteAnomaly> getAnomaliesForShipment(Long shipmentId) {
        return routeAnomalyRepository.findByShipmentId(shipmentId);
    }

    // REROUTE — fetch alternate road route
    public Shipment rerouteShipment(Long id) {
        Optional<Shipment> opt = shipmentRepository.findById(id);
        if (opt.isEmpty()) return null;
        Shipment s = opt.get();
        s.setStatus("REROUTED");

        s.setEstimatedDeliveryTime(
                (s.getEstimatedDeliveryTime() != null
                        ? s.getEstimatedDeliveryTime()
                        : LocalDateTime.now())
                        .plusHours(2)
        );

        // Fetch ALTERNATE road route for the rerouted corridor
        if (s.getOriginLat() != null && s.getDestLat() != null) {
            String altRoute = routeGeometryService.fetchAlternateRoute(
                    s.getCurrentLat(), s.getCurrentLng(),
                    s.getDestLat(),    s.getDestLng()
            );
            if (altRoute == null) {
                altRoute = routeGeometryService.straightLineWithPoints(
                        s.getCurrentLat(), s.getCurrentLng(),
                        s.getDestLat(),    s.getDestLng()
                );
            }
            s.setRouteGeometry(altRoute);
        }

        Shipment saved = shipmentRepository.save(s);
        addMilestone(saved.getId(), "REROUTED",
                "AI Auto-Reroute: Alternate corridor selected. ETA extended.", saved.getOrigin());
        return saved;
    }

    // MARK DELIVERED
    public Shipment markDelivered(Long id) {
        Optional<Shipment> opt = shipmentRepository.findById(id);
        if (opt.isEmpty()) return null;
        Shipment s = opt.get();
        s.setStatus("DELIVERED");
        if (s.getDestLat() != null) {
            s.setCurrentLat(s.getDestLat());
            s.setCurrentLng(s.getDestLng());
        }
        Shipment saved = shipmentRepository.save(s);
        addMilestone(saved.getId(), "DELIVERED",
                "Shipment delivered to " + saved.getDestination(), saved.getDestination());
        return saved;
    }

    // UPDATE
    public Shipment updateShipment(Long id, Map<String, Object> data) {
        Optional<Shipment> opt = shipmentRepository.findById(id);
        if (opt.isEmpty()) return null;
        Shipment s = opt.get();
        if (data.get("cargoType")         != null) s.setCargoType((String) data.get("cargoType"));
        if (data.get("customerName")      != null) s.setCustomerName((String) data.get("customerName"));
        if (data.get("priority")          != null) s.setPriority((String) data.get("priority"));
        if (data.get("weightKg")          != null) s.setWeightKg(Double.parseDouble(data.get("weightKg").toString()));
        if (data.get("assignedDriverName") != null) s.setAssignedDriverName((String) data.get("assignedDriverName"));
        return shipmentRepository.save(s);
    }

    // DELETE
    public boolean deleteShipment(Long id) {
        if (!shipmentRepository.existsById(id)) return false;
        routeAnomalyRepository.findByShipmentId(id).forEach(routeAnomalyRepository::delete);
        milestoneRepository.findByShipmentIdOrderByOccurredAtAsc(id).forEach(milestoneRepository::delete);
        shipmentRepository.deleteById(id);
        return true;
    }

    // TRIGGER ANOMALY (still available for auto-disruption scheduler)
    public RouteAnomaly triggerAnomaly() {
        List<Shipment> inTransit = shipmentRepository.findByStatus("IN_TRANSIT");
        if (inTransit.isEmpty()) return null;
        Random random = new Random();
        Shipment target = inTransit.get(random.nextInt(inTransit.size()));
        target.setStatus("DELAYED");
        shipmentRepository.save(target);

        String desc = "Auto-disruption on the " +
                (target.getOrigin()      != null ? target.getOrigin().split(",")[0]      : "origin") +
                " → " +
                (target.getDestination() != null ? target.getDestination().split(",")[0] : "destination") +
                " corridor detected by monitoring system.";

        RouteAnomaly anomaly = new RouteAnomaly();
        anomaly.setShipmentId(target.getId());
        anomaly.setSeverity("MEDIUM");
        anomaly.setDescription(desc);
        anomaly.setDetectedAt(LocalDateTime.now());
        RouteAnomaly saved = routeAnomalyRepository.save(anomaly);
        addMilestone(target.getId(), "DELAYED", desc, target.getOrigin());
        return saved;
    }

    // MILESTONES
    public ShipmentMilestone addMilestone(Long shipmentId, String eventType,
                                          String description, String location) {
        ShipmentMilestone m = new ShipmentMilestone();
        m.setShipmentId(shipmentId);
        m.setEventType(eventType);
        m.setDescription(description);
        m.setLocation(location != null ? location : "");
        m.setOccurredAt(LocalDateTime.now());
        return milestoneRepository.save(m);
    }

    public List<ShipmentMilestone> getMilestonesForShipment(Long id) {
        return milestoneRepository.findByShipmentIdOrderByOccurredAtAsc(id);
    }
}