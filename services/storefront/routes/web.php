<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\HomeController;
use App\Http\Controllers\AuthController;

/*
|--------------------------------------------------------------------------
| Web Routes
|--------------------------------------------------------------------------
*/

// Public pages
Route::get('/', [HomeController::class, 'index'])->name('home');
Route::get('/products', [HomeController::class, 'products'])->name('products');
Route::get('/products/{id}', [HomeController::class, 'productDetail'])->name('product.detail');
Route::get('/cart', [HomeController::class, 'cart'])->name('cart');

// Auth routes
Route::get('/login', [AuthController::class, 'showLogin'])->name('login');
Route::post('/login', [AuthController::class, 'login']);
Route::get('/register', [AuthController::class, 'showRegister'])->name('register');
Route::post('/register', [AuthController::class, 'register']);
Route::post('/logout', [AuthController::class, 'logout'])->name('logout');

// Checkout (requires auth)
Route::get('/checkout', [HomeController::class, 'checkout'])->name('checkout');
Route::post('/checkout', [HomeController::class, 'placeOrder'])->name('checkout.post');

// Cart API proxy (so client-side JS doesn't call docker-internal URLs)
Route::prefix('api/cart')->group(function () {
    Route::post('/add', [HomeController::class, 'apiCartAdd']);
    Route::put('/item', [HomeController::class, 'apiCartUpdate']);
    Route::delete('/item', [HomeController::class, 'apiCartRemove']);
    Route::get('/count', [HomeController::class, 'apiCartCount']);
});

// Search API proxy
Route::prefix('api/search')->group(function () {
    Route::get('/suggestions', [HomeController::class, 'apiSearchSuggestions']);
    Route::get('/trending', [HomeController::class, 'apiSearchTrending']);
    Route::post('/log', [HomeController::class, 'apiSearchLog']);
});

// Orders API proxy
Route::get('/api/orders', [HomeController::class, 'apiOrders']);

// Order history page (fallback)
Route::get('/orders', [HomeController::class, 'orderHistory'])->name('orders');

// Health check
Route::get('/health', function () {
    return response()->json([
        'service'   => 'storefront',
        'status'    => 'UP',
        'timestamp' => now()->toISOString(),
    ]);
});
