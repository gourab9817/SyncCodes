import React, { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSocket } from "../utils/SocketProvider.js";
import { Video, Users, ArrowRight, Copy, Code, Globe, Sun, Moon } from "lucide-react";
import { v4 as uuid } from "uuid";
import toast from "react-hot-toast";
import { Toaster } from "react-hot-toast";

// Theme context to manage theme state across components
const ThemeContext = React.createContext();

export const ThemeProvider = ({ children }) => {
  const [darkMode, setDarkMode] = useState(() => {
    // Get saved theme from localStorage or use system preference
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      return savedTheme === 'dark';
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    // Update localStorage and apply theme to document
    localStorage.setItem('theme', darkMode ? 'dark' : 'light');
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  const toggleTheme = () => {
    setDarkMode(!darkMode);
  };

  return (
    <ThemeContext.Provider value={{ darkMode, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => React.useContext(ThemeContext);

// Navbar component with theme toggle
const Navbar = () => {
  const { darkMode, toggleTheme } = useTheme();
  
  return (
    <nav className="flex items-center justify-between w-full max-w-6xl mx-auto py-4 px-4">
      <div className="text-purple-500 dark:text-purple-400 font-bold text-2xl flex items-center">
        <span className="text-gray-800 dark:text-white mr-1">&lt;/&gt;</span> 
        {window.location.pathname.includes('lobby') ? 'SyncCodes' : 'SyncCodes'}
      </div>
      
      <button 
        onClick={toggleTheme}
        className="p-2 rounded-full bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
        aria-label="Toggle theme"
      >
        {darkMode ? (
          <Sun className="w-5 h-5 text-yellow-400" />
        ) : (
          <Moon className="w-5 h-5 text-gray-600" />
        )}
      </button>
    </nav>
  );
};

const Lobby = () => {
  const [createName, setCreateName] = useState("");
  const [joinName, setJoinName] = useState("");
  const [createSessionId, setCreateSessionId] = useState("");
  const [joinSessionId, setJoinSessionId] = useState("");
  const [errors, setErrors] = useState({});
  const socket = useSocket();
  const navigate = useNavigate();
  const { darkMode } = useTheme();

  const handleJoinSession = (e) => {
    e.preventDefault();
    
    // Validate form
    const newErrors = {};
    if (!joinName.trim()) newErrors.joinName = "Name is required";
    if (!joinSessionId.trim()) newErrors.joinSessionId = "Session ID is required";
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    
    // Emit join room event
    socket.emit("room:join", { email: joinName, room: joinSessionId });
  };

  const handleCreateSession = (e) => {
    e.preventDefault();
    
    // Validate form
    const newErrors = {};
    if (!createName.trim()) newErrors.createName = "Name is required";
    if (!createSessionId.trim()) newErrors.createSessionId = "Session ID is required";
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    
    // Emit join room event with generated room ID
    socket.emit("room:join", { email: createName, room: createSessionId });
  };

  const generateRoomId = () => {
    const newRoomId = uuid();
    setCreateSessionId(newRoomId);
    toast.success(`Room ID generated: ${newRoomId}`);
  };

  const copyRoomIdToClipboard = (idToCopy) => {
    if (!idToCopy) {
      toast.error("No Room ID to copy!");
      return;
    }
    navigator.clipboard.writeText(idToCopy).then(() => {
      toast.success("Room ID copied to clipboard!");
    });
  };

  const handleJoinRoom = useCallback(
    (data) => {
      const { email, room } = data;
      navigate(`/room/${room}/${email}`);
    },
    [navigate]
  );

  useEffect(() => {
    socket.on("room:join", handleJoinRoom);
    return () => {
      socket.off("room:join", handleJoinRoom);
    };
  }, [socket, handleJoinRoom]);

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex flex-col items-center p-4">
      <Toaster />
      
      {/* Navbar with theme toggle */}
      <Navbar />
      
      {/* Main Content Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-6xl mt-10">
        {/* Create Session Section */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-lg">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-blue-600 p-2 rounded-lg">
              <Code className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-xl font-semibold text-gray-800 dark:text-white">Create Session</h2>
          </div>
          
          <p className="text-gray-600 dark:text-gray-400 mb-6">Start a new collaborative coding environment</p>
          
          <form onSubmit={handleCreateSession} className="space-y-5">
            {/* Name Input */}
            <div>
              <label htmlFor="createName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Your Name
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Users className="h-5 w-5 text-gray-500" />
                </div>
                <input
                  type="text"
                  id="createName"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  className={`w-full pl-10 pr-4 py-3 rounded-lg bg-gray-50 dark:bg-gray-700 border ${
                    errors.createName ? "border-red-500" : "border-gray-300 dark:border-gray-600"
                  } text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                  placeholder="Enter your name"
                />
                {errors.createName && (
                  <p className="mt-1 text-sm text-red-500">{errors.createName}</p>
                )}
              </div>
            </div>
            
            {/* Session ID Input for Create */}
            <div>
              <label htmlFor="createSessionId" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Session ID (Click on the Generate Session ID to create your room )
              </label>
              <div className="relative flex items-center">
                <input
                  type="text"
                  id="createSessionId"
                  value={createSessionId}
                  onChange={(e) => setCreateSessionId(e.target.value)}
                  className={`flex-1 px-4 py-3 rounded-lg bg-gray-50 dark:bg-gray-700 border ${
                    errors.createSessionId ? "border-red-500" : "border-gray-300 dark:border-gray-600"
                  } text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                  placeholder="Generate or enter session ID"
                  readOnly
                />
                <button
                  type="button"
                  onClick={() => copyRoomIdToClipboard(createSessionId)}
                  className="ml-2 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 p-2 rounded-lg transition-colors">
                  <Copy className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                </button>
              </div>
              {errors.createSessionId && (
                <p className="mt-1 text-sm text-red-500">{errors.createSessionId}</p>
              )}
            </div>
            
            {/* Generate Room ID Button */}
            <button
  type="button"
  onClick={generateRoomId}
  className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg 
             flex items-center justify-center gap-2 transition-colors duration-200"
>
  Generate Session ID <ArrowRight className="w-5 h-5" />
</button>
            <button
              type="submit"
              className="w-full bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-700 hover:to-pink-600 text-white font-medium py-3 rounded-lg 
                    flex items-center justify-center gap-2 transition-colors duration-200"
            >
              Create New Session <ArrowRight className="w-5 h-5" />
            </button>
            
            {/* Session Options */}
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 bg-gray-100 dark:bg-gray-700 rounded-lg cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-650">
                <div className="bg-blue-600 p-2 rounded-lg">
                  <Code className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-gray-800 dark:text-white font-medium">New Session</h3>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">Create from scratch</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3 p-3 bg-gray-100 dark:bg-gray-700 rounded-lg cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-650">
                <div className="bg-purple-600 p-2 rounded-lg">
                  <Globe className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-gray-800 dark:text-white font-medium">Choose Template</h3>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">Start with ready-made templates</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3 p-3 bg-gray-100 dark:bg-gray-700 rounded-lg cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-650">
                <div className="bg-green-600 p-2 rounded-lg">
                  <Video className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-gray-800 dark:text-white font-medium">Video Meeting</h3>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">With real-time collaboration</p>
                </div>
              </div>
            </div>
            
            
          </form>
        </div>
        
        {/* Join Session Section */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-lg">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-purple-600 p-2 rounded-lg">
              <Users className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-xl font-semibold text-gray-800 dark:text-white">Join Session</h2>
          </div>
          
          <p className="text-gray-600 dark:text-gray-400 mb-6">Enter an existing session with an ID</p>
          
          <form onSubmit={handleJoinSession} className="space-y-5">
            {/* Name Input */}
            <div>
              <label htmlFor="joinName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Your Name
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Users className="h-5 w-5 text-gray-500" />
                </div>
                <input
                  type="text"
                  id="joinName"
                  value={joinName}
                  onChange={(e) => setJoinName(e.target.value)}
                  className={`w-full pl-10 pr-4 py-3 rounded-lg bg-gray-50 dark:bg-gray-700 border ${
                    errors.joinName ? "border-red-500" : "border-gray-300 dark:border-gray-600"
                  } text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent`}
                  placeholder="Enter your name"
                />
                {errors.joinName && (
                  <p className="mt-1 text-sm text-red-500">{errors.joinName}</p>
                )}
              </div>
            </div>
            
            {/* Room ID Input */}
            <div>
              <label htmlFor="joinSessionId" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Session ID
              </label>
              <div className="relative flex items-center">
                <input
                  type="text"
                  id="joinSessionId"
                  value={joinSessionId}
                  onChange={(e) => setJoinSessionId(e.target.value)}
                  className={`flex-1 px-4 py-3 rounded-lg bg-gray-50 dark:bg-gray-700 border ${
                    errors.joinSessionId ? "border-red-500" : "border-gray-300 dark:border-gray-600"
                  } text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent`}
                  placeholder="e.g. abc-123-xyz"
                />
                <button
                  type="button"
                  onClick={() => copyRoomIdToClipboard(joinSessionId)}
                  className="ml-2 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 p-2 rounded-lg transition-colors">
                  <Copy className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                </button>
              </div>
              {errors.joinSessionId && (
                <p className="mt-1 text-sm text-red-500">{errors.joinSessionId}</p>
              )}
            </div>
            
            {/* Recent Sessions */}
            <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="bg-blue-600 p-2 rounded-full">
                    <div className="w-4 h-4 text-white flex items-center justify-center">
                      ⏱
                    </div>
                  </div>
                  <h3 className="text-gray-800 dark:text-white font-medium">Recent Sessions</h3>
                </div>
                <button className="text-blue-600 dark:text-blue-400 text-sm">View All</button>
              </div>
              <p className="text-gray-600 dark:text-gray-400 text-sm">Quickly access your recent work</p>
            </div>
            
            <button
              type="submit"
              className="w-full bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-700 hover:to-pink-600 text-white font-medium py-3 rounded-lg 
                    flex items-center justify-center gap-2 transition-colors duration-200"
            >
              Join Session <ArrowRight className="w-5 h-5" />
            </button>
          </form>
          
          {/* Generate ID section */}
          <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
              Don't have a session ID?{" "}
              <button
                onClick={() => {
                  const newId = uuid();
                  setJoinSessionId(newId);
                  toast.success(`Session ID generated: ${newId}`);
                }}
                className="text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-300 font-medium">
                Generate New ID
              </button>
            </p>
          </div>
        </div>
      </div>
      
      {/* Features Section */}
      <div className="w-full max-w-6xl mt-16">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white text-center mb-10">Why Choose SyncCodes?</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg">
            <div className="bg-blue-100 dark:bg-blue-900 p-3 rounded-lg inline-block mb-4">
              <Code className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-800 dark:text-white mb-2">Real-time Collaboration</h3>
            <p className="text-gray-600 dark:text-gray-400">Code together in real-time with team members around the world.</p>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg">
            <div className="bg-purple-100 dark:bg-purple-900 p-3 rounded-lg inline-block mb-4">
              <Video className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-800 dark:text-white mb-2">Integrated Video</h3>
            <p className="text-gray-600 dark:text-gray-400">Seamless video calls built right into your coding environment.</p>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg">
            <div className="bg-green-100 dark:bg-green-900 p-3 rounded-lg inline-block mb-4">
              <Code className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-800 dark:text-white mb-2">Multiple Languages</h3>
            <p className="text-gray-600 dark:text-gray-400">Support for all major programming languages and frameworks.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

// Home component for the landing page with "Get Started" button
const Home = () => {
  const navigate = useNavigate();
  
  const handleGetStarted = () => {
    navigate('/lobby');
  };
  
return (
  <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex flex-col items-center p-4">
    {/* Navbar with theme toggle */}
    {/* Google tag (gtag.js) */}
    <script async src="https://www.googletagmanager.com/gtag/js?id=G-5YCYCT27W5"></script>
    <script dangerouslySetInnerHTML={{
      __html: `
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        gtag('js', new Date());
        gtag('config', 'G-5YCYCT27W5');
      `
    }}></script>
    <Navbar />
      
      <div className="flex flex-col items-center justify-center flex-grow w-full">
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-10 mb-8 w-full max-w-4xl text-center">
          <h1 className="text-4xl font-bold text-white mb-4">Welcome to SyncCodes</h1>
          <p className="text-white text-lg mb-8">Create or join collaborative coding sessions with real-time video meetings</p>
          
          <div className="flex justify-center gap-4">
            <button
              onClick={handleGetStarted}
              className="bg-white text-blue-600 px-6 py-3 rounded-lg font-medium flex items-center gap-2 hover:bg-gray-100 transition-colors"
            >
              Get Started <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// App component wrapped with ThemeProvider
const App = () => {
  return (
    <ThemeProvider>
      {/* Your router setup here */}
      {/* For demonstration, we'll just render the component based on path */}
      {window.location.pathname === '/' ? <Home /> : <Lobby />}
    </ThemeProvider>
  );
};

export default App;
