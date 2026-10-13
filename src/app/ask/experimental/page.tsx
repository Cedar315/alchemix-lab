import { notFound } from 'next/navigation';
import ExperimentalChat from './ExperimentalChat';

export const dynamic = 'force-dynamic';

export default function ExperimentalPage() {
  if (process.env.AGENT_EXPERIMENT_ENABLED !== 'true') notFound();
  return <ExperimentalChat />;
}
