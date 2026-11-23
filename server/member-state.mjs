import { sessionToken } from './security.mjs';

export const emptyMemberState = () => ({ accounts: [], allowed: [], rides: [], notifications: [] });
export async function mutateMembers(db, change, options) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const row = await db.getMemberState();
    const state = structuredClone(row.state), result = change(state);
    if (Buffer.byteLength(JSON.stringify(state)) > 1500000) throw Error('The member workspace is full. Ask the administrator to archive old records.');
    if (await db.saveMemberState(state, row.revision, options)) return result;
  }
  throw Error('Another member update is running. Please try again.');
}
export const emailOf = value => {
  if (typeof value !== 'string' || value.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) throw Error('Enter a valid email address.');
  return value.trim().toLowerCase();
};
export function notice(state, title, message, recipient = null) {
  state.notifications.unshift({ id: sessionToken().slice(0,24), title, message, recipient, createdAt: new Date().toISOString() });
  state.notifications = state.notifications.slice(0,200);
}
export const completeProfile = account => !!account.name.trim() && /^\+?[\d ()-]{7,24}$/.test(account.phone) && account.phone.replace(/\D/g,'').length>=7;
export const approved = (state, account) => account.status === 'approved' && state.allowed.includes(account.email);
export function canRemoveUnconfirmedAccount(state, account) {
  return ['new', 'pending', 'rejected'].includes(account.status)
    && !account.membershipConfirmed && !state.allowed.includes(account.email)
    && !account.heroMemberId && !account.bikeId && !account.bikeIds?.length
    && !state.rides.some(ride => ride.participants.includes(account.id) || ride.bikeChoices?.[account.id]);
}
export function signInAccount(state, identity) {
  let account = state.accounts.find(a => a.sub === identity.sub);
  if (!account) {
    if (state.accounts.length >= 500) throw Error('Member registration is temporarily full. Please contact HHR.');
    account = { id: sessionToken().slice(0,24), sub: identity.sub, email: identity.email, name: identity.name, phone: '', photo: identity.photo || '', bikeIds:[],bikeNicknames:{},bikeName:'',bikeColour:'',bikeNickname:'',status: 'new', requestedAt: null, joinedAt: new Date().toISOString(), seenAt: '' };
    state.accounts.push(account);
  }
  if (['approved', 'suspended'].includes(account.status)) account.membershipConfirmed = true;
  // Email changes must be re-approved; Google subject, not email, is identity.
  if (account.email !== identity.email) { account.email = identity.email; account.status = 'new'; for(const ride of state.rides.filter(r=>r.status==='open'))ride.participants=ride.participants.filter(id=>id!==account.id); }
  if (state.allowed.includes(account.email) && !['rejected','suspended'].includes(account.status)) {
    account.status = 'approved'; account.membershipConfirmed = true;
  }
  return account.id;
}
export function publicAccount(account) {
  const { sub, membershipConfirmed, ...safe } = account; return { bikeId:null,bikeIds:[],bikes:[],bikeName:'',bikeColour:'',bikeNickname:'',...safe, profileComplete: completeProfile(account) };
}
export async function syncPublishedRide(db, ride, revision) {
  const existing=await db.getMemberState();
  if(ride?.id&&existing.state.rides.some(r=>r.id===ride.id&&['cancelled','completed'].includes(r.status)))return;
  if(ride?.id&&existing.state.rides.some(r=>r.id===ride.id&&r.status==='open'&&r.revision===revision))return;
  if(!ride?.id&&!existing.state.rides.some(r=>r.status==='open'))return;
  return mutateMembers(db, state => {
    const current = state.rides.find(r => r.status === 'open');
    if (current && current.id !== ride?.id) { current.status = 'closed'; notice(state, 'Ride closed', `${current.details.location} is no longer accepting entries.`); }
    if (!ride?.id || !ride.published) return;
    let entry = state.rides.find(r => r.id === ride.id);
    if (entry && ['cancelled','completed'].includes(entry.status)) throw Error('This ride is closed. Create a new ride before publishing it again.');
    if (!entry) {
      if (state.rides.length >= 150) throw Error('The ride archive is full. Contact the administrator before publishing a new ride.');
      entry = { id: ride.id, details: ride, status: 'open', participants: [], createdAt: new Date().toISOString(), revision };
      state.rides.push(entry); notice(state, 'New ride', `${ride.location}${ride.date ? ` · ${ride.date}` : ''}. Join from your HHR profile.`);
    } else {
      const changed = JSON.stringify(entry.details) !== JSON.stringify(ride) || entry.status !== 'open';
      entry.details = ride; entry.status = 'open'; entry.revision = revision;
      if (changed) notice(state, 'Ride updated', `${ride.location}: check the latest meeting details before you leave.`);
    }
  });
}
