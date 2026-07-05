package com.logipulse.service;

import com.logipulse.model.User;
import com.logipulse.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.Optional;

@Service
public class UserService {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private BCryptPasswordEncoder passwordEncoder;

    // Create default admin on first startup
    public void createDefaultAdminIfNeeded() {
        if (userRepository.findByUsername("admin").isEmpty()) {
            User admin = new User();
            admin.setUsername("admin");
            admin.setPassword(passwordEncoder.encode("admin123"));
            admin.setFullName("System Administrator");
            admin.setEmail("admin@logipulse.com");
            admin.setRole("ADMIN");
            admin.setAlertEmail("admin@logipulse.com");
            admin.setParentAdminId(null);
            admin.setCreatedAt(LocalDateTime.now());   // ← FIX
            userRepository.save(admin);
            System.out.println("✅ Default admin created: admin / admin123");
        }
    }

    // Register ADMIN or OPERATOR
    public User registerUser(String username, String password, String fullName,
                             String email, String phone, String role,
                             String alertEmail, Long parentAdminId) {

        if (userRepository.findByUsername(username).isPresent()) {
            throw new RuntimeException("Username '" + username + "' is already taken.");
        }

        User user = new User();
        user.setUsername(username);
        user.setPassword(passwordEncoder.encode(password));
        user.setFullName(fullName);
        user.setEmail(email != null ? email : "");
        user.setPhoneNumber(phone != null ? phone : "");
        user.setRole(role.toUpperCase());
        user.setAlertEmail(
                (alertEmail != null && !alertEmail.isBlank()) ? alertEmail : email
        );
        user.setParentAdminId(
                "OPERATOR".equals(role.toUpperCase()) ? parentAdminId : null
        );
        user.setCreatedAt(LocalDateTime.now());   // ← FIX

        User saved = userRepository.save(user);
        System.out.println("✅ Registered " + role + ": " + username
                + " | alert: " + saved.getAlertEmail());
        return saved;
    }

    // Register DRIVER (created by admin)
    public User registerDriver(String username, String password, String fullName,
                               String email, String phone, Long parentAdminId) {

        if (userRepository.findByUsername(username).isPresent()) {
            throw new RuntimeException("Username '" + username + "' is already taken.");
        }

        User driver = new User();
        driver.setUsername(username);
        driver.setPassword(passwordEncoder.encode(password));
        driver.setFullName(fullName);
        driver.setEmail(email != null ? email : "");
        driver.setPhoneNumber(phone != null ? phone : "");
        driver.setRole("DRIVER");
        driver.setAlertEmail(email != null ? email : "");
        driver.setParentAdminId(parentAdminId);
        driver.setCreatedAt(LocalDateTime.now());   // ← FIX

        return userRepository.save(driver);
    }

    // Resolve owner ID for data isolation — ADMIN   → their own ID
    public Long resolveOwnerId(User user) {
        if ("ADMIN".equals(user.getRole())) {
            return user.getId();
        }
        return user.getParentAdminId() != null
                ? user.getParentAdminId()
                : user.getId();
    }

    // Lookups
    public Optional<User> findByUsername(String username) {
        return userRepository.findByUsername(username);
    }

    public Optional<User> findById(Long id) {
        return userRepository.findById(id);
    }
}