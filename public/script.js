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
      const items = await response.json();
      
      renderMediaItems(items, library.type);
    } catch (error) {
      mediaGrid.innerHTML = `<div class="loading-message error">Error: ${error.message}</div>`;
    }
  }
  
  // Render media items in the grid
  function renderMediaItems(items, libraryType) {
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
      // Create video element
      const video = document.createElement('video');
      video.controls = true;
      video.autoplay = true;
      // Disable download in video controls
      video.controlsList = "nodownload";
      // Prevent saving video
      video.oncontextmenu = (e) => e.preventDefault();
      
      const source = document.createElement('source');
      source.src = item.path;
      video.appendChild(source);
      
      playerContainer.appendChild(video);
    } else if (item.type === 'audio') {
      // Create audio element
      const audio = document.createElement('audio');
      audio.controls = true;
      audio.autoplay = true;
      // Disable download in audio controls
      audio.controlsList = "nodownload";
      // Prevent saving audio
      audio.oncontextmenu = (e) => e.preventDefault();
      
      const source = document.createElement('source');
      source.src = item.path;
      audio.appendChild(source);
      
      playerContainer.appendChild(audio);
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
});