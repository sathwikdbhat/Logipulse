package com.logipulse.controller;

import com.logipulse.model.RouteAnomaly;
import com.logipulse.model.Shipment;
import com.logipulse.model.ShipmentMilestone;
import com.logipulse.model.User;
import com.logipulse.repository.RouteAnomalyRepository;
import com.logipulse.repository.ShipmentRepository;
import com.logipulse.service.ShipmentService;
import com.logipulse.service.UserService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@CrossOrigin(origins = "*")
public class LogisticsController {

    @Autowired
    private ShipmentService shipmentService;

    @Autowired
    private ShipmentRepository shipmentRepository;

    @Autowired
    private RouteAnomalyRepository routeAnomalyRepository;

    @Autowired
    private UserService userService;

    // Helper — current logged-in user
    private User getCurrentUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() ||
                "anonymousUser".equals(auth.getPrincipal())) {
            return null;
        }
        return userService.findByUsername(auth.getName()).orElse(null);
    }

    // SHIPMENTS — GET ALL (tenant-isolated)
    @GetMapping("/api/shipments")
    public ResponseEntity<?> getAllShipments() {
        User user = getCurrentUser();
        if (user == null) {
            return ResponseEntity.status(401)
                    .body(Map.of("error", "Not authenticated. Please log in."));
        }
        try {
            List<Shipment> shipments = shipmentService.getShipmentsForUser(user);
            return ResponseEntity.ok(shipments);
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", "Failed to load shipments: " + e.getMessage()));
        }
    }

    // SHIPMENTS — GET BY ID
    @GetMapping("/api/shipments/{id}")
    public ResponseEntity<?> getShipmentById(@PathVariable Long id) {
        User user = getCurrentUser();
        if (user == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Not authenticated."));
        }

        Optional<Shipment> opt = shipmentService.getShipmentById(id);
        if (opt.isEmpty()) {
            return ResponseEntity.status(404).body(Map.of("error", "Shipment not found"));
        }

        Shipment s   = opt.get();
        Long ownerId = userService.resolveOwnerId(user);
        if (s.getOwnerId() != null && !s.getOwnerId().equals(ownerId)) {
            return ResponseEntity.status(403).body(Map.of("error", "Access denied"));
        }

        List<RouteAnomaly> anomalies = shipmentService.getAnomaliesForShipment(id);

        Map<String, Object> response = new HashMap<>();
        response.put("shipment",  s);
        response.put("anomalies", anomalies);
        return ResponseEntity.ok(response);
    }

    // SHIPMENTS — CREATE
    @PostMapping("/api/shipments")
    public ResponseEntity<?> createShipment(@RequestBody Map<String, Object> data) {
        User user = getCurrentUser();
        if (user == null) {
            return ResponseEntity.status(401)
                    .body(Map.of("error", "Not authenticated. Please log in."));
        }

        if (data.get("originLat") == null || data.get("destLat") == null) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "Origin and destination coordinates are required."));
        }
        if (data.get("customerName") == null ||
                data.get("customerName").toString().isBlank()) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "Customer name is required."));
        }

        try {
            Shipment created = shipmentService.createShipment(data, user);
            Map<String, Object> response = new HashMap<>();
            response.put("shipment", created);
            response.put("message",
                    "Shipment " + created.getTrackingId() + " created successfully");
            return ResponseEntity.status(201).body(response);
        } catch (Exception e) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "Failed to create shipment: " + e.getMessage()));
        }
    }

    // SHIPMENTS — UPDATE
    @PutMapping("/api/shipments/{id}")
    public ResponseEntity<?> updateShipment(@PathVariable Long id,
                                            @RequestBody Map<String, Object> data) {
        User user = getCurrentUser();
        if (user == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Not authenticated."));
        }

        Optional<Shipment> opt = shipmentService.getShipmentById(id);
        if (opt.isEmpty()) {
            return ResponseEntity.status(404).body(Map.of("error", "Shipment not found"));
        }

        Long ownerId = userService.resolveOwnerId(user);
        if (opt.get().getOwnerId() != null && !opt.get().getOwnerId().equals(ownerId)) {
            return ResponseEntity.status(403).body(Map.of("error", "Access denied"));
        }

        try {
            Shipment updated = shipmentService.updateShipment(id, data);
            return ResponseEntity.ok(Map.of("shipment", updated, "message", "Shipment updated"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // SHIPMENTS — DELETE (admin only)
    @DeleteMapping("/api/shipments/{id}")
    public ResponseEntity<?> deleteShipment(@PathVariable Long id) {
        User user = getCurrentUser();
        if (user == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Not authenticated."));
        }
        if (!"ADMIN".equals(user.getRole())) {
            return ResponseEntity.status(403)
                    .body(Map.of("error", "Only admins can delete shipments."));
        }

        Optional<Shipment> opt = shipmentService.getShipmentById(id);
        if (opt.isEmpty()) {
            return ResponseEntity.status(404).body(Map.of("error", "Shipment not found"));
        }

        Long ownerId = userService.resolveOwnerId(user);
        if (opt.get().getOwnerId() != null && !opt.get().getOwnerId().equals(ownerId)) {
            return ResponseEntity.status(403)
                    .body(Map.of("error", "Cannot delete another admin's shipment"));
        }

        boolean deleted = shipmentService.deleteShipment(id);
        if (deleted) {
            return ResponseEntity.ok(Map.of("message", "Shipment deleted successfully"));
        }
        return ResponseEntity.internalServerError()
                .body(Map.of("error", "Failed to delete shipment"));
    }

    // REROUTE
    @PostMapping("/api/shipments/{id}/reroute")
    public ResponseEntity<?> rerouteShipment(@PathVariable Long id) {
        User user = getCurrentUser();
        if (user == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Not authenticated."));
        }

        Optional<Shipment> opt = shipmentService.getShipmentById(id);
        if (opt.isEmpty()) {
            return ResponseEntity.status(404).body(Map.of("error", "Shipment not found"));
        }

        Long ownerId = userService.resolveOwnerId(user);
        if (opt.get().getOwnerId() != null && !opt.get().getOwnerId().equals(ownerId)) {
            return ResponseEntity.status(403).body(Map.of("error", "Access denied"));
        }

        try {
            Shipment rerouted = shipmentService.rerouteShipment(id);
            if (rerouted == null) {
                return ResponseEntity.status(404).body(Map.of("error", "Shipment not found"));
            }
            return ResponseEntity.ok(Map.of(
                    "shipment", rerouted,
                    "message",  "Rerouted via alternate corridor. ETA +5 min."
            ));
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", "Reroute failed: " + e.getMessage()));
        }
    }

    // DELIVER (manual override — admin only)
    @PostMapping("/api/shipments/{id}/deliver")
    public ResponseEntity<?> markDelivered(@PathVariable Long id) {
        User user = getCurrentUser();
        if (user == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Not authenticated."));
        }
        if (!"ADMIN".equals(user.getRole())) {
            return ResponseEntity.status(403)
                    .body(Map.of("error", "Only admins can manually deliver shipments."));
        }

        try {
            Shipment delivered = shipmentService.markDelivered(id);
            if (delivered == null) {
                return ResponseEntity.status(404).body(Map.of("error", "Shipment not found"));
            }
            return ResponseEntity.ok(Map.of(
                    "shipment", delivered,
                    "message",  "Shipment marked as delivered."
            ));
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", e.getMessage()));
        }
    }

    // DISRUPTIONS — trigger (kept for scheduler compat, button removed from UI)
    @PostMapping("/api/disruptions/trigger")
    public ResponseEntity<?> triggerDisruption() {
        User user = getCurrentUser();
        if (user == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Not authenticated."));
        }

        try {
            RouteAnomaly anomaly = shipmentService.triggerAnomaly();
            if (anomaly == null) {
                return ResponseEntity.ok(
                        Map.of("message", "No IN_TRANSIT shipments available."));
            }

            return ResponseEntity.ok(Map.of(
                    "anomaly", anomaly,
                    "message", "Disruption triggered on shipment #" + anomaly.getShipmentId()
            ));
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", e.getMessage()));
        }
    }

    // ANOMALIES — get all for this user's shipments
    @GetMapping("/api/anomalies")
    public ResponseEntity<?> getAllAnomalies() {
        User user = getCurrentUser();
        if (user == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Not authenticated."));
        }

        try {
            List<Shipment> userShipments = shipmentService.getShipmentsForUser(user);
            List<Long> shipmentIds = userShipments.stream()
                    .map(Shipment::getId).toList();

            List<RouteAnomaly> anomalies = routeAnomalyRepository.findAll()
                    .stream()
                    .filter(a -> shipmentIds.contains(a.getShipmentId()))
                    .toList();

            return ResponseEntity.ok(anomalies);
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", "Failed to load anomalies: " + e.getMessage()));
        }
    }

    // ANOMALIES — by shipment
    @GetMapping("/api/anomalies/{shipmentId}")
    public ResponseEntity<?> getAnomaliesByShipment(@PathVariable Long shipmentId) {
        User user = getCurrentUser();
        if (user == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Not authenticated."));
        }

        Optional<Shipment> opt = shipmentService.getShipmentById(shipmentId);
        if (opt.isEmpty()) {
            return ResponseEntity.status(404).body(Map.of("error", "Shipment not found"));
        }

        Long ownerId = userService.resolveOwnerId(user);
        if (opt.get().getOwnerId() != null && !opt.get().getOwnerId().equals(ownerId)) {
            return ResponseEntity.status(403).body(Map.of("error", "Access denied"));
        }

        return ResponseEntity.ok(shipmentService.getAnomaliesForShipment(shipmentId));
    }

    // MILESTONES — GET
    @GetMapping("/api/shipments/{id}/milestones")
    public ResponseEntity<?> getMilestones(@PathVariable Long id) {
        User user = getCurrentUser();
        if (user == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Not authenticated."));
        }

        Optional<Shipment> opt = shipmentService.getShipmentById(id);
        if (opt.isEmpty()) {
            return ResponseEntity.status(404).body(Map.of("error", "Shipment not found"));
        }

        Long ownerId = userService.resolveOwnerId(user);
        if (opt.get().getOwnerId() != null && !opt.get().getOwnerId().equals(ownerId)) {
            return ResponseEntity.status(403).body(Map.of("error", "Access denied"));
        }

        return ResponseEntity.ok(shipmentService.getMilestonesForShipment(id));
    }

    // MILESTONES — POST (add manual checkpoint)
    @PostMapping("/api/shipments/{id}/milestone")
    public ResponseEntity<?> addMilestone(@PathVariable Long id,
                                          @RequestBody Map<String, String> body) {
        User user = getCurrentUser();
        if (user == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Not authenticated."));
        }

        Optional<Shipment> opt = shipmentService.getShipmentById(id);
        if (opt.isEmpty()) {
            return ResponseEntity.status(404).body(Map.of("error", "Shipment not found"));
        }

        Long ownerId = userService.resolveOwnerId(user);
        if (opt.get().getOwnerId() != null && !opt.get().getOwnerId().equals(ownerId)) {
            return ResponseEntity.status(403).body(Map.of("error", "Access denied"));
        }

        ShipmentMilestone m = shipmentService.addMilestone(
                id,
                body.getOrDefault("eventType",   "CHECKPOINT"),
                body.getOrDefault("description", "Manual checkpoint"),
                body.getOrDefault("location",    "")
        );
        return ResponseEntity.status(201).body(Map.of("milestone", m, "message", "Milestone added"));
    }

    // CARGO TYPES — shared reference data (no tenant filter needed)
    @GetMapping("/api/cargo-types")
    public ResponseEntity<?> getCargoTypes() {
        return ResponseEntity.ok(List.of(
                "Bulk Copper Sulphate",
                "Agri Products / Grains",
                "Cold Chain / Perishables",
                "Electronics & Components",
                "Textiles & Garments",
                "FMCG / Consumer Goods",
                "Pharmaceuticals",
                "Automotive Parts",
                "Construction Materials",
                "Chemical / Hazmat",
                "Heavy Machinery",
                "Medical Equipment",
                "Defence Supplies",
                "Plastics & Polymers",
                "Steel & Metal Products",
                "Furniture & Wood",
                "Paper & Packaging",
                "Oil & Petroleum",
                "Rubber Products",
                "Electrical Equipment",
                "Dairy Products",
                "Footwear & Leather"
        ));
    }

    // NOTE: /api/analytics/summary is handled by AnalyticsController — NOT here.
    // Removing it from this file fixes the "Ambiguous mapping" startup error.
}