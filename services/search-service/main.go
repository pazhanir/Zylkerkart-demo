package main

import (
	"fmt"
	"log"
	"os"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"

	"zylkerkart/search-service/config"
	"zylkerkart/search-service/handlers"
)

func main() {
	// Initialize database and Redis
	config.InitDB()
	defer config.DB.Close()
	config.InitRedis()

	// Set Gin mode
	if os.Getenv("GIN_MODE") == "release" {
		gin.SetMode(gin.ReleaseMode)
	}

	r := gin.Default()

	// CORS
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"*"},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		AllowCredentials: true,
	}))

	// ─── Health Check ───────────────────────────────────────
	r.GET("/health", func(c *gin.Context) {
		dbStatus := "UP"
		if err := config.DB.Ping(); err != nil {
			dbStatus = "DOWN"
		}
		redisStatus := "UP"
		if err := config.RDB.Ping(c.Request.Context()).Err(); err != nil {
			redisStatus = "DOWN"
		}
		status := "UP"
		if dbStatus == "DOWN" || redisStatus == "DOWN" {
			status = "DEGRADED"
		}
		statusCode := 200
		if status != "UP" {
			statusCode = 503
		}
		c.JSON(statusCode, gin.H{
			"service": "search-service",
			"status":  status,
			"checks": gin.H{
				"mysql": gin.H{"status": dbStatus},
				"redis": gin.H{"status": redisStatus},
			},
		})
	})

	// ─── Search Routes ──────────────────────────────────────
	search := r.Group("/search")
	{
		search.GET("/suggestions", handlers.GetSuggestions)
		search.GET("/trending", handlers.GetTrending)
		search.GET("/recent", handlers.GetRecentSearches)
		search.POST("/log", handlers.LogSearch)
	}

	// ─── Chaos Simulation Routes ────────────────────────────
	simulate := r.Group("/simulate")
	{
		simulate.POST("/deadlock", handlers.SimulateDeadlock)
		simulate.POST("/lock-timeout", handlers.SimulateLockTimeout)
		simulate.POST("/temp-tables", handlers.SimulateTempTables)
		simulate.POST("/fd-exhaust", handlers.SimulateFDExhaustion)
		simulate.POST("/fd-exhaust/stop", handlers.StopFDExhaustion)
		simulate.POST("/goroutine-leak", handlers.SimulateGoroutineLeak)
		simulate.POST("/goroutine-leak/stop", handlers.StopGoroutineLeak)
		simulate.GET("/status", handlers.GetChaosStatus)
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8083"
	}

	log.Printf("🔍 Search Service running on port %s", port)
	log.Printf("   MySQL: %s:%s/%s",
		config.GetEnv("DB_HOST", "mysql"),
		config.GetEnv("DB_PORT", "3306"),
		config.GetEnv("DB_NAME", "db_search"))
	log.Printf("   Redis: %s:%s",
		config.GetEnv("REDIS_HOST", "redis"),
		config.GetEnv("REDIS_PORT", "6379"))

	if err := r.Run(fmt.Sprintf(":%s", port)); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
