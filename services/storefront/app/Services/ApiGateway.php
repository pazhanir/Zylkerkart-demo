<?php

namespace App\Services;

use GuzzleHttp\Client;
use GuzzleHttp\Exception\RequestException;

/**
 * HTTP client service for communicating with backend microservices.
 * Acts as BFF (Backend-for-Frontend) gateway.
 */
class ApiGateway
{
    private Client $client;
    private array $serviceUrls;

    public function __construct()
    {
        $this->client = new Client([
            'timeout' => 10,
            'connect_timeout' => 5,
            'http_errors' => false,
        ]);

        $this->serviceUrls = [
            'product'   => env('PRODUCT_SERVICE_URL', 'http://product-service:8081'),
            'order'     => env('ORDER_SERVICE_URL', 'http://order-service:8082'),
            'search'    => env('SEARCH_SERVICE_URL', 'http://search-service:8083'),
            'payment'   => env('PAYMENT_SERVICE_URL', 'http://payment-service:8084'),
            'auth'      => env('AUTH_SERVICE_URL', 'http://auth-service:8085'),
        ];
    }

    /**
     * Make a GET request to a backend service
     */
    public function get(string $service, string $path, array $query = [], ?string $token = null): array
    {
        $options = ['query' => $query];
        if ($token) {
            $options['headers'] = ['Authorization' => "Bearer {$token}"];
        }

        try {
            $response = $this->client->get($this->serviceUrls[$service] . $path, $options);
            return [
                'status' => $response->getStatusCode(),
                'data'   => json_decode($response->getBody()->getContents(), true),
            ];
        } catch (RequestException $e) {
            return [
                'status' => 503,
                'data'   => ['error' => "Service '{$service}' unavailable: " . $e->getMessage()],
            ];
        }
    }

    /**
     * Make a POST request to a backend service
     */
    public function post(string $service, string $path, array $body = [], ?string $token = null): array
    {
        $options = ['json' => $body];
        if ($token) {
            $options['headers'] = ['Authorization' => "Bearer {$token}"];
        }

        try {
            $response = $this->client->post($this->serviceUrls[$service] . $path, $options);
            return [
                'status' => $response->getStatusCode(),
                'data'   => json_decode($response->getBody()->getContents(), true),
            ];
        } catch (RequestException $e) {
            return [
                'status' => 503,
                'data'   => ['error' => "Service '{$service}' unavailable: " . $e->getMessage()],
            ];
        }
    }

    /**
     * Make a PUT request to a backend service
     */
    public function put(string $service, string $path, array $body = [], ?string $token = null): array
    {
        $options = ['json' => $body];
        if ($token) {
            $options['headers'] = ['Authorization' => "Bearer {$token}"];
        }

        try {
            $response = $this->client->put($this->serviceUrls[$service] . $path, $options);
            return [
                'status' => $response->getStatusCode(),
                'data'   => json_decode($response->getBody()->getContents(), true),
            ];
        } catch (RequestException $e) {
            return [
                'status' => 503,
                'data'   => ['error' => "Service '{$service}' unavailable: " . $e->getMessage()],
            ];
        }
    }

    /**
     * Make a DELETE request to a backend service
     */
    public function delete(string $service, string $path, ?string $token = null): array
    {
        $options = [];
        if ($token) {
            $options['headers'] = ['Authorization' => "Bearer {$token}"];
        }

        try {
            $response = $this->client->delete($this->serviceUrls[$service] . $path, $options);
            return [
                'status' => $response->getStatusCode(),
                'data'   => json_decode($response->getBody()->getContents(), true),
            ];
        } catch (RequestException $e) {
            return [
                'status' => 503,
                'data'   => ['error' => "Service '{$service}' unavailable: " . $e->getMessage()],
            ];
        }
    }
}
