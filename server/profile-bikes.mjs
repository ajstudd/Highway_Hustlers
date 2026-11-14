import { publicRiders } from '../shared/garage.mjs';

export const MAX_PROFILE_BIKES = 6;
// Accounts saved before multiple bikes used a single bikeId.
export const linkedBikeIds = account => Array.isArray(account.bikeIds) ? account.bikeIds : account.bikeId ? [account.bikeId] : [];
export const preparedBike = bike => !!(bike?.frames.length && bike.brand && bike.model && bike.colorName);
// The older single nickname belongs to the first linked bike until the member
// gives that bike its own nickname.
const nicknameFor = (account, id, index) => account.bikeNicknames?.[id] ?? (index === 0 ? account.bikeNickname || '' : '');

/** Every bike on a profile: linked library bikes, or the one self-reported bike. */
export function profileBikes(account, garage) {
  const linked = linkedBikeIds(account).map(id => garage.bikes.find(b => b.id === id)).filter(Boolean);
  if (linked.length) return linked.map((b, i) => ({ bikeId: b.id, bikeName: `${b.brand} ${b.model}`.trim(), bikeColour: b.colorName || '', bikeNickname: nicknameFor(account, b.id, i) }));
  return account.bikeName || account.bikeColour || account.bikeNickname ? [{ bikeId: null, bikeName: account.bikeName || '', bikeColour: account.bikeColour || '', bikeNickname: account.bikeNickname || '' }] : [];
}
/** The first bike stays in the flat fields for older screens and admin lists. */
export function profileBikeDetails(account, garage) {
  const bikes = profileBikes(account, garage), [first] = bikes;
  return {
    bikeId: first?.bikeId || null,
    bikeIds: bikes.map(b => b.bikeId).filter(Boolean),
    bikeName: first?.bikeName || '',
    bikeColour: first?.bikeColour || '',
    bikeNickname: first?.bikeNickname || '',
    bikes,
  };
}
export function profileBannerBikes(account, garage) {
  return profileBikes(account, garage).flatMap(entry => {
    const bike = garage.bikes.find(b => b.id === entry.bikeId);
    if (!preparedBike(bike)) return [];
    // Explicit private assignment may use a prepared draft without publishing it
    // to the public hero. Only this account's selected asset sets are returned.
    const rider = publicRiders({ members: [{ id: 'profile-owner', name: account.name || 'Your bike', active: true }], bikes: [{ ...bike, status: 'published' }], lineup: [{ id: `profile-${bike.id}`, memberId: 'profile-owner', bikeId: bike.id, visible: true }] })[0];
    return rider ? [{ rider, nickname: entry.bikeNickname }] : [];
  });
}
/** The bike a participant chose for this ride, falling back to their first. */
export function ridingBike(account, ride, garage) {
  const bikes = profileBikes(account, garage), chosen = ride.bikeChoices?.[account.id];
  const { bikeName = '', bikeColour = '', bikeNickname = '' } = bikes.find(b => chosen && b.bikeId === chosen) || bikes[0] || {};
  return { bikeName, bikeColour, bikeNickname };
}
export function rideRoster(state, ride, viewer, garage) {
  if (viewer.status !== 'approved' || !state.allowed.includes(viewer.email)) return [];
  return ride.participants.flatMap(id => {
    const member = state.accounts.find(a => a.id === id);
    if (!member || member.status !== 'approved' || !state.allowed.includes(member.email)) return [];
    // Deliberate projection, not a profile spread: no email, phone, photo,
    // Google subject, account ID, library assets or moderation state here.
    return [{ name: member.name, ...ridingBike(member, ride, garage) }];
  });
}
