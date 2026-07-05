package com.logipulse.controller;

import com.logipulse.model.RouteAnomaly;
import com.logipulse.model.Shipment;
import com.logipulse.model.User;
import com.logipulse.repository.RouteAnomalyRepository;
import com.logipulse.repository.ShipmentRepository;
import com.logipulse.repository.VehicleRepository;
import com.logipulse.service.ShipmentService;
import com.logipulse.service.UserService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/analytics")
@CrossOrigin(origins = "*")
public class AnalyticsController {

    @Autowired private ShipmentService       shipmentService;
    @Autowired private ShipmentRepository    shipmentRepository;
    @Autowired private RouteAnomalyRepository anomalyRepository;
    @Autowired private VehicleRepository     vehicleRepository;
    @Autowired private UserService           userService;

    // Helper
    private User getCurrentUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() ||
                "anonymousUser".equals(auth.getPrincipal())) return null;
        return userService.findByUsername(auth.getName()).orElse(null);
    }

    // GET /api/analytics/summary — tenant-isolated KPIs — This is the ONLY controller that handles this URL.
    @GetMapping("/summary")
    public ResponseEntity<?> getSummary() {
        User user = getCurrentUser();
        if (user == null) {
            return ResponseEntity.status(401)
                    .body(Map.of("error", "Not authenticated."));
        }

        try {
            // Only this user's shipments
            List<Shipment> shipments = shipmentService.getShipmentsForUser(user);

            long total     = shipments.size();
            long inTransit = shipments.stream()
                    .filter(s -> "IN_TRANSIT".equals(s.getStatus())).count();
            long delayed   = shipments.stream()
                    .filter(s -> "DELAYED".equals(s.getStatus())).count();
            long rerouted  = shipments.stream()
                    .filter(s -> "REROUTED".equals(s.getStatus())).count();
            long delivered = shipments.stream()
                    .filter(s -> "DELIVERED".equals(s.getStatus())).count();

            double totalWeightKg = shipments.stream()
                    .mapToDouble(s -> s.getWeightKg() != null ? s.getWeightKg() : 0.0)
                    .sum();

            double onTimeRate = total > 0
                    ? Math.round(((inTransit + delivered + rerouted * 0.5) / (double) total) * 100.0)
                    : 0.0;
            double delayRate  = total > 0
                    ? Math.round((delayed / (double) total) * 100.0)
                    : 0.0;

            // Anomalies scoped to this user's shipments
            List<Long> shipmentIds = shipments.stream()
                    .map(Shipment::getId).toList();
            long anomalyCount = anomalyRepository.findAll().stream()
                    .filter(a -> shipmentIds.contains(a.getShipmentId()))
                    .count();

            // Vehicles scoped to this user
            Long ownerId       = userService.resolveOwnerId(user);
            long totalVehicles = vehicleRepository.findByOwnerId(ownerId).size();
            long availVehicles = vehicleRepository
                    .findByOwnerIdAndStatus(ownerId, "AVAILABLE").size();

            Map<String, Object> summary = new HashMap<>();
            summary.put("totalShipments",  total);
            summary.put("inTransit",       inTransit);
            summary.put("delayed",         delayed);
            summary.put("rerouted",        rerouted);
            summary.put("delivered",       delivered);
            summary.put("onTimeRate",      onTimeRate);
            summary.put("delayRate",       delayRate);
            summary.put("totalWeightKg",   totalWeightKg);
            summary.put("totalWeightTons", totalWeightKg / 1000.0);
            summary.put("totalAnomalies",  anomalyCount);
            summary.put("totalVehicles",   totalVehicles);
            summary.put("availVehicles",   availVehicles);

            return ResponseEntity.ok(summary);

        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", "Analytics summary failed: " + e.getMessage()));
        }
    }
}