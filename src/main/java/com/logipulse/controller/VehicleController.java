package com.logipulse.controller;

import com.logipulse.model.User;
import com.logipulse.model.Vehicle;
import com.logipulse.repository.VehicleRepository;
import com.logipulse.service.UserService;
import com.logipulse.service.VehicleService;
import jakarta.servlet.http.HttpServletRequest;
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
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/vehicles")
@CrossOrigin(origins = "*")
public class VehicleController {

    @Autowired
    private VehicleService vehicleService;

    @Autowired
    private VehicleRepository vehicleRepository;

    @Autowired
    private UserService userService;

    private User getCurrentUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() ||
                "anonymousUser".equals(auth.getPrincipal())) return null;
        return userService.findByUsername(auth.getName()).orElse(null);
    }

    // GET /api/vehicles — only this user's vehicles
    @GetMapping
    public ResponseEntity<?> getAllVehicles() {
        User user = getCurrentUser();
        if (user == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Not authenticated"));
        }
        Long ownerId = userService.resolveOwnerId(user);
        List<Vehicle> vehicles = vehicleRepository.findByOwnerId(ownerId);
        return ResponseEntity.ok(vehicles);
    }

    // GET /api/vehicles/available
    @GetMapping("/available")
    public ResponseEntity<?> getAvailable() {
        User user = getCurrentUser();
        if (user == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Not authenticated"));
        }
        Long ownerId = userService.resolveOwnerId(user);
        List<Vehicle> available = vehicleRepository.findByOwnerIdAndStatus(ownerId, "AVAILABLE");
        return ResponseEntity.ok(available);
    }

    // POST /api/vehicles — register a new vehicle
    @PostMapping
    public ResponseEntity<?> registerVehicle(@RequestBody Map<String, Object> body) {
        User user = getCurrentUser();
        if (user == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Not authenticated"));
        }
        if (!"ADMIN".equals(user.getRole())) {
            return ResponseEntity.status(403)
                    .body(Map.of("error", "Only admins can register vehicles."));
        }

        String regNumber     = (String) body.get("registrationNumber");
        String type          = (String) body.getOrDefault("vehicleType", "HEAVY_TRUCK");
        Double capacity      = body.get("capacityTons") != null
                ? Double.parseDouble(body.get("capacityTons").toString()) : 20.0;
        String manufacturer  = (String) body.getOrDefault("manufacturerName", "Unknown");
        Integer modelYear    = body.get("modelYear") != null
                ? Integer.parseInt(body.get("modelYear").toString()) : 2020;

        if (regNumber == null || regNumber.isBlank()) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "Registration number is required."));
        }

        if (vehicleService.existsByRegistration(regNumber)) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "Vehicle " + regNumber + " is already registered."));
        }

        try {
            Vehicle created = vehicleService.registerVehicle(
                    regNumber, type, capacity, manufacturer, modelYear
            );
            // Set owner
            created.setOwnerId(userService.resolveOwnerId(user));
            vehicleRepository.save(created);

            return ResponseEntity.status(201).body(Map.of(
                    "vehicle", created,
                    "message", "Vehicle " + regNumber + " registered successfully"
            ));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // PUT /api/vehicles/{id} — update vehicle
    @PutMapping("/{id}")
    public ResponseEntity<?> updateVehicle(@PathVariable Long id,
                                           @RequestBody Map<String, Object> body) {
        User user = getCurrentUser();
        if (user == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Not authenticated"));
        }

        Optional<Vehicle> opt = vehicleService.getById(id);
        if (opt.isEmpty()) {
            return ResponseEntity.status(404).body(Map.of("error", "Vehicle not found"));
        }

        Vehicle v = opt.get();
        if (body.get("status") != null)           v.setStatus((String) body.get("status"));
        if (body.get("vehicleType") != null)      v.setVehicleType((String) body.get("vehicleType"));
        if (body.get("manufacturerName") != null) v.setManufacturerName((String) body.get("manufacturerName"));
        if (body.get("capacityTons") != null) {
            v.setCapacityTons(Double.parseDouble(body.get("capacityTons").toString()));
        }

        Vehicle saved = vehicleService.save(v);
        return ResponseEntity.ok(Map.of("vehicle", saved, "message", "Vehicle updated"));
    }

    // DELETE /api/vehicles/{id}
    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteVehicle(@PathVariable Long id) {
        User user = getCurrentUser();
        if (user == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Not authenticated"));
        }
        if (!"ADMIN".equals(user.getRole())) {
            return ResponseEntity.status(403)
                    .body(Map.of("error", "Only admins can delete vehicles."));
        }

        try {
            vehicleService.deleteVehicle(id);
            return ResponseEntity.ok(Map.of("message", "Vehicle deleted"));
        } catch (RuntimeException e) {
            return ResponseEntity.status(404).body(Map.of("error", e.getMessage()));
        }
    }

    // PUT /api/vehicles/{id}/assign-driver
    @PutMapping("/{id}/assign-driver")
    public ResponseEntity<?> assignDriver(@PathVariable Long id,
                                          @RequestBody Map<String, Object> body) {
        User user = getCurrentUser();
        if (user == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Not authenticated"));
        }

        if (body.get("driverId") == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "driverId is required"));
        }

        Long driverId = Long.parseLong(body.get("driverId").toString());

        try {
            Vehicle updated = vehicleService.assignDriver(id, driverId);
            return ResponseEntity.ok(Map.of(
                    "vehicle", updated,
                    "message", "Driver assigned to vehicle"
            ));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // PUT /api/vehicles/{id}/unassign-driver
    @PutMapping("/{id}/unassign-driver")
    public ResponseEntity<?> unassignDriver(@PathVariable Long id) {
        User user = getCurrentUser();
        if (user == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Not authenticated"));
        }

        try {
            Vehicle updated = vehicleService.unassignDriver(id);
            return ResponseEntity.ok(Map.of(
                    "vehicle", updated,
                    "message", "Driver removed from vehicle"
            ));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}