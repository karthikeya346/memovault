# 🧠 MemoVault — Premium Personal Knowledge Workspace

MemoVault is a stunning, high-fidelity, and premium single-page web workspace designed to act as your "Second Brain". Capture thoughts, tag inspirations, pin important memories, and customize your note board inside a clean, ultra-responsive greyscale dashboard.

---

## 📸 Interface Preview & Design Philosophy
* **Carbon Monochrome Theme**: Designed using a curated greyscale palette (`#08080a` true black carbon background, slate borders, and soft silver-white accents) for a distraction-free, minimalist layout.
* **Interactive Neural Network**: The background features a floating canvas particle constellation that dynamically connects nodes as they drift, mirroring synaptic connections in a brain.
* **Responsive Layout**: Two-column layout on desktops featuring a persistent filter/stats sidebar, collapsing seamlessly into a single-column layout on mobile devices.

---

## ✨ Key Features

### 1. Advanced Note Composer
* Capture structured data with fields for **Note Title**, **Note Body**, **Tag Chips** (comma-separated), and **Color Accent Gradient Palettes** (Violet Dream, Emerald Aurora, Ocean Breeze, Sunset Coral, Warm Amber, Obsidian).
* The editor is collapsible to keep the workspace clean when not in use.

### 2. Smart Pinning & Real-time Filters
* **Star Pinning**: Keeps critical notes in a separate, dedicated "Pinned Memories" section at the top of your workspace.
* **Tag Filter System**: Dynamically extracts unique tags from all your notes, displays them in the sidebar, and allows you to filter the entire grid by a tag in a single click.
* **Real-time Search**: Search notes instantly as you type (matches note title, body text, or tags).

### 3. Fail-Safe Resilience & Fallback
* **1.5-Second Connection Timeout**: Uses an `AbortController` wrapper. If the backend server or the MongoDB cluster hangs (e.g. during a network interruption or database connection retry), the frontend times out in 1.5 seconds.
* **Automatic LocalStorage Fallback**: When the backend is offline, the app switches to LocalStorage and shows an amber **`Local Storage (Offline)`** badge. You can continue creating, editing, pinning, and deleting notes without losing data.
* **Automatic Recovery**: Reconnects instantly and displays a green **`Vault Connected`** badge once the backend is reachable.

### 4. 100% Backward Compatible
* Stretches a simple backend schema (which only supports a single `title` field) by serializing the rich layout data as a JSON string inside the title field.
* Automatically parses legacy plain text notes and renders them gracefully as generic text notes, ensuring zero database migration overhead or crashes.

---

## 🛠️ Technology Stack
* **Frontend**: Vanilla HTML5, CSS3 (Custom variables, glassmorphism, keyframe transitions), ES6 JavaScript.
* **Typography**: Space Grotesk (headings and logo branding), Sora (body content, notes, and user controls).
* **Backend**: Node.js, Express, Mongoose (MongoDB ODM), CORS, Dotenv.

---

## 🚀 Setup & Execution

### Prerequisites
* [Node.js](https://nodejs.org/) installed on your machine.
* A [MongoDB Atlas](https://www.mongodb.com/products/platform/atlas-database) cluster or local MongoDB instance running.

### 1. Run the Backend Server
1. Navigate to the `backend` folder:
   ```bash
   cd backend
   ```
2. Make sure dependencies are installed:
   ```bash
   npm install
   ```
3. Configure the `.env` file with your Mongo URI:
   ```env
   PORT=5000
   MONGO_URI=your_mongodb_connection_string
   ```
4. Start the server:
   ```bash
   node server.js
   ```

> [!NOTE]
> If you encounter a `MongooseServerSelectionError`, verify that your current IP address is whitelisted in your MongoDB Atlas Security settings under **Network Access** (`0.0.0.0/0` allows access from all IPs).

### 2. Run the Frontend Server
To serve the static HTML files without browser caching:
1. Navigate to the `frontend` folder:
   ```bash
   cd frontend
   ```
2. Serve the static site using `http-server` with caching disabled:
   ```bash
   npx http-server -p 3000 -c-1
   ```
3. Open your browser and navigate to:
   👉 **[http://localhost:3000](http://localhost:3000)**

---

## 📂 Project Structure
```
notes-app/
├── backend/
│   ├── models/
│   │   └── Note.js        # Mongoose Note Schema (title string)
│   ├── routes/
│   │   └── notes.js       # CRUD endpoints
│   ├── server.js          # Express app configuration & server startup
│   ├── .env               # Port and DB credentials
│   └── package.json
└── frontend/
    ├── index.html         # Workspace structures & inline SVGs
    ├── style.css          # Design system, variables, & keyframe animations
    └── script.js          # Client logic, JSON-wrap, & interactive canvas
```

---

## 🎨 Author & Designer
* **Designed & Built by**: [Karthikeya Saran](https://github.com/KarthikeyaSaran)
* **Design Philosophy**: Minimalist glassmorphism, responsive dashboard grids, and tactile micro-animations.
