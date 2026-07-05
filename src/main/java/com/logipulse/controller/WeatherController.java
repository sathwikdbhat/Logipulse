package com.logipulse.controller;

import com.logipulse.service.NewsService;
import com.logipulse.service.WeatherService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "*")
public class WeatherController {

    @Autowired
    private WeatherService weatherService;

    @Autowired
    private NewsService newsService;

    // ---- GET real weather for a location ----
    @GetMapping("/weather/{lat}/{lng}")
    public ResponseEntity<Map<String, Object>> getWeather(
            @PathVariable double lat,
            @PathVariable double lng) {
        Map<String, Object> weather = weatherService.getWeather(lat, lng);
        return ResponseEntity.ok(weather);
    }

    // ---- GET live Indian transport disruption news ----
    @GetMapping("/news/disruptions")
    public ResponseEntity<List<Map<String, String>>> getDisruptionNews() {
        List<Map<String, String>> news = newsService.getDisruptionNews();
        return ResponseEntity.ok(news);
    }
}