package com.logipulse.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class WelcomeController {

    // Redirect root URL to welcome page
    @GetMapping("/")
    public String redirectToWelcome() {
        return "redirect:/welcome.html";
    }
}