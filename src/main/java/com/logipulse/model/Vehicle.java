package com.logipulse.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.LocalDateTime;

@Entity
@Table(name = "vehicles")
public class Vehicle {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String registrationNumber;   // e.g. KA-01-AB-1234

    // HEAVY_TRUCK, MINI_TRUCK, CONTAINER, TANKER
    @Column(nullable = false)
    private String vehicleType;

    @Column
    private Double capacityTons;

    @Column
    private String manufacturerName;     // e.g. Tata, Ashok Leyland

    @Column
    private Integer modelYear;

    // AVAILABLE, IN_TRANSIT, MAINTENANCE
    @Column(nullable = false)
    private String status;

    // FK to User with role DRIVER (nullable — unassigned)
    @Column
    private Long assignedDriverId;

    @Column
    private String assignedDriverName;

    @Column(nullable = false)
    private LocalDateTime registeredAt;

    // Add to existing Vehicle entity
    @Column
    private Long ownerId;

    public Long getOwnerId()             { return ownerId; }
    public void setOwnerId(Long o)       { this.ownerId = o; }

    public Vehicle() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getRegistrationNumber() { return registrationNumber; }
    public void setRegistrationNumber(String registrationNumber) {
        this.registrationNumber = registrationNumber;
    }

    public String getVehicleType() { return vehicleType; }
    public void setVehicleType(String vehicleType) { this.vehicleType = vehicleType; }

    public Double getCapacityTons() { return capacityTons; }
    public void setCapacityTons(Double capacityTons) { this.capacityTons = capacityTons; }

    public String getManufacturerName() { return manufacturerName; }
    public void setManufacturerName(String manufacturerName) {
        this.manufacturerName = manufacturerName;
    }

    public Integer getModelYear() { return modelYear; }
    public void setModelYear(Integer modelYear) { this.modelYear = modelYear; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public Long getAssignedDriverId() { return assignedDriverId; }
    public void setAssignedDriverId(Long assignedDriverId) {
        this.assignedDriverId = assignedDriverId;
    }

    public String getAssignedDriverName() { return assignedDriverName; }
    public void setAssignedDriverName(String assignedDriverName) {
        this.assignedDriverName = assignedDriverName;
    }

    public LocalDateTime getRegisteredAt() { return registeredAt; }
    public void setRegisteredAt(LocalDateTime registeredAt) {
        this.registeredAt = registeredAt;
    }
}