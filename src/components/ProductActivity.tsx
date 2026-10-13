'use client';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { trackAnalyticsEvent } from '@/lib/analytics';
export default function ProductActivity(){
 const path=usePathname();
 useEffect(()=>{let source='direct_or_unknown';try{const ref=new URL(document.referrer);if(ref.host!==location.host)source=ref.hostname;}catch{}if(!path.startsWith('/admin'))trackAnalyticsEvent({eventName:'page_view',page:path==='/ask'?'finder':path.startsWith('/inspiration')?'inspiration':'lab',action:'view',source});},[path]);
 return null;
}
