# SyncCodes - Project Documentation

## 📋 Table of Contents

1. [Project Overview](#project-overview)
2. [Technology Stack](#technology-stack)
3. [Architecture & System Flow](#architecture--system-flow)
4. [Features](#features)
5. [AI Model & Fine-Tuning](#ai-model--fine-tuning)
6. [Setup & Installation](#setup--installation)
7. [Project Screenshots](#project-screenshots)
8. [Known Issues](#known-issues)
9. [Future Enhancements](#future-enhancements)

---

## 🎯 Project Overview

**SyncCodes** is a real-time collaborative coding platform that enables multiple users to code, communicate, and collaborate seamlessly. The platform integrates code editing, video conferencing, code execution, collaborative whiteboard, and AI-powered interview question generation in a single unified environment.

### Key Highlights

- ✅ Real-time code collaboration with instant synchronization
- ✅ WebRTC-powered video conferencing and screen sharing
- ✅ Multi-language code execution (JavaScript, Python, Java, C#, PHP)
- ✅ Collaborative whiteboard with drawing and erasing tools
- ✅ AI-powered resume interview question generation using fine-tuned LLM
- ✅ No sign-up required - instant session creation
- ✅ Dark/Light theme support
- ✅ Cross-platform compatibility

**Live Demo**: [https://www.synccode.live/](https://www.synccode.live/)

---

## 🛠️ Technology Stack

### Frontend

| Technology | Version | Purpose |
|------------|---------|---------|
| React.js | 19.0.0 | UI framework |
| React Router DOM | 6.20.1 | Client-side routing |
| CodeMirror | 5.65.18 | Code editor with syntax highlighting |
| Konva.js | 9.3.0 | 2D canvas for whiteboard |
| React Konva | 18.2.10 | React bindings for Konva |
| Socket.IO Client | 4.8.1 | Real-time communication |
| Tailwind CSS | 3.4.17 | Utility-first CSS framework |
| Material-UI | 6.3.0 | UI component library |
| React Player | 2.16.0 | Video streaming |
| Axios | 1.7.9 | HTTP client |
| Yjs | 13.6.21 | CRDT for conflict-free editing |
| Liveblocks | 2.15.0 | Real-time collaboration infrastructure |

### Backend

| Technology | Version | Purpose |
|------------|---------|---------|
| Node.js | Latest LTS | Runtime environment |
| Express.js | 4.21.2 | Web framework |
| Socket.IO | 4.8.1 | WebSocket server |
| Multer | 1.4.5-lts.1 | File upload handling |
| PDF Parse | 1.1.1 | PDF file parsing |
| Mammoth | 1.8.0 | DOCX file parsing |

### External Services

| Service | Purpose |
|---------|---------|
| Piston API | Code execution engine |
| Fine-tuned LLM | Interview question generation (local) |
| WebRTC STUN Servers | Peer-to-peer connection establishment |

### Real-time Technologies

- **Socket.IO**: WebSocket-based bidirectional communication
- **WebRTC**: Peer-to-peer video/audio streaming
- **Yjs**: Conflict-free replicated data types for code sync
- **Liveblocks**: Real-time collaboration infrastructure

---

## 🏗️ Architecture & System Flow

### System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Client (React)                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │   Home   │  │  Lobby   │  │   Room   │  │Whiteboard│   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
│       │             │             │             │          │
│       └─────────────┴─────────────┴─────────────┘          │
│                          │                                   │
│              ┌───────────┴───────────┐                       │
│              │   Socket.IO Client    │                       │
│              │   WebRTC Peer         │                       │
│              └───────────┬───────────┘                       │
└──────────────────────────┼───────────────────────────────────┘
                           │
                           │ WebSocket / WebRTC
                           │
┌──────────────────────────┼───────────────────────────────────┐
│                  Backend (Node.js)                             │
│  ┌────────────────────────────────────────────────────────┐   │
│  │           Express.js Server                            │   │
│  │  ┌──────────────┐  ┌──────────────┐                  │   │
│  │  │ Socket.IO    │  │ REST API     │                  │   │
│  │  │ Server       │  │ Endpoints    │                  │   │
│  │  └──────────────┘  └──────────────┘                  │   │
│  └────────────────────────────────────────────────────────┘   │
└──────────────────────────┼───────────────────────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
┌───────┴──────┐  ┌────────┴────────┐  ┌─────┴──────┐
│ Piston API   │  │ Fine-tuned LLM  │  │ STUN       │
│ (Code Exec)  │  │ (Local System)  │  │ Servers    │
└──────────────┘  └─────────────────┘  └────────────┘
```

### Data Flow Architecture

#### Code Collaboration Flow
```
User Types → CodeMirror → Yjs CRDT → Socket.IO → Server → Broadcast → Other Users → CodeMirror Update
```

#### Video Conferencing Flow
```
User Initiates Call → WebRTC Offer → Socket.IO Signaling → Remote User → WebRTC Answer → Connection Established → Media Streams
```

#### Interview Question Generation Flow
```
Upload Resume/JD → File Parsing → Fine-tuned LLM (Local) → Question Generation → Display Questions
```

#### Whiteboard Collaboration Flow
```
User Draws → Konva Canvas → Stroke Data → Socket.IO → Server → Broadcast → Other Users → Konva Render
```

### Component Architecture

```
App.js
├── Home.jsx (Landing Page)
├── Lobby.jsx (Session Management)
└── Room.jsx (Main Collaboration)
    ├── EditorPage.js (Code Editor)
    ├── Whiteboard.jsx (Collaborative Drawing)
    ├── ResumeInterviewModal.jsx (AI Questions)
    └── Video Call Components
```

---

## ✨ Features

### 1. Real-Time Code Collaboration
- Multi-user simultaneous editing
- CodeMirror editor with syntax highlighting
- Language support: JavaScript, Python, Java, C#, PHP
- Real-time synchronization via Yjs CRDT
- Code snippets for language switching

### 2. Video Conferencing
- WebRTC peer-to-peer video/audio
- Screen sharing capability
- Mute/unmute controls
- Video on/off toggle
- User admission system

### 3. Code Execution
- Multi-language execution via Piston API
- Real-time output sharing
- Error handling and display
- Supported languages: JavaScript, Python, Java

### 4. Collaborative Whiteboard
- Real-time collaborative drawing
- Pen tool with 10 color options
- Eraser tool with adjustable size
- Undo/redo functionality
- Clear canvas option
- Resizable panel

### 5. AI-Powered Interview Questions
- Resume upload (PDF/DOCX)
- JD upload (PDF/DOCX/TXT) - UI ready
- Fine-tuned LLM for question generation
- Customizable difficulty levels (1-5)
- Topic selection (Skills, Projects, Experience, etc.)
- Question count selection (1-50)
- Persistent question bank

### 6. Session Management
- UUID-based room IDs
- Instant session creation
- Easy room joining
- Room ID copying
- No authentication required

---

## 🤖 AI Model & Fine-Tuning

### Model Information

**Model Type**: Fine-tuned Large Language Model (LLM)  
**Deployment**: Local System  
**Model File**: `interview_model.gguf`  
**Purpose**: Generate tailored interview questions from resumes

### Fine-Tuning Details

The model is fine-tuned specifically for interview question generation, trained on:
- Resume data patterns
- Interview question structures
- Technical and behavioral question formats
- Difficulty level variations
- Topic-specific question generation

### Model Capabilities

- **Resume Analysis**: Extracts key information from uploaded resumes
- **Question Generation**: Creates contextually relevant interview questions
- **Difficulty Adaptation**: Adjusts question complexity based on user selection
- **Topic Focus**: Generates questions focused on selected topics (Skills, Projects, Experience, etc.)
- **Customizable Output**: Generates 1-50 questions based on user preference

### Integration

The fine-tuned model runs locally on the system and processes resume uploads to generate interview questions. The model receives:
- Parsed resume text
- Difficulty level (1-5)
- Number of questions requested
- Selected topics

And generates tailored interview questions based on the resume content.

---

## 🚀 Setup & Installation

### Prerequisites

- Node.js (v14.0.0 or higher)
- npm or yarn
- Fine-tuned LLM model file (`interview_model.gguf`)
- Modern web browser with WebRTC support

### Installation Steps

#### 1. Clone Repository
```bash
git clone <repository-url>
cd SyncCodes
```

#### 2. Backend Setup
```bash
cd backend
npm install
npm start
```

**Backend runs on**: `http://localhost:8000`

#### 3. Frontend Setup
```bash
cd client
npm install
npm run dev
```

**Frontend runs on**: `http://localhost:3000`

#### 4. Model Setup
- Ensure `interview_model.gguf` is in the project root
- Configure model path in backend if needed
- Model runs locally for question generation

### Environment Variables

**Backend** (`.env`):
```env
PORT=8000
MODEL_PATH=./interview_model.gguf
```

**Frontend** (`.env`):
```env
REACT_APP_API_URL=http://localhost:8000
```

---

## 📸 Project Screenshots

### Landing Page
<!-- Add screenshot: Landing page with hero section and features -->
![Landing Page](screenshots/landing-page.png)
*Landing page with animated hero section and feature showcase*

### Lobby Page
<!-- Add screenshot: Session creation and joining interface -->
![Lobby Page](screenshots/lobby-page.png)
*Session management with create and join options*

### Collaboration Room
<!-- Add screenshot: Main room with video feeds and code editor -->
![Collaboration Room](screenshots/collaboration-room.png)
*Main collaboration interface with video feeds and code editor*

### Code Editor
<!-- Add screenshot: CodeMirror editor with syntax highlighting -->
![Code Editor](screenshots/code-editor.png)
*Real-time collaborative code editor with syntax highlighting*

### Whiteboard
<!-- Add screenshot: Collaborative whiteboard with drawing tools -->
![Whiteboard](screenshots/whiteboard.png)
*Collaborative whiteboard with pen, eraser, and color palette*

### Interview Questions
<!-- Add screenshot: Resume upload and generated questions -->
![Interview Questions](screenshots/interview-questions.png)
*Resume upload interface and AI-generated interview questions*

### Video Conferencing
<!-- Add screenshot: Video call interface with controls -->
![Video Call](screenshots/video-call.png)
*WebRTC video conferencing with screen sharing options*

---

## ⚠️ Known Issues

1. **Microphone Audio Overlap**: Sound overlapping during video calls (being addressed)
2. **Session Termination**: Room ID persists after session ends (cleanup needed)
3. **Library Imports**: Code execution doesn't support external library imports (planned feature)

---

## 🔮 Future Enhancements

1. **Library Import Support**: Enable importing external libraries in code execution
2. **Advanced Editor Features**: Autocomplete, IntelliSense, code formatting
3. **Enhanced Collaboration**: Text chat, code annotations, version history
4. **User Management**: Optional accounts, session history, favorites
5. **JD Integration**: Full JD processing and integration with question generation
6. **Performance Optimization**: Code editor optimization, connection reliability improvements

---

## 📊 Technical Specifications

### Performance Metrics
- **Code Sync Latency**: < 100ms
- **Video Call Quality**: HD (720p/1080p)
- **Question Generation**: 5-10 seconds
- **Whiteboard Sync**: Real-time (< 50ms)

### Browser Compatibility
- ✅ Chrome/Edge (latest)
- ✅ Firefox (latest)
- ✅ Safari (latest)
- ❌ Internet Explorer (not supported)

### System Requirements
- **Backend**: Node.js 14+, 2GB RAM minimum
- **Frontend**: Modern browser with WebRTC support
- **Model**: Local system with sufficient resources for LLM inference

---

## 📄 License

This project is licensed under a custom **All Rights Reserved** license.  
No reproduction, commercial use, or distribution is permitted without written permission.  
Contact: **c.gourab180@gmail.com**

---

## 📞 Contact & Support

- **Email**: c.
- **Live Demo**: [https://www.synccode.live/](https://www.synccode.live/)
- **Demo Video**: [Watch on YouTube](https://youtu.be/IiPcbEWGCsU)

---

**Last Updated**: December 2024  
**Version**: 2.0.0  
**Status**: Active Development

