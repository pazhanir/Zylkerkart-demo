#!/usr/bin/env python3
"""
ZylkerKart - CSV Seed Loader
Reads product_datasets.csv and populates the normalized db_product schema.
Also seeds db_search.search_logs with sample search queries.
Idempotent: checks if data exists before inserting.
"""

import csv
import json
import os
import sys
import random
import time
import html
from datetime import datetime, timedelta
import mysql.connector
from mysql.connector import Error

# Configuration
MYSQL_USER = os.environ.get('SEED_MYSQL_USER', 'root')
MYSQL_PASSWORD = os.environ.get('MYSQL_ROOT_PASSWORD', 'zylkerkart_root_2026')
MYSQL_SOCKET = '/var/run/mysqld/mysqld.sock'
CSV_FILE = os.environ.get('CSV_FILE', '/docker-entrypoint-initdb.d/product_datasets.csv')

MAX_RETRIES = 30
RETRY_DELAY = 5


def wait_for_mysql():
    """Wait for MySQL to be ready (via Unix socket during init)."""
    for attempt in range(MAX_RETRIES):
        try:
            conn = mysql.connector.connect(
                unix_socket=MYSQL_SOCKET,
                user=MYSQL_USER, password=MYSQL_PASSWORD,
                connection_timeout=5
            )
            conn.close()
            print("[SEED] MySQL is ready!")
            return True
        except Error as e:
            print(f"[SEED] Waiting for MySQL (attempt {attempt + 1}/{MAX_RETRIES}): {e}")
            time.sleep(RETRY_DELAY)
    print("[SEED] ERROR: MySQL not available after max retries.")
    sys.exit(1)


def get_connection(database=None):
    """Get a MySQL connection via Unix socket."""
    params = {
        'unix_socket': MYSQL_SOCKET,
        'user': MYSQL_USER,
        'password': MYSQL_PASSWORD,
        'charset': 'utf8mb4',
        'collation': 'utf8mb4_unicode_ci',
        'autocommit': False
    }
    if database:
        params['database'] = database
    return mysql.connector.connect(**params)


def is_already_seeded():
    """Check if db_product.products already has data."""
    try:
        conn = get_connection('db_product')
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM products")
        count = cursor.fetchone()[0]
        cursor.close()
        conn.close()
        if count > 0:
            print(f"[SEED] Database already seeded with {count} products. Skipping.")
            return True
        return False
    except Error:
        return False


def parse_json_safe(value):
    """Safely parse a JSON string, returning None if invalid."""
    if not value or value.strip() in ('', '[]', '{}', 'null', 'None'):
        return None
    try:
        return json.loads(value)
    except (json.JSONDecodeError, TypeError):
        # Try fixing common issues
        try:
            cleaned = value.replace("'", '"')
            return json.loads(cleaned)
        except (json.JSONDecodeError, TypeError):
            return None


def clean_price(price_str):
    """Clean final_price field: remove $, quotes, etc."""
    if not price_str:
        return None
    cleaned = price_str.strip().strip('"').strip("'").strip()
    if cleaned.startswith('$'):
        return cleaned
    elif cleaned.replace('.', '').replace(',', '').isdigit():
        return f"${cleaned}"
    return cleaned if cleaned else None


def clean_html(text):
    """Decode HTML entities in text."""
    if not text:
        return text
    return html.unescape(text)


def seed_database():
    """Main seeding function."""
    print("[SEED] Starting database seeding...")

    if not os.path.exists(CSV_FILE):
        print(f"[SEED] ERROR: CSV file not found: {CSV_FILE}")
        sys.exit(1)

    # -------------------------------------------------------------------------
    # Phase 1: Read and parse CSV
    # -------------------------------------------------------------------------
    print(f"[SEED] Reading CSV: {CSV_FILE}")
    products = []
    with open(CSV_FILE, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            products.append(row)
    print(f"[SEED] Parsed {len(products)} products from CSV")

    # -------------------------------------------------------------------------
    # Phase 2: Extract unique categories and subcategories
    # -------------------------------------------------------------------------
    category_groups = {}  # name -> id
    subcategories = {}    # (name, group_name) -> id

    for p in products:
        cg = p.get('category_group', '').strip()
        sc = p.get('subcategory', '').strip()
        if cg and cg not in category_groups:
            category_groups[cg] = None
        if sc and cg:
            key = (sc, cg)
            if key not in subcategories:
                subcategories[key] = None

    # -------------------------------------------------------------------------
    # Phase 3: Insert into db_product
    # -------------------------------------------------------------------------
    conn = get_connection('db_product')
    cursor = conn.cursor()

    try:
        # Insert category_groups
        print(f"[SEED] Inserting {len(category_groups)} category groups...")
        for name in category_groups:
            cursor.execute(
                "INSERT INTO category_groups (name) VALUES (%s) ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)",
                (name,)
            )
            category_groups[name] = cursor.lastrowid
        conn.commit()

        # Insert subcategories
        print(f"[SEED] Inserting {len(subcategories)} subcategories...")
        for (sc_name, cg_name) in subcategories:
            cg_id = category_groups[cg_name]
            cursor.execute(
                "INSERT INTO subcategories (name, category_group_id) VALUES (%s, %s) "
                "ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)",
                (sc_name, cg_id)
            )
            subcategories[(sc_name, cg_name)] = cursor.lastrowid
        conn.commit()

        # Insert products and related data
        print(f"[SEED] Inserting {len(products)} products...")

        images_batch = []
        specs_batch = []
        sizes_batch = []
        offers_batch = []
        stars_batch = []
        breadcrumbs_batch = []

        for i, p in enumerate(products):
            product_id = int(p['product_id'])
            cg_name = p.get('category_group', '').strip()
            sc_name = p.get('subcategory', '').strip()
            sc_id = subcategories.get((sc_name, cg_name))

            if sc_id is None:
                print(f"[SEED] WARNING: No subcategory for product {product_id}, skipping")
                continue

            # Parse fields
            rating = float(p['rating']) if p.get('rating') and p['rating'].strip() else None
            ratings_count = int(p['ratings_count']) if p.get('ratings_count') and p['ratings_count'].strip() else 0
            initial_price = int(p['initial_price']) if p.get('initial_price') and p['initial_price'].strip() else None
            discount_val = int(p['discount']) if p.get('discount') and p['discount'].strip() else 0
            final_price = clean_price(p.get('final_price', ''))

            delivery_opts = parse_json_safe(p.get('delivery_options', ''))
            product_details = parse_json_safe(p.get('product_details', ''))
            what_said = clean_html(p.get('what_customers_said', '').strip()) or None
            seller = p.get('seller_name', '').strip() or None

            # Insert product
            cursor.execute(
                """INSERT INTO products
                   (product_id, title, product_description, rating, ratings_count,
                    initial_price, discount, final_price, currency, subcategory_id,
                    delivery_options, product_details, what_customers_said, seller_name)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                   ON DUPLICATE KEY UPDATE title=VALUES(title)""",
                (
                    product_id,
                    clean_html(p.get('title', '').strip()),
                    clean_html(p.get('product_description', '').strip()),
                    rating, ratings_count, initial_price, discount_val,
                    final_price, p.get('currency', 'USD').strip(), sc_id,
                    json.dumps(delivery_opts) if delivery_opts else None,
                    json.dumps(product_details) if product_details else None,
                    what_said, seller
                )
            )

            # Parse github_images (comma-separated URLs)
            github_images = p.get('github_images', '').strip()
            if github_images:
                urls = [u.strip() for u in github_images.split(',') if u.strip()]
                for order, url in enumerate(urls):
                    images_batch.append((product_id, url, order))

            # Parse product_specifications (JSON array)
            specs = parse_json_safe(p.get('product_specifications', ''))
            if specs and isinstance(specs, list):
                for spec in specs:
                    if isinstance(spec, dict):
                        sn = clean_html(spec.get('specification_name', ''))
                        sv = clean_html(spec.get('specification_value', ''))
                        if sn:
                            specs_batch.append((product_id, sn, sv or None))

            # Parse sizes (JSON array)
            sizes = parse_json_safe(p.get('sizes', ''))
            if sizes and isinstance(sizes, list):
                for s in sizes:
                    if isinstance(s, dict) and s.get('size'):
                        sizes_batch.append((product_id, s['size']))

            # Parse more_offers (JSON array)
            offers = parse_json_safe(p.get('more_offers', ''))
            if offers and isinstance(offers, list):
                for o in offers:
                    if isinstance(o, dict) and o.get('offer_name'):
                        offers_batch.append((
                            product_id,
                            clean_html(o.get('offer_name', '')),
                            clean_html(o.get('offer_value', '')) or None
                        ))

            # Parse amount_of_stars (JSON object)
            stars = parse_json_safe(p.get('amount_of_stars', ''))
            if stars and isinstance(stars, dict):
                stars_batch.append((
                    product_id,
                    int(stars.get('1_star', 0) or 0),
                    int(stars.get('2_stars', 0) or 0),
                    int(stars.get('3_stars', 0) or 0),
                    int(stars.get('4_stars', 0) or 0),
                    int(stars.get('5_stars', 0) or 0)
                ))

            # Parse breadcrumbs (JSON array)
            bcs = parse_json_safe(p.get('breadcrumbs', ''))
            if bcs and isinstance(bcs, list):
                for order, bc in enumerate(bcs):
                    if isinstance(bc, dict) and bc.get('name'):
                        breadcrumbs_batch.append((
                            product_id, order,
                            clean_html(bc.get('name', '')),
                            bc.get('url', '') or None
                        ))

            # Commit every 100 products
            if (i + 1) % 100 == 0:
                conn.commit()
                print(f"[SEED]   ... {i + 1}/{len(products)} products inserted")

        conn.commit()
        print(f"[SEED] All {len(products)} products inserted.")

        # Batch insert related tables
        print(f"[SEED] Inserting {len(images_batch)} product images...")
        cursor.executemany(
            "INSERT INTO product_images (product_id, image_url, image_order) VALUES (%s, %s, %s)",
            images_batch
        )
        conn.commit()

        print(f"[SEED] Inserting {len(specs_batch)} product specifications...")
        cursor.executemany(
            "INSERT INTO product_specifications (product_id, spec_name, spec_value) VALUES (%s, %s, %s)",
            specs_batch
        )
        conn.commit()

        print(f"[SEED] Inserting {len(sizes_batch)} product sizes...")
        cursor.executemany(
            "INSERT INTO product_sizes (product_id, size) VALUES (%s, %s)",
            sizes_batch
        )
        conn.commit()

        print(f"[SEED] Inserting {len(offers_batch)} product offers...")
        cursor.executemany(
            "INSERT INTO product_offers (product_id, offer_name, offer_value) VALUES (%s, %s, %s)",
            offers_batch
        )
        conn.commit()

        print(f"[SEED] Inserting {len(stars_batch)} star ratings...")
        cursor.executemany(
            "INSERT INTO star_ratings (product_id, star_1, star_2, star_3, star_4, star_5) "
            "VALUES (%s, %s, %s, %s, %s, %s)",
            stars_batch
        )
        conn.commit()

        print(f"[SEED] Inserting {len(breadcrumbs_batch)} breadcrumbs...")
        cursor.executemany(
            "INSERT INTO breadcrumbs (product_id, breadcrumb_order, name, url) VALUES (%s, %s, %s, %s)",
            breadcrumbs_batch
        )
        conn.commit()

        print("[SEED] Product database seeding complete!")

    except Error as e:
        conn.rollback()
        print(f"[SEED] ERROR inserting into db_product: {e}")
        raise
    finally:
        cursor.close()
        conn.close()

    # -------------------------------------------------------------------------
    # Phase 4: Seed db_search.search_logs with sample data
    # -------------------------------------------------------------------------
    sample_searches = [
        'laptop', 'wireless headphones', 'running shoes', 'cotton shirt',
        'smartphone', 'bluetooth speaker', 'backpack', 'watch', 'sunglasses',
        'sneakers', 'jacket', 'tablet', 'camera', 'jeans', 'dress',
        'earbuds', 'charger', 'mouse', 'keyboard', 'monitor',
        'laptop bag', 'fitness tracker', 'water bottle', 'shoes',
        'phone case', 't-shirt', 'hoodie', 'wallet', 'belt', 'cap'
    ]
    print(f"[SEED] Inserting {len(sample_searches)} sample search log entries...")
    conn = get_connection('db_search')
    cursor = conn.cursor()
    try:
        search_batch = []
        now = datetime.now()
        for q in sample_searches:
            count = random.randint(1, 5)
            for _ in range(count):
                random_ts = now - timedelta(hours=random.randint(0, 23), minutes=random.randint(0, 59))
                search_batch.append((q, f'seed-session-{random.randint(1, 20)}', random.randint(0, 50), random_ts.strftime('%Y-%m-%d %H:%M:%S')))
        cursor.executemany(
            "INSERT INTO search_logs (query, session_id, results_count, created_at) "
            "VALUES (%s, %s, %s, %s)",
            search_batch
        )
        conn.commit()
        print(f"[SEED] Search log seeding complete! ({len(search_batch)} entries)")
    except Error as e:
        conn.rollback()
        print(f"[SEED] ERROR inserting into db_search: {e}")
        raise
    finally:
        cursor.close()
        conn.close()

    print("[SEED] ========================================")
    print("[SEED] DATABASE SEEDING COMPLETED SUCCESSFULLY")
    print("[SEED] ========================================")


if __name__ == '__main__':
    wait_for_mysql()
    if not is_already_seeded():
        seed_database()
    else:
        print("[SEED] Nothing to do. Exiting.")
