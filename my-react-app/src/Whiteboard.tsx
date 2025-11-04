import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { SessionSocket } from './socket';

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
    const [brushColor, setBrushColor] = useState('#000000');
    const pointsRef = useRef<Point[]>([]);
    const drawHistoryRef = useRef<DrawData[]>([]);

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
    const bounds = container?.getBoundingClientRect();
    const toolbarHeight = toolbarRef.current?.getBoundingClientRect().height ?? 0;
    const width = bounds?.width ?? window.innerWidth * 0.9;
    const height = Math.max((bounds?.height ?? window.innerHeight * 0.8) - toolbarHeight, 100);

        canvas.width = width;
        canvas.height = height;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;

        const context = canvas.getContext('2d');
        if (!context) {
            return;
        }

        context.lineCap = 'round';
        context.lineJoin = 'round';
        context.lineWidth = brushSize;
        context.strokeStyle = brushColor;
        contextRef.current = context;
        replayHistory();
    }, [brushColor, brushSize, replayHistory]);

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
        const context = contextRef.current;
        if (!context) {
            return;
        }

        context.strokeStyle = brushColor;
        context.lineWidth = brushSize;
    }, [brushColor, brushSize]);

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
    
            if (sid !== sessionId) return;
    
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

        const rect = canvas.getBoundingClientRect();
        const { clientX, clientY } = event.nativeEvent;

        return {
            x: clientX - rect.left,
            y: clientY - rect.top
        };
    }, []);

    const emitDrawing = (payload: DrawData) => {
        if (!sessionId || !socket) return;
    
        socket.emit("whiteboard-draw", { sessionId, payload });
    };
    

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
    const clearCanvas = () => {
        const context = contextRef.current;
        const canvas = canvasRef.current;
        if (!context || !canvas) return;
        context.clearRect(0, 0, canvas.width, canvas.height);
        resetHistory();
        emitDrawing({ type: 'clear' });
    };

    const downloadCanvas = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        
        const link = document.createElement('a');
        link.download = `whiteboard-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.png`;
        link.href = canvas.toDataURL();
        link.click();
    };

    return (
    <div ref={containerRef} style={{ display: 'flex', flexDirection: 'column', flex: '1 1 auto', minHeight: 0 }}>
            {/* Toolbar */}
            <div ref={toolbarRef} style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px',
                backgroundColor: '#f5f5f5',
                borderBottom: '1px solid #ddd',
                flexWrap: 'wrap'
            }}>
                {/* Tool Selection */}
                <div style={{ display: 'flex', gap: '5px' }}>
                    <button
                        onClick={() => setCurrentTool('pen')}
                        style={{
                            padding: '8px 16px',
                            backgroundColor: currentTool === 'pen' ? '#007bff' : '#fff',
                            color: currentTool === 'pen' ? '#fff' : '#000',
                            border: '1px solid #ccc',
                            borderRadius: '4px',
                            cursor: 'pointer'
                        }}
                    >
                        ✏️ Pen
                    </button>
                    <button
                        onClick={() => setCurrentTool('eraser')}
                        style={{
                            padding: '8px 16px',
                            backgroundColor: currentTool === 'eraser' ? '#007bff' : '#fff',
                            color: currentTool === 'eraser' ? '#fff' : '#000',
                            border: '1px solid #ccc',
                            borderRadius: '4px',
                            cursor: 'pointer'
                        }}
                    >
                        🧹 Eraser
                    </button>
                </div>

                {/* Brush Size */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <label>Size:</label>
                    <input
                        type="range"
                        min="1"
                        max="20"
                        value={brushSize}
                        onChange={(event: React.ChangeEvent<HTMLInputElement>) => setBrushSize(Number(event.target.value))}
                        style={{ width: '100px' }}
                    />
                    <span>{brushSize}px</span>
                </div>

                {/* Color Picker */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <label>Color:</label>
                    <input
                        type="color"
                        value={brushColor}
                        onChange={(event: React.ChangeEvent<HTMLInputElement>) => setBrushColor(event.target.value)}
                        style={{ width: '40px', height: '30px', border: 'none', borderRadius: '4px' }}
                    />
                </div>

                {/* Action Buttons */}
                <div style={{ display: 'flex', gap: '5px', marginLeft: 'auto' }}>
                    <button
                        onClick={clearCanvas}
                        style={{
                            padding: '8px 16px',
                            backgroundColor: '#dc3545',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer'
                        }}
                    >
                        🗑️ Clear
                    </button>
                    <button
                        onClick={downloadCanvas}
                        style={{
                            padding: '8px 16px',
                            backgroundColor: '#28a745',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer'
                        }}
                    >
                        💾 Download
                    </button>
                </div>
            </div>

            {/* Canvas */}
            <canvas
                onMouseDown={startDrawing}
                onMouseUp={finishDrawing}
                onMouseMove={draw}
                onMouseLeave={finishDrawing}
                ref={canvasRef}
                style={{
                    border: '1px solid black',
                    backgroundColor: 'white',
                    flex: '1 1 auto',
                    cursor: currentTool === 'eraser' ? 'crosshair' : 'crosshair'
                }}
            />
        </div>
    );
};

export default Whiteboard;

