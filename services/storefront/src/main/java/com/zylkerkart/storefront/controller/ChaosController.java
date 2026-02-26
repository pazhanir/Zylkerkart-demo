package com.zylkerkart.storefront.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.*;

/**
 * Chaos engineering endpoints — kept for backward compatibility.
 * Simulates OOM, DNS failure, infinite retry, and SSL errors.
 */
@RestController
@RequestMapping("/chaos")
public class ChaosController {

    private volatile boolean oomActive = false;
    private volatile boolean dnsFailureActive = false;
    private volatile boolean infiniteRetryActive = false;
    private volatile boolean sslErrorActive = false;
    private final List<byte[]> memoryHog = new ArrayList<>();

    @PostMapping("/simulate-oom")
    public ResponseEntity<Map<String, Object>> simulateOOM(@RequestBody(required = false) Map<String, Object> body) {
        oomActive = true;
        int durationSeconds = 30;
        if (body != null && body.containsKey("duration")) {
            durationSeconds = ((Number) body.get("duration")).intValue();
        }

        final int duration = durationSeconds;
        new Thread(() -> {
            try {
                while (oomActive) {
                    memoryHog.add(new byte[10 * 1024 * 1024]); // 10MB chunks
                    Thread.sleep(100);
                }
            } catch (OutOfMemoryError | InterruptedException e) {
                // Expected — either OOM hit or interrupted
            } finally {
                memoryHog.clear();
                oomActive = false;
            }
        }).start();

        // Auto-stop after duration
        new Thread(() -> {
            try {
                Thread.sleep(duration * 1000L);
            } catch (InterruptedException ignored) {
            }
            oomActive = false;
            memoryHog.clear();
        }).start();

        return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "OOM simulation started",
                "duration", duration
        ));
    }

    @PostMapping("/simulate-dns-failure")
    public ResponseEntity<Map<String, Object>> simulateDNSFailure(
            @RequestBody(required = false) Map<String, Object> body) {
        dnsFailureActive = true;
        int durationSeconds = 30;
        if (body != null && body.containsKey("duration")) {
            durationSeconds = ((Number) body.get("duration")).intValue();
        }

        final int duration = durationSeconds;
        new Thread(() -> {
            try {
                Thread.sleep(duration * 1000L);
            } catch (InterruptedException ignored) {
            }
            dnsFailureActive = false;
        }).start();

        return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "DNS failure simulation started",
                "duration", duration
        ));
    }

    @PostMapping("/simulate-infinite-retry")
    public ResponseEntity<Map<String, Object>> simulateInfiniteRetry(
            @RequestBody(required = false) Map<String, Object> body) {
        infiniteRetryActive = true;
        int durationSeconds = 30;
        if (body != null && body.containsKey("duration")) {
            durationSeconds = ((Number) body.get("duration")).intValue();
        }

        final int duration = durationSeconds;
        new Thread(() -> {
            try {
                Thread.sleep(duration * 1000L);
            } catch (InterruptedException ignored) {
            }
            infiniteRetryActive = false;
        }).start();

        return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "Infinite retry simulation started",
                "duration", duration
        ));
    }

    @PostMapping("/simulate-ssl-error")
    public ResponseEntity<Map<String, Object>> simulateSSLError(
            @RequestBody(required = false) Map<String, Object> body) {
        sslErrorActive = true;
        int durationSeconds = 30;
        if (body != null && body.containsKey("duration")) {
            durationSeconds = ((Number) body.get("duration")).intValue();
        }

        final int duration = durationSeconds;
        new Thread(() -> {
            try {
                Thread.sleep(duration * 1000L);
            } catch (InterruptedException ignored) {
            }
            sslErrorActive = false;
        }).start();

        return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "SSL error simulation started",
                "duration", duration
        ));
    }

    @GetMapping("/status")
    public ResponseEntity<Map<String, Object>> status() {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("service", "storefront-chaos");
        response.put("timestamp", LocalDateTime.now().toString());

        Map<String, Object> simulations = new LinkedHashMap<>();
        simulations.put("oom", Map.of("active", oomActive));
        simulations.put("dnsFailure", Map.of("active", dnsFailureActive));
        simulations.put("infiniteRetry", Map.of("active", infiniteRetryActive));
        simulations.put("sslError", Map.of("active", sslErrorActive));
        response.put("simulations", simulations);

        return ResponseEntity.ok(response);
    }
}
