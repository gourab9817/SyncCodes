## Check out 
https://www.synccode.live/

## Key Points

[SyncCodes](#SyncCodes) is an advanced collaborative platform designed for real-time synchronization and editing of code across multiple users. Built with WebRTC and WebSockets, it combines the power of real-time communication with efficient code collaboration tools. The platform aims to enhance team productivity by providing an interactive environment where participants can code, debug, and execute programs simultaneously while staying in sync.


- [Key Features](#key-features)
- [Technology Stack](#technology-stack)
- [How To Run](#how-to-run)
- [Use Cases](#use-cases)

## Demo Video- Click the Picture to get the project explaination.

[![Watch the demo](https://img.youtube.com/vi/IiPcbEWGCsU/hqdefault.jpg)](https://youtu.be/IiPcbEWGCsU)


## SyncCodes

SyncCodes is an advanced collaborative platform designed for real-time synchronization and editing of code across multiple users. Built with WebRTC and WebSockets, it combines the power of real-time communication with efficient code collaboration tools. The platform aims to enhance team productivity by providing an interactive environment where participants can code, debug, and execute programs simultaneously while staying in sync.



## Key Features

- **Real-Time Code Collaboration:** Seamlessly write, edit, and share code in real-time with full synchronization across users.
- **Integrated Code Execution:** Run your code directly within the platform with real-time feedback for instant debugging.
- **Video Conferencing with Screen Sharing:** Built-in WebRTC-based video calling and screen sharing to enhance team communication.
- **Syntax Highlighting and Language Support:** Optimized editor with support for multiple programming languages and syntax highlighting.
- **User-Friendly Interface:** Intuitive design with tools for effortless navigation and collaboration.

## Technology Stack

- **Frontend:** React.js, Ace/Monaco Editor for code editing.
- **Backend:** Node.js with Express.js, integrated WebSocket server for real-time communication.
- **WebRTC:** Peer-to-peer connection for video calling and screen sharing.
- **Code Editor:** CodeMirror
- **Compiler:** From [Piston API](https://piston.readthedocs.io/en/latest/api-v2/)  
  - **Base URL:** `https://emkc.org/api/v2/piston`
  - **Endpoint:** `/execute`

## How To Run

**Note:** You must have Node.js installed on your device.

1. Clone the repository:
   ```bash
   git clone 

   

2. Navigate to the backend folder and install dependencies:
   ```bash
    cd backend
    npm i
    npm start


3. Navigate to the client folder and install dependencies:
   ```bash
    cd client
    npm i
    npm run dev


## Bugs 
- Microphone bug ( there is a sound overlapping during the video call)
- Session Termination ( Once the session is terminated the room id( session id ) should be vanished
## New add on 
- Currently it doesn't support import libraries , Looking forwoard to add the feature
  
## License

This project is licensed under a custom **All Rights Reserved** license.  
No reproduction, commercial use, or distribution is permitted without written permission.  
Please contact c.gourab180@gmail.com for more information.

