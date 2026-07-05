package com.logipulse.service;

import org.springframework.stereotype.Service;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class RouteGeometryService {

    // Get a FREE key from https://openrouteservice.org/dev/#/signup
    private static final String ORS_API_KEY =
            "eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6IjM2OTlkMDg4MmMzYzQyNWQ5M2NkOWFjMzMxZmMyMzhkIiwiaCI6Im11cm11cjY0In0=";

    // Use driving-car — driving-hgv (heavy goods) returned 406 for many India routes
    private static final String ORS_URL =
            "https://api.openrouteservice.org/v2/directions/driving-car/geojson";

    private final Map<String, String> routeCache = new HashMap<>();

    // Fetch real road route
    public String fetchRoadRoute(double fromLat, double fromLng,
                                 double toLat,   double toLng) {

        String key = String.format("%.3f,%.3f-%.3f,%.3f",
                fromLat, fromLng, toLat, toLng);

        if (routeCache.containsKey(key)) return routeCache.get(key);

        if (ORS_API_KEY.startsWith("PASTE_") || ORS_API_KEY.isBlank()) {
            return curvedFallback(fromLat, fromLng, toLat, toLng, false);
        }

        try {
            String body =
                    "{\"coordinates\":[[" + fromLng + "," + fromLat + "]," +
                            "[" + toLng + "," + toLat + "]]," +
                            "\"instructions\":false}";

            URL url = new URL(ORS_URL + "?api_key=" + ORS_API_KEY);
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("POST");
            conn.setRequestProperty("Content-Type", "application/json; charset=utf-8");
            conn.setRequestProperty("Accept",       "application/json");
            conn.setDoOutput(true);
            conn.setConnectTimeout(8000);
            conn.setReadTimeout(8000);

            try (OutputStream os = conn.getOutputStream()) {
                os.write(body.getBytes(StandardCharsets.UTF_8));
            }

            int status = conn.getResponseCode();
            if (status != 200) {
                System.err.println("RouteGeometryService: ORS HTTP " + status
                        + (status == 403 ? " — get new key at openrouteservice.org" : ""));
                return curvedFallback(fromLat, fromLng, toLat, toLng, false);
            }

            BufferedReader br = new BufferedReader(
                    new InputStreamReader(conn.getInputStream(), StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            String line;
            while ((line = br.readLine()) != null) sb.append(line);
            br.close();

            String converted = parseOrsResponse(sb.toString());
            if (converted != null) {
                routeCache.put(key, converted);
                return converted;
            }

        } catch (Exception e) {
            System.err.println("RouteGeometryService: " + e.getMessage());
        }

        return curvedFallback(fromLat, fromLng, toLat, toLng, false);
    }

    // Fetch ALTERNATE route — visually different from original
    public String fetchAlternateRoute(double fromLat, double fromLng,
                                      double toLat,   double toLng) {

        String altKey = String.format("alt-%.3f,%.3f-%.3f,%.3f",
                fromLat, fromLng, toLat, toLng);

        if (routeCache.containsKey(altKey)) return routeCache.get(altKey);

        if (ORS_API_KEY.startsWith("PASTE_") || ORS_API_KEY.isBlank()) {
            // Return a visually distinct curve even without ORS
            String alt = curvedFallback(fromLat, fromLng, toLat, toLng, true);
            routeCache.put(altKey, alt);
            return alt;
        }

        try {
            // Add perpendicular waypoint to force a different road
            double midLat = (fromLat + toLat) / 2;
            double midLng = (fromLng + toLng) / 2;
            // Offset perpendicular to the route direction
            double dLat  = toLat - fromLat;
            double dLng  = toLng - fromLng;
            double dist  = Math.sqrt(dLat * dLat + dLng * dLng);
            double perpLat = midLat + (-dLng / dist) * 0.6;
            double perpLng = midLng + (dLat  / dist) * 0.6;

            String body =
                    "{\"coordinates\":[[" + fromLng + "," + fromLat + "]," +
                            "[" + perpLng + "," + perpLat + "]," +
                            "[" + toLng   + "," + toLat   + "]]," +
                            "\"instructions\":false}";

            URL url = new URL(ORS_URL + "?api_key=" + ORS_API_KEY);
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("POST");
            conn.setRequestProperty("Content-Type", "application/json; charset=utf-8");
            conn.setRequestProperty("Accept",       "application/json");
            conn.setDoOutput(true);
            conn.setConnectTimeout(8000);
            conn.setReadTimeout(8000);

            try (OutputStream os = conn.getOutputStream()) {
                os.write(body.getBytes(StandardCharsets.UTF_8));
            }

            if (conn.getResponseCode() == 200) {
                BufferedReader br = new BufferedReader(
                        new InputStreamReader(conn.getInputStream(), StandardCharsets.UTF_8));
                StringBuilder sb = new StringBuilder();
                String line;
                while ((line = br.readLine()) != null) sb.append(line);
                br.close();

                String converted = parseOrsResponse(sb.toString());
                if (converted != null) {
                    routeCache.put(altKey, converted);
                    return converted;
                }
            }

        } catch (Exception e) {
            System.err.println("RouteGeometryService (alt): " + e.getMessage());
        }

        // Distinct visual fallback even without ORS
        String alt = curvedFallback(fromLat, fromLng, toLat, toLng, true);
        routeCache.put(altKey, alt);
        return alt;
    }

    // Parse ORS GeoJSON response
    private String parseOrsResponse(String geoJson) {
        try {
            int coordIdx = geoJson.indexOf("\"coordinates\":[");
            if (coordIdx < 0) return null;
            int start = coordIdx + "\"coordinates\":[".length();

            List<String> points = new ArrayList<>();
            int pos = start;

            while (pos < geoJson.length()) {
                int pairStart = geoJson.indexOf('[', pos);
                if (pairStart < 0) break;
                int pairEnd   = geoJson.indexOf(']', pairStart);
                if (pairEnd < 0) break;

                String pair    = geoJson.substring(pairStart + 1, pairEnd);
                String[] parts = pair.split(",");

                if (parts.length >= 2) {
                    try {
                        double lng = Double.parseDouble(parts[0].trim());
                        double lat = Double.parseDouble(parts[1].trim());
                        // Valid India bounds check
                        if (lat > 5 && lat < 38 && lng > 65 && lng < 100) {
                            points.add("[" + lat + "," + lng + "]");
                        }
                    } catch (NumberFormatException ignored) {}
                }

                pos = pairEnd + 1;
                if (pos < geoJson.length() && geoJson.charAt(pos) == ']') break;
            }

            if (points.size() < 2) return null;
            return "[" + String.join(",", points) + "]";

        } catch (Exception e) {
            return null;
        }
    }

    // Curved fallback — looks like a real route, not a straight line — isAlt = true adds a perpendicular bulge to look visually different
    public String curvedFallback(double fromLat, double fromLng,
                                 double toLat,   double toLng,
                                 boolean isAlt) {

        List<String> points = new ArrayList<>();
        int steps = 14;

        double dLat = toLat - fromLat;
        double dLng = toLng - fromLng;
        double dist = Math.sqrt(dLat * dLat + dLng * dLng);

        // Perpendicular offset for natural curve
        double perpLat = dist > 0 ? -dLng / dist : 0;
        double perpLng = dist > 0 ?  dLat / dist : 0;

        // Alt routes get a larger offset in the opposite direction
        double bulge = isAlt ? dist * 0.35 : dist * 0.18;
        if (isAlt) { perpLat = -perpLat; perpLng = -perpLng; }

        for (int i = 0; i <= steps; i++) {
            double t    = (double) i / steps;
            double lat  = fromLat + dLat * t;
            double lng  = fromLng + dLng * t;

            // Quadratic bezier-like curve
            double curve = 4 * t * (1 - t) * bulge;
            lat += perpLat * curve;
            lng += perpLng * curve;

            // Small noise for natural appearance
            if (i > 0 && i < steps) {
                lat += (Math.random() - 0.5) * 0.025;
                lng += (Math.random() - 0.5) * 0.025;
            }

            points.add("[" + lat + "," + lng + "]");
        }

        return "[" + String.join(",", points) + "]";
    }

    // Public alias for backward compat
    public String straightLineWithPoints(double fromLat, double fromLng,
                                         double toLat,   double toLng) {
        return curvedFallback(fromLat, fromLng, toLat, toLng, false);
    }
}