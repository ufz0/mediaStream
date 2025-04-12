package routes

import (
	"fmt"
	"net/http"
	"strings"

	"github.com/gin-contrib/sessions"
	"github.com/gin-gonic/gin"

	"mediastream/config"
	"mediastream/models"
)

// Middleware to check if user is authenticated
func EnsureAuthenticated(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Skip middleware for static files, login and setup routes
		if strings.HasPrefix(c.Request.URL.Path, "/static") ||
			c.Request.URL.Path == "/api/setup" ||
			c.Request.URL.Path == "/setup.html" ||
			c.Request.URL.Path == "/style.css" {
			c.Next()
			return
		}

		// If setup is not complete, redirect to setup page
		if !config.IsSetupCompleted() && c.Request.URL.Path != "/setup" {
			c.Redirect(http.StatusFound, "/setup")
			c.Abort()
			return
		}

		// Check if user is authenticated
		session := sessions.Default(c)
		userID := session.Get("userID")
		if userID == nil {
			c.Redirect(http.StatusFound, "/login")
			c.Abort()
			return
		}

		// Load users and find the authenticated user
		users, err := models.LoadUsers(config.UsersFile)
		if err != nil {
			fmt.Printf("Error loading users in middleware: %v\n", err)
			c.Redirect(http.StatusFound, "/login")
			c.Abort()
			return
		}

		user := models.FindUserByID(users, userID.(string))
		if user == nil {
			// Invalid user ID in session
			session.Delete("userID")
			session.Save()
			c.Redirect(http.StatusFound, "/login")
			c.Abort()
			return
		}

		// Store user in context
		c.Set("user", user)
		c.Next()
	}
}

// Middleware to check if user is an admin
func EnsureAdmin() gin.HandlerFunc {
	return func(c *gin.Context) {
		user, exists := models.GetUserFromContext(c)
		if !exists || !user.IsAdmin {
			c.JSON(http.StatusForbidden, gin.H{"error": "Admin access required"})
			c.Abort()
			return
		}
		c.Next()
	}
}

// Middleware to check if setup is needed
func CheckSetup() gin.HandlerFunc {
	return func(c *gin.Context) {
		if !config.IsSetupCompleted() {
			c.Redirect(http.StatusFound, "/setup")
			c.Abort()
			return
		}
		c.Next()
	}
}
