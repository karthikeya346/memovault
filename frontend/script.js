// API Configuration
const API_URL = "http://localhost:5000/notes";

// Fetch with timeout helper (1.5s) to fail fast on DB connection hangs
async function fetchWithTimeout(resource, options = {}) {
    const { timeout = 1500 } = options;
    
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    
    try {
        const response = await fetch(resource, {
            ...options,
            signal: controller.signal
        });
        clearTimeout(id);
        return response;
    } catch (err) {
        clearTimeout(id);
        throw err;
    }
}

// Application State
let allNotes = [];
let filteredNotes = [];
let editingId = null;
let currentSelectedColor = 'theme-violet';
let activeFilterType = 'all'; // 'all', 'pinned', 'tag'
let activeFilterTag = null;
let isLocalStorageMode = false;

// DOM Elements Cache
const noteComposer = document.getElementById("noteComposer");
const toggleComposerBtn = document.getElementById("toggleComposerBtn");
const cancelBtn = document.getElementById("cancelBtn");
const clearComposerBtn = document.getElementById("clearComposerBtn");
const saveBtn = document.getElementById("saveBtn");
const composerTitleText = document.getElementById("composerTitleText");

const noteTitleInput = document.getElementById("noteTitleInput");
const noteContentInput = document.getElementById("noteContentInput");
const noteTagsInput = document.getElementById("noteTagsInput");
const themePalette = document.getElementById("themePalette");

const searchInput = document.getElementById("searchInput");
const filterAllBtn = document.getElementById("filterAllBtn");
const filterPinnedBtn = document.getElementById("filterPinnedBtn");
const tagsFilterContainer = document.getElementById("tagsFilterContainer");

const pinnedSection = document.getElementById("pinnedSection");
const pinnedNotesGrid = document.getElementById("pinnedNotesGrid");
const notesGrid = document.getElementById("notesGrid");
const notesGridTitle = document.getElementById("notesGridTitle");
const notesSectionDivider = document.getElementById("notesSectionDivider");

const loadingState = document.getElementById("loadingState");
const emptyState = document.getElementById("emptyState");
const emptyStateCreateBtn = document.getElementById("emptyStateCreateBtn");

const totalNotesCount = document.getElementById("totalNotesCount");
const pinnedNotesCount = document.getElementById("pinnedNotesCount");

const toast = document.getElementById("toast");
const toastMessage = document.getElementById("toastMessage");

// Modal elements Cache
const noteModal = document.getElementById("noteModal");
const closeModalBtn = document.getElementById("closeModalBtn");
const modalPinIndicator = document.getElementById("modalPinIndicator");
const modalNoteTitle = document.getElementById("modalNoteTitle");
const modalNoteContent = document.getElementById("modalNoteContent");
const modalNoteTags = document.getElementById("modalNoteTags");
const modalNoteDate = document.getElementById("modalNoteDate");
const modalEditBtn = document.getElementById("modalEditBtn");
const modalDeleteBtn = document.getElementById("modalDeleteBtn");

// ==========================================
// INITIALIZATION & EVENT LISTENERS
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    loadNotes();
    setupEventListeners();
    setupCanvasParticles();
    setupCursorGlow();
});

function setupEventListeners() {
    // Composer toggle actions
    toggleComposerBtn.addEventListener("click", toggleComposer);
    cancelBtn.addEventListener("click", collapseComposer);
    clearComposerBtn.addEventListener("click", clearComposer);
    emptyStateCreateBtn.addEventListener("click", () => {
        expandComposer();
        noteTitleInput.focus();
    });

    // Save action
    saveBtn.addEventListener("click", saveNote);

    // Color dot selectors
    const colorDots = themePalette.querySelectorAll(".color-dot");
    colorDots.forEach(dot => {
        dot.addEventListener("click", (e) => {
            colorDots.forEach(d => d.classList.remove("active"));
            e.target.classList.add("active");
            currentSelectedColor = e.target.getAttribute("data-color");
        });
    });

    // Filtering inputs
    searchInput.addEventListener("input", filterAndRender);
    filterAllBtn.addEventListener("click", () => setNavFilter('all'));
    filterPinnedBtn.addEventListener("click", () => setNavFilter('pinned'));
    
    // Modal actions
    if (closeModalBtn) {
        closeModalBtn.addEventListener("click", closeNoteModal);
    }
    if (noteModal) {
        noteModal.addEventListener("click", (e) => {
            if (e.target === noteModal) closeNoteModal();
        });
    }
}

// ==========================================
// COMPOSER UX LOGIC
// ==========================================
function toggleComposer() {
    if (noteComposer.classList.contains("collapsed")) {
        expandComposer();
    } else {
        collapseComposer();
    }
}

function expandComposer() {
    noteComposer.classList.remove("collapsed");
    toggleComposerBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="width: 16px; height: 16px; margin-right: 8px;">
            <path d="M18 15L12 9L6 15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <span>Hide Editor</span>
    `;
}

function collapseComposer() {
    noteComposer.classList.add("collapsed");
    toggleComposerBtn.innerHTML = `
        <svg class="btn-icon-plus" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 5V19M5 12H19" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <span>New Note</span>
    `;
    
    // Clear state after transition
    setTimeout(resetComposerState, 350);
}

function clearComposer() {
    noteTitleInput.value = "";
    noteContentInput.value = "";
    noteTagsInput.value = "";
}

function resetComposerState() {
    clearComposer();
    editingId = null;
    composerTitleText.textContent = "Capture a New Memory";
    saveBtn.textContent = "Save Memory";
    
    // Reset active color selector to violet
    const colorDots = themePalette.querySelectorAll(".color-dot");
    colorDots.forEach(d => {
        d.classList.remove("active");
        if (d.getAttribute("data-color") === 'theme-violet') {
            d.classList.add("active");
        }
    });
    currentSelectedColor = 'theme-violet';
}

// ==========================================
// API SYNCHRONIZATION & DATA UTILITIES
// ==========================================

// Parse MongoDB note with backward-compatible legacy checking
function parseNote(dbNote) {
    let title = "";
    let content = "";
    let color = "theme-violet";
    let tags = [];
    let pinned = false;

    try {
        // Try parsing the title field as a JSON packet
        const data = JSON.parse(dbNote.title);
        title = data.t || "";
        content = data.c || "";
        color = data.g || "theme-violet";
        tags = data.tg || [];
        pinned = !!data.p;
    } catch (e) {
        // If parsing fails, it's a legacy note
        title = "Legacy Note";
        content = dbNote.title || "";
        color = "theme-violet";
        tags = ["legacy"];
        pinned = false;
    }

    return {
        _id: dbNote._id,
        title,
        content,
        color,
        tags,
        pinned,
        updatedAt: dbNote.updatedAt || new Date().toISOString()
    };
}

// Format client note into database-compatible format (JSON in title)
function serializeNote(title, content, color, tags, pinned) {
    const payload = {
        t: title.trim(),
        c: content.trim(),
        g: color,
        tg: tags.map(tag => tag.trim().toLowerCase()).filter(tag => tag !== ""),
        p: !!pinned
    };
    return {
        title: JSON.stringify(payload)
    };
}

function updateConnectionStatus(online) {
    let statusBadge = document.getElementById("connectionStatusBadge");
    if (!statusBadge) {
        statusBadge = document.createElement("div");
        statusBadge.id = "connectionStatusBadge";
        statusBadge.style.fontSize = "0.75rem";
        statusBadge.style.fontWeight = "600";
        statusBadge.style.padding = "6px 12px";
        statusBadge.style.borderRadius = "999px";
        statusBadge.style.display = "flex";
        statusBadge.style.alignItems = "center";
        statusBadge.style.gap = "6px";
        statusBadge.style.marginLeft = "auto";
        statusBadge.style.marginRight = "16px";
        statusBadge.style.transition = "all 0.3s ease";
        
        const header = document.querySelector(".app-header");
        if (header) {
            header.insertBefore(statusBadge, document.getElementById("toggleComposerBtn"));
        }
    }
    
    if (online) {
        statusBadge.style.background = "rgba(16, 185, 129, 0.1)";
        statusBadge.style.color = "#10b981";
        statusBadge.style.border = "1px solid rgba(16, 185, 129, 0.2)";
        statusBadge.innerHTML = `<span style="width:6px; height:6px; background:#10b981; border-radius:50%"></span> Vault Connected`;
    } else {
        statusBadge.style.background = "rgba(245, 158, 11, 0.1)";
        statusBadge.style.color = "#f59e0b";
        statusBadge.style.border = "1px solid rgba(245, 158, 11, 0.2)";
        statusBadge.innerHTML = `<span style="width:6px; height:6px; background:#f59e0b; border-radius:50%; animation: pulseGlow 1.5s infinite"></span> Local Storage (Offline)`;
    }
}

async function loadNotes() {
    showLoading(true);
    try {
        const response = await fetchWithTimeout(API_URL);
        if (!response.ok) throw new Error("Server returned error status " + response.status);
        const dbNotes = await response.json();
        
        // Parse notes into client-usable format
        allNotes = dbNotes.map(parseNote);
        isLocalStorageMode = false;
        updateConnectionStatus(true);
        
        // Update stats counters
        updateStats();
        
        // Generate Dynamic Tag Filters sidebar
        buildTagList(allNotes);
        
        // Apply search & visual rendering
        filterAndRender();
    } catch (error) {
        console.warn("API error loading notes, falling back to LocalStorage:", error);
        isLocalStorageMode = true;
        updateConnectionStatus(false);
        
        const localData = localStorage.getItem("memovault_notes");
        if (localData) {
            try {
                allNotes = JSON.parse(localData);
            } catch (e) {
                allNotes = [];
            }
        } else {
            allNotes = [];
        }
        
        // Update stats counters
        updateStats();
        
        // Generate Dynamic Tag Filters sidebar
        buildTagList(allNotes);
        
        // Apply search & visual rendering
        filterAndRender();
    } finally {
        showLoading(false);
    }
}

async function saveNote() {
    const title = noteTitleInput.value.trim();
    const content = noteContentInput.value.trim();
    const tagString = noteTagsInput.value.trim();
    
    if (title === "" && content === "") {
        showToast("Note cannot be completely empty!");
        return;
    }
    
    // Parse tag inputs
    const tags = tagString ? tagString.split(",").map(t => t.trim().toLowerCase()).filter(t => t !== "") : [];
    
    // Check if we are updating an existing note or creating a new one
    let isPinned = false;
    if (editingId) {
        // Retain pinned status if editing
        const existing = allNotes.find(n => n._id === editingId);
        if (existing) isPinned = existing.pinned;
    }
    
    if (isLocalStorageMode) {
        const localId = editingId || 'local_' + Date.now();
        const localNote = {
            _id: localId,
            title,
            content,
            color: currentSelectedColor,
            tags,
            pinned: isPinned,
            updatedAt: new Date().toISOString()
        };
        
        if (editingId) {
            const idx = allNotes.findIndex(n => n._id === editingId);
            if (idx !== -1) {
                allNotes[idx] = localNote;
                showToast("Memory Updated Locally");
            }
        } else {
            allNotes.push(localNote);
            showToast("Memory Saved Locally");
        }
        
        localStorage.setItem("memovault_notes", JSON.stringify(allNotes));
        collapseComposer();
        loadNotes();
        return;
    }
    
    const dbData = serializeNote(title, content, currentSelectedColor, tags, isPinned);
    
    try {
        if (editingId) {
            // Edit mode (PUT request)
            const response = await fetchWithTimeout(`${API_URL}/${editingId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(dbData)
            });
            if (response.ok) {
                showToast("Memory Updated Successfully");
            }
        } else {
            // Creation mode (POST request)
            const response = await fetchWithTimeout(API_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(dbData)
            });
            if (response.ok) {
                showToast("Memory Saved to Vault");
            }
        }
        
        collapseComposer();
        loadNotes();
    } catch (error) {
        console.error("API error saving note:", error);
        showToast("Failed to save note to server");
    }
}

async function deleteNote(id) {
    if (!confirm("Are you sure you want to purge this memory from the vault?")) return;
    
    if (isLocalStorageMode) {
        allNotes = allNotes.filter(n => n._id !== id);
        localStorage.setItem("memovault_notes", JSON.stringify(allNotes));
        showToast("Memory Purged Locally");
        loadNotes();
        return;
    }
    
    try {
        const response = await fetchWithTimeout(`${API_URL}/${id}`, {
            method: "DELETE"
        });
        if (response.ok) {
            showToast("Memory Purged Successfully");
            loadNotes();
        }
    } catch (error) {
        console.error("API error deleting note:", error);
        showToast("Failed to delete note");
    }
}

async function togglePin(id) {
    const note = allNotes.find(n => n._id === id);
    if (!note) return;
    
    const nextPinnedState = !note.pinned;
    
    if (isLocalStorageMode) {
        note.pinned = nextPinnedState;
        localStorage.setItem("memovault_notes", JSON.stringify(allNotes));
        showToast(nextPinnedState ? "Memory Pinned Locally" : "Memory Unpinned Locally");
        loadNotes();
        return;
    }
    
    const dbData = serializeNote(note.title, note.content, note.color, note.tags, nextPinnedState);
    
    try {
        const response = await fetchWithTimeout(`${API_URL}/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(dbData)
        });
        if (response.ok) {
            showToast(nextPinnedState ? "Memory Pinned to Top" : "Memory Unpinned");
            loadNotes();
        }
    } catch (error) {
        console.error("API error pinning note:", error);
        showToast("Failed to toggle pin state");
    }
}

function startEdit(id) {
    const note = allNotes.find(n => n._id === id);
    if (!note) return;
    
    editingId = id;
    composerTitleText.textContent = "Modify Saved Memory";
    saveBtn.textContent = "Update Note";
    
    noteTitleInput.value = note.title;
    noteContentInput.value = note.content;
    noteTagsInput.value = note.tags.join(", ");
    
    // Select correct theme color dot
    const colorDots = themePalette.querySelectorAll(".color-dot");
    colorDots.forEach(d => {
        d.classList.remove("active");
        if (d.getAttribute("data-color") === note.color) {
            d.classList.add("active");
        }
    });
    currentSelectedColor = note.color;
    
    expandComposer();
    
    // Smooth scroll to top of workspace
    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}

// ==========================================
// STATS & SIDEBAR FILTERS
// ==========================================
function updateStats() {
    totalNotesCount.innerText = allNotes.length;
    pinnedNotesCount.innerText = allNotes.filter(n => n.pinned).length;
}

function buildTagList(notes) {
    const tagCounts = {};
    notes.forEach(note => {
        if (note.tags && Array.isArray(note.tags)) {
            note.tags.forEach(tag => {
                if (tag) {
                    tagCounts[tag] = (tagCounts[tag] || 0) + 1;
                }
            });
        }
    });

    tagsFilterContainer.innerHTML = "";
    
    const sortedTags = Object.keys(tagCounts).sort();
    
    if (sortedTags.length === 0) {
        tagsFilterContainer.innerHTML = `<div style="font-size:0.75rem; color:var(--text-muted); padding:8px 16px;">No tags in vault</div>`;
        return;
    }

    sortedTags.forEach(tag => {
        const btn = document.createElement("button");
        btn.className = `tag-filter-btn ${activeFilterType === 'tag' && activeFilterTag === tag ? 'active' : ''}`;
        
        btn.innerHTML = `
            <span><span class="tag-dot"></span>${tag}</span>
            <span class="tag-count">${tagCounts[tag]}</span>
        `;
        
        btn.addEventListener("click", () => {
            setNavFilter('tag', tag);
        });
        
        tagsFilterContainer.appendChild(btn);
    });
}

function setNavFilter(type, tag = null) {
    activeFilterType = type;
    activeFilterTag = tag;
    
    // Reset active visual states in sidebar
    filterAllBtn.classList.remove("active");
    filterPinnedBtn.classList.remove("active");
    
    if (type === 'all') {
        filterAllBtn.classList.add("active");
    } else if (type === 'pinned') {
        filterPinnedBtn.classList.add("active");
    }
    
    // Re-build tag lists to draw correct highlight states
    buildTagList(allNotes);
    
    // Filter and Render
    filterAndRender();
}

// ==========================================
// RENDER & SEARCH CORE LOGIC
// ==========================================
function filterAndRender() {
    const searchQuery = searchInput.value.trim().toLowerCase();
    
    // 1. Filter by Sidebar Category/Tag
    let filtered = allNotes;
    if (activeFilterType === 'pinned') {
        filtered = allNotes.filter(n => n.pinned);
        notesGridTitle.innerText = "PINNED MEMORIES";
        notesSectionDivider.style.display = "flex";
    } else if (activeFilterType === 'tag') {
        filtered = allNotes.filter(n => n.tags && n.tags.includes(activeFilterTag));
        notesGridTitle.innerText = `MEMORIES TAGGED: ${activeFilterTag.toUpperCase()}`;
        notesSectionDivider.style.display = "flex";
    } else {
        notesGridTitle.innerText = "ALL MEMORIES";
        notesSectionDivider.style.display = "flex";
    }
    
    // 2. Filter by search input match
    if (searchQuery !== "") {
        filtered = filtered.filter(note => 
            note.title.toLowerCase().includes(searchQuery) ||
            note.content.toLowerCase().includes(searchQuery) ||
            (note.tags && note.tags.some(tag => tag.toLowerCase().includes(searchQuery)))
        );
    }
    
    // 3. Separate Pinned vs Regular Grid rendering
    // NOTE: If we are in Pinned mode or Tag filtering, we render everything in a single grid
    const hasPinnedSeparation = (activeFilterType === 'all' && searchQuery === "");
    
    if (hasPinnedSeparation) {
        const pinnedList = filtered.filter(n => n.pinned);
        const regularList = filtered.filter(n => !n.pinned);
        
        renderGrid(pinnedNotesGrid, pinnedList);
        renderGrid(notesGrid, regularList);
        
        if (pinnedList.length > 0) {
            pinnedSection.style.display = "flex";
        } else {
            pinnedSection.style.display = "none";
        }
        
        // Hide standard headers if the grids themselves are blank
        if (pinnedList.length === 0 && regularList.length === 0) {
            emptyState.style.display = "block";
            notesSectionDivider.style.display = "none";
        } else {
            emptyState.style.display = "none";
            notesSectionDivider.style.display = "flex";
        }
    } else {
        // Render unified list in the main grid, hide secondary pinned section
        pinnedSection.style.display = "none";
        renderGrid(notesGrid, filtered);
        
        if (filtered.length === 0) {
            emptyState.style.display = "block";
            notesSectionDivider.style.display = "none";
        } else {
            emptyState.style.display = "none";
            notesSectionDivider.style.display = "flex";
        }
    }
}

function renderGrid(container, notes) {
    container.innerHTML = "";
    
    notes.forEach((note, index) => {
        const card = document.createElement("div");
        card.className = `note-card ${note.color || 'theme-violet'}`;
        card.style.animationDelay = `${index * 0.05}s`;
        
        // Click to view full details in Modal
        card.setAttribute("onclick", `viewNoteDetails('${note._id}', event)`);
        
        // Format timestamp
        let formattedDate = "Saved recently";
        if (note.updatedAt) {
            try {
                const dateObj = new Date(note.updatedAt);
                formattedDate = dateObj.toLocaleDateString(undefined, { 
                    month: 'short', 
                    day: 'numeric', 
                    year: 'numeric' 
                });
            } catch(e) {}
        }
        
        // Tags rendering
        let tagsHtml = "";
        if (note.tags && note.tags.length > 0) {
            tagsHtml = `
                <div class="card-tags">
                    ${note.tags.map(tag => `<span class="card-tag-pill">#${tag}</span>`).join('')}
                </div>
            `;
        }
        
        card.innerHTML = `
            <div>
                <div class="card-header">
                    <h4 class="card-title">${escapeHTML(note.title || "Untitled Memory")}</h4>
                    <button class="card-pin-btn ${note.pinned ? 'active' : ''}" onclick="togglePin('${note._id}')" title="${note.pinned ? 'Unpin Note' : 'Pin Note'}">
                        <svg viewBox="0 0 24 24" fill="${note.pinned ? 'currentColor' : 'none'}" xmlns="http://www.w3.org/2000/svg">
                            <path d="M12 2V22M12 2L19 9H12M12 2L5 9H12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            <path d="M12 17L19 10M12 17L5 10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </button>
                </div>
                <div class="card-body">${escapeHTML(note.content || "")}</div>
            </div>
            <div>
                ${tagsHtml}
                <div class="card-footer">
                    <span class="card-date">${formattedDate}</span>
                    <div class="card-actions">
                        <button class="card-action-btn edit-btn" onclick="startEdit('${note._id}')" title="Edit Memory">
                            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </button>
                        <button class="card-action-btn delete-btn" onclick="deleteNote('${note._id}')" title="Delete Memory">
                            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <polyline points="3 6 5 6 21 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                <line x1="10" y1="11" x2="10" y2="17" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                <line x1="14" y1="11" x2="14" y2="17" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        container.appendChild(card);
    });
}

function viewNoteDetails(id, event) {
    // If click was inside a button/control, ignore modal trigger
    if (event.target.closest('button')) {
        return;
    }
    
    const note = allNotes.find(n => n._id === id);
    if (!note) return;
    
    modalNoteTitle.textContent = note.title || "Untitled Memory";
    modalNoteContent.textContent = note.content || "";
    
    // Format timestamp
    let formattedDate = "Saved recently";
    if (note.updatedAt) {
        try {
            const dateObj = new Date(note.updatedAt);
            formattedDate = dateObj.toLocaleDateString(undefined, { 
                month: 'short', 
                day: 'numeric', 
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch(e) {}
    }
    modalNoteDate.textContent = "Saved on " + formattedDate;
    
    // Tags rendering
    modalNoteTags.innerHTML = "";
    if (note.tags && note.tags.length > 0) {
        note.tags.forEach(tag => {
            const span = document.createElement("span");
            span.className = "card-tag-pill";
            span.textContent = "#" + tag;
            modalNoteTags.appendChild(span);
        });
    }
    
    // Pin Indicator
    if (note.pinned) {
        modalPinIndicator.style.display = "inline-block";
    } else {
        modalPinIndicator.style.display = "none";
    }
    
    // Setup actions
    modalEditBtn.onclick = () => {
        closeNoteModal();
        startEdit(note._id);
    };
    
    modalDeleteBtn.onclick = () => {
        closeNoteModal();
        deleteNote(note._id);
    };
    
    // Open modal view
    noteModal.style.display = "flex";
}

function closeNoteModal() {
    noteModal.style.display = "none";
}

// ==========================================
// UI STATE UTILITIES
// ==========================================
function showLoading(show) {
    if (loadingState) {
        loadingState.style.display = show ? "flex" : "none";
    }
}

let toastTimeout = null;
function showToast(message) {
    toastMessage.textContent = message;
    toast.classList.add("show");
    
    if (toastTimeout) clearTimeout(toastTimeout);
    
    toastTimeout = setTimeout(() => {
        toast.classList.remove("show");
    }, 3000);
}

function escapeHTML(str) {
    if (!str) return '';
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// ==========================================
// PREMIUM FX: VISUALS, GLOWS, & PARTICLES
// ==========================================
function setupCursorGlow() {
    const glow = document.getElementById("cursorGlow");
    if (!glow) return;
    
    document.addEventListener("mousemove", (e) => {
        glow.style.left = `${e.clientX}px`;
        glow.style.top = `${e.clientY}px`;
    });
}

function setupCanvasParticles() {
    const canvas = document.getElementById("particles");
    if (!canvas) return;
    
    const ctx = canvas.getContext("2d");
    
    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    
    window.addEventListener("resize", resizeCanvas);
    resizeCanvas();
    
    let particles = [];
    const maxParticles = 60;
    
    for (let i = 0; i < maxParticles; i++) {
        particles.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            r: Math.random() * 1.5 + 0.5,
            dx: (Math.random() - 0.5) * 0.3,
            dy: (Math.random() - 0.5) * 0.3,
            alpha: Math.random() * 0.4 + 0.1
        });
    }
    
    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Draw constellation lines first
        for (let i = 0; i < particles.length; i++) {
            for (let j = i + 1; j < particles.length; j++) {
                const p1 = particles[i];
                const p2 = particles[j];
                
                const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
                if (dist < 110) {
                    const alpha = (1 - dist / 110) * 0.08;
                    ctx.beginPath();
                    ctx.moveTo(p1.x, p1.y);
                    ctx.lineTo(p2.x, p2.y);
                    ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
                    ctx.lineWidth = 0.5;
                    ctx.stroke();
                }
            }
        }
        
        // Draw and update particles
        particles.forEach(p => {
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 255, 255, ${p.alpha * 0.35})`; // Soft silver/white monochrome particles
            ctx.fill();
            
            p.x += p.dx;
            p.y += p.dy;
            
            // Bounds check
            if (p.x < 0 || p.x > canvas.width) p.dx *= -1;
            if (p.y < 0 || p.y > canvas.height) p.dy *= -1;
        });
        
        requestAnimationFrame(draw);
    }
    
    draw();
}