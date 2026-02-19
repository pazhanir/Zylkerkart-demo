<?php

namespace App\Http\Controllers;

use App\Services\ApiGateway;
use Illuminate\Http\Request;

class HomeController extends Controller
{
    private ApiGateway $api;

    public function __construct(ApiGateway $api)
    {
        $this->api = $api;
    }

    /**
     * Landing page - Featured products + categories + more products
     */
    public function index()
    {
        // Use current date+hour as seed so "Top Products" rotates every hour
        $hourlySeed = crc32(date('Y-m-d-H'));
        $topPage    = abs($hourlySeed) % 90;        // 929 products / 10 ≈ 93 pages
        $morePage   = abs($hourlySeed + 1) % 90;    // different page for Daily Essentials

        $products = $this->api->get('product', '/products', ['size' => 10, 'page' => $topPage]);
        $categories = $this->api->get('product', '/products/categories');
        $moreProducts = $this->api->get('product', '/products', ['size' => 10, 'page' => $morePage]);

        return view('pages.home', [
            'products'     => $products['data']['products'] ?? [],
            'moreProducts' => $moreProducts['data']['products'] ?? [],
            'categories'   => $categories['data'] ?? [],
            'title'        => 'ZylkerKart - Shop the Best Deals',
        ]);
    }

    /**
     * Product listing with filters
     */
    public function products(Request $request)
    {
        $query = [
            'page'     => $request->get('page', 0),
            'size'     => $request->get('size', 20),
            'category' => $request->get('category', ''),
            'search'   => $request->get('search', ''),
            'sort'     => $request->get('sort', ''),
        ];

        $products = $this->api->get('product', '/products', array_filter($query));
        $categories = $this->api->get('product', '/products/categories');

        return view('pages.products', [
            'products'   => $products['data'] ?? [],
            'categories' => $categories['data'] ?? [],
            'filters'    => $query,
            'title'      => 'Products - ZylkerKart',
        ]);
    }

    /**
     * Single product detail page
     */
    public function productDetail(int $id)
    {
        $product = $this->api->get('product', "/products/{$id}");

        if ($product['status'] !== 200) {
            abort(404, 'Product not found');
        }

        return view('pages.product-detail', [
            'product' => $product['data'] ?? [],
            'title'   => ($product['data']['title'] ?? 'Product') . ' - ' . ($product['data']['productDescription'] ?? 'ZylkerKart'),
        ]);
    }

    /**
     * Cart page
     */
    public function cart(Request $request)
    {
        $sessionId = session()->getId();
        $cart = $this->api->get('order', "/cart/{$sessionId}");

        return view('pages.cart', [
            'cart'  => $cart['data'] ?? [],
            'title' => 'Cart - ZylkerKart',
        ]);
    }

    /**
     * Checkout page
     */
    public function checkout(Request $request)
    {
        if (!session('auth_token')) {
            return redirect('/login')->with('redirect', '/checkout');
        }

        $sessionId = session()->getId();
        $cart = $this->api->get('order', "/cart/{$sessionId}");

        return view('pages.checkout', [
            'cart'  => $cart['data'] ?? [],
            'title' => 'Checkout - ZylkerKart',
        ]);
    }

    /**
     * POST /checkout - Place an order
     */
    public function placeOrder(Request $request)
    {
        $token = session('auth_token');
        if (!$token) {
            return redirect('/login')->with('redirect', '/checkout');
        }

        $sessionId = session()->getId();

        $address = implode(', ', array_filter([
            $request->address1,
            $request->address2,
            $request->city,
            $request->state,
            $request->pincode,
        ]));

        // Create order via Order Service with correct structure
        $order = $this->api->post('order', '/orders', [
            'sessionId' => $sessionId,
            'customer'  => [
                'name'          => $request->name,
                'email'         => session('user.email', $request->input('email', '')),
                'phone'         => $request->phone,
                'address'       => $address,
                'paymentMethod' => $request->payment_method ?? 'credit_card',
            ],
        ], $token);

        if ($order['status'] >= 200 && $order['status'] < 300) {
            return redirect('/')->with('success', 'Order placed successfully! Order ID: ' . ($order['data']['id'] ?? ''));
        }

        return back()->withInput()->withErrors(['order' => $order['data']['error'] ?? 'Failed to place order']);
    }

    /**
     * Cart API proxy - Add item (so JS doesn't call docker-internal URLs)
     */
    public function apiCartAdd(Request $request)
    {
        $result = $this->api->post('order', '/cart/add', $request->all());
        return response()->json($result['data'] ?? [], $result['status']);
    }

    /**
     * Cart API proxy - Get cart item count
     */
    public function apiCartCount(Request $request)
    {
        $sessionId = $request->input('sessionId', session()->getId());
        $result = $this->api->get('order', "/cart/{$sessionId}");
        $itemCount = $result['data']['itemCount'] ?? 0;
        return response()->json(['itemCount' => $itemCount]);
    }

    /**
     * Cart API proxy - Update item quantity
     */
    public function apiCartUpdate(Request $request)
    {
        $sessionId = $request->input('sessionId');
        $productId = $request->input('productId');
        $result = $this->api->put('order', "/cart/{$sessionId}/item/{$productId}", [
            'quantity' => $request->input('quantity'),
        ]);
        return response()->json($result['data'] ?? [], $result['status']);
    }

    /**
     * Cart API proxy - Remove item
     */
    public function apiCartRemove(Request $request)
    {
        $sessionId = $request->input('sessionId');
        $productId = $request->input('productId');
        $result = $this->api->delete('order', "/cart/{$sessionId}/item/{$productId}");
        return response()->json($result['data'] ?? [], $result['status']);
    }

    // ─── Search API Proxies ──────────────────────────────────────────────

    /**
     * Search API proxy - Autocomplete suggestions
     */
    public function apiSearchSuggestions(Request $request)
    {
        $result = $this->api->get('search', '/search/suggestions', [
            'q'     => $request->get('q', ''),
            'limit' => $request->get('limit', 8),
        ]);
        return response()->json($result['data'] ?? [], $result['status']);
    }

    /**
     * Search API proxy - Trending searches
     */
    public function apiSearchTrending()
    {
        $result = $this->api->get('search', '/search/trending', ['limit' => 10]);
        return response()->json($result['data'] ?? [], $result['status']);
    }

    /**
     * Search API proxy - Log a search query
     */
    public function apiSearchLog(Request $request)
    {
        $result = $this->api->post('search', '/search/log', [
            'query'        => $request->input('query', ''),
            'sessionId'    => session()->getId(),
            'resultsCount' => $request->input('resultsCount', 0),
        ]);
        return response()->json($result['data'] ?? [], $result['status']);
    }

    // ─── Orders API ──────────────────────────────────────────────────

    /**
     * GET /api/orders - Fetch current user's orders with payment info
     */
    public function apiOrders(Request $request)
    {
        $token = session('auth_token');
        $user = session('user');
        if (!$token || !$user) {
            return response()->json(['error' => 'Not authenticated'], 401);
        }

        $userId = $user['id'] ?? null;
        if (!$userId) {
            return response()->json(['orders' => []]);
        }

        // Fetch orders from order service
        $result = $this->api->get('order', "/orders/user/{$userId}", [], $token);
        $orders = $result['data'] ?? [];

        if (!is_array($orders)) {
            $orders = [];
        }

        // Enrich each order with payment/transaction data
        foreach ($orders as &$order) {
            $orderId = $order['id'] ?? null;
            if ($orderId) {
                $txnResult = $this->api->get('payment', "/payments/order/{$orderId}");
                $order['transactions'] = $txnResult['data'] ?? [];
            } else {
                $order['transactions'] = [];
            }
        }

        // Pagination
        $page = max(1, (int) $request->get('page', 1));
        $perPage = 10;
        $total = count($orders);
        $totalPages = max(1, ceil($total / $perPage));
        $offset = ($page - 1) * $perPage;
        $paginatedOrders = array_slice($orders, $offset, $perPage);

        return response()->json([
            'orders'      => array_values($paginatedOrders),
            'page'        => $page,
            'totalPages'  => $totalPages,
            'totalOrders' => $total,
        ]);
    }

    /**
     * GET /orders - Order history page (fallback for non-JS)
     */
    public function orderHistory(Request $request)
    {
        if (!session('auth_token')) {
            return redirect('/login')->with('redirect', '/orders');
        }

        return view('pages.orders', [
            'title' => 'My Orders - ZylkerKart',
        ]);
    }
}
