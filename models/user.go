package models

import (
	"encoding/json"
	"errors"
	"os"
	"time"

	"mediastream/utils"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
)

// User represents a user in the system
type User struct {
	ID       string    `json:"id"`
	Username string    `json:"username"`
	Password string    `json:"password"`
	IsAdmin  bool      `json:"isAdmin"`
	Created  time.Time `json:"created"`
}

// UserResponse is a safe representation of a user for API responses
type UserResponse struct {
	ID       string    `json:"id"`
	Username string    `json:"username"`
	IsAdmin  bool      `json:"isAdmin"`
	Created  time.Time `json:"created,omitempty"`
}

// ToResponse converts a User to a UserResponse (removing sensitive data)
func (u *User) ToResponse() UserResponse {
	return UserResponse{
		ID:       u.ID,
		Username: u.Username,
		IsAdmin:  u.IsAdmin,
		Created:  u.Created,
	}
}

// GetUserFromContext gets the user from the Gin context
func GetUserFromContext(c *gin.Context) (*User, bool) {
	user, exists := c.Get("user")
	if !exists {
		return nil, false
	}

	u, ok := user.(*User)
	return u, ok
}

// LoadUsers loads users from the users file
func LoadUsers(filename string) ([]User, error) {
	var users []User

	if _, err := os.Stat(filename); os.IsNotExist(err) {
		// If file doesn't exist, return empty array
		return users, nil
	}

	data, err := os.ReadFile(filename)
	if err != nil {
		return nil, err
	}

	err = json.Unmarshal(data, &users)
	if err != nil {
		return nil, err
	}

	return users, nil
}

// SaveUsers saves users to the users file
func SaveUsers(users []User, filename string) error {
	data, err := json.MarshalIndent(users, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile(filename, data, 0644)
}

// FindUserByUsername finds a user by username
func FindUserByUsername(users []User, username string) *User {
	for i := range users {
		if users[i].Username == username {
			return &users[i]
		}
	}
	return nil
}

// FindUserByID finds a user by ID
func FindUserByID(users []User, id string) *User {
	for i := range users {
		if users[i].ID == id {
			return &users[i]
		}
	}
	return nil
}

// CreateUser creates a new user
func CreateUser(users []User, username, password string, isAdmin bool) (*User, error) {
	// Check if user already exists
	if FindUserByUsername(users, username) != nil {
		return nil, errors.New("user already exists")
	}

	// Hash password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}

	// Create new user
	user := User{
		ID:       utils.GenerateUniqueID(),
		Username: username,
		Password: string(hashedPassword),
		IsAdmin:  isAdmin,
		Created:  time.Now(),
	}

	return &user, nil
}

// ValidateCredentials validates a username and password against a user
func ValidateCredentials(user *User, password string) bool {
	err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(password))
	return err == nil
}
