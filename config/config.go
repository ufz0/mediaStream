package config

import (
	"encoding/json"
	"os"
	"path/filepath"
)

// Config holds the application configuration
type Config struct {
	MediaFolders        []MediaFolder       `json:"mediaFolders"`
	SupportedExtensions map[string][]string `json:"supportedExtensions"`
}

// MediaFolder represents a media library folder
type MediaFolder struct {
	Path string `json:"path"`
	Type string `json:"type"`
}

// DefaultConfig returns a new default configuration
func DefaultConfig() *Config {
	// Get current working directory instead of hardcoded path
	projectDir, err := os.Getwd()
	if err != nil {
		// Fallback to relative path if getting working directory fails
		projectDir = "."
	}

	return &Config{
		MediaFolders: []MediaFolder{
			{Path: filepath.Join(projectDir, "media/movies"), Type: "movies"},
			{Path: filepath.Join(projectDir, "media/tvshows"), Type: "tvshows"},
			{Path: filepath.Join(projectDir, "media/music"), Type: "music"},
		},
		SupportedExtensions: map[string][]string{
			"video": {".mp4", ".mkv", ".avi", ".mov", ".webm"},
			"audio": {".mp3", ".wav", ".flac", ".ogg", ".aac"},
			"image": {".jpg", ".jpeg", ".png", ".gif", ".webp"},
		},
	}
}

// LoadConfig loads configuration from a file
func LoadConfig(filename string) (*Config, error) {
	if _, err := os.Stat(filename); os.IsNotExist(err) {
		// If config file doesn't exist, return default config
		return DefaultConfig(), nil
	}

	data, err := os.ReadFile(filename)
	if err != nil {
		return nil, err
	}

	// Create a fresh config without default paths
	config := &Config{
		SupportedExtensions: map[string][]string{
			"video": {".mp4", ".mkv", ".avi", ".mov", ".webm"},
			"audio": {".mp3", ".wav", ".flac", ".ogg", ".aac"},
			"image": {".jpg", ".jpeg", ".png", ".gif", ".webp"},
		},
	}

	// Unmarshal directly to the empty config
	err = json.Unmarshal(data, config)
	if err != nil {
		return nil, err
	}

	// If media folders are not defined in config file, use defaults
	if len(config.MediaFolders) == 0 {
		defaultConfig := DefaultConfig()
		config.MediaFolders = defaultConfig.MediaFolders
	}

	return config, nil
}

// SaveConfig saves configuration to a file
func SaveConfig(config *Config, filename string) error {
	data, err := json.MarshalIndent(config, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile(filename, data, 0644)
}

// Constants
const (
	SetupFlagFile = "setup-completed"
	UsersFile     = "users.json"
	ConfigFile    = "config.json"
)

// IsSetupCompleted checks if setup has been completed
func IsSetupCompleted() bool {
	_, err := os.Stat(SetupFlagFile)
	return err == nil
}

// MarkSetupCompleted marks the setup as completed
func MarkSetupCompleted() error {
	return os.WriteFile(SetupFlagFile, []byte(""), 0644)
}
