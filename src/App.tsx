import { lazy, Suspense } from 'react';
import { LoadingStatus } from './components/Loading';
import { PublicSite } from './components/PublicSite';

const Admin = lazy(() => import('./admin/Admin'));
const Member = lazy(() => import('./member/Member'));

export function App() {
  if (/^\/member\/?$/.test(window.location.pathname)) return <Suspense fallback={<main className="p-8"><LoadingStatus label="Opening your HHR profile…"/></main>}><Member /></Suspense>;
  if (/^\/admin(?:\/|$)/.test(window.location.pathname)) return <Suspense fallback={<main className="p-8"><LoadingStatus label="Loading dashboard…"/></main>}><Admin /></Suspense>;
  return <PublicSite />;
}
