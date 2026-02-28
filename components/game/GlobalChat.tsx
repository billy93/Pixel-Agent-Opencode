'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { X, Send, MessageCircle, Users, Smile } from 'lucide-react';
import { GlobalChatMsg } from '@/types';

interface GlobalChatProps {
  messages: GlobalChatMsg[];
  currentUserId: string;
  currentUsername: string;
  onSendMessage: (content: string) => void;
  onSendEmote: (content: string) => void;
  onClose: () => void;
  isConnected: boolean;
  onlineCount: number;
  isMobile?: boolean;
}

// Generate a consistent color from a username
function getUserColor(username: string): string {
  const colors = [
    '#60a5fa', // blue
    '#34d399', // emerald
    '#f472b6', // pink
    '#a78bfa', // violet
    '#fbbf24', // amber
    '#f87171', // red
    '#2dd4bf', // teal
    '#fb923c', // orange
    '#818cf8', // indigo
    '#4ade80', // green
  ];
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

function formatTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Group consecutive messages from the same user
interface MessageGroup {
  userId: string;
  username: string;
  messages: GlobalChatMsg[];
}

function groupMessages(messages: GlobalChatMsg[]): MessageGroup[] {
  const groups: MessageGroup[] = [];
  for (const msg of messages) {
    const lastGroup = groups[groups.length - 1];
    if (
      lastGroup &&
      lastGroup.userId === msg.userId &&
      msg.type !== 'system'
    ) {
      lastGroup.messages.push(msg);
    } else {
      groups.push({
        userId: msg.userId,
        username: msg.username,
        messages: [msg],
      });
    }
  }
  return groups;
}

export default function GlobalChat({
  messages,
  currentUserId,
  currentUsername,
  onSendMessage,
  onSendEmote,
  onClose,
  isConnected,
  onlineCount,
  isMobile,
}: GlobalChatProps) {
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);

  // Check if user is scrolled near bottom
  const checkNearBottom = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const threshold = 100;
    isNearBottomRef.current =
      container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
  }, []);

  // Auto-scroll to bottom when new messages arrive (only if near bottom)
  useEffect(() => {
    if (isNearBottomRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Focus input on mount
  useEffect(() => {
    if (!isMobile) {
      inputRef.current?.focus();
    }
  }, [isMobile]);

  const handleSend = useCallback(() => {
    const text = inputValue.trim();
    if (!text) return;

    // Check for emote command: /me <action>
    if (text.startsWith('/me ')) {
      onSendEmote(text.slice(4));
    } else {
      onSendMessage(text);
    }

    setInputValue('');
    inputRef.current?.focus();
  }, [inputValue, onSendMessage, onSendEmote]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
      // Prevent game keys from firing while typing
      e.stopPropagation();
    },
    [handleSend]
  );

  const messageGroups = groupMessages(messages);

  const panelWidth = isMobile ? '100%' : '380px';
  const panelHeight = isMobile ? '100%' : '500px';

  return (
    <div
      className="bg-slate-900/95 backdrop-blur-md text-white rounded-2xl border border-slate-700/50 shadow-[0_8px_30px_rgb(0,0,0,0.4)] flex flex-col overflow-hidden"
      style={{
        width: panelWidth,
        height: panelHeight,
        maxHeight: isMobile ? '100dvh' : '70vh',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/50 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-emerald-500 to-cyan-500 flex items-center justify-center shadow-inner">
            <MessageCircle size={16} className="text-white" />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-sm leading-tight">Global Chat</span>
            <span className="text-[10px] text-slate-400 leading-tight flex items-center gap-1">
              <Users size={10} />
              {isConnected ? `${onlineCount} online` : 'Connecting...'}
            </span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 hover:bg-slate-700/50 rounded-lg transition-colors text-slate-400 hover:text-white"
        >
          <X size={18} />
        </button>
      </div>

      {/* Messages */}
      <div
        ref={messagesContainerRef}
        onScroll={checkNearBottom}
        className="flex-1 overflow-y-auto px-3 py-2 space-y-1 custom-scrollbar"
      >
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-2">
            <MessageCircle size={32} className="opacity-30" />
            <p className="text-sm">No messages yet</p>
            <p className="text-xs text-slate-600">Be the first to say something!</p>
          </div>
        )}

        {messageGroups.map((group, gi) => {
          const isOwn = group.userId === currentUserId;
          const color = getUserColor(group.username);

          // System messages
          if (group.messages[0]?.type === 'system') {
            return (
              <div key={gi} className="flex justify-center py-1">
                <span className="text-[10px] text-slate-500 bg-slate-800/50 px-3 py-1 rounded-full">
                  {group.messages[0].content}
                </span>
              </div>
            );
          }

          // Emote messages
          if (group.messages[0]?.type === 'emote') {
            return group.messages.map((msg) => (
              <div key={msg.id} className="flex justify-center py-0.5">
                <span className="text-xs text-slate-400 italic">
                  <span style={{ color }} className="font-medium not-italic">
                    {msg.username}
                  </span>{' '}
                  {msg.content}
                </span>
              </div>
            ));
          }

          return (
            <div key={gi} className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} py-0.5`}>
              {/* Username + timestamp for first message in group */}
              <div className={`flex items-center gap-1.5 px-1 mb-0.5 ${isOwn ? 'flex-row-reverse' : ''}`}>
                <span className="text-[11px] font-semibold" style={{ color }}>
                  {isOwn ? 'You' : group.username}
                </span>
                <span className="text-[9px] text-slate-600">
                  {formatTime(group.messages[0].createdAt)}
                </span>
              </div>

              {/* Message bubbles */}
              {group.messages.map((msg, mi) => (
                <div
                  key={msg.id}
                  className={`max-w-[85%] px-3 py-1.5 text-[13px] leading-relaxed break-words ${
                    isOwn
                      ? 'bg-indigo-600/40 border border-indigo-500/30 text-indigo-50'
                      : 'bg-slate-800/70 border border-slate-700/40 text-slate-200'
                  } ${
                    mi === 0 && group.messages.length === 1
                      ? 'rounded-2xl'
                      : mi === 0
                      ? isOwn
                        ? 'rounded-2xl rounded-br-lg'
                        : 'rounded-2xl rounded-bl-lg'
                      : mi === group.messages.length - 1
                      ? isOwn
                        ? 'rounded-2xl rounded-tr-lg'
                        : 'rounded-2xl rounded-tl-lg'
                      : isOwn
                      ? 'rounded-2xl rounded-r-lg'
                      : 'rounded-2xl rounded-l-lg'
                  } mb-0.5`}
                >
                  {msg.content}
                </div>
              ))}
            </div>
          );
        })}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 px-3 py-2.5 border-t border-slate-700/50">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            maxLength={1000}
            className="flex-1 bg-slate-800/70 border border-slate-700/50 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 transition-colors"
          />
          <button
            onClick={handleSend}
            disabled={!inputValue.trim() || !isConnected}
            className="p-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-xl transition-colors shrink-0"
          >
            <Send size={16} />
          </button>
        </div>
        <div className="flex items-center justify-between mt-1.5 px-1">
          <span className="text-[9px] text-slate-600">
            Tip: use <kbd className="px-1 py-0.5 bg-slate-800 rounded text-[8px]">/me</kbd> for emotes
          </span>
          <span className="text-[9px] text-slate-600">
            {inputValue.length}/1000
          </span>
        </div>
      </div>
    </div>
  );
}
