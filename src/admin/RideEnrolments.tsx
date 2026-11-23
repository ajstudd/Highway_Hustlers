import { useState } from 'react';
import { Check, RefreshCw, UserPlus, X } from 'lucide-react';
import type { UpcomingRide } from '../../shared/upcoming-ride.mjs';
import type { MemberAccount } from '../member/api';

export type MemberRide = { id: string; details: UpcomingRide; status: 'open' | 'closed' | 'completed' | 'cancelled'; participants: MemberAccount[] };
export type MembershipAction = (route: string, body: unknown, message: string) => Promise<boolean>;

const rideStatus = { open: 'Upcoming', closed: 'Enrolment closed', completed: 'Completed', cancelled: 'Cancelled' };
const dateFormat = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
const rideDate = (ride: MemberRide) => ride.details.date ? dateFormat.format(new Date(`${ride.details.date}T12:00:00+05:30`)) : 'Date not set';

export default function RideEnrolments({ rides, accounts, allowed, selected, select, busy, action }: {
  rides: MemberRide[]; accounts: MemberAccount[]; allowed: string[]; selected: string;
  select: (id: string) => void; busy: boolean; action: MembershipAction;
}) {
  const ride = rides.find(item => item.id === selected);
  const today = new Date(Date.now() + 19_800_000).toISOString().slice(0, 10);
  const groups: Record<'upcoming' | 'past' | 'cancelled', MemberRide[]> = { upcoming: [], past: [], cancelled: [] };
  for (const item of [...rides].reverse()) {
    const isPast = item.status === 'completed' || (!!item.details.date && item.details.date < today);
    groups[item.status === 'cancelled' ? 'cancelled' : isPast ? 'past' : 'upcoming'].push(item);
  }

  return <>
    <h2>Ride enrolments</h2>
    {rides.length ? <div className="admin-allow-form">
      <label>Ride
        <select value={ride?.id ?? ''} onChange={event => select(event.target.value)} disabled={busy}>
          <option value="">Choose a ride</option>
          {([['upcoming', 'Upcoming and current rides'], ['past', 'Past rides'], ['cancelled', 'Cancelled rides']] as const).map(([group, label]) => groups[group].length > 0 && <optgroup key={group} label={label}>
            {groups[group].map(item => <option key={item.id} value={item.id}>{item.details.location} · {rideDate(item)}</option>)}
          </optgroup>)}
        </select>
      </label>
    </div> : <p className="admin-muted admin-field-note">Published rides appear here when member enrolment is available.</p>}
    {ride && <RideRosterEditor key={ride.id} ride={ride} statusLabel={ride.status === 'open' && groups.past.includes(ride) ? 'Past ride' : rideStatus[ride.status]} accounts={accounts} allowed={allowed} busy={busy} action={action}/>}
    <div className="admin-field-note">
      <button type="button" disabled={busy} onClick={() => void action('sync-member-ride', {}, 'Published ride synced to member profiles.')}><RefreshCw size={16}/> Sync published ride</button>
    </div>
  </>;
}

function RideRosterEditor({ ride, statusLabel, accounts, allowed, busy, action }: {
  ride: MemberRide; statusLabel: string; accounts: MemberAccount[]; allowed: string[]; busy: boolean; action: MembershipAction;
}) {
  const [accountId, setAccountId] = useState('');
  const enrolled = new Set(ride.participants.map(account => account.id));
  const candidates = accounts.filter(account => account.profileComplete && !enrolled.has(account.id));
  const members = candidates.filter(account => account.status === 'approved' && allowed.includes(account.email));
  const requests = candidates.filter(account => account.status === 'pending');
  const selected = [...members, ...requests].find(account => account.id === accountId);
  const needsApproval = selected?.status === 'pending';
  const canEdit = ride.status !== 'cancelled';
  const name = ride.details.location;

  async function add() {
    if (!selected) return;
    if (needsApproval && !window.confirm(`Approve ${selected.name}’s HHR membership and add them to ${name}?`)) return;
    const saved = await action('ride-participant', { operation: needsApproval ? 'approve-add' : 'add', rideId: ride.id, accountId: selected.id }, needsApproval ? 'Membership approved and rider added.' : 'Rider added.');
    if (saved) setAccountId('');
  }

  return <details className="admin-member-ride" open>
    <summary><strong>{name}</strong><span className="admin-muted">{rideDate(ride)} · {statusLabel} · {ride.participants.length} enrolled</span></summary>
    {ride.participants.length ? <ul className="admin-ride-roster" aria-label={`Riders on ${name}`}>{ride.participants.map(account => <li key={account.id}>
      <div><strong>{account.name}</strong><p>{account.email} · {account.phone}</p><p className="admin-muted">{account.bikeName || 'Bike details not added'}{account.bikeColour && ` · ${account.bikeColour}`}{account.bikeNickname && ` · ${account.bikeNickname}`}</p></div>
      {canEdit && <button type="button" disabled={busy} aria-label={`Remove ${account.name} from ${name}`} onClick={() => void action('ride-participant', { operation: 'remove', rideId: ride.id, accountId: account.id }, 'Rider removed.')}><X size={15}/> Remove</button>}
    </li>)}</ul> : <p className="admin-muted admin-field-note">No riders enrolled yet.</p>}
    {canEdit && <form className="admin-allow-form" onSubmit={event => { event.preventDefault(); void add(); }}>
      <label>Add a rider
        <select value={selected?.id ?? ''} disabled={busy || (!members.length && !requests.length)} onChange={event => setAccountId(event.target.value)}>
          <option value="">{members.length || requests.length ? 'Choose a rider' : 'No eligible riders to add'}</option>
          {members.length > 0 && <optgroup label="Approved members">{members.map(account => <option value={account.id} key={account.id}>{account.name} · {account.email}</option>)}</optgroup>}
          {requests.length > 0 && <optgroup label="Pending membership requests">{requests.map(account => <option value={account.id} key={account.id}>{account.name} · {account.email}</option>)}</optgroup>}
        </select>
      </label>
      <button className="admin-primary" disabled={busy || !selected}>{needsApproval ? <Check size={16}/> : <UserPlus size={16}/>} {needsApproval ? 'Approve membership & add' : 'Add to ride'}</button>
    </form>}
  </details>;
}
