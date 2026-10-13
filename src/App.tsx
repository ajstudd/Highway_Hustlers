import { Hero } from './components/hero/Hero';
import { Join, Footer } from './components/Join';
import { Manifesto } from './components/Manifesto';
import { Nav } from './components/Nav';
import { RouteMap } from './components/RouteMap';
import { Sunday } from './components/Sunday';
import { useReveal } from './hooks/motion';

export function App() {
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
