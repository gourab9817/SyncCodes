import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Video, Users, Copy, Code, Globe } from "lucide-react";
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

  // Create a new room via REST API, then navigate into it.
  // Room.jsx handles the socket join — LobbyPage only provisions the room in DB.
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

  // Join an existing room by navigating to the room page.
  // Room.jsx emits room:join and shows an error if the code is invalid.
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
    navigator.clipboard.writeText(text).then(() => toast.success("Copied to clipboard!"));
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", padding: 24 }}>
      <Toaster />

      {/* Header */}
      <div style={{
        maxWidth: 1200, margin: "0 auto 40px",
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ color: "var(--coral)", fontSize: 24, fontWeight: 800 }}>&lt;/&gt;</div>
          <div style={{ fontFamily: "Poppins", fontWeight: 700, fontSize: 22 }}>
            Sync<span style={{ color: "var(--purple)" }}>Codes</span>
          </div>
        </div>
        <button
          onClick={toggleTheme}
          style={{
            background: "var(--input-bg)", border: "1px solid var(--border)",
            borderRadius: 8, padding: "8px 12px", cursor: "pointer", fontSize: 18,
          }}
          title={theme === "dark" ? "Switch to light" : "Switch to dark"}
        >
          {theme === "dark" ? "☀️" : "🌙"}
        </button>
      </div>

      {/* Main grid */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))",
        gap: 24, maxWidth: 1200, margin: "0 auto",
      }}>
        {/* Create Session */}
        <div className="sc-card" style={{ padding: 32 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
            <div style={{ width: 40, height: 40, background: "var(--coral)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Code className="w-5 h-5" style={{ color: "#fff" }} />
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 600 }}>Create Session</h2>
          </div>
          <p style={{ fontSize: 14, color: "var(--text2)", marginBottom: 24 }}>
            Start a new collaborative coding environment. A unique session ID is generated automatically.
          </p>
          <form onSubmit={handleCreateSession} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <button
              type="submit"
              disabled={creating}
              className="sc-btn sc-btn-primary"
              style={{ width: "100%", opacity: creating ? 0.7 : 1 }}
            >
              {creating ? "Creating…" : "Create New Session"}
            </button>
          </form>
        </div>

        {/* Join Session */}
        <div className="sc-card" style={{ padding: 32 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
            <div style={{ width: 40, height: 40, background: "var(--purple)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Users className="w-5 h-5" style={{ color: "#fff" }} />
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 600 }}>Join Session</h2>
          </div>
          <p style={{ fontSize: 14, color: "var(--text2)", marginBottom: 24 }}>
            Enter a session ID shared by the host to join their coding room.
          </p>
          <form onSubmit={handleJoinSession} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--text2)", marginBottom: 6 }}>
                Session ID
              </label>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  type="text"
                  value={joinCode}
                  onChange={(e) => { setJoinCode(e.target.value); setJoinError(""); }}
                  className="sc-input"
                  placeholder="e.g. 8A3B9K2C7M1N4P5 (16 characters)"
                  style={{ flex: 1, textTransform: "uppercase" }}
                  maxLength={32}
                />
                <button
                  type="button"
                  onClick={() => copyToClipboard(joinCode)}
                  className="sc-btn sc-btn-secondary"
                  style={{ padding: "0 12px" }}
                >
                  <Copy className="w-5 h-5" />
                </button>
              </div>
              {joinError && (
                <p style={{ color: "var(--coral)", fontSize: 12, marginTop: 4 }}>{joinError}</p>
              )}
            </div>

            <div className="sc-card" style={{ padding: 20, background: "var(--input-bg)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 20 }}>⏱</span>
                  <h3 style={{ fontSize: 14, fontWeight: 600 }}>Recent Sessions</h3>
                </div>
                <button
                  type="button"
                  onClick={() => navigate("/sessions")}
                  style={{ background: "none", border: "none", color: "var(--coral)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                >
                  View All
                </button>
              </div>
              <p style={{ fontSize: 12, color: "var(--text3)" }}>Quickly access your recent work</p>
            </div>

            <button type="submit" className="sc-btn sc-btn-primary" style={{ width: "100%" }}>
              Join Session
            </button>
          </form>
        </div>
      </div>

      {/* Features */}
      <div style={{ maxWidth: 1200, margin: "60px auto 0" }}>
        <h2 style={{ fontSize: 28, fontWeight: 700, textAlign: "center", marginBottom: 40 }}>
          Why Choose SyncCodes?
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 24 }}>
          {[
            { icon: <Code className="w-6 h-6" />, title: "Real-time Collaboration", description: "Code together in real-time with team members around the world.", color: "var(--coral)" },
            { icon: <Video className="w-6 h-6" />, title: "Integrated Video", description: "Seamless video calls built right into your coding environment.", color: "var(--purple)" },
            { icon: <Globe className="w-6 h-6" />, title: "Multiple Languages", description: "Support for all major programming languages and frameworks.", color: "var(--teal)" },
          ].map((feature, i) => (
            <div key={i} className="sc-card" style={{ padding: 24 }}>
              <div style={{ width: 48, height: 48, background: `${feature.color}20`, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16, color: feature.color }}>
                {feature.icon}
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>{feature.title}</h3>
              <p style={{ fontSize: 14, color: "var(--text2)", lineHeight: 1.5 }}>{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default LobbyPage;
