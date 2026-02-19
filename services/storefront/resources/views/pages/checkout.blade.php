@extends('layouts.app')

@section('title', 'Checkout - ZylkerKart')

@section('content')
<style>
    .checkout-title { font-size: 24px; margin-bottom: 20px; }
    .checkout-layout { display: grid; grid-template-columns: 1.5fr 1fr; gap: 30px; }
    .checkout-card { background: #fff; border-radius: 8px; padding: 25px; border: 1px solid #eee; margin-bottom: 15px; }
    .checkout-card h3 { margin: 0 0 15px 0; color: #333; }
    .checkout-form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
    .checkout-form-grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px; margin-top: 15px; }
    .checkout-field { margin-top: 15px; }
    .checkout-field:first-child { margin-top: 0; }
    .checkout-label { display: block; font-size: 13px; color: #666; margin-bottom: 5px; }
    .checkout-input { width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; box-sizing: border-box; }
    .checkout-input:focus { border-color: #0073e6; outline: none; }
    .payment-option { display: flex; align-items: center; gap: 10px; padding: 12px; border: 1px solid #eee; border-radius: 6px; cursor: pointer; margin-bottom: 8px; }
    .payment-option:last-child { margin-bottom: 0; }
    .payment-icon { font-size: 18px; }
    .order-summary { background: #fff; border-radius: 8px; padding: 25px; border: 1px solid #eee; height: fit-content; position: sticky; top: 100px; }
    .order-summary-title { margin: 0 0 20px 0; text-transform: uppercase; font-size: 14px; color: #888; }
    .order-item { display: flex; gap: 10px; padding: 10px 0; border-bottom: 1px solid #f0f0f0; }
    .order-item-img { width: 50px; height: 50px; object-fit: cover; border-radius: 4px; flex-shrink: 0; }
    .order-item-name { font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 200px; }
    .order-item-qty { font-size: 12px; color: #888; }
    .order-item-price { font-weight: 600; font-size: 14px; white-space: nowrap; }
    .order-row { display: flex; justify-content: space-between; padding: 10px 0; }
    .order-total { display: flex; justify-content: space-between; padding: 15px 0; font-weight: 700; font-size: 18px; border-top: 2px solid #eee; margin-top: 10px; }
    .secure-text { text-align: center; margin-top: 10px; font-size: 12px; color: #999; }

    @media (max-width: 768px) {
        .checkout-layout { grid-template-columns: 1fr; gap: 16px; }
        .checkout-form-grid { grid-template-columns: 1fr; gap: 12px; }
        .checkout-form-grid-3 { grid-template-columns: 1fr; gap: 12px; }
        .checkout-card { padding: 18px; }
        .order-summary { position: static; }
        .order-item-name { max-width: none; }
        .checkout-title { font-size: 20px; }
    }

    @media (max-width: 480px) {
        .checkout-card { padding: 14px; }
        .order-summary { padding: 18px; }
    }
</style>

<h1 class="checkout-title">Checkout</h1>

<div class="checkout-layout">
    <!-- Checkout Form -->
    <div>
        <!-- Delivery Address -->
        <div class="checkout-card">
            <h3>📍 Delivery Address</h3>
            <form id="checkoutForm" method="POST" action="/checkout">
                @csrf
                <div class="checkout-form-grid">
                    <div>
                        <label class="checkout-label">Full Name</label>
                        <input type="text" name="name" required placeholder="Enter your name"
                               value="{{ old('name', session('user.name', '')) }}" class="checkout-input">
                    </div>
                    <div>
                        <label class="checkout-label">Phone</label>
                        <input type="tel" name="phone" required placeholder="10-digit mobile"
                               value="{{ old('phone') }}" class="checkout-input">
                    </div>
                </div>
                <div class="checkout-field">
                    <label class="checkout-label">Address Line 1</label>
                    <input type="text" name="address1" required placeholder="House/Flat No., Building"
                           value="{{ old('address1') }}" class="checkout-input">
                </div>
                <div class="checkout-field">
                    <label class="checkout-label">Address Line 2</label>
                    <input type="text" name="address2" placeholder="Street, Locality"
                           value="{{ old('address2') }}" class="checkout-input">
                </div>
                <div class="checkout-form-grid-3">
                    <div>
                        <label class="checkout-label">City</label>
                        <input type="text" name="city" required placeholder="City"
                               value="{{ old('city') }}" class="checkout-input">
                    </div>
                    <div>
                        <label class="checkout-label">State</label>
                        <input type="text" name="state" required placeholder="State"
                               value="{{ old('state') }}" class="checkout-input">
                    </div>
                    <div>
                        <label class="checkout-label">PIN Code</label>
                        <input type="text" name="pincode" required placeholder="6-digit PIN" pattern="[0-9]{6}"
                               value="{{ old('pincode') }}" class="checkout-input">
                    </div>
                </div>
            </form>
        </div>

        <!-- Payment Method -->
        <div class="checkout-card">
            <h3>💳 Payment Method</h3>
            <label class="payment-option">
                <input type="radio" name="payment_method" value="credit_card" checked form="checkoutForm">
                <span class="payment-icon">💳</span> Credit / Debit Card
            </label>
            <label class="payment-option">
                <input type="radio" name="payment_method" value="upi" form="checkoutForm">
                <span class="payment-icon">📱</span> UPI
            </label>
            <label class="payment-option">
                <input type="radio" name="payment_method" value="net_banking" form="checkoutForm">
                <span class="payment-icon">🏦</span> Net Banking
            </label>
            <label class="payment-option">
                <input type="radio" name="payment_method" value="cod" form="checkoutForm">
                <span class="payment-icon">💵</span> Cash on Delivery
            </label>
        </div>
    </div>

    <!-- Order Summary -->
    <div class="order-summary">
        <h3 class="order-summary-title">Order Summary</h3>
        
        @if(!empty($cart['items']))
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

            @foreach($cart['items'] as $item)
                <div class="order-item">
                    <img src="{{ $item['image'] ?? '' }}" class="order-item-img">
                    <div style="flex: 1; min-width: 0;">
                        <div class="order-item-name">{{ $item['title'] ?? '' }}</div>
                        <div class="order-item-qty">Qty: {{ $item['quantity'] ?? 1 }}</div>
                    </div>
                    <div class="order-item-price">${{ number_format(floatval($item['price'] ?? 0) * ($item['quantity'] ?? 1), 2) }}</div>
                </div>
            @endforeach

            <div class="order-row" style="margin-top: 10px; border-top: 1px solid #eee;">
                <span>Subtotal</span>
                <span>${{ number_format($totalPrice, 2) }}</span>
            </div>
            <div class="order-row" style="padding: 5px 0;">
                <span>Delivery</span>
                <span style="color: {{ $deliveryFee === 0 ? '#4caf50' : '#333' }};">{{ $deliveryFee === 0 ? 'FREE' : '$' . $deliveryFee }}</span>
            </div>
            <div class="order-total">
                <span>Total</span>
                <span style="color: #e91e63;">${{ number_format($grandTotal, 2) }}</span>
            </div>
        @endif

        <button type="submit" form="checkoutForm" class="btn-primary" 
                style="display: block; width: 100%; text-align: center; margin-top: 15px; font-size: 16px; padding: 14px;">
            Place Order
        </button>
        <p class="secure-text">🔒 Secure checkout powered by ZylkerKart</p>
    </div>
</div>
@endsection
