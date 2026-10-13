export type BikeId = 'hunter-350' | 'apache-rr310' | 'speed-400' | 'yamaha-r15m' | 'pulsar-n250';

export interface BikeData {
  id: BikeId;
  member: string;
  role: string;
  bio: string;
  brand: string;
  model: string;
  year: string;
  cc: number;
  color: string;
  colorHex: string;
  accentHex: string;
  archetype: 'retro' | 'sport' | 'naked' | 'classic';
  mods: string[];
  /** glb/gltf URL to try loading (may be a CDN link) */
  glbUrl?: string;
}

export const BIKES: BikeData[] = [
  {
    id: 'hunter-350',
    member: 'Kabir',
    role: 'Founder & Road Captain',
    bio: 'The man who started it all. Knows every chai dhaba between Bhopal and the Vindhyas.',
    brand: 'Royal Enfield',
    model: 'Hunter 350',
    year: '2023',
    cc: 349,
    color: 'Dapper Ash',
    colorHex: '#5c5247',
    accentHex: '#c8604a',
    archetype: 'retro',
    mods: ['Bench seat', 'Auxiliary fog lamps', 'Frame sump guard'],
  },
  {
    id: 'apache-rr310',
    member: 'Aryan',
    role: 'Pace Lead',
    bio: 'Sets the pace without a word. His RR 310 is surgically maintained, never misses a beat.',
    brand: 'TVS',
    model: 'Apache RR 310',
    year: '2024',
    cc: 312,
    color: 'Racing Red',
    colorHex: '#c8303a',
    accentHex: '#e0aa38',
    archetype: 'sport',
    mods: ['Race-spec KYB suspension', 'Michelin Road 5', 'Tank pad'],
  },
  {
    id: 'speed-400',
    member: 'Vikram',
    role: 'Route Planner',
    bio: 'Plots routes that nobody else would dare to and then leads them like a Sunday stroll.',
    brand: 'Triumph',
    model: 'Speed 400',
    year: '2023',
    cc: 398,
    color: 'Carnival Red',
    colorHex: '#963020',
    accentHex: '#c8962a',
    archetype: 'classic',
    mods: ['Bar-end mirrors', 'Pirelli Diablo Rosso IV'],
  },
  {
    id: 'yamaha-r15m',
    member: 'Rohan',
    role: 'Ghat Specialist',
    bio: 'Corner-carver extraordinaire. Takes the mountain roads like he built them.',
    brand: 'Yamaha',
    model: 'YZF-R15M',
    year: '2024',
    cc: 155,
    color: 'Metallic Silver',
    colorHex: '#8090a0',
    accentHex: '#3d5a3e',
    archetype: 'sport',
    mods: ['Quickshifter', 'Frame sliders', 'Tank grip pads'],
  },
  {
    id: 'pulsar-n250',
    member: 'Dev',
    role: 'Sweep & Safety',
    bio: 'Always at the back making sure nobody gets left behind. The group\'s quiet guardian.',
    brand: 'Bajaj',
    model: 'Pulsar N250',
    year: '2023',
    cc: 249,
    color: 'Stealth Black',
    colorHex: '#1a1a1a',
    accentHex: '#4e7250',
    archetype: 'naked',
    mods: ['Sena 20S mesh comms', 'Auxiliary LED', 'First-aid kit'],
  },
];

export interface Ride {
  id: string;
  title: string;
  subtitle: string;
  date: string;
  time: string;
  from: string;
  to: string;
  distance: string;
  duration: string;
  type: 'ghat' | 'highway' | 'social' | 'offbeat';
  spotsLeft: number;
  totalSpots: number;
  difficulty: 'Easy' | 'Moderate' | 'Spirited';
  highlights: string[];
}

export const RIDES: Ride[] = [
  {
    id: 'bhojpur-run',
    title: 'Bhojpur Morning Loop',
    subtitle: 'Golden-hour ride to the ancient Bhojeshwar temple. Fog, open roads, chai.',
    date: 'Sun, Nov 3',
    time: '6:00 AM',
    from: 'DB Mall, Bhopal',
    to: 'Bhojpur Temple & back',
    distance: '110 km',
    duration: '4 hours',
    type: 'social',
    spotsLeft: 6,
    totalSpots: 20,
    difficulty: 'Easy',
    highlights: ['Temple sunrise', 'Riverside chai stop', 'Group photo at ruins'],
  },
  {
    id: 'pachmarhi-escape',
    title: 'Pachmarhi Escape',
    subtitle: 'Into the Satpura hills — MP\'s only hill station. Waterfalls, pine-shaded roads.',
    date: 'Sun, Nov 17',
    time: '4:30 AM',
    from: 'DB Mall, Bhopal',
    to: 'Pachmarhi, MP',
    distance: '420 km round trip',
    duration: 'Full day',
    type: 'ghat',
    spotsLeft: 10,
    totalSpots: 25,
    difficulty: 'Moderate',
    highlights: ['Bee Falls', 'Chauragarh climb', 'Forest canopy roads', 'Night halt optional'],
  },
  {
    id: 'vindhya-valley',
    title: 'Vindhya Valley Roll',
    subtitle: 'Winding through the Vindhya Range. Gorge views, minimal traffic, maximum soul.',
    date: 'Sat, Nov 29',
    time: '5:30 AM',
    from: 'DB Mall, Bhopal',
    to: 'Bargi Dam & Narmada Ghats',
    distance: '260 km',
    duration: '6 hours',
    type: 'offbeat',
    spotsLeft: 4,
    totalSpots: 18,
    difficulty: 'Spirited',
    highlights: ['Narmada riverbank', 'Bargi reservoir loop', 'Hidden dal-baati lunch stop'],
  },
];

export const CULTURE_POINTS = [
  {
    icon: '🤝',
    title: 'No Ego on the Road',
    body: 'We leave the flex at home. On a ride, everyone\'s equal — whether you ride a 150 or a 400.',
  },
  {
    icon: '🗺️',
    title: 'Open for Everyone',
    body: 'New riders, seasoned tourers, solo explorers — if you love riding, you belong here.',
  },
  {
    icon: '☕',
    title: 'Chai Over Competition',
    body: 'We stop for chai. We talk. We laugh. A great conversation is as important as a great road.',
  },
  {
    icon: '🌄',
    title: 'The Road is the Goal',
    body: 'We ride to experience — sunrise over a dam, fog through the Satpuras, the smell of rain on hot asphalt.',
  },
];
