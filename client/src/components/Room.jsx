import React, { useEffect, useCallback, useState, useRef, useMemo } from "react";
import ReactPlayer from "react-player";
import { createPeerService } from "../services/Peer.js";
import { useSocket } from "../utils/SocketProvider.js";
import Editor from "./EditorPage.js";
import { useParams, useNavigate } from "react-router-dom";
import { toast, Toaster } from "react-hot-toast";
import Whiteboard from "./Whiteboard.jsx";
import ResumeInterviewModal from "./ResumeInterviewModal.jsx";
import ChatPanel from "./room/ChatPanel.jsx";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
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
  Copy,
  CheckCheck,
  Pencil,
  FileText,
  MessageSquare
} from "lucide-react";
import { normalizeRoomRouteKey, isLikelyCuid } from "../utils/roomKeys.js";

/** Grid slots: you + waiting card when alone, else you + each remote. */
function lobbySlotCount(remoteCount) {
  return remoteCount === 0 ? 2 : 1 + remoteCount;
}

/**
 * Equal-area matrix for the main video stage. Reflows when participant count
 * or viewport width changes (e.g. 3 people → 3 columns on wide screens).
 */
function fullscreenVideoMatrixDims(slotCount, width) {
  const n = Math.max(1, slotCount);
  if (width < 520) {
    return { cols: 1, rows: n };
  }
  if (n === 1) return { cols: 1, rows: 1 };
  if (n === 2) return { cols: 2, rows: 1 };
  if (n === 3) {
    if (width >= 640) return { cols: 3, rows: 1 };
    if (width >= 420) return { cols: 2, rows: 2 };
    return { cols: 1, rows: 3 };
  }
  if (n === 4) return { cols: 2, rows: 2 };
  if (n <= 6) {
    const cols = width >= 880 ? 3 : width >= 560 ? 2 : 1;
    return { cols, rows: Math.ceil(n / cols) };
  }
  const cols = Math.min(n, Math.max(3, Math.round(Math.sqrt(n))));
  return { cols, rows: Math.ceil(n / cols) };
}

/** Video rail above code editor: dense matrix inside fixed max-height rail */
function editorRailMatrixDims(slotCount, width) {
  const n = Math.max(1, slotCount);
  if (width < 440) return { cols: 1, rows: Math.min(n, 3) };
  if (n === 1) return { cols: 1, rows: 1 };
  const maxCols = Math.min(n, Math.max(2, Math.floor(width / 128)));
  if (n <= maxCols) return { cols: n, rows: 1 };
  return { cols: maxCols, rows: Math.ceil(n / maxCols) };
}

function videoMatrixStyle(dims) {
  return {
    gridTemplateColumns: `repeat(${dims.cols}, minmax(0, 1fr))`,
    gridTemplateRows: `repeat(${dims.rows}, minmax(0, 1fr))`,
  };
}

const RoomPage = () => {
  const socket = useSocket();
  const { roomId, email: urlEmail } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const email = user?.email || urlEmail || 'Guest';
  const [roomValid, setRoomValid] = useState(true);
  const [session, setSession] = useState(null);

  // Derive dark mode from global theme so the room stays in sync
  const darkMode = theme === 'dark';

  const normalizedRouteKey = useMemo(() => normalizeRoomRouteKey(roomId), [roomId]);
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

  /** 'loading' | 'waiting' | 'admitted' — guests stay on waiting overlay until host admits */
  const [admissionStatus, setAdmissionStatus] = useState("loading");
  const admissionStatusRef = useRef("loading");
  useEffect(() => {
    admissionStatusRef.current = admissionStatus;
  }, [admissionStatus]);
  /** Host: queue of { id, email } waiting to be admitted */
  const [knockQueue, setKnockQueue] = useState([]);
  const [myStream, setMyStream] = useState();
  const myStreamRef = useRef(null);
  /** Per remote socket id: { stream, email, videoOff, audioOff } */
  const [remoteTiles, setRemoteTiles] = useState({});
  const remoteParticipantCount = Object.keys(remoteTiles).length;
  const [viewportW, setViewportW] = useState(
    () => (typeof window !== "undefined" ? window.innerWidth : 1024)
  );
  useEffect(() => {
    const onResize = () => setViewportW(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  const videoSlotCount = useMemo(
    () => lobbySlotCount(remoteParticipantCount),
    [remoteParticipantCount]
  );
  const matrixDimsLobby = useMemo(
    () => fullscreenVideoMatrixDims(videoSlotCount, viewportW),
    [videoSlotCount, viewportW]
  );
  const matrixDimsEditorRail = useMemo(
    () => editorRailMatrixDims(videoSlotCount, viewportW),
    [videoSlotCount, viewportW]
  );
  const peersRef = useRef(new Map());
  const dialPeersRef = useRef([]);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isWhiteboardOpen, setIsWhiteboardOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isResumeModalOpen, setIsResumeModalOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [callStatus, setCallStatus] = useState('idle');
  const [isRoomOwner, setIsRoomOwner] = useState(false);
  const [showEndCallModal, setShowEndCallModal] = useState(false);

  const isRoomOwnerRef = useRef(false);
  useEffect(() => {
    isRoomOwnerRef.current = isRoomOwner;
  }, [isRoomOwner]);

  const removePeer = useCallback((remoteId) => {
    if (!remoteId) return;
    const entry = peersRef.current.get(remoteId);
    if (entry) {
      try {
        entry.svc.peer.removeEventListener("negotiationneeded", entry.negoFn);
        entry.svc.peer.close();
      } catch (_) {
        /* noop */
      }
      peersRef.current.delete(remoteId);
    }
    setRemoteTiles((prev) => {
      if (!prev[remoteId]) return prev;
      const next = { ...prev };
      delete next[remoteId];
      return next;
    });
  }, []);

  const teardownAllPeers = useCallback(() => {
    for (const id of [...peersRef.current.keys()]) {
      removePeer(id);
    }
    peersRef.current.clear();
  }, [removePeer]);

  const ensurePeerEntry = useCallback(
    (remoteId, remoteEmailHint) => {
      if (!socket || !remoteId || remoteId === socket.id) return null;
      let entry = peersRef.current.get(remoteId);
      if (entry) return entry;

      const svc = createPeerService();
      const negoFn = async () => {
        if (svc.peer.signalingState !== "stable") return;
        try {
          const offer = await svc.createOffer();
          socket.emit("peer:nego:needed", { offer, to: remoteId });
        } catch (e) {
          console.warn("negotiationneeded offer failed", e);
        }
      };

      svc.peer.addEventListener("negotiationneeded", negoFn);

      svc.onIceCandidate((candidate) => {
        socket.emit("ice:candidate", { to: remoteId, candidate });
      });

      svc.onTrack((stream) => {
        setRemoteTiles((prev) => ({
          ...prev,
          [remoteId]: {
            ...(prev[remoteId] || {}),
            stream,
            email: prev[remoteId]?.email || remoteEmailHint || "Peer",
          },
        }));
      });

      entry = { svc, negoFn, email: remoteEmailHint };
      peersRef.current.set(remoteId, entry);
      setRemoteTiles((prev) => ({
        ...prev,
        [remoteId]: {
          ...(prev[remoteId] || {}),
          email: remoteEmailHint || prev[remoteId]?.email || "Peer",
          videoOff: prev[remoteId]?.videoOff ?? false,
          audioOff: prev[remoteId]?.audioOff ?? false,
        },
      }));
      return entry;
    },
    [socket]
  );

  const connectToPeer = useCallback(
    async (remoteId, remoteEmailHint) => {
      if (!socket || admissionStatusRef.current !== "admitted" || !remoteId || remoteId === socket.id) return;
      if (peersRef.current.has(remoteId)) return;
      const stream = myStreamRef.current;
      if (!stream) {
        dialPeersRef.current.push({ id: remoteId, email: remoteEmailHint });
        return;
      }
      const entry = ensurePeerEntry(remoteId, remoteEmailHint);
      if (!entry) return;
      try {
        entry.svc.addLocalStream(stream);
        const offer = await entry.svc.createOffer();
        socket.emit("user:call", { to: remoteId, offer, email });
      } catch (e) {
        console.warn("connectToPeer failed", e);
        removePeer(remoteId);
      }
    },
    [socket, email, ensurePeerEntry, removePeer]
  );

  const handleIncommingCall = useCallback(
    async ({ from, offer, fromEmail }) => {
      if (!from || !socket) return;
      let stream = myStreamRef.current;
      if (!stream) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
          myStreamRef.current = stream;
          setMyStream(stream);
          setCallStatus("in-call");
        } catch {
          toast.error("Could not access camera/microphone");
          return;
        }
      }
      const entry = ensurePeerEntry(from, fromEmail);
      if (!entry) return;
      try {
        entry.svc.addLocalStream(stream);
        const ans = await entry.svc.acceptOffer(offer);
        socket.emit("call:accepted", { to: from, ans });
      } catch (e) {
        console.warn("acceptOffer failed", e);
      }
    },
    [socket, ensurePeerEntry]
  );

  const handleCallAccepted = useCallback(
    async ({ from, ans }) => {
      const entry = peersRef.current.get(from);
      if (!entry) return;
      try {
        await entry.svc.acceptAnswer(ans);
        const stream = myStreamRef.current;
        if (stream) entry.svc.addLocalStream(stream);
      } catch (e) {
        console.warn("acceptAnswer failed", e);
      }
    },
    []
  );

  const handleNegoNeedIncomming = useCallback(
    async ({ from, offer }) => {
      if (!socket || !from) return;
      let entry = peersRef.current.get(from);
      if (!entry) {
        const stream = myStreamRef.current;
        if (!stream) return;
        entry = ensurePeerEntry(from, null);
        if (!entry) return;
        entry.svc.addLocalStream(stream);
      }
      try {
        const ans = await entry.svc.acceptOffer(offer);
        socket.emit("peer:nego:done", { to: from, ans });
      } catch (e) {
        console.warn("nego incoming failed", e);
      }
    },
    [socket, ensurePeerEntry]
  );

  const handleNegoNeedFinal = useCallback(async ({ from, ans }) => {
    const entry = peersRef.current.get(from);
    if (!entry) return;
    try {
      await entry.svc.acceptAnswer(ans);
    } catch (e) {
      console.warn("nego final failed", e);
    }
  }, []);

  useEffect(() => {
    if (admissionStatus !== "admitted") return;
    const initializeMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        myStreamRef.current = stream;
        setMyStream(stream);
        setCallStatus("in-call");
      } catch (error) {
        toast.error("Could not access camera/microphone");
      }
    };
    initializeMedia();
    return () => {
      myStreamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, [admissionStatus]);

  useEffect(() => {
    if (!socket || admissionStatus !== "admitted") return;
    const handleRemoteIce = ({ from, candidate }) => {
      if (!from) return;
      const entry = peersRef.current.get(from);
      if (entry) entry.svc.addRemoteIceCandidate(candidate);
    };
    socket.on("ice:candidate", handleRemoteIce);
    return () => {
      socket.off("ice:candidate", handleRemoteIce);
    };
  }, [socket, admissionStatus]);

  useEffect(() => {
    if (!socket || admissionStatus !== "admitted" || !myStream) return;
    const pending = dialPeersRef.current.splice(0, dialPeersRef.current.length);
    for (const p of pending) {
      if (p.id && p.id !== socket.id) connectToPeer(p.id, p.email);
    }
  }, [socket, admissionStatus, myStream, connectToPeer]);

  useEffect(() => {
    if (!socket) return;

    const handleUserLeft = ({ id, email }) => {
      toast(`${email || "Someone"} has left the room.`, { icon: "👋" });
      if (id) removePeer(id);
    };

    const handleRoomJoinError = ({ error }) => {
      toast.error(error);
      setRoomValid(false);
      setTimeout(() => {
        navigate(user ? "/dashboard" : "/");
      }, 3000);
    };

    const handleRoster = ({ clients }) => {
      if (admissionStatusRef.current !== "admitted" || !clients?.length) return;
      const selfId = socket.id;
      const others = clients.filter((c) => c.socketId !== selfId);
      for (const o of others) {
        if (!o?.socketId) continue;
        if (peersRef.current.has(o.socketId)) continue;
        connectToPeer(o.socketId, o.email || "Guest");
      }
    };

    socket.on("user:left", handleUserLeft);
    socket.on("room:join:error", handleRoomJoinError);
    socket.on("new", handleRoster);

    return () => {
      socket.off("user:left", handleUserLeft);
      socket.off("room:join:error", handleRoomJoinError);
      socket.off("new", handleRoster);
    };
  }, [socket, connectToPeer, navigate, user, removePeer]);

  useEffect(() => {
    if (!socket) return;
    socket.on("incomming:call", handleIncommingCall);
    socket.on("call:accepted", handleCallAccepted);
    socket.on("peer:nego:needed", handleNegoNeedIncomming);
    socket.on("peer:nego:final", handleNegoNeedFinal);
    return () => {
      socket.off("incomming:call", handleIncommingCall);
      socket.off("call:accepted", handleCallAccepted);
      socket.off("peer:nego:needed", handleNegoNeedIncomming);
      socket.off("peer:nego:final", handleNegoNeedFinal);
    };
  }, [socket, handleIncommingCall, handleCallAccepted, handleNegoNeedIncomming, handleNegoNeedFinal]);

  const handleEndCall = useCallback(() => {
    if (myStream) {
      myStream.getTracks().forEach((t) => t.stop());
      setMyStream(null);
    }
    myStreamRef.current = null;
    if (socket) {
      for (const remoteId of peersRef.current.keys()) {
        socket.emit("call:left", { to: remoteId });
      }
    }
    teardownAllPeers();
    setRemoteTiles({});
    setCallStatus("ended");
    setShowEndCallModal(false);
  }, [myStream, socket, teardownAllPeers]);

  const handleRejoin = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      myStreamRef.current = stream;
      setMyStream(stream);
      setIsVideoOff(false);
      setIsMuted(false);
      setCallStatus("in-call");
      if (socket) socket.emit("user:rejoin");
    } catch (err) {
      toast.error("Could not access camera/microphone");
    }
  }, [socket]);

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
    if (myStream && socket) {
      const videoTrack = myStream.getVideoTracks()[0];
      if (videoTrack) videoTrack.enabled = !videoTrack.enabled;
      const nextOff = !isVideoOff;
      for (const remoteId of peersRef.current.keys()) {
        socket.emit("user:video:toggle", { to: remoteId, isVideoOff: nextOff, email });
      }
    }
    setIsVideoOff((prev) => !prev);
  };

  const toggleMicrophone = () => {
    if (myStream && socket) {
      const audioTrack = myStream.getAudioTracks()[0];
      if (audioTrack) audioTrack.enabled = !audioTrack.enabled;
      const nextMuted = !isMuted;
      for (const remoteId of peersRef.current.keys()) {
        socket.emit("user:audio:toggle", { to: remoteId, isAudioOff: nextMuted, email });
      }
    }
    setIsMuted((prev) => !prev);
  };

  useEffect(() => {
    if (!socket) return;
    const handleRemoteVideoToggle = ({ isVideoOff, from }) => {
      if (!from) return;
      setRemoteTiles((prev) => {
        const cur = prev[from];
        if (!cur?.stream) return prev;
        const videoTrack = cur.stream.getVideoTracks()[0];
        if (videoTrack) videoTrack.enabled = !isVideoOff;
        return {
          ...prev,
          [from]: { ...cur, videoOff: isVideoOff },
        };
      });
    };
    const handleRemoteAudioToggle = ({ isAudioOff, from }) => {
      if (!from) return;
      setRemoteTiles((prev) => {
        const cur = prev[from];
        if (!cur?.stream) return prev;
        const audioTrack = cur.stream.getAudioTracks()[0];
        if (audioTrack) audioTrack.enabled = !isAudioOff;
        return {
          ...prev,
          [from]: { ...cur, audioOff: isAudioOff },
        };
      });
    };
    socket.on("remote:video:toggle", handleRemoteVideoToggle);
    socket.on("remote:audio:toggle", handleRemoteAudioToggle);
    return () => {
      socket.off("remote:video:toggle", handleRemoteVideoToggle);
      socket.off("remote:audio:toggle", handleRemoteAudioToggle);
    };
  }, [socket]);

  useEffect(() => {
    if (!socket) return;
    if (isChatOpen) { setUnreadCount(0); return; }
    const handler = () => setUnreadCount((n) => n + 1);
    socket.on('message:new', handler);
    return () => socket.off('message:new', handler);
  }, [socket, isChatOpen]);

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
      const admitted = data.admitted !== false;
      if (!admitted) {
        setAdmissionStatus("waiting");
        return;
      }
      setAdmissionStatus("admitted");
      if (data?.peers?.length) {
        for (const p of data.peers) {
          if (p.id && p.id !== socket.id && !peersRef.current.has(p.id)) {
            dialPeersRef.current.push({ id: p.id, email: p.email || "Guest" });
          }
        }
      }
    };

    const handleUserKnock = ({ email: knockEmail, id }) => {
      if (!id || id === socket.id) return;
      if (!isRoomOwnerRef.current) return;
      setKnockQueue((q) => (q.some((x) => x.id === id) ? q : [...q, { id, email: knockEmail || "Guest" }]));
    };

    const handleUserJoinedSession = ({ email: joinedEmail, id }) => {
      if (!id || id === socket.id) return;
      if (admissionStatusRef.current !== "admitted") return;
      connectToPeer(id, joinedEmail || "Guest");
    };

    const handleRoomDenied = ({ reason }) => {
      toast.error(reason || "You were not admitted to this session.");
      setTimeout(() => navigate(user ? "/dashboard" : "/"), 1200);
    };

    const handleUserRejoined = ({ email: rejoinEmail, id }) => {
      if (!id || id === socket.id) return;
      connectToPeer(id, rejoinEmail || "Guest");
    };

    const handleMeetingEnded = () => {
      toast("The meeting was ended by the host.", { icon: "🚪" });
      if (myStream) myStream.getTracks().forEach((t) => t.stop());
      setMyStream(null);
      myStreamRef.current = null;
      teardownAllPeers();
      setRemoteTiles({});
      setTimeout(() => navigate(user ? "/dashboard" : "/"), 1500);
    };

    const handleCallLeft = ({ from }) => {
      if (!from) return;
      const label = peersRef.current.get(from)?.email || "A participant";
      removePeer(from);
      toast(`${label} left the call.`, { icon: "📵" });
    };

    const handleAdmitError = ({ error }) => {
      if (error) toast.error(error);
    };

    socket.on("room:join", handleRoomJoined);
    socket.on("user:knock", handleUserKnock);
    socket.on("user:joined", handleUserJoinedSession);
    socket.on("room:denied", handleRoomDenied);
    socket.on("user:rejoined", handleUserRejoined);
    socket.on("meeting:ended", handleMeetingEnded);
    socket.on("call:left", handleCallLeft);
    socket.on("room:admit:error", handleAdmitError);

    return () => {
      socket.off("room:join", handleRoomJoined);
      socket.off("user:knock", handleUserKnock);
      socket.off("user:joined", handleUserJoinedSession);
      socket.off("room:denied", handleRoomDenied);
      socket.off("user:rejoined", handleUserRejoined);
      socket.off("meeting:ended", handleMeetingEnded);
      socket.off("call:left", handleCallLeft);
      socket.off("room:admit:error", handleAdmitError);
    };
  }, [socket, email, myStream, navigate, user, roomId, connectToPeer, removePeer, teardownAllPeers]);

  const showScreen = async () => {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      const screenTrack = screenStream.getVideoTracks()[0];
      if (!screenTrack) return;
      const videoTrackLocal = myStream?.getVideoTracks()[0];
      for (const [, entry] of peersRef.current) {
        const sender = entry.svc.peer.getSenders().find((s) => s.track && s.track.kind === "video");
        if (sender) sender.replaceTrack(screenTrack);
      }
      screenTrack.onended = () => {
        for (const [, entry] of peersRef.current) {
          const sender = entry.svc.peer.getSenders().find((s) => s.track && s.track.kind === "video");
          if (sender && videoTrackLocal) sender.replaceTrack(videoTrackLocal);
        }
      };
    } catch (error) {
      console.error("Error while sharing screen:", error);
    }
  };

  const copyRoomId = () => {
    const toCopy = displayJoinCode || session?.joinCode || (!isLikelyCuid(roomId) ? normalizedRouteKey : roomId);
    navigator.clipboard.writeText(toCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast("Session ID copied!", { icon: "📋" });
  };

  // Close modals on Escape key
  useEffect(() => {
    const handler = (e) => {
      if (e.key !== "Escape") return;
      if (showEndCallModal) {
        setShowEndCallModal(false);
        return;
      }
      if (knockQueue.length) {
        setKnockQueue((q) => q.slice(1));
        return;
      }
      if (isChatOpen) {
        setIsChatOpen(false);
        return;
      }
      if (isWhiteboardOpen) {
        setIsWhiteboardOpen(false);
        return;
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [showEndCallModal, knockQueue.length, isChatOpen, isWhiteboardOpen]);

  // ── Helpers ──

  const AvatarPlaceholder = ({ name, size = 80, color = '#5865F2' }) => (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: color, color: '#fff',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.36, fontWeight: 700, userSelect: 'none',
    }}>
      {name?.[0]?.toUpperCase() || '?'}
    </div>
  );

  const VideoFeed = ({ stream, isOff, label, muted, audioOff, color, isCompact }) => {
    const avatarSize = isCompact ? 48 : 96;
    return (
      <div style={{
        width: '100%', height: '100%', position: 'relative', minHeight: 0, minWidth: 0,
        borderRadius: 14, overflow: 'hidden',
        background: darkMode ? '#0b1220' : '#0f172a',
        border: `1px solid ${darkMode ? '#1e293b' : 'rgba(255,255,255,0.08)'}`,
        boxShadow: darkMode
          ? '0 1px 0 rgba(255,255,255,0.04), 0 8px 24px rgba(0,0,0,0.45)'
          : '0 1px 2px rgba(15,23,42,0.06), 0 8px 24px rgba(15,23,42,0.18)',
      }}>
        {stream && !isOff ? (
          <ReactPlayer
            playing
            muted={muted}
            height="100%"
            width="100%"
            url={stream}
            style={{ objectFit: "cover" }}
            config={{ file: { attributes: { style: { width: "100%", height: "100%", objectFit: "cover" } } } }}
          />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            <AvatarPlaceholder name={label} size={avatarSize} color={color} />
            {isOff && (
              <span style={{ fontSize: 12, color: '#94a3b8' }}>
                Camera off
              </span>
            )}
          </div>
        )}
        {/* Bottom-left name pill (Meet-style) */}
        <div style={{
          position: 'absolute', bottom: 10, left: 10, zIndex: 5,
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'rgba(15,23,42,0.65)', color: '#fff',
          borderRadius: 8, padding: '4px 10px',
          fontSize: 12, fontWeight: 600,
          maxWidth: 'calc(100% - 20px)',
        }}>
          {audioOff && (
            <MicOff size={12} aria-hidden="true" style={{ color: '#f87171', flexShrink: 0 }} />
          )}
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {label}
          </span>
        </div>
      </div>
    );
  };

  if (!roomValid) {
    return (
      <div style={{
        minHeight: '100vh', background: 'var(--bg)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🚫</div>
          <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Invalid Room</h2>
          <p style={{ color: 'var(--text3)', fontSize: 14 }}>
            This room does not exist or is no longer active. Redirecting…
          </p>
        </div>
      </div>
    );
  }

  // ── Layout tokens based on dark mode ──
  const headerBg = darkMode ? '#1e293b' : '#ffffff';
  const headerBorder = darkMode ? '#334155' : '#e2e8f0';
  const cardBg = darkMode ? '#1e293b' : '#ffffff';
  const cardBorder = darkMode ? '#334155' : '#e2e8f0';
  const textPrimary = darkMode ? '#f1f5f9' : '#1a1a1a';
  const textMuted = darkMode ? '#64748b' : '#9a9a9a';
  const panelBg = darkMode ? '#0f172a' : '#f8f6f2';
  const REMOTE_COLORS = ["#8b5cf6", "#10b981", "#f59e0b", "#ec4899", "#06b6d4", "#eab308"];
  const remoteEntries = Object.entries(remoteTiles);

  const admitHead = knockQueue[0];
  const handleAdmitKnock = () => {
    if (!admitHead || !socket || !collabRoomId) return;
    socket.emit("room:admit", { roomId: collabRoomId, targetSocketId: admitHead.id });
    setKnockQueue((q) => q.slice(1));
  };
  const handleDeclineKnock = () => {
    if (!admitHead || !socket || !collabRoomId) return;
    socket.emit("room:decline", { roomId: collabRoomId, targetSocketId: admitHead.id });
    setKnockQueue((q) => q.slice(1));
  };

  return (
    <div
      className={darkMode ? "dark" : ""}
      style={{
        minHeight: "100dvh",
        background: panelBg,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Toaster position="top-center" />

      {admissionStatus === "waiting" && (
        <div
          role="status"
          aria-live="polite"
          aria-busy="true"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 10000,
            background: "rgba(15, 23, 42, 0.94)",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
            boxShadow: "inset 0 0 120px rgba(0,0,0,0.45)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 22,
            padding: 28,
          }}
        >
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: "50%",
              border: "3px solid rgba(255,255,255,0.12)",
              borderTopColor: "var(--coral, #ff6b6b)",
              animation: "spin 1s linear infinite",
            }}
          />
          <p
            style={{
              color: "#f1f5f9",
              fontSize: 17,
              fontWeight: 600,
              textAlign: "center",
              maxWidth: 340,
              margin: 0,
              lineHeight: 1.45,
            }}
          >
            Waiting for the host to admit you
          </p>
          <p
            style={{
              color: "#94a3b8",
              fontSize: 14,
              textAlign: "center",
              maxWidth: 380,
              margin: 0,
              lineHeight: 1.5,
            }}
          >
            You will join the meeting, video, chat, and shared tools as soon as the host lets you in. Keep this tab open.
          </p>
        </div>
      )}

      {/* ── Header ── */}
      <header style={{
        background: headerBg, borderBottom: `1px solid ${headerBorder}`,
        padding: '0 16px', position: 'sticky', top: 0, zIndex: 50,
        display: 'flex', alignItems: 'center', height: 56, flexShrink: 0,
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <div style={{ width: 28, height: 28, background: 'var(--coral)', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: '#fff', fontFamily: 'Poppins', fontWeight: 800, fontSize: 12 }}>S</span>
          </div>
          <span style={{ fontFamily: 'Poppins', fontWeight: 700, fontSize: 15, color: textPrimary }}>SyncCodes</span>
        </div>

        {/* Session code — hidden on small screens */}
        <div className="room-session-info" style={{ marginLeft: 16 }}>
          <span style={{ fontSize: 12, color: textMuted }}>Session:</span>
          <code style={{
            background: darkMode ? '#334155' : '#f1f5f9',
            color: textPrimary, padding: '3px 8px', borderRadius: 6,
            fontSize: 11, fontFamily: 'monospace', letterSpacing: '0.06em',
          }}>
            {displayJoinCode || session?.joinCode || (isLikelyCuid(roomId) ? `${roomId.slice(0, 8)}…` : normalizedRouteKey || "—")}
          </code>
          <button
            onClick={copyRoomId}
            aria-label={copied ? "Session ID copied" : "Copy session ID"}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: textMuted, padding: 2 }}
          >
            {copied ? <CheckCheck size={14} color="var(--teal)" aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
          </button>
        </div>

        {/* Right side */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Copy on mobile */}
          <button
            onClick={copyRoomId}
            aria-label={copied ? "Session ID copied" : "Copy session ID"}
            style={{
              background: darkMode ? '#334155' : '#f1f5f9', border: 'none', borderRadius: 7,
              padding: '5px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
              color: textMuted, fontSize: 11,
            }}
          >
            {copied ? <CheckCheck size={13} color="var(--teal)" aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}
          </button>

          {/* Theme */}
          <button
            onClick={toggleTheme}
            aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            style={{
              background: darkMode ? '#334155' : '#f1f5f9', border: 'none', borderRadius: 7,
              padding: '5px 9px', cursor: 'pointer', fontSize: 15,
            }}
          >
            <span aria-hidden="true">{darkMode ? '☀️' : '🌙'}</span>
          </button>

          {/* User badge */}
          <div className="room-user-badge">
            <div style={{
              background: darkMode ? '#1d4ed8' : '#dbeafe',
              color: darkMode ? '#93c5fd' : '#1d4ed8',
              borderRadius: 20, padding: '3px 10px', fontSize: 12, fontWeight: 600,
              maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {email}
            </div>
          </div>
        </div>
      </header>

      {/* ── Main content ── */}
      <div
        className={`room-main-stage${isChatOpen ? ' chat-docked' : ''}`}
        style={{
          padding: "10px 10px 0",
          flex: 1,
          minHeight: 0,
          overflow: "hidden",
          display: "flex",
          flexDirection: "row",
          gap: 10,
        }}
      >
        <div className={`room-layout${isEditorOpen ? " editor-open" : ""}`} style={{ flex: 1, minHeight: 0, minWidth: 0, height: "100%" }}>

          {/* Video column */}
          <div className="room-video-col" style={{ position: "relative" }}>
            {/* Post-call overlay */}
            {callStatus === 'ended' && (
              <div style={{
                position: 'absolute', inset: 0, zIndex: 10, borderRadius: 10,
                background: 'rgba(0,0,0,.85)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12,
              }}>
                <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(239,68,68,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <PhoneOff size={28} color="#f87171" />
                </div>
                <div style={{ textAlign: 'center', color: '#fff' }}>
                  <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>You left the call</div>
                  <div style={{ fontSize: 13, color: '#94a3b8' }}>You can rejoin or return to the lobby</div>
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                  <button onClick={handleRejoin} style={{ padding: '8px 20px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: 14 }}>
                    Rejoin
                  </button>
                  <button onClick={handleReturnToLobby} style={{ padding: '8px 20px', background: '#374151', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: 14 }}>
                    Lobby
                  </button>
                </div>
              </div>
            )}

            {isEditorOpen ? (
              <div
                style={{
                  background: cardBg,
                  border: `1px solid ${cardBorder}`,
                  borderRadius: 12,
                  height: "100%",
                  minHeight: 0,
                  display: "flex",
                  flexDirection: "column",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    padding: "8px 12px",
                    borderBottom: `1px solid ${cardBorder}`,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    flexShrink: 0,
                  }}
                >
                  <Camera size={15} color={textMuted} aria-hidden />
                  <span style={{ fontSize: 12, fontWeight: 600, color: textPrimary }}>Participants</span>
                  <span style={{ marginLeft: "auto", fontSize: 11, color: textMuted }}>
                    {videoSlotCount} {videoSlotCount === 1 ? "person" : "people"}
                  </span>
                </div>
                <div
                  className="room-video-matrix"
                  style={{
                    ...videoMatrixStyle(matrixDimsEditorRail),
                    flex: 1,
                    minHeight: 0,
                    padding: 8,
                    gap: 8,
                    overflow: "auto",
                  }}
                >
                  <div className="room-video-cell">
                    <VideoFeed
                      stream={myStream}
                      isOff={isVideoOff}
                      label={`${email} (You)`}
                      muted
                      audioOff={isMuted}
                      color="#5865F2"
                      isCompact
                    />
                  </div>
                  {remoteEntries.map(([rid, t], i) => (
                    <div key={rid} className="room-video-cell">
                      <VideoFeed
                        stream={t.stream}
                        isOff={t.videoOff}
                        label={t.email || "Peer"}
                        muted={t.audioOff}
                        audioOff={t.audioOff}
                        color={REMOTE_COLORS[i % REMOTE_COLORS.length]}
                        isCompact
                      />
                    </div>
                  ))}
                  {remoteEntries.length === 0 && (
                    <div
                      className="room-video-cell"
                      style={{
                        background: darkMode ? "#0f172a" : "#f1f5f9",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: 10,
                        gap: 6,
                      }}
                    >
                      <span style={{ fontSize: 20 }} aria-hidden>👥</span>
                      <span style={{ fontSize: 11, color: textMuted, textAlign: "center" }}>Waiting for others</span>
                      <button
                        type="button"
                        onClick={copyRoomId}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                          background: "#3b82f6",
                          color: "#fff",
                          border: "none",
                          borderRadius: 6,
                          padding: "4px 10px",
                          fontSize: 11,
                          cursor: "pointer",
                        }}
                      >
                        {copied ? <CheckCheck size={11} /> : <Copy size={11} />} Copy ID
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div
                className="room-video-matrix"
                style={{
                  ...videoMatrixStyle(matrixDimsLobby),
                  gap: 10,
                  flex: 1,
                  minHeight: 0,
                }}
              >
                <div className="room-video-cell">
                  <VideoFeed
                    stream={myStream}
                    isOff={isVideoOff}
                    label={`${email} (You)`}
                    muted
                    audioOff={isMuted}
                    color="#5865F2"
                  />
                </div>
                {remoteEntries.map(([rid, t], i) => (
                  <div key={rid} className="room-video-cell">
                    <VideoFeed
                      stream={t.stream}
                      isOff={t.videoOff}
                      label={t.email || "Peer"}
                      muted={t.audioOff}
                      audioOff={t.audioOff}
                      color={REMOTE_COLORS[i % REMOTE_COLORS.length]}
                    />
                  </div>
                ))}
                {remoteEntries.length === 0 && (
                  <div
                    className="room-video-cell"
                    style={{
                      background: darkMode ? "#1e293b" : "#e2e8f0",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 12,
                      padding: 16,
                    }}
                  >
                    <div style={{ fontSize: 44, color: darkMode ? "#475569" : "#94a3b8" }} aria-hidden>👥</div>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontWeight: 600, color: textPrimary, fontSize: 14 }}>Waiting for others</div>
                      <div style={{ fontSize: 12, color: textMuted, marginTop: 4 }}>
                        Share your session ID to invite more people
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
                      <code
                        style={{
                          background: darkMode ? "#334155" : "#f1f5f9",
                          padding: "6px 12px",
                          borderRadius: 8,
                          fontSize: 12,
                          fontFamily: "monospace",
                          letterSpacing: "0.06em",
                          color: textPrimary,
                        }}
                      >
                        {displayJoinCode || session?.joinCode || normalizedRouteKey}
                      </code>
                      <button
                        type="button"
                        onClick={copyRoomId}
                        style={{
                          background: "#3b82f6",
                          color: "#fff",
                          border: "none",
                          borderRadius: 8,
                          padding: "6px 10px",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                          fontSize: 12,
                        }}
                      >
                        {copied ? <CheckCheck size={13} /> : <Copy size={13} />}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Code editor panel — flexes below the participant rail */}
          {isEditorOpen && (
            <div className="room-editor-col" style={{ minHeight: 0 }}>
              <div
                style={{
                  background: cardBg,
                  border: `1px solid ${cardBorder}`,
                  borderRadius: 12,
                  height: "100%",
                  minHeight: 0,
                  display: "flex",
                  flexDirection: "column",
                  overflow: "hidden",
                  boxShadow: darkMode ? "0 4px 24px rgba(0,0,0,.25)" : "var(--shadow-sm)",
                }}
              >
                <div
                  style={{
                    padding: "10px 14px",
                    borderBottom: `1px solid ${cardBorder}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexShrink: 0,
                    gap: 10,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: "var(--teal)",
                        flexShrink: 0,
                      }}
                      aria-hidden
                    />
                    <span style={{ fontWeight: 600, fontSize: 14, color: textPrimary }}>Code editor</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsEditorOpen(false)}
                    aria-label="Close code editor"
                    style={{
                      background: darkMode ? "#334155" : "#f1f5f9",
                      border: "none",
                      borderRadius: 8,
                      padding: "6px 10px",
                      cursor: "pointer",
                      color: textMuted,
                      display: "flex",
                      alignItems: "center",
                    }}
                  >
                    <X size={16} aria-hidden="true" />
                  </button>
                </div>
                <div style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
                  <Editor key={collabRoomId} roomId={collabRoomId} socket={socket} darkMode={darkMode} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Chat dock — mounted from admission onward so messages stream even while closed */}
        {admissionStatus === 'admitted' && (
          <aside
            className={`room-chat-dock${isChatOpen ? ' open' : ''}`}
            aria-label="Chat"
            aria-hidden={!isChatOpen}
          >
            <div className="room-chat-dock-header">
              <span style={{ fontSize: 13, fontWeight: 600, color: textPrimary }}>Chat</span>
              <button
                type="button"
                onClick={() => setIsChatOpen(false)}
                aria-label="Close chat"
                style={{
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  color: textMuted, padding: 4, display: 'flex', alignItems: 'center',
                }}
              >
                <X size={16} aria-hidden="true" />
              </button>
            </div>
            <div className="room-chat-dock-body">
              <ChatPanel
                roomId={collabRoomId}
                roomCuid={session?.id}
                currentUser={user || { name: email }}
                darkMode={darkMode}
              />
            </div>
          </aside>
        )}
      </div>

      {/* ── Controls bar ── */}
      <div className="room-controls-bar" style={{ background: headerBg, borderTopColor: headerBorder }}>
        {/* Mic */}
        <button
          className="ctrl-btn"
          onClick={toggleMicrophone}
          aria-label={isMuted ? "Unmute microphone" : "Mute microphone"}
          aria-pressed={isMuted}
          style={{ background: isMuted ? 'rgba(239,68,68,.15)' : (darkMode ? '#334155' : '#f1f5f9'), color: isMuted ? '#ef4444' : textPrimary }}
        >
          {isMuted ? <MicOff size={18} aria-hidden="true" /> : <Mic size={18} aria-hidden="true" />}
        </button>

        {/* Camera */}
        <button
          className="ctrl-btn"
          onClick={toggleVideo}
          aria-label={isVideoOff ? "Start video" : "Stop video"}
          aria-pressed={isVideoOff}
          style={{ background: isVideoOff ? 'rgba(239,68,68,.15)' : (darkMode ? '#334155' : '#f1f5f9'), color: isVideoOff ? '#ef4444' : textPrimary }}
        >
          {isVideoOff ? <VideoOff size={18} aria-hidden="true" /> : <Camera size={18} aria-hidden="true" />}
        </button>

        {/* Screen share */}
        <button
          className="ctrl-btn"
          onClick={showScreen}
          aria-label="Share screen"
          style={{ background: darkMode ? '#334155' : '#f1f5f9', color: textPrimary }}
        >
          <Monitor size={18} aria-hidden="true" />
        </button>

        {/* Hang up */}
        <button
          className="ctrl-btn"
          onClick={() => setShowEndCallModal(true)}
          aria-label="Leave call"
          style={{ background: '#ef4444', color: '#fff' }}
        >
          <Phone size={18} aria-hidden="true" style={{ transform: 'rotate(135deg)' }} />
        </button>

        <div className="ctrl-divider" aria-hidden="true" />

        {/* Editor */}
        <button
          className="ctrl-btn"
          onClick={() => setIsEditorOpen((prev) => !prev)}
          aria-label={isEditorOpen ? "Close code editor" : "Open code editor"}
          aria-pressed={isEditorOpen}
          style={{ background: isEditorOpen ? 'rgba(59,130,246,.15)' : (darkMode ? '#334155' : '#f1f5f9'), color: isEditorOpen ? '#3b82f6' : textPrimary }}
        >
          <Code size={18} aria-hidden="true" />
        </button>

        {/* Fullscreen */}
        <button
          className="ctrl-btn"
          onClick={() => setIsFullscreen((prev) => !prev)}
          aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          style={{ background: darkMode ? '#334155' : '#f1f5f9', color: textPrimary }}
        >
          {isFullscreen ? <Minimize2 size={18} aria-hidden="true" /> : <Maximize2 size={18} aria-hidden="true" />}
        </button>

        <div className="ctrl-divider" aria-hidden="true" />

        {/* Whiteboard */}
        <button
          className="ctrl-btn"
          onClick={() => setIsWhiteboardOpen((prev) => !prev)}
          aria-label={isWhiteboardOpen ? "Close whiteboard" : "Open whiteboard"}
          aria-pressed={isWhiteboardOpen}
          style={{ background: isWhiteboardOpen ? 'rgba(59,130,246,.15)' : (darkMode ? '#334155' : '#f1f5f9'), color: isWhiteboardOpen ? '#3b82f6' : textPrimary }}
        >
          <Pencil size={18} aria-hidden="true" />
        </button>

        {/* Interview questions */}
        <button
          className="ctrl-btn"
          onClick={() => setIsResumeModalOpen((prev) => !prev)}
          aria-label={isResumeModalOpen ? "Close interview questions" : "Open interview questions"}
          aria-pressed={isResumeModalOpen}
          style={{ background: isResumeModalOpen ? 'rgba(139,92,246,.15)' : (darkMode ? '#334155' : '#f1f5f9'), color: isResumeModalOpen ? '#8b5cf6' : textPrimary }}
        >
          <FileText size={18} aria-hidden="true" />
        </button>

        {/* Chat */}
        <button
          className="ctrl-btn"
          onClick={() => { setIsChatOpen((prev) => !prev); setUnreadCount(0); }}
          aria-label={isChatOpen ? "Close chat" : `Open chat${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
          aria-pressed={isChatOpen}
          style={{ background: isChatOpen ? 'rgba(29,184,163,.15)' : (darkMode ? '#334155' : '#f1f5f9'), color: isChatOpen ? 'var(--teal)' : textPrimary, position: 'relative' }}
        >
          <MessageSquare size={18} aria-hidden="true" />
          {unreadCount > 0 && !isChatOpen && (
            <span
              aria-hidden="true"
              style={{
                position: 'absolute', top: 2, right: 2,
                background: 'var(--coral)', color: '#fff', borderRadius: '50%',
                width: 16, height: 16, fontSize: 9, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      </div>

      {/* ── Whiteboard ── */}
      <Whiteboard
        isOpen={isWhiteboardOpen}
        onClose={() => setIsWhiteboardOpen(false)}
        darkMode={darkMode}
        roomId={collabRoomId}
      />

      {/* ── Resume Interview Modal ── */}
      <ResumeInterviewModal
        isOpen={isResumeModalOpen}
        onClose={() => setIsResumeModalOpen(false)}
        darkMode={darkMode}
        roomId={collabRoomId}
      />

      {/* ── End Call Modal ── */}
      {showEndCallModal && (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="end-call-title"
          aria-describedby="end-call-desc"
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500, padding: 16,
          }}
        >
          <div style={{
            background: cardBg, borderRadius: 16, padding: 28,
            width: '100%', maxWidth: 360, boxShadow: 'var(--shadow-xl)',
            animation: 'fadeIn .15s ease',
          }}>
            <h3 id="end-call-title" style={{ fontSize: 17, fontWeight: 700, color: textPrimary, marginBottom: 6 }}>Leave the call?</h3>
            <p id="end-call-desc" style={{ fontSize: 13, color: textMuted, marginBottom: 20, lineHeight: 1.5 }}>
              You can leave the call and stay in the session, or end it for everyone.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button
                onClick={handleEndCall}
                autoFocus
                style={{ padding: '11px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 600, cursor: 'pointer', fontSize: 14 }}
              >
                Leave Call
              </button>
              {isRoomOwner && (
                <button
                  onClick={handleEndMeeting}
                  style={{ padding: '11px', background: '#7f1d1d', color: '#fca5a5', border: 'none', borderRadius: 10, fontWeight: 600, cursor: 'pointer', fontSize: 14 }}
                >
                  End Meeting for Everyone
                </button>
              )}
              <button
                onClick={() => setShowEndCallModal(false)}
                style={{
                  padding: '11px',
                  background: darkMode ? '#334155' : '#f1f5f9',
                  color: textPrimary, border: 'none', borderRadius: 10,
                  fontWeight: 600, cursor: 'pointer', fontSize: 14,
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Admit waiting participants (host) ── */}
      {admitHead && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="admit-dialog-title"
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500, padding: 16,
          }}
        >
          <div style={{
            background: cardBg, borderRadius: 16, padding: 28,
            width: '100%', maxWidth: 380, boxShadow: 'var(--shadow-xl)',
            animation: 'fadeIn .15s ease',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <div style={{
                width: 44, height: 44, borderRadius: '50%',
                background: 'rgba(59,130,246,.15)', color: '#3b82f6',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 20, fontWeight: 700,
              }}>
                {(admitHead.email || "?")[0].toUpperCase()}
              </div>
              <div>
                <div id="admit-dialog-title" style={{ fontWeight: 700, fontSize: 15, color: textPrimary }}>Someone is waiting</div>
                <div style={{ fontSize: 13, color: textMuted, marginTop: 2 }}>wants to join your meeting</div>
              </div>
            </div>
            <div style={{
              background: darkMode ? '#334155' : '#f1f5f9',
              borderRadius: 8, padding: '8px 12px', fontSize: 13,
              color: '#3b82f6', fontWeight: 600, marginBottom: 20,
              wordBreak: 'break-all',
            }}>
              {admitHead.email}
            </div>
            {knockQueue.length > 1 && (
              <div style={{ fontSize: 12, color: textMuted, marginTop: -12, marginBottom: 16 }}>
                +{knockQueue.length - 1} more in queue after this one
              </div>
            )}
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                onClick={handleDeclineKnock}
                autoFocus
                style={{ flex: 1, padding: '10px', background: darkMode ? '#334155' : '#f1f5f9', color: textPrimary, border: 'none', borderRadius: 10, fontWeight: 600, cursor: 'pointer', fontSize: 14 }}
              >
                Decline
              </button>
              <button
                type="button"
                onClick={handleAdmitKnock}
                style={{ flex: 1, padding: '10px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 600, cursor: 'pointer', fontSize: 14 }}
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
