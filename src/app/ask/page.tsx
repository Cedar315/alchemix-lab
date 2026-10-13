import LegacyAskPage from '@/components/assistant/LegacyAskPage';
import StreamingAskPage from '@/components/assistant/StreamingAskPage';
export const dynamic = 'force-dynamic';
export default function AskPage() {
  return process.env.ASSISTANT_RUNTIME === 'legacy' ? <LegacyAskPage /> : <StreamingAskPage />;
}
