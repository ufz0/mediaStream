package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/gin-contrib/sessions"
	"github.com/gin-contrib/sessions/cookie"
	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"

	"mediastream/config"
	"mediastream/models"
	"mediastream/routes"
	"mediastream/utils"
)

func main() {
	// Check for dev mode
	devMode := os.Getenv("MEDIASTREAM_ENV") == "development"

	// Also check command line arguments for "dev"
	for _, arg := range os.Args[1:] {
		if arg == "dev" {
			devMode = true
			break
		}
	}

	// Set Gin mode based on dev flag
	if devMode {
		gin.SetMode(gin.DebugMode)
		log.Println("Running in development mode (debug)")
	} else {
		gin.SetMode(gin.ReleaseMode)
		log.Println("Running in release mode")
	}

	// Create default config
	cfg, err := config.LoadConfig(config.ConfigFile)
	if err != nil {
		log.Fatalf("Error loading configuration: %v", err)
	}

	// Create media directories if they don't exist
	// But skip creation if paths are likely external (Docker volumes, network shares, etc.)
	for _, folder := range cfg.MediaFolders {
		// Check if this is a Docker volume or external path that shouldn't be created locally
		isExternal := strings.HasPrefix(folder.Path, "/mnt/") ||
			strings.HasPrefix(folder.Path, "/media/") ||
			strings.HasPrefix(folder.Path, "/volume") ||
			strings.HasPrefix(folder.Path, "/data/")

		if isExternal {
			// Skip directory creation for external paths
			log.Printf("External media path detected, skipping directory creation: %s", folder.Path)
			continue
		}

		if _, err := os.Stat(folder.Path); os.IsNotExist(err) {
			err = os.MkdirAll(folder.Path, 0755)
			if err != nil {
				log.Printf("Failed to create media directory: %s: %v", folder.Path, err)
			}
		}
	}

	// Development mode handling
	if devMode {
		// Load existing users or create empty user array
		users, err := models.LoadUsers(config.UsersFile)
		if err != nil {
			log.Printf("Error loading users: %v", err)
			users = []models.User{}
		}

		// Check if dev user already exists
		if models.FindUserByUsername(users, "dev") == nil {
			// Hash password
			hashedPassword, err := bcrypt.GenerateFromPassword([]byte("dev"), bcrypt.DefaultCost)
			if err != nil {
				log.Printf("Error creating dev user: %v", err)
			} else {
				// Create dev user
				users = append(users, models.User{
					ID:       utils.GenerateUniqueID(),
					Username: "dev",
					Password: string(hashedPassword),
					IsAdmin:  true,
				})

				// Save users to file
				if err := models.SaveUsers(users, config.UsersFile); err != nil {
					log.Printf("Error saving dev user: %v", err)
				}

				// Mark setup as completed
				if err := config.MarkSetupCompleted(); err != nil {
					log.Printf("Error marking setup as completed: %v", err)
				}

				log.Println("Created development user: username=dev, password=dev (admin)")
			}
		}
	}

	// Create Gin router
	router := gin.Default()

	// Setup sessions
	store := cookie.NewStore([]byte("media-stream-secret"))
	store.Options(sessions.Options{
		Path:     "/",
		MaxAge:   86400, // 1 day
		HttpOnly: true,
	})
	router.Use(sessions.Sessions("mediastream", store))

	// Setup static file server
	router.Static("/static", "./public")
	router.StaticFile("/style.css", "./public/style.css")

	// Setup middleware for routes that need authentication
	authMiddleware := routes.EnsureAuthenticated(cfg)
	adminMiddleware := routes.EnsureAdmin()
	setupMiddleware := routes.CheckSetup()

	// Root route
	router.GET("/", authMiddleware, func(c *gin.Context) {
		c.File(filepath.Join("public", "index.html"))
	})

	// Setup route
	router.GET("/setup", func(c *gin.Context) {
		if config.IsSetupCompleted() {
			c.Redirect(http.StatusFound, "/")
			return
		}
		c.File(filepath.Join("public", "setup.html"))
	})
	router.POST("/api/setup", routes.HandleSetup)

	// Auth routes
	router.GET("/login", setupMiddleware, func(c *gin.Context) {
		if c.Request.URL.Query().Get("error") == "1" {
			c.File(filepath.Join("public", "login.html"))
			return
		}
		c.File(filepath.Join("public", "login.html"))
	})
	router.POST("/login", routes.HandleLogin)
	router.GET("/logout", routes.HandleLogout)

	// Admin routes
	adminGroup := router.Group("/api/admin")
	adminGroup.Use(authMiddleware, adminMiddleware)
	{
		adminGroup.GET("/users", routes.HandleGetUsers)
		adminGroup.POST("/users", routes.HandleCreateUser)
		adminGroup.DELETE("/users/:id", routes.HandleDeleteUser)
	}

	// Media library routes
	router.GET("/api/libraries", authMiddleware, func(c *gin.Context) {
		routes.HandleGetLibraries(c, cfg)
	})
	router.GET("/api/library/:type", authMiddleware, func(c *gin.Context) {
		routes.HandleGetLibrary(c, cfg)
	})
	router.GET("/api/media/:id", authMiddleware, func(c *gin.Context) {
		routes.HandleGetMediaItem(c, cfg)
	})
	router.GET("/api/search", authMiddleware, func(c *gin.Context) {
		routes.HandleSearch(c, cfg)
	})

	// Debug endpoint to check media scanning
	router.GET("/api/debug/scan", authMiddleware, func(c *gin.Context) {
		var debugInfo []gin.H

		for _, folder := range cfg.MediaFolders {
			entries, err := os.ReadDir(folder.Path)

			entryList := []string{}
			if err == nil {
				for _, entry := range entries {
					entryList = append(entryList, entry.Name())
				}
			}

			items, _ := models.ScanDirectory(folder.Path, folder.Type, cfg)

			debugInfo = append(debugInfo, gin.H{
				"type":      folder.Type,
				"path":      folder.Path,
				"entries":   entryList,
				"itemCount": len(items),
				"items":     items,
				"error":     err != nil,
			})
		}

		c.JSON(http.StatusOK, debugInfo)
	})

	// Media streaming routes - using different URL patterns to avoid conflicts
	router.GET("/stream/file/:type/:filename", authMiddleware, func(c *gin.Context) {
		routes.HandleStreamMedia(c, cfg)
	})
	router.GET("/stream/movie/:type/:folder/:filename", authMiddleware, func(c *gin.Context) {
		routes.HandleStreamMediaWithFolder(c, cfg)
	})

	router.GET("/script.js", authMiddleware, func(c *gin.Context) {
		c.File("public/script.js")
	})

	// Start server
	port := 3000
	log.Printf("Media server running at http://localhost:%d", port)
	log.Println("Media directories:")
	for _, folder := range cfg.MediaFolders {
		log.Printf("- %s: %s", folder.Type, folder.Path)
	}

	if err := router.Run(fmt.Sprintf(":%d", port)); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
