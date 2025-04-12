package routes

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"unicode"

	"github.com/gin-gonic/gin"

	"mediastream/config"
	"mediastream/models"
	"mediastream/utils"
)

// capitalizeFirst capitalizes the first letter of a string
func capitalizeFirst(s string) string {
	if s == "" {
		return ""
	}
	r := []rune(s)
	r[0] = unicode.ToUpper(r[0])
	return string(r)
}

// HandleGetLibraries returns all media libraries
func HandleGetLibraries(c *gin.Context, cfg *config.Config) {
	libraries := make([]gin.H, len(cfg.MediaFolders))

	for i, folder := range cfg.MediaFolders {
		libraries[i] = gin.H{
			"id":   folder.Type,
			"name": capitalizeFirst(folder.Type),
			"path": folder.Path,
			"type": folder.Type,
		}
	}

	c.JSON(http.StatusOK, libraries)
}

// HandleGetLibrary returns media items for a specific library
func HandleGetLibrary(c *gin.Context, cfg *config.Config) {
	libraryType := c.Param("type")

	var libraryFolder string
	for _, folder := range cfg.MediaFolders {
		if folder.Type == libraryType {
			libraryFolder = folder.Path
			break
		}
	}

	if libraryFolder == "" {
		c.JSON(http.StatusNotFound, gin.H{"error": "Library not found"})
		return
	}

	items, err := models.ScanDirectory(libraryFolder, libraryType, cfg)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Error scanning directory: %v", err)})
		return
	}

	c.JSON(http.StatusOK, items)
}

// HandleGetMediaItem returns details for a specific media item
func HandleGetMediaItem(c *gin.Context, cfg *config.Config) {
	mediaID := c.Param("id")

	mediaItem, err := models.FindMediaByID(mediaID, cfg)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Media not found"})
		return
	}

	c.JSON(http.StatusOK, mediaItem)
}

// HandleSearch searches for media items
func HandleSearch(c *gin.Context, cfg *config.Config) {
	query := c.Query("q")
	query = strings.ToLower(query)

	if query == "" || len(query) < 2 {
		c.JSON(http.StatusOK, []gin.H{})
		return
	}

	results := []models.MediaItem{}

	// Search in each media library
	for _, folder := range cfg.MediaFolders {
		items, err := models.ScanDirectory(folder.Path, folder.Type, cfg)
		if err != nil {
			fmt.Printf("Error searching in %s library: %v\n", folder.Type, err)
			continue
		}

		// Filter items based on search query
		for _, item := range items {
			// Search in title
			if strings.Contains(strings.ToLower(item.Title), query) {
				results = append(results, item)
				continue
			}

			// If it's a movie, also search in folder name
			if item.Folder != "" && strings.Contains(strings.ToLower(item.Folder), query) {
				results = append(results, item)
			}
		}
	}

	// Sort results (basic sorting - exact matches first, then startsWith)
	// For more complex sorting, implement a custom sort function

	c.JSON(http.StatusOK, results)
}

// HandleStreamMedia streams a media file
func HandleStreamMedia(c *gin.Context, cfg *config.Config) {
	mediaType := c.Param("type")
	filename := c.Param("filename")

	var libraryFolder string
	for _, folder := range cfg.MediaFolders {
		if folder.Type == mediaType {
			libraryFolder = folder.Path
			break
		}
	}

	if libraryFolder == "" {
		c.String(http.StatusNotFound, "Library not found")
		return
	}

	filePath := filepath.Join(libraryFolder, filename)

	// Check if file exists
	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		c.String(http.StatusNotFound, "File not found")
		return
	}

	// Set headers to discourage downloading
	c.Header("Content-Disposition", "inline")
	c.Header("X-Content-Type-Options", "nosniff")

	// Get file info
	fileInfo, err := os.Stat(filePath)
	if err != nil {
		c.String(http.StatusInternalServerError, "Error reading file")
		return
	}

	fileSize := fileInfo.Size()
	contentType := utils.GetContentType(filePath)

	// Handle range requests for video streaming
	rangeHeader := c.GetHeader("Range")
	if rangeHeader != "" {
		// Parse range header
		parts := strings.Split(strings.Replace(rangeHeader, "bytes=", "", 1), "-")
		start, err := strconv.ParseInt(parts[0], 10, 64)
		if err != nil {
			c.String(http.StatusBadRequest, "Invalid range header")
			return
		}

		var end int64
		if parts[1] == "" {
			end = fileSize - 1
		} else {
			end, err = strconv.ParseInt(parts[1], 10, 64)
			if err != nil {
				end = fileSize - 1
			}
		}

		// Prevent overflows
		if end >= fileSize {
			end = fileSize - 1
		}
		if start > end {
			c.String(http.StatusRequestedRangeNotSatisfiable, "Invalid range")
			return
		}

		// Set headers for partial content
		c.Header("Content-Range", fmt.Sprintf("bytes %d-%d/%d", start, end, fileSize))
		c.Header("Accept-Ranges", "bytes")
		c.Header("Content-Length", strconv.FormatInt(end-start+1, 10))
		c.Header("Content-Type", contentType)
		c.Status(http.StatusPartialContent)

		// Open the file
		file, err := os.Open(filePath)
		if err != nil {
			c.String(http.StatusInternalServerError, "Error opening file")
			return
		}
		defer file.Close()

		// Seek to start position
		file.Seek(start, io.SeekStart)

		// Stream the file
		_, err = io.CopyN(c.Writer, file, end-start+1)
		if err != nil {
			fmt.Printf("Error streaming file: %v\n", err)
		}
	} else {
		// No range header, serve the entire file
		c.Header("Content-Length", strconv.FormatInt(fileSize, 10))
		c.Header("Content-Type", contentType)
		c.File(filePath)
	}
}

// HandleStreamMediaWithFolder streams a media file from a subfolder
func HandleStreamMediaWithFolder(c *gin.Context, cfg *config.Config) {
	mediaType := c.Param("type")
	folder := c.Param("folder")
	filename := c.Param("filename")

	var libraryFolder string
	for _, folder := range cfg.MediaFolders {
		if folder.Type == mediaType {
			libraryFolder = folder.Path
			break
		}
	}

	if libraryFolder == "" {
		c.String(http.StatusNotFound, "Library not found")
		return
	}

	filePath := filepath.Join(libraryFolder, folder, filename)

	// Check if file exists
	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		c.String(http.StatusNotFound, "File not found")
		return
	}

	// Set headers to discourage downloading
	c.Header("Content-Disposition", "inline")
	c.Header("X-Content-Type-Options", "nosniff")

	// Get file info
	fileInfo, err := os.Stat(filePath)
	if err != nil {
		c.String(http.StatusInternalServerError, "Error reading file")
		return
	}

	fileSize := fileInfo.Size()
	contentType := utils.GetContentType(filePath)

	// Handle range requests for video streaming
	rangeHeader := c.GetHeader("Range")
	if rangeHeader != "" {
		// Parse range header
		parts := strings.Split(strings.Replace(rangeHeader, "bytes=", "", 1), "-")
		start, err := strconv.ParseInt(parts[0], 10, 64)
		if err != nil {
			c.String(http.StatusBadRequest, "Invalid range header")
			return
		}

		var end int64
		if parts[1] == "" {
			end = fileSize - 1
		} else {
			end, err = strconv.ParseInt(parts[1], 10, 64)
			if err != nil {
				end = fileSize - 1
			}
		}

		// Prevent overflows
		if end >= fileSize {
			end = fileSize - 1
		}
		if start > end {
			c.String(http.StatusRequestedRangeNotSatisfiable, "Invalid range")
			return
		}

		// Set headers for partial content
		c.Header("Content-Range", fmt.Sprintf("bytes %d-%d/%d", start, end, fileSize))
		c.Header("Accept-Ranges", "bytes")
		c.Header("Content-Length", strconv.FormatInt(end-start+1, 10))
		c.Header("Content-Type", contentType)
		c.Status(http.StatusPartialContent)

		// Open the file
		file, err := os.Open(filePath)
		if err != nil {
			c.String(http.StatusInternalServerError, "Error opening file")
			return
		}
		defer file.Close()

		// Seek to start position
		file.Seek(start, io.SeekStart)

		// Stream the file
		_, err = io.CopyN(c.Writer, file, end-start+1)
		if err != nil {
			fmt.Printf("Error streaming file: %v\n", err)
		}
	} else {
		// No range header, serve the entire file
		c.Header("Content-Length", strconv.FormatInt(fileSize, 10))
		c.Header("Content-Type", contentType)
		c.File(filePath)
	}
}
