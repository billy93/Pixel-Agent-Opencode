'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

export interface OnlinePlayer {
  userId: string;
  username: string;
  x: number;
  y: number;
  direction: string;
  avatar?: string;
}

interface UseSocketOptions {
  /** Current user ID — socket won't connect if null */
  userId: string | null;
  /** Initial position to send on connect */
  initialPosition?: { x: number; y: number; direction: string; avatar?: string };
}

interface UseSocketReturn {
  /** Whether the socket is connected */
  isConnected: boolean;
  /** Connection error message if any */
  connectionError: string | null;
  /** Other online players (excludes current user) */
  otherPlayers: OnlinePlayer[];
  /** Number of online players (including self) */
  onlineCount: number;
  /** Send player position update (throttled internally) */
  sendPosition: (x: number, y: number, direction: string) => void;
}

export function useSocket({ userId, initialPosition }: UseSocketOptions): UseSocketReturn {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [otherPlayers, setOtherPlayers] = useState<OnlinePlayer[]>([]);
  const [onlineCount, setOnlineCount] = useState(0);
  
  // Throttle position updates to ~20fps (50ms)
  const lastSentRef = useRef<number>(0);
  const lastPosRef = useRef<{ x: number; y: number; direction: string } | null>(null);
  const throttleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!userId) return;

    // Connect to Socket.IO (same origin, default path)
    const socket = io({
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      // Auth token will be sent via cookie automatically
      withCredentials: true,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[Socket] Connected:', socket.id);
      setIsConnected(true);
      setConnectionError(null);

      // Send initial position if available
      if (initialPosition) {
        socket.emit('player:init', initialPosition);
      }
    });

    socket.on('connect_error', (err) => {
      console.error('[Socket] Connection error:', err.message);
      setConnectionError(err.message);
      setIsConnected(false);
    });

    socket.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason);
      setIsConnected(false);
    });

    // Receive full player list on initial connect
    socket.on('players:list', (players: OnlinePlayer[]) => {
      setOtherPlayers(players);
    });

    // A new player joined
    socket.on('player:joined', (player: OnlinePlayer) => {
      setOtherPlayers(prev => {
        // Replace if already exists (reconnection)
        const filtered = prev.filter(p => p.userId !== player.userId);
        return [...filtered, player];
      });
    });

    // A player moved
    socket.on('player:moved', (data: OnlinePlayer) => {
      setOtherPlayers(prev =>
        prev.map(p =>
          p.userId === data.userId
            ? { ...p, x: data.x, y: data.y, direction: data.direction }
            : p
        )
      );
    });

    // A player left
    socket.on('player:left', (data: { userId: string }) => {
      setOtherPlayers(prev => prev.filter(p => p.userId !== data.userId));
    });

    // Online count update
    socket.on('players:count', (count: number) => {
      setOnlineCount(count);
    });

    socket.on('connect_error', (err) => {
      console.error('[Socket] Connection error:', err.message);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      if (throttleTimerRef.current) {
        clearTimeout(throttleTimerRef.current);
      }
    };
  }, [userId]); // Only reconnect when userId changes

  // Send position updates, throttled to ~20 updates/sec
  const sendPosition = useCallback((x: number, y: number, direction: string) => {
    const socket = socketRef.current;
    if (!socket || !socket.connected) return;

    const now = Date.now();
    const pos = { x, y, direction };

    // Check if position actually changed
    const last = lastPosRef.current;
    if (last && Math.abs(last.x - x) < 0.5 && Math.abs(last.y - y) < 0.5 && last.direction === direction) {
      return;
    }

    lastPosRef.current = pos;

    // Throttle to 50ms intervals
    if (now - lastSentRef.current >= 50) {
      lastSentRef.current = now;
      socket.emit('player:move', pos);
    } else if (!throttleTimerRef.current) {
      // Schedule a send for the latest position
      throttleTimerRef.current = setTimeout(() => {
        throttleTimerRef.current = null;
        const currentPos = lastPosRef.current;
        if (currentPos && socketRef.current?.connected) {
          lastSentRef.current = Date.now();
          socketRef.current.emit('player:move', currentPos);
        }
      }, 50 - (now - lastSentRef.current));
    }
  }, []);

  return {
    isConnected,
    connectionError,
    otherPlayers,
    onlineCount,
    sendPosition,
  };
}
