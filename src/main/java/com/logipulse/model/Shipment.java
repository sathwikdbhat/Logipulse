package com.logipulse.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.LocalDateTime;

@Entity
@Table(name = "shipments")
public class Shipment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String trackingId;

    @Column(nullable = false)
    private String cargoType;

    @Column
    private String customerName;

    @Column
    private Double weightKg;

    @Column
    private String priority;   // LOW, NORMAL, HIGH

    @Column(nullable = false)
    private String origin;

    @Column(nullable = false)
    private String destination;

    @Column(nullable = false)
    private String status;     // IN_TRANSIT, DELAYED, REROUTED, DELIVERED

    // Current live position
    @Column(nullable = false)
    private Double currentLat;

    @Column(nullable = false)
    private Double currentLng;

    // Fixed origin coordinates (for route line drawing)
    @Column
    private Double originLat;

    @Column
    private Double originLng;

    // Fixed destination coordinates (for route line drawing)
    @Column
    private Double destLat;

    @Column
    private Double destLng;

    @Column(nullable = false)
    private LocalDateTime dispatchTime;

    @Column(nullable = false)
    private LocalDateTime estimatedDeliveryTime;

    // Assigned vehicle (nullable)
    @Column
    private Long vehicleId;

    // Assigned driver name (denormalised for quick display)
    @Column
    private String assignedDriverName;

    // Add these two fields to the existing Shipment entity

    // Which admin account created this shipment
    @Column
    private Long ownerId;

    // Actual road route geometry (JSON array of [lat,lng] pairs from ORS API)
// Stored as TEXT in DB — updated on creation and reroute
    @Column(columnDefinition = "TEXT")
    private String routeGeometry;

    // Getters and setters:
    public Long getOwnerId()                  { return ownerId; }
    public void setOwnerId(Long o)            { this.ownerId = o; }

    public String getRouteGeometry()          { return routeGeometry; }
    public void setRouteGeometry(String r)    { this.routeGeometry = r; }

    public Shipment() {}

    // ---- Getters & Setters ----

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getTrackingId() { return trackingId; }
    public void setTrackingId(String trackingId) { this.trackingId = trackingId; }

    public String getCargoType() { return cargoType; }
    public void setCargoType(String cargoType) { this.cargoType = cargoType; }

    public String getCustomerName() { return customerName; }
    public void setCustomerName(String customerName) { this.customerName = customerName; }

    public Double getWeightKg() { return weightKg; }
    public void setWeightKg(Double weightKg) { this.weightKg = weightKg; }

    public String getPriority() { return priority; }
    public void setPriority(String priority) { this.priority = priority; }

    public String getOrigin() { return origin; }
    public void setOrigin(String origin) { this.origin = origin; }

    public String getDestination() { return destination; }
    public void setDestination(String destination) { this.destination = destination; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public Double getCurrentLat() { return currentLat; }
    public void setCurrentLat(Double currentLat) { this.currentLat = currentLat; }

    public Double getCurrentLng() { return currentLng; }
    public void setCurrentLng(Double currentLng) { this.currentLng = currentLng; }

    public Double getOriginLat() { return originLat; }
    public void setOriginLat(Double originLat) { this.originLat = originLat; }

    public Double getOriginLng() { return originLng; }
    public void setOriginLng(Double originLng) { this.originLng = originLng; }

    public Double getDestLat() { return destLat; }
    public void setDestLat(Double destLat) { this.destLat = destLat; }

    public Double getDestLng() { return destLng; }
    public void setDestLng(Double destLng) { this.destLng = destLng; }

    public LocalDateTime getDispatchTime() { return dispatchTime; }
    public void setDispatchTime(LocalDateTime dispatchTime) { this.dispatchTime = dispatchTime; }

    public LocalDateTime getEstimatedDeliveryTime() { return estimatedDeliveryTime; }
    public void setEstimatedDeliveryTime(LocalDateTime estimatedDeliveryTime) {
        this.estimatedDeliveryTime = estimatedDeliveryTime;
    }

    public Long getVehicleId() { return vehicleId; }
    public void setVehicleId(Long vehicleId) { this.vehicleId = vehicleId; }

    public String getAssignedDriverName() { return assignedDriverName; }
    public void setAssignedDriverName(String assignedDriverName) {
        this.assignedDriverName = assignedDriverName;
    }
}