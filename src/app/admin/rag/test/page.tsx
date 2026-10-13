import { documents } from '@/lib/knowledge/rag/core';
import RagTestClient from '../RagTestClient';
export default function Page(){return <RagTestClient knowledgeCount={documents.length}/>;}
