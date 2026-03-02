
'use client';

import { useState } from 'react';
import { KanbanTask as IKanbanTask } from '@/types';
import { ProviderModel } from '@/lib/models/available-models';
import { Bot, GripVertical, Pencil, Cpu, Box, MessageSquare, Terminal } from 'lucide-react';

interface KanbanTaskProps {
  task: IKanbanTask;
  onDragStart: (e: React.DragEvent, taskId: string) => void;
  onEdit?: (task: IKanbanTask) => void;
  onChat?: (task: IKanbanTask) => void;
  getModelById?: (id: string) => ProviderModel | undefined;
}

export default function KanbanTask({ task, onDragStart, onEdit, onChat, getModelById }: KanbanTaskProps) {
  const [isHovered, setIsHovered] = useState(false);

  const agentModel = task.agent?.model && getModelById ? getModelById(task.agent.model) : undefined;
  // Fallback if model not found in list or getModelById not provided
  const providerName = agentModel ? agentModel.providerName : (task.agent?.model?.split('/')[0] || 'Unknown');
  const modelName = agentModel ? agentModel.name : (task.agent?.model?.split('/').pop() || 'Unknown');

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, task.id)}
      onClick={() => onEdit && onEdit(task)}
      className="bg-slate-700/50 hover:bg-slate-700 p-3 rounded-lg border border-slate-600/50 cursor-grab active:cursor-grabbing shadow-sm group transition-all relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex items-start gap-2">
        <div className="mt-1 text-slate-500">
          <GripVertical size={14} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm text-slate-200 font-medium break-words mb-1">
            {task.content}
          </div>
          {task.description && (
            <div className="text-xs text-slate-400 break-words line-clamp-2 mb-2">
              {task.description}
            </div>
          )}
          
          <div className="flex flex-col gap-2 mt-3">
            {task.agentId && (
              <div className="flex flex-col gap-1.5 bg-slate-800/40 p-2 rounded-md border border-slate-700/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-indigo-300">
                    <Bot size={12} />
                    <span className="text-xs font-medium">{task.agent?.name || 'Agent'}</span>
                  </div>
                  
                  {/* Chat Button for In Progress tasks */}
                  {onChat && task.column?.type === 'IN_PROGRESS' && (
                     <button 
                       onClick={(e) => {
                         e.stopPropagation();
                         onChat(task);
                       }}
                       className="p-1 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/20 rounded transition-colors"
                       title="Open Chat"
                     >
                       <MessageSquare size={12} />
                     </button>
                  )}
                </div>
                
                {task.agent?.model && (
                   <div className="flex flex-wrap gap-1.5">
                      <div className="flex items-center gap-1 bg-slate-900/40 px-1.5 py-0.5 rounded text-[10px] text-slate-400 border border-slate-700/30" title="Provider">
                        <Box size={10} />
                        <span className="truncate max-w-[80px]">{providerName}</span>
                      </div>
                      <div className="flex items-center gap-1 bg-slate-900/40 px-1.5 py-0.5 rounded text-[10px] text-slate-400 border border-slate-700/30" title="Model">
                        <Cpu size={10} />
                        <span className="truncate max-w-[100px]">{modelName}</span>
                      </div>
                   </div>
                )}
                
                {task.sessionId && (
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-mono mt-1 pt-1 border-t border-slate-700/30">
                    <Terminal size={10} />
                    <span className="truncate" title={task.sessionId}>
                      Session: {task.sessionId.substring(0, 8)}...
                    </span>
                  </div>
                )}
              </div>
            )}

            {onEdit && (
              <div className={`flex justify-end ${!task.agentId ? 'mt-2' : ''}`}>
                 <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(task);
                  }}
                  className={`flex items-center gap-1 px-2 py-1 text-xs text-slate-500 hover:text-slate-300 hover:bg-slate-600/50 rounded transition-all ${isHovered ? 'opacity-100' : 'opacity-0'}`}
                >
                  <Pencil size={10} />
                  <span>Edit</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
