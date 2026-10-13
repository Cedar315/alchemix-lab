import { notFound } from 'next/navigation';
import AdminConsoleClient from '../AdminConsoleClient';
export default async function Page({params}:{params:Promise<{section:string}>}){const {section}=await params;if(!['users','agent','evaluations','operations','content'].includes(section))notFound();return <AdminConsoleClient section={section}/>;}
