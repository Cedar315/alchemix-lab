import { redirect } from 'next/navigation';
import { requireAdmin,AuthenticationError,AuthorizationError } from '@/lib/auth/current-user';
import ReviewClient from './ReviewClient';
export default async function Page() {
  try {await requireAdmin();}catch(e){if(e instanceof AuthenticationError)redirect('/?auth=required');if(e instanceof AuthorizationError)redirect('/?auth=forbidden');throw e;}
  return <ReviewClient/>;
}
