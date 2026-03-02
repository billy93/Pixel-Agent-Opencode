import { prisma } from '@/lib/db/prisma';
import { redirect } from 'next/navigation';
import { ClientKanbanWrapper } from './client-wrapper';

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function KanbanPage({ params }: PageProps) {
  const { id } = await params;
  const workspace = await prisma.workspace.findUnique({
    where: { id },
  });

  if (!workspace) {
    redirect('/');
  }

  return <ClientKanbanWrapper workspace={workspace} />;
}
