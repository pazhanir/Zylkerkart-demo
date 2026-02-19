@extends('layouts.app')

@section('title', $title ?? 'Products - ZylkerKart')

@section('content')
    <h2 class="section-title">
        @if(!empty($filters['search']))
            Search results for "{{ $filters['search'] }}"
        @elseif(!empty($filters['category']))
            {{ $filters['category'] }}
        @else
            All Products
        @endif
    </h2>

    <div class="product-grid">
        @php
            $items = $products['products'] ?? $products;
        @endphp
        @forelse($items as $product)
            <a href="/products/{{ $product['productId'] }}" class="product-card" style="text-decoration: none; color: inherit;">
                @if(!empty($product['images']))
                    <img src="{{ $product['images'][0] }}" alt="{{ $product['productDescription'] ?? '' }}" loading="lazy">
                @else
                    <img src="https://via.placeholder.com/300x250?text=No+Image" alt="No image">
                @endif
                <div class="info">
                    <div class="brand">{{ $product['title'] ?? '' }}</div>
                    <div class="name">{{ \Illuminate\Support\Str::limit($product['productDescription'] ?? '', 50) }}</div>
                    <div>
                        <span class="price">{{ $product['finalPrice'] ?? '$0' }}</span>
                        @if(isset($product['initialPrice']) && $product['initialPrice'] != ($product['finalPrice'] ?? ''))
                            <span class="original-price">${{ $product['initialPrice'] }}</span>
                        @endif
                    </div>
                </div>
            </a>
        @empty
            <p>No products found.</p>
        @endforelse
    </div>

    <!-- Pagination -->
    @if(isset($products['totalPages']) && $products['totalPages'] > 1)
        <style>
            .pagination-wrap { text-align: center; margin: 30px 0; display: flex; justify-content: center; flex-wrap: wrap; gap: 4px; }
            .pagination-link { display: inline-block; padding: 8px 14px; border-radius: 4px; text-decoration: none; min-width: 40px; text-align: center; }
            .pagination-link--active { background: #1565c0; color: #fff; }
            .pagination-link--inactive { background: #e3f2fd; color: #1565c0; }
            @media (max-width: 480px) {
                .pagination-link { padding: 6px 10px; min-width: 34px; font-size: 13px; }
            }
        </style>
        <div class="pagination-wrap">
            @for($i = 0; $i < $products['totalPages']; $i++)
                <a href="/products?page={{ $i }}&category={{ $filters['category'] ?? '' }}&search={{ $filters['search'] ?? '' }}" 
                   class="pagination-link {{ $i == ($filters['page'] ?? 0) ? 'pagination-link--active' : 'pagination-link--inactive' }}">
                    {{ $i + 1 }}
                </a>
            @endfor
        </div>
    @endif
@endsection
