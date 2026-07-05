package com.logipulse.repository;

import com.logipulse.model.Shipment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ShipmentRepository extends JpaRepository<Shipment, Long> {

    // Spring Data JPA auto-implements these from the method name
    List<Shipment> findByStatus(String status);
    List<Shipment> findByOwnerId(Long ownerId);
    List<Shipment> findByOwnerIdAndStatus(Long ownerId, String status);
}