package com.logipulse.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDateTime;

@Entity
@Table(name = "users")
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String username;

    @Column(nullable = false)
    private String password;

    @Column(nullable = false)
    private String fullName;

    @Column
    private String email;

    @Column
    private String phoneNumber;

    @Column(nullable = false)
    private String role; // ADMIN, OPERATOR, DRIVER

    // Alert email — set at registration, used for notifications
    @Column
    private String alertEmail;

    // For OPERATOR/DRIVER: which admin created this user
    @Column
    private Long parentAdminId;

    // Required by existing Neon DB schema — must not be null
    @Column(nullable = false)
    private LocalDateTime createdAt;

    // ---- Getters & Setters ----

    public Long getId()                          { return id; }
    public void setId(Long id)                   { this.id = id; }

    public String getUsername()                  { return username; }
    public void setUsername(String u)            { this.username = u; }

    public String getPassword()                  { return password; }
    public void setPassword(String p)            { this.password = p; }

    public String getFullName()                  { return fullName; }
    public void setFullName(String f)            { this.fullName = f; }

    public String getEmail()                     { return email; }
    public void setEmail(String e)               { this.email = e; }

    public String getPhoneNumber()               { return phoneNumber; }
    public void setPhoneNumber(String p)         { this.phoneNumber = p; }

    public String getRole()                      { return role; }
    public void setRole(String r)                { this.role = r; }

    public String getAlertEmail()                { return alertEmail; }
    public void setAlertEmail(String a)          { this.alertEmail = a; }

    public Long getParentAdminId()               { return parentAdminId; }
    public void setParentAdminId(Long p)         { this.parentAdminId = p; }

    public LocalDateTime getCreatedAt()          { return createdAt; }
    public void setCreatedAt(LocalDateTime c)    { this.createdAt = c; }
}