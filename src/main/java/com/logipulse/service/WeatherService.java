package com.logipulse.service;

import org.springframework.stereotype.Service;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

@Service
public class WeatherService {

    private static final String OWM_API_KEY = "06752a69b959b14964782e17b53446f3";
    private static final String OWM_URL     =
            "https://api.openweathermap.org/data/2.5/weather?lat=%s&lon=%s&appid=%s&units=metric";

    // Simple in-memory cache: key = "lat,lng", value = weather data
    private final Map<String, Map<String, Object>> cache   = new HashMap<>();
    private final Map<String, LocalDateTime>        cacheTs = new HashMap<>();
    private static final int CACHE_MINUTES = 10;

    public Map<String, Object> getWeather(double lat, double lng) {
        String key = String.format("%.3f,%.3f", lat, lng);

        // Return cached result if fresh
        if (cache.containsKey(key)) {
            LocalDateTime cached = cacheTs.get(key);
            if (cached != null && cached.plusMinutes(CACHE_MINUTES).isAfter(LocalDateTime.now())) {
                return cache.get(key);
            }
        }

        try {
            String urlStr  = String.format(OWM_URL, lat, lng, OWM_API_KEY);
            URL url        = new URL(urlStr);
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("GET");
            conn.setConnectTimeout(8000);
            conn.setReadTimeout(8000);

            if (conn.getResponseCode() != 200) {
                return fallbackWeather();
            }

            BufferedReader br = new BufferedReader(
                    new InputStreamReader(conn.getInputStream())
            );
            StringBuilder sb = new StringBuilder();
            String line;
            while ((line = br.readLine()) != null) sb.append(line);
            br.close();

            String json = sb.toString();

            // Parse key fields manually (no extra library needed)
            Map<String, Object> result = new HashMap<>();

            result.put("description", extractJsonString(json, "description"));
            result.put("main",        extractJsonString(json, "main"));
            result.put("temp",        extractJsonDouble(json, "temp"));
            result.put("feels_like",  extractJsonDouble(json, "feels_like"));
            result.put("humidity",    extractJsonInt(json,    "humidity"));
            result.put("wind_speed",  extractJsonDouble(json, "speed"));
            result.put("city",        extractJsonString(json, "name"));

            // Determine severity based on weather condition
            String mainCondition = (String) result.getOrDefault("main", "Clear");
            result.put("severity",   determineSeverity(mainCondition));
            result.put("icon",       getWeatherIcon(mainCondition));
            result.put("isHazardous", isHazardous(mainCondition));

            cache.put(key, result);
            cacheTs.put(key, LocalDateTime.now());

            return result;

        } catch (Exception e) {
            System.err.println("WeatherService: API call failed — " + e.getMessage());
            return fallbackWeather();
        }
    }

    private Map<String, Object> fallbackWeather() {
        Map<String, Object> result = new HashMap<>();
        result.put("description", "Data unavailable");
        result.put("main",        "Clear");
        result.put("temp",        28.0);
        result.put("feels_like",  30.0);
        result.put("humidity",    60);
        result.put("wind_speed",  10.0);
        result.put("severity",    "LOW");
        result.put("icon",        "🌤");
        result.put("isHazardous", false);
        return result;
    }

    private String determineSeverity(String main) {
        if (main == null) return "LOW";
        switch (main.toLowerCase()) {
            case "thunderstorm":
            case "tornado":          return "HIGH";
            case "squall":
            case "hurricane":        return "HIGH";
            case "snow":
            case "heavy rain":       return "MEDIUM";
            case "rain":
            case "drizzle":
            case "fog":
            case "mist":             return "MEDIUM";
            default:                 return "LOW";
        }
    }

    private String getWeatherIcon(String main) {
        if (main == null) return "🌤";
        switch (main.toLowerCase()) {
            case "thunderstorm": return "⛈";
            case "drizzle":      return "🌦";
            case "rain":         return "🌧";
            case "snow":         return "❄";
            case "mist":
            case "fog":
            case "haze":         return "🌫";
            case "clear":        return "☀";
            case "clouds":       return "☁";
            default:             return "🌤";
        }
    }

    private boolean isHazardous(String main) {
        if (main == null) return false;
        String l = main.toLowerCase();
        return l.equals("thunderstorm") || l.equals("tornado") ||
                l.equals("squall")       || l.equals("snow");
    }

    // ---- Simple JSON field extractors (no library needed) ----

    private String extractJsonString(String json, String key) {
        String pattern = "\"" + key + "\":\"";
        int    start   = json.indexOf(pattern);
        if (start < 0) return "";
        start += pattern.length();
        int end = json.indexOf("\"", start);
        return end > start ? json.substring(start, end) : "";
    }

    private double extractJsonDouble(String json, String key) {
        String pattern = "\"" + key + "\":";
        int    start   = json.indexOf(pattern);
        if (start < 0) return 0.0;
        start += pattern.length();
        int end = start;
        while (end < json.length() &&
                (Character.isDigit(json.charAt(end)) || json.charAt(end) == '.' || json.charAt(end) == '-')) {
            end++;
        }
        try { return Double.parseDouble(json.substring(start, end)); }
        catch (Exception e) { return 0.0; }
    }

    private int extractJsonInt(String json, String key) {
        return (int) extractJsonDouble(json, key);
    }
}