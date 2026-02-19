@extends('layouts.app')

@section('title', $title ?? 'My Orders - ZylkerKart')

@section('content')
<style>
    .orders-page { max-width: 900px; margin: 0 auto; padding: 20px 0; }
    .orders-page h1 { font-size: 24px; font-weight: 700; margin-bottom: 20px; color: #1a1a2e; }
    .orders-page h1::after { content: ''; display: block; width: 60px; height: 3px; background: #0073e6; margin-top: 8px; border-radius: 2px; }
    .op-loading { text-align: center; padding: 60px 20px; color: #999; font-size: 15px; }
    .op-empty { text-align: center; padding: 60px 20px; color: #999; }
    .op-empty .op-empty-icon { font-size: 56px; margin-bottom: 12px; }
    .op-empty p { font-size: 16px; }
    .op-empty a { color: #0073e6; text-decoration: none; font-weight: 600; }
    .op-order { background: #fff; border-radius: 10px; border: 1px solid #eee; margin-bottom: 14px; overflow: hidden; box-shadow: 0 1px 4px rgba(0,0,0,0.04); }
    .op-order-header { padding: 16px 24px; cursor: pointer; display: flex; align-items: center; justify-content: space-between; transition: background 0.15s; }
    .op-order-header:hover { background: #f8f9fa; }
    .op-order-left { flex: 1; }
    .op-order-id { font-size: 15px; font-weight: 600; color: #1a1a2e; }
    .op-order-date { font-size: 13px; color: #999; margin-top: 3px; }
    .op-order-right { display: flex; align-items: center; gap: 14px; }
    .op-order-amount { font-size: 17px; font-weight: 700; color: #1a1a2e; }
    .op-chevron { font-size: 13px; color: #bbb; transition: transform 0.3s ease; }
    .op-order.expanded .op-chevron { transform: rotate(180deg); }
    .op-details { max-height: 0; overflow: hidden; opacity: 0; padding: 0 24px; border-top: 1px solid transparent; transition: max-height 0.35s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.25s ease, padding 0.35s ease, border-color 0.2s ease; }
    .op-order.expanded .op-details { opacity: 1; padding: 0 24px 18px; border-top-color: #f0f0f0; }
    .op-items-table { width: 100%; font-size: 14px; margin-top: 12px; border-collapse: collapse; }
    .op-items-table th { text-align: left; font-weight: 600; color: #999; font-size: 12px; text-transform: uppercase; padding: 8px; border-bottom: 1px solid #eee; }
    .op-items-table td { padding: 10px 8px; vertical-align: middle; border-bottom: 1px solid #f5f5f5; }
    .op-items-table .op-item-img { width: 44px; height: 44px; object-fit: contain; border-radius: 6px; background: #f8f8f8; }
    .op-txn { margin-top: 14px; padding: 12px 16px; background: #f8f9fa; border-radius: 8px; font-size: 13px; }
    .op-txn-row { display: flex; justify-content: space-between; margin-bottom: 5px; }
    .op-txn-row:last-child { margin-bottom: 0; }
    .op-txn-label { color: #999; font-weight: 500; }
    .op-txn-value { color: #333; font-weight: 600; font-family: 'Courier New', monospace; }
    .op-pagination { display: flex; align-items: center; justify-content: center; gap: 10px; margin-top: 20px; }
    .op-pagination button { padding: 8px 20px; border: 1px solid #ddd; border-radius: 6px; background: #fff; font-size: 14px; font-weight: 500; cursor: pointer; color: #333; transition: all 0.15s; }
    .op-pagination button:hover:not(:disabled) { background: #0073e6; color: #fff; border-color: #0073e6; }
    .op-pagination button:disabled { opacity: 0.4; cursor: default; }
    .op-pagination .op-page-info { font-size: 14px; color: #999; }
</style>

<div class="orders-page">
    <h1>My Orders</h1>
    <div id="opContainer">
        <div class="op-loading" id="opLoading">Loading your orders...</div>
    </div>
    <div class="op-pagination" id="opPagination" style="display:none;">
        <button id="opPrev">← Previous</button>
        <span class="op-page-info" id="opPageInfo"></span>
        <button id="opNext">Next →</button>
    </div>
</div>

<script>
(function() {
    var page = 1;

    function load(p) {
        page = p;
        var container = document.getElementById('opContainer');
        container.innerHTML = '<div class="op-loading">Loading your orders...</div>';

        fetch('/api/orders?page=' + p)
            .then(function(r) { return r.json(); })
            .then(function(data) {
                if (!data.orders || data.orders.length === 0) {
                    container.innerHTML = '<div class="op-empty"><div class="op-empty-icon">📭</div><p>You haven\'t placed any orders yet.</p><p style="margin-top:8px;"><a href="/products">Start shopping →</a></p></div>';
                    document.getElementById('opPagination').style.display = 'none';
                    return;
                }
                render(container, data.orders);
                var pg = document.getElementById('opPagination');
                if (data.totalPages > 1) {
                    pg.style.display = 'flex';
                    document.getElementById('opPrev').disabled = (p <= 1);
                    document.getElementById('opNext').disabled = (p >= data.totalPages);
                    document.getElementById('opPageInfo').textContent = 'Page ' + p + ' of ' + data.totalPages + ' (' + data.totalOrders + ' orders)';
                } else {
                    pg.style.display = 'none';
                }
            })
            .catch(function() {
                container.innerHTML = '<div class="op-empty"><div class="op-empty-icon">⚠️</div><p>Failed to load orders. Please try again.</p></div>';
            });
    }

    function render(container, orders) {
        var html = '';
        orders.forEach(function(order) {
            var oid = order.id || '—';
            var status = order.status || 'pending';
            var total = parseFloat(order.total_amount || 0).toFixed(2);
            var date = order.created_at ? new Date(order.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '—';
            var items = order.items || [];
            var txns = order.transactions || [];

            html += '<div class="op-order" id="op-order-' + oid + '">';
            html += '<div class="op-order-header" onclick="toggleOpAccordion(' + oid + ')">';
            html += '<div class="op-order-left"><div class="op-order-id">Order #' + oid + '</div><div class="op-order-date">' + date + '</div></div>';
            html += '<div class="op-order-right"><span class="od-status ' + status + '">' + status + '</span><span class="op-order-amount">$' + total + '</span><span class="op-chevron">▼</span></div>';
            html += '</div>';

            html += '<div class="op-details">';
            if (items.length) {
                html += '<table class="op-items-table"><thead><tr><th></th><th>Product</th><th>Qty</th><th>Price</th></tr></thead><tbody>';
                items.forEach(function(item) {
                    var img = item.image_url || 'https://via.placeholder.com/44';
                    html += '<tr><td><img class="op-item-img" src="' + img + '" alt=""></td>';
                    html += '<td>' + (item.product_title || 'Product') + (item.size ? '<br><small style="color:#999">Size: ' + item.size + '</small>' : '') + '</td>';
                    html += '<td>' + (item.quantity || 1) + '</td>';
                    html += '<td>$' + parseFloat(item.unit_price || 0).toFixed(2) + '</td></tr>';
                });
                html += '</tbody></table>';
            }
            if (txns.length) {
                txns.forEach(function(txn) {
                    html += '<div class="op-txn">';
                    html += '<div class="op-txn-row"><span class="op-txn-label">Transaction ID</span><span class="op-txn-value">' + (txn.transaction_ref || '—') + '</span></div>';
                    html += '<div class="op-txn-row"><span class="op-txn-label">Method</span><span class="op-txn-value">' + (txn.method || '—').replace('_', ' ') + '</span></div>';
                    html += '<div class="op-txn-row"><span class="op-txn-label">Payment Status</span><span class="op-txn-value"><span class="od-status ' + (txn.status || '') + '">' + (txn.status || '—') + '</span></span></div>';
                    html += '</div>';
                });
            }
            if (order.shipping_address) {
                html += '<div class="op-txn" style="margin-top:8px;"><div class="op-txn-row"><span class="op-txn-label">Shipping</span><span class="op-txn-value" style="font-family:inherit;">' + order.shipping_address + '</span></div></div>';
            }
            html += '</div></div>';
        });
        container.innerHTML = html;
    }

    document.getElementById('opPrev').addEventListener('click', function() { if (page > 1) load(page - 1); });
    document.getElementById('opNext').addEventListener('click', function() { load(page + 1); });

    load(1);
})();

function toggleOpAccordion(orderId) {
    var el = document.getElementById('op-order-' + orderId);
    if (!el) return;
    var details = el.querySelector('.op-details');
    if (!details) return;
    if (el.classList.contains('expanded')) {
        details.style.maxHeight = details.scrollHeight + 'px';
        requestAnimationFrame(function() { details.style.maxHeight = '0'; });
        el.classList.remove('expanded');
    } else {
        el.classList.add('expanded');
        details.style.maxHeight = details.scrollHeight + 'px';
        details.addEventListener('transitionend', function handler() {
            if (el.classList.contains('expanded')) details.style.maxHeight = 'none';
            details.removeEventListener('transitionend', handler);
        });
    }
}
</script>
@endsection
