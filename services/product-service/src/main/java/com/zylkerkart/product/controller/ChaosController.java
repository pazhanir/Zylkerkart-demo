package com.zylkerkart.product.controller;

import com.zylkerkart.product.service.ProductService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/simulate")
public class ChaosController {

    @Autowired
    private ProductService productService;

    /**
     * POST /simulate/slow-query - Triggers SELECT SLEEP(5)
     */
    @PostMapping("/slow-query")
    public ResponseEntity<Map<String, Object>> slowQuery() {
        return ResponseEntity.ok(productService.triggerSlowQuery());
    }

    /**
     * POST /simulate/full-table-scan - Missing index full table scan
     */
    @PostMapping("/full-table-scan")
    public ResponseEntity<Map<String, Object>> fullTableScan() {
        return ResponseEntity.ok(productService.triggerFullTableScan());
    }

    /**
     * POST /simulate/thread-exhaustion - Block thread for 30s
     */
    @PostMapping("/thread-exhaustion")
    public ResponseEntity<Map<String, Object>> threadExhaustion() {
        productService.setThreadExhaustionActive(true);
        productService.triggerThreadExhaustion();
        productService.setThreadExhaustionActive(false);
        return ResponseEntity.ok(Map.of(
                "chaos", "thread-exhaustion",
                "message", "Thread was blocked for 30 seconds",
                "status", "completed"
        ));
    }

    /**
     * POST /simulate/thread-exhaustion/stop - Stop thread exhaustion flag
     */
    @PostMapping("/thread-exhaustion/stop")
    public ResponseEntity<Map<String, Object>> stopThreadExhaustion() {
        productService.setThreadExhaustionActive(false);
        return ResponseEntity.ok(Map.of("status", "stopped"));
    }

    /**
     * POST /simulate/payload-bloat - Returns massive response
     */
    @PostMapping("/payload-bloat")
    public ResponseEntity<?> payloadBloat() {
        productService.setPayloadBloatActive(true);
        Object result = productService.triggerPayloadBloat();
        productService.setPayloadBloatActive(false);
        return ResponseEntity.ok(result);
    }

    /**
     * POST /simulate/payload-bloat/stop
     */
    @PostMapping("/payload-bloat/stop")
    public ResponseEntity<Map<String, Object>> stopPayloadBloat() {
        productService.setPayloadBloatActive(false);
        return ResponseEntity.ok(Map.of("status", "stopped"));
    }

    /**
     * POST /simulate/charset-mismatch - Charset conversion overhead
     */
    @PostMapping("/charset-mismatch")
    public ResponseEntity<Map<String, Object>> charsetMismatch() {
        return ResponseEntity.ok(productService.triggerCharsetMismatch());
    }

    /**
     * POST /simulate/zombie-threads - Spawn zombie threads
     */
    @PostMapping("/zombie-threads")
    public ResponseEntity<Map<String, Object>> zombieThreads() {
        return ResponseEntity.ok(productService.triggerZombieThreads());
    }

    /**
     * POST /simulate/zombie-threads/stop - Stop zombie threads
     */
    @PostMapping("/zombie-threads/stop")
    public ResponseEntity<Map<String, Object>> stopZombieThreads() {
        return ResponseEntity.ok(productService.stopZombieThreads());
    }

    /**
     * GET /simulate/status - Current chaos state
     */
    @GetMapping("/status")
    public ResponseEntity<Map<String, Object>> getStatus() {
        return ResponseEntity.ok(productService.getChaosStatus());
    }
}
