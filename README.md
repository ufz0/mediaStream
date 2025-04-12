# MediaStream - Personal Media Server

A simple web application that lets you stream your media files in a Jellyfin/Plex-like interface.

## Features

- Browse your media libraries (Movies, TV Shows, Music)
- Automatic organization by media type
- Stream videos, audio, and images
- Responsive design for both desktop and mobile
- Media player with controls for different media types
- Clean, modern interface inspired by popular media servers

## Supported File Types

The application supports various file types:

- **Video**: MP4, MKV, WebM, MOV, AVI
- **Audio**: MP3, WAV, FLAC, OGG, AAC
- **Images**: JPG, JPEG, PNG, GIF, WebP

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm (v6 or higher)

### Installation

1. Clone the repository or download the source code
2. Install dependencies:

```bash
npm install
```

3. Add your media files to the appropriate folders:
   - `media/movies` - for your movie files
   - `media/tvshows` - for your TV show files
   - `media/music` - for your music files

4. Start the server:

```bash
npm start
```

5. Open your browser and navigate to `http://localhost:3000`

### Development Mode

To run the server in development mode with automatic restarts:

```bash
npm run dev
```

## How It Works

### Backend

- Express.js server handles HTTP requests
- File system scanning to detect media files
- HTTP range requests support proper video/audio streaming
- File metadata extraction to display title, size, etc.

### Frontend

- Modern interface with sidebar navigation
- Media grid layout for browsing content
- Fullscreen media player overlay
- Responsive design for all device sizes

## Directory Structure

```
/
├── main.js             # Main server file
├── package.json        # Node.js dependencies
├── media/              # Media directories
│   ├── movies/         # Movie files
│   ├── tvshows/        # TV shows files
│   └── music/          # Music files
└── public/             # Static frontend files
    ├── index.html      # HTML structure
    ├── style.css       # CSS styling
    └── script.js       # Frontend JavaScript
```

## Customization

You can customize the media folders by editing the `config` object in `main.js`. Add or modify the media folder paths and types according to your needs. 