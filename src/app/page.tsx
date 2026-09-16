import { Suspense } from 'react';
import App from '@/App';

export default function Home() {
  return <Suspense fallback={<div className="min-h-screen bg-[#f6f5f1]" />}><App /></Suspense>;
}
