import React from 'react';
import './ShinyText.css';

/**
 * ShinyText React component
 * Props:
 * - text: string
 * - disabled: boolean (disable animation)
 * - speed: number (seconds for animation duration)
 * - className: string (additional classes)
 */
function ShinyText({ text = '', disabled = false, speed = 5, className = '' }) {
  // To color 'Code' in 'SyncCodes' with a purple gradient, split and wrap it
  let display;
  if (/SyncCodes/i.test(text)) {
    display = (
      <>
        {'< /> '}
        <span className="font-bold">Sync</span>
        <span className="font-bold shiny-gradient">Codes</span>
      </>
    );
  } else {
    display = text;
  }
  return (
    <div
      className={`shiny-text inline-block ${!disabled ? 'animate-shine' : ''} ${className}`}
      style={{
        backgroundImage:
          'linear-gradient(120deg, rgba(255,255,255,0) 40%, rgba(255,255,255,0.8) 50%, rgba(255,255,255,0) 60%)',
        backgroundSize: '200% 100%',
        WebkitBackgroundClip: 'text',
        animationDuration: `${speed}s`,
        fontSize: '3rem', // Make text bigger
        fontWeight: 700,
        color: '#fff',
      }}
    >
      {display}
    </div>
  );
}

export default ShinyText; 