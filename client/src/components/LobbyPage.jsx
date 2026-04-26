import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Video, Users, Copy, Code, Globe, Zap } from "lucide-react";
import toast, { Toaster } from "react-hot-toast";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { createRoom } from "../services/roomService";

const LobbyPage = () => {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [joinCode, setJoinCode] = useState("");
  const [joinError, setJoinError] = useState("");
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();

  const handleCreateSession = async (e) => {
    e.preventDefault();
    if (creating) return;
    setCreating(true);
    try {
      const room = await createRoom({ name: `${user?.name || "Session"}'s Room` });
      navigate(`/room/${room.joinCode}`);
    } catch (err) {
      toast.error(err?.response?.data?.error || "Failed to create session. Please try again.");
    } finally {
      setCreating(false);
    }
  };

  const handleJoinSession = (e) => {
    e.preventDefault();
    const code = joinCode.trim().toUpperCase();
    if (!code) {
      setJoinError("Session ID is required");
      return;
    }
    setJoinError("");
    navigate(`/room/${code}`);
  };

  const copyToClipboard = (text) => {
    if (!text) { toast.error("Nothing to copy"); return; }
    navigator.clipboard.writeText(text).then(() => toast.success("Copied!"));
  };

  return (
    <div style={{ minHeight: "100dvh", background: "var(--bg)" }}>
      <Toaster position="top-center" />

      {/* Header */}
      <header style={{
        background: "var(--card)",
        borderBottom: "1px solid var(--border)",
        padding: "0 20px",
        position: "sticky", top: 0, zIndex: 10,
      }}>
        <div style={{
          maxWidth: 1200, margin: "0 auto",
          display: "flex", justifyContent: "space-between", alignItems: "center", height: 60,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{
              width: 32, height: 32, background: "var(--coral)", borderRadius: 8,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <span style={{ color: "#fff", fontFamily: "Poppins", fontWeight: 800, fontSize: 14 }}>S</span>
            </div>
            <span style={{ fontFamily: "Poppins", fontWeight: 700, fontSize: 18, color: "var(--text)" }}>
              Sync<span style={{ color: "var(--purple)" }}>Codes</span>
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {user && (
              <span style={{ fontSize: 13, color: "var(--text3)", display: "none" }} className="lobby-user">
                Hi, {user.name?.split(" ")[0]}
              </span>
            )}
            <button
              onClick={toggleTheme}
              style={{
                background: "var(--input-bg)", border: "1px solid var(--border)",
                borderRadius: 8, padding: "6px 10px", cursor: "pointer", fontSize: 16, lineHeight: 1,
              }}
              aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            >
              {theme === "dark" ? "☀️" : "🌙"}
            </button>
            {user && (
              <button
                onClick={() => navigate("/dashboard")}
                className="sc-btn sc-btn-secondary"
                style={{ padding: "6px 14px", fontSize: 13 }}
              >
                Dashboard
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <div style={{ textAlign: "center", padding: "48px 20px 36px", maxWidth: 640, margin: "0 auto" }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          background: "var(--input-bg)", border: "1px solid var(--border)",
          borderRadius: 20, padding: "4px 14px", fontSize: 12, fontWeight: 600,
          color: "var(--text3)", marginBottom: 16,
        }}>
          <Zap size={12} style={{ color: "var(--coral)" }} />
          Real-time collaborative coding
        </div>
        <h1 style={{ fontSize: "clamp(26px, 5vw, 40px)", marginBottom: 12, lineHeight: 1.2 }}>
          Code together,<br />ship faster
        </h1>
        <p style={{ fontSize: 15, color: "var(--text2)", lineHeight: 1.6, maxWidth: 480, margin: "0 auto" }}>
          Start a session, invite your team, and collaborate in real-time with video, code editor, and whiteboard.
        </p>
      </div>

      {/* Main cards */}
      <div style={{ padding: "0 20px", maxWidth: 1200, margin: "0 auto 56px" }}>
        <div className="lobby-grid">

          {/* Create Session */}
          <div className="sc-card" style={{ padding: "clamp(24px, 4vw, 36px)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
              <div style={{
                width: 44, height: 44, background: "var(--coral)", borderRadius: 12,
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>
                <Code size={20} style={{ color: "#fff" }} />
              </div>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 700 }}>Create Session</h2>
                <p style={{ fontSize: 12, color: "var(--text3)", marginTop: 1 }}>Start a new room instantly</p>
              </div>
            </div>

            <div style={{ height: 1, background: "var(--border)", margin: "20px 0" }} />

            <p style={{ fontSize: 14, color: "var(--text2)", marginBottom: 24, lineHeight: 1.6 }}>
              A unique session ID is generated automatically. Share it with teammates to collaborate in real-time.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[
                { icon: "🖥️", text: "Collaborative code editor" },
                { icon: "📹", text: "Built-in video & audio" },
                { icon: "🖊️", text: "Shared whiteboard" },
              ].map((f) => (
                <div key={f.text} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "var(--text2)" }}>
                  <span style={{ fontSize: 16 }}>{f.icon}</span> {f.text}
                </div>
              ))}
            </div>

            <form onSubmit={handleCreateSession} style={{ marginTop: 28 }}>
              <button
                type="submit"
                disabled={creating}
                className="sc-btn sc-btn-primary"
                style={{ width: "100%", padding: "12px", fontSize: 15 }}
              >
                {creating ? "Creating…" : "Create New Session"}
              </button>
            </form>
          </div>

          {/* Join Session */}
          <div className="sc-card" style={{ padding: "clamp(24px, 4vw, 36px)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
              <div style={{
                width: 44, height: 44, background: "var(--purple)", borderRadius: 12,
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>
                <Users size={20} style={{ color: "#fff" }} />
              </div>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 700 }}>Join Session</h2>
                <p style={{ fontSize: 12, color: "var(--text3)", marginTop: 1 }}>Enter a room code to join</p>
              </div>
            </div>

            <div style={{ height: 1, background: "var(--border)", margin: "20px 0" }} />

            <p style={{ fontSize: 14, color: "var(--text2)", marginBottom: 24, lineHeight: 1.6 }}>
              Enter the session ID shared by the host to join their collaborative coding room.
            </p>

            <form onSubmit={handleJoinSession} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text3)", marginBottom: 8, textTransform: "uppercase", letterSpacing: ".05em" }}>
                  Session ID
                </label>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    type="text"
                    value={joinCode}
                    onChange={(e) => { setJoinCode(e.target.value); setJoinError(""); }}
                    className="sc-input"
                    placeholder="Paste your session code here…"
                    style={{ flex: 1, textTransform: "uppercase" }}
                    maxLength={32}
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    onClick={() => copyToClipboard(joinCode)}
                    className="sc-btn sc-btn-secondary"
                    style={{ padding: "0 14px", flexShrink: 0 }}
                    aria-label="Copy session code to clipboard"
                  >
                    <Copy size={16} />
                  </button>
                </div>
                {joinError && (
                  <p style={{ color: "var(--coral)", fontSize: 12, marginTop: 6 }}>{joinError}</p>
                )}
              </div>

              {/* Recent sessions shortcut */}
              <div
                className="sc-card"
                style={{
                  padding: "14px 16px", background: "var(--input-bg)",
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 18 }}>⏱</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>Recent Sessions</div>
                    <div style={{ fontSize: 11, color: "var(--text3)" }}>Quickly resume previous work</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => navigate("/sessions")}
                  style={{ background: "none", border: "none", color: "var(--coral)", fontSize: 12, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}
                >
                  View All →
                </button>
              </div>

              <button type="submit" className="sc-btn sc-btn-teal" style={{ width: "100%", padding: "12px", fontSize: 15 }}>
                Join Session
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Features */}
      <div style={{ background: "var(--bg2)", borderTop: "1px solid var(--border)", padding: "56px 20px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 40 }}>
            <h2 style={{ fontSize: "clamp(20px, 4vw, 28px)", marginBottom: 8 }}>Why SyncCodes?</h2>
            <p style={{ fontSize: 14, color: "var(--text3)" }}>Everything you need in one place</p>
          </div>
          <div className="lobby-features-grid">
            {[
              { icon: <Code size={22} />, title: "Real-time Collaboration", description: "CRDT-powered collaborative editor. See every keystroke live — no conflicts, no lag.", color: "var(--coral)" },
              { icon: <Video size={22} />, title: "Integrated Video", description: "WebRTC video calls baked right in. No third-party apps needed.", color: "var(--purple)" },
              { icon: <Globe size={22} />, title: "10+ Languages", description: "JavaScript, Python, Go, Rust, Java, C++, and more — with syntax highlighting.", color: "var(--teal)" },
            ].map((feature, i) => (
              <div key={i} className="sc-card" style={{ padding: 28 }}>
                <div style={{
                  width: 50, height: 50, background: `${feature.color}18`, borderRadius: 12,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  marginBottom: 16, color: feature.color,
                }}>
                  {feature.icon}
                </div>
                <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>{feature.title}</h3>
                <p style={{ fontSize: 13, color: "var(--text2)", lineHeight: 1.6 }}>{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ textAlign: "center", padding: "24px 20px", borderTop: "1px solid var(--border)" }}>
        <p style={{ fontSize: 12, color: "var(--text3)" }}>
          © 2025 SyncCodes · Built for developers
        </p>
      </div>
    </div>
  );
};

export default LobbyPage;
