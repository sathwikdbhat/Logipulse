package com.logipulse.service;

import org.springframework.stereotype.Service;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class NewsService {

    private static final String NEWS_API_KEY = "pub_5a9236c7f6aa4be9b00ef647437ffdae";

    // Location-specific news URL — queries news about a specific state/region
    private static final String NEWS_URL_LOCATION =
            "https://newsdata.io/api/1/news?apikey=%s&country=in&language=en" + "&q=%s+road+OR+highway+OR+flood+OR+accident+OR+traffic";

    // Generic fallback URL
    private static final String NEWS_URL_GENERIC =
            "https://newsdata.io/api/1/news?apikey=%s&country=in&language=en" + "&q=highway+flood+OR+road+accident+OR+traffic+blocked";

    // Cache: key = region keyword, value = list of articles
    private final Map<String, List<Map<String, String>>> cache = new HashMap<>();
    private final Map<String, LocalDateTime> cacheTs = new HashMap<>();
    private static final int CACHE_MINUTES = 30;

    // 1. GENERIC METHODS (Used by WeatherController)

    // Added to satisfy WeatherController.java Line 39
    public List<Map<String, String>> getDisruptionNews() {
        return getGenericNews();
    }

    public List<Map<String, String>> getGenericNews() {
        String key = "_generic_";

        if (cache.containsKey(key)) {
            LocalDateTime ts = cacheTs.get(key);
            if (ts != null && ts.plusMinutes(CACHE_MINUTES).isAfter(LocalDateTime.now())) {
                return cache.get(key);
            }
        }

        try {
            String urlStr = String.format(NEWS_URL_GENERIC, NEWS_API_KEY);
            List<Map<String, String>> articles = fetchNews(urlStr);
            if (!articles.isEmpty()) {
                cache.put(key, articles);
                cacheTs.put(key, LocalDateTime.now());
            }
            return articles.isEmpty() ? getFallbackNews() : articles;
        } catch (Exception e) {
            System.err.println("NewsService: API call failed — " + e.getMessage());
            return getFallbackNews();
        }
    }

    // 2. LOCATION & ROUTE SPECIFIC METHODS (Used by ShipmentService)

    public List<Map<String, String>> getNewsForLocation(String locationKeyword) {
        if (locationKeyword == null || locationKeyword.isBlank()) {
            return getGenericNews();
        }

        String key = locationKeyword.trim().toLowerCase();

        if (cache.containsKey(key)) {
            LocalDateTime ts = cacheTs.get(key);
            if (ts != null && ts.plusMinutes(CACHE_MINUTES).isAfter(LocalDateTime.now())) {
                return cache.get(key);
            }
        }

        try {
            String encoded = java.net.URLEncoder.encode(locationKeyword, "UTF-8");
            String urlStr = String.format(NEWS_URL_LOCATION, NEWS_API_KEY, encoded);

            List<Map<String, String>> articles = fetchNews(urlStr);

            if (articles.isEmpty()) {
                // Fall back to generic if no location-specific news found
                return getGenericNews();
            }

            cache.put(key, articles);
            cacheTs.put(key, LocalDateTime.now());
            System.out.println("NewsService: Fetched " + articles.size() +
                    " articles for location: " + locationKeyword);
            return articles;

        } catch (Exception e) {
            System.err.println("NewsService: Location fetch failed — " + e.getMessage());
            return getGenericNews();
        }
    }

    // Added to satisfy ShipmentService.java Line 243
    public Map<String, String> getNewsForRoute(String origin, String destination) {
        String originState = extractState(origin);
        String destinationState = extractState(destination);

        // Try origin state first
        List<Map<String, String>> news = getNewsForLocation(originState);

        // If nothing found for origin, try destination
        if (news.isEmpty() || news.stream().allMatch(n -> getFallbackNews().contains(n))) {
            List<Map<String, String>> destNews = getNewsForLocation(destinationState);
            if (!destNews.isEmpty()) news = destNews;
        }

        if (news.isEmpty()) return getFallbackNews().get(0);

        int idx = (int) (Math.random() * news.size());
        return news.get(idx);
    }

    public Map<String, String> getRandomDisruptionNews() {
        List<Map<String, String>> news = getGenericNews();
        if (news.isEmpty()) return getFallbackNews().get(0);
        return news.get((int) (Math.random() * news.size()));
    }

    private String extractState(String location) {
        if (location == null || location.isBlank()) return "India";
        String[] parts = location.split(",");
        if (parts.length > 1) return parts[parts.length - 1].trim();
        return location.trim();
    }

    // 3. CORE HTTP FETCH & PARSING

    private List<Map<String, String>> fetchNews(String urlStr) {
        List<Map<String, String>> result = new ArrayList<>();
        try {
            URL url = new URL(urlStr);
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("GET");
            conn.setConnectTimeout(8000);
            conn.setReadTimeout(8000);
            conn.setRequestProperty("User-Agent", "LogiPulse/1.0");

            if (conn.getResponseCode() != 200) {
                System.err.println("NewsService: HTTP " + conn.getResponseCode());
                return result;
            }

            BufferedReader br = new BufferedReader(new InputStreamReader(conn.getInputStream()));
            StringBuilder sb = new StringBuilder();
            String line;
            while ((line = br.readLine()) != null) sb.append(line);
            br.close();

            result = parseNewsResponse(sb.toString());
        } catch (Exception e) {
            System.err.println("NewsService: Fetch error — " + e.getMessage());
        }
        return result;
    }

    private List<Map<String, String>> parseNewsResponse(String json) {
        List<Map<String, String>> result = new ArrayList<>();
        try {
            int resultsStart = json.indexOf("\"results\":[");
            if (resultsStart < 0) return result;

            int pos = resultsStart;
            int count = 0;
            while (count < 8) {
                int titleStart = json.indexOf("\"title\":\"", pos);
                if (titleStart < 0) break;
                titleStart += 9;
                int titleEnd = json.indexOf("\"", titleStart);
                if (titleEnd < 0) break;

                String title = json.substring(titleStart, titleEnd)
                        .replace("\\u2019", "'").replace("\\u2018", "'")
                        .replace("\\u201c", "\"").replace("\\u201d", "\"")
                        .replace("\\n", " ").replace("\\t", " ");

                if (title.length() > 20 && isTransportRelated(title)) {
                    Map<String, String> article = new HashMap<>();
                    article.put("title", title);
                    article.put("description", buildDisruptionDescription(title));
                    result.add(article);
                    count++;
                }
                pos = titleEnd + 1;
            }
        } catch (Exception e) {
            System.err.println("NewsService: Parse error — " + e.getMessage());
        }
        return result;
    }

    private boolean isTransportRelated(String title) {
        String l = title.toLowerCase();
        return l.contains("road") || l.contains("highway") || l.contains("flood") ||
                l.contains("accident") || l.contains("traffic") || l.contains("landslide") ||
                l.contains("blocked") || l.contains("nh-") || l.contains("national highway") ||
                l.contains("ghat") || l.contains("rain") || l.contains("transport") ||
                l.contains("truck") || l.contains("cargo") || l.contains("bridge") ||
                l.contains("diversion") || l.contains("closed") || l.contains("jam");
    }

    private String buildDisruptionDescription(String headline) {
        return "LIVE NEWS: " + headline +
                " — Logistics operations in the affected corridor are experiencing delays. " +
                "Shipments routed through this zone have been flagged for rerouting assessment.";
    }

    // 4. FALLBACK DATA

    private List<Map<String, String>> getFallbackNews() {
        List<Map<String, String>> fallback = new ArrayList<>();
        String[][] items = {
                {
                        "Cyclonic storm warning for Western Ghats corridor",
                        "IMD has issued a cyclonic storm warning for the Western Ghats region. Strong winds up to 80 km/h and heavy rainfall causing zero-visibility on SH-57. Transport authorities advise all freight convoys to halt movement."
                },
                {
                        "Multi-vehicle accident on NH-75 near Sakleshpur Ghat",
                        "A serious multi-vehicle collision on NH-75 near Sakleshpur Ghat has blocked one lane completely. Police and NHAI teams are on site. Clearance estimated within 4 hours. Alternate routes advised."
                },
                {
                        "Flash flood alert for Bhadra river basin near Mudigere",
                        "IMD has issued a flash flood alert for the Bhadra river basin. Low-lying road sections near Mudigere are submerged. Heavy vehicle movement suspended on NH-169 until water recedes."
                },
                {
                        "Landslide on Agumbe Ghat blocks freight corridor",
                        "Overnight rainfall triggered a landslide on the Agumbe Ghat stretch. NHAI and NDRF teams deployed for debris clearance. All freight traffic on this corridor diverted via Hassan bypass."
                },
                {
                        "Road repair and resurfacing blocks NH-169 near Shivamogga",
                        "NHAI has initiated emergency road resurfacing on NH-169 near Shivamogga. Traffic restricted to single-lane passage. Heavy vehicle convoy movement suspended until work is completed."
                }
        };
        for (String[] item : items) {
            Map<String, String> article = new HashMap<>();
            article.put("title", item[0]);
            article.put("description", item[1]);
            fallback.add(article);
        }
        return fallback;
    }
}