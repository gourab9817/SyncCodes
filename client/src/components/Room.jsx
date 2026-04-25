import React, { useEffect, useCallback, useState, useRef, useMemo } from "react";
import ReactPlayer from "react-player";
import peer from "../services/Peer.js";
import { useSocket } from "../utils/SocketProvider.js";
import Editor from "./EditorPage.js";
import { useParams, useNavigate } from "react-router-dom";
import { toast, Toaster } from "react-hot-toast";
import Whiteboard from "./Whiteboard.jsx";
import ResumeInterviewModal from "./ResumeInterviewModal.jsx";
import ChatPanel from "./room/ChatPanel.jsx";
import { useAuth } from "../context/AuthContext";
import {
  Camera,
  Mic,
  MicOff,
  Monitor,
  Phone,
  PhoneOff,
  VideoOff,
  Code,
  Maximize2,
  Minimize2,
  X,
  Moon,
  Sun,
  Copy,
  CheckCheck,
  Pencil,
  FileText,
  MessageSquare
} from "lucide-react";
import { normalizeRoomRouteKey, isLikelyCuid } from "../utils/roomKeys.js";

const RoomPage = () => {
  const socket = useSocket();
  const { roomId, email: urlEmail } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const email = user?.email || urlEmail || 'Guest';
  const [roomValid, setRoomValid] = useState(true);
  const [session, setSession] = useState(null);

  const normalizedRouteKey = useMemo(() => normalizeRoomRouteKey(roomId), [roomId]);
  // Canonical DB id (after server ack); until then, normalized join code or cuid from the URL.
  const collabRoomId = session?.id || normalizedRouteKey;
  const displayJoinCode = session?.joinCode || (isLikelyCuid(roomId) ? null : normalizedRouteKey);

  useEffect(() => {
    const identity = (user?.email || urlEmail || "").trim();
    if (!socket || !roomId || !identity) return;
    const runJoin = () => {
      if (!socket.connected) return;
      socket.emit("room:join", { email: identity, room: normalizedRouteKey || roomId });
    };
    runJoin();
    socket.on("connect", runJoin);
    return () => {
      socket.off("connect", runJoin);
    };
  }, [socket, roomId, normalizedRouteKey, user?.email, urlEmail]);
  const [incomingCall, setIncomingCall] = useState(false);
  const [remoteVideoOff, setRemoteVideoOff] = useState(false);
  const [remoteAudioOff, setRemoteAudioOff] = useState(false);
  const [remoteEmail, setRemoteEmail] = useState(null);
  const [remoteSocketId, setRemoteSocketId] = useState(null);
  const [myStream, setMyStream] = useState();
  const myStreamRef = useRef(null);
  const [remoteStream, setRemoteStream] = useState(null);
  // UI-related state
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isWhiteboardOpen, setIsWhiteboardOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isResumeModalOpen, setIsResumeModalOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [callStatus, setCallStatus] = useState('idle'); // 'idle' | 'in-call' | 'ended'
  const [isRoomOwner, setIsRoomOwner] = useState(false);
  const [showEndCallModal, setShowEndCallModal] = useState(false);
  const [peerKey, setPeerKey] = useState(0);

  // Ref that mirrors remoteSocketId state but is always in sync synchronously.
  // Used inside the ICE onIceCandidate callback (a closure) to avoid the race
  // where the state hasn't propagated before the first ICE candidates fire.
  const remoteSocketIdRef = useRef(null);
  const isRoomOwnerRef = useRef(false);
  useEffect(() => {
    isRoomOwnerRef.current = isRoomOwner;
  }, [isRoomOwner]);

  // When a user joins, sync code and update state.
  const handleUserJoined = useCallback(
    ({ email, id }) => {
      // Ignore our own join notification — the server uses socket.to() which
      // already excludes us, but guard here too in case of reconnect edge cases.
      if (!id || id === socket?.id) return;
      console.log(`Email ${email} joined room`, id);
      remoteSocketIdRef.current = id;
      setRemoteSocketId(id);
      setRemoteEmail(email);
      setShowDialog(true);
      socket.emit("wait:for:call", { to: id, email });
    },
    [socket]
  );

  const handleCallUser = useCallback(async () => {
    // Use existing stream if available, otherwise get new one
    let stream = myStream;
    if (!stream) {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true,
      });
      setMyStream(stream);
    }
    // Add tracks BEFORE creating the offer so media is included in the initial
    // SDP. Without this, WebRTC requires an extra renegotiation round-trip
    // before video/audio starts flowing.
    peer.addLocalStream(stream);
    const offer = await peer.createOffer();
    socket.emit("user:call", { to: remoteSocketId, offer, email });
    setShowDialog(false);
  }, [remoteSocketId, socket, email, myStream]);

  const handleIncommingCall = useCallback(
    async ({ from, offer, fromEmail }) => {
      // Set ref synchronously so the ICE handler can forward candidates to the
      // caller immediately — state updates are async and would miss early candidates.
      remoteSocketIdRef.current = from;
      setRemoteSocketId(from);
      // Use existing stream if available, otherwise get new one
      let stream = myStream;
      if (!stream) {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: true,
        });
        setMyStream(stream);
      }
      console.log("Incoming Call", from, offer);
      setRemoteEmail(fromEmail);
      // Add tracks BEFORE accepting the offer so they're included in the answer SDP.
      peer.addLocalStream(stream);
      const ans = await peer.acceptOffer(offer);
      socket.emit("call:accepted", { to: from, ans });
    },
    [socket, myStream]
  );

  const sendStreams = useCallback(() => {
    // addLocalStream dedupes by track id, so repeated calls during
    // renegotiation won't throw "sender already exists".
    if (myStream) peer.addLocalStream(myStream);
  }, [myStream]);

  const handleCallAccepted = useCallback(
    async ({ from, ans }) => {
      await peer.acceptAnswer(ans);
      console.log("Call Accepted!");
      // sendStreams is a no-op here because addLocalStream was already called
      // before createOffer, but keep it as a safety net for reconnect paths.
      sendStreams();
    },
    [sendStreams]
  );

  const handleNegoNeeded = useCallback(async () => {
    const offer = await peer.createOffer();
    socket.emit("peer:nego:needed", { offer, to: remoteSocketId });
  }, [remoteSocketId, socket]);

  useEffect(() => {
    peer.peer.addEventListener("negotiationneeded", handleNegoNeeded);
    return () => {
      peer.peer.removeEventListener("negotiationneeded", handleNegoNeeded);
    };
  }, [handleNegoNeeded, peerKey]);

  const handleNegoNeedIncomming = useCallback(
    async ({ from, offer }) => {
      const ans = await peer.acceptOffer(offer);
      socket.emit("peer:nego:done", { to: from, ans });
    },
    [socket]
  );

  const handleNegoNeedFinal = useCallback(async ({ ans }) => {
    await peer.acceptAnswer(ans);
  }, []);

  // Initialize camera on mount (like Google Meet)
  useEffect(() => {
    const initializeMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: true,
        });
        myStreamRef.current = stream;
        setMyStream(stream);
        setCallStatus('in-call');
        console.log("Camera and microphone initialized");
      } catch (error) {
        console.error("Error accessing media devices:", error);
        toast.error("Could not access camera/microphone");
      }
    };

    initializeMedia();

    return () => {
      myStreamRef.current?.getTracks().forEach((track) => track.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Intentionally run once on mount; ref tracks current stream for cleanup

  useEffect(() => {
    const trackHandler = (ev) => {
      const streams = ev.streams;
      console.log("GOT TRACKS!!");
      if (streams && streams.length > 0) {
        setRemoteStream(streams[0]);
      }
    };
    peer.peer.addEventListener("track", trackHandler);
    return () => {
      peer.peer.removeEventListener("track", trackHandler);
    };
  }, [peerKey]);

  // Trickle-ICE: forward every local candidate to the remote peer, and add
  // every remote candidate we receive. Without this the peer connection can't
  // traverse different NATs (phone cellular ↔ PC WiFi).
  // We read remoteSocketIdRef (not state) inside the callback so we always
  // capture the latest socket ID without waiting for a React re-render.
  useEffect(() => {
    if (!socket) return;
    peer.onIceCandidate((candidate) => {
      const targetId = remoteSocketIdRef.current;
      if (!targetId) return;
      socket.emit("ice:candidate", { to: targetId, candidate });
    });
    const handleRemoteIce = ({ candidate }) => {
      peer.addRemoteIceCandidate(candidate);
    };
    socket.on("ice:candidate", handleRemoteIce);
    return () => {
      socket.off("ice:candidate", handleRemoteIce);
    };
  }, [socket, peerKey]);

  useEffect(() => {
    if (!socket) return;

    socket.on("user:joined", handleUserJoined);
    socket.on("incomming:call", handleIncommingCall);
    socket.on("call:accepted", handleCallAccepted);
    socket.on("peer:nego:needed", handleNegoNeedIncomming);
    socket.on("peer:nego:final", handleNegoNeedFinal);

    const handleUserLeft = ({ email }) => {
      toast(`${email} has left the room.`, { icon: "👋" });
      console.log(`${email} has left the room.`);
      if (remoteSocketId) {
        remoteSocketIdRef.current = null;
        setRemoteSocketId(null);
        setRemoteEmail(null);
        setRemoteStream(null);
      }
    };
    
    const handleRoomJoinError = ({ error }) => {
      toast.error(error);
      setRoomValid(false);
      setTimeout(() => {
        navigate(user ? '/dashboard' : '/');
      }, 3000);
    };

    // Fired to everyone in the room when the roster changes — recovers if
    // `user:joined` was missed (timing / strict mode) and keeps host socket id in sync.
    const handleRoster = ({ clients }) => {
      if (!clients?.length) return;
      const selfId = socket.id;
      const others = clients.filter((c) => c.socketId !== selfId);
      if (others.length === 0) return;
      const o = others[0];
      if (!o?.socketId) return;
      if (o.socketId === remoteSocketIdRef.current) return;
      remoteSocketIdRef.current = o.socketId;
      setRemoteSocketId(o.socketId);
      if (o.email) setRemoteEmail(o.email);
      if (isRoomOwnerRef.current) {
        setShowDialog(true);
      }
    };
    
    socket.on("user:left", handleUserLeft);
    socket.on("room:join:error", handleRoomJoinError);
    socket.on("new", handleRoster);

    return () => {
      socket.off("user:joined", handleUserJoined);
      socket.off("incomming:call", handleIncommingCall);
      socket.off("call:accepted", handleCallAccepted);
      socket.off("peer:nego:needed", handleNegoNeedIncomming);
      socket.off("peer:nego:final", handleNegoNeedFinal);
      socket.off("user:left", handleUserLeft);
      socket.off("room:join:error", handleRoomJoinError);
      socket.off("new", handleRoster);
    };
  }, [
    socket,
    handleUserJoined,
    handleIncommingCall,
    handleCallAccepted,
    handleNegoNeedIncomming,
    handleNegoNeedFinal,
    remoteSocketId,
    navigate,
    user,
  ]);

  // Automatically trigger sendStreams when incomingCall is true.
  useEffect(() => {
    const timer = setTimeout(() => {
      if (incomingCall) {
        sendStreams();
        setIncomingCall(false);
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, [incomingCall, sendStreams]);

  const handleEndCall = useCallback(() => {
    if (myStream) {
      myStream.getTracks().forEach((t) => t.stop());
      setMyStream(null);
    }
    if (remoteSocketId && socket) {
      socket.emit('call:left', { to: remoteSocketId });
    }
    peer.reset();
    remoteSocketIdRef.current = null;
    setRemoteSocketId(null);
    setPeerKey((k) => k + 1);
    setRemoteStream(null);
    setCallStatus('ended');
    setShowEndCallModal(false);
  }, [myStream, remoteSocketId, socket]);

  const handleRejoin = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      setMyStream(stream);
      setIsVideoOff(false);
      setIsMuted(false);
      setCallStatus('in-call');
      if (remoteSocketId && socket) {
        socket.emit('user:rejoin');
      }
    } catch (err) {
      toast.error('Could not access camera/microphone');
    }
  }, [remoteSocketId, socket]);

  const handleReturnToLobby = useCallback(() => {
    if (socket) socket.emit("leave:room", { roomId: collabRoomId, email });
    navigate(user ? "/dashboard" : "/");
  }, [socket, collabRoomId, email, navigate, user]);

  const handleEndMeeting = useCallback(() => {
    if (!socket) return;
    socket.emit("room:end", { roomId: collabRoomId });
    setShowEndCallModal(false);
  }, [socket, collabRoomId]);

  const toggleVideo = () => {
    if (myStream) {
      const videoTrack = myStream.getVideoTracks()[0];
      if (videoTrack) {
        // Toggle the current video track state.
        videoTrack.enabled = !videoTrack.enabled;
      }
      socket.emit("user:video:toggle", {
        to: remoteSocketId,
        isVideoOff: !isVideoOff,
        email: email,
      });
    }
    setIsVideoOff((prev) => !prev);
  };

  const toggleMicrophone = () => {
    if (myStream) {
      const audioTrack = myStream.getAudioTracks()[0];
      if (audioTrack) {
        // Toggle the current audio track state.
        audioTrack.enabled = !audioTrack.enabled;
      }
      socket.emit("user:audio:toggle", {
        to: remoteSocketId,
        isAudioOff: !isMuted,
        email: email,
      });
    }
    setIsMuted((prev) => !prev);
  };

  // Listen for remote video and audio state changes.
  useEffect(() => {
    const handleRemoteVideoToggle = ({ isVideoOff, email: remoteEmailFromEvent }) => {
      if (remoteEmail === remoteEmailFromEvent) {
        setRemoteVideoOff(isVideoOff);
        setRemoteStream((prevStream) => {
          if (prevStream) {
            const videoTrack = prevStream.getVideoTracks()[0];
            if (videoTrack) {
              videoTrack.enabled = !isVideoOff;
            }
          }
          return prevStream;
        });
      }
    };

    const handleRemoteAudioToggle = ({ isAudioOff, email: remoteEmailFromEvent }) => {
      if (remoteEmail === remoteEmailFromEvent) {
        setRemoteAudioOff(isAudioOff);
        setRemoteStream((prevStream) => {
          if (prevStream) {
            const audioTrack = prevStream.getAudioTracks()[0];
            if (audioTrack) {
              audioTrack.enabled = !isAudioOff;
            }
          }
          return prevStream;
        });
      }
    };
    const handleWaitForCall = ({ from, email }) => {
      toast("Wait until someone lets you in", {
        style: {
          background: darkMode ? '#333' : '#fff',
          color: darkMode ? '#fff' : '#333',
        }
      });
    };
    socket.on("remote:video:toggle", handleRemoteVideoToggle);
    socket.on("remote:audio:toggle", handleRemoteAudioToggle);
    socket.on("wait:for:call", handleWaitForCall);
    return () => {
      socket.off("remote:video:toggle", handleRemoteVideoToggle);
      socket.off("remote:audio:toggle", handleRemoteAudioToggle);
      socket.off("wait:for:call", handleWaitForCall);
    };
  }, [socket, remoteEmail, darkMode]);

  // Track unread messages when chat is closed
  useEffect(() => {
    if (!socket) return;
    if (isChatOpen) { setUnreadCount(0); return; }
    const handler = () => setUnreadCount((n) => n + 1);
    socket.on('message:new', handler);
    return () => socket.off('message:new', handler);
  }, [socket, isChatOpen]);

  // Google Meet-style call control socket events
  useEffect(() => {
    if (!socket) return;

    const handleRoomJoined = (data) => {
      setIsRoomOwner(!!data.isOwner);
      isRoomOwnerRef.current = !!data.isOwner;
      if (data?.room) {
        setSession({ id: data.room, joinCode: data.joinCode || null, isOwner: !!data.isOwner });
      }
      if (data?.joinCode) {
        if (isLikelyCuid(roomId) || (roomId && roomId.toUpperCase() !== data.joinCode.toUpperCase())) {
          navigate(`/room/${data.joinCode}`, { replace: true });
        }
      }
      // Others are already in this room: joiner learns host socket id immediately
      // (they never receive `user:joined` for people who joined before them).
      if (data?.peers?.length) {
        const p = data.peers[0];
        if (p.id && p.id !== socket.id) {
          remoteSocketIdRef.current = p.id;
          setRemoteSocketId(p.id);
          if (p.email) setRemoteEmail(p.email);
          if (data.isOwner) {
            setShowDialog(true);
          } else {
            toast("In the room. Wait for the host to admit the video call…", { icon: "⏳" });
          }
        }
      }
    };

    const handleUserRejoined = ({ email: rejoinEmail, id }) => {
      if (!id || id === socket.id) return;
      remoteSocketIdRef.current = id;
      setRemoteSocketId(id);
      setRemoteEmail(rejoinEmail);
      setShowDialog(true);
      socket.emit('wait:for:call', { to: id, email });
    };

    const handleMeetingEnded = () => {
      toast('The meeting was ended by the host.', { icon: '🚪' });
      if (myStream) myStream.getTracks().forEach((t) => t.stop());
      setMyStream(null);
      setTimeout(() => navigate(user ? '/dashboard' : '/'), 1500);
    };

    const handleCallLeft = () => {
      setRemoteStream(null);
      toast(`${remoteEmail || 'Remote user'} left the call.`, { icon: '📵' });
    };

    socket.on('room:join', handleRoomJoined);
    socket.on('user:rejoined', handleUserRejoined);
    socket.on('meeting:ended', handleMeetingEnded);
    socket.on('call:left', handleCallLeft);

    return () => {
      socket.off('room:join', handleRoomJoined);
      socket.off('user:rejoined', handleUserRejoined);
      socket.off('meeting:ended', handleMeetingEnded);
      socket.off('call:left', handleCallLeft);
    };
  }, [socket, email, myStream, remoteEmail, navigate, user, roomId]);

  const showScreen = async () => {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });
      const screenTrack = screenStream.getVideoTracks()[0];
      if (screenTrack) {
        const sender = peer.peer
          .getSenders()
          .find((s) => s.track && s.track.kind === "video");
        if (sender) {
          sender.replaceTrack(screenTrack);
        }
        screenTrack.onended = () => {
          const videoTrack = myStream.getVideoTracks()[0];
          if (videoTrack && sender) {
            sender.replaceTrack(videoTrack);
          }
        };
      }
    } catch (error) {
      console.error("Error while sharing screen:", error);
    }
  };

  const copyRoomId = () => {
    const toCopy = displayJoinCode || session?.joinCode || (!isLikelyCuid(roomId) ? normalizedRouteKey : roomId);
    navigator.clipboard.writeText(toCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast("Session ID copied to clipboard!", {
      icon: "📋",
      style: {
        background: darkMode ? '#333' : '#fff',
        color: darkMode ? '#fff' : '#333',
      }
    });
  };
  
  if (!roomValid) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-4">Invalid Room</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            This room does not exist or is no longer active.
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-500">
            Redirecting you back...
          </p>
        </div>
      </div>
    );
  }
  
  return (
    <div className={darkMode ? "dark" : ""}>
      <Toaster />
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300 overflow-auto">
        {/* Header */}
        <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 p-4">
          <div className="max-w-7xl mx-auto flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <span className="font-bold text-blue-600 dark:text-blue-400 text-lg">SyncCodes</span>
              <div className="hidden md:flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-300">
                <span>Session:</span>
                <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                  {displayJoinCode || session?.joinCode || (isLikelyCuid(roomId) ? `${roomId.slice(0, 8)}…` : normalizedRouteKey || "—")}
                </code>
                <button
                  onClick={copyRoomId}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  {copied ? <CheckCheck size={16} /> : <Copy size={16} />}
                </button>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setDarkMode(!darkMode)}
                className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                {darkMode ? <Sun size={20} /> : <Moon size={20} />}
              </button>
              <div className="hidden md:flex items-center">
                <span className="text-sm text-gray-600 dark:text-gray-300 mr-2">You:</span>
                <span className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-100 text-sm px-2 py-1 rounded-full">
                  {email}
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto p-4">
          {/* Layout changes based on isEditorOpen state */}
          <div className={`flex ${isEditorOpen ? "flex-row" : "flex-col"} w-full transition-all duration-300 ${isWhiteboardOpen ? "mr-[400px]" : ""}`}>
            {/* Video Feeds */}
            <div className={`${isEditorOpen ? "w-[350px] mr-4" : "w-full"} transition-all duration-300 relative`}>
              {/* Post-call overlay */}
              {callStatus === 'ended' && (
                <div className="absolute inset-0 bg-gray-900/90 flex flex-col items-center justify-center z-10 rounded-lg">
                  <div className="w-20 h-20 rounded-full bg-red-500/20 flex items-center justify-center mb-4">
                    <PhoneOff size={36} className="text-red-400" />
                  </div>
                  <h3 className="text-white text-xl font-semibold mb-2">You left the call</h3>
                  <p className="text-gray-300 text-sm mb-6">You can rejoin or return to the lobby</p>
                  <div className="flex gap-3">
                    <button
                      onClick={handleRejoin}
                      className="px-5 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium"
                    >
                      Rejoin
                    </button>
                    <button
                      onClick={handleReturnToLobby}
                      className="px-5 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium"
                    >
                      Return to Lobby
                    </button>
                  </div>
                </div>
              )}
              {isEditorOpen ? (
                // Video Column Layout when editor is open
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 h-[calc(100vh-9rem)]">
                  <div className="p-3 border-b border-gray-200 dark:border-gray-700 flex items-center">
                    <Camera className="text-gray-600 dark:text-gray-300 mr-2" size={18} />
                    <span className="font-medium text-gray-700 dark:text-gray-300">Video Feeds</span>
                  </div>
                  <div className="space-y-3 p-3 overflow-auto" style={{ height: "calc(100% - 50px)" }}>
                    {/* My Video */}
                    <div className="rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700">
                      <div className="p-1.5 bg-gray-700 text-white text-xs">
                        {email} (You)
                      </div>
                      <div className="h-44">
                        {myStream && (
                          <>
                            {!isVideoOff ? (
                              <ReactPlayer
                                playing
                                muted={isMuted}
                                height="100%"
                                width="100%"
                                url={myStream}
                              />
                            ) : (
                              <div className="w-full h-full flex justify-center items-center">
                                <div className="flex flex-col items-center">
                                  <div className="w-16 h-16 rounded-full bg-blue-500 dark:bg-blue-600 flex items-center justify-center text-white text-2xl">
                                    {email[0].toUpperCase()}
                                  </div>
                                  <span className="mt-1 text-sm text-gray-600 dark:text-gray-300">Camera Off</span>
                                </div>
                              </div>
                            )}
                          </>
                        )}
                        {!myStream && (
                          <div className="w-full h-full flex justify-center items-center">
                            <span className="text-sm text-gray-500 dark:text-gray-400">Initializing camera...</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Remote Video */}
                    {remoteSocketId ? (
                      <div className="rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700">
                        <div className="p-1.5 bg-gray-700 text-white text-xs">
                          {remoteEmail}
                        </div>
                        <div className="h-44">
                          {remoteStream && (
                            <>
                              {!remoteVideoOff ? (
                                <ReactPlayer
                                  playing
                                  muted={remoteAudioOff}
                                  height="100%"
                                  width="100%"
                                  url={remoteStream}
                                />
                              ) : (
                                <div className="w-full h-full flex justify-center items-center">
                                  <div className="flex flex-col items-center">
                                    <div className="w-16 h-16 rounded-full bg-purple-500 dark:bg-purple-600 flex items-center justify-center text-white text-2xl">
                                      {remoteEmail[0].toUpperCase()}
                                    </div>
                                    <span className="mt-1 text-sm text-gray-600 dark:text-gray-300">Camera Off</span>
                                  </div>
                                </div>
                              )}
                            </>
                          )}
                          {!remoteStream && (
                            <div className="w-full h-full flex justify-center items-center">
                              <span className="text-sm text-gray-500 dark:text-gray-400">Waiting for peer...</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700 flex flex-col justify-center items-center p-4 h-44">
                        <div className="text-blue-500 dark:text-blue-400 mb-2">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                          </svg>
                        </div>
                        <span className="text-sm text-gray-700 dark:text-gray-300 font-medium text-center mb-2">Waiting for someone to join</span>
                        <button
                          onClick={copyRoomId}
                          className="inline-flex items-center bg-blue-500 hover:bg-blue-600 text-white text-xs px-2 py-1 rounded"
                        >
                          <span className="mr-1">Copy ID</span>
                          {copied ? <CheckCheck size={12} /> : <Copy size={12} />}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                // Full Width Grid Layout when editor is closed
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-[calc(100vh-8rem)]">
                  {/* My Video */}
                  <div className="relative overflow-hidden rounded-lg bg-white dark:bg-gray-800 shadow-lg border border-gray-200 dark:border-gray-700">
                    <div className="absolute top-4 left-4 bg-black/50 text-white px-2 py-1 rounded-md text-sm z-10">
                      {email} (You)
                    </div>
                    {myStream && (
                      <>
                        {!isVideoOff ? (
                          <ReactPlayer
                            playing
                            muted={isMuted}
                            height="100%"
                            width="100%"
                            url={myStream}
                            className="rounded-lg"
                          />
                        ) : (
                          <div className="w-full h-full flex justify-center items-center bg-gray-100 dark:bg-gray-700">
                            <div className="flex flex-col items-center">
                              <div className="w-24 h-24 rounded-full bg-blue-500 dark:bg-blue-600 flex items-center justify-center text-white text-3xl">
                                {email[0].toUpperCase()}
                              </div>
                              <span className="mt-2 text-gray-600 dark:text-gray-300">Camera Off</span>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                    {!myStream && (
                      <div className="w-full h-full flex justify-center items-center bg-gray-100 dark:bg-gray-700">
                        <span className="text-gray-500 dark:text-gray-400">Initializing camera...</span>
                      </div>
                    )}
                  </div>

                  {/* Remote Video */}
                  {remoteSocketId ? (
                    <div className="relative overflow-hidden rounded-lg bg-white dark:bg-gray-800 shadow-lg border border-gray-200 dark:border-gray-700">
                      <div className="absolute top-4 left-4 bg-black/50 text-white px-2 py-1 rounded-md text-sm z-10">
                        {remoteEmail}
                      </div>
                      {remoteStream && (
                        <>
                          {!remoteVideoOff ? (
                            <ReactPlayer
                              playing
                              muted={remoteAudioOff}
                              height="100%"
                              width="100%"
                              url={remoteStream}
                              className="rounded-lg"
                            />
                          ) : (
                            <div className="w-full h-full flex justify-center items-center bg-gray-100 dark:bg-gray-700">
                              <div className="flex flex-col items-center">
                                <div className="w-24 h-24 rounded-full bg-purple-500 dark:bg-purple-600 flex items-center justify-center text-white text-3xl">
                                  {remoteEmail[0].toUpperCase()}
                                </div>
                                <span className="mt-2 text-gray-600 dark:text-gray-300">Camera Off</span>
                              </div>
                            </div>
                          )}
                        </>
                      )}
                      {!remoteStream && (
                        <div className="w-full h-full flex justify-center items-center bg-gray-100 dark:bg-gray-700">
                          <span className="text-gray-500 dark:text-gray-400">Waiting for peer...</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="relative overflow-hidden rounded-lg bg-white dark:bg-gray-800 shadow-lg border border-gray-200 dark:border-gray-700">
                      <div className="w-full h-full flex flex-col justify-center items-center bg-gray-100 dark:bg-gray-700">
                        <div className="mb-4 text-blue-500 dark:text-blue-400">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                          </svg>
                        </div>
                        <span className="text-gray-700 dark:text-gray-300 text-center font-medium">Waiting for someone to join</span>
                        <p className="mt-2 text-gray-500 dark:text-gray-400 text-center max-w-xs">
                          Share your session ID with a colleague to collaborate
                        </p>
                        <div className="mt-4 flex items-center">
                          <code className="bg-gray-200 dark:bg-gray-700 px-3 py-2 rounded text-sm">
                            {displayJoinCode || session?.joinCode || normalizedRouteKey}
                          </code>
                          <button
                            onClick={copyRoomId}
                            className="ml-2 p-2 bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700 text-white rounded"
                          >
                            {copied ? <CheckCheck size={16} /> : <Copy size={16} />}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Code Editor Panel */}
            {isEditorOpen && (
              <div className="flex-grow">
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 h-[calc(100vh-9rem)] overflow-auto">
                  <div className="p-3 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                    <h2 className="font-semibold text-gray-800 dark:text-gray-200">Code Editor</h2>
                    <button
                      className="p-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 rounded text-gray-700 dark:text-gray-300"
                      onClick={() => setIsEditorOpen(false)}
                    >
                      <X size={18} />
                    </button>
                  </div>
                  <div className="h-[calc(100%-3rem)]">
                    <Editor
                      key={collabRoomId}
                      roomId={collabRoomId}
                      socket={socket}
                      darkMode={darkMode}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Controls */}
        <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 shadow-lg border-t border-gray-200 dark:border-gray-700 p-4">
          <div className="max-w-3xl mx-auto flex items-center justify-center gap-3">
            <button
              className={`p-3 rounded-full ${
                isMuted
                  ? "bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-300"
                  : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
              }`}
              onClick={toggleMicrophone}
            >
              {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
            </button>
            <button
              className={`p-3 rounded-full ${
                isVideoOff
                  ? "bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-300"
                  : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
              }`}
              onClick={toggleVideo}
            >
              {isVideoOff ? <VideoOff size={20} /> : <Camera size={20} />}
            </button>
            <button
              className="p-3 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
              onClick={showScreen}
            >
              <Monitor size={20} />
            </button>
            <button
              className="p-3 rounded-full bg-red-500 hover:bg-red-600 text-white"
              onClick={() => setShowEndCallModal(true)}
              title="Leave call"
            >
              <Phone size={20} className="rotate-[135deg]" />
            </button>
            <div className="w-px h-6 bg-gray-300 dark:bg-gray-600"></div>
            <button
              className={`p-3 rounded-full ${
                isEditorOpen
                  ? "bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300"
                  : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
              }`}
              onClick={() => setIsEditorOpen((prev) => !prev)}
            >
              <Code size={20} />
            </button>
            <button
              className="p-3 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
              onClick={() => setIsFullscreen((prev) => !prev)}
            >
              {isFullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
            </button>
            <div className="w-px h-6 bg-gray-300 dark:bg-gray-600"></div>
            <button
              className={`p-3 rounded-full ${
                isWhiteboardOpen
                  ? "bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300"
                  : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
              }`}
              onClick={() => setIsWhiteboardOpen((prev) => !prev)}
            >
              <Pencil size={20} />
            </button>
            <button
              className={`p-3 rounded-full ${
                isResumeModalOpen
                  ? "bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-300"
                  : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
              }`}
              onClick={() => setIsResumeModalOpen((prev) => !prev)}
              title="Resume Interview Questions"
            >
              <FileText size={20} />
            </button>
            <button
              className={`p-3 rounded-full relative ${
                isChatOpen
                  ? "bg-teal-100 dark:bg-teal-900 text-teal-600 dark:text-teal-300"
                  : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
              }`}
              onClick={() => { setIsChatOpen((prev) => !prev); setUnreadCount(0); }}
              title="Chat"
            >
              <MessageSquare size={20} />
              {unreadCount > 0 && !isChatOpen && (
                <span style={{
                  position: 'absolute', top: 4, right: 4,
                  background: '#FF6B5B', color: '#fff',
                  borderRadius: '50%', width: 16, height: 16,
                  fontSize: 10, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>
      
      {/* Whiteboard */}
      <Whiteboard
        isOpen={isWhiteboardOpen}
        onClose={() => setIsWhiteboardOpen(false)}
        darkMode={darkMode}
        roomId={collabRoomId}
      />

      {/* Chat Panel */}
      {isChatOpen && (
        <div style={{
          position: 'fixed', right: 16, bottom: 80, top: 72,
          width: 320, zIndex: 200,
          display: 'flex', flexDirection: 'column',
        }}>
          <div style={{ position: 'absolute', top: -8, right: 0 }}>
            <button
              onClick={() => setIsChatOpen(false)}
              style={{
                background: '#FF6B5B', color: '#fff', border: 'none',
                borderRadius: '50%', width: 24, height: 24, cursor: 'pointer',
                fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              ×
            </button>
          </div>
          <ChatPanel
            roomId={collabRoomId}
            roomCuid={session?.id}
            currentUser={user || { name: email }}
            darkMode={darkMode}
          />
        </div>
      )}
      
      {/* Resume Interview Modal */}
      <ResumeInterviewModal 
        isOpen={isResumeModalOpen} 
        onClose={() => setIsResumeModalOpen(false)} 
        darkMode={darkMode}
        roomId={collabRoomId}
      />
      
      {/* End Call Modal */}
      {showEndCallModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Leave the call?</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
              You can leave the call and stay in the session, or end it for everyone.
            </p>
            <div className="flex flex-col gap-2">
              <button
                onClick={handleEndCall}
                className="w-full px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium"
              >
                Leave Call
              </button>
              {isRoomOwner && (
                <button
                  onClick={handleEndMeeting}
                  className="w-full px-4 py-2.5 bg-red-800 hover:bg-red-900 text-white rounded-lg font-medium"
                >
                  End Meeting for Everyone
                </button>
              )}
              <button
                onClick={() => setShowEndCallModal(false)}
                className="w-full px-4 py-2.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admit Dialog */}
      {showDialog && remoteEmail && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Incoming Request
            </h3>
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              <span className="font-medium text-blue-600 dark:text-blue-400">{remoteEmail}</span> wants to join your session.
            </p>
            <div className="flex justify-end space-x-3 mt-4">
              <button
                onClick={() => setShowDialog(false)}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
              >
                Decline
              </button>
              <button
                onClick={handleCallUser}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700"
              >
                Admit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RoomPage;