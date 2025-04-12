# MediaStream Server

A streaming media server built with Go and the Gin framework. Provides streaming access to your movies, TV shows, and music libraries.

## Features

- User authentication with admin and regular user roles
- Initial setup wizard for creating the admin user
- Media library organization for movies, TV shows, and music
- Video streaming with adaptive playback
- Responsive web interface
- Search functionality across all libraries

## Installation

### Prerequisites

- Go 1.16 or higher

### Steps

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/mediastream.git
   cd mediastream
   ```

2. Install dependencies:
   ```
   go mod tidy
   ```

3. Build the server:
   ```
   go build
   ```

4. Run the server:
   ```
   ./mediastream
   ```

### Development Mode

There are two ways to run the server in development mode with a pre-created admin user:

1. Using an environment variable:
   ```
   MEDIASTREAM_ENV=development go run main.go
   ```

2. Using a command line argument:
   ```
   go run . dev
   ```
   or after building:
   ```
   ./mediastream dev
   ```

Development mode:
- Creates a default dev user (username: `dev`, password: `dev`, admin privileges)
- Enables Gin's debug mode with verbose logging
- Skips setup when starting the app for the first time

When running without the dev flag, the server runs in release mode which is optimized for production use.

## Configuration

The first time you run the server, you'll be redirected to a setup page where you can create the admin user and configure media directories.

### Media Directories

By default, the server uses the following directories:
- `./media/movies` - For movies
- `./media/tvshows` - For TV shows
- `./media/music` - For music

You can change these paths during setup.

## Media Organization

### Movies

Movies should be organized with each movie in its own folder:

```
movies/
  Movie Title 1/
    movie.mp4
    subtitle.srt
  Movie Title 2/
    movie.mkv
```

The folder name is used as the movie title.

### TV Shows and Music

TV shows and music can be organized in a hierarchical structure:

```
tvshows/
  Show Name 1/
    Season 1/
      Episode01.mp4
      Episode02.mp4
    Season 2/
      Episode01.mp4
```

## API Endpoints

### Authentication

- `POST /login` - Login with username and password
- `GET /logout` - Logout current user

### Admin

- `GET /api/admin/users` - Get all users
- `POST /api/admin/users` - Create a new user
- `DELETE /api/admin/users/:id` - Delete a user

### Libraries

- `GET /api/libraries` - Get all media libraries
- `GET /api/library/:type` - Get media items for a specific library
- `GET /api/media/:id` - Get details for a specific media item
- `GET /api/search?q=query` - Search for media items

### Streaming

- `GET /stream/file/:type/:filename` - Stream a regular media file
- `GET /stream/movie/:type/:folder/:filename` - Stream a movie file from a folder

## License

MIT 