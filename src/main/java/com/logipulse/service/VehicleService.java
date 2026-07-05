package com.logipulse.service;

import com.logipulse.model.User;
import com.logipulse.model.Vehicle;
import com.logipulse.repository.UserRepository;
import com.logipulse.repository.VehicleRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Service
public class VehicleService {

    @Autowired
    private VehicleRepository vehicleRepository;

    @Autowired
    private UserRepository userRepository;

    // NOTE: No @PostConstruct seeding — register vehicles via Fleet page UI.

    public List<Vehicle> getAllVehicles() {
        return vehicleRepository.findAll();
    }

    public List<Vehicle> getAvailableVehicles() {
        return vehicleRepository.findByStatus("AVAILABLE");
    }

    public Optional<Vehicle> getById(Long id) {
        return vehicleRepository.findById(id);
    }

    public boolean existsByRegistration(String regNumber) {
        return vehicleRepository.existsByRegistrationNumber(regNumber.toUpperCase().trim());
    }

    public Vehicle registerVehicle(String regNumber, String type, Double capacity,
                                   String manufacturer, Integer modelYear) {
        Vehicle v = new Vehicle();
        v.setRegistrationNumber(regNumber.toUpperCase().trim());
        v.setVehicleType(type.toUpperCase());
        v.setCapacityTons(capacity);
        v.setManufacturerName(manufacturer);
        v.setModelYear(modelYear);
        v.setStatus("AVAILABLE");
        v.setRegisteredAt(LocalDateTime.now());
        return vehicleRepository.save(v);
    }

    public Vehicle assignDriver(Long vehicleId, Long driverId) {
        Optional<Vehicle> vOpt = vehicleRepository.findById(vehicleId);
        if (vOpt.isEmpty()) throw new RuntimeException("Vehicle not found");

        Optional<User> uOpt = userRepository.findById(driverId);
        if (uOpt.isEmpty()) throw new RuntimeException("Driver not found");

        User driver = uOpt.get();
        if (!"DRIVER".equals(driver.getRole()))
            throw new RuntimeException("User is not a registered Driver");

        Optional<Vehicle> existing = vehicleRepository.findByAssignedDriverId(driverId);
        if (existing.isPresent() && !existing.get().getId().equals(vehicleId))
            throw new RuntimeException("Driver is already assigned to vehicle " +
                    existing.get().getRegistrationNumber());

        Vehicle vehicle = vOpt.get();
        vehicle.setAssignedDriverId(driverId);
        vehicle.setAssignedDriverName(driver.getFullName());
        return vehicleRepository.save(vehicle);
    }

    public Vehicle unassignDriver(Long vehicleId) {
        Optional<Vehicle> vOpt = vehicleRepository.findById(vehicleId);
        if (vOpt.isEmpty()) throw new RuntimeException("Vehicle not found");
        Vehicle vehicle = vOpt.get();
        vehicle.setAssignedDriverId(null);
        vehicle.setAssignedDriverName(null);
        return vehicleRepository.save(vehicle);
    }

    public void updateStatus(Long vehicleId, String status) {
        vehicleRepository.findById(vehicleId).ifPresent(v -> {
            v.setStatus(status);
            vehicleRepository.save(v);
        });
    }

    public Vehicle save(Vehicle vehicle) {
        return vehicleRepository.save(vehicle);
    }

    public void deleteVehicle(Long id) {
        Vehicle v = vehicleRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Vehicle not found"));
        vehicleRepository.delete(v);
    }
}