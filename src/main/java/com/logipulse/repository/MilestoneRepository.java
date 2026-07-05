package com.logipulse.repository;

import com.logipulse.model.ShipmentMilestone;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MilestoneRepository extends JpaRepository<ShipmentMilestone, Long> {
    List<ShipmentMilestone> findByShipmentIdOrderByOccurredAtAsc(Long shipmentId);
}