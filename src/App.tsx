import React, { useEffect, useRef, useState } from 'react';
import { BIKES, RIDES, CULTURE_POINTS, type BikeId, type Ride } from './data/bikes-and-rides';
import { BikeScene } from './components/three/BikeScene';

/* ─────────────────────────────────────────────────────────────
   INTERSECTION OBSERVER HOOK for reveal animations
──────────────────────────────────────────────────────────────*/
function useReveal() {
  useEffect(() => {
    const els = document.querySelectorAll('.reveal');
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('visible');
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
}

/* ─────────────────────────────────────────────────────────────
   RIDE TYPE BADGE
──────────────────────────────────────────────────────────────*/
const rideTypeMeta: Record<Ride['type'], { label: string; color: string }> = {
  ghat: { label: 'Ghat Ride', color: '#4e7250' },
  highway: { label: 'Highway', color: '#c8962a' },
  social: { label: 'Social Ride', color: '#c8604a' },
  offbeat: { label: 'Offbeat', color: '#9e8a62' },
};

/* ─────────────────────────────────────────────────────────────
   NAV
──────────────────────────────────────────────────────────────*/
function Nav({ onJoinClick }: { onJoinClick: () => void }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);

  return (
    <header
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        transition: 'all 0.35s ease',
        borderBottom: scrolled ? '1px solid rgba(255,255,255,0.07)' : '1px solid transparent',
        background: scrolled ? 'rgba(13,13,10,0.88)' : 'transparent',
        backdropFilter: scrolled ? 'blur(14px)' : 'none',
        padding: '0 max(24px, env(safe-area-inset-right))',
      }}
    >
      <div
        style={{
          maxWidth: 1160,
          margin: '0 auto',
          height: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        {/* Wordmark */}
        <a href="#" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <span
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              border: '1.5px solid rgba(200,150,42,0.7)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: "'Space Mono', monospace",
              fontSize: 10,
              letterSpacing: '0.06em',
              color: '#c8962a',
            }}
          >
            HH
          </span>
          <span
            style={{
              fontFamily: "'Playfair Display', Georgia, serif",
              fontWeight: 700,
              fontSize: 18,
              color: '#f0e8d6',
              letterSpacing: '0.02em',
            }}
          >
            Highway Hustlers
          </span>
        </a>

        {/* Links */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
          {[['#rides', 'Rides'], ['#bikes', 'The Bikes'], ['#culture', 'Our Vibe']].map(([href, label]) => (
            <a
              key={href}
              href={href}
              style={{
                fontFamily: "'Inter', sans-serif",
                fontWeight: 400,
                fontSize: 13,
                color: 'rgba(240,232,214,0.65)',
                textDecoration: 'none',
                letterSpacing: '0.02em',
                transition: 'color 0.2s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#f0e8d6')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(240,232,214,0.65)')}
              className="hidden-sm"
            >
              {label}
            </a>
          ))}
          <button className="btn-primary" onClick={onJoinClick} style={{ padding: '8px 18px', fontSize: 10 }}>
            Join Us
          </button>
        </nav>
      </div>
    </header>
  );
}

/* ─────────────────────────────────────────────────────────────
   HERO SECTION
──────────────────────────────────────────────────────────────*/
function HeroSection({ onJoinClick }: { onJoinClick: () => void }) {
  return (
    <section
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '120px 24px 80px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Subtle radial gradient background */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse 80% 60% at 50% 40%, rgba(61,90,62,0.14) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />
      {/* Bottom vignette */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 200,
          background: 'linear-gradient(to top, #0d0d0a, transparent)',
          pointerEvents: 'none',
        }}
      />

      <div style={{ position: 'relative', maxWidth: 780, zIndex: 1 }}>
        <div className="pill" style={{ marginBottom: 28 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#c8604a', display: 'inline-block' }} />
          Bhopal, Madhya Pradesh
        </div>

        <h1
          style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontWeight: 700,
            fontSize: 'clamp(48px, 8vw, 96px)',
            lineHeight: 1.06,
            color: '#f0e8d6',
            letterSpacing: '-0.02em',
            marginBottom: 28,
          }}
        >
          We Don't Just Ride.{' '}
          <em style={{ fontStyle: 'italic', color: '#c8604a' }}>We Live It.</em>
        </h1>

        <p
          style={{
            fontFamily: "'Inter', sans-serif",
            fontWeight: 300,
            fontSize: 'clamp(15px, 2.2vw, 18px)',
            color: 'rgba(184,170,144,0.85)',
            lineHeight: 1.75,
            maxWidth: 560,
            margin: '0 auto 44px',
          }}
        >
          A collective of riders from Bhopal who find freedom on every road —
          from the Vindhyas to the Satpuras. No ranks, no egos. Just good rides and better company.
        </p>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button className="btn-primary" onClick={onJoinClick}>
            Join the Pack
          </button>
          <a href="#rides" className="btn-ghost">
            See upcoming rides
          </a>
        </div>

        {/* Stats strip */}
        <div
          style={{
            marginTop: 72,
            display: 'flex',
            gap: 48,
            justifyContent: 'center',
            flexWrap: 'wrap',
            borderTop: '1px solid rgba(255,255,255,0.07)',
            paddingTop: 32,
          }}
        >
          {[
            { n: '40+', label: 'Riders' },
            { n: '3 yrs', label: 'on the road' },
            { n: '120+', label: 'Rides done' },
            { n: 'Bhopal', label: 'Home base' },
          ].map(({ n, label }) => (
            <div key={label} style={{ textAlign: 'center' }}>
              <div
                style={{
                  fontFamily: "'Playfair Display', serif",
                  fontWeight: 700,
                  fontSize: 'clamp(26px, 4vw, 36px)',
                  color: '#f0e8d6',
                  lineHeight: 1.1,
                }}
              >
                {n}
              </div>
              <div style={{ fontFamily: "'Space Mono'", fontSize: 10, letterSpacing: '0.1em', color: '#6b5e48', textTransform: 'uppercase', marginTop: 4 }}>
                {label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────
   RIDES SECTION
──────────────────────────────────────────────────────────────*/
function RidesSection() {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <section id="rides" style={{ padding: '96px 24px', maxWidth: 1160, margin: '0 auto' }}>
      <div className="reveal" style={{ marginBottom: 56 }}>
        <div className="pill" style={{ marginBottom: 16 }}>Upcoming</div>
        <h2
          style={{
            fontFamily: "'Playfair Display', serif",
            fontWeight: 700,
            fontSize: 'clamp(32px, 5vw, 52px)',
            color: '#f0e8d6',
            lineHeight: 1.14,
            maxWidth: 480,
          }}
        >
          Where We're Headed Next
        </h2>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(310px, 1fr))',
          gap: 20,
        }}
      >
        {RIDES.map((ride, idx) => {
          const meta = rideTypeMeta[ride.type];
          const isOpen = selected === ride.id;
          const spotsRatio = ride.spotsLeft / ride.totalSpots;

          return (
            <div
              key={ride.id}
              className="reveal"
              style={{
                transitionDelay: `${idx * 0.1}s`,
                background: '#14120e',
                border: `1px solid ${isOpen ? 'rgba(200,150,42,0.35)' : 'rgba(255,255,255,0.07)'}`,
                borderRadius: 12,
                overflow: 'hidden',
                transition: 'border-color 0.3s',
              }}
            >
              {/* Coloured top strip */}
              <div style={{ height: 3, background: meta.color }} />

              <div style={{ padding: 24 }}>
                {/* Badge + date */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <span className="tag" style={{ borderColor: meta.color, color: meta.color }}>
                    {meta.label}
                  </span>
                  <span style={{ fontFamily: "'Space Mono'", fontSize: 10, color: '#6b5e48', letterSpacing: '0.06em' }}>
                    {ride.date} · {ride.time}
                  </span>
                </div>

                <h3
                  style={{
                    fontFamily: "'Playfair Display', serif",
                    fontWeight: 700,
                    fontSize: 20,
                    color: '#f0e8d6',
                    marginBottom: 8,
                    lineHeight: 1.25,
                  }}
                >
                  {ride.title}
                </h3>
                <p style={{ fontSize: 13, color: '#b8aa90', lineHeight: 1.6, marginBottom: 20 }}>
                  {ride.subtitle}
                </p>

                {/* Route & stats */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '10px 16px',
                    marginBottom: 20,
                    paddingTop: 16,
                    borderTop: '1px solid rgba(255,255,255,0.06)',
                  }}
                >
                  {[
                    ['Route', `${ride.from} → ${ride.to}`],
                    ['Distance', ride.distance],
                    ['Duration', ride.duration],
                    ['Pace', ride.difficulty],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <div style={{ fontFamily: "'Space Mono'", fontSize: 9, letterSpacing: '0.1em', color: '#6b5e48', textTransform: 'uppercase', marginBottom: 3 }}>
                        {k}
                      </div>
                      <div style={{ fontSize: 12, color: '#d8ccb8', lineHeight: 1.4 }}>{v}</div>
                    </div>
                  ))}
                </div>

                {/* Spots bar */}
                <div style={{ marginBottom: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontFamily: "'Space Mono'", fontSize: 9, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6b5e48' }}>
                      Spots left
                    </span>
                    <span style={{ fontFamily: "'Space Mono'", fontSize: 9, color: spotsRatio < 0.25 ? '#c8604a' : '#9e8a62' }}>
                      {ride.spotsLeft} / {ride.totalSpots}
                    </span>
                  </div>
                  <div style={{ height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.08)' }}>
                    <div
                      style={{
                        height: '100%',
                        borderRadius: 2,
                        width: `${(1 - spotsRatio) * 100}%`,
                        background: spotsRatio < 0.25 ? '#c8604a' : '#c8962a',
                        transition: 'width 0.5s ease',
                      }}
                    />
                  </div>
                </div>

                {/* Expand / RSVP */}
                <button
                  className="btn-ghost"
                  style={{ width: '100%', justifyContent: 'center' }}
                  onClick={() => setSelected(isOpen ? null : ride.id)}
                >
                  {isOpen ? 'Less info ↑' : 'I\'m in — details ↓'}
                </button>

                {/* Expanded highlights */}
                {isOpen && (
                  <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                    <p style={{ fontFamily: "'Space Mono'", fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#6b5e48', marginBottom: 10 }}>
                      Ride highlights
                    </p>
                    <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 7 }}>
                      {ride.highlights.map((h) => (
                        <li key={h} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, color: '#b8aa90', lineHeight: 1.5 }}>
                          <span style={{ color: '#c8962a', marginTop: 2, flexShrink: 0 }}>—</span>
                          {h}
                        </li>
                      ))}
                    </ul>
                    <button className="btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 16 }}>
                      Reserve my spot
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────
   BIKES / MEMBERS SECTION  — interactive 3D showcase
──────────────────────────────────────────────────────────────*/
function BikesSection() {
  const [activeBikeId, setActiveBikeId] = useState<BikeId>('hunter-350');
  const activeBike = BIKES.find((b) => b.id === activeBikeId) || BIKES[0];

  return (
    <section id="bikes" style={{ padding: '96px 0', background: '#0e0c09' }}>
      <div style={{ maxWidth: 1160, margin: '0 auto', padding: '0 24px' }}>
        {/* Header */}
        <div className="reveal" style={{ marginBottom: 56, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 20 }}>
          <div>
            <div className="pill" style={{ marginBottom: 16 }}>The Machines</div>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: 'clamp(32px, 5vw, 52px)', color: '#f0e8d6', lineHeight: 1.14 }}>
              Bikes of the Pack
            </h2>
          </div>
          <p style={{ fontSize: 13, color: '#9e8a62', maxWidth: 340, lineHeight: 1.7 }}>
            Click any member below to inspect their machine in 3D. Drag to orbit.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 300px', gap: 32, alignItems: 'start' }}>
          {/* Left: 3D Canvas + info */}
          <div className="reveal" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* 3D Stage */}
            <div
              className="canvas-wrap"
              style={{
                height: 460,
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: 16,
                position: 'relative',
              }}
            >
              <BikeScene bike={activeBike} spin />

              {/* Bottom info overlay */}
              <div
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  padding: '32px 24px 20px',
                  background: 'linear-gradient(to top, rgba(9,9,10,0.95) 0%, transparent 100%)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-end',
                }}
              >
                <div>
                  <div style={{ fontFamily: "'Space Mono'", fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: activeBike.accentHex, marginBottom: 4 }}>
                    {activeBike.brand} · {activeBike.cc}cc · {activeBike.year}
                  </div>
                  <div style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: 26, color: '#f0e8d6', lineHeight: 1.1 }}>
                    {activeBike.model}
                  </div>
                  <div style={{ fontFamily: "'Inter'", fontSize: 12, color: '#9e8a62', marginTop: 2 }}>
                    {activeBike.color}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: "'Space Mono'", fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#6b5e48', marginBottom: 4 }}>
                    Rider
                  </div>
                  <div style={{ fontFamily: "'Playfair Display', serif", fontStyle: 'italic', fontSize: 18, color: '#f0e8d6' }}>
                    {activeBike.member}
                  </div>
                  <div style={{ fontFamily: "'Inter'", fontSize: 11, color: '#9e8a62' }}>{activeBike.role}</div>
                </div>
              </div>

              {/* Top-left orbit hint */}
              <div style={{ position: 'absolute', top: 16, left: 16, fontFamily: "'Space Mono'", fontSize: 9, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.2)' }}>
                drag to orbit · scroll to zoom
              </div>
            </div>

            {/* Modifications */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <span style={{ fontFamily: "'Space Mono'", fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#6b5e48', display: 'flex', alignItems: 'center' }}>
                Mods:&nbsp;
              </span>
              {activeBike.mods.map((m) => (
                <span key={m} className="tag">{m}</span>
              ))}
            </div>

            {/* Member bio */}
            <p style={{ fontSize: 13, color: '#9e8a62', lineHeight: 1.75, fontStyle: 'italic', borderLeft: '2px solid rgba(200,150,42,0.3)', paddingLeft: 16 }}>
              "{activeBike.bio}"
            </p>
          </div>

          {/* Right: Member selector cards */}
          <div className="reveal" style={{ transitionDelay: '0.15s', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {BIKES.map((bike) => {
              const isActive = bike.id === activeBikeId;
              return (
                <button
                  key={bike.id}
                  className="bike-card"
                  onClick={() => setActiveBikeId(bike.id)}
                  style={{
                    textAlign: 'left',
                    border: `1px solid ${isActive ? `${bike.accentHex}55` : 'rgba(255,255,255,0.07)'}`,
                    borderRadius: 10,
                    padding: '14px 16px',
                    background: isActive ? `${bike.colorHex}18` : 'rgba(255,255,255,0.02)',
                    cursor: 'pointer',
                    width: '100%',
                    transition: 'all 0.25s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span
                      style={{
                        fontFamily: "'Playfair Display', serif",
                        fontWeight: isActive ? 700 : 500,
                        fontSize: 15,
                        color: isActive ? '#f0e8d6' : '#9e8a62',
                        transition: 'color 0.25s',
                      }}
                    >
                      {bike.member}
                    </span>
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: isActive ? bike.accentHex : 'rgba(255,255,255,0.15)',
                        transition: 'background 0.25s',
                      }}
                    />
                  </div>
                  <div style={{ fontFamily: "'Space Mono'", fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: isActive ? bike.accentHex : '#6b5e48', marginBottom: 3 }}>
                    {bike.role}
                  </div>
                  <div style={{ fontSize: 12, color: isActive ? '#b8aa90' : '#5a5040' }}>
                    {bike.brand} {bike.model} · {bike.cc}cc
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────
   CULTURE SECTION
──────────────────────────────────────────────────────────────*/
function CultureSection() {
  return (
    <section id="culture" style={{ padding: '96px 24px', maxWidth: 1160, margin: '0 auto' }}>
      <div className="reveal" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 64, alignItems: 'center', flexWrap: 'wrap' }}>
        {/* Left copy */}
        <div>
          <div className="pill" style={{ marginBottom: 16 }}>Our Vibe</div>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: 'clamp(32px, 4.5vw, 48px)', color: '#f0e8d6', lineHeight: 1.15, marginBottom: 20 }}>
            Riding as a way of life, not a hobby.
          </h2>
          <p style={{ fontSize: 14, color: '#9e8a62', lineHeight: 1.8, maxWidth: 420 }}>
            Highway Hustlers started as a group of friends who wanted to see more of Madhya Pradesh — its forests,
            rivers, ghats, and hidden dhabas. Three years later we're 40 riders strong and every ride still
            feels like the first one.
          </p>

          <div className="divider" style={{ margin: '28px 0' }} />

          <p style={{ fontSize: 14, color: '#9e8a62', lineHeight: 1.8, maxWidth: 420 }}>
            We're based in Bhopal and ride all over MP — Pachmarhi, Orchha, Mandav, Bhimbetka, Bargi Dam and
            beyond. Any bike welcome, any experience level welcome. Just bring ATGATT and a good attitude.
          </p>
        </div>

        {/* Right: culture cards 2×2 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          {CULTURE_POINTS.map((pt, i) => (
            <div
              key={pt.title}
              style={{
                background: '#14120e',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 12,
                padding: '20px 18px',
                transition: 'border-color 0.25s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'rgba(200,150,42,0.25)')}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)')}
            >
              <div style={{ fontSize: 22, marginBottom: 10 }}>{pt.icon}</div>
              <h4 style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: 15, color: '#f0e8d6', marginBottom: 8, lineHeight: 1.3 }}>
                {pt.title}
              </h4>
              <p style={{ fontSize: 12, color: '#9e8a62', lineHeight: 1.65 }}>{pt.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────
   JOIN SECTION (MODAL)
──────────────────────────────────────────────────────────────*/
function JoinModal({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState({ name: '', bike: '', city: 'Bhopal', note: '' });
  const [done, setDone] = useState(false);

  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [onClose]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setDone(true);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Join Highway Hustlers"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        background: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(10px)',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background: '#14120e',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 16,
          maxWidth: 480,
          width: '100%',
          padding: 36,
          position: 'relative',
        }}
      >
        {/* Close */}
        <button
          onClick={onClose}
          aria-label="Close"
          style={{
            position: 'absolute',
            top: 16,
            right: 16,
            background: 'none',
            border: 'none',
            color: '#6b5e48',
            fontSize: 20,
            cursor: 'pointer',
            lineHeight: 1,
          }}
        >
          ×
        </button>

        {done ? (
          <div style={{ textAlign: 'center', paddingTop: 16 }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>🏍️</div>
            <h3 style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: 26, color: '#f0e8d6', marginBottom: 12 }}>
              Welcome to the pack, {form.name.split(' ')[0]}!
            </h3>
            <p style={{ fontSize: 13, color: '#9e8a62', lineHeight: 1.7 }}>
              We'll reach out on WhatsApp soon. Keep your tyres pumped.
            </p>
            <button className="btn-ghost" style={{ marginTop: 24 }} onClick={onClose}>
              Close
            </button>
          </div>
        ) : (
          <>
            <div className="pill" style={{ marginBottom: 16 }}>Join Us</div>
            <h3 style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: 26, color: '#f0e8d6', marginBottom: 6, lineHeight: 1.2 }}>
              Ready to ride with us?
            </h3>
            <p style={{ fontSize: 13, color: '#9e8a62', marginBottom: 28, lineHeight: 1.65 }}>
              Drop your details and we'll add you to the WhatsApp group.
            </p>

            <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontFamily: "'Space Mono'", fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#6b5e48', marginBottom: 6 }}>
                  Your name
                </label>
                <input
                  className="field"
                  required
                  placeholder="e.g. Ravi Sharma"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontFamily: "'Space Mono'", fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#6b5e48', marginBottom: 6 }}>
                  Your bike
                </label>
                <input
                  className="field"
                  required
                  placeholder="e.g. RE Thunderbird 350, Bajaj NS200…"
                  value={form.bike}
                  onChange={(e) => setForm({ ...form, bike: e.target.value })}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontFamily: "'Space Mono'", fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#6b5e48', marginBottom: 6 }}>
                    City
                  </label>
                  <input
                    className="field"
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontFamily: "'Space Mono'", fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#6b5e48', marginBottom: 6 }}>
                    Experience
                  </label>
                  <select
                    className="field"
                    style={{ appearance: 'none' }}
                    value={form.note}
                    onChange={(e) => setForm({ ...form, note: e.target.value })}
                  >
                    <option value="">Select</option>
                    <option>New rider (&lt;5,000 km)</option>
                    <option>Intermediate (5k-25k km)</option>
                    <option>Experienced (25k+ km)</option>
                  </select>
                </div>
              </div>

              <button type="submit" className="btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}>
                Send request
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   FOOTER
──────────────────────────────────────────────────────────────*/
function Footer({ onJoinClick }: { onJoinClick: () => void }) {
  return (
    <footer
      style={{
        borderTop: '1px solid rgba(255,255,255,0.07)',
        padding: '64px 24px 40px',
        textAlign: 'center',
      }}
    >
      <div style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: 32, color: '#f0e8d6', marginBottom: 12 }}>
        Highway Hustlers
      </div>
      <p style={{ fontSize: 13, color: '#6b5e48', marginBottom: 28, lineHeight: 1.7 }}>
        Bhopal, Madhya Pradesh · Est. 2021
        <br />
        Ride safe. Ride kind. Ride together.
      </p>
      <button className="btn-primary" onClick={onJoinClick} style={{ marginBottom: 48 }}>
        Join the ride →
      </button>
      <div style={{ fontFamily: "'Space Mono'", fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(107,94,72,0.45)' }}>
        © 2025 Highway Hustlers · All roads lead somewhere beautiful
      </div>
    </footer>
  );
}

/* ─────────────────────────────────────────────────────────────
   APP ROOT
──────────────────────────────────────────────────────────────*/
export function App() {
  const [showJoin, setShowJoin] = useState(false);
  useReveal();

  return (
    <>
      <Nav onJoinClick={() => setShowJoin(true)} />
      <main>
        <HeroSection onJoinClick={() => setShowJoin(true)} />
        <RidesSection />
        <BikesSection />
        <CultureSection />
      </main>
      <Footer onJoinClick={() => setShowJoin(true)} />
      {showJoin && <JoinModal onClose={() => setShowJoin(false)} />}
    </>
  );
}

export default App;
