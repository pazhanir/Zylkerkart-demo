@extends('layouts.app')

@section('title', 'Cart - ZylkerKart')

@section('content')
<style>
    .cart-title { font-size: 24px; margin-bottom: 20px; }
    .cart-empty { text-align: center; padding: 60px 20px; }
    .cart-empty-icon { font-size: 64px; margin-bottom: 20px; }
    .cart-empty h2 { margin-bottom: 10px; }
    .cart-empty p { color: #888; margin-bottom: 20px; }
    .cart-layout { display: grid; grid-template-columns: 2fr 1fr; gap: 30px; }
    .cart-item { display: flex; gap: 20px; padding: 20px; background: #fff; border-radius: 8px; margin-bottom: 12px; border: 1px solid #eee; }
    .cart-item-img { width: 120px; height: 120px; object-fit: cover; border-radius: 6px; flex-shrink: 0; }
    .cart-item-info { flex: 1; min-width: 0; }
    .cart-item-title { margin: 0 0 5px 0; font-size: 16px; }
    .cart-item-price { font-size: 18px; font-weight: 700; color: #e91e63; margin-bottom: 10px; }
    .cart-item-actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
    .qty-btn { width: 32px; height: 32px; border: 1px solid #ddd; border-radius: 4px; background: #f5f5f5; cursor: pointer; font-size: 16px; }
    .qty-val { font-weight: 600; min-width: 30px; text-align: center; }
    .remove-btn { margin-left: auto; color: #f44336; background: none; border: none; cursor: pointer; font-size: 14px; white-space: nowrap; }
    .cart-summary { background: #fff; border-radius: 8px; padding: 25px; border: 1px solid #eee; height: fit-content; position: sticky; top: 100px; }
    .cart-summary-title { margin: 0 0 20px 0; text-transform: uppercase; font-size: 14px; color: #888; }
    .cart-summary-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #f0f0f0; }
    .cart-summary-total { display: flex; justify-content: space-between; padding: 15px 0; font-weight: 700; font-size: 18px; border-top: 2px solid #eee; margin-top: 5px; }

    @media (max-width: 768px) {
        .cart-layout { grid-template-columns: 1fr; gap: 16px; }
        .cart-item { padding: 14px; gap: 14px; }
        .cart-item-img { width: 90px; height: 90px; }
        .cart-item-title { font-size: 14px; }
        .cart-item-price { font-size: 16px; margin-bottom: 8px; }
        .cart-summary { position: static; }
        .cart-title { font-size: 20px; }
    }

    @media (max-width: 480px) {
        .cart-item { flex-direction: column; align-items: center; text-align: center; }
        .cart-item-img { width: 100%; height: 160px; object-fit: contain; background: #fafafa; }
        .cart-item-actions { justify-content: center; }
        .remove-btn { margin-left: 0; margin-top: 8px; }
        .cart-empty { padding: 40px 16px; }
        .cart-empty-icon { font-size: 48px; }
    }
</style>

<h1 class="cart-title">Shopping Cart</h1>

@if(empty($cart) || empty($cart['items']))
    <div class="cart-empty">
        <div class="cart-empty-icon">🛒</div>
        <h2>Your cart is empty</h2>
        <p>Looks like you haven't added anything yet.</p>
        <a href="/products" class="btn-primary" style="display: inline-block;">Continue Shopping</a>
    </div>
@else
    <div class="cart-layout">
        <!-- Cart Items -->
        <div>
            @foreach($cart['items'] as $item)
                <div class="cart-item">
                    <img src="{{ $item['image'] ?? 'https://via.placeholder.com/120x120?text=Product' }}" 
                         alt="{{ $item['title'] ?? '' }}" class="cart-item-img">
                    <div class="cart-item-info">
                        <h3 class="cart-item-title">{{ $item['title'] ?? 'Product' }}</h3>
                        <div class="cart-item-price">${{ $item['price'] ?? '0' }}</div>
                        <div class="cart-item-actions">
                            <button onclick="updateQty('{{ $item['productId'] ?? '' }}', {{ ($item['quantity'] ?? 1) - 1 }})" class="qty-btn">−</button>
                            <span class="qty-val">{{ $item['quantity'] ?? 1 }}</span>
                            <button onclick="updateQty('{{ $item['productId'] ?? '' }}', {{ ($item['quantity'] ?? 1) + 1 }})" class="qty-btn">+</button>
                            <button onclick="removeItem('{{ $item['productId'] ?? '' }}')" class="remove-btn">🗑 Remove</button>
                        </div>
                    </div>
                </div>
            @endforeach
        </div>

        <!-- Cart Summary -->
        <div class="cart-summary">
            <h3 class="cart-summary-title">Price Details</h3>
            
            @php
                $totalItems = 0;
                $totalPrice = 0;
                foreach ($cart['items'] as $item) {
                    $qty = $item['quantity'] ?? 1;
                    $price = floatval($item['price'] ?? 0);
                    $totalItems += $qty;
                    $totalPrice += $price * $qty;
                }
                $deliveryFee = $totalPrice > 499 ? 0 : 49;
                $grandTotal = $totalPrice + $deliveryFee;
            @endphp

            <div class="cart-summary-row">
                <span>Price ({{ $totalItems }} items)</span>
                <span>${{ number_format($totalPrice, 2) }}</span>
            </div>
            <div class="cart-summary-row">
                <span>Delivery Fee</span>
                <span style="color: {{ $deliveryFee === 0 ? '#4caf50' : '#333' }};">{{ $deliveryFee === 0 ? 'FREE' : '$' . $deliveryFee }}</span>
            </div>
            <div class="cart-summary-total">
                <span>Total Amount</span>
                <span>${{ number_format($grandTotal, 2) }}</span>
            </div>

            <a href="/checkout" class="btn-primary" style="display: block; text-align: center; margin-top: 15px; font-size: 16px; padding: 14px;">
                Proceed to Checkout
            </a>
            <a href="/products" style="display: block; text-align: center; margin-top: 10px; color: #2196f3; font-size: 14px;">Continue Shopping</a>
        </div>
    </div>
@endif

<script>
function getSessionId() {
    return document.querySelector('meta[name="cart-session"]').content;
}

async function updateQty(productId, newQty) {
    if (newQty < 1) { removeItem(productId); return; }
    try {
        await fetch('/api/cart/item', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').content
            },
            body: JSON.stringify({ sessionId: getSessionId(), productId: productId, quantity: newQty })
        });
        location.reload();
    } catch (err) { alert('Update failed: ' + err.message); }
}

async function removeItem(productId) {
    try {
        await fetch('/api/cart/item', {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').content
            },
            body: JSON.stringify({ sessionId: getSessionId(), productId: productId })
        });
        location.reload();
    } catch (err) { alert('Remove failed: ' + err.message); }
}
</script>
@endsection
