const { Server } = require("socket.io");
const express = require("express");
const app = express();
const cors = require("cors");
const http = require('http');
const path = require('path');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const { GoogleGenerativeAI } = require('@google/generative-ai');

app.use(express.json());
app.use(cors());
app.use(express.static('../client/build'));

// Configure multer for file uploads (memory storage)
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF and DOCX files are allowed.'));
    }
  }
});

// Initialize 
const GEMINI_API_KEY = 'AIzaSyD8WCHhtB7TU5NTU0D2RzaLtmbamxfHMqY';
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// Helper function to parse PDF
async function parsePDF(buffer) {
  try {
    const data = await pdfParse(buffer);
    return data.text;
  } catch (error) {
    throw new Error('Failed to parse PDF file');
  }
}

// Helper function to parse DOCX
async function parseDOCX(buffer) {
  try {
    const result = await mammoth.extractRawText({ buffer: buffer });
    return result.value;
  } catch (error) {
    throw new Error('Failed to parse DOCX file');
  }
}

// API endpoint to generate interview questions from resume
app.post('/api/generate-questions', upload.single('resume'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    console.log('Processing file:', req.file.originalname);

    // Get custom options from request
    const difficultyLevel = parseInt(req.body.difficultyLevel) || 3;
    const numberOfQuestions = parseInt(req.body.numberOfQuestions) || 10;
    const topics = JSON.parse(req.body.topics || '["Skills", "Projects", "Experience"]');

    console.log('Options:', { difficultyLevel, numberOfQuestions, topics });

    // Parse resume based on file type
    let resumeText = '';
    const mimeType = req.file.mimetype;

    if (mimeType === 'application/pdf') {
      resumeText = await parsePDF(req.file.buffer);
    } else if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || mimeType === 'application/msword') {
      resumeText = await parseDOCX(req.file.buffer);
    } else {
      return res.status(400).json({ error: 'Unsupported file format' });
    }

    if (!resumeText || resumeText.trim().length < 50) {
      return res.status(400).json({ error: 'Resume content is too short or empty' });
    }

    console.log('Resume text extracted, length:', resumeText.length);

    
    // Using the latest stable model with version number
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.5-flash' 
    });

    // Map difficulty level to description
    const difficultyDescriptions = {
      1: 'Easy - Basic understanding and fundamental concepts',
      2: 'Moderate - Practical application and common scenarios',
      3: 'Intermediate - In-depth knowledge and problem-solving',
      4: 'Advanced - Complex scenarios and architectural decisions',
      5: 'Expert - System design, optimization, and leadership'
    };

    // Build topic focus string
    const topicFocus = topics.map(topic => {
      const topicMap = {
        'Skills': 'technical skills, programming languages, tools, and technologies',
        'Projects': 'project work, implementations, and deliverables',
        'Experience': 'professional experience, roles, and responsibilities',
        'Education': 'educational background, degrees, and academic achievements',
        'Certifications': 'certifications, licenses, and professional credentials',
        'Achievements': 'accomplishments, awards, and notable achievements',
        'Activities': 'extracurricular activities, volunteer work, and personal interests'
      };
      return topicMap[topic] || topic;
    }).join(', ');

    const prompt = `You are an expert technical interviewer. Based on the following resume/CV, generate exactly ${numberOfQuestions} interview questions.

IMPORTANT REQUIREMENTS:
1. Difficulty Level: ${difficultyDescriptions[difficultyLevel]}
2. Focus Areas: The questions should ONLY focus on the following aspects mentioned in the resume: ${topicFocus}
3. The questions must be specifically tailored to what is actually written in the candidate's resume
4. Questions should be appropriate for the ${difficultyDescriptions[difficultyLevel]} level
5. Mix of technical depth and practical scenarios
6. Each question should directly reference or relate to content from the resume

Resume Content:
${resumeText}

Please provide exactly ${numberOfQuestions} questions, numbered 1-${numberOfQuestions}. Only provide the questions, no additional commentary or explanations. Each question should be on a new line.

Focus on ${topicFocus} as mentioned in the resume. Ensure questions match the ${difficultyDescriptions[difficultyLevel]} difficulty level.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Parse the questions from the response
    const lines = text.split('\n').filter(line => line.trim().length > 0);
    const questions = [];

    for (let line of lines) {
      // Remove numbering (e.g., "1.", "1)", "Q1:", etc.)
      const cleaned = line.replace(/^[\d]+[\.\)\:]?\s*/, '').trim();
      if (cleaned.length > 10) { // Only add substantial questions
        questions.push(cleaned);
      }
    }

    // Get the requested number of questions
    const finalQuestions = questions.slice(0, numberOfQuestions);

    // Ensure we got at least half the requested questions
    if (finalQuestions.length < Math.ceil(numberOfQuestions / 2)) {
      return res.status(500).json({ error: `Failed to generate sufficient questions. Got ${finalQuestions.length} but needed at least ${Math.ceil(numberOfQuestions / 2)}` });
    }

    console.log('Generated', finalQuestions.length, 'questions with difficulty:', difficultyLevel, 'topics:', topics);

    res.json({ 
      success: true,
      questions: finalQuestions
    });

  } catch (error) {
    console.error('Error generating questions:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to generate questions. Please try again.' 
    });
  }
});

app.use((req,res,next)=>{
  res.sendFile(path.join(__dirname,'../client/build','index.html'))
})

const server = http.createServer(app);
const io = new Server(server,{cors:true})


const emailToSocketIdMap = new Map();
const socketidToEmailMap = new Map();
const getAllConnectedClients = (roomId) => {
  return Array.from(io.sockets.adapter.rooms.get(roomId) || []).map(
    (socketId) => {
      return {
        socketId,
        email: socketidToEmailMap.get(socketId),
      };
    }
  );
};
io.on("connection", (socket) => {
  console.log(`Socket Connected`, socket.id);
  socket.on("room:join", (data) => {
    const { email, room } = data;
    emailToSocketIdMap.set(email, socket.id);
    socketidToEmailMap.set(socket.id, email);
    io.to(room).emit("user:joined", { email, id: socket.id });

    socket.join(room);
    console.log(`${socket.id} joined ${room}`);
    io.to(socket.id).emit("room:join", data);
    const clients = getAllConnectedClients(room);
    clients.forEach(({ socketId }) => {
      io.emit("new", { clients });
    });
  });

  socket.on("code:change", ({ roomId, code }) => {
    console.log("cdoe" ,code);
    socket.in(roomId).emit("code:change", { code });

    console.log(roomId);
  });
  // for handling video off event

  socket.on("user:video:toggle", ({ to, isVideoOff, email }) => {
    console.log("user:video:toggle", to, isVideoOff, email);
    io.to(to).emit("remote:video:toggle", { isVideoOff, email });
  });

  // for handling audio/microphone off event
  socket.on("user:audio:toggle", ({ to, isAudioOff, email }) => {
    console.log("user:audio:toggle", to, isAudioOff, email);
    io.to(to).emit("remote:audio:toggle", { isAudioOff, email });
  });
  socket.on("sync:code", ({ socketId, code }) => {
    io.to(socketId).emit("code:change", { code });
  });
  socket.on("user:call", ({ to, offer, email }) => {
    io.to(to).emit("incomming:call", {
      from: socket.id,
      offer,
      fromEmail: email,
    });
  });
  // handling code output
  socket.on("output", ({ roomId, output }) => {
    console.log("output", output);
    socket.in(roomId).emit("output", { output });
  });

  socket.on("language:change",({roomId,language,snippet})=>{
    console.log(snippet,roomId);
    socket.in(roomId).emit("language:change",{language,snippet})
  })
  socket.on("call:accepted", ({ to, ans }) => {
    io.to(to).emit("call:accepted", { from: socket.id, ans });
  });

  socket.on("peer:nego:needed", ({ to, offer }) => {
    console.log("peer:nego:needed", offer);
    io.to(to).emit("peer:nego:needed", { from: socket.id, offer });
  });

  socket.on("peer:nego:done", ({ to, ans }) => {
    // console.log("peer:nego:done", ans);

    io.to(to).emit("peer:nego:final", { from: socket.id, ans });
  });

  socket.on("leave:room", ({ roomId, email }) => {
    socket.leave(roomId);
    console.log(`${email} left ${roomId}`);
    socket.to(roomId).emit("user:left", { email });
  });

  socket.on("wait:for:call", ({ to, email }) => {
    console.log("wait:for:call", to, email);
    io.to(to).emit("wait:for:call", { from: socket.id, email });
  });

  // Whiteboard events
  socket.on("whiteboard:update", ({ roomId, strokes }) => {
    console.log("whiteboard:update", roomId);
    socket.to(roomId).emit("whiteboard:update", { strokes });
  });

  socket.on("whiteboard:clear", ({ roomId }) => {
    console.log("whiteboard:clear", roomId);
    socket.to(roomId).emit("whiteboard:clear");
  });

  socket.on("disconnecting", () => {
 
    io.emit("user:left", { id: socket.id });

    console.log(`Socket Disconnected: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 8000;
server.listen(PORT, () => console.log(`Listening on port ${PORT}`));