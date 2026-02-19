@extends('layouts.app')

@section('title', $title ?? 'Product Detail - ZylkerKart')

@section('content')
<style>
    .pd-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 20px; }
    .pd-main-img { width: 100%; border-radius: 8px; max-height: 500px; object-fit: contain; background: #f8f8f8; border: 1px solid #eee; }
    .pd-thumbs { display: flex; gap: 10px; margin-top: 15px; overflow-x: auto; }
    .pd-thumb { width: 72px; height: 72px; object-fit: cover; border-radius: 6px; border: 2px solid #eee; cursor: pointer; transition: border-color 0.2s; }
    .pd-thumb:hover, .pd-thumb.active { border-color: #0073e6; }
    .pd-brand { color: #888; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; }
    .pd-title { font-size: 22px; margin: 8px 0 4px; font-weight: 600; color: #222; line-height: 1.3; }
    .pd-rating-bar { display: inline-flex; align-items: center; gap: 8px; margin: 10px 0; }
    .pd-rating-badge { background: #388e3c; color: #fff; padding: 3px 10px; border-radius: 3px; font-weight: 600; font-size: 14px; }
    .pd-rating-count { color: #888; font-size: 14px; }
    .pd-price-block { margin: 16px 0; display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; }
    .pd-final-price { font-size: 28px; font-weight: 700; color: #212121; }
    .pd-orig-price { text-decoration: line-through; color: #999; font-size: 16px; }
    .pd-discount { color: #388e3c; font-size: 16px; font-weight: 600; }
    .pd-stock { margin: 12px 0; padding: 10px 15px; border-radius: 6px; font-size: 14px; font-weight: 500; }
    .pd-stock.in { background: #e8f5e9; color: #2e7d32; }
    .pd-stock.low { background: #fff3e0; color: #e65100; }
    .pd-stock.out { background: #fce4ec; color: #c62828; }
    .pd-sizes { margin: 16px 0; }
    .pd-sizes strong { font-size: 14px; color: #333; }
    .pd-size-list { display: flex; gap: 8px; margin-top: 8px; flex-wrap: wrap; }
    .pd-size-btn { padding: 8px 18px; border: 1px solid #ddd; border-radius: 20px; cursor: pointer; font-size: 14px; background: #fff; transition: all 0.2s; }
    .pd-size-btn:hover { border-color: #0073e6; color: #0073e6; }
    .pd-size-btn.selected { border-color: #0073e6; background: #e3f2fd; color: #0073e6; font-weight: 600; }
    .pd-actions { margin: 20px 0; display: flex; gap: 12px; }
    .pd-btn-cart { flex: 1; font-size: 16px; padding: 14px; background: #0073e6; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; transition: background 0.2s; }
    .pd-btn-cart:hover { background: #005bb5; }
    .pd-btn-buy { flex: 1; background: #ff9800; color: #fff; border: none; padding: 14px; border-radius: 6px; font-size: 16px; cursor: pointer; font-weight: 600; transition: background 0.2s; }
    .pd-btn-buy:hover { background: #e68900; }

    /* Delivery Options */
    .pd-delivery { margin: 20px 0; padding: 16px; background: #f9f9f9; border-radius: 8px; border: 1px solid #eee; }
    .pd-delivery h3 { font-size: 14px; font-weight: 600; color: #333; margin-bottom: 12px; }
    .pd-delivery-list { display: flex; flex-wrap: wrap; gap: 12px; }
    .pd-delivery-item { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #555; background: #fff; padding: 8px 14px; border-radius: 6px; border: 1px solid #e8e8e8; }
    .pd-delivery-icon { font-size: 18px; }

    /* Offers / Bank */
    .pd-offers { margin: 16px 0; }
    .pd-offers h3 { font-size: 14px; font-weight: 600; color: #333; margin-bottom: 10px; }
    .pd-offer-item { display: flex; align-items: flex-start; gap: 8px; padding: 8px 0; border-bottom: 1px solid #f0f0f0; font-size: 13px; color: #444; }
    .pd-offer-tag { background: #388e3c; color: #fff; font-size: 11px; padding: 2px 8px; border-radius: 3px; font-weight: 600; white-space: nowrap; }

    /* Section divider */
    .pd-section { margin-top: 36px; }
    .pd-section-title { font-size: 18px; font-weight: 700; color: #222; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 2px solid #0073e6; display: inline-block; }

    /* Product Details */
    .pd-details-tabs { display: flex; gap: 0; border-bottom: 2px solid #eee; margin-bottom: 16px; }
    .pd-details-tab { padding: 10px 20px; cursor: pointer; font-size: 14px; font-weight: 500; color: #666; border-bottom: 2px solid transparent; margin-bottom: -2px; transition: all 0.2s; }
    .pd-details-tab:hover { color: #0073e6; }
    .pd-details-tab.active { color: #0073e6; border-bottom-color: #0073e6; font-weight: 600; }
    .pd-details-content { font-size: 14px; line-height: 1.7; color: #444; }
    .pd-details-pane { display: none; }
    .pd-details-pane.active { display: block; }

    /* Specs table */
    .pd-specs-table { width: 100%; border-collapse: collapse; }
    .pd-specs-table tr { border-bottom: 1px solid #f0f0f0; }
    .pd-specs-table td { padding: 10px 0; font-size: 14px; }
    .pd-specs-table td:first-child { color: #888; width: 40%; }

    /* Customer reviews */
    .pd-reviews { margin: 16px 0; }
    .pd-review-item { display: flex; align-items: center; gap: 12px; padding: 8px 0; }
    .pd-review-label { font-size: 13px; color: #555; min-width: 120px; }
    .pd-review-bar { flex: 1; height: 8px; background: #e0e0e0; border-radius: 4px; overflow: hidden; max-width: 200px; }
    .pd-review-fill { height: 100%; background: #0073e6; border-radius: 4px; transition: width 0.3s; }
    .pd-review-pct { font-size: 13px; color: #333; font-weight: 600; min-width: 40px; }

    @media (max-width: 768px) {
        .pd-grid { grid-template-columns: 1fr; gap: 20px; }
        .pd-details-tabs { overflow-x: auto; -webkit-overflow-scrolling: touch; scrollbar-width: none; }
        .pd-details-tabs::-webkit-scrollbar { display: none; }
        .pd-title { font-size: 18px; }
        .pd-final-price { font-size: 24px; }
        .pd-actions { flex-direction: column; }
        .pd-btn-cart, .pd-btn-buy { font-size: 15px; padding: 13px; }
        .pd-delivery-list { flex-direction: column; }
        .pd-main-img { max-height: 350px; }
        .pd-thumbs { gap: 8px; }
        .pd-thumb { width: 60px; height: 60px; }
        .pd-specs-table td:first-child { width: 45%; }
        .pd-review-bar { max-width: 140px; }
        .pd-review-label { min-width: 100px; font-size: 12px; }
    }

    @media (max-width: 480px) {
        .pd-title { font-size: 16px; }
        .pd-final-price { font-size: 22px; }
        .pd-orig-price { font-size: 14px; }
        .pd-discount { font-size: 14px; }
        .pd-btn-cart, .pd-btn-buy { font-size: 14px; padding: 12px; }
        .pd-main-img { max-height: 280px; }
        .pd-thumb { width: 52px; height: 52px; }
        .pd-details-tab { padding: 8px 14px; font-size: 13px; }
        .pd-section-title { font-size: 16px; }
        .pd-specs-table td { padding: 8px 0; font-size: 13px; }
        .pd-delivery { padding: 12px; }
        .pd-delivery-item { padding: 6px 10px; font-size: 12px; }
    }
</style>

<div class="pd-grid">
    <!-- Product Images -->
    <div>
        @if(!empty($product['images']))
            <img id="mainImage" src="{{ $product['images'][0] }}" alt="{{ $product['productDescription'] ?? '' }}" class="pd-main-img">
            @if(count($product['images']) > 1)
                <div class="pd-thumbs">
                    @foreach($product['images'] as $i => $img)
                        <img src="{{ $img }}" alt="thumbnail" class="pd-thumb {{ $i === 0 ? 'active' : '' }}"
                             onclick="switchImage(this, '{{ $img }}')">
                    @endforeach
                </div>
            @endif
        @else
            <img src="https://via.placeholder.com/500x400?text=No+Image" class="pd-main-img">
        @endif
    </div>

    <!-- Product Info -->
    <div>
        <div class="pd-brand">{{ $product['title'] ?? '' }}</div>
        <h1 class="pd-title">{{ $product['productDescription'] ?? 'Product' }}</h1>

        {{-- Category breadcrumb --}}
        @if(!empty($product['categoryGroup']) || !empty($product['subcategory']))
            <div style="font-size: 12px; color: #999; margin-bottom: 6px;">
                <a href="/products" style="color: #999; text-decoration: none;">Home</a>
                @if(!empty($product['categoryGroup']))
                    &rsaquo; <a href="/products?category={{ $product['categoryGroup'] }}" style="color: #888; text-decoration: none;">{{ $product['categoryGroup'] }}</a>
                @endif
                @if(!empty($product['subcategory']))
                    &rsaquo; <span style="color: #666;">{{ $product['subcategory'] }}</span>
                @endif
            </div>
        @endif

        @if(isset($product['rating']))
            <div class="pd-rating-bar">
                <span class="pd-rating-badge">⭐ {{ $product['rating'] }}</span>
                @if(isset($product['ratingsCount']))
                    <span class="pd-rating-count">{{ number_format($product['ratingsCount']) }} ratings</span>
                @endif
            </div>
        @endif

        <div class="pd-price-block">
            <span class="pd-final-price">{{ $product['finalPrice'] ?? '$0' }}</span>
            @if(isset($product['initialPrice']) && $product['initialPrice'] != ($product['finalPrice'] ?? ''))
                <span class="pd-orig-price">${{ $product['initialPrice'] }}</span>
            @endif
            @if(isset($product['discount']) && $product['discount'] > 0)
                <span class="pd-discount">({{ $product['discount'] }}% off)</span>
            @endif
        </div>

        <!-- Stock Info - Always In Stock -->
        <div class="pd-stock in">
            ✅ In Stock
        </div>

        <!-- Sizes -->
        @if(!empty($product['sizes']))
            <div class="pd-sizes">
                <strong>Select Size:</strong>
                <div class="pd-size-list">
                    @foreach($product['sizes'] as $size)
                        <span class="pd-size-btn" onclick="selectSize(this)">{{ $size['size'] ?? '' }}</span>
                    @endforeach
                </div>
            </div>
        @endif

        <!-- Add to Cart / Buy Now -->
        <div class="pd-actions">
            <button class="pd-btn-cart" onclick="addToCart({{ $product['productId'] ?? 0 }})">🛒 Add to Cart</button>
            <button class="pd-btn-buy" onclick="buyNow({{ $product['productId'] ?? 0 }})">⚡ Buy Now</button>
        </div>

        <!-- Delivery Options -->
        @php
            $deliveryOptions = [];
            if (!empty($product['deliveryOptions'])) {
                $deliveryOptions = json_decode($product['deliveryOptions'], true) ?? [];
            }
        @endphp
        @if(!empty($deliveryOptions))
            <div class="pd-delivery">
                <h3>📦 Delivery & Services</h3>
                <div class="pd-delivery-list">
                    @foreach($deliveryOptions as $opt)
                        @php
                            $icon = '✔️';
                            $lower = strtolower($opt);
                            if (str_contains($lower, 'original')) $icon = '🏷️';
                            elseif (str_contains($lower, 'delivery') || str_contains($lower, 'pay on')) $icon = '🚚';
                            elseif (str_contains($lower, 'return') || str_contains($lower, 'exchange')) $icon = '↩️';
                            elseif (str_contains($lower, 'try')) $icon = '👗';
                        @endphp
                        <div class="pd-delivery-item">
                            <span class="pd-delivery-icon">{{ $icon }}</span>
                            {{ $opt }}
                        </div>
                    @endforeach
                </div>
            </div>
        @endif

        <!-- Product Details (tabbed) -->
    @php
        $details = [];
        if (!empty($product['productDetails'])) {
            $details = json_decode($product['productDetails'], true) ?? [];
        }
    @endphp
    @if(!empty($details))
        <div class="pd-section">
            <h2 class="pd-section-title">Product Details</h2>
            <div class="pd-details-tabs" id="detailTabs">
                @if(!empty($details['description']))
                    <div class="pd-details-tab active" onclick="switchTab('desc')">Description</div>
                @endif
                @if(!empty($details['material_and_care']))
                    <div class="pd-details-tab" onclick="switchTab('material')">Material & Care</div>
                @endif
                @if(!empty($details['size_and_fit']))
                    <div class="pd-details-tab" onclick="switchTab('sizefit')">Size & Fit</div>
                @endif
            </div>
            <div class="pd-details-content">
                @if(!empty($details['description']))
                    <div class="pd-details-pane active" id="pane-desc">{{ $details['description'] }}</div>
                @endif
                @if(!empty($details['material_and_care']))
                    <div class="pd-details-pane" id="pane-material">{{ $details['material_and_care'] }}</div>
                @endif
                @if(!empty($details['size_and_fit']))
                    <div class="pd-details-pane" id="pane-sizefit">{{ $details['size_and_fit'] }}</div>
                @endif
            </div>
        </div>
    @endif

    <!-- Specifications -->
    @if(!empty($product['specifications']))
        <div class="pd-section">
            <h2 class="pd-section-title">Specifications</h2>
            <table class="pd-specs-table">
                @foreach($product['specifications'] as $spec)
                    <tr>
                        <td>{{ $spec['name'] ?? $spec['specName'] ?? '' }}</td>
                        <td>{{ $spec['value'] ?? $spec['specValue'] ?? '' }}</td>
                    </tr>
                @endforeach
            </table>
        </div>
    @endif

    <!-- What Customers Said -->
    @php
        $customerReviews = [];
        if (!empty($product['whatCustomersSaid'])) {
            $customerReviews = json_decode($product['whatCustomersSaid'], true) ?? [];
        }
    @endphp
    @if(!empty($customerReviews))
        <div class="pd-section">
            <h2 class="pd-section-title">What Customers Said</h2>
            <div class="pd-reviews">
                @foreach($customerReviews as $review)
                    <div class="pd-review-item">
                        <span class="pd-review-label">{{ $review['value_name'] ?? '' }}</span>
                        <div class="pd-review-bar">
                            <div class="pd-review-fill" style="width: {{ $review['percentage'] ?? 0 }}%"></div>
                        </div>
                        <span class="pd-review-pct">{{ $review['percentage'] ?? 0 }}%</span>
                    </div>
                @endforeach
            </div>
        </div>
    @endif

    </div>
</div>

<script>
const productData = {
    productId: {{ $product['productId'] ?? 0 }},
    title: @json($product['title'] ?? ''),
    price: {{ floatval(str_replace('$', '', $product['finalPrice'] ?? '0')) }},
    image: @json($product['images'][0] ?? '')
};

function switchImage(thumb, url) {
    document.getElementById('mainImage').src = url;
    document.querySelectorAll('.pd-thumb').forEach(t => t.classList.remove('active'));
    thumb.classList.add('active');
}

function selectSize(btn) {
    document.querySelectorAll('.pd-size-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
}

function switchTab(tab) {
    document.querySelectorAll('.pd-details-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.pd-details-pane').forEach(p => p.classList.remove('active'));
    event.target.classList.add('active');
    const pane = document.getElementById('pane-' + tab);
    if (pane) pane.classList.add('active');
}

async function addToCart(productId) {
    try {
        const response = await fetch('/api/cart/add', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').content
            },
            body: JSON.stringify({
                sessionId: getSessionId(),
                productId: productId,
                title: productData.title,
                price: productData.price,
                quantity: 1,
                image: productData.image
            })
        });
        const data = await response.json();
        if (response.ok) {
            updateCartBadge(data.itemCount || 0);
            showToast('✓ Added to cart');
        } else {
            showToast('✗ ' + (data.error || 'Failed to add'), 3000);
        }
    } catch (err) {
        showToast('✗ ' + err.message, 3000);
    }
}

function getSessionId() {
    return document.querySelector('meta[name="cart-session"]').content;
}

async function buyNow(productId) {
    const btn = document.querySelector('.pd-btn-buy');
    const origText = btn.textContent;
    btn.textContent = '⏳ Processing...';
    btn.disabled = true;
    try {
        const selectedSize = document.querySelector('.pd-size-btn.selected');
        const response = await fetch('/api/cart/add', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').content
            },
            body: JSON.stringify({
                sessionId: getSessionId(),
                productId: productId,
                title: productData.title,
                price: productData.price,
                quantity: 1,
                image: productData.image,
                size: selectedSize ? selectedSize.textContent.trim() : null
            })
        });
        if (response.ok) {
            window.location.href = '/checkout';
        } else {
            const data = await response.json();
            showToast('✗ ' + (data.error || 'Failed to add to cart'), 3000);
            btn.textContent = origText;
            btn.disabled = false;
        }
    } catch (err) {
        showToast('✗ ' + err.message, 3000);
        btn.textContent = origText;
        btn.disabled = false;
    }
}
</script>
@endsection
