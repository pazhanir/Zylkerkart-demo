package config

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"os"
	"strconv"
	"time"

	_ "github.com/go-sql-driver/mysql"
	"github.com/redis/go-redis/v9"
)

var DB *sql.DB
var RDB *redis.Client

// GetEnv retrieves an environment variable or returns a default value
func GetEnv(key, defaultVal string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return defaultVal
}

func getEnvInt(key string, defaultVal int) int {
	if val := os.Getenv(key); val != "" {
		if i, err := strconv.Atoi(val); err == nil {
			return i
		}
	}
	return defaultVal
}

// InitDB initializes the MySQL connection pool
func InitDB() {
	host := GetEnv("DB_HOST", "mysql")
	port := GetEnv("DB_PORT", "3306")
	user := GetEnv("DB_USER", "root")
	pass := GetEnv("DB_PASSWORD", "ZylkerKart@2024")
	dbName := GetEnv("DB_NAME", "db_search")

	dsn := fmt.Sprintf("%s:%s@tcp(%s:%s)/%s?parseTime=true&charset=utf8mb4&collation=utf8mb4_unicode_ci",
		user, pass, host, port, dbName)

	var err error
	DB, err = sql.Open("mysql", dsn)
	if err != nil {
		log.Fatalf("Failed to open database: %v", err)
	}

	// Connection pool settings
	DB.SetMaxOpenConns(getEnvInt("DB_MAX_OPEN_CONNS", 15))
	DB.SetMaxIdleConns(getEnvInt("DB_MAX_IDLE_CONNS", 5))
	DB.SetConnMaxLifetime(5 * time.Minute)
	DB.SetConnMaxIdleTime(3 * time.Minute)

	// Retry connection
	for i := 0; i < 30; i++ {
		if err = DB.Ping(); err == nil {
			log.Printf("Connected to MySQL (%s:%s/%s)", host, port, dbName)
			return
		}
		log.Printf("Waiting for MySQL... attempt %d/30: %v", i+1, err)
		time.Sleep(2 * time.Second)
	}
	log.Fatalf("Could not connect to MySQL after 30 attempts: %v", err)
}

// InitRedis initializes the Redis connection
func InitRedis() {
	host := GetEnv("REDIS_HOST", "redis")
	port := GetEnv("REDIS_PORT", "6379")

	RDB = redis.NewClient(&redis.Options{
		Addr:         fmt.Sprintf("%s:%s", host, port),
		Password:     "",
		DB:           0,
		PoolSize:     10,
		MinIdleConns: 3,
		DialTimeout:  5 * time.Second,
		ReadTimeout:  3 * time.Second,
		WriteTimeout: 3 * time.Second,
	})

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	for i := 0; i < 10; i++ {
		if err := RDB.Ping(ctx).Err(); err == nil {
			log.Printf("Connected to Redis (%s:%s)", host, port)
			return
		}
		log.Printf("Waiting for Redis... attempt %d/10", i+1)
		time.Sleep(2 * time.Second)
	}
	log.Println("Warning: Redis not available — search service will run without caching")
}
