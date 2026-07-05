package com.logipulse;

import com.logipulse.service.UserService;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.ApplicationContext;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class LogiPulseApplication {

    public static void main(String[] args) {
        ApplicationContext ctx = SpringApplication.run(LogiPulseApplication.class, args);

        // Create default admin account if it doesn't exist yet
        try {
            UserService userService = ctx.getBean(UserService.class);
            userService.createDefaultAdminIfNeeded();
        } catch (Exception e) {
            System.err.println("Could not create default admin: " + e.getMessage());
        }
    }
}