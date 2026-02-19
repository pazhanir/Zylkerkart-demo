<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Chaos simulation endpoints for the PHP Storefront.
 * Scenarios: OOM, DNS Failure, Infinite Retry, SSL Error
 */
class ChaosController extends Controller
{
    private static bool $oomActive = false;
    private static bool $infiniteRetryActive = false;

    /**
     * POST /simulate/oom - Simulate Out of Memory
     */
    public function simulateOOM(): JsonResponse
    {
        self::$oomActive = true;

        // Deliberately consume memory
        $data = [];
        $targetMB = 256;
        try {
            for ($i = 0; $i < $targetMB; $i++) {
                // Each iteration allocates ~1MB
                $data[] = str_repeat('X', 1024 * 1024);
            }
        } catch (\Throwable $e) {
            return response()->json([
                'chaos'    => 'oom',
                'status'   => 'triggered',
                'consumed' => count($data) . 'MB',
                'error'    => $e->getMessage(),
            ]);
        }

        return response()->json([
            'chaos'    => 'oom',
            'status'   => 'triggered',
            'consumed' => count($data) . 'MB',
            'message'  => 'Memory allocated. Process may be killed by OOM killer.',
        ]);
    }

    /**
     * POST /simulate/dns-failure - Try to connect to non-existent host
     */
    public function simulateDNSFailure(): JsonResponse
    {
        $startTime = microtime(true);
        $errors = [];

        // Try to resolve non-existent domains
        $badHosts = [
            'this-host-does-not-exist-zylkerkart.internal',
            'fake-service.local',
            'nonexistent.zylkerkart.dev',
        ];

        foreach ($badHosts as $host) {
            try {
                $result = @dns_get_record($host, DNS_A);
                $ch = curl_init("http://{$host}:8080/health");
                curl_setopt($ch, CURLOPT_TIMEOUT, 3);
                curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 2);
                curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
                $response = curl_exec($ch);
                $error = curl_error($ch);
                curl_close($ch);
                $errors[] = ['host' => $host, 'error' => $error ?: 'no error'];
            } catch (\Throwable $e) {
                $errors[] = ['host' => $host, 'error' => $e->getMessage()];
            }
        }

        $elapsed = round((microtime(true) - $startTime) * 1000, 2);

        return response()->json([
            'chaos'      => 'dns-failure',
            'status'     => 'triggered',
            'attempts'   => $errors,
            'elapsed_ms' => $elapsed,
            'message'    => 'DNS resolution failures simulated',
        ]);
    }

    /**
     * POST /simulate/infinite-retry - Retry a failing request indefinitely
     */
    public function simulateInfiniteRetry(Request $request): JsonResponse
    {
        $maxRetries = (int) $request->get('max_retries', 50);
        $retryDelay = (int) $request->get('retry_delay_ms', 100);
        $targetUrl = $request->get('target_url', 'http://localhost:1/nonexistent');

        $attempts = 0;
        $errors = [];

        while ($attempts < $maxRetries) {
            $attempts++;
            try {
                $ch = curl_init($targetUrl);
                curl_setopt($ch, CURLOPT_TIMEOUT, 1);
                curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 1);
                curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
                $response = curl_exec($ch);
                $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
                $error = curl_error($ch);
                curl_close($ch);

                if ($httpCode >= 200 && $httpCode < 300) {
                    break; // Success - stop retrying
                }

                $errors[] = "Attempt {$attempts}: HTTP {$httpCode} - {$error}";
            } catch (\Throwable $e) {
                $errors[] = "Attempt {$attempts}: {$e->getMessage()}";
            }

            usleep($retryDelay * 1000);
        }

        return response()->json([
            'chaos'         => 'infinite-retry',
            'status'        => 'completed',
            'total_attempts' => $attempts,
            'max_retries'   => $maxRetries,
            'target_url'    => $targetUrl,
            'last_errors'   => array_slice($errors, -5),
            'message'       => "Retried {$attempts} times with no circuit breaker",
        ]);
    }

    /**
     * POST /simulate/ssl-error - Connect to HTTPS with wrong cert / expired cert
     */
    public function simulateSSLError(): JsonResponse
    {
        $errors = [];

        // Try connecting to known bad SSL endpoints
        $badSSLUrls = [
            'https://expired.badssl.com/',
            'https://wrong.host.badssl.com/',
            'https://self-signed.badssl.com/',
            'https://untrusted-root.badssl.com/',
        ];

        foreach ($badSSLUrls as $url) {
            try {
                $ch = curl_init($url);
                curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
                curl_setopt($ch, CURLOPT_TIMEOUT, 5);
                curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);  // Enforce SSL verification
                curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 2);
                $response = curl_exec($ch);
                $error = curl_error($ch);
                $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
                curl_close($ch);

                $errors[] = [
                    'url'       => $url,
                    'http_code' => $httpCode,
                    'error'     => $error ?: 'no error (SSL accepted unexpectedly)',
                ];
            } catch (\Throwable $e) {
                $errors[] = [
                    'url'   => $url,
                    'error' => $e->getMessage(),
                ];
            }
        }

        return response()->json([
            'chaos'   => 'ssl-error',
            'status'  => 'triggered',
            'results' => $errors,
            'message' => 'SSL verification failures simulated',
        ]);
    }

    /**
     * GET /simulate/status
     */
    public function status(): JsonResponse
    {
        return response()->json([
            'oomActive'           => self::$oomActive,
            'infiniteRetryActive' => self::$infiniteRetryActive,
        ]);
    }
}
