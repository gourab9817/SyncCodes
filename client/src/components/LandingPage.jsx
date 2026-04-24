import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Code, Users, Zap, Clock, Globe, Lock, ChevronRight, Github, Linkedin } from 'lucide-react';
import ShinyText from './DecryptedText';
import { useTheme } from '../context/ThemeContext';

export default function LandingPage() {
  const [typedText, setTypedText] = useState('');
  const [currentTextIndex, setCurrentTextIndex] = useState(0);
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    const typingTexts = ['simple', 'powerful', 'efficient', 'seamless'];
    const text = typingTexts[currentTextIndex];
    let index = 0;
    let direction = 'typing';
    
    const typingInterval = setInterval(() => {
      if (direction === 'typing') {
        if (index < text.length) {
          setTypedText(text.substring(0, index + 1));
          index++;
        } else {
          direction = 'waiting';
          setTimeout(() => { direction = 'deleting'; }, 1500);
        }
      } else if (direction === 'deleting') {
        if (index > 0) {
          setTypedText(text.substring(0, index - 1));
          index--;
        } else {
          direction = 'typing';
          setCurrentTextIndex((currentTextIndex + 1) % typingTexts.length);
        }
      }
    }, 100);
    
    return () => clearInterval(typingInterval);
  }, [currentTextIndex]);

  const handleGetStarted = () => navigate('/login');

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>
      {/* Header */}
      <header style={{
        background: 'var(--card)',
        borderBottom: '1px solid var(--border)',
        position: 'sticky',
        top: 0,
        zIndex: 50,
        backdropFilter: 'blur(10px)',
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ color: 'var(--coral)', fontSize: 20, fontWeight: 800 }}>&lt;/&gt;</div>
            <div style={{ fontFamily: 'Poppins', fontWeight: 700, fontSize: 20 }}>
              Sync<span style={{ color: 'var(--purple)' }}>Codes</span>
            </div>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <a href="https://github.com/gourab9817" target="_blank" rel="noopener noreferrer"
              style={{ color: 'var(--text2)', transition: 'color .2s' }}
              onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text)'}
              onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text2)'}
            >
              <Github className="w-5 h-5" />
            </a>
            
            <a href="https://linkedin.com/in/gourabchoudhury" target="_blank" rel="noopener noreferrer"
              style={{ color: 'var(--text2)', transition: 'color .2s' }}
              onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text)'}
              onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text2)'}
            >
              <Linkedin className="w-5 h-5" />
            </a>

            <button
              onClick={toggleTheme}
              style={{
                background: 'var(--input-bg)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: '6px 10px',
                cursor: 'pointer',
                fontSize: 16,
              }}
              title={theme === 'dark' ? 'Switch to light' : 'Switch to dark'}
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
            
            <button
              className="sc-btn sc-btn-primary"
              onClick={handleGetStarted}
              style={{ padding: '8px 20px' }}
            >
              Get Started
              <ChevronRight className="w-4 h-4 ml-1" style={{ display: 'inline' }} />
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section style={{ padding: '80px 24px', textAlign: 'center', position: 'relative' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <h1 style={{ fontSize: 56, fontWeight: 800, marginBottom: 16, lineHeight: 1.2 }}>
            Real-time code collaboration<br />
            made <span style={{ color: 'var(--purple)' }}>{typedText}</span>
            <span style={{ animation: 'blink 1s infinite' }}>|</span>
          </h1>
          
          <p style={{ fontSize: 20, color: 'var(--text2)', maxWidth: 700, margin: '0 auto 32px' }}>
            Share your code instantly, collaborate with anyone, anywhere. No sign up required – just create a session and share the link.
          </p>

          <button
            className="sc-btn sc-btn-primary"
            onClick={handleGetStarted}
            style={{ padding: '12px 32px', fontSize: 16 }}
          >
            Get Started
            <ChevronRight className="w-5 h-5 ml-2" style={{ display: 'inline' }} />
          </button>

          {/* Code Preview */}
          <div style={{
            maxWidth: 900,
            margin: '60px auto 0',
            background: '#1a1a2e',
            borderRadius: 12,
            overflow: 'hidden',
            boxShadow: 'var(--shadow-xl)',
          }}>
            <div style={{ background: '#0f0f1e', padding: '12px 16px', display: 'flex', gap: 8 }}>
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#ff5f56' }} />
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#ffbd2e' }} />
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#27c93f' }} />
            </div>
            <pre style={{
              padding: 24,
              textAlign: 'left',
              fontSize: 14,
              fontFamily: 'JetBrains Mono, monospace',
              color: '#e2e8f0',
              overflowX: 'auto',
            }}>
              <code>
                <span style={{ color: '#c792ea' }}>import</span> <span style={{ color: '#89ddff' }}>React</span>, {`{ `}<span style={{ color: '#82aaff' }}>useEffect</span>, <span style={{ color: '#82aaff' }}>useState</span>{` }`} <span style={{ color: '#c792ea' }}>from</span> <span style={{ color: '#c3e88d' }}>'react'</span>;{`\n\n`}
                <span style={{ color: '#c792ea' }}>function</span> <span style={{ color: '#82aaff' }}>CodeEditor</span>() {`{`}{`\n`}
                {'  '}<span style={{ color: '#c792ea' }}>const</span> [<span style={{ color: '#e2e8f0' }}>code</span>, <span style={{ color: '#82aaff' }}>setCode</span>] = <span style={{ color: '#82aaff' }}>useState</span>(<span style={{ color: '#c3e88d' }}>''</span>);{`\n`}
                {'  '}<span style={{ color: '#c792ea' }}>const</span> [<span style={{ color: '#e2e8f0' }}>connected</span>, <span style={{ color: '#82aaff' }}>setConnected</span>] = <span style={{ color: '#82aaff' }}>useState</span>(<span style={{ color: '#ff5370' }}>false</span>);{`\n\n`}
                {'  '}<span style={{ color: '#82aaff' }}>useEffect</span>(() ={'>'} {`{`}{`\n`}
                {'    '}<span style={{ color: '#546e7a' }}>{`/* WebRTC connection established */`}</span>{`\n`}
                {'    '}<span style={{ color: '#82aaff' }}>setConnected</span>(<span style={{ color: '#ff5370' }}>true</span>);{`\n`}
                {'  '}{`}`}, []);{`\n\n`}
                {'  '}<span style={{ color: '#c792ea' }}>return</span> {'<'}<span style={{ color: '#89ddff' }}>div</span> <span style={{ color: '#c792ea' }}>className</span>=<span style={{ color: '#c3e88d' }}>"editor"</span>{'> ... </div>;'}{`\n`}
                {`}`}
              </code>
            </pre>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section style={{ padding: '80px 24px', background: 'var(--bg2)' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <h2 style={{ fontSize: 36, fontWeight: 700, textAlign: 'center', marginBottom: 48 }}>
            Everything You Need for Code Collaboration
          </h2>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24 }}>
            {[
              { icon: <Users className="w-6 h-6" style={{ color: 'var(--coral)' }} />, title: "Real-Time Collaboration", description: "Code simultaneously with your team members, see changes instantly as they happen." },
              { icon: <Zap className="w-6 h-6" style={{ color: 'var(--teal)' }} />, title: "WebRTC Powered", description: "Direct peer-to-peer connections for the fastest possible collaboration experience." },
              { icon: <Clock className="w-6 h-6" style={{ color: 'var(--purple)' }} />, title: "No Sign-up Required", description: "Get started instantly - create a session and share the link to begin coding together." },
              { icon: <Code className="w-6 h-6" style={{ color: 'var(--coral)' }} />, title: "Multiple Language Support", description: "Syntax highlighting for all popular programming languages and frameworks." },
              { icon: <Globe className="w-6 h-6" style={{ color: 'var(--teal)' }} />, title: "Cross-Platform", description: "Works on any device with a modern browser - no installation needed." },
              { icon: <Lock className="w-6 h-6" style={{ color: 'var(--purple)' }} />, title: "Secure Connection", description: "End-to-end encryption ensures your code stays between you and your collaborators." },
            ].map((feature, index) => (
              <div key={index} className="sc-card" style={{ padding: 28, transition: 'transform .2s' }}
                onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-4px)'}
                onMouseLeave={(e) => e.currentTarget.style.transform = 'none'}
              >
                <div style={{ marginBottom: 16 }}>
                  {feature.icon}
                </div>
                <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>
                  {feature.title}
                </h3>
                <p style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.6 }}>
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section style={{ padding: '80px 24px', background: 'var(--bg)' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontSize: 36, fontWeight: 700, marginBottom: 16 }}>
            How It Works
          </h2>
          <p style={{ fontSize: 18, color: 'var(--text2)', marginBottom: 60, maxWidth: 700, margin: '0 auto 60px' }}>
            Get started in seconds with our simple three-step process
          </p>
          
          <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 32, flexWrap: 'wrap' }}>
            {[
              { number: "01", title: "Create a Session", description: "Click the \"Get Started\" button to instantly create a new collaborative coding session." },
              { number: "02", title: "Share the Link", description: "Copy the generated URL and share it with anyone you want to collaborate with." },
              { number: "03", title: "Start Coding Together", description: "Begin writing code in real-time. Everyone can see changes as they happen." },
            ].map((step, index) => (
              <React.Fragment key={index}>
                <div style={{ flex: '1 1 200px', maxWidth: 280 }}>
                  <div style={{
                    width: 64,
                    height: 64,
                    borderRadius: '50%',
                    background: `${index === 0 ? 'var(--coral)' : index === 1 ? 'var(--teal)' : 'var(--purple)'}20`,
                    color: index === 0 ? 'var(--coral)' : index === 1 ? 'var(--teal)' : 'var(--purple)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 24,
                    fontWeight: 700,
                    margin: '0 auto 20px',
                  }}>
                    {step.number}
                  </div>
                  <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>
                    {step.title}
                  </h3>
                  <p style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.5 }}>
                    {step.description}
                  </p>
                </div>
                
                {index < 2 && (
                  <div style={{ display: index < 2 ? 'block' : 'none', color: 'var(--border)' }}>
                    <ChevronRight className="w-8 h-8" />
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{
        background: 'var(--bg2)',
        borderTop: '1px solid var(--border)',
        padding: '60px 24px',
      }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 40, marginBottom: 40 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <div style={{ color: 'var(--coral)', fontSize: 20, fontWeight: 800 }}>&lt;/&gt;</div>
                <div style={{ fontFamily: 'Poppins', fontWeight: 700, fontSize: 18 }}>
                  Sync<span style={{ color: 'var(--purple)' }}>Codes</span>
                </div>
              </div>
              <p style={{ fontSize: 14, color: 'var(--text3)', marginBottom: 20 }}>
                Real-time code collaboration platform powered by WebRTC technology.
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gridColumn: 'span 3' }}>
              <ShinyText text="< /> SyncCodes" speed={3} className="text-5xl" />
            </div>
          </div>

          <div style={{
            borderTop: '1px solid var(--border)',
            paddingTop: 24,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 16,
          }}>
            <p style={{ fontSize: 13, color: 'var(--text3)' }}>
              © 2026 SyncCodes. All rights reserved.
            </p>
            <div style={{ display: 'flex', gap: 24 }}>
              <button style={{ background: 'none', border: 'none', color: 'var(--text2)', fontSize: 13, cursor: 'pointer' }}>
                Terms
              </button>
              <button style={{ background: 'none', border: 'none', color: 'var(--text2)', fontSize: 13, cursor: 'pointer' }}>
                Privacy
              </button>
              <button style={{ background: 'none', border: 'none', color: 'var(--text2)', fontSize: 13, cursor: 'pointer' }}>
                Cookies
              </button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
