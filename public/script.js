document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const libraryList = document.getElementById('library-list');
  const currentLibraryTitle = document.getElementById('current-library');
  const mediaGrid = document.getElementById('media-grid');
  const playerOverlay = document.getElementById('player-overlay');
  const playerContainer = document.getElementById('player-container');
  const playingTitle = document.getElementById('playing-title');
  const closePlayerBtn = document.getElementById('close-player');
  
  // Search elements
  const searchInput = document.getElementById('search-input');
  const searchButton = document.getElementById('search-button');
  const searchResults = document.getElementById('search-results');
  const searchGrid = document.getElementById('search-grid');
  const searchCount = document.getElementById('search-count');
  const closeSearchBtn = document.getElementById('close-search');
  
  let currentLibrary = null;
  let searchTimeout = null;
  let isAdmin = false; // Will be set later
  
  // Check if user is admin and setup admin features
  checkAdmin();
  
  // Add logout button to header
  const headerRight = document.querySelector('.header-right');
  const logoutButton = document.createElement('button');
  logoutButton.id = 'logout-button';
  logoutButton.textContent = 'Logout';
  logoutButton.className = 'logout-button';
  logoutButton.addEventListener('click', () => {
    window.location.href = '/logout';
  });
  headerRight.appendChild(logoutButton);
  
  // Add some styling for the buttons
  const style = document.createElement('style');
  style.textContent = `
    .logout-button, .admin-button {
      margin-left: 10px;
      padding: 8px 12px;
      background-color: transparent;
      border: 1px solid rgba(255, 255, 255, 0.3);
      color: var(--text-color);
      border-radius: 4px;
      cursor: pointer;
      transition: background-color 0.3s;
    }
    
    .logout-button:hover, .admin-button:hover {
      background-color: rgba(255, 255, 255, 0.1);
    }
    
    .admin-button {
      background-color: var(--accent-color);
      border-color: var(--accent-color);
    }
    
    .admin-button:hover {
      background-color: #c0392b;
    }
    
    .admin-modal {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(0, 0, 0, 0.8);
      z-index: 1000;
      display: flex;
      justify-content: center;
      align-items: center;
    }
    
    .admin-modal-content {
      background-color: var(--background-medium);
      border-radius: 8px;
      padding: 20px;
      width: 90%;
      max-width: 600px;
      max-height: 80vh;
      overflow-y: auto;
      position: relative;
    }
    
    .admin-modal-close {
      position: absolute;
      top: 10px;
      right: 10px;
      background: none;
      border: none;
      font-size: 24px;
      color: var(--text-color);
      cursor: pointer;
    }
    
    .admin-panel h2 {
      margin-bottom: 20px;
    }
    
    .user-form {
      margin-bottom: 30px;
      padding-bottom: 20px;
      border-bottom: 1px solid var(--background-light);
    }
    
    .user-form-row {
      display: flex;
      margin-bottom: 15px;
      gap: 10px;
    }
    
    .user-form input {
      flex: 1;
      padding: 8px;
      background-color: var(--background-light);
      border: none;
      border-radius: 4px;
      color: var(--text-color);
    }
    
    .user-form label {
      display: flex;
      align-items: center;
      white-space: nowrap;
    }
    
    .user-list {
      width: 100%;
      border-collapse: collapse;
    }
    
    .user-list th, .user-list td {
      text-align: left;
      padding: 8px;
      border-bottom: 1px solid var(--background-light);
    }
    
    .user-list th {
      background-color: var(--background-light);
    }
    
    .user-list tr:hover {
      background-color: rgba(255, 255, 255, 0.05);
    }
    
    .delete-user {
      background-color: var(--accent-color);
      color: white;
      border: none;
      border-radius: 4px;
      padding: 5px 10px;
      cursor: pointer;
    }
    
    .hidden {
      display: none;
    }
    
    .custom-controls {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background-color: rgba(0, 0, 0, 0.7);
      padding: 10px;
      border-radius: 5px;
      position: absolute;
      bottom: 10px;
      left: 50%;
      transform: translateX(-50%);
      width: 90%;
      max-width: 600px;
    }
    
    .custom-controls button, .custom-controls input {
      background: none;
      border: none;
      color: white;
      cursor: pointer;
    }
    
    .custom-controls input[type="range"] {
      width: 100px;
    }
    
    .custom-media {
      width: 100%;
      height: auto;
    }
  `;
  document.head.appendChild(style);
  
  // Load libraries when page loads
  loadLibraries();
  
  // Close player when close button is clicked
  closePlayerBtn.addEventListener('click', () => {
    playerOverlay.classList.add('hidden');
    playerContainer.innerHTML = '';
  });
  
  // Prevent context menu on player overlay (prevents right-click downloads)
  playerOverlay.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    return false;
  });
  
  // Check if user is admin and set up admin panel
  async function checkAdmin() {
    try {
      const response = await fetch('/api/admin/users');
      
      if (response.ok) {
        isAdmin = true;
        setupAdminPanel();
      }
    } catch (error) {
      // User is not admin, do nothing
    }
  }
  
  // Setup admin panel
  function setupAdminPanel() {
    // Create admin button
    const adminButton = document.createElement('button');
    adminButton.id = 'admin-button';
    adminButton.textContent = 'Admin';
    adminButton.className = 'admin-button';
    adminButton.addEventListener('click', openAdminPanel);
    headerRight.insertBefore(adminButton, logoutButton);
    
    // Create admin modal
    const adminModal = document.createElement('div');
    adminModal.id = 'admin-modal';
    adminModal.className = 'admin-modal hidden';
    
    adminModal.innerHTML = `
      <div class="admin-modal-content">
        <button id="admin-modal-close" class="admin-modal-close">×</button>
        <div class="admin-panel">
          <h2>User Management</h2>
          
          <div class="user-form">
            <h3>Create New User</h3>
            <div class="user-form-row">
              <input type="text" id="new-username" placeholder="Username" required>
              <input type="password" id="new-password" placeholder="Password" required>
            </div>
            <div class="user-form-row">
              <label>
                <input type="checkbox" id="new-is-admin">
                Admin privileges
              </label>
              <button id="create-user-btn">Create User</button>
            </div>
            <div id="user-form-message" class="hidden"></div>
          </div>
          
          <h3>Users</h3>
          <table class="user-list">
            <thead>
              <tr>
                <th>Username</th>
                <th>Admin</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody id="user-list-body">
              <!-- Users will be loaded here -->
            </tbody>
          </table>
        </div>
      </div>
    `;
    
    document.body.appendChild(adminModal);
    
    // Add event listeners for admin panel
    document.getElementById('admin-modal-close').addEventListener('click', () => {
      adminModal.classList.add('hidden');
    });
    
    document.getElementById('create-user-btn').addEventListener('click', createUser);
  }
  
  // Open admin panel
  async function openAdminPanel() {
    const adminModal = document.getElementById('admin-modal');
    adminModal.classList.remove('hidden');
    
    // Load users
    await loadUsers();
  }
  
  // Load users for admin panel
  async function loadUsers() {
    try {
      const response = await fetch('/api/admin/users');
      const users = await response.json();
      
      const userListBody = document.getElementById('user-list-body');
      userListBody.innerHTML = '';
      
      users.forEach(user => {
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${user.username}</td>
          <td>${user.isAdmin ? 'Yes' : 'No'}</td>
          <td>
            <button class="delete-user" data-id="${user.id}">Delete</button>
          </td>
        `;
        userListBody.appendChild(row);
      });
      
      // Add event listeners for delete buttons
      document.querySelectorAll('.delete-user').forEach(button => {
        button.addEventListener('click', async (e) => {
          const userId = e.target.dataset.id;
          await deleteUser(userId);
        });
      });
    } catch (error) {
      console.error('Error loading users:', error);
    }
  }
  
  // Create a new user
  async function createUser() {
    const username = document.getElementById('new-username').value;
    const password = document.getElementById('new-password').value;
    const isAdmin = document.getElementById('new-is-admin').checked;
    const messageEl = document.getElementById('user-form-message');
    
    if (!username || !password) {
      messageEl.textContent = 'Username and password are required';
      messageEl.className = 'error';
      messageEl.classList.remove('hidden');
      return;
    }
    
    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, password, isAdmin })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        // Success
        messageEl.textContent = 'User created successfully';
        messageEl.className = 'success';
        messageEl.classList.remove('hidden');
        
        // Clear form
        document.getElementById('new-username').value = '';
        document.getElementById('new-password').value = '';
        document.getElementById('new-is-admin').checked = false;
        
        // Reload users
        await loadUsers();
        
        // Hide message after 3 seconds
        setTimeout(() => {
          messageEl.classList.add('hidden');
        }, 3000);
      } else {
        // Error
        messageEl.textContent = data.error || 'Error creating user';
        messageEl.className = 'error';
        messageEl.classList.remove('hidden');
      }
    } catch (error) {
      console.error('Error creating user:', error);
      messageEl.textContent = 'Error creating user';
      messageEl.className = 'error';
      messageEl.classList.remove('hidden');
    }
  }
  
  // Delete a user
  async function deleteUser(userId) {
    if (confirm('Are you sure you want to delete this user?')) {
      try {
        const response = await fetch(`/api/admin/users/${userId}`, {
          method: 'DELETE'
        });
        
        if (response.ok) {
          // Reload users after deletion
          await loadUsers();
        } else {
          const data = await response.json();
          alert(data.error || 'Error deleting user');
        }
      } catch (error) {
        console.error('Error deleting user:', error);
        alert('Error deleting user');
      }
    }
  }
  
  // Search functionality
  searchButton.addEventListener('click', () => {
    performSearch(searchInput.value);
  });
  
  searchInput.addEventListener('keyup', (e) => {
    if (e.key === 'Enter') {
      performSearch(searchInput.value);
    } else {
      // Debounce search as user types
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        if (searchInput.value.length >= 2) {
          performSearch(searchInput.value);
        }
      }, 500); // Wait 500ms after user stops typing
    }
  });
  
  closeSearchBtn.addEventListener('click', () => {
    searchResults.classList.add('hidden');
    searchInput.value = '';
  });
  
  // Perform search
  async function performSearch(query) {
    if (!query || query.length < 2) {
      searchResults.classList.add('hidden');
      return;
    }
    
    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      const results = await response.json();
      
      if (results.length === 0) {
        searchGrid.innerHTML = '<div class="loading-message">No results found</div>';
        searchCount.textContent = 'No results found';
      } else {
        searchCount.textContent = `Found ${results.length} result${results.length === 1 ? '' : 's'}`;
        renderSearchResults(results, query);
      }
      
      searchResults.classList.remove('hidden');
    } catch (error) {
      searchGrid.innerHTML = `<div class="loading-message error">Error: ${error.message}</div>`;
      searchCount.textContent = 'Error performing search';
      searchResults.classList.remove('hidden');
    }
  }
  
  // Render search results
  function renderSearchResults(results, query) {
    searchGrid.innerHTML = '';
    
    results.forEach(item => {
      const mediaItem = document.createElement('div');
      mediaItem.className = 'media-item';
      mediaItem.dataset.id = item.id;
      
      // Choose icon based on media type
      let icon = '📄';
      if (item.type === 'video') {
        icon = '🎬';
      } else if (item.type === 'audio') {
        icon = '🎵';
      } else if (item.type === 'image') {
        icon = '🖼️';
      }
      
      // Choose poster background based on media type
      let posterStyle = '';
      if (item.type === 'image') {
        // For images, use the actual image as poster
        posterStyle = `background-image: url("${item.path}")`;
      } else {
        // For other media types, use a placeholder color based on the first letter
        const colorIndex = item.title.charCodeAt(0) % 5;
        const colors = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6'];
        posterStyle = `background-color: ${colors[colorIndex]}`;
      }
      
      // Format file size for display
      const fileSize = formatFileSize(item.size);
      
      // Format date for display
      const modifiedDate = new Date(item.modified).toLocaleDateString();
      
      // Highlight the search term in the title
      const titleHighlighted = item.title.replace(new RegExp(query, 'gi'), match => `<span class="highlight">${match}</span>`);
      
      // Add library type badge
      const libraryBadge = item.libraryType.charAt(0).toUpperCase() + item.libraryType.slice(1);
      
      mediaItem.innerHTML = `
        <div class="media-poster" style="${posterStyle}">
          <div class="media-type-icon">${icon}</div>
        </div>
        <div class="media-info">
          <div class="media-title">${titleHighlighted}</div>
          <div class="media-metadata">${fileSize} · ${libraryBadge}</div>
        </div>
      `;
      
      mediaItem.addEventListener('click', () => {
        playMedia(item);
      });
      
      searchGrid.appendChild(mediaItem);
    });
  }
  
  // Load all media libraries
  async function loadLibraries() {
    try {
      const response = await fetch('/api/libraries');
      const libraries = await response.json();
      
      renderLibraries(libraries);
    } catch (error) {
      libraryList.innerHTML = `<li class="nav-item error">Error: ${error.message}</li>`;
    }
  }
  
  // Render the library list in the sidebar
  function renderLibraries(libraries) {
    if (libraries.length === 0) {
      libraryList.innerHTML = '<li class="nav-item">No libraries found</li>';
      return;
    }
    
    libraryList.innerHTML = '';
    
    libraries.forEach(library => {
      const li = document.createElement('li');
      li.className = 'nav-item';
      li.dataset.id = library.id;
      
      // Choose icon based on library type
      let icon = '📁';
      if (library.type === 'movies') {
        icon = '🎬';
      } else if (library.type === 'tvshows') {
        icon = '📺';
      } else if (library.type === 'music') {
        icon = '🎵';
      }
      
      li.innerHTML = `
        <div class="nav-item-icon">${icon}</div>
        <span>${library.name}</span>
      `;
      
      li.addEventListener('click', () => {
        // Highlight selected library
        document.querySelectorAll('.nav-item').forEach(item => {
          item.classList.remove('active');
        });
        li.classList.add('active');
        
        // Close search results when switching libraries
        searchResults.classList.add('hidden');
        searchInput.value = '';
        
        // Load the selected library
        loadLibrary(library);
      });
      
      libraryList.appendChild(li);
    });
    
    // Select first library by default if available
    if (libraries.length > 0) {
      const firstLibrary = libraries[0];
      document.querySelector(`.nav-item[data-id="${firstLibrary.id}"]`).classList.add('active');
      loadLibrary(firstLibrary);
    }
  }
  
  // Load media items for a specific library
  async function loadLibrary(library) {
    currentLibrary = library;
    currentLibraryTitle.textContent = library.name;
    
    mediaGrid.innerHTML = '<div class="loading-message">Loading content...</div>';
    
    try {
      const response = await fetch(`/api/library/${library.type}`);
      
      if (!response.ok) {
        // If the server returns an error, display it properly
        const errorData = await response.json();
        console.error("API error:", errorData.error || "Unknown error");
        mediaGrid.innerHTML = `<div class="loading-message error">Error loading media: ${errorData.error || "Unknown error"}</div>`;
        return;
      }
      
      const items = await response.json();
      
      // Ensure items is always treated as an array
      const mediaItems = Array.isArray(items) ? items : [];
      
      renderMediaItems(mediaItems, library.type);
    } catch (error) {
      console.error("Error fetching library data:", error);
      mediaGrid.innerHTML = `<div class="loading-message error">Error loading media: ${error.message}</div>`;
    }
  }
  
  // Render media items in the grid
  function renderMediaItems(items, libraryType) {
    // Ensure items is an array
    if (!items || !Array.isArray(items)) {
      console.error("Invalid items data:", items);
      mediaGrid.innerHTML = `<div class="loading-message">Error: Invalid media data received</div>`;
      return;
    }
    
    if (items.length === 0) {
      mediaGrid.innerHTML = `<div class="loading-message">No media found in this library</div>`;
      return;
    }
    
    mediaGrid.innerHTML = '';
    
    items.forEach(item => {
      const mediaItem = document.createElement('div');
      mediaItem.className = 'media-item';
      mediaItem.dataset.id = item.id;
      
      // Choose icon based on media type
      let icon = '📄';
      if (item.type === 'video') {
        icon = '🎬';
      } else if (item.type === 'audio') {
        icon = '🎵';
      } else if (item.type === 'image') {
        icon = '🖼️';
      }
      
      // Choose poster background based on media type
      let posterStyle = '';
      if (item.type === 'image') {
        // For images, use the actual image as poster
        posterStyle = `background-image: url("${item.path}")`;
      } else {
        // For other media types, use a placeholder color based on the first letter
        const colorIndex = item.title.charCodeAt(0) % 5;
        const colors = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6'];
        posterStyle = `background-color: ${colors[colorIndex]}`;
      }
      
      // Format file size for display
      const fileSize = formatFileSize(item.size);
      
      // Format date for display
      const modifiedDate = new Date(item.modified).toLocaleDateString();
      
      mediaItem.innerHTML = `
        <div class="media-poster" style="${posterStyle}">
          <div class="media-type-icon">${icon}</div>
        </div>
        <div class="media-info">
          <div class="media-title">${item.title}</div>
          <div class="media-metadata">${fileSize} · ${modifiedDate}</div>
        </div>
      `;
      
      mediaItem.addEventListener('click', () => {
        playMedia(item);
      });
      
      mediaGrid.appendChild(mediaItem);
    });
  }
  
  // Play selected media
  function playMedia(item) {
    playerContainer.innerHTML = '';
    playingTitle.textContent = item.title;
    
    if (item.type === 'video') {
      createEnhancedMediaPlayer('video', item.path, item.title);
    } else if (item.type === 'audio') {
      createEnhancedMediaPlayer('audio', item.path, item.title);
    } else if (item.type === 'image') {
      // Create image element
      const img = document.createElement('img');
      img.src = item.path;
      img.alt = item.title;
      img.className = 'media-preview';
      // Prevent saving image
      img.oncontextmenu = (e) => e.preventDefault();
      // Make image not draggable (prevents drag-and-drop saving)
      img.draggable = false;
      
      playerContainer.appendChild(img);
    }
    
    playerOverlay.classList.remove('hidden');
  }
  
  // Helper function to format file size
  function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // Add custom media player controls
  function createCustomPlayer(mediaType, mediaPath) {
    playerContainer.innerHTML = ''; // Clear previous content

    const mediaElement = document.createElement(mediaType);
    mediaElement.src = mediaPath;
    mediaElement.className = 'custom-media';
    mediaElement.autoplay = true;

    const controls = document.createElement('div');
    controls.className = 'custom-controls';

    const playPauseButton = document.createElement('button');
    playPauseButton.textContent = 'Play';
    playPauseButton.className = 'play-pause';
    playPauseButton.addEventListener('click', () => {
      if (mediaElement.paused) {
        mediaElement.play();
        playPauseButton.textContent = 'Pause';
      } else {
        mediaElement.pause();
        playPauseButton.textContent = 'Play';
      }
    });

    const seekBar = document.createElement('input');
    seekBar.type = 'range';
    seekBar.min = 0;
    seekBar.max = 100;
    seekBar.value = 0;
    seekBar.className = 'seek-bar';
    seekBar.addEventListener('input', () => {
      mediaElement.currentTime = (seekBar.value / 100) * mediaElement.duration;
    });

    mediaElement.addEventListener('timeupdate', () => {
      seekBar.value = (mediaElement.currentTime / mediaElement.duration) * 100;
    });

    const volumeControl = document.createElement('input');
    volumeControl.type = 'range';
    volumeControl.min = 0;
    volumeControl.max = 1;
    volumeControl.step = 0.1;
    volumeControl.value = mediaElement.volume;
    volumeControl.className = 'volume-control';
    volumeControl.addEventListener('input', () => {
      mediaElement.volume = volumeControl.value;
    });

    const fullscreenButton = document.createElement('button');
    fullscreenButton.textContent = 'Fullscreen';
    fullscreenButton.className = 'fullscreen';
    fullscreenButton.addEventListener('click', () => {
      if (playerOverlay.requestFullscreen) {
        playerOverlay.requestFullscreen();
      } else if (playerOverlay.webkitRequestFullscreen) {
        playerOverlay.webkitRequestFullscreen();
      } else if (playerOverlay.msRequestFullscreen) {
        playerOverlay.msRequestFullscreen();
      }
    });

    controls.appendChild(playPauseButton);
    controls.appendChild(seekBar);
    controls.appendChild(volumeControl);
    controls.appendChild(fullscreenButton);

    playerContainer.appendChild(mediaElement);
    playerContainer.appendChild(controls);
  }

  // Enhanced custom media player
  function createEnhancedMediaPlayer(mediaType, mediaPath, mediaTitle) {
    playerContainer.innerHTML = ''; // Clear previous content
    
    // Create container for the player
    const playerWrapper = document.createElement('div');
    playerWrapper.className = 'enhanced-player-wrapper';
    
    // Create media element
    const mediaElement = document.createElement(mediaType);
    mediaElement.className = 'custom-media';
    mediaElement.src = mediaPath;
    mediaElement.autoplay = true;
    // Disable native controls, we'll use our custom ones
    mediaElement.controls = false;
    // Prevent context menu
    mediaElement.oncontextmenu = (e) => e.preventDefault();
    
    // Create loading indicator
    const loadingOverlay = document.createElement('div');
    loadingOverlay.className = 'loading-overlay';
    loadingOverlay.innerHTML = '<div class="spinner"></div>';
    
    // Create play overlay (big play button in center)
    const playOverlay = document.createElement('div');
    playOverlay.className = 'play-overlay';
    playOverlay.innerHTML = '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';
    
    // Create custom controls container
    const controls = document.createElement('div');
    controls.className = 'enhanced-controls';
    
    // Create progress bar container
    const progressContainer = document.createElement('div');
    progressContainer.className = 'progress-container';
    
    // Create progress bar
    const progressBar = document.createElement('div');
    progressBar.className = 'progress-bar';
    
    // Create progress indicator
    const progressIndicator = document.createElement('div');
    progressIndicator.className = 'progress-indicator';
    progressBar.appendChild(progressIndicator);
    
    // Create buffer indicator
    const bufferIndicator = document.createElement('div');
    bufferIndicator.className = 'buffer-indicator';
    progressBar.appendChild(bufferIndicator);
    
    // Add progress bar to container
    progressContainer.appendChild(progressBar);
    
    // Create time display
    const timeDisplay = document.createElement('div');
    timeDisplay.className = 'time-display';
    timeDisplay.textContent = '0:00 / 0:00';
    
    // Create controls row
    const controlsRow = document.createElement('div');
    controlsRow.className = 'controls-row';
    
    // Create play/pause button
    const playPauseButton = document.createElement('button');
    playPauseButton.className = 'control-button play-pause';
    playPauseButton.innerHTML = '<svg class="pause-icon" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>' + 
                                '<svg class="play-icon hidden" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';
    playPauseButton.setAttribute('aria-label', 'Pause');
    
    // Create volume container
    const volumeContainer = document.createElement('div');
    volumeContainer.className = 'volume-container';
    
    // Create volume button
    const volumeButton = document.createElement('button');
    volumeButton.className = 'control-button volume';
    volumeButton.innerHTML = '<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>';
    volumeButton.setAttribute('aria-label', 'Volume');
    
    // Create volume slider
    const volumeSlider = document.createElement('input');
    volumeSlider.type = 'range';
    volumeSlider.min = 0;
    volumeSlider.max = 1;
    volumeSlider.step = 0.01;
    volumeSlider.value = 1;
    volumeSlider.className = 'volume-slider';
    
    // Add elements to volume container
    volumeContainer.appendChild(volumeButton);
    volumeContainer.appendChild(volumeSlider);
    
    // Create speed control
    const speedButton = document.createElement('button');
    speedButton.className = 'control-button speed';
    speedButton.textContent = '1x';
    speedButton.setAttribute('aria-label', 'Playback Speed');
    
    // Create speed menu
    const speedMenu = document.createElement('div');
    speedMenu.className = 'speed-menu hidden';
    
    // Add speed options
    const speeds = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
    speeds.forEach(speed => {
      const option = document.createElement('div');
      option.className = 'speed-option';
      option.textContent = speed + 'x';
      option.dataset.speed = speed;
      
      if (speed === 1) {
        option.classList.add('active');
      }
      
      option.addEventListener('click', () => {
        mediaElement.playbackRate = speed;
        speedButton.textContent = speed + 'x';
        document.querySelectorAll('.speed-option').forEach(opt => opt.classList.remove('active'));
        option.classList.add('active');
        speedMenu.classList.add('hidden');
      });
      
      speedMenu.appendChild(option);
    });
    
    // Create fullscreen button
    const fullscreenButton = document.createElement('button');
    fullscreenButton.className = 'control-button fullscreen';
    fullscreenButton.innerHTML = '<svg viewBox="0 0 24 24"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>';
    fullscreenButton.setAttribute('aria-label', 'Fullscreen');
    
    // Assemble controls
    controlsRow.appendChild(playPauseButton);
    controlsRow.appendChild(timeDisplay);
    controlsRow.appendChild(volumeContainer);
    controlsRow.appendChild(speedButton);
    controlsRow.appendChild(speedMenu);
    controlsRow.appendChild(fullscreenButton);
    
    // Add elements to controls
    controls.appendChild(progressContainer);
    controls.appendChild(controlsRow);
    
    // Add everything to the player wrapper
    playerWrapper.appendChild(mediaElement);
    playerWrapper.appendChild(loadingOverlay);
    playerWrapper.appendChild(playOverlay);
    playerWrapper.appendChild(controls);
    
    // Add player wrapper to the container
    playerContainer.appendChild(playerWrapper);
    
    // Setup event listeners
    
    // Media element events
    mediaElement.addEventListener('loadstart', () => {
      loadingOverlay.classList.remove('hidden');
    });
    
    mediaElement.addEventListener('canplay', () => {
      loadingOverlay.classList.add('hidden');
    });
    
    mediaElement.addEventListener('waiting', () => {
      loadingOverlay.classList.remove('hidden');
    });
    
    mediaElement.addEventListener('playing', () => {
      loadingOverlay.classList.add('hidden');
      playOverlay.classList.add('hidden');
      playPauseButton.querySelector('.play-icon').classList.add('hidden');
      playPauseButton.querySelector('.pause-icon').classList.remove('hidden');
      playPauseButton.setAttribute('aria-label', 'Pause');
    });
    
    mediaElement.addEventListener('pause', () => {
      playOverlay.classList.remove('hidden');
      playPauseButton.querySelector('.play-icon').classList.remove('hidden');
      playPauseButton.querySelector('.pause-icon').classList.add('hidden');
      playPauseButton.setAttribute('aria-label', 'Play');
    });
    
    mediaElement.addEventListener('timeupdate', () => {
      // Update progress bar
      const progress = (mediaElement.currentTime / mediaElement.duration) * 100;
      progressIndicator.style.width = `${progress}%`;
      
      // Update time display
      const currentTime = formatTime(mediaElement.currentTime);
      const duration = formatTime(mediaElement.duration);
      timeDisplay.textContent = `${currentTime} / ${duration}`;
    });
    
    mediaElement.addEventListener('progress', () => {
      // Update buffer bar
      if (mediaElement.buffered.length > 0) {
        const bufferedEnd = mediaElement.buffered.end(mediaElement.buffered.length - 1);
        const duration = mediaElement.duration;
        
        if (duration > 0) {
          const bufferedPercent = (bufferedEnd / duration) * 100;
          bufferIndicator.style.width = `${bufferedPercent}%`;
        }
      }
    });
    
    mediaElement.addEventListener('volumechange', () => {
      volumeSlider.value = mediaElement.volume;
      
      // Update volume icon based on mute state and volume level
      if (mediaElement.muted || mediaElement.volume === 0) {
        volumeButton.innerHTML = '<svg viewBox="0 0 24 24"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>';
      } else if (mediaElement.volume < 0.5) {
        volumeButton.innerHTML = '<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm10-.5v2.03c.84.53 1.41 1.46 1.41 2.52 0 1.06-.57 1.98-1.41 2.51v2.03c1.8-.74 3.07-2.5 3.07-4.54 0-2.04-1.27-3.8-3.07-4.55z"/></svg>';
      } else {
        volumeButton.innerHTML = '<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>';
      }
    });
    
    mediaElement.addEventListener('ended', () => {
      playOverlay.classList.remove('hidden');
      playPauseButton.querySelector('.play-icon').classList.remove('hidden');
      playPauseButton.querySelector('.pause-icon').classList.add('hidden');
      playPauseButton.setAttribute('aria-label', 'Restart');
    });
    
    // Control button events
    playPauseButton.addEventListener('click', () => {
      if (mediaElement.paused) {
        mediaElement.play();
      } else {
        mediaElement.pause();
      }
    });
    
    // Play overlay click
    playOverlay.addEventListener('click', () => {
      mediaElement.play();
    });
    
    // Click on video to toggle play/pause
    mediaElement.addEventListener('click', () => {
      if (mediaElement.paused) {
        mediaElement.play();
      } else {
        mediaElement.pause();
      }
    });
    
    // Progress bar click
    progressBar.addEventListener('click', (e) => {
      const rect = progressBar.getBoundingClientRect();
      const pos = (e.clientX - rect.left) / progressBar.offsetWidth;
      mediaElement.currentTime = pos * mediaElement.duration;
    });
    
    // Make progress bar draggable
    let isDragging = false;
    
    progressBar.addEventListener('mousedown', (e) => {
      isDragging = true;
      updateProgressOnDrag(e);
      
      // Pause while dragging for better UX
      const wasPlaying = !mediaElement.paused;
      if (wasPlaying) {
        mediaElement.pause();
      }
      
      document.addEventListener('mousemove', updateProgressOnDrag);
      document.addEventListener('mouseup', () => {
        isDragging = false;
        document.removeEventListener('mousemove', updateProgressOnDrag);
        
        // Resume playback if it was playing before
        if (wasPlaying) {
          mediaElement.play();
        }
      }, { once: true });
    });
    
    function updateProgressOnDrag(e) {
      if (isDragging) {
        const rect = progressBar.getBoundingClientRect();
        const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / progressBar.offsetWidth));
        mediaElement.currentTime = pos * mediaElement.duration;
      }
    }
    
    // Volume controls
    volumeButton.addEventListener('click', () => {
      mediaElement.muted = !mediaElement.muted;
    });
    
    volumeSlider.addEventListener('input', () => {
      mediaElement.volume = volumeSlider.value;
      mediaElement.muted = false;
    });
    
    // Speed button
    speedButton.addEventListener('click', () => {
      speedMenu.classList.toggle('hidden');
    });
    
    // Hide speed menu when clicking elsewhere
    document.addEventListener('click', (e) => {
      if (!speedButton.contains(e.target) && !speedMenu.contains(e.target)) {
        speedMenu.classList.add('hidden');
      }
    });
    
    // Fullscreen button
    fullscreenButton.addEventListener('click', () => {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        playerWrapper.requestFullscreen();
      }
    });
    
    // Keyboard controls
    document.addEventListener('keydown', handleKeyDown);
    
    function handleKeyDown(e) {
      // Only handle keys if player is visible
      if (playerOverlay.classList.contains('hidden')) {
        return;
      }
      
      switch (e.key) {
        case ' ':
          // Space bar - toggle play/pause
          if (mediaElement.paused) {
            mediaElement.play();
          } else {
            mediaElement.pause();
          }
          e.preventDefault();
          break;
        case 'ArrowRight':
          // Right arrow - forward 10 seconds
          mediaElement.currentTime = Math.min(mediaElement.duration, mediaElement.currentTime + 10);
          e.preventDefault();
          break;
        case 'ArrowLeft':
          // Left arrow - rewind 10 seconds
          mediaElement.currentTime = Math.max(0, mediaElement.currentTime - 10);
          e.preventDefault();
          break;
        case 'ArrowUp':
          // Up arrow - increase volume
          mediaElement.volume = Math.min(1, mediaElement.volume + 0.05);
          mediaElement.muted = false;
          e.preventDefault();
          break;
        case 'ArrowDown':
          // Down arrow - decrease volume
          mediaElement.volume = Math.max(0, mediaElement.volume - 0.05);
          e.preventDefault();
          break;
        case 'm':
          // M key - mute/unmute
          mediaElement.muted = !mediaElement.muted;
          e.preventDefault();
          break;
        case 'f':
          // F key - fullscreen
          if (document.fullscreenElement) {
            document.exitFullscreen();
          } else {
            playerWrapper.requestFullscreen();
          }
          e.preventDefault();
          break;
      }
    }
    
    // Clean up event listeners when closing player
    closePlayerBtn.addEventListener('click', () => {
      document.removeEventListener('keydown', handleKeyDown);
    });
    
    // Helper function to format time (seconds to MM:SS)
    function formatTime(seconds) {
      if (isNaN(seconds)) return '0:00';
      
      const minutes = Math.floor(seconds / 60);
      seconds = Math.floor(seconds % 60);
      
      return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
    }
  }
});