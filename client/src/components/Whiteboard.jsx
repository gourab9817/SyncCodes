import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Stage, Layer, Line, Rect, Shape } from 'react-konva';
import { useSocket } from '../utils/SocketProvider.js';
import useResizeObserver from '@react-hook/resize-observer';
import { 
  Pencil, 
  Eraser, 
  Undo2, 
  Redo2, 
  Palette,
  X,
  GripVertical,
  Trash2
} from 'lucide-react';

const Whiteboard = ({ isOpen, onClose, darkMode, roomId }) => {
  const socket = useSocket();
  const containerRef = useRef(null);
  const stageRef = useRef(null);
  const mainLayerRef = useRef(null);
  const [tool, setTool] = useState('pen');
  const [color, setColor] = useState('#000000');
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [eraserSize, setEraserSize] = useState(20);
  const [isDrawing, setIsDrawing] = useState(false);
  const [lines, setLines] = useState([]);
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [whiteboardWidth, setWhiteboardWidth] = useState(400);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [isContainerReady, setIsContainerReady] = useState(false);

  // Measure container size once it's mounted and track changes
  useEffect(() => {
    if (!containerRef.current || !isOpen) return;

    const updateSize = () => {
      if (containerRef.current) {
        const newSize = {
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        };
        
        if (newSize.width > 0 && newSize.height > 0) {
          setCanvasSize(newSize);
          setIsContainerReady(true);
        }
      }
    };

    // Initial measure
    updateSize();

    // Keep tracking with ResizeObserver
    const resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      setIsContainerReady(false);
    };
  }, [isOpen]);

  // Create eraser shape function that uses destination-out to erase
  const createEraserShape = useCallback((line, index) => {
    return (
      <Shape
        key={line.id || `eraser-${index}`}
        sceneFunc={(ctx) => {
          // Set composite operation to destination-out for erasing
          ctx.save();
          ctx.globalCompositeOperation = 'destination-out';
          
          if (line.points && line.points.length >= 2) {
            ctx.beginPath();
            ctx.moveTo(line.points[0], line.points[1]);
            
            // Draw the eraser path
            for (let i = 2; i < line.points.length; i += 2) {
              if (line.points[i] !== undefined && line.points[i + 1] !== undefined) {
                ctx.lineTo(line.points[i], line.points[i + 1]);
              }
            }
            
            // Set stroke properties for erasing
            ctx.strokeStyle = 'rgba(0,0,0,1)';
            ctx.lineWidth = line.strokeWidth || eraserSize;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.stroke();
          }
          
          // Restore previous composite operation
          ctx.restore();
        }}
        listening={false}
        perfectDrawEnabled={false}
      />
    );
  }, [eraserSize]);



  // Listen for whiteboard updates from other users
  useEffect(() => {
    const handleWhiteboardUpdate = ({ strokes }) => {
      if (strokes && Array.isArray(strokes)) {
        // Directly use the received strokes - they contain absolute coordinates
        setLines(strokes);
      }
    };

    const handleWhiteboardClear = () => {
      setLines([]);
      setHistory([]);
      setHistoryIndex(-1);
    };

    socket.on('whiteboard:update', handleWhiteboardUpdate);
    socket.on('whiteboard:clear', handleWhiteboardClear);

    return () => {
      socket.off('whiteboard:update', handleWhiteboardUpdate);
      socket.off('whiteboard:clear', handleWhiteboardClear);
    };
  }, [socket]);

  const emitWhiteboardUpdate = useCallback((newLines) => {
    socket.emit('whiteboard:update', { roomId, strokes: newLines });
  }, [socket, roomId]);

  const handleMouseDown = useCallback((e) => {
    setIsDrawing(true);
    const pos = e.target.getStage().getPointerPosition();
    const newLine = {
      tool,
      color: tool === 'eraser' ? '#ffffff' : color,
      strokeWidth: tool === 'eraser' ? eraserSize : strokeWidth,
      points: [pos.x, pos.y],
      id: Date.now().toString() + '-' + Math.random(),
    };
    const newLines = [...lines, newLine];
    setLines(newLines);
    
    // Emit update immediately for real-time sync
    emitWhiteboardUpdate(newLines);
  }, [lines, tool, color, strokeWidth, eraserSize, emitWhiteboardUpdate]);

  const handleMouseMove = useCallback((e) => {
    if (!isDrawing) return;

    const stage = e.target.getStage();
    const point = stage.getPointerPosition();
    const newLines = [...lines];
    const lastLine = newLines[newLines.length - 1];
    
    if (lastLine) {
      lastLine.points = lastLine.points.concat([point.x, point.y]);
      newLines.splice(newLines.length - 1, 1, lastLine);
      setLines(newLines);
      emitWhiteboardUpdate(newLines);
    }
  }, [isDrawing, lines, emitWhiteboardUpdate]);

  const handleMouseUp = useCallback(() => {
    setIsDrawing(false);
    
    // Save to history for undo/redo
    if (lines.length > 0) {
      const newHistory = history.slice(0, historyIndex + 1);
      newHistory.push([...lines]);
      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
    }
  }, [lines, history, historyIndex]);

  const clearCanvas = useCallback(() => {
    setLines([]);
    setHistory([]);
    setHistoryIndex(-1);
    socket.emit('whiteboard:clear', { roomId });
  }, [socket, roomId]);

  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      const previousLines = history[newIndex];
      setLines(previousLines);
      setHistoryIndex(newIndex);
      emitWhiteboardUpdate(previousLines);
    }
  }, [history, historyIndex, emitWhiteboardUpdate]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      const nextLines = history[newIndex];
      setLines(nextLines);
      setHistoryIndex(newIndex);
      emitWhiteboardUpdate(nextLines);
    }
  }, [history, historyIndex, emitWhiteboardUpdate]);

  const handleResizeStart = (e) => {
    setIsDragging(true);
    setStartX(e.clientX);
  };

  const handleResizeMove = useCallback((e) => {
    if (isDragging) {
      const deltaX = startX - e.clientX; // Invert direction for natural resizing
      const newWidth = Math.max(200, Math.min(800, whiteboardWidth + deltaX));
      setWhiteboardWidth(newWidth);
      setStartX(e.clientX);
    }
  }, [isDragging, startX, whiteboardWidth]);

  const handleResizeEnd = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleResizeMove);
      document.addEventListener('mouseup', handleResizeEnd);
      return () => {
        document.removeEventListener('mousemove', handleResizeMove);
        document.removeEventListener('mouseup', handleResizeEnd);
      };
    }
  }, [isDragging, handleResizeMove]);

  const colors = [
    '#000000', '#FF0000', '#00FF00', '#0000FF', '#FFFF00', 
    '#FF00FF', '#00FFFF', '#FFA500', '#800080', '#008000'
  ];

  if (!isOpen) return null;

  return (
    <div 
      className={`fixed right-0 top-0 h-full bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 shadow-lg z-40 ${
        darkMode ? 'dark' : ''
      }`}
      style={{ 
        width: `${whiteboardWidth}px`,
        transform: 'translateX(0)', // Ensure proper anchoring
        transition: 'none', // Remove transition for smooth resizing
        height: 'calc(100vh - 80px)' // Leave space for bottom control bar
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="font-semibold text-gray-800 dark:text-gray-200">Whiteboard</h3>
        <button
          onClick={onClose}
          className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
        >
          <X size={20} className="text-gray-600 dark:text-gray-300" />
        </button>
      </div>

      {/* Toolbar */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center space-x-2 mb-4">
          <button
            onClick={() => setTool('pen')}
            className={`p-2 rounded ${tool === 'pen' ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}
          >
            <Pencil size={18} />
          </button>
          <button
            onClick={() => setTool('eraser')}
            className={`p-2 rounded ${tool === 'eraser' ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}
          >
            <Eraser size={18} />
          </button>
          <button
            onClick={undo}
            disabled={historyIndex <= 0}
            className="p-2 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 disabled:opacity-50"
          >
            <Undo2 size={18} />
          </button>
          <button
            onClick={redo}
            disabled={historyIndex >= history.length - 1}
            className="p-2 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 disabled:opacity-50"
          >
            <Redo2 size={18} />
          </button>
          <button
            onClick={clearCanvas}
            className="p-2 rounded bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-800"
          >
            <Trash2 size={18} />
          </button>
        </div>

        {/* Color Palette */}
        <div className="flex items-center space-x-2 mb-4">
          <Palette size={18} className="text-gray-600 dark:text-gray-300" />
          <div className="flex space-x-1">
            {colors.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={`w-6 h-6 rounded border-2 ${color === c ? 'border-gray-800 dark:border-gray-200' : 'border-gray-300 dark:border-gray-600'}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>

                 {/* Stroke Width */}
         <div className="flex items-center space-x-2">
           <span className="text-sm text-gray-600 dark:text-gray-300">
             {tool === 'eraser' ? 'Eraser Size:' : 'Width:'}
           </span>
           <input
             type="range"
             min="5"
             max="50"
             value={tool === 'eraser' ? eraserSize : strokeWidth}
             onChange={(e) => {
               const value = parseInt(e.target.value);
               if (tool === 'eraser') {
                 setEraserSize(value);
               } else {
                 setStrokeWidth(value);
               }
             }}
             className="flex-1"
           />
           <span className="text-sm text-gray-600 dark:text-gray-300 w-8">
             {tool === 'eraser' ? eraserSize : strokeWidth}
           </span>
         </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 p-4">
        <div 
          ref={containerRef}
          className="w-full h-full border border-gray-200 dark:border-gray-600 rounded overflow-hidden"
          style={{ 
            height: 'calc(100vh - 380px)', 
            minHeight: '400px',
            position: 'relative',
            backgroundColor: darkMode ? '#374151' : '#ffffff'
          }}
        >
          {isContainerReady && canvasSize.width > 0 && canvasSize.height > 0 && (
            <Stage
              ref={stageRef}
              width={canvasSize.width}
              height={canvasSize.height}
              onMouseDown={handleMouseDown}
              onMousemove={handleMouseMove}
              onMouseup={handleMouseUp}
              style={{ background: darkMode ? '#374151' : '#ffffff' }}
            >
              {/* Background Layer */}
              <Layer>
                <Rect
                  x={0}
                  y={0}
                  width={canvasSize.width}
                  height={canvasSize.height}
                  fill={darkMode ? '#374151' : '#ffffff'}
                />
              </Layer>
              
              {/* Drawing Layer - pen strokes and eraser shapes */}
              <Layer ref={mainLayerRef}>
                {/* All drawing lines (pen tool only) */}
                {lines
                  .filter(line => line.tool !== 'eraser')
                  .map((line, i) => (
                    <Line
                      key={line.id || `pen-${i}`}
                      points={line.points}
                      stroke={line.color}
                      strokeWidth={line.strokeWidth}
                      tension={0.5}
                      lineCap="round"
                      lineJoin="round"
                    />
                  ))}
                
                {/* Eraser shapes - use destination-out to erase what's below */}
                {lines
                  .filter(line => line.tool === 'eraser')
                  .map((line, i) => createEraserShape(line, i))}
              </Layer>
            </Stage>
          )}
        </div>
      </div>

      {/* Resize Handle */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1 bg-gray-300 dark:bg-gray-600 cursor-col-resize hover:bg-blue-500 dark:hover:bg-blue-400"
        onMouseDown={handleResizeStart}
      >
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
          <GripVertical size={16} className="text-gray-500 dark:text-gray-400" />
        </div>
      </div>
    </div>
  );
};

export default Whiteboard;
