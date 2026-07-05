package com.logipulse.repository;

import com.logipulse.model.Vehicle;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface VehicleRepository extends JpaRepository<Vehicle, Long> {
    List<Vehicle> findByStatus(String status);
    Optional<Vehicle> findByAssignedDriverId(Long driverId);
    boolean existsByRegistrationNumber(String registrationNumber);
    List<Vehicle> findByVehicleType(String vehicleType);
    List<Vehicle> findByOwnerId(Long ownerId);
    List<Vehicle> findByOwnerIdAndStatus(Long ownerId, String status);
}