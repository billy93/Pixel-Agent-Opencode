'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { 
  X, Send, Bot, User, Terminal, FileCode, AlertTriangle, 
  CheckCircle, XCircle, Loader2, ChevronDown, FolderGit2,
  Maximize2, Minimize2, HelpCircle, MessageCircleQuestion,
  Edit3, Cpu, Command, Slash, Lightbulb, Hammer, Brain, ChevronRight,
  Zap
} from 'lucide-react';
import { ChatMessage, AgentStatus, QuestionOption, GameAgent } from '@/types';
import { OPENCODE_COMMANDS, searchCommands, SlashCommand, getCategoryLabel } from '@/lib/commands/opencode-commands';
import { useModels } from '@/lib/models/use-models';
import { ProviderModel, formatContextWindow } from '@/lib/models/available-models';

interface ChatPanelProps {
  agent: GameAgent;
  onClose: () => void;
  isMinimized?: boolean;
  onToggleMinimize?: () => void;
}

export default function ChatPanel({ agent, onClose, isMinimized, onToggleMinimize }: ChatPanelProps) {
  const { models, getModelById } = useModels();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [agentStatus, setAgentStatus] = useState<string>(agent.status);
  const [hasPermissionPending, setHasPermissionPending] = useState(false);
  const [hasQuestionPending, setHasQuestionPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string[]>>({});
  const [customInputs, setCustomInputs] = useState<Record<string, string>>({});
  const [showCustomInput, setShowCustomInput] = useState<Record<string, boolean>>({});
  const [expandedThinking, setExpandedThinking] = useState<Record<string, boolean>>({});
  const [showCommands, setShowCommands] = useState(false);
  const [showModelSelector, setShowModelSelector] = useState(false);
  const [selectedCommandIndex, setSelectedCommandIndex] = useState(0);
  const [currentModel, setCurrentModel] = useState<string>((agent as any).model || 'anthropic/claude-sonnet-4-20250514');
  const [agentMode, setAgentMode] = useState<'plan' | 'build'>('plan'); // Default to plan mode
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const commandsRef = useRef<HTMLDivElement>(null);

  // Sync model when agent prop changes
  useEffect(() => {
    const agentModel = (agent as any).model;
    if (agentModel && agentModel !== currentModel) {
      setCurrentModel(agentModel);
    }
  }, [(agent as any).model]);

  // Filter commands based on input
  const filteredCommands = useMemo(() => {
    if (!inputValue.startsWith('/')) return [];
    const query = inputValue.slice(1);
    if (query === '') return OPENCODE_COMMANDS;
    return searchCommands(query);
  }, [inputValue]);

  // Scroll to bottom when messages change
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Show/hide commands dropdown based on input
  useEffect(() => {
    if (inputValue.startsWith('/')) {
      setShowCommands(true);
      setSelectedCommandIndex(0);
    } else {
      setShowCommands(false);
    }
  }, [inputValue]);

  // Handle clicking outside commands dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (commandsRef.current && !commandsRef.current.contains(e.target as Node)) {
        setShowCommands(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Select command from dropdown
  const selectCommand = (command: SlashCommand) => {
    setInputValue(command.name + ' ');
    setShowCommands(false);
    inputRef.current?.focus();
  };

  // Handle model change
  const handleModelChange = async (modelId: string) => {
    try {
      const response = await fetch(`/api/agents/${agent.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: modelId }),
      });
      if (response.ok) {
        setCurrentModel(modelId);
        setShowModelSelector(false);
      }
    } catch (err) {
      console.error('Failed to change model:', err);
    }
  };

  // Fetch chat messages
  const fetchMessages = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/agents/${agent.id}/chat`);
      if (response.ok) {
        const data = await response.json();
        setMessages(data.messages || []);
        setAgentStatus(data.agentStatus || 'IDLE');
        setHasPermissionPending(data.hasPermissionPending || false);
        setHasQuestionPending(data.hasQuestionPending || false);
        setError(null);
        
        // Sync model from agent data if available
        if (data.agentModel) {
          setCurrentModel(data.agentModel);
        }
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to fetch messages');
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setIsLoading(false);
    }
  }, [agent.id]);

  // Initial fetch and polling
  useEffect(() => {
    fetchMessages();
    
    // Use faster polling (1s) when agent is actively working for streaming-like updates
    // Use normal polling (3s) when waiting for permissions/questions
    const isActive = agentStatus === 'TYPING' || agentStatus === 'RUNNING' || agentStatus === 'SPAWNING';
    const pollMs = isActive ? 1000 : 3000;
    
    const pollInterval = setInterval(() => {
      if (agentStatus !== 'IDLE' || hasPermissionPending || hasQuestionPending) {
        fetchMessages();
      }
    }, pollMs);

    return () => clearInterval(pollInterval);
  }, [fetchMessages, agentStatus, hasPermissionPending, hasQuestionPending]);

  // Send message
  const handleSendMessage = async () => {
    if (!inputValue.trim() || isSending) return;

    const messageText = inputValue.trim();
    setInputValue('');
    setIsSending(true);
    setError(null);

    // Optimistically add user message
    const tempUserMessage: ChatMessage = {
      id: `temp-${Date.now()}`,
      role: 'user',
      type: 'text',
      content: messageText,
      timestamp: Date.now(),
    };
    setMessages(prev => [...prev, tempUserMessage]);

    try {
      const response = await fetch(`/api/agents/${agent.id}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: messageText, mode: agentMode }),
      });

      if (response.ok) {
        const data = await response.json();
        setAgentStatus(data.status || 'RUNNING');
        // Fetch updated messages after sending
        await fetchMessages();
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to send message');
        // Remove optimistic message on error
        setMessages(prev => prev.filter(m => m.id !== tempUserMessage.id));
      }
    } catch (err) {
      setError('Network error');
      setMessages(prev => prev.filter(m => m.id !== tempUserMessage.id));
    } finally {
      setIsSending(false);
    }
  };

  // Handle permission response
  const handlePermissionResponse = async (permissionId: string, approved: boolean) => {
    try {
      const response = await fetch(`/api/agents/${agent.id}/permission`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permissionId, approved }),
      });

      if (response.ok) {
        await fetchMessages();
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to respond to permission');
      }
    } catch (err) {
      setError('Network error');
    }
  };

  // Handle question option selection
  const handleOptionSelect = (questionId: string, option: string, multiple: boolean) => {
    setSelectedOptions(prev => {
      const current = prev[questionId] || [];
      if (multiple) {
        // Toggle selection for multiple choice
        if (current.includes(option)) {
          return { ...prev, [questionId]: current.filter(o => o !== option) };
        } else {
          return { ...prev, [questionId]: [...current, option] };
        }
      } else {
        // Single selection
        return { ...prev, [questionId]: [option] };
      }
    });
    // Hide custom input when selecting an option
    setShowCustomInput(prev => ({ ...prev, [questionId]: false }));
  };

  // Handle question response
  const handleQuestionResponse = async (requestId: string, questionId: string, reject: boolean = false) => {
    try {
      let answers: string[][] = [];
      
      if (!reject) {
        const selected = selectedOptions[questionId] || [];
        const customText = customInputs[questionId];
        
        // If custom input is shown and has text, use that
        if (showCustomInput[questionId] && customText?.trim()) {
          answers = [[customText.trim()]];
        } else if (selected.length > 0) {
          answers = [selected];
        } else {
          setError('Please select an option or type a custom answer');
          return;
        }
      }

      const response = await fetch(`/api/agents/${agent.id}/question`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          requestId, 
          answers: reject ? undefined : answers,
          reject 
        }),
      });

      if (response.ok) {
        // Clear selection state for this question
        setSelectedOptions(prev => {
          const next = { ...prev };
          delete next[questionId];
          return next;
        });
        setCustomInputs(prev => {
          const next = { ...prev };
          delete next[questionId];
          return next;
        });
        setShowCustomInput(prev => {
          const next = { ...prev };
          delete next[questionId];
          return next;
        });
        await fetchMessages();
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to respond to question');
      }
    } catch (err) {
      setError('Network error');
    }
  };

  // Handle key press
  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Command navigation when dropdown is open
    if (showCommands && filteredCommands.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedCommandIndex(prev => 
          prev < filteredCommands.length - 1 ? prev + 1 : 0
        );
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedCommandIndex(prev => 
          prev > 0 ? prev - 1 : filteredCommands.length - 1
        );
        return;
      }
      if (e.key === 'Tab' || (e.key === 'Enter' && filteredCommands.length > 0)) {
        e.preventDefault();
        selectCommand(filteredCommands[selectedCommandIndex]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowCommands(false);
        return;
      }
    }
    
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Get status badge color
  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      IDLE: 'bg-slate-500',
      SPAWNING: 'bg-amber-500',
      TYPING: 'bg-blue-500 animate-pulse',
      READING: 'bg-emerald-500',
      RUNNING: 'bg-violet-500 animate-pulse',
      WAITING: 'bg-orange-500',
      PERMISSION: 'bg-red-500 animate-pulse',
      ERROR: 'bg-red-600',
    };
    return colors[status] || 'bg-slate-500';
  };

  // Render message content based on type
  const renderMessageContent = (message: ChatMessage) => {
    switch (message.type) {
      case 'thinking':
        const isExpanded = expandedThinking[message.id] || false;
        const thinkingContent = message.content || '';
        const previewLength = 120;
        const needsTruncation = thinkingContent.length > previewLength;
        const previewText = needsTruncation 
          ? thinkingContent.substring(0, previewLength) + '...'
          : thinkingContent;

        return (
          <div className="w-full">
            <button
              onClick={() => setExpandedThinking(prev => ({ ...prev, [message.id]: !isExpanded }))}
              className="w-full text-left group"
            >
              <div className="flex items-center gap-2 text-xs text-purple-400 mb-1">
                <Brain size={12} className="shrink-0" />
                <span className="font-medium">Thinking</span>
                {needsTruncation && (
                  <ChevronRight 
                    size={12} 
                    className={`shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} 
                  />
                )}
              </div>
            </button>
            <div 
              className={`text-xs text-purple-300/70 whitespace-pre-wrap break-words italic transition-all duration-200 ${
                isExpanded ? 'max-h-[400px] overflow-y-auto custom-scrollbar' : 'max-h-16 overflow-hidden'
              }`}
            >
              {isExpanded ? thinkingContent : previewText}
            </div>
            {needsTruncation && !isExpanded && (
              <div className="h-4 bg-gradient-to-t from-slate-700/50 to-transparent -mt-4 relative pointer-events-none rounded-b-lg" />
            )}
          </div>
        );

      case 'step':
        return (
          <div className="flex items-center gap-2 text-xs text-cyan-400/70 py-0.5">
            <Zap size={10} className="shrink-0" />
            <span className="font-mono">{message.content}</span>
          </div>
        );

      case 'tool_call':
        return (
          <div className="bg-slate-700/50 rounded-lg p-3 border border-slate-600/50">
            <div className="flex items-center gap-2 text-xs text-slate-400 mb-2">
              <Terminal size={12} />
              <span className="font-medium">{message.metadata?.toolName || 'Tool'}</span>
            </div>
            <pre className="text-xs text-slate-300 overflow-x-auto whitespace-pre-wrap">
              {JSON.stringify(message.metadata?.toolInput, null, 2)}
            </pre>
          </div>
        );
      
      case 'tool_result':
        return (
          <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-600/30">
            <div className="flex items-center gap-2 text-xs text-emerald-400 mb-2">
              <FileCode size={12} />
              <span className="font-medium">Result</span>
            </div>
            <pre className="text-xs text-slate-400 overflow-x-auto whitespace-pre-wrap max-h-40 overflow-y-auto custom-scrollbar">
              {message.content}
            </pre>
          </div>
        );
      
      case 'permission_request':
        return (
          <div className="bg-amber-500/10 rounded-lg p-4 border border-amber-500/30">
            <div className="flex items-center gap-2 text-amber-400 mb-3">
              <AlertTriangle size={16} />
              <span className="font-semibold text-sm">Permission Required</span>
            </div>
            <p className="text-sm text-slate-300 mb-4">{message.content}</p>
            {message.metadata?.permissionStatus === 'pending' && (
              <div className="flex gap-2">
                <button
                  onClick={() => handlePermissionResponse(message.id.replace('permission-', ''), true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-medium rounded-lg transition-colors"
                >
                  <CheckCircle size={14} />
                  Approve
                </button>
                <button
                  onClick={() => handlePermissionResponse(message.id.replace('permission-', ''), false)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-medium rounded-lg transition-colors"
                >
                  <XCircle size={14} />
                  Deny
                </button>
              </div>
            )}
          </div>
        );

      case 'question':
        const questionId = message.id;
        const requestId = message.metadata?.questionRequestId || '';
        const options = message.metadata?.questionOptions || [];
        const multiple = message.metadata?.questionMultiple || false;
        const allowCustom = message.metadata?.questionCustom !== false;
        const header = message.metadata?.questionHeader || 'Question';
        const isAnswered = message.metadata?.questionAnswered || false;
        const currentSelected = selectedOptions[questionId] || [];
        const isCustomInputShown = showCustomInput[questionId] || false;

        return (
          <div className="bg-indigo-500/10 rounded-lg p-4 border border-indigo-500/30 w-full">
            <div className="flex items-center gap-2 text-indigo-400 mb-3">
              <MessageCircleQuestion size={16} />
              <span className="font-semibold text-sm">{header}</span>
            </div>
            <p className="text-sm text-slate-200 mb-4">{message.content}</p>
            
            {!isAnswered && (
              <>
                {/* Options */}
                <div className="space-y-2 mb-4">
                  {options.map((opt: QuestionOption, idx: number) => {
                    const isSelected = currentSelected.includes(opt.label);
                    return (
                      <button
                        key={idx}
                        onClick={() => handleOptionSelect(questionId, opt.label, multiple)}
                        className={`w-full text-left p-3 rounded-lg border transition-all ${
                          isSelected
                            ? 'bg-indigo-500/30 border-indigo-500/50 text-white'
                            : 'bg-slate-700/30 border-slate-600/30 text-slate-300 hover:bg-slate-700/50 hover:border-slate-500/50'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`w-5 h-5 rounded-${multiple ? 'md' : 'full'} border-2 flex items-center justify-center shrink-0 mt-0.5 ${
                            isSelected 
                              ? 'border-indigo-400 bg-indigo-500' 
                              : 'border-slate-500'
                          }`}>
                            {isSelected && <CheckCircle size={12} className="text-white" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm">{opt.label}</div>
                            {opt.description && (
                              <div className="text-xs text-slate-400 mt-0.5">{opt.description}</div>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Custom Input Option */}
                {allowCustom && (
                  <div className="mb-4">
                    {!isCustomInputShown ? (
                      <button
                        onClick={() => {
                          setShowCustomInput(prev => ({ ...prev, [questionId]: true }));
                          setSelectedOptions(prev => ({ ...prev, [questionId]: [] }));
                        }}
                        className="flex items-center gap-2 text-xs text-slate-400 hover:text-indigo-400 transition-colors"
                      >
                        <Edit3 size={12} />
                        <span>Type your own answer</span>
                      </button>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-xs text-indigo-400">
                          <Edit3 size={12} />
                          <span>Custom answer:</span>
                        </div>
                        <textarea
                          value={customInputs[questionId] || ''}
                          onChange={(e) => setCustomInputs(prev => ({ ...prev, [questionId]: e.target.value }))}
                          placeholder="Type your answer..."
                          className="w-full px-3 py-2 bg-slate-700/50 text-white rounded-lg border border-slate-600/50 focus:outline-none focus:border-indigo-500 text-sm resize-none placeholder:text-slate-500"
                          rows={2}
                        />
                        <button
                          onClick={() => {
                            setShowCustomInput(prev => ({ ...prev, [questionId]: false }));
                            setCustomInputs(prev => ({ ...prev, [questionId]: '' }));
                          }}
                          className="text-xs text-slate-500 hover:text-slate-300"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Submit / Reject Buttons */}
                <div className="flex gap-2">
                  <button
                    onClick={() => handleQuestionResponse(requestId, questionId, false)}
                    disabled={currentSelected.length === 0 && !(isCustomInputShown && customInputs[questionId]?.trim())}
                    className="flex items-center gap-1.5 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 disabled:bg-slate-600 disabled:cursor-not-allowed text-white text-xs font-medium rounded-lg transition-colors"
                  >
                    <CheckCircle size={14} />
                    Submit
                  </button>
                  <button
                    onClick={() => handleQuestionResponse(requestId, questionId, true)}
                    className="flex items-center gap-1.5 px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white text-xs font-medium rounded-lg transition-colors"
                  >
                    <XCircle size={14} />
                    Skip
                  </button>
                </div>
              </>
            )}

            {isAnswered && message.metadata?.questionAnswers && (
              <div className="text-sm text-slate-400 italic">
                Answered: {message.metadata.questionAnswers.join(', ')}
              </div>
            )}
          </div>
        );
      
      default:
        return (
          <div className="text-sm text-slate-200 whitespace-pre-wrap break-words">
            {message.content}
          </div>
        );
    }
  };

  if (isMinimized) {
    return (
      <div 
        className="bg-slate-800/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-600/40 p-3 cursor-pointer hover:bg-slate-700/95 transition-colors"
        onClick={onToggleMinimize}
      >
        <div className="flex items-center gap-3">
          <div 
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: `${agent.workspace?.color || '#6366f1'}30` }}
          >
            <Bot size={16} style={{ color: agent.workspace?.color || '#6366f1' }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm text-white truncate">{agent.name}</div>
            <div className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${getStatusColor(agentStatus)}`} />
              <span className="text-[10px] text-slate-400">{agentStatus}</span>
            </div>
          </div>
          <Maximize2 size={14} className="text-slate-400" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-800/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-600/40 w-[420px] h-[600px] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-700/50 bg-slate-800/50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div 
            className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg"
            style={{ 
              backgroundColor: `${agent.workspace?.color || '#6366f1'}20`,
              border: `2px solid ${agent.workspace?.color || '#6366f1'}40`
            }}
          >
            <Bot size={20} style={{ color: agent.workspace?.color || '#6366f1' }} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-sm text-white">{agent.name}</h3>
              <span className={`w-2 h-2 rounded-full ${getStatusColor(agentStatus)}`} />
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
              <FolderGit2 size={10} />
              <span className="truncate max-w-[150px]">
                {agent.workspace?.name || 'No workspace'}
              </span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-1">
          {onToggleMinimize && (
            <button
              onClick={onToggleMinimize}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-lg transition-colors"
            >
              <Minimize2 size={16} />
            </button>
          )}
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-lg transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        {isLoading && messages.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <div className="flex items-center gap-2 text-slate-400">
              <Loader2 size={20} className="animate-spin" />
              <span className="text-sm">Loading messages...</span>
            </div>
          </div>
        )}

        {!isLoading && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center px-6">
            <div className="w-16 h-16 rounded-2xl bg-slate-700/50 flex items-center justify-center mb-4">
              <Bot size={32} className="text-slate-500" />
            </div>
            <p className="text-sm text-slate-400 font-medium mb-1">Start a conversation</p>
            <p className="text-xs text-slate-500">Send a message or task to this agent</p>
          </div>
        )}

        {messages.map((message) => {
          // Step indicators render as compact inline elements without avatar/bubble
          if (message.type === 'step') {
            return (
              <div key={message.id} className="flex items-center gap-2 pl-11 -my-1">
                {renderMessageContent(message)}
              </div>
            );
          }

          return (
          <div
            key={message.id}
            className={`flex gap-3 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
          >
            {/* Avatar */}
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
              message.role === 'user' 
                ? 'bg-indigo-500/20' 
                : message.role === 'system'
                  ? 'bg-amber-500/20'
                  : message.type === 'thinking'
                    ? 'bg-purple-500/20'
                    : 'bg-slate-700'
            }`}>
              {message.role === 'user' ? (
                <User size={14} className="text-indigo-400" />
              ) : message.role === 'system' ? (
                <AlertTriangle size={14} className="text-amber-400" />
              ) : message.type === 'thinking' ? (
                <Brain size={14} className="text-purple-400" />
              ) : (
                <Bot size={14} style={{ color: agent.workspace?.color || '#6366f1' }} />
              )}
            </div>

            {/* Message Content */}
            <div className={`flex-1 max-w-[85%] ${message.role === 'user' ? 'text-right' : ''}`}>
              <div className={`inline-block text-left rounded-2xl px-4 py-3 ${
                message.role === 'user'
                  ? 'bg-indigo-500/20 border border-indigo-500/30'
                  : message.role === 'system'
                    ? 'bg-transparent'
                    : message.type === 'thinking'
                      ? 'bg-purple-500/10 border border-purple-500/20'
                      : 'bg-slate-700/50 border border-slate-600/30'
              }`}>
                {renderMessageContent(message)}
              </div>
              <div className="text-[10px] text-slate-500 mt-1 px-1">
                {new Date(message.timestamp).toLocaleTimeString()}
              </div>
            </div>
          </div>
          );
        })}

        {/* Typing indicator */}
        {(agentStatus === 'TYPING' || agentStatus === 'RUNNING') && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-lg bg-slate-700 flex items-center justify-center">
              <Bot size={14} style={{ color: agent.workspace?.color || '#6366f1' }} />
            </div>
            <div className="bg-slate-700/50 rounded-2xl px-4 py-3 border border-slate-600/30">
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Error Message */}
      {error && (
        <div className="px-4 py-2 bg-red-500/10 border-t border-red-500/30">
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}

      {/* Input Area */}
      <div className="p-4 border-t border-slate-700/50 bg-slate-800/30">
        {/* Mode Toggle & Model Selector Bar */}
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="flex items-center gap-2">
            {/* Plan/Build Mode Toggle */}
            <div className="flex bg-slate-700/50 rounded-lg p-0.5 border border-slate-600/30">
              <button
                onClick={() => setAgentMode('plan')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                  agentMode === 'plan'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    : 'text-slate-400 hover:text-slate-300'
                }`}
                title="Plan mode: Agent will research and plan without making changes"
              >
                <Lightbulb size={12} />
                <span>Plan</span>
              </button>
              <button
                onClick={() => setAgentMode('build')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                  agentMode === 'build'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'text-slate-400 hover:text-slate-300'
                }`}
                title="Build mode: Agent will implement changes to the codebase"
              >
                <Hammer size={12} />
                <span>Build</span>
              </button>
            </div>
            <button
              onClick={() => setShowModelSelector(!showModelSelector)}
              className="flex items-center gap-1.5 px-2 py-1 bg-slate-700/50 hover:bg-slate-600/50 rounded-lg text-xs text-slate-300 transition-colors border border-slate-600/30"
            >
              <Cpu size={12} className="text-purple-400" />
              <span className="max-w-[100px] truncate">{getModelById(currentModel)?.name || 'Model'}</span>
              <ChevronDown size={12} className={`transition-transform ${showModelSelector ? 'rotate-180' : ''}`} />
            </button>
            <button
              onClick={() => setInputValue('/')}
              className="flex items-center gap-1 px-2 py-1 bg-slate-700/50 hover:bg-slate-600/50 rounded-lg text-xs text-slate-400 transition-colors border border-slate-600/30"
              title="Show commands"
            >
              <Slash size={12} />
            </button>
          </div>
          <div className="text-[10px] text-slate-500">
            {agentStatus !== 'IDLE' && (
              <span className="flex items-center gap-1">
                <span className={`w-1.5 h-1.5 rounded-full ${getStatusColor(agentStatus)}`} />
                {agentStatus}
              </span>
            )}
          </div>
        </div>

        {/* Model Selector Dropdown */}
        {showModelSelector && (
          <div className="mb-3 bg-slate-800 border border-slate-600/50 rounded-xl p-2 max-h-[200px] overflow-y-auto custom-scrollbar">
            {models.map((model: ProviderModel) => (
              <button
                key={model.id}
                onClick={() => handleModelChange(model.id)}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors flex items-center justify-between ${
                  currentModel === model.id 
                    ? 'bg-indigo-500/20 text-indigo-300' 
                    : 'hover:bg-slate-700/50 text-slate-300'
                }`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{model.name}</span>
                    <span className="text-[10px] text-slate-500">{model.providerName}</span>
                    {model.capabilities.reasoning && (
                      <span className="px-1.5 py-0.5 bg-purple-500/20 text-purple-400 rounded text-[9px]">Reasoning</span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Context: {formatContextWindow(model.contextWindow)}</div>
                </div>
                {currentModel === model.id && <CheckCircle size={14} className="text-indigo-400" />}
              </button>
            ))}
          </div>
        )}

        {/* Commands Dropdown */}
        {showCommands && filteredCommands.length > 0 && (
          <div 
            ref={commandsRef}
            className="mb-3 bg-slate-800 border border-slate-600/50 rounded-xl p-2 max-h-[250px] overflow-y-auto custom-scrollbar"
          >
            {filteredCommands.map((cmd, index) => (
              <button
                key={cmd.name}
                onClick={() => selectCommand(cmd)}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors ${
                  index === selectedCommandIndex 
                    ? 'bg-indigo-500/20 text-indigo-300' 
                    : 'hover:bg-slate-700/50 text-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-medium text-indigo-400">{cmd.name}</span>
                    <span className="text-slate-400">{cmd.description}</span>
                  </div>
                  <span className="text-[10px] text-slate-500 bg-slate-700/50 px-1.5 py-0.5 rounded">
                    {getCategoryLabel(cmd.category)}
                  </span>
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5 font-mono">{cmd.usage}</div>
              </button>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message, task, or / for commands..."
              className="w-full px-4 py-3 bg-slate-700/50 text-white rounded-xl border border-slate-600/50 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-sm resize-none placeholder:text-slate-500"
              rows={1}
              disabled={isSending}
            />
          </div>
          <button
            onClick={handleSendMessage}
            disabled={!inputValue.trim() || isSending}
            className="px-4 py-3 bg-indigo-500 hover:bg-indigo-600 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-xl transition-colors flex items-center justify-center"
          >
            {isSending ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Send size={18} />
            )}
          </button>
        </div>
        <p className="text-[10px] text-slate-500 mt-2 text-center">
          Enter to send, Shift+Enter for new line, / for commands, Tab to autocomplete
        </p>
      </div>
    </div>
  );
}
