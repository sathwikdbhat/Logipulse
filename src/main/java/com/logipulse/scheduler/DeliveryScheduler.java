package com.logipulse.scheduler;

import com.logipulse.model.Shipment;
import com.logipulse.repository.ShipmentRepository;
import com.logipulse.service.VehicleService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;

@Component
public class DeliveryScheduler {

    @Autowired
    private ShipmentRepository shipmentRepository;

    @Autowired
    private VehicleService vehicleService;

    // AUTO-DELIVER — runs every 10 seconds — Delivers BOTH IN_TRANSIT and REROUTED shipments past their ETA
    @Scheduled(fixedRate = 10000)
    public void autoDeliverExpiredShipments() {
        LocalDateTime now = LocalDateTime.now();

        List<Shipment> expired = shipmentRepository.findAll().stream()
                .filter(s -> ("IN_TRANSIT".equals(s.getStatus()) || "REROUTED".equals(s.getStatus())))
                .filter(s -> {
                    // Check 1: Real ETA expiration
                    boolean isRealExpired = s.getEstimatedDeliveryTime() != null
                            && s.getEstimatedDeliveryTime().isBefore(now);

                    // Check 2: Hackathon 5-minute limit
                    boolean isHackathonExpired = s.getDispatchTime() != null
                            && ChronoUnit.SECONDS.between(s.getDispatchTime(), now) >= 300;

                    return isRealExpired || isHackathonExpired;
                })
                .toList();

        for (Shipment s : expired) {
            s.setStatus("DELIVERED");
            if (s.getDestLat() != null) {
                s.setCurrentLat(s.getDestLat());
                s.setCurrentLng(s.getDestLng());
            }
            shipmentRepository.save(s);

            if (s.getVehicleId() != null) {
                try { vehicleService.updateStatus(s.getVehicleId(), "AVAILABLE"); }
                catch (Exception e) {
                    System.err.println("DeliveryScheduler: vehicle status update failed — "
                            + e.getMessage());
                }
            }

            System.out.println("✅ AutoDeliver: " + s.getTrackingId()
                    + " [" + s.getStatus() + "] at " + now);
        }
    }

    // SIMULATE MOVEMENT — runs every 3 seconds — HACKATHON MODE: Forces all deliveries to complete in exactly 5 mins
    @Scheduled(fixedRate = 3000)
    public void simulateRealisticMovement() {
        LocalDateTime now = LocalDateTime.now();

        List<Shipment> moving = shipmentRepository.findAll().stream()
                .filter(s ->
                        ("IN_TRANSIT".equals(s.getStatus()) || "REROUTED".equals(s.getStatus()))
                                && s.getDestLat() != null
                                && s.getCurrentLat() != null
                )
                .toList();

        for (Shipment s : moving) {
            double currLat = s.getCurrentLat();
            double currLng = s.getCurrentLng();
            double dLat    = s.getDestLat() - currLat;
            double dLng    = s.getDestLng() - currLng;
            double distDeg = Math.sqrt(dLat * dLat + dLng * dLng);

            if (distDeg < 0.002) continue;

            // HACKATHON LOGIC: Calculate steps based on 5 minutes (300 seconds), NOT the realistic ETA
            long secondsSinceDispatch = s.getDispatchTime() != null
                    ? ChronoUnit.SECONDS.between(s.getDispatchTime(), now)
                    : 0;

            long simSecondsLeft = 300 - secondsSinceDispatch;
            if (simSecondsLeft <= 0) simSecondsLeft = 1; // Prevent division by zero and force final step

            // How many 3-second steps are left in our 5-minute window?
            double stepsRemaining = Math.max(1, simSecondsLeft / 3.0);

            // Calculate distance to move this tick
            double baseStep       = distDeg / stepsRemaining;
            double jitter         = 0.88 + (Math.random() * 0.24); // Give it a realistic stutter
            double step           = Math.min(baseStep * jitter, distDeg * 0.09); // Cap max speed

            s.setCurrentLat(currLat + (dLat / distDeg) * step);
            s.setCurrentLng(currLng + (dLng / distDeg) * step);
            shipmentRepository.save(s);
        }
    }
}