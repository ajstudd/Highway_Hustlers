// Ordered Negro Titanio turntable from TVS Mexico's Apache RR 310 page.
// Keep the manufacturer's sequence; begin at its right-side profile (frame 12).
export const APACHE_TITANIUM_SOURCE = 'https://mexico.tvsmotor.com/es/p/our-products/apache-rr-310-mx';
export const APACHE_TITANIUM_IDS = [
  2605837, 2605839, 2605840, 2605849, 2605850, 2605858,
  2605866, 2605876, 2605877, 2605879, 2605882, 2605883,
  2605884, 2605885, 2605886, 2605888, 2605889, 2605890,
  2605892, 2605893, 2605895, 2605897, 2605899, 2605900,
];
export const apacheTitaniumUrl = i =>
  `https://mexico.tvsmotor.com/o/commerce-media/accounts/-1/images/${APACHE_TITANIUM_IDS[(i + 12) % 24]}?download=false`;
