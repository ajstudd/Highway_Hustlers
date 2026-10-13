/**
 * Everything editable about the site lives here.
 * Swap names, roles, links and routes without touching components.
 */

export const LINKS = {
  instagram: 'https://instagram.com/hhr_bhopal_',
};

export type Rider = {
  id: string;
  name: string;
  /** optional — shown above the name when set */
  role?: string;
  /** optional one-liner about the rider */
  line?: string;
  brand: string;
  model: string;
  cc: number;
  character: string;
  colorName: string;
  /** glow colour behind the bike */
  glow: string;
  /** frames live in /public/bikes/<id>/00.webp … */
  frames: number;
  /** +1 if increasing frame index turns the bike's rear toward the viewer, -1 otherwise */
  dir: 1 | -1;
  /** which way the bike faces in frame 00 */
  facing: 'left' | 'right';
};

// Add a `role` or `line` to any rider to show it in the hero.
export const RIDERS: Rider[] = [
  {
    id: 'hunter-350', name: 'Anjali',
    brand: 'Royal Enfield', model: 'Hunter 350', cc: 349, character: 'Retro roadster', colorName: 'Rebel Blue',
    glow: '#3d7bd9', frames: 36, dir: 1, facing: 'right',
  },
  {
    id: 'apache-rr310', name: 'Priyanshu',
    brand: 'TVS', model: 'Apache RR 310', cc: 312, character: 'Sport tourer', colorName: 'Racing Red',
    glow: '#e2433a', frames: 24, dir: 1, facing: 'right',
  },
  {
    id: 'speed-400', name: 'Akshad',
    brand: 'Triumph', model: 'Speed 400', cc: 398, character: 'Modern classic', colorName: 'Racing Red',
    glow: '#d9572c', frames: 36, dir: 1, facing: 'right',
  },
  {
    id: 'classic-350', name: 'Shivank',
    brand: 'Royal Enfield', model: 'Classic 350', cc: 349, character: 'Timeless classic', colorName: 'Medallion Bronze',
    glow: '#b9824a', frames: 36, dir: -1, facing: 'right',
  },
  {
    id: 'cb350rs', name: 'Enricquo',
    brand: 'Honda', model: 'CB350RS', cc: 348, character: 'Neo-retro scrambler', colorName: 'Matte Black',
    glow: '#9aa3b2', frames: 34, dir: 1, facing: 'right',
  },
  {
    id: 'yamaha-r15m', name: 'Junaid A',
    brand: 'Yamaha', model: 'R15M', cc: 155, character: 'Sport', colorName: 'Metallic Grey',
    glow: '#6f8bd6', frames: 40, dir: -1, facing: 'right',
  },
  {
    id: 'ninja-300', name: 'Junaid K',
    brand: 'Kawasaki', model: 'Ninja 300', cc: 296, character: 'Twin-cylinder sport', colorName: 'Lime Green',
    glow: '#5cc23a', frames: 1, dir: 1, facing: 'right',
  },
  {
    id: 'pulsar-n250', name: 'Junaid A',
    brand: 'Bajaj', model: 'Pulsar N250', cc: 249, character: 'Street naked', colorName: 'Black',
    glow: '#c9363b', frames: 16, dir: -1, facing: 'right',
  },
  {
    id: 'xpulse-210', name: 'Ashutosh',
    brand: 'Hero', model: 'Xpulse 210', cc: 210, character: 'Adventure', colorName: 'White',
    glow: '#9fb6d6', frames: 12, dir: -1, facing: 'right',
  },
  {
    id: 'tvs-raider-125', name: 'Aryan',
    brand: 'TVS', model: 'Raider 125', cc: 124, character: 'Everyday street', colorName: 'Striking Red',
    glow: '#e0413a', frames: 8, dir: -1, facing: 'right',
  },
  {
    id: 'cb125-hornet', name: 'Pawan',
    brand: 'Honda', model: 'CB125 Hornet', cc: 123, character: 'Street naked', colorName: 'Black & Yellow',
    glow: '#d6d23a', frames: 24, dir: 1, facing: 'right',
  },
];

export const frameSrc = (riderId: string, i: number) =>
  `/bikes/${riderId}/${String(i).padStart(2, '0')}.webp`;

/** Manifesto — words wrapped in *asterisks* get the accent treatment */
export const MANIFESTO =
  'We are a bunch of people who love the road and *each other’s company*. Sunday sunrise rides, chai at roadside dhabas, picnics by the lake. *No ego, no jealousy.* Any bike, any cc, everyone is welcome. Ride kind, ride chill, and *treat every rider like one of our own.*';

export const SUNDAY = [
  { time: '05:30', title: 'Kit up', body: 'Helmet on. Jacket zipped.' },
  { time: '06:00', title: 'Meet up', body: 'Meet the group. Quick briefing.' },
  { time: '06:30', title: 'Open road', body: 'Steady pace. Stay in formation.' },
  { time: '08:00', title: 'Breakfast', body: 'Chai and poha.' },
  { time: '10:00', title: 'Ride destination', body: 'A break by the lake.' },
  { time: '11:30', title: 'Home safe', body: 'Check in once you’re home.' },
];

export const BEYOND = ['Lake-side picnics', 'Monsoon rides', 'Weekend trips', 'Night city loops', 'Ride-safe sessions'];

export type Destination = {
  id: string;
  name: string;
  lat: number;
  lon: number;
  km: number;
  vibe: string;
  kind: 'Sunday morning' | 'Full day' | 'Weekend';
};

export const HOME = { name: 'Bhopal', lat: 23.2599, lon: 77.4126 };

/** Road distances are rough, from the city centre */
export const DESTINATIONS: Destination[] = [
  { id: 'kerwa', name: 'Kerwa Dam', lat: 23.168, lon: 77.355, km: 20, vibe: 'Green roads and a lakeside stop.', kind: 'Sunday morning' },
  { id: 'bhojpur', name: 'Bhojpur', lat: 23.0983, lon: 77.5797, km: 30, vibe: 'A ride out to Bhojeshwar temple.', kind: 'Sunday morning' },
  { id: 'kolar', name: 'Kolar Dam', lat: 22.9643, lon: 77.3369, km: 40, vibe: 'Forest roads and reservoir views.', kind: 'Sunday morning' },
  { id: 'bhimbetka', name: 'Bhimbetka', lat: 22.9387, lon: 77.6122, km: 45, vibe: 'Rock shelters and a walk after the ride.', kind: 'Sunday morning' },
  { id: 'raisen', name: 'Raisen Fort', lat: 23.33, lon: 77.788, km: 45, vibe: 'A hilltop fort overlooking Raisen.', kind: 'Sunday morning' },
  { id: 'sanchi', name: 'Sanchi', lat: 23.4793, lon: 77.7398, km: 50, vibe: 'A day out at the stupas.', kind: 'Full day' },
  { id: 'pachmarhi', name: 'Pachmarhi', lat: 22.4674, lon: 78.4346, km: 200, vibe: 'A weekend in the Satpura hills.', kind: 'Weekend' },
];

export const CODE = ['Helmet, always', 'Ride in formation', 'Respect everyone', 'No stunts on public roads'];
