import React, { useState, useRef, useEffect } from 'react';

/**
 * DecryptedText React component
 * Props:
 * - text: string
 * - speed: number (ms per frame)
 * - maxIterations: number (for non-sequential mode)
 * - sequential: boolean (reveal one by one)
 * - revealDirection: 'start' | 'end' | 'center'
 * - useOriginalCharsOnly: boolean
 * - characters: string (pool for random chars)
 * - className: string (applied to revealed chars)
 * - encryptedClassName: string (applied to unrevealed chars)
 * - parentClassName: string (applied to outer span)
 * - animateOn: 'hover' | 'view'
 */
const defaultCharacters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz!@#$%^&*()_+';

function DecryptedText({
  text = '',
  speed = 50,
  maxIterations = 10,
  sequential = false,
  revealDirection = 'start',
  useOriginalCharsOnly = false,
  characters = defaultCharacters,
  className = '',
  encryptedClassName = '',
  parentClassName = '',
  animateOn = 'hover',
}) {
  const [displayText, setDisplayText] = useState(text);
  const [isHovering, setIsHovering] = useState(false);
  const [isScrambling, setIsScrambling] = useState(false);
  const [revealedIndices, setRevealedIndices] = useState(new Set());
  const [hasAnimated, setHasAnimated] = useState(false);
  const containerRef = useRef(null);
  const intervalRef = useRef(null);
  const observerRef = useRef(null);

  // Helper to get next index to reveal
  const getNextIndex = (revealedSet) => {
    const textLength = text.length;
    switch (revealDirection) {
      case 'start':
        return revealedSet.size;
      case 'end':
        return textLength - 1 - revealedSet.size;
      case 'center': {
        const middle = Math.floor(textLength / 2);
        const offset = Math.floor(revealedSet.size / 2);
        const nextIndex = revealedSet.size % 2 === 0 ? middle + offset : middle - offset - 1;
        if (nextIndex >= 0 && nextIndex < textLength && !revealedSet.has(nextIndex)) {
          return nextIndex;
        }
        for (let i = 0; i < textLength; i++) {
          if (!revealedSet.has(i)) return i;
        }
        return 0;
      }
      default:
        return revealedSet.size;
    }
  };

  // Helper to shuffle text
  const shuffleText = (originalText, currentRevealed) => {
    if (useOriginalCharsOnly) {
      const positions = originalText.split('').map((char, i) => ({
        char,
        isSpace: char === ' ',
        index: i,
        isRevealed: currentRevealed.has(i),
      }));
      const nonSpaceChars = positions.filter(p => !p.isSpace && !p.isRevealed).map(p => p.char);
      for (let i = nonSpaceChars.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [nonSpaceChars[i], nonSpaceChars[j]] = [nonSpaceChars[j], nonSpaceChars[i]];
      }
      let charIndex = 0;
      return positions.map(p => {
        if (p.isSpace) return ' ';
        if (p.isRevealed) return originalText[p.index];
        return nonSpaceChars[charIndex++];
      }).join('');
    } else {
      const availableChars = characters.split('');
      return originalText.split('').map((char, i) => {
        if (char === ' ') return ' ';
        if (currentRevealed.has(i)) return originalText[i];
        return availableChars[Math.floor(Math.random() * availableChars.length)];
      }).join('');
    }
  };

  // Animation effect
  useEffect(() => {
    let currentIteration = 0;
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (isHovering) {
      setIsScrambling(true);
      intervalRef.current = setInterval(() => {
        setDisplayText(prev => {
          if (sequential) {
            if (revealedIndices.size < text.length) {
              const nextIndex = getNextIndex(revealedIndices);
              const newRevealed = new Set(revealedIndices);
              newRevealed.add(nextIndex);
              setRevealedIndices(newRevealed);
              return shuffleText(text, newRevealed);
            } else {
              clearInterval(intervalRef.current);
              intervalRef.current = null;
              setIsScrambling(false);
              return text;
            }
          } else {
            const shuffled = shuffleText(text, revealedIndices);
            currentIteration++;
            if (currentIteration >= maxIterations) {
              clearInterval(intervalRef.current);
              intervalRef.current = null;
              setIsScrambling(false);
              return text;
            }
            return shuffled;
          }
        });
      }, speed);
    } else {
      setDisplayText(text);
      setRevealedIndices(new Set());
      setIsScrambling(false);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line
  }, [isHovering, text, speed, maxIterations, sequential, revealDirection, characters, useOriginalCharsOnly]);

  // Animate on view
  useEffect(() => {
    if (animateOn === 'view' && containerRef.current) {
      observerRef.current = new window.IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting && !hasAnimated) {
            setIsHovering(true);
            setHasAnimated(true);
          }
        });
      }, { threshold: 0.1 });
      observerRef.current.observe(containerRef.current);
      return () => {
        if (observerRef.current && containerRef.current) {
          observerRef.current.unobserve(containerRef.current);
        }
      };
    }
    // eslint-disable-next-line
  }, [animateOn, hasAnimated]);

  const handleMouseEnter = () => {
    if (animateOn === 'hover') setIsHovering(true);
  };
  const handleMouseLeave = () => {
    if (animateOn === 'hover') setIsHovering(false);
  };

  return (
    <span
      ref={containerRef}
      className={`inline-block whitespace-pre-wrap ${parentClassName}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <span className="sr-only">{displayText}</span>
      <span aria-hidden="true">
        {displayText.split('').map((char, index) => (
          <span
            key={index}
            className={revealedIndices.has(index) || !isScrambling || !isHovering ? className : encryptedClassName}
          >
            {char}
          </span>
        ))}
      </span>
    </span>
  );
}

export default DecryptedText; 