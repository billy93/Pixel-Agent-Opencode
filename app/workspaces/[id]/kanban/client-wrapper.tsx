'use client';

import { useRouter } from 'next/navigation';
import KanbanBoard from '@/components/kanban/KanbanBoard';

interface ClientKanbanWrapperProps {
  workspace: {
    id: string;
    name: string;
  };
}

export function ClientKanbanWrapper({ workspace }: ClientKanbanWrapperProps) {
  const router = useRouter();

  return (
    <div className="h-screen w-screen bg-slate-900 overflow-hidden">
      <KanbanBoard
        workspaceId={workspace.id}
        workspaceName={workspace.name}
        onClose={() => router.back()}
      />
    </div>
  );
}
