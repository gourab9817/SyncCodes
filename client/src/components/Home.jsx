import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Moon, Sun, Code, Users, Zap, Clock, Globe, Lock, ChevronRight, Play, Video, Github, Linkedin } from 'lucide-react';
import DecryptedText from './DecryptedText'; // Added import for DecryptedText
import ShinyText from './DecryptedText';

export default function LandingPage() {
  const [darkMode, setDarkMode] = useState(true);
  const [typedText, setTypedText] = useState('');
  const [currentTextIndex, setCurrentTextIndex] = useState(0);
  const [isVisible, setIsVisible] = useState({});
  const navigate = useNavigate();

  const typingTexts = [
    'simple',
    'powerful',
    'efficient',
    'seamless'
  ];

  // Typing effect for hero text
  useEffect(() => {
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
          setTimeout(() => {
            direction = 'deleting';
          }, 1500);
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

  // Intersection Observer for scroll animations
  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          setIsVisible(prev => ({...prev, [entry.target.id]: true}));
        }
      });
    }, { threshold: 0.1 });
    
    const sections = document.querySelectorAll('.animate-on-scroll');
    sections.forEach(section => observer.observe(section));
    
    return () => sections.forEach(section => observer.unobserve(section));
  }, []);
  
  const handleGetStarted = () => {
    navigate('/lobby');
  };

  // Gradient animation for buttons
  const buttonGradientStyle = {
    backgroundSize: '200% 200%',
    backgroundImage: 'linear-gradient(45deg, #4f46e5, #6366f1, #818cf8, #4f46e5)',
    animation: 'gradient-animation 4s ease infinite',
  };

  const codeExample = `import React, { useEffect, useState } from 'react';

function CodeEditor() {
  const [code, setCode] = useState('');
  const [connected, setConnected] = useState(false);
  
  useEffect(() => {
    // WebRTC connection established
    setConnected(true);
  }, []);

  return (
    <div className="editor-container">
      {/* Editor implementation */}
    </div>
  );
}`;

  return (
    <div className={`${darkMode ? "bg-gray-900 text-white" : "bg-gray-50 text-gray-800"} min-h-screen transition-colors duration-300`}>
      {/* Background particles */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute inset-0">
          {[...Array(20)].map((_, i) => (
            <div 
              key={i}
              className={`absolute rounded-full ${darkMode ? 'bg-indigo-500' : 'bg-indigo-300'} opacity-10`}
              style={{
                width: `${Math.random() * 8 + 2}px`,
                height: `${Math.random() * 8 + 2}px`,
                top: `${Math.random() * 100}%`,
                left: `${Math.random() * 100}%`,
                animation: `float ${Math.random() * 10 + 15}s linear infinite`,
                animationDelay: `${Math.random() * 10}s`
              }}
            />
          ))}
        </div>
      </div>
      
      {/* Header */}
      <header className={`${darkMode ? "border-gray-800 bg-gray-900" : "border-gray-200 bg-white"} border-b sticky top-0 z-50 bg-opacity-90 backdrop-filter backdrop-blur-lg transition-colors duration-300`}>
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center group">
            <div className="text-blue-500 mr-2 text-xl group-hover:rotate-180 transition-transform duration-700">&lt;/&gt;</div>
            <div className={`font-bold text-xl ${darkMode ? "text-white" : "text-gray-800"} group-hover:text-indigo-500 transition-colors duration-300`}>
              Sync<span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 to-purple-600">Codes</span>
            </div>
          </div>
          <nav className="hidden md:flex space-x-8">
            {/* <a href="#" className={`${darkMode ? "text-gray-300 hover:text-white" : "text-gray-600 hover:text-gray-900"} transition duration-200 relative after:absolute after:w-0 after:h-0.5 after:bg-indigo-500 after:left-0 after:-bottom-1 after:transition-all hover:after:w-full`}>Home</a>
            <a href="#" className={`${darkMode ? "text-gray-300 hover:text-white" : "text-gray-600 hover:text-gray-900"} transition duration-200 relative after:absolute after:w-0 after:h-0.5 after:bg-indigo-500 after:left-0 after:-bottom-1 after:transition-all hover:after:w-full`}>Features</a>
            <a href="#" className={`${darkMode ? "text-gray-300 hover:text-white" : "text-gray-600 hover:text-gray-900"} transition duration-200 relative after:absolute after:w-0 after:h-0.5 after:bg-indigo-500 after:left-0 after:-bottom-1 after:transition-all hover:after:w-full`}>Pricing</a>
            <a href="#" className={`${darkMode ? "text-gray-300 hover:text-white" : "text-gray-600 hover:text-gray-900"} transition duration-200 relative after:absolute after:w-0 after:h-0.5 after:bg-indigo-500 after:left-0 after:-bottom-1 after:transition-all hover:after:w-full`}>About</a> */}
          </nav>
          <div className="flex items-center space-x-4">
            <button 
              onClick={() => setDarkMode(!darkMode)} 
              className={`p-2 rounded-full ${darkMode ? "hover:bg-gray-800" : "hover:bg-gray-200"} transition-all duration-500 hover:rotate-12`}
              aria-label="Toggle theme"
            >
              {darkMode ? (
                <Sun className="w-5 h-5 text-yellow-400" />
              ) : (
                <Moon className="w-5 h-5 text-indigo-600" />
              )}
            </button>
            
            <div className="flex items-center space-x-4">
              {/* GitHub Link */}
              <a 
                href="https://github.com/gourab9817" 
                target="_blank" 
                rel="noopener noreferrer"
                className="p-2 rounded-full text-gray-300 hover:text-white transition-all duration-300 hover:scale-110 hover:rotate-6"
                aria-label="GitHub"
              >
                <Github className="w-5 h-5" />
              </a>
              
              {/* LinkedIn Link */}
              <a 
                href="https://linkedin.com/in/gourabchoudhury" 
                target="_blank" 
                rel="noopener noreferrer"
                className="p-2 rounded-full text-gray-300 hover:text-white transition-all duration-300 hover:scale-110 hover:-rotate-6"
                aria-label="LinkedIn"
              >
                <Linkedin className="w-5 h-5" />
              </a>
            </div>

            <button 
              className="relative overflow-hidden group py-2 px-4 rounded-md transition-all duration-300 shadow-lg hover:shadow-indigo-500/30"
              onClick={handleGetStarted}
              style={buttonGradientStyle}
            >
              <span className="relative z-10 font-medium flex items-center text-white group-hover:scale-105 transition-transform duration-300">
                Get Started
                <ChevronRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform duration-300" />
              </span>
            </button>
          </div>
        </div>
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
      </header>

      {/* Hero Section */}
      <section className="py-16 md:py-24 relative overflow-hidden">
        {/* Abstract shapes in background */}
        <div className="absolute inset-0 overflow-hidden opacity-5 pointer-events-none">
          <div className={`absolute -right-10 -top-10 w-64 h-64 rounded-full ${darkMode ? 'bg-indigo-600' : 'bg-indigo-400'}`}></div>
          <div className={`absolute left-1/4 top-1/3 w-32 h-32 rounded-full ${darkMode ? 'bg-purple-600' : 'bg-purple-400'}`}></div>
          <div className={`absolute bottom-10 left-10 w-48 h-48 rounded-full ${darkMode ? 'bg-blue-600' : 'bg-blue-400'}`}></div>
        </div>

        <div className="container mx-auto px-4 text-center relative z-10">
          <h1 className="text-4xl md:text-6xl font-bold mb-4 animate-on-scroll" id="hero-title">
            Real-time code collaboration<br />
            made <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 to-purple-600 inline-block min-w-20">{typedText}</span>
            <span className="animate-blink">|</span>
          </h1>
          
          <p className={`text-xl ${darkMode ? "text-gray-400" : "text-gray-600"} max-w-3xl mx-auto mb-10 animate-fadeIn`}>
            Share your code instantly, collaborate with anyone, anywhere. No sign up required – just create a session and share the link.
          </p>
          <div className="flex flex-wrap justify-center gap-4 mb-16 animate-fadeInUp">
            <button 
              onClick={handleGetStarted}
              className="relative overflow-hidden group bg-indigo-600 hover:bg-indigo-700 text-white py-3 px-6 rounded-md transition-all duration-500 shadow-lg hover:shadow-indigo-500/50 transform hover:-translate-y-1"
            >
              <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-indigo-500 to-purple-600 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></span>
              <span className="relative z-10 flex items-center font-medium">
                <span className="mr-2">Get Started</span>
                <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform duration-300" />
              </span>
              <span className="absolute -bottom-1 left-0 w-full h-1 bg-white opacity-20 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left"></span>
            </button>
          </div>

          {/* Code Editor Preview with animation */}
          <div className="max-w-4xl mx-auto rounded-lg overflow-hidden shadow-2xl mb-20 transform transition-all hover:scale-105 duration-500 group">
            <div className="bg-gray-800 text-white p-3 flex items-center justify-between">
              <div className="flex space-x-2">
                <div className="w-3 h-3 rounded-full bg-red-500 group-hover:animate-pulse"></div>
                <div className="w-3 h-3 rounded-full bg-yellow-500 group-hover:animate-pulse animation-delay-200"></div>
                <div className="w-3 h-3 rounded-full bg-green-500 group-hover:animate-pulse animation-delay-400"></div>
              </div>
              <span className="text-gray-400 text-sm group-hover:text-white transition-colors duration-300">Collaborative Session </span>
              <div></div>
            </div>
            <div className="bg-gray-950 p-6 overflow-x-auto text-left relative">
              {/* Cursor animation */}
              <div className="absolute top-20 left-12 w-2 h-5 bg-blue-500 opacity-60 animate-blink hidden group-hover:block"></div>
              <pre className="text-sm font-mono relative z-10">
                <code>
                  <span className="text-purple-400">import</span> <span className="text-white">React, </span>
                  {`{ `}<span className="text-yellow-400">useEffect</span>, <span className="text-yellow-400">useState</span>{` }`} <span className="text-purple-400">from</span> <span className="text-green-400">'react'</span>;{'\n\n'}
                  <span className="text-purple-400">function</span> <span className="text-blue-400">CodeEditor</span>() {`{`}{'\n'}
                  {'  '}<span className="text-purple-400">const</span> [<span className="text-white">code</span>, <span className="text-yellow-400">setCode</span>] = <span className="text-blue-400">useState</span>(<span className="text-green-400">''</span>);{'\n'}
                  {'  '}<span className="text-purple-400">const</span> [<span className="text-white">connected</span>, <span className="text-yellow-400">setConnected</span>] = <span className="text-blue-400">useState</span>(<span className="text-red-400">false</span>);{'\n\n'}
                  {'  '}<span className="text-blue-400">useEffect</span>(() ={'>'} {`{`}{'\n'}
                  {'    '}<span className="text-gray-500">// WebRTC connection established</span>{'\n'}
                  {'    '}<span className="text-yellow-400">setConnected</span>(<span className="text-red-400">true</span>);{'\n'}
                  {'  '}{`}`}, []);{'\n\n'}
                  {'  '}<span className="text-purple-400">return</span> ({'\n'}
                  {'    '}<span className="text-gray-400">&lt;</span><span className="text-blue-400">div</span> <span className="text-yellow-400">className</span>=<span className="text-green-400">"editor-container"</span><span className="text-gray-400">&gt;</span>{'\n'}
                  {'      '}<span className="text-gray-500">&#123;/* Editor implementation */&#125;</span>{'\n'}
                  {'    '}<span className="text-gray-400">&lt;/</span><span className="text-blue-400">div</span><span className="text-gray-400">&gt;</span>{'\n'}
                  {'  '});{'\n'}
                  {`}`}
                </code>
              </pre>
              {/* Code highlighting effect */}
              <div className="absolute bottom-0 left-0 right-0 h-1/3 bg-gradient-to-t from-indigo-500/10 to-transparent pointer-events-none"></div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className={`py-16 ${darkMode ? "bg-gray-950" : "bg-gray-100"} transition-colors duration-300 relative overflow-hidden animate-on-scroll`} id="features-section">
        {/* Background grid pattern */}
        <div className="absolute inset-0 grid grid-cols-10 grid-rows-6 pointer-events-none">
          {[...Array(60)].map((_, i) => (
            <div 
              key={i}
              className={`border-b border-r ${darkMode ? 'border-gray-800/30' : 'border-gray-300/30'}`}
            />
          ))}
        </div>

        <div className="container mx-auto px-4 relative z-10">
          <h2 className={`text-3xl font-bold text-center mb-6 ${darkMode ? "text-white" : "text-gray-800"} animate-on-scroll`} id="features-title">
            <span className="relative inline-block">
              Everything You Need
              <span className="absolute -bottom-2 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 to-purple-600"></span>
            </span> for Code Collaboration
          </h2>
          <p className={`text-xl ${darkMode ? "text-gray-400" : "text-gray-600"} max-w-3xl mx-auto text-center mb-16`}>
            Our platform provides all the essential tools for seamless real-time code sharing and collaboration.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Feature Cards */}
            {[
              {
                icon: <Users className="w-6 h-6 text-indigo-500 group-hover:scale-110 transition-transform duration-300" />,
                title: "Real-Time Collaboration",
                description: "Code simultaneously with your team members, see changes instantly as they happen."
              },
              {
                icon: <Zap className="w-6 h-6 text-indigo-500 group-hover:scale-110 transition-transform duration-300" />,
                title: "WebRTC Powered",
                description: "Direct peer-to-peer connections for the fastest possible collaboration experience."
              },
              {
                icon: <Clock className="w-6 h-6 text-indigo-500 group-hover:scale-110 transition-transform duration-300" />,
                title: "No Sign-up Required",
                description: "Get started instantly - create a session and share the link to begin coding together."
              },
              {
                icon: <Code className="w-6 h-6 text-indigo-500 group-hover:scale-110 transition-transform duration-300" />,
                title: "Multiple Language Support",
                description: "Syntax highlighting for all popular programming languages and frameworks."
              },
              {
                icon: <Globe className="w-6 h-6 text-indigo-500 group-hover:scale-110 transition-transform duration-300" />,
                title: "Cross-Platform",
                description: "Works on any device with a modern browser - no installation needed."
              },
              {
                icon: <Lock className="w-6 h-6 text-indigo-500 group-hover:scale-110 transition-transform duration-300" />,
                title: "Secure Connection",
                description: "End-to-end encryption ensures your code stays between you and your collaborators."
              }
            ].map((feature, index) => (
              <div 
                key={index}
                className={`${darkMode ? "bg-gray-800 bg-opacity-50" : "bg-white"} p-6 rounded-lg hover:transform hover:-translate-y-2 hover:shadow-xl transition-all duration-500 group relative overflow-hidden shadow-lg`}
              >
                <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <div className="bg-indigo-500 bg-opacity-20 w-12 h-12 rounded-lg flex items-center justify-center mb-4 group-hover:rotate-6 transition-transform duration-500">
                  {feature.icon}
                </div>
                <h3 className={`text-xl font-semibold mb-2 ${darkMode ? "text-white" : "text-gray-800"} group-hover:text-indigo-500 transition-colors duration-300`}>
                  {feature.title}
                </h3>
                <p className={`${darkMode ? "text-gray-400" : "text-gray-600"} relative z-10`}>
                  {feature.description}
                </p>
                <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-purple-600 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left"></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className={`py-16 ${darkMode ? "" : "bg-white"} transition-colors duration-300 animate-on-scroll relative`} id="how-it-works">
        <div className="container mx-auto px-4 relative z-10">
          <h2 className={`text-3xl font-bold text-center mb-6 ${darkMode ? "text-white" : "text-gray-800"}`}>
            <span className="relative inline-block">
              How It Works
              <span className="absolute -bottom-2 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 to-purple-600"></span>
            </span>
          </h2>
          <p className={`text-xl ${darkMode ? "text-gray-400" : "text-gray-600"} max-w-3xl mx-auto text-center mb-16`}>
            Get started in seconds with our simple three-step process
          </p>
          
          <div className="flex flex-col md:flex-row justify-between items-center gap-8 mb-20">
            {/* Steps */}
            {[
              {
                number: "01",
                title: "Create a Session",
                description: "Click the \"Get Started\" button to instantly create a new collaborative coding session."
              },
              {
                number: "02",
                title: "Share the Link",
                description: "Copy the generated URL and share it with anyone you want to collaborate with."
              },
              {
                number: "03",
                title: "Start Coding Together",
                description: "Begin writing code in real-time. Everyone can see changes as they happen."
              }
            ].map((step, index) => (
              <React.Fragment key={index}>
                <div className="md:w-1/3 text-center group hover:transform hover:scale-105 transition-transform duration-500">
                  <div className={`relative inline-flex items-center justify-center w-16 h-16 rounded-full ${darkMode ? "bg-indigo-500 bg-opacity-20 text-indigo-500" : "bg-indigo-100 text-indigo-600"} text-2xl font-bold mb-6 overflow-hidden`}>
                    <span className="relative z-10 group-hover:scale-110 transition-transform duration-300">{step.number}</span>
                    <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-purple-600 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                  </div>
                  <h3 className={`text-xl font-semibold mb-3 ${darkMode ? "text-white" : "text-gray-800"} group-hover:text-indigo-500 transition-colors duration-300`}>
                    {step.title}
                  </h3>
                  <p className={`${darkMode ? "text-gray-400" : "text-gray-600"}`}>
                    {step.description}
                  </p>
                </div>
                
                {index < 2 && (
                  <div className={`hidden md:block ${darkMode ? "text-indigo-500" : "text-indigo-400"} group-hover:translate-x-2 transition-transform duration-300`}>
                    <ChevronRight className="w-8 h-8 animate-pulse" />
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      {/* <section className={`py-16 ${darkMode ? "bg-gray-950" : "bg-gray-100"} transition-colors duration-300 animate-on-scroll`} id="stats-section">
        <div className="container mx-auto px-4 text-center">
          <h2 className={`text-3xl font-bold mb-16 ${darkMode ? "text-white" : "text-gray-800"}`}>
            <span className="relative inline-block">
              Ready to collaborate in real-time?
              <span className="absolute -bottom-2 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 to-purple-600"></span>
            </span>
          </h2>
          
          <div className="flex flex-col md:flex-row justify-center gap-8 mb-16">
            {[
              { number: "10K+", label: "Active Users" },
              { number: "50K+", label: "Code Sessions" },
              { number: "3K+", label: "Daily Meetings" }
            ].map((stat, index) => (
              <div 
                key={index}
                className={`${darkMode ? "bg-gray-800 bg-opacity-30" : "bg-white shadow-md"} rounded-lg p-6 md:w-1/4 transition-all hover:transform hover:scale-105 duration-500 group relative overflow-hidden`}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <div className="relative z-10">
                  <div className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-purple-600 mb-2 group-hover:scale-110 transition-transform duration-300">
                    {stat.number}
                  </div>
                  <div className={`${darkMode ? "text-gray-400" : "text-gray-600"}`}>
                    {stat.label}
                  </div>
                </div>
                <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-purple-600 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left"></div>
              </div>
            ))}
          </div>
          
          <div className="flex flex-wrap justify-center gap-4">
            <button 
              onClick={handleGetStarted}
              className="bg-indigo-600 hover:bg-indigo-700 text-white py-3 px-8 rounded-md transition-all duration-500 shadow-lg relative overflow-hidden group"
            >
              <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-indigo-500 to-purple-600 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></span>
              <span className="absolute inset-0 w-full h-full flex items-center justify-center">
                <span className="absolute w-8 h-8 bg-white/20 rounded-full animate-ripple"></span>
                <span className="absolute w-8 h-8 bg-white/20 rounded-full animate-ripple animation-delay-500"></span>
              </span>
              <span className="relative z-10 font-medium flex items-center group-hover:scale-105 transition-transform duration-300">
                <Code className="w-5 h-5 mr-2 group-hover:rotate-12 transition-transform duration-300" />
                Start Coding Now
              </span>
              <span className="absolute -bottom-1 left-0 w-full h-1 bg-white opacity-20 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left"></span>
            </button>
          </div>
        </div>
      </section> */}

      {/* Footer */}
      <footer className={`${darkMode ? "bg-gray-900 border-gray-800" : "bg-gray-50 border-gray-200"} py-16 border-t transition-colors duration-300`}>
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
            {/* Logo & Social */}
            <div>
              <div className="flex items-center mb-6 group">
                <div className="text-blue-500 mr-2 text-xl group-hover:rotate-180 transition-transform duration-700">&lt;/&gt;</div>
                <div className={`font-bold text-xl ${darkMode ? "text-white" : "text-gray-800"}`}>
                  Sync<span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 to-purple-600">Codes</span>
                </div>
              </div>
              <p className={`${darkMode ? "text-gray-400" : "text-gray-600"} mb-6`}>
                Real-time code collaboration platform powered by WebRTC technology.
              </p>
              <div className="flex space-x-4">
                <a 
                  href="#" 
                  className={`${darkMode ? "text-gray-400 hover:text-white" : "text-gray-500 hover:text-gray-900"} transition-all duration-300 hover:scale-110`}
                >
                  {/* GitHub Icon */}
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 0C5.371 0 0 5.372 0 12c0 5.303 3.438 9.799 8.207 11.387.599.111.793-.261.793-.577v-2.234C5.342 20.294 4.668 18.06 4.668 18.06c-.546-1.387-1.332-1.756-1.332-1.756-1.088-.744.084-.729.084-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.836 2.807 1.305 3.493.997.107-.775.417-1.305.761-1.605-2.665-.305-5.466-1.333-5.466-5.93 0-1.309.468-2.382 1.237-3.221-.124-.305-.536-1.528.118-3.179 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.292-1.552 3.298-1.23 3.298-1.23.654 1.651.242 2.874.118 3.179.77.839 1.237 1.911 1.237 3.221 0 4.607-2.805 5.623-5.478 5.921.43.371.82 1.102.82 2.221v3.293c0 .319.192.69.799.575C20.565 21.795 24 17.298 24 12c0-6.628-5.373-12-12-12z"></path>
                  </svg>
                </a>
                <a 
                  href="#" 
                  className={`${darkMode ? "text-gray-400 hover:text-white" : "text-gray-500 hover:text-gray-900"} transition-all duration-300 hover:scale-110`}
                >
                  {/* Twitter Icon */}
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M23.954 4.569c-.885.392-1.83.656-2.825.775 1.014-.608 1.793-1.573 2.163-2.723-.95.563-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-2.72 0-4.92 2.201-4.92 4.917 0 .39.046.765.127 1.124-4.087-.205-7.715-2.164-10.148-5.144-.424.728-.666 1.577-.666 2.476 0 1.71.87 3.214 2.188 4.096-.807-.026-1.566-.248-2.228-.616v.062c0 2.385 1.694 4.374 3.946 4.827-.413.111-.849.171-1.296.171-.314 0-.624-.03-.927-.086.631 1.953 2.445 3.377 4.6 3.417-1.685 1.319-3.809 2.105-6.102 2.105-.396 0-.788-.023-1.175-.067 2.179 1.397 4.768 2.212 7.557 2.212 9.054 0 14-7.497 14-13.986 0-.209-.005-.42-.014-.63.962-.695 1.8-1.56 2.46-2.548l-.047-.02z"></path>
                  </svg>
                </a>
              </div>
            </div>

            {/* Dynamic ShinyText Logo Section (replaces Product/Resources/Company) */}
            <div className="col-span-3 flex items-center justify-center">
              <ShinyText
                text="< /> SyncCodes"
                speed={3}
                className="text-6xl md:text-7xl"
              />
            </div>
          </div>

          <div className={`border-t ${darkMode ? "border-gray-800" : "border-gray-200"} mt-12 pt-8 flex flex-col md:flex-row justify-between items-center`}>
            <p className={`${darkMode ? "text-gray-500" : "text-gray-600"}`}>
              © 2025 SyncCodes. All rights reserved.
            </p>
            <div className="flex space-x-6 mt-4 md:mt-0">
              <a 
                href="#" 
                className={`${darkMode ? "text-gray-400 hover:text-white" : "text-gray-600 hover:text-gray-900"} transition-all duration-300 hover:scale-110`}
              >
                Terms
              </a>
              <a 
                href="#" 
                className={`${darkMode ? "text-gray-400 hover:text-white" : "text-gray-600 hover:text-gray-900"} transition-all duration-300 hover:scale-110`}
              >
                Privacy
              </a>
              <a 
                href="#" 
                className={`${darkMode ? "text-gray-400 hover:text-white" : "text-gray-600 hover:text-gray-900"} transition-all duration-300 hover:scale-110`}
              >
                Cookies
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
