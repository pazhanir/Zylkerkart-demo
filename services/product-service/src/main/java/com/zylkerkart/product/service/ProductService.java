package com.zylkerkart.product.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.zylkerkart.product.dto.CategoryDTO;
import com.zylkerkart.product.dto.ProductDTO;
import com.zylkerkart.product.model.*;
import com.zylkerkart.product.repository.CategoryGroupRepository;
import com.zylkerkart.product.repository.ProductRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class ProductService {

    private static final Logger log = LoggerFactory.getLogger(ProductService.class);
    private static final String PRODUCT_CACHE_PREFIX = "product:";
    private static final Duration PRODUCT_CACHE_TTL = Duration.ofMinutes(10);

    @Autowired
    private ProductRepository productRepository;

    @Autowired
    private CategoryGroupRepository categoryGroupRepository;

    @Autowired
    private RedisTemplate<String, Object> redisTemplate;

    @Autowired
    private ObjectMapper objectMapper;

    /**
     * Get a single product by ID with Redis caching.
     * Check Redis first; if miss, fetch from DB and cache for 10 minutes.
     */
    @Transactional(readOnly = true)
    public ProductDTO getProduct(Long productId) {
        String cacheKey = PRODUCT_CACHE_PREFIX + productId;

        // Check Redis cache first
        try {
            Object cached = redisTemplate.opsForValue().get(cacheKey);
            if (cached != null) {
                log.info("Cache HIT for product: {}", productId);
                if (cached instanceof ProductDTO) {
                    return (ProductDTO) cached;
                }
                // Handle case where Redis returns a LinkedHashMap
                String json = objectMapper.writeValueAsString(cached);
                return objectMapper.readValue(json, ProductDTO.class);
            }
        } catch (Exception e) {
            log.warn("Redis cache read failed for product {}: {}", productId, e.getMessage());
        }

        log.info("Cache MISS for product: {}. Fetching from DB.", productId);

        // Fetch from database
        Optional<Product> optProduct = productRepository.findByProductId(productId);
        if (optProduct.isEmpty()) {
            return null;
        }

        ProductDTO dto = convertToDTO(optProduct.get());

        // Store in Redis cache
        try {
            redisTemplate.opsForValue().set(cacheKey, dto, PRODUCT_CACHE_TTL);
            log.info("Cached product {} in Redis (TTL: {} min)", productId, PRODUCT_CACHE_TTL.toMinutes());
        } catch (Exception e) {
            log.warn("Redis cache write failed for product {}: {}", productId, e.getMessage());
        }

        return dto;
    }

    /**
     * List products with pagination, optional category filter and search.
     */
    @Cacheable(value = "productList", key = "#category + '-' + #subcategory + '-' + #search + '-' + #page + '-' + #size + '-' + #sort")
    public Map<String, Object> listProducts(String category, String subcategory, String search,
                                             int page, int size, String sort) {
        Pageable pageable = createPageable(page, size, sort);
        Page<Product> productPage;

        if (search != null && !search.trim().isEmpty()) {
            productPage = productRepository.searchByKeyword(search.trim(), pageable);
        } else if (subcategory != null && !subcategory.trim().isEmpty()) {
            productPage = productRepository.findBySubcategoryName(subcategory.trim(), pageable);
        } else if (category != null && !category.trim().isEmpty()) {
            productPage = productRepository.findByCategoryGroupName(category.trim(), pageable);
        } else {
            productPage = productRepository.findAllWithCategory(pageable);
        }

        List<ProductDTO> dtos = productPage.getContent().stream()
                .map(this::convertToListDTO)
                .collect(Collectors.toList());

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("products", dtos);
        response.put("currentPage", productPage.getNumber());
        response.put("totalItems", productPage.getTotalElements());
        response.put("totalPages", productPage.getTotalPages());
        response.put("pageSize", productPage.getSize());

        return response;
    }

    /**
     * Get all categories with their subcategories.
     */
    @Cacheable(value = "categories")
    public List<CategoryDTO> getCategories() {
        List<CategoryGroup> groups = categoryGroupRepository.findAllWithSubcategories();

        return groups.stream().map(cg -> {
            CategoryDTO dto = new CategoryDTO();
            dto.setId(cg.getId());
            dto.setName(cg.getName());
            dto.setSubcategories(cg.getSubcategories().stream()
                    .map(sc -> new CategoryDTO.SubcategoryDTO(sc.getId(), sc.getName()))
                    .collect(Collectors.toList()));
            return dto;
        }).collect(Collectors.toList());
    }

    // =========================================================================
    // CHAOS ENGINEERING METHODS
    // =========================================================================

    /**
     * Chaos: N+1 Query Problem
     * Fetches all product IDs, then loops over each one executing individual queries.
     */
    public List<ProductDTO> getProductsInefficient() {
        log.warn("CHAOS: Executing N+1 query - this will be slow!");
        List<Long> ids = productRepository.findAllProductIds();
        List<ProductDTO> results = new ArrayList<>();

        // N+1 problem: one query per product!
        for (Long id : ids) {
            Optional<Product> product = productRepository.findById(id);
            product.ifPresent(p -> results.add(convertToListDTO(p)));
        }

        return results;
    }

    /**
     * Chaos: Slow Query (SELECT SLEEP)
     */
    public Map<String, Object> triggerSlowQuery() {
        log.warn("CHAOS: Executing SELECT SLEEP(5) - blocking DB connection!");
        long start = System.currentTimeMillis();
        productRepository.simulateSlowQuery(5);
        long elapsed = System.currentTimeMillis() - start;

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("chaos", "slow-query");
        result.put("query", "SELECT SLEEP(5)");
        result.put("elapsedMs", elapsed);
        result.put("message", "Blocked a DB connection for 5 seconds");
        return result;
    }

    /**
     * Chaos: Full Table Scan (Missing Index)
     */
    public Map<String, Object> triggerFullTableScan() {
        log.warn("CHAOS: Executing full table scan query!");
        long start = System.currentTimeMillis();
        List<Product> results = productRepository.searchBySellerNameFullScan("test");
        long elapsed = System.currentTimeMillis() - start;

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("chaos", "full-table-scan");
        result.put("elapsedMs", elapsed);
        result.put("rowsScanned", "all");
        result.put("resultsFound", results.size());
        result.put("message", "Forced a full table scan bypassing indexes");
        return result;
    }

    // Chaos flags
    private volatile boolean threadExhaustionActive = false;
    private volatile boolean payloadBloatActive = false;
    private volatile boolean zombieThreadsActive = false;
    private final List<Thread> zombieThreads = Collections.synchronizedList(new ArrayList<>());

    public boolean isThreadExhaustionActive() { return threadExhaustionActive; }
    public void setThreadExhaustionActive(boolean active) { this.threadExhaustionActive = active; }

    public boolean isPayloadBloatActive() { return payloadBloatActive; }
    public void setPayloadBloatActive(boolean active) { this.payloadBloatActive = active; }

    public boolean isZombieThreadsActive() { return zombieThreadsActive; }

    /**
     * Chaos: Thread Pool Exhaustion
     */
    public void triggerThreadExhaustion() {
        log.warn("CHAOS: Thread pool exhaustion - sleeping for 30s!");
        try {
            Thread.sleep(30000);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    /**
     * Chaos: Payload Bloat - returns ~50MB of duplicated product data
     */
    public Object triggerPayloadBloat() {
        log.warn("CHAOS: Generating massive payload response (~50MB)!");
        List<ProductDTO> products = new ArrayList<>();
        ProductDTO sample = getProduct(productRepository.findAllProductIds().get(0));
        if (sample != null) {
            for (int i = 0; i < 50000; i++) {
                products.add(sample);
            }
        }
        return products;
    }

    /**
     * Chaos: Charset Mismatch Query
     */
    public Map<String, Object> triggerCharsetMismatch() {
        log.warn("CHAOS: Executing charset mismatch query!");
        long start = System.currentTimeMillis();
        // This forces MySQL to do charset conversion on every row
        productRepository.searchBySellerNameFullScan("テスト");
        long elapsed = System.currentTimeMillis() - start;

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("chaos", "charset-mismatch");
        result.put("elapsedMs", elapsed);
        result.put("message", "Forced charset conversion on queries preventing index usage");
        return result;
    }

    /**
     * Chaos: Zombie Threads
     */
    public Map<String, Object> triggerZombieThreads() {
        log.warn("CHAOS: Spawning zombie threads!");
        zombieThreadsActive = true;

        for (int i = 0; i < 100; i++) {
            Thread t = new Thread(() -> {
                try {
                    synchronized (new Object()) {
                        while (zombieThreadsActive) {
                            Thread.sleep(Long.MAX_VALUE);
                        }
                    }
                } catch (InterruptedException e) {
                    // Thread interrupted, exit
                }
            }, "zombie-thread-" + i);
            t.setDaemon(true);
            t.start();
            zombieThreads.add(t);
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("chaos", "zombie-threads");
        result.put("threadsSpawned", 100);
        result.put("message", "Spawned 100 zombie daemon threads in infinite wait");
        return result;
    }

    public Map<String, Object> stopZombieThreads() {
        zombieThreadsActive = false;
        zombieThreads.forEach(Thread::interrupt);
        int count = zombieThreads.size();
        zombieThreads.clear();

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("chaos", "zombie-threads");
        result.put("threadsInterrupted", count);
        result.put("status", "stopped");
        return result;
    }

    /**
     * Get chaos simulation status
     */
    public Map<String, Object> getChaosStatus() {
        Map<String, Object> status = new LinkedHashMap<>();
        status.put("threadExhaustionActive", threadExhaustionActive);
        status.put("payloadBloatActive", payloadBloatActive);
        status.put("zombieThreadsActive", zombieThreadsActive);
        status.put("zombieThreadCount", zombieThreads.size());
        return status;
    }

    // =========================================================================
    // HELPER METHODS
    // =========================================================================

    private ProductDTO convertToDTO(Product p) {
        ProductDTO dto = new ProductDTO();
        dto.setProductId(p.getProductId());
        dto.setTitle(p.getTitle());
        dto.setProductDescription(p.getProductDescription());
        dto.setRating(p.getRating());
        dto.setRatingsCount(p.getRatingsCount());
        dto.setInitialPrice(p.getInitialPrice());
        dto.setDiscount(p.getDiscount());
        dto.setFinalPrice(p.getFinalPrice());
        dto.setCurrency(p.getCurrency());
        dto.setDeliveryOptions(p.getDeliveryOptions());
        dto.setProductDetails(p.getProductDetails());
        dto.setSellerName(p.getSellerName());
        dto.setWhatCustomersSaid(p.getWhatCustomersSaid());

        if (p.getSubcategory() != null) {
            dto.setSubcategory(p.getSubcategory().getName());
            if (p.getSubcategory().getCategoryGroup() != null) {
                dto.setCategoryGroup(p.getSubcategory().getCategoryGroup().getName());
            }
        }

        dto.setImages(p.getImages().stream()
                .map(ProductImage::getImageUrl)
                .collect(Collectors.toList()));

        dto.setSizes(p.getSizes().stream()
                .map(s -> new ProductDTO.SizeDTO(s.getSize()))
                .collect(Collectors.toList()));

        dto.setSpecifications(p.getSpecifications().stream()
                .map(s -> new ProductDTO.SpecDTO(s.getSpecName(), s.getSpecValue()))
                .collect(Collectors.toList()));

        dto.setOffers(p.getOffers().stream()
                .map(o -> new ProductDTO.OfferDTO(o.getOfferName(), o.getOfferValue()))
                .collect(Collectors.toList()));

        try {
            if (p.getStarRating() != null) {
                ProductDTO.StarRatingDTO srDto = new ProductDTO.StarRatingDTO();
                srDto.setStar1(p.getStarRating().getStar1() != null ? p.getStarRating().getStar1() : 0);
                srDto.setStar2(p.getStarRating().getStar2() != null ? p.getStarRating().getStar2() : 0);
                srDto.setStar3(p.getStarRating().getStar3() != null ? p.getStarRating().getStar3() : 0);
                srDto.setStar4(p.getStarRating().getStar4() != null ? p.getStarRating().getStar4() : 0);
                srDto.setStar5(p.getStarRating().getStar5() != null ? p.getStarRating().getStar5() : 0);
                dto.setStarRating(srDto);
            }
        } catch (jakarta.persistence.EntityNotFoundException e) {
            // StarRating record not found for this product - skip gracefully
            dto.setStarRating(null);
        }

        return dto;
    }

    private ProductDTO convertToListDTO(Product p) {
        ProductDTO dto = new ProductDTO();
        dto.setProductId(p.getProductId());
        dto.setTitle(p.getTitle());
        dto.setProductDescription(p.getProductDescription());
        dto.setRating(p.getRating());
        dto.setRatingsCount(p.getRatingsCount());
        dto.setInitialPrice(p.getInitialPrice());
        dto.setDiscount(p.getDiscount());
        dto.setFinalPrice(p.getFinalPrice());
        dto.setCurrency(p.getCurrency());

        if (p.getSubcategory() != null) {
            dto.setSubcategory(p.getSubcategory().getName());
            if (p.getSubcategory().getCategoryGroup() != null) {
                dto.setCategoryGroup(p.getSubcategory().getCategoryGroup().getName());
            }
        }

        // Only first image for list view
        if (p.getImages() != null && !p.getImages().isEmpty()) {
            dto.setImages(List.of(p.getImages().get(0).getImageUrl()));
        } else {
            dto.setImages(List.of());
        }

        if (p.getSizes() != null) {
            dto.setSizes(p.getSizes().stream()
                    .map(s -> new ProductDTO.SizeDTO(s.getSize()))
                    .collect(Collectors.toList()));
        }

        return dto;
    }

    private Pageable createPageable(int page, int size, String sort) {
        Sort sortOrder = Sort.unsorted();
        if (sort != null) {
            switch (sort) {
                case "price_asc":
                    sortOrder = Sort.by("initialPrice").ascending();
                    break;
                case "price_desc":
                    sortOrder = Sort.by("initialPrice").descending();
                    break;
                case "rating":
                    sortOrder = Sort.by("rating").descending();
                    break;
                case "newest":
                    sortOrder = Sort.by("createdAt").descending();
                    break;
                case "discount":
                    sortOrder = Sort.by("discount").descending();
                    break;
            }
        }
        return PageRequest.of(page, size, sortOrder);
    }
}
