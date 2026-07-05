package com.logipulse.controller;

import com.logipulse.model.User;
import com.logipulse.repository.UserRepository;
import com.logipulse.service.UserService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/auth")
@CrossOrigin(origins = "*")
public class AuthController {

    @Autowired
    private AuthenticationManager authenticationManager;

    @Autowired
    private UserService userService;

    @Autowired
    private UserRepository userRepository;

    // Helper — get current authenticated user
    private User getCurrentUser(HttpServletRequest request) {
        HttpSession session = request.getSession(false);
        if (session == null) return null;
        SecurityContext ctx = (SecurityContext) session.getAttribute(
                HttpSessionSecurityContextRepository.SPRING_SECURITY_CONTEXT_KEY
        );
        if (ctx == null || ctx.getAuthentication() == null) return null;
        String username = ctx.getAuthentication().getName();
        return userService.findByUsername(username).orElse(null);
    }

    // POST /api/auth/login
    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody Map<String, String> body,
                                   HttpServletRequest request) {
        String username = body.get("username");
        String password = body.get("password");

        if (username == null || password == null) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "Username and password are required."));
        }

        try {
            Authentication auth = authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(username, password)
            );

            SecurityContext ctx = SecurityContextHolder.createEmptyContext();
            ctx.setAuthentication(auth);
            SecurityContextHolder.setContext(ctx);

            HttpSession session = request.getSession(true);
            session.setAttribute(
                    HttpSessionSecurityContextRepository.SPRING_SECURITY_CONTEXT_KEY, ctx
            );

            Optional<User> userOpt = userService.findByUsername(username);
            if (userOpt.isEmpty()) {
                return ResponseEntity.status(500)
                        .body(Map.of("error", "User not found after authentication"));
            }

            User user = userOpt.get();
            Map<String, Object> response = new HashMap<>();
            response.put("message",   "Login successful");
            response.put("username",  user.getUsername());
            response.put("fullName",  user.getFullName());
            response.put("role",      user.getRole());
            response.put("email",     user.getEmail() != null ? user.getEmail() : "");
            response.put("alertEmail",user.getAlertEmail() != null ? user.getAlertEmail() : "");
            response.put("id",        user.getId());
            return ResponseEntity.ok(response);

        } catch (AuthenticationException e) {
            return ResponseEntity.status(401)
                    .body(Map.of("error", "Invalid username or password."));
        }
    }

    // POST /api/auth/logout
    @PostMapping("/logout")
    public ResponseEntity<?> logout(HttpServletRequest request) {
        HttpSession session = request.getSession(false);
        if (session != null) session.invalidate();
        SecurityContextHolder.clearContext();
        return ResponseEntity.ok(Map.of("message", "Logged out successfully"));
    }

    // GET /api/auth/me — current user info
    @GetMapping("/me")
    public ResponseEntity<?> me(HttpServletRequest request) {
        User user = getCurrentUser(request);
        if (user == null) {
            return ResponseEntity.status(401)
                    .body(Map.of("error", "Not authenticated"));
        }

        Map<String, Object> response = new HashMap<>();
        response.put("id",         user.getId());
        response.put("username",   user.getUsername());
        response.put("fullName",   user.getFullName());
        response.put("role",       user.getRole());
        response.put("email",      user.getEmail() != null ? user.getEmail() : "");
        response.put("alertEmail", user.getAlertEmail() != null ? user.getAlertEmail() : "");
        return ResponseEntity.ok(response);
    }

    // POST /api/auth/register — ADMIN or OPERATOR self-registration
    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody Map<String, String> body) {
        String username   = body.get("username");
        String password   = body.get("password");
        String fullName   = body.get("fullName");
        String email      = body.getOrDefault("email", "");
        String phone      = body.getOrDefault("phoneNumber", "");
        String role       = body.getOrDefault("role", "OPERATOR");
        String alertEmail = body.getOrDefault("alertEmail", email);

        if (username == null || username.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Username is required."));
        }
        if (password == null || password.length() < 6) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "Password must be at least 6 characters."));
        }
        if (fullName == null || fullName.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Full name is required."));
        }

        // Only allow ADMIN and OPERATOR self-registration
        if (!"ADMIN".equalsIgnoreCase(role) && !"OPERATOR".equalsIgnoreCase(role)) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "Invalid role. Choose ADMIN or OPERATOR."));
        }

        try {
            User created = userService.registerUser(
                    username, password, fullName, email, phone,
                    role, alertEmail, null
            );

            return ResponseEntity.status(201).body(Map.of(
                    "message",    "Account created successfully",
                    "username",   created.getUsername(),
                    "role",       created.getRole(),
                    "alertEmail", created.getAlertEmail() != null ? created.getAlertEmail() : ""
            ));

        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // POST /api/auth/register-driver — Admin creates a driver account
    @PostMapping("/register-driver")
    public ResponseEntity<?> registerDriver(@RequestBody Map<String, String> body,
                                            HttpServletRequest request) {
        User admin = getCurrentUser(request);
        if (admin == null) {
            return ResponseEntity.status(401)
                    .body(Map.of("error", "Not authenticated"));
        }
        if (!"ADMIN".equals(admin.getRole())) {
            return ResponseEntity.status(403)
                    .body(Map.of("error", "Only admins can register drivers."));
        }

        String username = body.get("username");
        String password = body.get("password");
        String fullName = body.get("fullName");
        String email    = body.getOrDefault("email", "");
        String phone    = body.getOrDefault("phoneNumber", "");

        if (username == null || username.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Username is required."));
        }
        if (password == null || password.length() < 6) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "Password must be at least 6 characters."));
        }
        if (fullName == null || fullName.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Full name is required."));
        }

        try {
            User driver = userService.registerDriver(
                    username, password, fullName, email, phone, admin.getId()
            );
            return ResponseEntity.status(201).body(Map.of(
                    "message",  "Driver account created",
                    "username", driver.getUsername(),
                    "fullName", driver.getFullName(),
                    "id",       driver.getId()
            ));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // GET /api/auth/users — list all users (admin only)
    @GetMapping("/users")
    public ResponseEntity<?> listUsers(HttpServletRequest request) {
        User admin = getCurrentUser(request);
        if (admin == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Not authenticated"));
        }
        if (!"ADMIN".equals(admin.getRole())) {
            return ResponseEntity.status(403).body(Map.of("error", "Admin access required"));
        }

        // Admin only sees users they created (drivers + operators linked to them)
        List<User> allUsers = userRepository.findAll();
        List<Map<String, Object>> result = allUsers.stream()
                .filter(u ->
                        u.getId().equals(admin.getId()) ||           // themselves
                                admin.getId().equals(u.getParentAdminId())   // their drivers/operators
                )
                .map(u -> {
                    Map<String, Object> m = new HashMap<>();
                    m.put("id",         u.getId());
                    m.put("username",   u.getUsername());
                    m.put("fullName",   u.getFullName());
                    m.put("email",      u.getEmail() != null ? u.getEmail() : "");
                    m.put("role",       u.getRole());
                    m.put("alertEmail", u.getAlertEmail() != null ? u.getAlertEmail() : "");
                    return m;
                })
                .toList();

        return ResponseEntity.ok(result);
    }

    // DELETE /api/auth/users/{id} — admin deletes a user
    @DeleteMapping("/users/{id}")
    public ResponseEntity<?> deleteUser(@PathVariable Long id,
                                        HttpServletRequest request) {
        User admin = getCurrentUser(request);
        if (admin == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Not authenticated"));
        }
        if (!"ADMIN".equals(admin.getRole())) {
            return ResponseEntity.status(403).body(Map.of("error", "Admin access required"));
        }

        Optional<User> targetOpt = userRepository.findById(id);
        if (targetOpt.isEmpty()) {
            return ResponseEntity.status(404).body(Map.of("error", "User not found"));
        }

        User target = targetOpt.get();

        // Cannot delete yourself
        if (target.getId().equals(admin.getId())) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "You cannot delete your own account."));
        }

        // Admin can only delete their own drivers/operators
        if (!admin.getId().equals(target.getParentAdminId())) {
            return ResponseEntity.status(403)
                    .body(Map.of("error", "You can only delete accounts you created."));
        }

        userRepository.deleteById(id);
        return ResponseEntity.ok(Map.of("message", "User account deleted successfully"));
    }
}