import { redirect } from 'next/navigation';
import { requireAdmin,AuthenticationError,AuthorizationError } from '@/lib/auth/current-user';
import AdminShell from './AdminShell';
import './console.css';
export default async function Layout({children}:{children:React.ReactNode}){
 try{await requireAdmin();}catch(e){if(e instanceof AuthenticationError)redirect('/?auth=required');if(e instanceof AuthorizationError)redirect('/?auth=forbidden');throw e;}
 return <AdminShell>{children}</AdminShell>;
}
