import { Hero } from './hero/Hero';
import { Join, Footer } from './Join';
import { Manifesto } from './Manifesto';
import { Nav } from './Nav';
import { RouteMap } from './RouteMap';
import { Sunday } from './Sunday';
import { UpcomingRide } from './UpcomingRide';
import { useReveal } from '../hooks/motion';
import { PublicContentProvider, type PublicSnapshot } from '../lib/public-content';

export function PublicSite({ snapshot }: { snapshot?: PublicSnapshot }) {
  useReveal();
  return (
    <PublicContentProvider snapshot={snapshot}>
      <Nav />
      <main>
        <Hero />
        <Manifesto />
        <Sunday />
        <RouteMap />
        <UpcomingRide />
        <Join />
      </main>
      <Footer />
    </PublicContentProvider>
  );
}
