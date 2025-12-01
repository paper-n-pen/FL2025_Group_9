import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { SessionSocket } from './socket';
import './components/whiteboard.css';

// Define a more structured data type for drawing events
interface Point {
    x: number;
    y: number;
}

type DrawData =
    | { type: 'dot'; point: Point; color: string; size: number }
    | { type: 'curve'; startPoint: Point; midPoint: Point; endPoint: Point; color: string; size: number }
    | { type: 'clear' }
    | { type: 'erase'; point: Point; size: number }
    | { type: 'erase-stroke'; points: Point[]; size: number };

type Tool = 'pen' | 'eraser';

interface WhiteboardProps {
    socket?: SessionSocket | null;
    sessionId?: string;
}

const Whiteboard = ({ socket, sessionId }: WhiteboardProps) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const toolbarRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const contextRef = useRef<CanvasRenderingContext2D | null>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [currentTool, setCurrentTool] = useState<Tool>('pen');
    const [brushSize, setBrushSize] = useState(5);
    const [brushColor, setBrushColor] = useState('#39FF14'); // Neon green as default
    const [boardColor, setBoardColor] = useState<'white' | 'black' | 'grey'>('black');
    const [pageStyle, setPageStyle] = useState<'plain' | 'lines' | 'grid' | 'dotted'>('plain');
    const boardColorRef = useRef<'white' | 'black' | 'grey'>('black');
    const brushStateRef = useRef({ size: 5, color: '#39FF14' });
    const pointsRef = useRef<Point[]>([]);
    const drawHistoryRef = useRef<DrawData[]>([]);
    const canvasContainerRef = useRef<HTMLDivElement>(null);

    const resetHistory = useCallback(() => {
        drawHistoryRef.current = [];
    }, []);

    const recordHistory = useCallback((entry: DrawData) => {
        if (entry.type === 'clear') {
            resetHistory();
            return;
        }

        drawHistoryRef.current.push(entry);
    }, [resetHistory]);

    const applyDrawData = useCallback((context: CanvasRenderingContext2D, canvas: HTMLCanvasElement, data: DrawData) => {
        switch (data.type) {
            case 'dot': {
                context.save();
                context.strokeStyle = data.color;
                context.fillStyle = data.color;
                context.lineWidth = data.size;
                context.beginPath();
                context.arc(data.point.x, data.point.y, data.size / 2, 0, 2 * Math.PI);
                context.fill();
                context.closePath();
                context.restore();
                break;
            }
            case 'curve': {
                context.save();
                context.strokeStyle = data.color;
                context.lineWidth = data.size;
                context.beginPath();
                context.moveTo(data.startPoint.x, data.startPoint.y);
                context.quadraticCurveTo(data.midPoint.x, data.midPoint.y, data.endPoint.x, data.endPoint.y);
                context.stroke();
                context.closePath();
                context.restore();
                break;
            }
            case 'clear': {
                // Clear canvas (transparent) - CSS background on container shows through
                context.clearRect(0, 0, canvas.width, canvas.height);
                break;
            }
            case 'erase': {
                context.save();
                context.globalCompositeOperation = 'destination-out';
                context.beginPath();
                context.arc(data.point.x, data.point.y, data.size / 2, 0, 2 * Math.PI);
                context.fill();
                context.closePath();
                context.restore();
                break;
            }
            case 'erase-stroke': {
                if (data.points.length === 0) {
                    break;
                }

                context.save();
                context.globalCompositeOperation = 'destination-out';
                context.lineCap = 'round';
                context.lineJoin = 'round';
                context.lineWidth = data.size;
                const [first, ...rest] = data.points;
                context.beginPath();
                context.moveTo(first.x, first.y);
                for (const point of rest) {
                    context.lineTo(point.x, point.y);
                }
                context.stroke();
                context.restore();
                break;
            }
        }
    }, []);

    const replayHistory = useCallback(() => {
        const context = contextRef.current;
        const canvas = canvasRef.current;
        if (!context || !canvas) {
            return;
        }

        // Clear canvas (transparent) - CSS background on container shows through
        context.clearRect(0, 0, canvas.width, canvas.height);

        for (const entry of drawHistoryRef.current) {
            applyDrawData(context, canvas, entry);
        }
    }, [applyDrawData]);
    const setCanvasDimensions = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) {
            return;
        }

        const container = containerRef.current;
        const toolbarHeight = toolbarRef.current?.getBoundingClientRect().height ?? 0;

        let paddingX = 0;
        let paddingY = 0;
        if (container) {
            const styles = window.getComputedStyle(container);
            paddingX = (parseFloat(styles.paddingLeft) || 0) + (parseFloat(styles.paddingRight) || 0);
            paddingY = (parseFloat(styles.paddingTop) || 0) + (parseFloat(styles.paddingBottom) || 0);
        }

        const rawWidth = (container?.clientWidth ?? window.innerWidth * 0.9) - paddingX;
        const width = Math.max(rawWidth, 100);

        // Visible height for the scrollable container
        const availableHeight = (container?.clientHeight ?? window.innerHeight * 0.8) - toolbarHeight - paddingY;
        const viewportLimit = Math.max(window.innerHeight - 240 - toolbarHeight, 200);
        const ratioLimit = width * 0.75; // keep a reasonable aspect ratio (4:3)
        const boundedHeight = Math.min(availableHeight, ratioLimit, viewportLimit);
        const visibleHeight = Math.max(boundedHeight, 200);

        // Set container height to visible height for scrolling
        const canvasContainer = canvasContainerRef.current;
        if (canvasContainer) {
            canvasContainer.style.height = `${visibleHeight}px`;
        }

        // Canvas will be 3x the visible height for scrolling
        const canvasHeight = visibleHeight * 3;

        canvas.width = width;
        canvas.height = canvasHeight;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${canvasHeight}px`;

        const context = canvas.getContext('2d');
        if (!context) {
            return;
        }

        // Canvas background is handled by CSS on the container
        // Canvas itself should be transparent so CSS background shows through
        // No need to fill here - CSS handles it
        
        const { size, color } = brushStateRef.current;
        context.lineCap = 'round';
        context.lineJoin = 'round';
        context.lineWidth = size;
        context.strokeStyle = color;
        contextRef.current = context;
        replayHistory();
    }, [replayHistory]);

    useEffect(() => {
        setCanvasDimensions();
        const rafCallback = () => setCanvasDimensions();
        const rafId = window.requestAnimationFrame(rafCallback);
        return () => window.cancelAnimationFrame(rafId);
    }, [setCanvasDimensions]);

    useEffect(() => {
        const handleResize = () => {
            setCanvasDimensions();
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [setCanvasDimensions]);

    useEffect(() => {
        brushStateRef.current = { size: brushSize, color: brushColor };
        boardColorRef.current = boardColor;
        const context = contextRef.current;
        if (!context) {
            return;
        }

        context.strokeStyle = brushColor;
        context.lineWidth = brushSize;
    }, [brushColor, brushSize, boardColor]);

    // When board color changes, redraw history on transparent canvas
    // The CSS background on the container will show through
    useEffect(() => {
        replayHistory();
    }, [boardColor, replayHistory]);

    useEffect(() => {
        if (!sessionId || !socket) return;
    
        const handleDrawEvent = (raw: unknown) => {
            // First, narrow the type safely
            if (
                !raw ||
                typeof raw !== "object" ||
                !("sessionId" in raw) ||
                !("payload" in raw)
            ) {
                console.warn("Invalid draw event payload:", raw);
                return;
            }
    
            const { sessionId: sid, payload } = raw as { sessionId: string; payload: DrawData };
    
            // Compare as strings
            if (String(sid) !== String(sessionId)) {
                console.log("⚠️ Received draw event for different session:", sid, "vs", sessionId);
                return;
            }
            
            console.log("📥 Received whiteboard draw event:", { sessionId: sid, type: payload.type });
    
            const context = contextRef.current;
            const canvas = canvasRef.current;
            if (!context || !canvas) return;
    
            // Apply the drawing from another user
            applyDrawData(context, canvas, payload);
    
            // Update local draw history
            recordHistory(payload);
        };
    
        socket.on("whiteboard-draw", handleDrawEvent);
    
        return () => {
            socket.off("whiteboard-draw", handleDrawEvent);
        };
    }, [socket, sessionId, applyDrawData, recordHistory]);
    
    

    const resolveCanvasPoint = useCallback((event: React.MouseEvent<HTMLCanvasElement>): Point => {
        const canvas = canvasRef.current;
        if (!canvas) {
            return { x: 0, y: 0 };
        }

        // Get the bounding rect of the canvas - recompute on each event
        // getBoundingClientRect() already accounts for scroll position in viewport coordinates
        const rect = canvas.getBoundingClientRect();
        const { clientX, clientY } = event.nativeEvent;
        
        // Convert viewport coordinates to canvas coordinates
        // No scroll offset needed - getBoundingClientRect() already handles it
        const x = ((clientX - rect.left) * canvas.width) / rect.width;
        const y = ((clientY - rect.top) * canvas.height) / rect.height;
        
        return { x, y };
    }, []);

    const emitDrawing = useCallback((payload: DrawData) => {
        if (!sessionId || !socket) return;
    
        // Ensure sessionId is a string for consistency
        const sessionIdStr = String(sessionId);
        console.log("📤 Emitting whiteboard draw:", { sessionId: sessionIdStr, type: payload.type });
        socket.emit("whiteboard-draw", { sessionId: sessionIdStr, payload });
    }, [sessionId, socket]);
    

    const startDrawing = (event: React.MouseEvent<HTMLCanvasElement>) => {
        const context = contextRef.current;
        if (!context) return;

        setIsDrawing(true);
        context.lineWidth = brushSize;
        context.strokeStyle = brushColor;
        const currentPoint = resolveCanvasPoint(event);
        pointsRef.current = [currentPoint];

        if (currentTool === 'eraser') {
            context.save();
            context.globalCompositeOperation = 'destination-out';
            context.beginPath();
            context.arc(currentPoint.x, currentPoint.y, brushSize / 2, 0, 2 * Math.PI);
            context.fill();
            context.closePath();
            context.restore();

            pointsRef.current = [currentPoint];
            const payload: DrawData = { type: 'erase', point: currentPoint, size: brushSize };
            recordHistory(payload);
            emitDrawing(payload);
            return;
        }

        {
            // Draw a single point locally
            context.beginPath();
            context.arc(currentPoint.x, currentPoint.y, context.lineWidth / 2, 0, 2 * Math.PI);
            context.fillStyle = context.strokeStyle;
            context.fill();
            context.closePath();

            // Emit the drawing event for the single point
            const payload: DrawData = { type: 'dot', point: currentPoint, color: brushColor, size: brushSize };
            recordHistory(payload);
            emitDrawing(payload);
        }
    };

    const finishDrawing = () => {
        if (!isDrawing) {
            return;
        }

        setIsDrawing(false);

        if (currentTool === 'eraser') {
            const strokePoints = [...pointsRef.current];
            pointsRef.current = [];
            if (strokePoints.length === 0) {
                return;
            }

            const strokePayload: DrawData = { type: 'erase-stroke', points: strokePoints, size: brushSize };
            recordHistory(strokePayload);
            emitDrawing(strokePayload);
            return;
        }

        pointsRef.current = [];
    };

    const draw = (event: React.MouseEvent<HTMLCanvasElement>) => {
        if (!isDrawing) {
            return;
        }
        const context = contextRef.current;
        if (!context) return;

        const currentPoint = resolveCanvasPoint(event);
        pointsRef.current.push(currentPoint);

        if (currentTool === 'eraser') {
            const points = pointsRef.current;
            const previousPoint = points.length >= 2 ? points[points.length - 2] : points[points.length - 1];

            if (!previousPoint) {
                return;
            }

            context.save();
            context.globalCompositeOperation = 'destination-out';
            context.beginPath();
            context.moveTo(previousPoint.x, previousPoint.y);
            context.lineTo(currentPoint.x, currentPoint.y);
            context.lineWidth = brushSize;
            context.lineCap = 'round';
            context.lineJoin = 'round';
            context.stroke();
            context.restore();

            const payload: DrawData = { type: 'erase', point: currentPoint, size: brushSize };
            recordHistory(payload);
            emitDrawing(payload);
            return;
        }

        if (pointsRef.current.length > 2) {
            const points = pointsRef.current;
            const lastPoint = points[points.length - 2];
            const midPoint = {
                x: (lastPoint.x + currentPoint.x) / 2,
                y: (lastPoint.y + currentPoint.y) / 2
            };
            const prevMidPoint = {
                x: (points[points.length - 3].x + lastPoint.x) / 2,
                y: (points[points.length - 3].y + lastPoint.y) / 2
            };

            // Draw the curve locally
            context.lineWidth = brushSize;
            context.strokeStyle = brushColor;
            context.beginPath();
            context.moveTo(prevMidPoint.x, prevMidPoint.y);
            context.quadraticCurveTo(lastPoint.x, lastPoint.y, midPoint.x, midPoint.y);
            context.stroke();
            context.closePath();
            
            // Emit the curve data
            const payload: DrawData = {
                type: 'curve',
                startPoint: prevMidPoint,
                midPoint: lastPoint,
                endPoint: midPoint,
                color: brushColor,
                size: brushSize
            };
            recordHistory(payload);
            emitDrawing(payload);
        }
    };

    // Toolbar functions
    const clearCanvas = useCallback(() => {
        const context = contextRef.current;
        const canvas = canvasRef.current;
        if (!context || !canvas) return;
        // Clear canvas (transparent) - CSS background on container shows through
        context.clearRect(0, 0, canvas.width, canvas.height);
        resetHistory();
        emitDrawing({ type: 'clear' });
    }, [emitDrawing, resetHistory]);

    const downloadCanvas = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        
        const link = document.createElement('a');
        link.download = `whiteboard-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.png`;
        link.href = canvas.toDataURL();
        link.click();
    }, []);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            // Only handle shortcuts if not typing in an input
            if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
                return;
            }

            const key = event.key.toLowerCase();
            if (key === 'p') {
                setCurrentTool('pen');
            } else if (key === 'e') {
                setCurrentTool('eraser');
            } else if (key === 'c') {
                clearCanvas();
            } else if (key === 'd') {
                downloadCanvas();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [clearCanvas, downloadCanvas]);

    return (
        <div ref={containerRef} className="wb-wrap">
            {/* Toolbar */}
            <div ref={toolbarRef} className="wb-toolbar" role="toolbar" aria-label="Whiteboard controls">
                {/* Tool Selection */}
                <div className="wb-seg" role="group" aria-label="Tool">
                    <button
                        type="button"
                        aria-pressed={currentTool === 'pen'}
                        aria-label="Pen (P)"
                        onClick={() => setCurrentTool('pen')}
                        title="Pen (P)"
                    >
                        ✏️ Pen
                    </button>
                    <button
                        type="button"
                        aria-pressed={currentTool === 'eraser'}
                        aria-label="Eraser (E)"
                        onClick={() => setCurrentTool('eraser')}
                        title="Eraser (E)"
                    >
                        🧹 Eraser
                    </button>
                </div>

                {/* Brush Size */}
                <div className="wb-field" aria-label="Stroke size">
                    <label htmlFor="brush-size">Size:</label>
                    <input
                        id="brush-size"
                        className="wb-slider"
                        type="range"
                        min="1"
                        max="20"
                        value={brushSize}
                        onChange={(event: React.ChangeEvent<HTMLInputElement>) => setBrushSize(Number(event.target.value))}
                        aria-valuemin={1}
                        aria-valuemax={20}
                        aria-valuenow={brushSize}
                        aria-label="Brush size"
                    />
                    <span>{brushSize}px</span>
                </div>

                {/* Color Picker */}
                <div className="wb-field" aria-label="Stroke color">
                    <label htmlFor="brush-color">Color:</label>
                    <span className="wb-color" title="Pick color">
                        <input
                            id="brush-color"
                            type="color"
                            value={brushColor}
                            onChange={(event: React.ChangeEvent<HTMLInputElement>) => setBrushColor(event.target.value)}
                            aria-label="Pick color"
                        />
                    </span>
                </div>

                {/* Board Color */}
                <div className="wb-field" aria-label="Board color">
                    <label htmlFor="board-color">Board:</label>
                    <div className="wb-seg" role="group" aria-label="Board color">
                        <button
                            type="button"
                            aria-pressed={boardColor === 'white'}
                            aria-label="White board"
                            onClick={() => setBoardColor('white')}
                            title="White board"
                            style={{ fontSize: '12px', padding: '6px 10px' }}
                        >
                            ⚪
                        </button>
                        <button
                            type="button"
                            aria-pressed={boardColor === 'black'}
                            aria-label="Black board"
                            onClick={() => setBoardColor('black')}
                            title="Black board"
                            style={{ fontSize: '12px', padding: '6px 10px' }}
                        >
                            ⚫
                        </button>
                        <button
                            type="button"
                            aria-pressed={boardColor === 'grey'}
                            aria-label="Grey board"
                            onClick={() => setBoardColor('grey')}
                            title="Grey board"
                            style={{ fontSize: '12px', padding: '6px 10px' }}
                        >
                            ⚪
                        </button>
                    </div>
                </div>

                {/* Page Style */}
                <div className="wb-field" aria-label="Page style">
                    <label htmlFor="page-style">Style:</label>
                    <div className="wb-seg" role="group" aria-label="Page style">
                        <button
                            type="button"
                            aria-pressed={pageStyle === 'plain'}
                            aria-label="Plain"
                            onClick={() => setPageStyle('plain')}
                            title="Plain"
                            style={{ fontSize: '12px', padding: '6px 10px' }}
                        >
                            Plain
                        </button>
                        <button
                            type="button"
                            aria-pressed={pageStyle === 'lines'}
                            aria-label="Lines"
                            onClick={() => setPageStyle('lines')}
                            title="Lines"
                            style={{ fontSize: '12px', padding: '6px 10px' }}
                        >
                            Lines
                        </button>
                        <button
                            type="button"
                            aria-pressed={pageStyle === 'grid'}
                            aria-label="Grid"
                            onClick={() => setPageStyle('grid')}
                            title="Grid"
                            style={{ fontSize: '12px', padding: '6px 10px' }}
                        >
                            Grid
                        </button>
                        <button
                            type="button"
                            aria-pressed={pageStyle === 'dotted'}
                            aria-label="Dotted"
                            onClick={() => setPageStyle('dotted')}
                            title="Dotted"
                            style={{ fontSize: '12px', padding: '6px 10px' }}
                        >
                            Dotted
                        </button>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="wb-toolbar-actions">
                    <button
                        type="button"
                        className="btn btn-outline-danger"
                        onClick={clearCanvas}
                        aria-label="Clear (C)"
                        title="Clear (C)"
                    >
                        Clear
                    </button>
                    <button
                        type="button"
                        className="btn btn-primary"
                        onClick={downloadCanvas}
                        aria-label="Download (D)"
                        title="Download (D)"
                    >
                        Download
                    </button>
                </div>
            </div>

            {/* Canvas Container with Scroll */}
            <div 
                ref={canvasContainerRef}
                className="wb-canvas-container"
                data-board-color={boardColor}
                data-page-style={pageStyle}
            >
                <canvas
                    onMouseDown={startDrawing}
                    onMouseUp={finishDrawing}
                    onMouseMove={draw}
                    onMouseLeave={finishDrawing}
                    ref={canvasRef}
                    className="wb-canvas"
                    aria-label="Whiteboard canvas"
                />
            </div>
        </div>
    );
};

export default Whiteboard;

