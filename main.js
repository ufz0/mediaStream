const express = require('express');
const fs = require('fs');
const path = require('path');
const session = require('express-session');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const app = express();
const port = 3000;

// Configuration
const config = {
  mediaFolders: [
    { path: path.join(__dirname, 'media/movies'), type: 'movies' },
    { path: path.join(__dirname, 'media/tvshows'), type: 'tvshows' },
    { path: path.join(__dirname, 'media/music'), type: 'music' }
  ],
  // File extensions we recognize
  supportedExtensions: {
    video: ['.mp4', '.mkv', '.avi', '.mov', '.webm'],
    audio: ['.mp3', '.wav', '.flac', '.ogg', '.aac'],
    image: ['.jpg', '.jpeg', '.png', '.gif', '.webp']
  }
};

// Check if setup is completed
const SETUP_FLAG_FILE = path.join(__dirname, 'setup-completed');
const USERS_FILE = path.join(__dirname, 'users.json');
const CONFIG_FILE = path.join(__dirname, 'config.json');
let setupCompleted = fs.existsSync(SETUP_FLAG_FILE);

// Load configuration if it exists
if (fs.existsSync(CONFIG_FILE)) {
  try {
    const savedConfig = JSON.parse(fs.readFileSync(CONFIG_FILE));
    // Update media folders
    if (savedConfig.mediaFolders) {
      config.mediaFolders = savedConfig.mediaFolders;
    }
  } catch (error) {
    console.error('Error loading configuration:', error);
  }
}


app.use((req, res, next) => {

  if (req.path.startsWith('/static') || 
      req.path === '/api/setup' || 
      req.path === '/setup.html' ||
      req.path === '/style.css') {
    return next();
  }
  
  if (!setupCompleted && req.path !== '/setup') {
    return res.redirect('/setup');
  }
  
  next();
});


let users = [];


if (fs.existsSync(USERS_FILE)) {
  try {
    const data = fs.readFileSync(USERS_FILE);
    users = JSON.parse(data);
    setupCompleted = true;
  } catch (error) {
    console.error('Error loading users:', error);
  }
}

// Create the dev user if in development mode
if (process.env.NODE_ENV === 'development') {
  const hashedPassword = bcrypt.hashSync('dev', 10);
  
  // Check if dev user already exists
  if (!users.find(u => u.username === 'dev')) {
    users.push({
      id: 'dev',
      username: 'dev',
      password: hashedPassword,
      isAdmin: true 
    });
  }
  
  setupCompleted = true; // Setup is considered complete in dev mode
  console.log('Created development user: username=dev, password=dev (admin)');
}

// Create media directories if they don't exist
config.mediaFolders.forEach(folder => {
  if (!fs.existsSync(folder.path)) {
    fs.mkdirSync(folder.path, { recursive: true });
  }
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: 'media-stream-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: false, // Set to true if using HTTPS
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Configure Passport
passport.use(new LocalStrategy(
  (username, password, done) => {
    // Reload users from file to get the latest data
    try {
      if (fs.existsSync(USERS_FILE)) {
        const data = fs.readFileSync(USERS_FILE);
        users = JSON.parse(data);
      }
    } catch (error) {
      console.error('Error loading users during authentication:', error);
    }
    
    const user = users.find(u => u.username === username);
    if (!user) {
      return done(null, false, { message: 'Incorrect username.' });
    }
    
    bcrypt.compare(password, user.password, (err, isMatch) => {
      if (err) return done(err);
      if (!isMatch) {
        return done(null, false, { message: 'Incorrect password.' });
      }
      return done(null, user);
    });
  }
));

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser((id, done) => {
  const user = users.find(u => u.id === id);
  done(null, user);
});

// Serve static files from public directory
app.use(express.static('public'));

// Middleware to check if user is authenticated
function ensureAuthenticated(req, res, next) {
  // If setup is not complete, redirect to setup page
  if (!setupCompleted && process.env.NODE_ENV !== 'development') {
    return res.redirect('/setup');
  }
  
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect('/login');
}

// Middleware to check if user is an admin
function ensureAdmin(req, res, next) {
  if (req.user && req.user.isAdmin) {
    return next();
  }
  res.status(403).json({ error: 'Admin access required' });
}

// Middleware to check if setup is needed
function checkSetup(req, res, next) {
  if (!setupCompleted && process.env.NODE_ENV !== 'development') {
    return res.redirect('/setup');
  }
  next();
}

// Routes
app.get('/', ensureAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Setup route - only accessible if setup is not complete
app.get('/setup', (req, res) => {
  if (setupCompleted) {
    return res.redirect('/');
  }
  res.sendFile(path.join(__dirname, 'public', 'setup.html'));
});

// Setup API endpoint
app.post('/api/setup', async (req, res) => {
  if (setupCompleted) {
    return res.status(403).json({ error: 'Setup already completed' });
  }

  const { username, password, mediaFolders } = req.body;
  
  // Validate input
  if (!username || username.length < 3) {
    return res.status(400).json({ error: 'Username must be at least 3 characters' });
  }
  
  if (!password || password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  try {
    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Create admin user
    const user = {
      id: generateUniqueId(),
      username,
      password: hashedPassword,
      isAdmin: true,
      created: new Date().toISOString()
    };
    
    // Save to users file
    let users = [];
    if (fs.existsSync(USERS_FILE)) {
      const data = fs.readFileSync(USERS_FILE);
      users = JSON.parse(data);
    }
    
    users.push(user);
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
    
    // Update config with custom media folders if provided
    if (mediaFolders && Object.keys(mediaFolders).length > 0) {
      // Update the config with user-provided paths
      config.mediaFolders = [
        { path: mediaFolders.movies || path.join(__dirname, 'media/movies'), type: 'movies' },
        { path: mediaFolders.tvshows || path.join(__dirname, 'media/tvshows'), type: 'tvshows' },
        { path: mediaFolders.music || path.join(__dirname, 'media/music'), type: 'music' }
      ];
      
      // Create the directories if they don't exist
      config.mediaFolders.forEach(folder => {
        if (!fs.existsSync(folder.path)) {
          fs.mkdirSync(folder.path, { recursive: true });
        }
      });
      
      // Save the configuration to a file
      fs.writeFileSync(CONFIG_FILE, JSON.stringify({
        mediaFolders: config.mediaFolders,
        supportedExtensions: config.supportedExtensions
      }, null, 2));
    }
    
    // Mark setup as completed
    fs.writeFileSync(SETUP_FLAG_FILE, new Date().toISOString());
    setupCompleted = true;
    
    res.json({ success: true });
  } catch (error) {
    console.error('Setup error:', error);
    res.status(500).json({ error: 'Failed to complete setup' });
  }
});

// Authentication routes
app.get('/login', checkSetup, (req, res) => {
  if (req.isAuthenticated()) {
    return res.redirect('/');
  }
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.post('/login', passport.authenticate('local', {
  successRedirect: '/',
  failureRedirect: '/login?error=1'
}));

app.get('/logout', (req, res) => {
  req.logout((err) => {
    if (err) {
      console.error('Error during logout:', err);
    }
    res.redirect('/login');
  });
});

// Admin endpoint to create a new user
app.post('/api/admin/users', ensureAuthenticated, ensureAdmin, async (req, res) => {
  const { username, password, isAdmin } = req.body;
  
  // Basic validation
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }
  
  // Reload users to get latest data
  try {
    if (fs.existsSync(USERS_FILE)) {
      const data = fs.readFileSync(USERS_FILE);
      users = JSON.parse(data);
    }
  } catch (error) {
    console.error('Error loading users:', error);
  }
  
  if (users.find(u => u.username === username)) {
    return res.status(400).json({ error: 'Username already exists' });
  }
  
  try {
    // Hash password and create user
    const hash = await bcrypt.hash(password, 10);
    
    const newUser = {
      id: generateUniqueId(),
      username,
      password: hash,
      isAdmin: isAdmin === true, // Make sure it's a boolean
      created: new Date().toISOString()
    };
    
    users.push(newUser);
    
    // Save users to file
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
    
    res.status(201).json({ message: 'User created successfully' });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ error: 'Error creating user' });
  }
});

// Admin endpoint to get all users
app.get('/api/admin/users', ensureAuthenticated, ensureAdmin, (req, res) => {
  // Return all users except their password
  const safeUsers = users.map(user => ({
    id: user.id,
    username: user.username,
    isAdmin: user.isAdmin || false
  }));
  
  res.json(safeUsers);
});

// Admin endpoint to delete a user
app.delete('/api/admin/users/:id', ensureAuthenticated, ensureAdmin, (req, res) => {
  const userId = req.params.id;
  
  // Don't allow the admin to delete themselves
  if (userId === req.user.id) {
    return res.status(400).json({ error: 'Cannot delete your own account' });
  }
  
  // Reload users to get latest data
  try {
    if (fs.existsSync(USERS_FILE)) {
      const data = fs.readFileSync(USERS_FILE);
      users = JSON.parse(data);
    }
  } catch (error) {
    console.error('Error loading users:', error);
  }
  
  const userIndex = users.findIndex(user => user.id === userId);
  
  if (userIndex === -1) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  // Remove the user
  users.splice(userIndex, 1);
  
  // Save users to file
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
  
  res.json({ message: 'User deleted successfully' });
});

// Get all media libraries
app.get('/api/libraries', ensureAuthenticated, (req, res) => {
  const libraries = config.mediaFolders.map(folder => ({
    id: folder.type,
    name: folder.type.charAt(0).toUpperCase() + folder.type.slice(1),
    path: folder.path,
    type: folder.type
  }));
  
  res.json(libraries);
});

// Get media items for a specific library
app.get('/api/library/:type', ensureAuthenticated, (req, res) => {
  const libraryType = req.params.type;
  const library = config.mediaFolders.find(folder => folder.type === libraryType);
  
  if (!library) {
    return res.status(404).json({ error: 'Library not found' });
  }
  
  try {
    const items = scanDirectory(library.path, library.type);
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get details for a specific media item
app.get('/api/media/:id', ensureAuthenticated, (req, res) => {
  const mediaId = req.params.id;
  const mediaItem = findMediaById(mediaId);
  
  if (!mediaItem) {
    return res.status(404).json({ error: 'Media not found' });
  }
  
  res.json(mediaItem);
});

// Add a search endpoint
app.get('/api/search', ensureAuthenticated, (req, res) => {
  const query = req.query.q ? req.query.q.toLowerCase() : '';
  
  if (!query || query.length < 2) {
    return res.json([]);
  }
  
  const results = [];
  
  // Search in each media library
  config.mediaFolders.forEach(folder => {
    try {
      // Get all media items in this library
      const items = scanDirectory(folder.path, folder.type);
      
      // Filter items based on search query
      const matchingItems = items.filter(item => {
        // Search in title
        if (item.title.toLowerCase().includes(query)) {
          return true;
        }
        
        // If it's a movie, also search in folder name
        if (item.folder && item.folder.toLowerCase().includes(query)) {
          return true;
        }
        
        return false;
      });
      
      results.push(...matchingItems);
    } catch (error) {
      console.error(`Error searching in ${folder.type} library:`, error);
    }
  });
  
  // Sort results by relevance (exact matches first, then startsWith, then includes)
  results.sort((a, b) => {
    const aTitle = a.title.toLowerCase();
    const bTitle = b.title.toLowerCase();
    
    // Exact matches first
    if (aTitle === query && bTitle !== query) return -1;
    if (bTitle === query && aTitle !== query) return 1;
    
    // Then titles that start with the query
    if (aTitle.startsWith(query) && !bTitle.startsWith(query)) return -1;
    if (bTitle.startsWith(query) && !aTitle.startsWith(query)) return 1;
    
    // Otherwise sort alphabetically
    return aTitle.localeCompare(bTitle);
  });
  
  res.json(results);
});

// Stream a media file
app.get('/stream/:type/:filename', ensureAuthenticated, (req, res) => {
  const { type, filename } = req.params;
  const libraryFolder = config.mediaFolders.find(folder => folder.type === type);
  
  if (!libraryFolder) {
    return res.status(404).send('Library not found');
  }
  
  const filePath = path.join(libraryFolder.path, filename);
  
  // Check if file exists
  if (!fs.existsSync(filePath)) {
    return res.status(404).send('File not found');
  }

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;

  // Set headers to discourage downloading
  res.setHeader('Content-Disposition', 'inline');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  if (range) {
    // Parse range
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    
    // Create headers
    const chunkSize = end - start + 1;
    const fileStream = fs.createReadStream(filePath, { start, end });
    const contentType = getContentType(filePath);
    
    const headers = {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunkSize,
      'Content-Type': contentType
    };
    
    // HTTP Status 206 for Partial Content
    res.writeHead(206, headers);
    fileStream.pipe(res);
  } else {
    // No range requested, send the entire file
    const contentType = getContentType(filePath);
    const headers = {
      'Content-Length': fileSize,
      'Content-Type': contentType
    };
    res.writeHead(200, headers);
    fs.createReadStream(filePath).pipe(res);
  }
});

// Add a new route to handle the subfolder structure for movies
app.get('/stream/:type/:folder/:filename', ensureAuthenticated, (req, res) => {
  const { type, folder, filename } = req.params;
  const libraryFolder = config.mediaFolders.find(folder => folder.type === type);
  
  if (!libraryFolder) {
    return res.status(404).send('Library not found');
  }
  
  const filePath = path.join(libraryFolder.path, folder, filename);
  
  // Check if file exists
  if (!fs.existsSync(filePath)) {
    return res.status(404).send('File not found');
  }

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;

  // Set headers to discourage downloading
  res.setHeader('Content-Disposition', 'inline');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  if (range) {
    // Parse range
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    
    // Create headers
    const chunkSize = end - start + 1;
    const fileStream = fs.createReadStream(filePath, { start, end });
    const contentType = getContentType(filePath);
    
    const headers = {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunkSize,
      'Content-Type': contentType
    };
    
    // HTTP Status 206 for Partial Content
    res.writeHead(206, headers);
    fileStream.pipe(res);
  } else {
    // No range requested, send the entire file
    const contentType = getContentType(filePath);
    const headers = {
      'Content-Length': fileSize,
      'Content-Type': contentType
    };
    res.writeHead(200, headers);
    fs.createReadStream(filePath).pipe(res);
  }
});

// Helper function to scan a directory for media files
function scanDirectory(directoryPath, libraryType) {
  const mediaFiles = [];
  
  try {
    const entries = fs.readdirSync(directoryPath);
    
    // Handle movies differently - each movie is in its own folder
    if (libraryType === 'movies') {
      entries.forEach(entry => {
        const entryPath = path.join(directoryPath, entry);
        
        // Check if it's a directory
        if (fs.statSync(entryPath).isDirectory()) {
          // Use folder name as the movie title
          const movieTitle = entry;
          
          // Find video files in the movie folder
          const movieFiles = fs.readdirSync(entryPath);
          const videoFile = movieFiles.find(file => {
            const ext = path.extname(file).toLowerCase();
            return config.supportedExtensions.video.includes(ext);
          });
          
          if (videoFile) {
            const filePath = path.join(entryPath, videoFile);
            const stat = fs.statSync(filePath);
            
            // Create a unique ID
            const relativePath = path.relative(directoryPath, entryPath);
            const id = Buffer.from(`${libraryType}:${relativePath}/${videoFile}`).toString('base64');
            
            mediaFiles.push({
              id,
              title: getTitle(movieTitle), // Use folder name as title
              type: 'video',
              libraryType,
              filename: videoFile,
              path: `/stream/${libraryType}/${encodeURIComponent(relativePath)}/${encodeURIComponent(videoFile)}`,
              size: stat.size,
              modified: stat.mtime,
              folder: movieTitle
            });
          }
        }
      });
    } else {
      // Original handling for other library types
      entries.forEach(entry => {
        const entryPath = path.join(directoryPath, entry);
        const stat = fs.statSync(entryPath);
        
        if (stat.isDirectory()) {
          // If it's a directory, scan it recursively (for TV shows with seasons)
          const subItems = scanDirectory(entryPath, libraryType);
          mediaFiles.push(...subItems);
        } else {
          const ext = path.extname(entry).toLowerCase();
          let mediaType = null;
          
          // Determine media type based on extension
          if (config.supportedExtensions.video.includes(ext)) {
            mediaType = 'video';
          } else if (config.supportedExtensions.audio.includes(ext)) {
            mediaType = 'audio';
          } else if (config.supportedExtensions.image.includes(ext)) {
            mediaType = 'image';
          }
          
          if (mediaType) {
            // Create a unique ID using the file path relative to the media directory
            const relativePath = path.relative(directoryPath, entryPath);
            const id = Buffer.from(`${libraryType}:${relativePath}`).toString('base64');
            
            mediaFiles.push({
              id,
              title: getTitle(entry),
              type: mediaType,
              libraryType,
              filename: entry,
              path: `/stream/${libraryType}/${encodeURIComponent(entry)}`,
              size: stat.size,
              modified: stat.mtime
            });
          }
        }
      });
    }
    
    return mediaFiles;
  } catch (error) {
    console.error(`Error scanning directory ${directoryPath}:`, error);
    return [];
  }
}

// Find media by ID
function findMediaById(id) {
  try {
    const decoded = Buffer.from(id, 'base64').toString();
    let libraryType, relativePath, fileName;
    
    // Check if this is a movie (which has folder/file format)
    if (decoded.includes('/') && decoded.startsWith('movies:')) {
      const parts = decoded.split(':');
      libraryType = parts[0];
      
      // Split the relative path into folder and filename
      const pathParts = parts[1].split('/');
      
      // If there's more than one slash, then the format is movies:folder/filename
      if (pathParts.length > 1) {
        const folder = pathParts[0];
        fileName = pathParts[pathParts.length - 1];
        relativePath = parts[1];
        
        const library = config.mediaFolders.find(folder => folder.type === libraryType);
        if (!library) return null;
        
        const filePath = path.join(library.path, relativePath);
        if (!fs.existsSync(filePath)) return null;
        
        const stat = fs.statSync(filePath);
        const ext = path.extname(fileName).toLowerCase();
        
        // For movies, we know it's a video
        return {
          id,
          title: getTitle(folder), // Use the folder name for the title
          type: 'video',
          libraryType,
          filename: fileName,
          path: `/stream/${libraryType}/${encodeURIComponent(folder)}/${encodeURIComponent(fileName)}`,
          size: stat.size,
          modified: stat.mtime,
          folder: folder
        };
      }
    }
    
    // Standard handling for non-movie files
    [libraryType, relativePath] = decoded.split(':');
    
    const library = config.mediaFolders.find(folder => folder.type === libraryType);
    if (!library) return null;
    
    const filePath = path.join(library.path, relativePath);
    if (!fs.existsSync(filePath)) return null;
    
    const stat = fs.statSync(filePath);
    const ext = path.extname(relativePath).toLowerCase();
    let mediaType = null;
    
    if (config.supportedExtensions.video.includes(ext)) {
      mediaType = 'video';
    } else if (config.supportedExtensions.audio.includes(ext)) {
      mediaType = 'audio';
    } else if (config.supportedExtensions.image.includes(ext)) {
      mediaType = 'image';
    }
    
    if (!mediaType) return null;
    
    return {
      id,
      title: getTitle(path.basename(relativePath)),
      type: mediaType,
      libraryType,
      filename: path.basename(relativePath),
      path: `/stream/${libraryType}/${encodeURIComponent(path.basename(relativePath))}`,
      size: stat.size,
      modified: stat.mtime
    };
  } catch (error) {
    console.error("Error finding media by ID:", error);
    return null;
  }
}

// Extract title from filename (remove extension and replace hyphens/underscores with spaces)
function getTitle(filename) {
  const name = path.basename(filename, path.extname(filename));
  return name.replace(/[._-]/g, ' ');
}

// Helper function to determine content type
function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const contentTypes = {
    '.mp4': 'video/mp4',
    '.mkv': 'video/x-matroska',
    '.avi': 'video/x-msvideo',
    '.mov': 'video/quicktime',
    '.webm': 'video/webm',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.flac': 'audio/flac',
    '.ogg': 'audio/ogg',
    '.aac': 'audio/aac',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp'
  };
  
  return contentTypes[ext] || 'application/octet-stream';
}

// Helper function to generate a unique ID
function generateUniqueId() {
  return crypto.randomBytes(16).toString('hex');
}

// Start server
app.listen(port, () => {
  console.log(`Media server running at http://localhost:${port}`);
  console.log('Media directories:');
  config.mediaFolders.forEach(folder => {
    console.log(`- ${folder.type}: ${folder.path}`);
  });
});
