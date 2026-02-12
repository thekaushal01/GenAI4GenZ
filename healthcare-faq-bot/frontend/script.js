// Tailwind Configuration
tailwind.config = {
    darkMode: 'class',
    theme: {
        extend: {
            colors: {
                primary: '#0891B2',    // Cyan-600
                secondary: '#0369A1',  // Sky-700
                accent: '#059669',     // Emerald-600
                medical: '#06B6D4',    // Cyan-500
            }
        }
    }
};

// ==================== GLOBAL STATE ====================
const API_BASE_URL = 'http://localhost:8000';
let currentSessionId = null;
let chatSessions = [];
let isRecording = false;

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', () => {
    initializeTheme();
    initializeSessions();
    initializeEventListeners();
    checkHealth();
});

// ==================== THEME MANAGEMENT ====================
const themeToggleBtn = document.getElementById('theme-toggle');
const themeToggleDarkIcon = document.getElementById('theme-toggle-dark-icon');
const themeToggleLightIcon = document.getElementById('theme-toggle-light-icon');

function getThemePreference() {
    if (localStorage.getItem('color-theme')) {
        return localStorage.getItem('color-theme');
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function setTheme(theme) {
    if (theme === 'dark') {
        document.documentElement.classList.add('dark');
        themeToggleLightIcon.classList.remove('hidden');
        themeToggleDarkIcon.classList.add('hidden');
    } else {
        document.documentElement.classList.remove('dark');
        themeToggleDarkIcon.classList.remove('hidden');
        themeToggleLightIcon.classList.add('hidden');
    }
    localStorage.setItem('color-theme', theme);
}

function initializeTheme() {
    setTheme(getThemePreference());
    themeToggleBtn.addEventListener('click', () => {
        const currentTheme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        setTheme(newTheme);
    });
}

// ==================== MOBILE SIDEBAR ====================
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    const isOpen = sidebar.classList.contains('sidebar-open');
    
    if (isOpen) {
        // Close sidebar
        sidebar.classList.remove('sidebar-open');
        if (overlay) {
            overlay.classList.remove('active');
        }
        // Re-enable body scroll
        document.body.style.overflow = '';
    } else {
        // Open sidebar
        sidebar.classList.add('sidebar-open');
        if (overlay) {
            overlay.classList.add('active');
        }
        // Prevent body scroll when sidebar is open on mobile
        if (window.innerWidth < 768) {
            document.body.style.overflow = 'hidden';
        }
    }
}

// Close sidebar on Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const sidebar = document.getElementById('sidebar');
        if (sidebar && sidebar.classList.contains('sidebar-open')) {
            toggleSidebar();
        }
    }
});

// Close sidebar when window is resized to desktop
window.addEventListener('resize', () => {
    if (window.innerWidth >= 768) {
        const sidebar = document.getElementById('sidebar');
        if (sidebar && sidebar.classList.contains('sidebar-open')) {
            toggleSidebar();
        }
    }
});

// ==================== DESKTOP SIDEBAR COLLAPSE ====================
function toggleSidebarCollapse() {
    const sidebar = document.getElementById('sidebar');
    const collapseBtn = document.getElementById('sidebar-collapse-btn');
    const expandBtn = document.getElementById('sidebar-expand-btn');
    const isCollapsed = sidebar.classList.contains('sidebar-closed');
    
    if (isCollapsed) {
        // Expand sidebar
        sidebar.classList.remove('sidebar-closed');
        if (expandBtn) {
            expandBtn.classList.add('hidden');
            expandBtn.classList.remove('md:block');
        }
        if (collapseBtn) {
            collapseBtn.classList.remove('hidden');
        }
    } else {
        // Collapse sidebar completely
        sidebar.classList.add('sidebar-closed');
        if (expandBtn) {
            expandBtn.classList.remove('hidden');
            expandBtn.classList.add('md:block');
        }
        if (collapseBtn) {
            collapseBtn.classList.add('hidden');
        }
    }
    
    // Save collapse state
    localStorage.setItem('sidebar-collapsed', isCollapsed ? 'false' : 'true');
}

// Restore sidebar collapse state on load
window.addEventListener('load', () => {
    // Set up overlay click handler
    const overlay = document.getElementById('sidebar-overlay');
    if (overlay) {
        overlay.addEventListener('click', toggleSidebar);
    }
    
    // Restore collapse state for desktop
    const isCollapsed = localStorage.getItem('sidebar-collapsed') === 'true';
    if (isCollapsed && window.innerWidth >= 768) {
        const sidebar = document.getElementById('sidebar');
        if (sidebar) {
            sidebar.classList.add('sidebar-closed');
            const expandBtn = document.getElementById('sidebar-expand-btn');
            const collapseBtn = document.getElementById('sidebar-collapse-btn');
            if (expandBtn) {
                expandBtn.classList.remove('hidden');
                expandBtn.classList.add('md:block');
            }
            if (collapseBtn) {
                collapseBtn.classList.add('hidden');
            }
        }
    }
});

// ==================== SESSION MANAGEMENT ====================
function initializeSessions() {
    const savedSessions = localStorage.getItem('chatSessions');
    if (savedSessions) {
        chatSessions = JSON.parse(savedSessions);
        renderSessions();
        
        // Load the most recent session
        if (chatSessions.length > 0) {
            currentSessionId = chatSessions[0].id;
            loadSession(currentSessionId);
        } else {
            createNewSession();
        }
    } else {
        createNewSession();
    }
}

function createNewSession() {
    const sessionId = Date.now().toString();
    const newSession = {
        id: sessionId,
        title: 'New Chat',
        date: new Date().toISOString(),
        messages: []
    };
    
    chatSessions.unshift(newSession);
    currentSessionId = sessionId;
    
    saveSessions();
    renderSessions();
    clearChatContainer();
}

function loadSession(sessionId) {
    currentSessionId = sessionId;
    const session = chatSessions.find(s => s.id === sessionId);
    
    if (session) {
        clearChatContainer();
        
        // Restore messages
        if (session.messages && session.messages.length > 0) {
            session.messages.forEach(msg => {
                addMessage(msg.content, msg.role, msg.meta, false);
            });
        }
        
        // Update active state
        renderSessions();
    }
}

function deleteSession(sessionId) {
    chatSessions = chatSessions.filter(s => s.id !== sessionId);
    saveSessions();
    renderSessions();
    
    if (currentSessionId === sessionId) {
        if (chatSessions.length > 0) {
            loadSession(chatSessions[0].id);
        } else {
            createNewSession();
        }
    }
}

function updateSessionTitle(sessionId, message) {
    const session = chatSessions.find(s => s.id === sessionId);
    if (session && session.title === 'New Chat') {
        session.title = message.substring(0, 40) + (message.length > 40 ? '...' : '');
        saveSessions();
        renderSessions();
    }
}

function saveSessions() {
    localStorage.setItem('chatSessions', JSON.stringify(chatSessions));
}

function renderSessions() {
    const container = document.getElementById('chat-sessions');
    
    if (chatSessions.length === 0) {
        container.innerHTML = `
            <div class="text-center text-gray-500 dark:text-gray-400 text-sm py-8">
                <p>No chat history yet</p>
                <p class="text-xs mt-2">Start a conversation!</p>
            </div>
        `;
        return;
    }
    
    const groupedSessions = groupSessionsByDate(chatSessions);
    
    container.innerHTML = '';
    Object.keys(groupedSessions).forEach(dateGroup => {
        const groupDiv = document.createElement('div');
        groupDiv.className = 'mb-4';
        
        const dateHeader = document.createElement('div');
        dateHeader.className = 'text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 px-2';
        dateHeader.textContent = dateGroup;
        groupDiv.appendChild(dateHeader);
        
        groupedSessions[dateGroup].forEach(session => {
            const sessionDiv = document.createElement('div');
            sessionDiv.className = `session-item p-3 rounded-xl mb-2 ${session.id === currentSessionId ? 'bg-primary/20 border border-primary' : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700'}`;
            
            sessionDiv.innerHTML = `
                <div class="flex items-start justify-between gap-2">
                    <div class="flex-1 min-w-0">
                        <h4 class="text-sm font-medium text-gray-900 dark:text-white truncate">${escapeHtml(session.title)}</h4>
                        <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">${formatSessionTime(session.date)}</p>
                    </div>
                    <button onclick="deleteSession('${session.id}')" class="p-1 rounded-lg hover:bg-red-500/20 transition-colors duration-200" title="Delete">
                        <svg class="w-4 h-4 text-gray-400 hover:text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                        </svg>
                    </button>
                </div>
            `;
            
            sessionDiv.addEventListener('click', (e) => {
                if (!e.target.closest('button')) {
                    loadSession(session.id);
                }
            });
            
            groupDiv.appendChild(sessionDiv);
        });
        
        container.appendChild(groupDiv);
    });
}

function groupSessionsByDate(sessions) {
    const groups = {};
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    sessions.forEach(session => {
        const sessionDate = new Date(session.date);
        let groupKey;
        
        if (isSameDay(sessionDate, today)) {
            groupKey = 'Today';
        } else if (isSameDay(sessionDate, yesterday)) {
            groupKey = 'Yesterday';
        } else if (isThisWeek(sessionDate)) {
            groupKey = 'This Week';
        } else if (isThisMonth(sessionDate)) {
            groupKey = 'This Month';
        } else {
            groupKey = sessionDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        }
        
        if (!groups[groupKey]) {
            groups[groupKey] = [];
        }
        groups[groupKey].push(session);
    });
    
    return groups;
}

function isSameDay(date1, date2) {
    return date1.getDate() === date2.getDate() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getFullYear() === date2.getFullYear();
}

function isThisWeek(date) {
    const today = new Date();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay());
    return date >= weekStart && date <= today;
}

function isThisMonth(date) {
    const today = new Date();
    return date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
}

function formatSessionTime(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ==================== EVENT LISTENERS ====================
function initializeEventListeners() {
    // New Chat Button
    document.getElementById('new-chat-btn').addEventListener('click', createNewSession);
    
    // Sidebar Toggle
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const mobileSidebarToggle = document.getElementById('mobile-sidebar-toggle');
    const sidebar = document.getElementById('sidebar');
    
    // Function to update toggle button visibility
    function updateToggleVisibility() {
        if (sidebar.classList.contains('sidebar-closed')) {
            mobileSidebarToggle.classList.remove('hidden');
        } else {
            mobileSidebarToggle.classList.add('hidden');
        }
    }
    
    sidebarToggle.addEventListener('click', () => {
        sidebar.classList.toggle('sidebar-closed');
        updateToggleVisibility();
    });
    
    mobileSidebarToggle.addEventListener('click', () => {
        sidebar.classList.toggle('sidebar-closed');
        updateToggleVisibility();
    });
    
    // Input handling
    const userInput = document.getElementById('user-input');
    
    // Auto-resize textarea
    userInput.addEventListener('input', () => {
        userInput.style.height = 'auto';
        userInput.style.height = userInput.scrollHeight + 'px';
        
        // Smart suggestions while typing
        const length = userInput.value.length;
        if (length > 10 && length % 20 === 0) {
            showSmartSuggestions(userInput.value);
        }
    });
    
    // Enter to send, Shift+Enter for new line
    userInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    
    // Voice input button
    const voiceBtn = document.getElementById('voice-btn');
    voiceBtn.addEventListener('click', toggleVoiceRecording);
    
    // Attach file button
    const attachBtn = document.getElementById('attach-btn');
    attachBtn.addEventListener('click', openFileDialog);
    
    // Drag and drop functionality
    const inputArea = document.querySelector('.flex-1.relative.group');
    const dragDropZone = document.getElementById('drag-drop-zone');
    
    inputArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        dragDropZone.classList.remove('hidden');
        dragDropZone.classList.add('active');
    });
    
    inputArea.addEventListener('dragleave', (e) => {
        if (e.target === inputArea) {
            dragDropZone.classList.add('hidden');
            dragDropZone.classList.remove('active');
        }
    });
    
    inputArea.addEventListener('drop', (e) => {
        e.preventDefault();
        dragDropZone.classList.add('hidden');
        dragDropZone.classList.remove('active');
        handleFileUpload(e.dataTransfer.files);
    });
    
    // Navbar scroll effect
    const chatContainer = document.getElementById('chat-container');
    const navbar = document.querySelector('nav');
    
    chatContainer.addEventListener('scroll', () => {
        if (chatContainer.scrollTop > 50) {
            navbar.classList.add('shadow-2xl');
            navbar.style.borderBottomWidth = '2px';
        } else {
            navbar.classList.remove('shadow-2xl');
            navbar.style.borderBottomWidth = '1px';
        }
    });
    
    // Global keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Escape key closes modals
        if (e.key === 'Escape') {
            closeEmojiPicker();
            const toolbar = document.getElementById('formatting-toolbar');
            if (toolbar.classList.contains('show')) {
                toolbar.classList.remove('show');
                toolbar.classList.add('hidden');
            }
        }
        
        // Ctrl/Cmd + / toggles formatting toolbar
        if ((e.ctrlKey || e.metaKey) && e.key === '/') {
            e.preventDefault();
            toggleFormattingToolbar();
        }
    });
}

// ==================== VOICE RECORDING ====================
function toggleVoiceRecording() {
    const voiceBtn = document.getElementById('voice-btn');
    const recordingIndicator = document.getElementById('recording-indicator');
    
    isRecording = !isRecording;
    
    if (isRecording) {
        recordingIndicator.classList.remove('hidden');
        voiceBtn.classList.add('text-red-500');
        
        // Simulate voice recording (in real app, use Web Speech API)
        setTimeout(() => {
            isRecording = false;
            recordingIndicator.classList.add('hidden');
            voiceBtn.classList.remove('text-red-500');
            document.getElementById('user-input').value = 'What are the symptoms of diabetes?';
        }, 2000);
    } else {
        recordingIndicator.classList.add('hidden');
        voiceBtn.classList.remove('text-red-500');
    }
}

// ==================== CHAT FUNCTIONALITY ====================
async function sendMessage() {
    const input = document.getElementById('user-input');
    const sendBtn = document.getElementById('send-btn');
    const question = input.value.trim();
    
    if (!question) return;
    
    // Disable input
    input.disabled = true;
    sendBtn.disabled = true;
    
    // Add user message
    addMessage(question, 'user');
    
    // Update session title if new
   updateSessionTitle(currentSessionId, question);
    
    // Clear input and reset height
    input.value = '';
    input.style.height = 'auto';
    
    // Clear attached files
    attachedFiles = [];
    const attachedFilesContainer = document.getElementById('attached-files');
    attachedFilesContainer.innerHTML = '';
    attachedFilesContainer.classList.add('hidden');
    
    // Hide smart suggestions
    document.getElementById('smart-suggestions').classList.add('hidden');
    
    // Show typing indicator
    showTypingIndicator();
    
    // Hide quick actions after first message
    const welcome = document.querySelector('.welcome-container');
    if (welcome) {
        welcome.style.display = 'none';
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ message: question })
        });
        
        const data = await response.json();
        
        // Hide typing indicator
        hideTypingIndicator();
        
        if (data.response) {
            const meta = {
                diseases: data.matched_diseases || [],
                tokens: data.tokens_used || 0
            };
            addMessage(data.response, 'assistant', meta);
            showQuickReplies(data.matched_diseases);
        } else {
            addMessage('Sorry, I encountered an error. Please try again.', 'assistant');
        }
    } catch (error) {
        hideTypingIndicator();
        addMessage('❌ Could not connect to server. Please make sure the backend is running.', 'assistant');
    }
    
    // Re-enable input
    input.disabled = false;
    sendBtn.disabled = false;
    input.focus();
}

function askQuestion(question) {
    document.getElementById('user-input').value = question;
    sendMessage();
}

// ==================== MESSAGE HANDLING ====================
function addMessage(content, role, meta = null, saveToHistory = true) {
    const chatContainer = document.getElementById('chat-container');
    const timestamp = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    
    // Remove welcome message if exists
    const welcome = chatContainer.querySelector('.welcome-container');
    if (welcome) {
        welcome.remove();
    }

    const messageDiv = document.createElement('div');
    messageDiv.className = 'message-enter mb-4';

    if (role === 'user') {
        messageDiv.innerHTML = `
            <div class="flex justify-end items-end gap-1.5 sm:gap-2">
                <div class="max-w-[85%] sm:max-w-[80%] md:max-w-[75%] user-message text-white px-3 sm:px-4 md:px-5 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl rounded-tr-sm shadow-lg">
                    <p class="text-sm md:text-base leading-relaxed">${escapeHtml(content)}</p>
                    <p class="message-time text-right mt-1 text-xs sm:text-[10px]">${timestamp}</p>
                </div>
            </div>
        `;
    } else {
        let metaHtml = '';
        if (meta && (meta.diseases?.length > 0 || meta.tokens)) {
            const parts = [];
            if (meta.diseases && meta.diseases.length > 0) {
                parts.push(`<span class="inline-flex items-center gap-1"><svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z"/></svg> ${meta.diseases.join(', ')}</span>`);
            }
            if (meta.tokens) {
                parts.push(`<span class="inline-flex items-center gap-1"><svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg> ${meta.tokens} tokens</span>`);
            }
            metaHtml = `<div class="flex flex-wrap gap-3 text-xs text-gray-500 dark:text-gray-400 mt-2">${parts.join('')}</div>`;
        }

        messageDiv.innerHTML = `
            <div class="flex justify-start items-end gap-1.5 sm:gap-2">
                <div class="flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-r from-primary to-secondary flex items-center justify-center text-white text-xs sm:text-sm font-bold shadow-lg">
                    AI
                </div>
                <div class="max-w-[85%] sm:max-w-[85%] md:max-w-[80%]">
                    <div class="assistant-message text-gray-900 dark:text-white px-3 sm:px-4 md:px-5 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl rounded-tl-sm shadow-lg border border-gray-200 dark:border-gray-600">
                        <div class="message-content text-sm md:text-base leading-relaxed"></div>
                        <p class="message-time mt-2 text-xs sm:text-[10px]">${timestamp}</p>
                    </div>
                    ${metaHtml}
                </div>
            </div>
        `;
    }

    chatContainer.appendChild(messageDiv);
    
    // Typewriter effect for assistant messages
    if (role === 'assistant') {
        const contentElement = messageDiv.querySelector('.message-content');
        const formattedContent = formatContent(content);
        typewriterEffect(contentElement, formattedContent);
    } else {
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }
    
    // Save to session history
    if (saveToHistory) {
        const session = chatSessions.find(s => s.id === currentSessionId);
        if (session) {
            session.messages.push({ content, role, meta, timestamp: new Date().toISOString() });
            saveSessions();
        }
    }
}

function formatContent(content) {
    let formatted = content
        .replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-primary dark:text-purple-400">$1</strong>')
        .replace(/^[•\-]\s+(.+)$/gm, '<li class="ml-4">$1</li>')
        .replace(/\n/g, '<br>');
    
    // Wrap list items in <ul>
    if (formatted.includes('<li>')) {
        formatted = formatted.replace(/(<li>.*?<\/li>(<br>)?)+/gs, function(match) {
            return '<ul class="list-disc list-inside space-y-1 my-2">' + match.replace(/<br>/g, '') + '</ul>';
        });
    }
    
    return formatted;
}

function typewriterEffect(element, html) {
    const chatContainer = document.getElementById('chat-container');
    const speed = 10; // Faster typing
    
    // Parse HTML into array of characters and tags
    const parts = [];
    let temp = '';
    let inTag = false;
    
    for (let i = 0; i < html.length; i++) {
        const char = html[i];
        
        if (char === '<') {
            if (temp) parts.push({ type: 'text', content: temp });
            temp = '<';
            inTag = true;
        } else if (char === '>' && inTag) {
            temp += '>';
            parts.push({ type: 'tag', content: temp });
            temp = '';
            inTag = false;
        } else {
            temp += char;
        }
    }
    if (temp) parts.push({ type: 'text', content: temp });
    
    let currentHtml = '';
    let partIndex = 0;
    let charIndex = 0;
    
    function type() {
        if (partIndex < parts.length) {
            const part = parts[partIndex];
            
            if (part.type === 'tag') {
                currentHtml += part.content;
                partIndex++;
                element.innerHTML = currentHtml;
                chatContainer.scrollTop = chatContainer.scrollHeight;
                setTimeout(type, 0);
            } else {
                if (charIndex < part.content.length) {
                    currentHtml += part.content[charIndex];
                    charIndex++;
                    element.innerHTML = currentHtml;
                    chatContainer.scrollTop = chatContainer.scrollHeight;
                    setTimeout(type, speed);
                } else {
                    charIndex = 0;
                    partIndex++;
                    setTimeout(type, 0);
                }
            }
        }
    }
    
    type();
}

function showTypingIndicator() {
    const chatContainer = document.getElementById('chat-container');
    const indicator = document.createElement('div');
    indicator.id = 'typing-indicator';
    indicator.className = 'message-enter mb-4';
    indicator.innerHTML = `
        <div class="flex justify-start items-end gap-2">
            <div class="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-r from-primary to-secondary flex items-center justify-center text-white text-sm font-bold shadow-lg animate-pulse">
                AI
            </div>
            <div class="bg-white dark:bg-gray-700 px-6 py-4 rounded-2xl rounded-tl-sm shadow-lg border border-gray-200 dark:border-gray-600 flex items-center gap-3">
                <span class="thinking-pulse text-2xl">🤔</span>
                <span class="text-sm text-gray-600 dark:text-gray-300 font-medium">Thinking</span>
                <div class="flex gap-1.5">
                    <div class="w-2 h-2 bg-primary rounded-full dot-bounce"></div>
                    <div class="w-2 h-2 bg-primary rounded-full dot-bounce"></div>
                    <div class="w-2 h-2 bg-primary rounded-full dot-bounce"></div>
                </div>
            </div>
        </div>
    `;
    chatContainer.appendChild(indicator);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

function hideTypingIndicator() {
    const indicator = document.getElementById('typing-indicator');
    if (indicator) {
        indicator.remove();
    }
}

// ==================== QUICK REPLIES ====================
function showQuickReplies(diseases) {
    const quickRepliesContainer = document.getElementById('quick-replies');
    
    if (!diseases || diseases.length === 0) {
        quickRepliesContainer.classList.add('hidden');
        return;
    }
    
    const replies = [
        `Tell me more about ${diseases[0]}`,
        `What are the treatment options?`,
        `How can I prevent this?`,
        `Are there any complications?`
    ];
    
    quickRepliesContainer.innerHTML = replies.map(reply => `
        <button onclick="askQuestion('${reply.replace(/'/g, "\\'")}')" class="px-4 py-2 bg-gradient-to-r from-primary/10 to-secondary/10 hover:from-primary hover:to-secondary hover:text-white border border-primary/30 rounded-full text-sm text-gray-700 dark:text-gray-200 transition-all duration-300 hover:scale-105 hover:shadow-lg">
            ${reply}
        </button>
    `).join('');
    
    quickRepliesContainer.classList.remove('hidden');
}

// ==================== UTILITY FUNCTIONS ====================
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

function clearChatContainer() {
    const chatContainer = document.getElementById('chat-container');
    chatContainer.innerHTML = `
        <div class="welcome-container text-center max-w-3xl mx-auto flex flex-col justify-center items-center min-h-full">
            <div class="text-7xl mb-6 animate-bounce-slow inline-block">👋</div>
            <h2 class="text-3xl font-bold text-gray-900 dark:text-white mb-4 animate-fade-in">Welcome to MediCare AI!</h2>
            <p class="text-gray-600 dark:text-gray-300 mb-8 leading-relaxed text-lg animate-fade-in">
                Your trusted healthcare companion, available 24/7. Ask me about medical conditions,
                symptoms, treatments, preventive care, or general wellness guidance.
            </p>
            
            <div class="mb-8">
                <h3 class="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-4 uppercase tracking-wide">Quick Actions</h3>
                <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <button onclick="askQuestion('What are the symptoms of flu?')" class="quick-action-btn group p-4 bg-white dark:bg-gray-700 rounded-2xl border-2 border-gray-200 dark:border-gray-600 hover:border-primary dark:hover:border-primary hover:scale-105 transition-all duration-300 hover:shadow-xl">
                        <div class="text-3xl mb-2 group-hover:scale-110 transition-transform duration-300">🤒</div>
                        <span class="text-sm font-medium text-gray-700 dark:text-gray-200 group-hover:text-primary dark:group-hover:text-primary">Flu Info</span>
                    </button>
                    
                    <button onclick="askQuestion('How to prevent diabetes?')" class="quick-action-btn group p-4 bg-white dark:bg-gray-700 rounded-2xl border-2 border-gray-200 dark:border-gray-600 hover:border-primary dark:hover:border-primary hover:scale-105 transition-all duration-300 hover:shadow-xl">
                        <div class="text-3xl mb-2 group-hover:scale-110 transition-transform duration-300">🩺</div>
                        <span class="text-sm font-medium text-gray-700 dark:text-gray-200 group-hover:text-primary dark:group-hover:text-primary">Diabetes</span>
                    </button>
                    
                    <button onclick="askQuestion('What causes migraines?')" class="quick-action-btn group p-4 bg-white dark:bg-gray-700 rounded-2xl border-2 border-gray-200 dark:border-gray-600 hover:border-primary dark:hover:border-primary hover:scale-105 transition-all duration-300 hover:shadow-xl">
                        <div class="text-3xl mb-2 group-hover:scale-110 transition-transform duration-300">🧠</div>
                        <span class="text-sm font-medium text-gray-700 dark:text-gray-200 group-hover:text-primary dark:group-hover:text-primary">Migraines</span>
                    </button>
                    
                    <button onclick="askQuestion('Managing anxiety and stress')" class="quick-action-btn group p-4 bg-white dark:bg-gray-700 rounded-2xl border-2 border-gray-200 dark:border-gray-600 hover:border-primary dark:hover:border-primary hover:scale-105 transition-all duration-300 hover:shadow-xl">
                        <div class="text-3xl mb-2 group-hover:scale-110 transition-transform duration-300">😌</div>
                        <span class="text-sm font-medium text-gray-700 dark:text-gray-200 group-hover:text-primary dark:group-hover:text-primary">Anxiety</span>
                    </button>
                </div>
            </div>

            <div>
                <h3 class="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-4 uppercase tracking-wide">Suggested Questions</h3>
                <div class="flex flex-wrap gap-2 justify-center">
                    <button onclick="askQuestion('What are healthy blood pressure levels?')" class="suggested-prompt px-4 py-2 bg-white/80 dark:bg-gray-700/80 backdrop-blur-sm rounded-full text-sm text-gray-700 dark:text-gray-200 hover:bg-primary hover:text-white dark:hover:bg-primary transition-all duration-200 hover:scale-105 border border-gray-200 dark:border-gray-600">
                        Blood Pressure Info
                    </button>
                    <button onclick="askQuestion('Best exercises for arthritis')" class="suggested-prompt px-4 py-2 bg-white/80 dark:bg-gray-700/80 backdrop-blur-sm rounded-full text-sm text-gray-700 dark:text-gray-200 hover:bg-primary hover:text-white dark:hover:bg-primary transition-all duration-200 hover:scale-105 border border-gray-200 dark:border-gray-600">
                        Arthritis Exercises
                    </button>
                    <button onclick="askQuestion('COVID-19 prevention tips')" class="suggested-prompt px-4 py-2 bg-white/80 dark:bg-gray-700/80 backdrop-blur-sm rounded-full text-sm text-gray-700 dark:text-gray-200 hover:bg-primary hover:text-white dark:hover:bg-primary transition-all duration-200 hover:scale-105 border border-gray-200 dark:border-gray-600">
                        COVID Safety
                    </button>
                    <button onclick="askQuestion('Healthy sleep habits')" class="suggested-prompt px-4 py-2 bg-white/80 dark:bg-gray-700/80 backdrop-blur-sm rounded-full text-sm text-gray-700 dark:text-gray-200 hover:bg-primary hover:text-white dark:hover:bg-primary transition-all duration-200 hover:scale-105 border border-gray-200 dark:border-gray-600">
                        Sleep Tips
                    </button>
                </div>
            </div>
        </div>
    `;
}

// ==================== SERVER HEALTH CHECK ====================
async function checkHealth() {
    try {
        const response = await fetch(`${API_BASE_URL}/health`);
        const data = await response.json();
    } catch (error) {
        // Server not running
    }
}
// ==================== EMOJI PICKER ====================
const emojiCategories = {
    'Smileys': ['😀', '😃', '😄', '😁', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩', '🥳'],
    'Health': ['🏥', '⚕️', '💊', '💉', '🩺', '🩹', '🩼', '🦷', '🧬', '🔬', '🧪', '🧫', '🩻', '❤️', '🫀', '🫁', '🧠', '👁️', '🦴', '💪'],
    'Emotions': ['😀', '😢', '😭', '😤', '😠', '😡', '🤬', '😱', '😨', '😰', '😥', '😓', '🤗', '🤔', '🤭', '🤫', '🤥', '😶', '😐', '😑', '😬', '🙄', '😯', '😦', '😧', '😮', '😲', '🥱', '😴', '🤤'],
    'Gestures': ['👍', '👎', '👊', '✊', '🤛', '🤜', '🤞', '✌️', '🤟', '🤘', '👌', '🤌', '🤏', '👈', '👉', '👆', '👇', '☝️', '👋', '🤚', '🖐️', '✋', '🖖', '👏', '🙌', '👐', '🤲', '🤝', '🙏']
};

let attachedFiles = [];

function openEmojiPicker() {
    const emojiPicker = document.getElementById('emoji-picker');
    const emojiGrid = document.getElementById('emoji-grid');
    
    // Populate emoji grid
    emojiGrid.innerHTML = '';
    Object.values(emojiCategories).flat().forEach(emoji => {
        const emojiBtn = document.createElement('button');
        emojiBtn.className = 'emoji-item';
        emojiBtn.textContent = emoji;
        emojiBtn.onclick = () => insertEmoji(emoji);
        emojiGrid.appendChild(emojiBtn);
    });
    
    emojiPicker.classList.remove('hidden');
    
    // Close on background click
    emojiPicker.onclick = (e) => {
        if (e.target === emojiPicker) {
            closeEmojiPicker();
        }
    };
}

function closeEmojiPicker() {
    const emojiPicker = document.getElementById('emoji-picker');
    emojiPicker.classList.add('hidden');
}

function insertEmoji(emoji) {
    const userInput = document.getElementById('user-input');
    const start = userInput.selectionStart;
    const end = userInput.selectionEnd;
    const text = userInput.value;
    
    userInput.value = text.substring(0, start) + emoji + text.substring(end);
    userInput.focus();
    userInput.selectionStart = userInput.selectionEnd = start + emoji.length;
    
    // Trigger input event to update char count
    userInput.dispatchEvent(new Event('input'));
    
    closeEmojiPicker();
}

// ==================== FORMATTING TOOLBAR ====================
function toggleFormattingToolbar() {
    const toolbar = document.getElementById('formatting-toolbar');
    toolbar.classList.toggle('hidden');
    toolbar.classList.toggle('show');
}

function insertFormatting(prefix, suffix, placeholder) {
    const userInput = document.getElementById('user-input');
    const start = userInput.selectionStart;
    const end = userInput.selectionEnd;
    const selectedText = userInput.value.substring(start, end);
    const textToInsert = selectedText || placeholder;
    
    const formattedText = prefix + textToInsert + suffix;
    userInput.value = userInput.value.substring(0, start) + formattedText + userInput.value.substring(end);
    
    userInput.focus();
    
    // Select the inserted text
    if (selectedText) {
        userInput.selectionStart = start;
        userInput.selectionEnd = start + formattedText.length;
    } else {
        userInput.selectionStart = start + prefix.length;
        userInput.selectionEnd = start + prefix.length + textToInsert.length;
    }
    
    // Trigger input event to update char count
    userInput.dispatchEvent(new Event('input'));
}

function clearInput() {
    const userInput = document.getElementById('user-input');
    userInput.value = '';
    userInput.style.height = 'auto';
    userInput.focus();
}

// ==================== FILE UPLOAD ====================
function openFileDialog() {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = 'image/*,.pdf,.doc,.docx,.txt';
    input.onchange = (e) => handleFileUpload(e.target.files);
    input.click();
}

function handleFileUpload(files) {
    const attachedFilesContainer = document.getElementById('attached-files');
    
    Array.from(files).forEach(file => {
        if (file.size > 10 * 1024 * 1024) { // 10MB limit
            alert(`File ${file.name} is too large. Maximum size is 10MB.`);
            return;
        }
        
        attachedFiles.push(file);
        
        const filePreview = document.createElement('div');
        filePreview.className = 'file-preview';
        filePreview.innerHTML = `
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/>
            </svg>
            <span>${file.name.length > 20 ? file.name.substring(0, 20) + '...' : file.name}</span>
            <button onclick="removeFile('${file.name}')" class="ml-2 hover:bg-white/20 rounded-full p-1 transition-all">
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                </svg>
            </button>
        `;
        
        attachedFilesContainer.appendChild(filePreview);
        attachedFilesContainer.classList.remove('hidden');
    });
}

function removeFile(fileName) {
    attachedFiles = attachedFiles.filter(file => file.name !== fileName);
    const attachedFilesContainer = document.getElementById('attached-files');
    
    // Remove the preview element
    const previews = attachedFilesContainer.children;
    for (let i = 0; i < previews.length; i++) {
        if (previews[i].textContent.includes(fileName)) {
            previews[i].remove();
            break;
        }
    }
    
    if (attachedFiles.length === 0) {
        attachedFilesContainer.classList.add('hidden');
    }
}

// ==================== SMART SUGGESTIONS ====================
const healthSuggestions = {
    'symptoms': ['What are the early symptoms?', 'How long do symptoms last?', 'When should I see a doctor?'],
    'treatment': ['What are the treatment options?', 'Are there natural remedies?', 'What medications are available?'],
    'prevention': ['How can I prevent this?', 'What lifestyle changes help?', 'Are vaccines available?'],
    'diabetes': ['How to manage diabetes?', 'Diabetes diet tips', 'Blood sugar monitoring'],
    'flu': ['Flu vs cold symptoms', 'Flu prevention tips', 'When to get flu shot?'],
    'anxiety': ['Anxiety management techniques', 'Natural anxiety relief', 'When to seek help?'],
    'headache': ['Types of headaches', 'Migraine triggers', 'Headache relief methods'],
    'exercise': ['Best exercises for health', 'Exercise frequency tips', 'Safety precautions'],
    'diet': ['Healthy eating tips', 'Balanced diet guide', 'Foods to avoid'],
    'sleep': ['Improve sleep quality', 'Sleep hygiene tips', 'Sleep disorders']
};

function showSmartSuggestions(text) {
    const smartSuggestions = document.getElementById('smart-suggestions');
    const suggestionItems = document.getElementById('suggestion-items');
    const lowerText = text.toLowerCase();
    
    let suggestions = [];
    
    // Find relevant suggestions based on keywords
    Object.keys(healthSuggestions).forEach(keyword => {
        if (lowerText.includes(keyword)) {
            suggestions = healthSuggestions[keyword];
        }
    });
    
    if (suggestions.length > 0) {
        suggestionItems.innerHTML = '';
        suggestions.forEach(suggestion => {
            const suggestionBtn = document.createElement('button');
            suggestionBtn.className = 'suggestion-item';
            suggestionBtn.textContent = suggestion;
            suggestionBtn.onclick = () => {
                document.getElementById('user-input').value = suggestion;
                smartSuggestions.classList.add('hidden');
                document.getElementById('user-input').dispatchEvent(new Event('input'));
            };
            suggestionItems.appendChild(suggestionBtn);
        });
        smartSuggestions.classList.remove('hidden');
    } else {
        smartSuggestions.classList.add('hidden');
    }
}