package routes

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"mediastream/config"
	"mediastream/models"
)

// HandleGetUsers returns all users (for admin)
func HandleGetUsers(c *gin.Context) {
	// Load users from file
	users, err := models.LoadUsers(config.UsersFile)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load users"})
		return
	}

	// Convert users to safe responses (no passwords)
	safeUsers := make([]models.UserResponse, len(users))
	for i, user := range users {
		safeUsers[i] = user.ToResponse()
	}

	c.JSON(http.StatusOK, safeUsers)
}

// HandleCreateUser creates a new user (admin only)
func HandleCreateUser(c *gin.Context) {
	var form struct {
		Username string `json:"username" binding:"required"`
		Password string `json:"password" binding:"required"`
		IsAdmin  bool   `json:"isAdmin"`
	}

	if err := c.ShouldBindJSON(&form); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Basic validation
	if form.Username == "" || form.Password == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Username and password are required"})
		return
	}

	// Load existing users
	users, err := models.LoadUsers(config.UsersFile)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load users"})
		return
	}

	// Check if username already exists
	if models.FindUserByUsername(users, form.Username) != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Username already exists"})
		return
	}

	// Create new user
	user, err := models.CreateUser(users, form.Username, form.Password, form.IsAdmin)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Add to users list
	users = append(users, *user)

	// Save users to file
	err = models.SaveUsers(users, config.UsersFile)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save users"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"message": "User created successfully"})
}

// HandleDeleteUser deletes a user (admin only)
func HandleDeleteUser(c *gin.Context) {
	userID := c.Param("id")

	// Get current user from context
	currentUser, exists := models.GetUserFromContext(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	// Don't allow the admin to delete themselves
	if userID == currentUser.ID {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot delete your own account"})
		return
	}

	// Load existing users
	users, err := models.LoadUsers(config.UsersFile)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load users"})
		return
	}

	// Find user to delete
	var updatedUsers []models.User
	found := false

	for _, user := range users {
		if user.ID == userID {
			found = true
			continue
		}
		updatedUsers = append(updatedUsers, user)
	}

	if !found {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	// Save updated users list
	err = models.SaveUsers(updatedUsers, config.UsersFile)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save users"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "User deleted successfully"})
}
