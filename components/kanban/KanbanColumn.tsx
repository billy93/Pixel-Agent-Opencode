
'use client';

import { useState } from 'react';
import { KanbanColumn as IKanbanColumn, KanbanTask as IKanbanTask } from '@/types';
import KanbanTask from './KanbanTask';
import { Plus, MoreHorizontal } from 'lucide-react';
import { ProviderModel } from '@/lib/models/available-models';

interface KanbanColumnProps {
  column: IKanbanColumn;
  tasks: IKanbanTask[];
  onTaskDrop: (taskId: string, columnId: string) => void;
  onAddTask: (columnId: string) => void;
  onEditTask: (task: IKanbanTask) => void;
  onChat?: (task: IKanbanTask) => void;
  getModelById?: (id: string) => ProviderModel | undefined;
}

export default function KanbanColumn({ column, tasks, onTaskDrop, onAddTask, onEditTask, onChat, getModelById }: KanbanColumnProps) {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const taskId = e.dataTransfer.getData('taskId');
    if (taskId) {
      onTaskDrop(taskId, column.id);
    }
  };

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData('taskId', taskId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const getColumnColor = (type: string) => {
    switch (type) {
      case 'TODO': return 'border-t-slate-400';
      case 'IN_PROGRESS': return 'border-t-amber-400';
      case 'DONE': return 'border-t-emerald-400';
      default: return 'border-t-indigo-400';
    }
  };

  return (
    <div 
      className={`flex-1 min-w-[280px] bg-slate-800/50 rounded-xl border border-slate-700/50 flex flex-col h-full transition-colors ${isDragOver ? 'bg-slate-700/50 border-indigo-500/50' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Header */}
      <div className={`p-3 border-b border-slate-700/50 flex justify-between items-center border-t-2 rounded-t-xl ${getColumnColor(column.type)}`}>
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-slate-200 text-sm">{column.title}</h3>
          <span className="px-1.5 py-0.5 bg-slate-700 rounded-full text-[10px] text-slate-400 font-medium">
            {tasks.length}
          </span>
        </div>
        <div className="flex gap-1">
          <button 
            onClick={() => onAddTask(column.id)}
            className="p-1 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"
          >
            <Plus size={14} />
          </button>
          <button className="p-1 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors">
            <MoreHorizontal size={14} />
          </button>
        </div>
      </div>

      {/* Tasks Area */}
      <div className="flex-1 p-2 overflow-y-auto custom-scrollbar space-y-2">
        {tasks.map((task) => (
          <KanbanTask 
            key={task.id} 
            task={task} 
            onDragStart={handleDragStart} 
            onEdit={onEditTask}
            onChat={onChat}
            getModelById={getModelById}
          />
        ))}
        {tasks.length === 0 && (
          <div className="h-20 border-2 border-dashed border-slate-700/50 rounded-lg flex items-center justify-center text-slate-600 text-xs">
            Drop tasks here
          </div>
        )}
      </div>
    </div>
  );
}
