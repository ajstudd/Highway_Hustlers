import { Hero } from './components/hero/Hero';
import { Join, Footer } from './components/Join';
import { Manifesto } from './components/Manifesto';
import { Nav } from './components/Nav';
import { RouteMap } from './components/RouteMap';
import { Sunday } from './components/Sunday';
import { useReveal } from './hooks/motion';
import { lazy, Suspense } from 'react';

const Admin = lazy(() => import('./admin/Admin'));

export function App() {
  if (/^\/admin(?:\/|$)/.test(window.location.pathname)) return <Suspense fallback={<main className="p-8" role="status">Loading dashboard…</main>}><Admin /></Suspense>;
  return <PublicSite />;
}

function PublicSite() {
  useReveal();
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <Manifesto />
        <Sunday />
        <RouteMap />
        <Join />
      </main>
      <Footer />
    </>
  );
}
