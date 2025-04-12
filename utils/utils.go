package utils

import (
	"crypto/rand"
	"encoding/hex"
	"path/filepath"
	"strings"
)

// GenerateUniqueID generates a unique ID using crypto/rand
func GenerateUniqueID() string {
	b := make([]byte, 16)
	_, err := rand.Read(b)
	if err != nil {
		return "error"
	}
	return hex.EncodeToString(b)
}

// GetTitle extracts a title from a filename
func GetTitle(filename string) string {
	// Remove extension and replace underscores, dots, and hyphens with spaces
	name := strings.TrimSuffix(filepath.Base(filename), filepath.Ext(filename))
	return strings.ReplaceAll(strings.ReplaceAll(strings.ReplaceAll(name, "_", " "), ".", " "), "-", " ")
}

// GetContentType returns the content type based on file extension
func GetContentType(filename string) string {
	ext := strings.ToLower(filepath.Ext(filename))

	contentTypes := map[string]string{
		".mp4":  "video/mp4",
		".mkv":  "video/x-matroska",
		".avi":  "video/x-msvideo",
		".mov":  "video/quicktime",
		".webm": "video/webm",
		".mp3":  "audio/mpeg",
		".wav":  "audio/wav",
		".flac": "audio/flac",
		".ogg":  "audio/ogg",
		".aac":  "audio/aac",
		".jpg":  "image/jpeg",
		".jpeg": "image/jpeg",
		".png":  "image/png",
		".gif":  "image/gif",
		".webp": "image/webp",
	}

	if contentType, ok := contentTypes[ext]; ok {
		return contentType
	}

	return "application/octet-stream"
}
