'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { GlobalChatMsg } from '@/types';

interface UseGlobalChatOptions {
  /** Current user ID — won't connect if null */
  userId: string | null;
  /** Whether the chat panel is currently open */
  isOpen: boolean;
}

interface UseGlobalChatReturn {
  /** Chat messages in chronological order */
  messages: GlobalChatMsg[];
  /** Send a text message */
  sendMessage: (content: string) => void;
  /** Send an emote message */
  sendEmote: (content: string) => void;
  /** Number of unread messages (since last time panel was open) */
  unreadCount: number;
  /** Clear unread count */
  clearUnread: () => void;
  /** Whether the socket is connected */
  isConnected: boolean;
}

export function useGlobalChat({ userId, isOpen }: UseGlobalChatOptions): UseGlobalChatReturn {
  const socketRef = useRef<Socket | null>(null);
  const [messages, setMessages] = useState<GlobalChatMsg[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const isOpenRef = useRef(isOpen);
  const hasLoadedHistory = useRef(false);

  // Keep isOpenRef in sync
  useEffect(() => {
    isOpenRef.current = isOpen;
    if (isOpen) {
      setUnreadCount(0);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!userId) return;

    // Connect to Socket.IO (same origin, shared with movement socket)
    const socket = io({
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      withCredentials: true,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);

      // Request chat history on first connect
      if (!hasLoadedHistory.current) {
        socket.emit('chat:history', { limit: 50 });
        hasLoadedHistory.current = true;
      }
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    // Receive chat history
    socket.on('chat:history', (data: { messages: GlobalChatMsg[] }) => {
      setMessages(data.messages);
    });

    // Receive new chat message (real-time)
    socket.on('chat:message', (msg: GlobalChatMsg) => {
      setMessages(prev => [...prev, msg]);

      // Increment unread if panel is closed and message is not from self
      if (!isOpenRef.current && msg.userId !== userId) {
        setUnreadCount(prev => prev + 1);
      }
    });

    socket.on('chat:error', (data: { error: string }) => {
      console.error('[GlobalChat] Error:', data.error);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      hasLoadedHistory.current = false;
    };
  }, [userId]);

  const sendMessage = useCallback((content: string) => {
    const socket = socketRef.current;
    if (!socket?.connected || !content.trim()) return;
    socket.emit('chat:send', { content: content.trim(), type: 'text' });
  }, []);

  const sendEmote = useCallback((content: string) => {
    const socket = socketRef.current;
    if (!socket?.connected || !content.trim()) return;
    socket.emit('chat:send', { content: content.trim(), type: 'emote' });
  }, []);

  const clearUnread = useCallback(() => {
    setUnreadCount(0);
  }, []);

  return {
    messages,
    sendMessage,
    sendEmote,
    unreadCount,
    clearUnread,
    isConnected,
  };
}
