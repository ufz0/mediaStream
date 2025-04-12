package routes

import (
	"net/http"
	"os"
	"path/filepath"

	"github.com/gin-contrib/sessions"
	"github.com/gin-gonic/gin"

	"mediastream/config"
	"mediastream/models"
)

// HandleLogin handles user login
func HandleLogin(c *gin.Context) {
	if c.Request.Method == "GET" {
		// Serve login page
		c.File(filepath.Join("public", "login.html"))
		return
	}

	// Process login form
	username := c.PostForm("username")
	password := c.PostForm("password")

	// Load users from file
	users, err := models.LoadUsers(config.UsersFile)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load users"})
		return
	}

	// Find user by username
	user := models.FindUserByUsername(users, username)
	if user == nil {
		c.Redirect(http.StatusFound, "/login?error=1")
		return
	}

	// Check password
	if !models.ValidateCredentials(user, password) {
		c.Redirect(http.StatusFound, "/login?error=1")
		return
	}

	// Set user in session
	session := sessions.Default(c)
	session.Set("userID", user.ID)
	session.Save()

	c.Redirect(http.StatusFound, "/")
}

// HandleLogout logs out a user
func HandleLogout(c *gin.Context) {
	session := sessions.Default(c)
	session.Delete("userID")
	session.Save()
	c.Redirect(http.StatusFound, "/login")
}

// HandleSetup handles the initial setup
func HandleSetup(c *gin.Context) {
	if c.Request.Method == "GET" {
		// If setup is already completed, redirect to home
		if config.IsSetupCompleted() {
			c.Redirect(http.StatusFound, "/")
			return
		}

		// Serve setup page
		c.File(filepath.Join("public", "setup.html"))
		return
	}

	// Process setup form
	var setupForm struct {
		Username     string `json:"username" binding:"required"`
		Password     string `json:"password" binding:"required"`
		MediaFolders struct {
			Movies  string `json:"movies"`
			TVShows string `json:"tvshows"`
			Music   string `json:"music"`
		} `json:"mediaFolders"`
	}

	if err := c.ShouldBindJSON(&setupForm); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Validate input
	if len(setupForm.Username) < 3 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Username must be at least 3 characters"})
		return
	}

	if len(setupForm.Password) < 8 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Password must be at least 8 characters"})
		return
	}

	// Create admin user
	users := []models.User{}
	user, err := models.CreateUser(users, setupForm.Username, setupForm.Password, true)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	users = append(users, *user)

	// Save users to file
	err = models.SaveUsers(users, config.UsersFile)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save user"})
		return
	}

	// Create default config
	cfg := config.DefaultConfig()

	// Update config with custom media folders if provided
	if setupForm.MediaFolders.Movies != "" {
		cfg.MediaFolders[0].Path = setupForm.MediaFolders.Movies
	}

	if setupForm.MediaFolders.TVShows != "" {
		cfg.MediaFolders[1].Path = setupForm.MediaFolders.TVShows
	}

	if setupForm.MediaFolders.Music != "" {
		cfg.MediaFolders[2].Path = setupForm.MediaFolders.Music
	}

	// Create media directories if they don't exist
	for _, folder := range cfg.MediaFolders {
		if _, err := os.Stat(folder.Path); os.IsNotExist(err) {
			err = os.MkdirAll(folder.Path, 0755)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create media directory: " + folder.Path})
				return
			}
		}
	}

	// Save config
	err = config.SaveConfig(cfg, config.ConfigFile)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save configuration"})
		return
	}

	// Mark setup as completed
	err = config.MarkSetupCompleted()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to mark setup as completed"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}
