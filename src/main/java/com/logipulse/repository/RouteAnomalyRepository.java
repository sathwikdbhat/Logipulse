package com.logipulse.repository;

import com.logipulse.model.RouteAnomaly;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface RouteAnomalyRepository extends JpaRepository<RouteAnomaly, Long> {

    // Spring Data JPA auto-implements this from the method name
    List<RouteAnomaly> findByShipmentId(Long shipmentId);
}