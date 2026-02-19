@extends('layouts.app')

@section('title', $title ?? 'ZylkerKart')

@section('content')
    <!-- Hero Banner Carousel -->
    <div class="hero-carousel" id="heroCarousel">
        <div class="hero-slides" id="heroSlides">
            <div class="hero-slide" style="background: linear-gradient(135deg, #0073e6 0%, #004a99 100%);">
                <div class="hero-text">
                    <div class="label">Best Deal Online on Smart Watches</div>
                    <h2>Smart Wearable.</h2>
                    <div class="offer">UP TO 80% OFF</div>
                </div>
            </div>
            <div class="hero-slide" style="background: linear-gradient(135deg, #e91e63 0%, #9c27b0 100%);">
                <div class="hero-text">
                    <div class="label">Trending Fashion Collection</div>
                    <h2>New Arrivals.</h2>
                    <div class="offer">UP TO 60% OFF</div>
                </div>
            </div>
            <div class="hero-slide" style="background: linear-gradient(135deg, #ff9800 0%, #f44336 100%);">
                <div class="hero-text">
                    <div class="label">Top Deals on Electronics</div>
                    <h2>Mega Sale.</h2>
                    <div class="offer">UP TO 70% OFF</div>
                </div>
            </div>
            <div class="hero-slide" style="background: linear-gradient(135deg, #4caf50 0%, #00897b 100%);">
                <div class="hero-text">
                    <div class="label">Home & Living Essentials</div>
                    <h2>Home Makeover.</h2>
                    <div class="offer">UP TO 50% OFF</div>
                </div>
            </div>
        </div>
        <button class="hero-arrow prev" onclick="heroSlide(-1)">&#10094;</button>
        <button class="hero-arrow next" onclick="heroSlide(1)">&#10095;</button>
        <div class="hero-dots" id="heroDots">
            <span class="active" onclick="heroGo(0)"></span>
            <span onclick="heroGo(1)"></span>
            <span onclick="heroGo(2)"></span>
            <span onclick="heroGo(3)"></span>
        </div>
    </div>

    <!-- Grab the Best Deals Section -->
    @if(!empty($products))
    <div class="section-header">
        <div class="section-title">Grab the best deal on <em>Top Products</em></div>
        <a href="/products" class="view-all">View All ›</a>
    </div>
    <div class="product-scroll">
        @foreach($products as $product)
            <a href="/products/{{ $product['productId'] }}" class="product-card">
                @if(isset($product['discount']) && $product['discount'] > 0)
                    <div class="discount-badge">{{ $product['discount'] }}% OFF</div>
                @endif
                @if(!empty($product['images']))
                    <img src="{{ is_array($product['images']) ? $product['images'][0] : $product['images'] }}" alt="{{ $product['productDescription'] ?? '' }}" loading="lazy">
                @else
                    <img src="https://via.placeholder.com/200x180?text=No+Image" alt="No image">
                @endif
                <div class="info">
                    <div class="brand">{{ $product['title'] ?? '' }}</div>
                    <div class="name">{{ \Illuminate\Support\Str::limit($product['productDescription'] ?? '', 35) }}</div>
                    <div class="price-row">
                        <span class="price">{{ $product['finalPrice'] ?? '$0' }}</span>
                        @if(isset($product['initialPrice']) && isset($product['discount']) && $product['discount'] > 0)
                            @php
                                $originalPrice = round($product['initialPrice'] / (1 - $product['discount']/100));
                            @endphp
                            <span class="original-price">${{ $originalPrice }}</span>
                        @endif
                    </div>
                    @if(isset($product['discount']) && $product['discount'] > 0)
                        <div class="save-text">Save - ${{ $originalPrice - $product['initialPrice'] }}</div>
                    @endif
                </div>
            </a>
        @endforeach
    </div>
    @endif

        <!-- Shop From Top Categories -->
    @if(!empty($categories))
    <div class="section-header">
        <div class="section-title">Shop From <em>Top Categories</em></div>
        <a href="/products" class="view-all">View All ›</a>
    </div>
    <div class="category-circles">
        @php
            $catIcons = [
                'Electronics' => '💻',
                'MensClothing' => '👔',
                'WomensClothing' => '👗',
                'Footwear' => '👟',
                'BeautyAndPersonalCare' => '💄',
                'HomeAndLiving' => '🛋️',
                'BagsAndWallets' => '👜',
                'Jewelry' => '💍',
                'WatchesAndEyewear' => '⌚',
                'FashionAccessories' => '🧣',
                'SportsAndFitness' => '🏃',
                'UnisexClothing' => '👕',
            ];
        @endphp
        @foreach($categories as $cat)
            @php
                $catName = $cat['name'] ?? '';
                $displayName = str_replace('And', ' & ', preg_replace('/([a-z])([A-Z])/', '$1 $2', $catName));
                $icon = $catIcons[$catName] ?? '🛒';
            @endphp
            <a href="/products?category={{ urlencode($catName) }}" class="cat-circle">
                <div class="circle-img">
                    <span style="font-size: 32px;">{{ $icon }}</span>
                </div>
                <span>{{ $displayName }}</span>
            </a>
        @endforeach
    </div>
    @endif


    <!-- Top Brands Section -->
    <div class="section-header">
        <div class="section-title">Top <em>Brands</em></div>
        <a href="/products" class="view-all">View All ›</a>
    </div>
    <div class="brand-scroll">
        @php
            $brands = [
                ['name' => 'Electronics', 'label' => 'ELECTRONICS', 'offer' => 'UP TO 80% OFF', 'gradient' => 'linear-gradient(135deg, #1a237e, #283593)', 'cat' => 'Electronics'],
                ['name' => 'Fashion', 'label' => 'FASHION', 'offer' => 'UP TO 70% OFF', 'gradient' => 'linear-gradient(135deg, #880e4f, #ad1457)', 'cat' => 'WomensClothing'],
                ['name' => 'Sports', 'label' => 'SPORTS', 'offer' => 'UP TO 60% OFF', 'gradient' => 'linear-gradient(135deg, #1b5e20, #2e7d32)', 'cat' => 'SportsAndFitness'],
                ['name' => 'Home & Living', 'label' => 'HOME & LIVING', 'offer' => 'UP TO 50% OFF', 'gradient' => 'linear-gradient(135deg, #e65100, #f57c00)', 'cat' => 'HomeAndLiving'],
                ['name' => 'Beauty', 'label' => 'BEAUTY', 'offer' => 'UP TO 65% OFF', 'gradient' => 'linear-gradient(135deg, #4a148c, #7b1fa2)', 'cat' => 'BeautyAndPersonalCare'],
                ['name' => 'Footwear', 'label' => 'FOOTWEAR', 'offer' => 'UP TO 55% OFF', 'gradient' => 'linear-gradient(135deg, #004d40, #00695c)', 'cat' => 'Footwear'],
            ];
        @endphp
        @foreach($brands as $brand)
            <a href="/products?category={{ $brand['cat'] }}" class="brand-card" style="background: {{ $brand['gradient'] }}; min-height: 180px; display: flex; align-items: center; justify-content: center; flex-direction: column;">
                <div class="brand-label">{{ $brand['label'] }}</div>
                <div style="color: #fff; text-align: center; padding: 20px;">
                    <div style="font-size: 42px; margin-bottom: 10px;">
                        @php
                            $brandIcons = ['Electronics' => '💻', 'Fashion' => '👗', 'Sports' => '🏃', 'Home & Living' => '🛋️', 'Beauty' => '💄', 'Footwear' => '👟'];
                        @endphp
                        {{ $brandIcons[$brand['name']] ?? '🛍️' }}
                    </div>
                    <div class="brand-offer">{{ $brand['offer'] }}</div>
                </div>
            </a>
        @endforeach
    </div>

    <!-- More Products Section -->
    @if(!empty($moreProducts))
    <div class="section-header">
        <div class="section-title">Daily <em>Essentials</em></div>
        <a href="/products" class="view-all">View All ›</a>
    </div>
    <div class="product-scroll">
        @foreach($moreProducts as $product)
            <a href="/products/{{ $product['productId'] }}" class="product-card">
                @if(isset($product['discount']) && $product['discount'] > 0)
                    <div class="discount-badge">{{ $product['discount'] }}% OFF</div>
                @endif
                @if(!empty($product['images']))
                    <img src="{{ is_array($product['images']) ? $product['images'][0] : $product['images'] }}" alt="{{ $product['productDescription'] ?? '' }}" loading="lazy">
                @else
                    <img src="https://via.placeholder.com/200x180?text=No+Image" alt="No image">
                @endif
                <div class="info">
                    <div class="brand">{{ $product['title'] ?? '' }}</div>
                    <div class="name">{{ \Illuminate\Support\Str::limit($product['productDescription'] ?? '', 35) }}</div>
                    <div class="price-row">
                        <span class="price">{{ $product['finalPrice'] ?? '$0' }}</span>
                        @if(isset($product['initialPrice']) && isset($product['discount']) && $product['discount'] > 0)
                            @php
                                $op = round($product['initialPrice'] / (1 - $product['discount']/100));
                            @endphp
                            <span class="original-price">${{ $op }}</span>
                        @endif
                    </div>
                    @if(isset($product['discount']) && $product['discount'] > 0 && isset($op))
                        <div class="save-text">Save - ${{ $op - $product['initialPrice'] }}</div>
                    @endif
                </div>
            </a>
        @endforeach
    </div>
    @endif

    @if(!empty($products) && count($products) >= 10)
        <div style="text-align: center; margin: 40px 0 20px;">
            <a href="/products" class="btn-primary" style="text-decoration: none; padding: 14px 40px; font-size: 16px;">View All Products</a>
        </div>
    @endif

<!-- Hero Carousel JS -->
<script>
let heroIdx = 0;
const heroTotal = document.querySelectorAll('.hero-slide').length;

function heroGo(i) {
    heroIdx = i;
    document.getElementById('heroSlides').style.transform = 'translateX(-' + (heroIdx * 100) + '%)';
    document.querySelectorAll('#heroDots span').forEach((d, idx) => d.classList.toggle('active', idx === heroIdx));
}

function heroSlide(dir) {
    heroGo((heroIdx + dir + heroTotal) % heroTotal);
}

// Auto-slide every 4 seconds
setInterval(() => heroSlide(1), 4000);
</script>
@endsection
