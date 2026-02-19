package handlers

import (
	"fmt"
	"net/http"
	"os"
	"runtime"
	"sync"
	"time"

	"zylkerkart/search-service/config"

	"github.com/gin-gonic/gin"
)

var (
	leakedGoroutines []chan struct{}
	goroutineMu      sync.Mutex
	openedFiles      []*os.File
	fileMu           sync.Mutex
)

// SimulateDeadlock creates a MySQL deadlock scenario
func SimulateDeadlock(c *gin.Context) {
	var wg sync.WaitGroup
	errChan := make(chan error, 2)

	wg.Add(2)

	go func() {
		defer wg.Done()
		tx, err := config.DB.Begin()
		if err != nil {
			errChan <- err
			return
		}
		defer tx.Rollback()

		tx.Exec("INSERT INTO search_logs (query, session_id, results_count) VALUES ('deadlock_test_a', 'chaos', 0)")
		time.Sleep(100 * time.Millisecond)
		tx.Exec("INSERT INTO search_logs (query, session_id, results_count) VALUES ('deadlock_test_b', 'chaos', 0)")
		tx.Commit()
	}()

	go func() {
		defer wg.Done()
		tx, err := config.DB.Begin()
		if err != nil {
			errChan <- err
			return
		}
		defer tx.Rollback()

		tx.Exec("INSERT INTO search_logs (query, session_id, results_count) VALUES ('deadlock_test_b', 'chaos', 0)")
		time.Sleep(100 * time.Millisecond)
		tx.Exec("INSERT INTO search_logs (query, session_id, results_count) VALUES ('deadlock_test_a', 'chaos', 0)")
		tx.Commit()
	}()

	wg.Wait()
	close(errChan)

	c.JSON(http.StatusOK, gin.H{
		"status":  "Deadlock simulation completed",
		"service": "search-service",
	})
}

// SimulateLockTimeout creates a lock timeout scenario
func SimulateLockTimeout(c *gin.Context) {
	tx1, err := config.DB.Begin()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	tx1.Exec("SET innodb_lock_wait_timeout = 3")
	tx1.Exec("SELECT * FROM search_logs WHERE id = 1 FOR UPDATE")

	go func() {
		defer tx1.Rollback()
		time.Sleep(5 * time.Second)
	}()

	tx2, err := config.DB.Begin()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	tx2.Exec("SET innodb_lock_wait_timeout = 3")
	_, err = tx2.Exec("SELECT * FROM search_logs WHERE id = 1 FOR UPDATE")
	tx2.Rollback()

	errMsg := "No timeout occurred"
	if err != nil {
		errMsg = err.Error()
	}

	c.JSON(http.StatusOK, gin.H{
		"status":  "Lock timeout simulation completed",
		"error":   errMsg,
		"service": "search-service",
	})
}

// SimulateTempTables creates excessive temporary tables
func SimulateTempTables(c *gin.Context) {
	for i := 0; i < 50; i++ {
		tableName := fmt.Sprintf("tmp_chaos_%d", i)
		config.DB.Exec(fmt.Sprintf("CREATE TEMPORARY TABLE IF NOT EXISTS %s (id INT, data TEXT)", tableName))
		config.DB.Exec(fmt.Sprintf("INSERT INTO %s SELECT id, query FROM search_logs LIMIT 100", tableName))
	}

	c.JSON(http.StatusOK, gin.H{
		"status":       "Temporary tables simulation completed",
		"tables_count": 50,
		"service":      "search-service",
	})
}

// SimulateFDExhaustion opens many file descriptors
func SimulateFDExhaustion(c *gin.Context) {
	fileMu.Lock()
	defer fileMu.Unlock()

	count := 0
	for i := 0; i < 500; i++ {
		f, err := os.CreateTemp("", "chaos-fd-*")
		if err != nil {
			break
		}
		openedFiles = append(openedFiles, f)
		count++
	}

	c.JSON(http.StatusOK, gin.H{
		"status":     "FD exhaustion simulation started",
		"files_open": count,
		"service":    "search-service",
	})
}

// StopFDExhaustion closes all leaked file descriptors
func StopFDExhaustion(c *gin.Context) {
	fileMu.Lock()
	defer fileMu.Unlock()

	count := len(openedFiles)
	for _, f := range openedFiles {
		name := f.Name()
		f.Close()
		os.Remove(name)
	}
	openedFiles = nil

	c.JSON(http.StatusOK, gin.H{
		"status":       "FD exhaustion stopped",
		"files_closed": count,
		"service":      "search-service",
	})
}

// SimulateGoroutineLeak creates goroutines that never exit
func SimulateGoroutineLeak(c *gin.Context) {
	goroutineMu.Lock()
	defer goroutineMu.Unlock()

	before := runtime.NumGoroutine()

	for i := 0; i < 100; i++ {
		ch := make(chan struct{})
		leakedGoroutines = append(leakedGoroutines, ch)
		go func() {
			<-ch // Block forever until channel is closed
		}()
	}

	after := runtime.NumGoroutine()

	c.JSON(http.StatusOK, gin.H{
		"status":            "Goroutine leak simulation started",
		"goroutines_before": before,
		"goroutines_after":  after,
		"leaked":            100,
		"service":           "search-service",
	})
}

// StopGoroutineLeak closes all leaked goroutines
func StopGoroutineLeak(c *gin.Context) {
	goroutineMu.Lock()
	defer goroutineMu.Unlock()

	count := len(leakedGoroutines)
	for _, ch := range leakedGoroutines {
		close(ch)
	}
	leakedGoroutines = nil

	time.Sleep(100 * time.Millisecond)

	c.JSON(http.StatusOK, gin.H{
		"status":             "Goroutine leak stopped",
		"goroutines_stopped": count,
		"goroutines_current": runtime.NumGoroutine(),
		"service":            "search-service",
	})
}

// GetChaosStatus returns current chaos state
func GetChaosStatus(c *gin.Context) {
	goroutineMu.Lock()
	leakedCount := len(leakedGoroutines)
	goroutineMu.Unlock()

	fileMu.Lock()
	openCount := len(openedFiles)
	fileMu.Unlock()

	c.JSON(http.StatusOK, gin.H{
		"service":           "search-service",
		"goroutines_total":  runtime.NumGoroutine(),
		"goroutines_leaked": leakedCount,
		"files_open":        openCount,
		"mysql_connected":   config.DB.Ping() == nil,
		"redis_connected":   config.RDB.Ping(c.Request.Context()).Err() == nil,
	})
}
