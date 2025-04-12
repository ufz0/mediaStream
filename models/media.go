package models

import (
	"encoding/base64"
	"errors"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"

	"mediastream/config"
	"mediastream/utils"
)

// MediaItem represents a media item (video, audio, image)
type MediaItem struct {
	ID          string    `json:"id"`
	Title       string    `json:"title"`
	Type        string    `json:"type"`        // video, audio, image
	LibraryType string    `json:"libraryType"` // movies, tvshows, music
	Filename    string    `json:"filename"`
	Path        string    `json:"path"` // Stream path
	Size        int64     `json:"size"`
	Modified    time.Time `json:"modified"`
	Folder      string    `json:"folder,omitempty"` // For movies organized in folders
}

// ScanDirectory scans a directory for media files
func ScanDirectory(directoryPath, libraryType string, cfg *config.Config) ([]MediaItem, error) {
	mediaFiles := []MediaItem{}

	entries, err := os.ReadDir(directoryPath)
	if err != nil {
		return nil, err
	}

	// Handle movies differently (each movie is in its own folder)
	if libraryType == "movies" {
		for _, entry := range entries {
			if entry.IsDir() {
				entryPath := filepath.Join(directoryPath, entry.Name())

				// Use folder name as the movie title
				movieTitle := entry.Name()

				// Find video files in the movie folder
				movieFiles, err := os.ReadDir(entryPath)
				if err != nil {
					continue
				}

				// Find all video files (not just the first one)
				for _, file := range movieFiles {
					if file.IsDir() {
						continue
					}

					ext := strings.ToLower(filepath.Ext(file.Name()))
					isVideoFile := false

					for _, supportedExt := range cfg.SupportedExtensions["video"] {
						if ext == supportedExt {
							isVideoFile = true
							break
						}
					}

					if isVideoFile {
						filePath := filepath.Join(entryPath, file.Name())
						fileInfo, err := os.Stat(filePath)
						if err != nil {
							continue
						}

						// Create ID from path
						relativePath := filepath.Join(entry.Name(), file.Name())
						id := base64.StdEncoding.EncodeToString([]byte(libraryType + ":" + relativePath))

						// Properly URL-escape both folder name and filename
						escapedFolder := url.PathEscape(entry.Name())
						escapedFilename := url.PathEscape(file.Name())

						mediaFiles = append(mediaFiles, MediaItem{
							ID:          id,
							Title:       utils.GetTitle(movieTitle),
							Type:        "video",
							LibraryType: libraryType,
							Filename:    file.Name(),
							Path:        "/stream/movie/" + libraryType + "/" + escapedFolder + "/" + escapedFilename,
							Size:        fileInfo.Size(),
							Modified:    fileInfo.ModTime(),
							Folder:      movieTitle,
						})
					}
				}
			}
		}
	} else {
		// Regular handling for other library types
		for _, entry := range entries {
			entryPath := filepath.Join(directoryPath, entry.Name())
			fileInfo, err := os.Stat(entryPath)

			if err != nil {
				continue
			}

			if fileInfo.IsDir() {
				// If directory, scan recursively (for TV shows with seasons)
				subItems, err := ScanDirectory(entryPath, libraryType, cfg)
				if err == nil {
					mediaFiles = append(mediaFiles, subItems...)
				}
			} else {
				ext := strings.ToLower(filepath.Ext(entry.Name()))
				var mediaType string

				// Determine media type based on extension
				for _, videoExt := range cfg.SupportedExtensions["video"] {
					if ext == videoExt {
						mediaType = "video"
						break
					}
				}

				if mediaType == "" {
					for _, audioExt := range cfg.SupportedExtensions["audio"] {
						if ext == audioExt {
							mediaType = "audio"
							break
						}
					}
				}

				if mediaType == "" {
					for _, imageExt := range cfg.SupportedExtensions["image"] {
						if ext == imageExt {
							mediaType = "image"
							break
						}
					}
				}

				if mediaType != "" {
					// Create ID using the file path relative to the media directory
					relativePath := entry.Name()
					id := base64.StdEncoding.EncodeToString([]byte(libraryType + ":" + relativePath))

					mediaFiles = append(mediaFiles, MediaItem{
						ID:          id,
						Title:       utils.GetTitle(entry.Name()),
						Type:        mediaType,
						LibraryType: libraryType,
						Filename:    entry.Name(),
						Path:        "/stream/file/" + libraryType + "/" + url.PathEscape(entry.Name()),
						Size:        fileInfo.Size(),
						Modified:    fileInfo.ModTime(),
					})
				}
			}
		}
	}

	return mediaFiles, nil
}

// FindMediaByID finds a media item by its ID
func FindMediaByID(id string, cfg *config.Config) (*MediaItem, error) {
	// Decode the ID
	decodedBytes, err := base64.StdEncoding.DecodeString(id)
	if err != nil {
		return nil, err
	}

	decoded := string(decodedBytes)
	parts := strings.SplitN(decoded, ":", 2)
	if len(parts) != 2 {
		return nil, errors.New("invalid media ID format")
	}

	libraryType := parts[0]
	relativePath := parts[1]

	// Find the library folder
	var libraryFolder config.MediaFolder
	for _, folder := range cfg.MediaFolders {
		if folder.Type == libraryType {
			libraryFolder = folder
			break
		}
	}

	if libraryFolder.Path == "" {
		return nil, errors.New("library not found")
	}

	// Check if this is a movie (which has folder/file format)
	if strings.Contains(relativePath, "/") && libraryType == "movies" {
		pathParts := strings.Split(relativePath, "/")

		if len(pathParts) > 1 {
			folder := pathParts[0]
			fileName := pathParts[len(pathParts)-1]

			filePath := filepath.Join(libraryFolder.Path, relativePath)
			if _, err := os.Stat(filePath); os.IsNotExist(err) {
				return nil, errors.New("file not found")
			}

			fileInfo, err := os.Stat(filePath)
			if err != nil {
				return nil, err
			}

			return &MediaItem{
				ID:          id,
				Title:       utils.GetTitle(folder),
				Type:        "video",
				LibraryType: libraryType,
				Filename:    fileName,
				Path:        "/stream/movie/" + libraryType + "/" + url.PathEscape(folder) + "/" + url.PathEscape(fileName),
				Size:        fileInfo.Size(),
				Modified:    fileInfo.ModTime(),
				Folder:      folder,
			}, nil
		}
	}

	// Standard handling for non-movie files
	filePath := filepath.Join(libraryFolder.Path, relativePath)
	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		return nil, errors.New("file not found")
	}

	fileInfo, err := os.Stat(filePath)
	if err != nil {
		return nil, err
	}

	ext := strings.ToLower(filepath.Ext(filePath))
	var mediaType string

	for _, videoExt := range cfg.SupportedExtensions["video"] {
		if ext == videoExt {
			mediaType = "video"
			break
		}
	}

	if mediaType == "" {
		for _, audioExt := range cfg.SupportedExtensions["audio"] {
			if ext == audioExt {
				mediaType = "audio"
				break
			}
		}
	}

	if mediaType == "" {
		for _, imageExt := range cfg.SupportedExtensions["image"] {
			if ext == imageExt {
				mediaType = "image"
				break
			}
		}
	}

	if mediaType == "" {
		return nil, errors.New("unsupported file type")
	}

	fileName := filepath.Base(relativePath)
	return &MediaItem{
		ID:          id,
		Title:       utils.GetTitle(fileName),
		Type:        mediaType,
		LibraryType: libraryType,
		Filename:    fileName,
		Path:        "/stream/file/" + libraryType + "/" + url.PathEscape(fileName),
		Size:        fileInfo.Size(),
		Modified:    fileInfo.ModTime(),
	}, nil
}
