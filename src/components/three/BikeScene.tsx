import React, { Suspense, useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Environment, OrbitControls, ContactShadows, Float } from '@react-three/drei';
import * as THREE from 'three';
import type { BikeData } from '../../data/bikes-and-rides';

/* ─────────────────────────────────────────────────────────────
   SHARED GEOMETRY HELPERS
──────────────────────────────────────────────────────────────*/

function useCurvedTube(points: THREE.Vector3[], radius = 0.025, segments = 6): THREE.TubeGeometry {
  return useMemo(() => {
    const curve = new THREE.CatmullRomCurve3(points);
    return new THREE.TubeGeometry(curve, 24, radius, segments, false);
  }, [points, radius, segments]);
}

/* ─────────────────────────────────────────────────────────────
   WHEEL — shared, realistic with tread & spokes
──────────────────────────────────────────────────────────────*/

function Wheel({
  pos,
  r = 0.32,
  width = 0.13,
  rimHex,
  isSpinning,
}: {
  pos: [number, number, number];
  r?: number;
  width?: number;
  rimHex: string;
  isSpinning: boolean;
}) {
  const spinRef = useRef<THREE.Group>(null);

  useFrame((_, dt) => {
    if (!spinRef.current || !isSpinning) return;
    spinRef.current.rotation.x -= dt * 5.5;
  });

  const spokeAngles = useMemo(() => Array.from({ length: 6 }, (_, i) => (i / 6) * Math.PI * 2), []);

  return (
    <group position={pos}>
      <group ref={spinRef}>
        {/* Outer rubber tyre — dark, slightly reflective */}
        <mesh castShadow>
          <torusGeometry args={[r, width, 28, 80]} />
          <meshStandardMaterial color="#0f0f0f" roughness={0.82} metalness={0.05} />
        </mesh>

        {/* Tyre tread groove rings (aesthetic) */}
        {[-0.06, 0, 0.06].map((zOff) => (
          <mesh key={zOff} position={[0, 0, zOff]}>
            <torusGeometry args={[r, 0.008, 6, 80]} />
            <meshStandardMaterial color="#1c1c1c" roughness={0.95} />
          </mesh>
        ))}

        {/* Alloy rim barrel */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[r * 0.77, r * 0.77, width * 2.0, 40, 1, true]} />
          <meshStandardMaterial
            color={rimHex}
            metalness={0.88}
            roughness={0.14}
            side={THREE.DoubleSide}
          />
        </mesh>

        {/* Spokes — Y-shape pairs */}
        {spokeAngles.map((angle, i) => (
          <group key={i} rotation={[0, 0, angle]}>
            {[-0.05, 0.05].map((offZ) => (
              <mesh
                key={offZ}
                position={[0, r * 0.42, offZ]}
                rotation={[0, offZ * 1.5, 0]}
              >
                <boxGeometry args={[0.018, r * 0.82, 0.02]} />
                <meshStandardMaterial color={rimHex} metalness={0.85} roughness={0.2} />
              </mesh>
            ))}
          </group>
        ))}

        {/* Centre hub cap */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.08, 0.08, width * 2.3, 24]} />
          <meshStandardMaterial color="#2a2a2a" metalness={0.9} roughness={0.2} />
        </mesh>

        {/* Brake disc (right side) */}
        <mesh position={[0, 0, width + 0.04]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[r * 0.58, r * 0.58, 0.012, 36]} />
          <meshStandardMaterial color="#8a8a8a" metalness={0.95} roughness={0.12} />
        </mesh>
      </group>

      {/* Caliper (doesn't spin) */}
      <mesh position={[-r * 0.42, r * 0.25, width + 0.04]} rotation={[0, 0, 0.6]}>
        <boxGeometry args={[0.1, 0.07, 0.052]} />
        <meshStandardMaterial color={rimHex} metalness={0.7} roughness={0.3} />
      </mesh>
    </group>
  );
}

/* ─────────────────────────────────────────────────────────────
   FORK / SUSPENSION LEG
──────────────────────────────────────────────────────────────*/
function ForkLeg({
  pos,
  height = 0.52,
  color,
  isGold = false,
}: {
  pos: [number, number, number];
  height?: number;
  color: string;
  isGold?: boolean;
}) {
  return (
    <group position={pos}>
      {/* Upper stanchion */}
      <mesh position={[0, height * 0.3, 0]}>
        <cylinderGeometry args={[0.028, 0.026, height * 0.65, 16]} />
        <meshStandardMaterial
          color={isGold ? '#c8962a' : color}
          metalness={0.9}
          roughness={0.12}
        />
      </mesh>
      {/* Lower inner leg (chromed) */}
      <mesh position={[0, -height * 0.18, 0]}>
        <cylinderGeometry args={[0.022, 0.022, height * 0.42, 16]} />
        <meshStandardMaterial color="#d8d8d8" metalness={0.95} roughness={0.06} />
      </mesh>
    </group>
  );
}

/* ─────────────────────────────────────────────────────────────
   RETRO BIKE — Royal Enfield Hunter 350
──────────────────────────────────────────────────────────────*/
function RetroHunterBike({ bike, spin }: { bike: BikeData; spin: boolean }) {
  const g = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!g.current) return;
    g.current.rotation.y = Math.sin(clock.elapsedTime * 0.25) * 0.06;
  });

  const framePoints = useMemo(
    () => [
      new THREE.Vector3(0.8, 0.65, 0),
      new THREE.Vector3(0.4, 0.95, 0),
      new THREE.Vector3(-0.1, 0.98, 0),
      new THREE.Vector3(-0.6, 0.88, 0),
      new THREE.Vector3(-0.85, 0.62, 0),
    ],
    []
  );
  const frameTube = useCurvedTube(framePoints, 0.032);

  return (
    <group ref={g}>
      {/* Wheels */}
      <Wheel pos={[0.82, 0.32, 0]} r={0.32} width={0.1} rimHex="#5c5247" isSpinning={spin} />
      <Wheel pos={[-0.82, 0.32, 0]} r={0.32} width={0.13} rimHex="#5c5247" isSpinning={spin} />

      {/* Spine frame tube */}
      <mesh castShadow geometry={frameTube}>
        <meshStandardMaterial color="#2a2a28" metalness={0.8} roughness={0.3} />
      </mesh>

      {/* Seat stays / sub-frame */}
      <mesh position={[-0.5, 0.78, 0]} rotation={[0, 0, 0.12]}>
        <cylinderGeometry args={[0.018, 0.018, 0.7, 12]} />
        <meshStandardMaterial color="#2a2a28" metalness={0.8} roughness={0.3} />
      </mesh>

      {/* Front forks */}
      <ForkLeg pos={[0.7, 0.62, 0.1]} height={0.54} color="#222220" />
      <ForkLeg pos={[0.7, 0.62, -0.1]} height={0.54} color="#222220" />

      {/* Rear shock */}
      <mesh position={[-0.62, 0.66, 0.12]} rotation={[0, 0, -0.4]}>
        <cylinderGeometry args={[0.022, 0.022, 0.38, 10]} />
        <meshStandardMaterial color="#c8604a" metalness={0.75} roughness={0.3} />
      </mesh>
      <mesh position={[-0.62, 0.66, -0.12]} rotation={[0, 0, -0.4]}>
        <cylinderGeometry args={[0.022, 0.022, 0.38, 10]} />
        <meshStandardMaterial color="#c8604a" metalness={0.75} roughness={0.3} />
      </mesh>

      {/* Teardrop fuel tank */}
      <mesh position={[0.12, 0.98, 0]} castShadow>
        <sphereGeometry args={[0.24, 28, 14, 0, Math.PI * 2, 0, Math.PI * 0.65]} />
        <meshStandardMaterial color={bike.colorHex} metalness={0.82} roughness={0.14} />
      </mesh>
      <mesh position={[-0.08, 0.96, 0]} rotation={[0, 0, -0.15]}>
        <sphereGeometry args={[0.18, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.6]} />
        <meshStandardMaterial color={bike.colorHex} metalness={0.82} roughness={0.14} />
      </mesh>

      {/* Engine block */}
      <mesh position={[0.0, 0.56, 0]} castShadow>
        <boxGeometry args={[0.46, 0.32, 0.28]} />
        <meshStandardMaterial color="#1a1a18" metalness={0.78} roughness={0.35} />
      </mesh>
      {/* Cooling fins */}
      {[-0.04, 0.02, 0.08, 0.14].map((x) => (
        <mesh key={x} position={[x, 0.68, 0]}>
          <boxGeometry args={[0.04, 0.22, 0.3]} />
          <meshStandardMaterial color="#222220" metalness={0.75} roughness={0.3} />
        </mesh>
      ))}

      {/* Classic round headlamp */}
      <mesh position={[0.82, 0.88, 0]} rotation={[0, Math.PI / 2, 0]}>
        <cylinderGeometry args={[0.1, 0.09, 0.1, 28]} />
        <meshStandardMaterial color="#111110" metalness={0.85} roughness={0.2} />
      </mesh>
      <mesh position={[0.88, 0.88, 0]} rotation={[0, Math.PI / 2, 0]}>
        <cylinderGeometry args={[0.09, 0.09, 0.015, 28]} />
        <meshStandardMaterial color="#ffffff" emissive="#f8e8c0" emissiveIntensity={1.2} />
      </mesh>
      {/* Headlamp chrome ring */}
      <mesh position={[0.85, 0.88, 0]} rotation={[0, Math.PI / 2, 0]}>
        <torusGeometry args={[0.1, 0.012, 8, 28]} />
        <meshStandardMaterial color="#d8d8d8" metalness={0.95} roughness={0.08} />
      </mesh>

      {/* Flat bench seat */}
      <mesh position={[-0.22, 0.95, 0]} rotation={[0, 0, 0.05]} castShadow>
        <boxGeometry args={[0.7, 0.075, 0.28]} />
        <meshStandardMaterial color="#1c1814" roughness={0.9} metalness={0.05} />
      </mesh>

      {/* Handlebars (wide upright) */}
      <mesh position={[0.46, 1.08, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.014, 0.014, 0.52, 12]} />
        <meshStandardMaterial color="#1a1a1a" metalness={0.9} roughness={0.2} />
      </mesh>
      <mesh position={[0.46, 1.1, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.012, 0.012, 0.12, 12]} />
        <meshStandardMaterial color="#1a1a1a" metalness={0.9} roughness={0.2} />
      </mesh>

      {/* Chrome exhaust pipe */}
      <mesh position={[-0.32, 0.46, 0.18]} rotation={[0.05, 0, 0.22]} castShadow>
        <cylinderGeometry args={[0.046, 0.038, 0.7, 18]} />
        <meshStandardMaterial color="#c8c0b0" metalness={0.95} roughness={0.1} />
      </mesh>
      {/* Megaphone end can */}
      <mesh position={[-0.64, 0.4, 0.22]} rotation={[0.05, 0, 0.22]}>
        <cylinderGeometry args={[0.038, 0.052, 0.18, 18]} />
        <meshStandardMaterial color="#a0a090" metalness={0.9} roughness={0.15} />
      </mesh>

      {/* Rear mudguard */}
      <mesh position={[-0.88, 0.54, 0]} rotation={[0, 0, -0.3]}>
        <torusGeometry args={[0.32, 0.025, 8, 20, Math.PI * 0.45]} />
        <meshStandardMaterial color={bike.colorHex} metalness={0.78} roughness={0.18} />
      </mesh>

      {/* Taillight */}
      <mesh position={[-0.92, 0.78, 0]}>
        <boxGeometry args={[0.04, 0.04, 0.1]} />
        <meshBasicMaterial color="#ff3030" />
      </mesh>
    </group>
  );
}

/* ─────────────────────────────────────────────────────────────
   SPORT BIKE — TVS Apache RR 310 / Yamaha R15M
──────────────────────────────────────────────────────────────*/
function SportBike({ bike, spin }: { bike: BikeData; spin: boolean }) {
  const g = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!g.current) return;
    g.current.rotation.y = Math.sin(clock.elapsedTime * 0.25) * 0.06;
  });

  const isR15 = bike.id === 'yamaha-r15m';

  return (
    <group ref={g}>
      {/* Wheels — tighter, sportier */}
      <Wheel
        pos={[0.8, 0.3, 0]}
        r={0.3}
        width={0.095}
        rimHex={isR15 ? '#c8962a' : '#c8962a'}
        isSpinning={spin}
      />
      <Wheel
        pos={[-0.8, 0.3, 0]}
        r={0.3}
        width={0.115}
        rimHex={isR15 ? '#c8962a' : '#c8962a'}
        isSpinning={spin}
      />

      {/* Trellis / steel frame (simplified as tubes) */}
      {[0.12, -0.12].map((z) => (
        <group key={z}>
          <mesh position={[0.32, 0.82, z]} rotation={[0, 0, -0.32]}>
            <cylinderGeometry args={[0.018, 0.018, 0.7, 10]} />
            <meshStandardMaterial color="#1e1e1e" metalness={0.82} roughness={0.25} />
          </mesh>
          <mesh position={[-0.0, 0.66, z]} rotation={[0, 0, 0.55]}>
            <cylinderGeometry args={[0.016, 0.016, 0.52, 10]} />
            <meshStandardMaterial color="#1e1e1e" metalness={0.82} roughness={0.25} />
          </mesh>
        </group>
      ))}

      {/* USD inverted forks (gold) */}
      <ForkLeg pos={[0.68, 0.6, 0.1]} height={0.5} color="#c8962a" isGold />
      <ForkLeg pos={[0.68, 0.6, -0.1]} height={0.5} color="#c8962a" isGold />

      {/* Mono rear shock */}
      <mesh position={[-0.28, 0.6, 0]} rotation={[0, 0, -0.55]}>
        <cylinderGeometry args={[0.028, 0.028, 0.36, 12]} />
        <meshStandardMaterial color={bike.accentHex} metalness={0.75} roughness={0.28} />
      </mesh>

      {/* Swingarm */}
      <mesh position={[-0.55, 0.32, 0.13]} rotation={[0, 0, -0.06]}>
        <boxGeometry args={[0.6, 0.055, 0.04]} />
        <meshStandardMaterial color="#252520" metalness={0.78} roughness={0.28} />
      </mesh>
      <mesh position={[-0.55, 0.32, -0.13]} rotation={[0, 0, -0.06]}>
        <boxGeometry args={[0.6, 0.055, 0.04]} />
        <meshStandardMaterial color="#252520" metalness={0.78} roughness={0.28} />
      </mesh>

      {/* Full fairing — left and right panels */}
      {[0.2, -0.2].map((z) => (
        <mesh key={z} position={[0.38, 0.68, z]} rotation={[0, 0, -0.25]} castShadow>
          <boxGeometry args={[0.72, 0.48, 0.046]} />
          <meshStandardMaterial
            color={bike.colorHex}
            metalness={0.78}
            roughness={0.16}
          />
        </mesh>
      ))}

      {/* Lower belly pan */}
      <mesh position={[0.08, 0.38, 0]} rotation={[0, 0, 0]}>
        <boxGeometry args={[0.7, 0.13, 0.34]} />
        <meshStandardMaterial color={bike.colorHex} metalness={0.72} roughness={0.2} />
      </mesh>

      {/* Upper fairing / nose cowl */}
      <mesh position={[0.82, 0.86, 0]} rotation={[0, 0, -0.38]} castShadow>
        <boxGeometry args={[0.36, 0.26, 0.34]} />
        <meshStandardMaterial color={bike.colorHex} metalness={0.78} roughness={0.16} />
      </mesh>

      {/* Bubble windscreen */}
      <mesh position={[0.72, 1.06, 0]} rotation={[0, 0, -0.58]}>
        <boxGeometry args={[0.36, 0.04, 0.28]} />
        <meshStandardMaterial
          color={isR15 ? '#38bdf8' : '#d0e8f0'}
          transparent
          opacity={0.48}
          metalness={0.9}
          roughness={0.04}
        />
      </mesh>

      {/* Fuel tank under tail */}
      <mesh position={[0.1, 0.92, 0]} castShadow>
        <boxGeometry args={[0.5, 0.2, 0.3]} />
        <meshStandardMaterial color={bike.colorHex} metalness={0.82} roughness={0.14} />
      </mesh>

      {/* Seat & stepped tail */}
      <mesh position={[-0.3, 0.84, 0]} rotation={[0, 0, 0.1]} castShadow>
        <boxGeometry args={[0.4, 0.09, 0.28]} />
        <meshStandardMaterial color="#111010" roughness={0.88} />
      </mesh>
      <mesh position={[-0.65, 0.96, 0]} rotation={[0, 0, 0.26]} castShadow>
        <boxGeometry args={[0.38, 0.1, 0.24]} />
        <meshStandardMaterial color={bike.colorHex} metalness={0.78} roughness={0.18} />
      </mesh>

      {/* Engine */}
      <mesh position={[0.04, 0.54, 0]} castShadow>
        <boxGeometry args={[0.48, 0.3, 0.3]} />
        <meshStandardMaterial color="#141414" metalness={0.82} roughness={0.3} />
      </mesh>
      {/* Liquid cooled radiator */}
      <mesh position={[0.38, 0.52, 0]} rotation={[0, 0, 0.28]}>
        <boxGeometry args={[0.06, 0.28, 0.32]} />
        <meshStandardMaterial color="#080808" metalness={0.7} roughness={0.5} />
      </mesh>

      {/* Clip-on handlebars — low */}
      <mesh position={[0.5, 0.92, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.013, 0.013, 0.48, 12]} />
        <meshStandardMaterial color="#111110" metalness={0.9} roughness={0.18} />
      </mesh>

      {/* Bi-LED projector headlamp */}
      <mesh position={[0.88, 0.82, 0]}>
        <boxGeometry args={[0.14, 0.12, 0.28]} />
        <meshStandardMaterial color="#0a0a0a" metalness={0.8} roughness={0.2} />
      </mesh>
      {/* Projector lens */}
      <mesh position={[0.96, 0.82, 0]}>
        <sphereGeometry args={[0.05, 18, 18]} />
        <meshStandardMaterial color="#ffffff" emissive="#e0f0ff" emissiveIntensity={1.5} />
      </mesh>
      {/* DRL strip top */}
      <mesh position={[0.94, 0.9, 0]}>
        <boxGeometry args={[0.04, 0.018, 0.26]} />
        <meshBasicMaterial color={isR15 ? '#38d8f8' : bike.accentHex} />
      </mesh>
      {/* DRL strip bottom */}
      <mesh position={[0.94, 0.74, 0]}>
        <boxGeometry args={[0.04, 0.018, 0.26]} />
        <meshBasicMaterial color={isR15 ? '#38d8f8' : bike.accentHex} />
      </mesh>

      {/* Under-belly exhaust */}
      <mesh position={[-0.55, 0.28, 0.19]} rotation={[0.08, 0, 0.16]} castShadow>
        <cylinderGeometry args={[0.04, 0.048, 0.68, 16]} />
        <meshStandardMaterial color="#909080" metalness={0.92} roughness={0.12} />
      </mesh>
      <mesh position={[-0.82, 0.24, 0.22]} rotation={[0.08, 0, 0.16]}>
        <cylinderGeometry args={[0.048, 0.038, 0.14, 16]} />
        <meshStandardMaterial color="#606055" metalness={0.9} roughness={0.18} />
      </mesh>

      {/* Aero winglets */}
      {[0.24, -0.24].map((z) => (
        <mesh key={z} position={[0.72, 0.72, z]} rotation={[0.15 * Math.sign(z), 0, -0.18]}>
          <boxGeometry args={[0.22, 0.02, 0.1]} />
          <meshStandardMaterial color={bike.accentHex} metalness={0.82} roughness={0.2} />
        </mesh>
      ))}
    </group>
  );
}

/* ─────────────────────────────────────────────────────────────
   CLASSIC / MODERN NAKED — Triumph Speed 400, Pulsar N250
──────────────────────────────────────────────────────────────*/
function ClassicNakedBike({ bike, spin }: { bike: BikeData; spin: boolean }) {
  const g = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!g.current) return;
    g.current.rotation.y = Math.sin(clock.elapsedTime * 0.25) * 0.06;
  });

  const isNaked = bike.archetype === 'naked'; // Pulsar N250
  const isClassic = bike.archetype === 'classic'; // Triumph

  return (
    <group ref={g}>
      <Wheel pos={[0.82, 0.32, 0]} r={0.31} width={0.1} rimHex={isClassic ? '#c8962a' : '#1a1a1a'} isSpinning={spin} />
      <Wheel pos={[-0.82, 0.32, 0]} r={0.31} width={0.125} rimHex={isClassic ? '#c8962a' : '#1a1a1a'} isSpinning={spin} />

      {/* Fork legs */}
      <ForkLeg pos={[0.72, 0.62, 0.1]} height={0.52} color={isClassic ? '#c8962a' : '#1a1818'} isGold={isClassic} />
      <ForkLeg pos={[0.72, 0.62, -0.1]} height={0.52} color={isClassic ? '#c8962a' : '#1a1818'} isGold={isClassic} />

      {/* Rear shock */}
      <mesh position={[-0.56, 0.64, 0]} rotation={[0, 0, -0.5]}>
        <cylinderGeometry args={[0.024, 0.024, 0.36, 12]} />
        <meshStandardMaterial color={bike.accentHex} metalness={0.75} roughness={0.3} />
      </mesh>

      {/* Swingarm */}
      <mesh position={[-0.56, 0.33, 0]} rotation={[0, 0, -0.06]}>
        <boxGeometry args={[0.76, 0.065, 0.06]} />
        <meshStandardMaterial color="#252522" metalness={0.78} roughness={0.28} />
      </mesh>

      {/* Muscular tank */}
      <mesh position={[0.14, 0.96, 0]} castShadow>
        <boxGeometry args={[0.58, 0.22, 0.36]} />
        <meshStandardMaterial color={bike.colorHex} metalness={0.84} roughness={0.14} />
      </mesh>
      {/* Tank knee cutouts / side panels */}
      {[0.2, -0.2].map((z) => (
        <mesh key={z} position={[0.1, 0.88, z * 0.88]} rotation={[0, z * 0.15, -0.08]}>
          <boxGeometry args={[0.42, 0.14, 0.04]} />
          <meshStandardMaterial color={isNaked ? bike.accentHex : bike.colorHex} metalness={0.78} roughness={0.2} />
        </mesh>
      ))}

      {/* Engine */}
      <mesh position={[0.02, 0.56, 0]} castShadow>
        <boxGeometry args={[0.5, 0.34, 0.3]} />
        <meshStandardMaterial color="#141412" metalness={0.82} roughness={0.32} />
      </mesh>
      {/* Finned cylinder head (Triumph) or standard (N250) */}
      <mesh position={[0.12, 0.76, 0]} castShadow>
        <boxGeometry args={[0.28, 0.26, 0.26]} />
        <meshStandardMaterial color="#1c1c1a" metalness={0.82} roughness={0.26} />
      </mesh>
      {isClassic &&
        [-0.02, 0.04, 0.1, 0.16, 0.22].map((xOff) => (
          <mesh key={xOff} position={[xOff, 0.85, 0]}>
            <boxGeometry args={[0.03, 0.16, 0.28]} />
            <meshStandardMaterial color="#242420" metalness={0.78} roughness={0.3} />
          </mesh>
        ))}

      {/* Seat */}
      <mesh position={[-0.24, 0.93, 0]} rotation={[0, 0, 0.06]} castShadow>
        <boxGeometry args={[0.68, 0.085, 0.3]} />
        <meshStandardMaterial color={isClassic ? '#1c1512' : '#0d0d0d'} roughness={0.88} />
      </mesh>
      {/* Tail section */}
      <mesh position={[-0.66, 1.0, 0]} rotation={[0, 0, 0.2]} castShadow>
        <boxGeometry args={[0.4, 0.09, 0.24]} />
        <meshStandardMaterial color={bike.colorHex} metalness={0.78} roughness={0.2} />
      </mesh>

      {/* Headlamp — Triumph: round, N250: projector aggressive */}
      {isClassic ? (
        <group position={[0.84, 0.9, 0]}>
          <mesh rotation={[0, Math.PI / 2, 0]}>
            <cylinderGeometry args={[0.1, 0.09, 0.11, 30]} />
            <meshStandardMaterial color="#111110" metalness={0.85} roughness={0.2} />
          </mesh>
          <mesh position={[0.07, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
            <cylinderGeometry args={[0.09, 0.09, 0.015, 30]} />
            <meshStandardMaterial color="#ffffff" emissive="#f8e0b0" emissiveIntensity={1.3} />
          </mesh>
          <mesh position={[0.04, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
            <torusGeometry args={[0.1, 0.01, 8, 30]} />
            <meshStandardMaterial color="#d8d8c0" metalness={0.96} roughness={0.06} />
          </mesh>
        </group>
      ) : (
        <group position={[0.86, 0.82, 0]}>
          <mesh>
            <boxGeometry args={[0.16, 0.16, 0.3]} />
            <meshStandardMaterial color="#0d0d0d" metalness={0.8} roughness={0.2} />
          </mesh>
          {/* Wolf eye projector */}
          <mesh position={[0.09, 0, 0]}>
            <sphereGeometry args={[0.052, 16, 16]} />
            <meshStandardMaterial color="#ffffff" emissive="#d8f0ff" emissiveIntensity={1.6} />
          </mesh>
          {/* Fang DRL */}
          <mesh position={[0.08, 0.06, 0.1]} rotation={[0.2, 0, -0.15]}>
            <boxGeometry args={[0.04, 0.016, 0.1]} />
            <meshBasicMaterial color={bike.accentHex} />
          </mesh>
          <mesh position={[0.08, 0.06, -0.1]} rotation={[-0.2, 0, -0.15]}>
            <boxGeometry args={[0.04, 0.016, 0.1]} />
            <meshBasicMaterial color={bike.accentHex} />
          </mesh>
        </group>
      )}

      {/* Handlebar */}
      <mesh position={[0.48, isClassic ? 1.06 : 1.0, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.014, 0.014, isClassic ? 0.56 : 0.46, 12]} />
        <meshStandardMaterial color="#141414" metalness={0.88} roughness={0.22} />
      </mesh>

      {/* Exhaust — Triumph: chrome upswept, N250: dual */}
      {isClassic ? (
        <>
          <mesh position={[-0.3, 0.44, 0.2]} rotation={[0.1, 0, 0.2]} castShadow>
            <cylinderGeometry args={[0.04, 0.04, 0.72, 18]} />
            <meshStandardMaterial color="#d0c8b0" metalness={0.95} roughness={0.1} />
          </mesh>
          <mesh position={[-0.6, 0.5, 0.24]} rotation={[0.08, 0, 0.22]}>
            <cylinderGeometry args={[0.04, 0.055, 0.2, 18]} />
            <meshStandardMaterial color="#b0a890" metalness={0.92} roughness={0.14} />
          </mesh>
        </>
      ) : (
        <>
          <mesh position={[-0.4, 0.4, 0.2]} rotation={[0.08, 0, 0.18]} castShadow>
            <cylinderGeometry args={[0.04, 0.036, 0.6, 16]} />
            <meshStandardMaterial color="#606055" metalness={0.9} roughness={0.18} />
          </mesh>
          <mesh position={[-0.66, 0.36, 0.23]} rotation={[0.08, 0, 0.18]}>
            <cylinderGeometry args={[0.036, 0.048, 0.16, 16]} />
            <meshStandardMaterial color="#404038" metalness={0.88} roughness={0.22} />
          </mesh>
        </>
      )}

      {/* Taillight */}
      <mesh position={[-0.9, isClassic ? 0.84 : 0.96, 0]}>
        <boxGeometry args={[0.04, 0.04, 0.12]} />
        <meshBasicMaterial color="#ff2020" />
      </mesh>
    </group>
  );
}

/* ─────────────────────────────────────────────────────────────
   DISPATCHER — picks the right 3D model per bike
──────────────────────────────────────────────────────────────*/
function BikeModel({ bike, spin }: { bike: BikeData; spin: boolean }) {
  switch (bike.archetype) {
    case 'retro':
      return <RetroHunterBike bike={bike} spin={spin} />;
    case 'sport':
      return <SportBike bike={bike} spin={spin} />;
    default:
      return <ClassicNakedBike bike={bike} spin={spin} />;
  }
}

/* ─────────────────────────────────────────────────────────────
   GROUND PLANE & ENVIRONMENT
──────────────────────────────────────────────────────────────*/
function SceneBase({ bike }: { bike: BikeData }) {
  return (
    <>
      {/* Soft warm studio key light */}
      <directionalLight
        position={[4, 7, 3]}
        intensity={2.2}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        color="#f5e8d0"
      />
      {/* Fill light (cool) */}
      <directionalLight position={[-4, 3, -2]} intensity={0.55} color="#c8d8f0" />
      {/* Coloured accent rim light from below */}
      <pointLight position={[0, -0.5, 2]} intensity={1.8} color={bike.accentHex} distance={3} />
      {/* Ambient */}
      <ambientLight intensity={0.5} color="#2a2420" />

      {/* Polished concrete/asphalt reflective ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[12, 12]} />
        <meshStandardMaterial color="#0a0906" roughness={0.45} metalness={0.25} />
      </mesh>

      {/* Colour-matched under-glow puddle */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
        <planeGeometry args={[2.8, 1.4]} />
        <meshBasicMaterial color={bike.accentHex} transparent opacity={0.06} />
      </mesh>

      {/* Contact shadow */}
      <ContactShadows
        position={[0, 0, 0]}
        opacity={0.55}
        scale={5}
        blur={2.2}
        far={0.8}
        color="#000"
      />
    </>
  );
}

/* ─────────────────────────────────────────────────────────────
   MAIN EXPORT
──────────────────────────────────────────────────────────────*/
export interface BikeSceneProps {
  bike: BikeData;
  spin?: boolean;
}

export function BikeScene({ bike, spin = true }: BikeSceneProps) {
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: [2.6, 1.35, 2.8], fov: 36, near: 0.1, far: 30 }}
      gl={{ antialias: true, alpha: true }}
    >
      <color attach="background" args={['#09090a']} />
      <fog attach="fog" args={['#09090a', 5, 16]} />

      <SceneBase bike={bike} />

      <Suspense fallback={null}>
        <Float speed={1.2} rotationIntensity={0.06} floatIntensity={0.08}>
          <BikeModel bike={bike} spin={spin} />
        </Float>
      </Suspense>

      <OrbitControls
        enablePan={false}
        enableZoom={true}
        minDistance={2.5}
        maxDistance={6}
        minPolarAngle={0.3}
        maxPolarAngle={Math.PI / 2 - 0.08}
        dampingFactor={0.08}
        enableDamping
        autoRotate={false}
      />
    </Canvas>
  );
}
