import { redirect } from 'next/navigation';
import { AuthenticationError, AuthorizationError, requireAdmin } from '@/lib/auth/current-user';
import { documents } from '@/lib/knowledge/rag/core';
import RagTestClient from './RagTestClient';
export default async function Page() {
  try { await requireAdmin(); } catch (error) {
    if (error instanceof AuthenticationError) redirect('/?auth=required');
    if (error instanceof AuthorizationError) redirect('/?auth=forbidden');
    throw error;
  }
  return <RagTestClient knowledgeCount={documents.length} />;
}
