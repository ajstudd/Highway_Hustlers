import { useEffect, useState, type KeyboardEvent } from 'react';
import { Bike, CalendarDays, Check, ClipboardCheck, Link2, Mail, Trash2, UserRound, UserPlus, X } from 'lucide-react';
import { cmsRequest } from '../lib/gallery';
import { LoadingStatus } from '../components/Loading';
import type { MemberAccount } from '../member/api';
import RideEnrolments, { type MemberRide, type MembershipAction } from './RideEnrolments';
import './membership.css';

type WorkspaceAccount = MemberAccount & { canRemove: boolean };
type LibraryBike = { id: string; brand: string; model: string; colorName: string; frames: number; status: string };
type HeroMember = { id: string; name: string; active: boolean; bikes: number; accountId: string | null };
type Workspace = { accounts: WorkspaceAccount[]; allowed: string[]; rides: MemberRide[]; bikes: LibraryBike[]; heroMembers: HeroMember[] };

const tabs = [
  { id: 'requests', label: 'Requests', title: 'Membership requests', icon: ClipboardCheck },
  { id: 'emails', label: 'Allowed emails', title: 'Allowed emails', icon: Mail },
  { id: 'rides', label: 'Ride enrolments', title: 'Ride enrolments', icon: CalendarDays },
  { id: 'bikes', label: 'Bike requests', title: 'Dream bike requests', icon: Bike },
  { id: 'profiles', label: 'Profile links', title: 'Link profiles to hero members', icon: Link2 },
  { id: 'accounts', label: 'Non-members', title: 'Signed in without membership', icon: UserRound },
] as const;
type Tab = typeof tabs[number]['id'];
const desktopNavigation = '(min-width: 900px)';

export default function MembershipEditor() {
  const [data, setData] = useState<Workspace | null>(null);
  const [tab, setTab] = useState<Tab>('requests');
  const [rideId, setRideId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [verticalTabs, setVerticalTabs] = useState(() => window.matchMedia(desktopNavigation).matches);

  async function load() {
    setData(await cmsRequest<Workspace>('membership'));
  }

  async function refresh() {
    setError('');
    try { await load(); }
    catch (error) { setError(error instanceof Error ? error.message : 'Could not load membership.'); }
  }

  useEffect(() => { void refresh(); }, []);
  useEffect(() => {
    const query = window.matchMedia(desktopNavigation);
    const update = (event: MediaQueryListEvent) => setVerticalTabs(event.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  const action: MembershipAction = async (route, body, message) => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await cmsRequest(route, { method: 'POST', body: JSON.stringify(body) });
      setNotice(message);
      await refresh();
      return true;
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Please try again.');
      return false;
    } finally { setBusy(false); }
  };

  function changeTab(next: Tab) {
    setTab(next);
    if (data) { setNotice(''); setError(''); }
  }

  function navigateTabs(event: KeyboardEvent<HTMLDivElement>) {
    const index = tabs.findIndex(item => item.id === tab);
    const previous = (index + tabs.length - 1) % tabs.length;
    const following = (index + 1) % tabs.length;
    const nextIndex = { ArrowLeft: previous, ArrowUp: previous, ArrowRight: following, ArrowDown: following, Home: 0, End: tabs.length - 1 }[event.key];
    if (nextIndex === undefined) return;
    event.preventDefault();
    const next = tabs[nextIndex].id;
    changeTab(next);
    event.currentTarget.querySelector<HTMLButtonElement>(`#membership-tab-${next}`)?.focus();
  }

  const isMember = (account: WorkspaceAccount) => account.status === 'approved' && !!data?.allowed.includes(account.email);
  const pending = data?.accounts.filter(account => account.status === 'pending') ?? [];
  const panels = data ? {
    requests: <Requests accounts={pending} busy={busy} action={action}/>,
    emails: <AllowedEmails allowed={data.allowed} busy={busy} action={action}/>,
    rides: <RideEnrolments rides={data.rides} accounts={data.accounts} allowed={data.allowed} selected={rideId} select={setRideId} busy={busy} action={action}/>,
    bikes: <BikeRequests accounts={data.accounts.filter(account => account.dreamBikeName)} bikes={data.bikes} busy={busy} action={action}/>,
    profiles: <ProfileLinks accounts={data.accounts.filter(isMember)} bikes={data.bikes} heroMembers={data.heroMembers} busy={busy} action={action}/>,
    accounts: <NonMembers accounts={data.accounts.filter(account => !isMember(account))} busy={busy} action={action}/>,
  } : null;

  return <section className="admin-membership" aria-labelledby="membership-heading">
    <header className="membership-heading">
      <h1 id="membership-heading">Membership &amp; enrolments</h1>
      <p>Membership and enrolment changes take effect immediately.</p>
    </header>
    <div className="membership-workspace">
      <div className="membership-tabs" role="tablist" aria-label="Membership sections" aria-orientation={verticalTabs ? 'vertical' : 'horizontal'} onKeyDown={navigateTabs}>
        {tabs.map(({ id, label, icon: Icon }) => <button key={id} type="button" role="tab" id={`membership-tab-${id}`} aria-controls={`membership-panel-${id}`} aria-selected={id === tab} tabIndex={id === tab ? 0 : -1} onClick={() => changeTab(id)}>
          <Icon size={18} aria-hidden="true"/><span>{label}</span>
          {id === 'requests' && pending.length > 0 && <span className="membership-tab-count" aria-hidden="true">{pending.length}</span>}
        </button>)}
      </div>
      {tabs.map(({ id, title }) => <section key={id} className="membership-panel" id={`membership-panel-${id}`} role="tabpanel" aria-labelledby={`membership-tab-${id}`} hidden={id !== tab} tabIndex={0}>
        {id === tab && <>
          <header className="membership-panel-heading"><h2>{title}</h2>{id === 'requests' && data && <p>{pending.length} pending</p>}</header>
          <div className="membership-panel-body">
            <div className="membership-feedback" aria-live="polite">
              {error && <p className="admin-error" role="alert">{error}</p>}
              {!busy && notice && <p className="admin-success" role="status"><Check size={16}/>{notice}</p>}
            </div>
            {data ? panels?.[id] : error ? <button type="button" onClick={() => void refresh()}>Retry loading membership</button> : <div className="membership-empty"><LoadingStatus label="Loading membership…"/></div>}
          </div>
        </>}
      </section>)}
    </div>
    {busy && <LoadingStatus label="Saving membership changes…" floating/>}
  </section>;
}

function AccountDetails({ account }: { account: MemberAccount }) {
  return <div className="membership-person">
    <h3>{account.name || 'Profile incomplete'}</h3><p>{account.email}</p>
    {account.phone && <p className="admin-muted">{account.phone}</p>}
    <p className="admin-muted">{account.bikeName || 'Bike details not added'}{account.bikeColour && ` · ${account.bikeColour}`}{account.bikeNickname && ` · ${account.bikeNickname}`}</p>
  </div>;
}

function Requests({ accounts, busy, action }: { accounts: WorkspaceAccount[]; busy: boolean; action: MembershipAction }) {
  return <>
    {!accounts.length && <p className="membership-empty">No requests waiting.</p>}
    <div className="membership-list">{accounts.map(account => <article className="membership-row" key={account.id}>
      <AccountDetails account={account}/>
      <div className="membership-row-actions">
        <button type="button" className="membership-quiet" disabled={busy} onClick={() => { if (window.confirm(`Decline ${account.name}’s membership request?`)) void action('membership', { operation: 'reject', accountId: account.id }, 'Request declined.'); }}>Decline</button>
        <button type="button" className="admin-primary" disabled={busy} onClick={() => void action('membership', { operation: 'approve', accountId: account.id }, 'Member approved.')}><Check size={16}/> Approve</button>
      </div>
    </article>)}</div>
  </>;
}

function AllowedEmails({ allowed, busy, action }: { allowed: string[]; busy: boolean; action: MembershipAction }) {
  const [email, setEmail] = useState('');
  return <>
    <p className="membership-intro">Add an existing member’s Google account email to approve them before their first sign-in.</p>
    <form className="membership-form membership-task" onSubmit={async event => {
      event.preventDefault();
      if (await action('membership', { operation: 'allow', email }, 'Email approved.')) setEmail('');
    }}>
      <label>Google account email<input type="email" required maxLength={254} value={email} onChange={event => setEmail(event.target.value)} disabled={busy}/></label>
      <button className="admin-primary" disabled={busy || !email}><UserPlus size={16}/> Allow email</button>
    </form>
    {!allowed.length && <p className="membership-empty">No emails on the list yet.</p>}
    <ul className="membership-list">{allowed.map(email => <li className="membership-row" key={email}>
      <span>{email}</span><button type="button" aria-label={`Remove allowed email ${email}`} disabled={busy} onClick={() => {
        if (window.confirm(`Pause membership for ${email}? Their open ride entries will also be removed.`)) void action('membership', { operation: 'remove-allow', email }, 'Membership access paused.');
      }}><X size={15}/> Remove</button>
    </li>)}</ul>
  </>;
}

function BikeRequests({ accounts, bikes, busy, action }: { accounts: WorkspaceAccount[]; bikes: LibraryBike[]; busy: boolean; action: MembershipAction }) {
  return <>
    {!accounts.length && <p className="membership-empty">No dream bike requests yet.</p>}
    <div className="membership-list">{accounts.map(account => <article className="membership-row membership-assignment-row" key={account.id}>
      <div><h3>{account.name || account.email}</h3><p>{account.dreamBikeName}</p><p className="admin-muted">{account.dreamBikeId ? 'Display assigned' : 'Awaiting a bike display'}</p></div>
      <DreamAssignment key={`${account.id}-${account.dreamBikeName}-${account.dreamBikeId}`} account={account} bikes={bikes} busy={busy} save={bikeId => action('dream-bike', { accountId: account.id, bikeId, expectedName: account.dreamBikeName }, 'Dream bike display updated.')}/>
    </article>)}</div>
  </>;
}

function ProfileLinks({ accounts, bikes, heroMembers, busy, action }: {
  accounts: WorkspaceAccount[]; bikes: LibraryBike[]; heroMembers: HeroMember[]; busy: boolean; action: MembershipAction;
}) {
  const [accountId, setAccountId] = useState('');
  const account = accounts.find(item => item.id === accountId);
  return <>
    <p className="membership-intro">A connected profile uses the bikes assigned to that hero member. You can also link bikes from the library.</p>
    {accounts.length ? <div className="membership-picker"><label>Member profile
      <select value={account?.id ?? ''} disabled={busy} onChange={event => setAccountId(event.target.value)}>
        <option value="">Choose an approved member</option>
        {accounts.map(item => <option key={item.id} value={item.id}>{item.name ? `${item.name} · ` : ''}{item.email}</option>)}
      </select>
    </label></div> : <p className="membership-empty">No approved members yet.</p>}
    {account && <article className="membership-profile">
      <AccountDetails account={account}/>
      <ProfileBikeAssignment key={account.id} account={account} bikes={bikes} heroMembers={heroMembers} busy={busy}
        connect={heroMemberId => action('hero-member', { accountId: account.id, heroMemberId }, heroMemberId ? 'Profile connected to the hero member.' : 'Hero member disconnected.')}
        change={(operation, bikeId) => action('profile-bike', { accountId: account.id, operation, bikeId }, operation === 'link' ? 'Bike linked to the profile.' : 'Bike unlinked from the profile.')}/>
    </article>}
  </>;
}

const accessLabel = { new: 'Profile incomplete', pending: 'Membership request pending', rejected: 'Request declined', suspended: 'Membership paused', approved: 'Email access paused' };

function NonMembers({ accounts, busy, action }: { accounts: WorkspaceAccount[]; busy: boolean; action: MembershipAction }) {
  return <>
    {!accounts.length && <p className="membership-empty">No signed-in non-members.</p>}
    <ul className="membership-list">{accounts.map(account => <li className="membership-row" key={account.id}>
      <div><strong>{account.name || account.email}</strong>{account.name && <p>{account.email}</p>}<p className="admin-muted">{account.status === 'new' && account.profileComplete ? 'Membership unconfirmed' : accessLabel[account.status]}</p></div>
      {account.canRemove && <button type="button" className="admin-danger" disabled={busy} aria-label={`Remove unconfirmed account ${account.email}`} onClick={() => {
        if (window.confirm(`Remove the profile for ${account.email} and end its HHR sessions? They can sign in later to create a new profile.`)) void action('membership', { operation: 'remove-account', accountId: account.id }, 'Unconfirmed account removed.');
      }}><Trash2 size={15}/> Remove account</button>}
    </li>)}</ul>
  </>;
}

function ProfileBikeAssignment({ account, bikes, heroMembers, busy, connect, change }: {
  account: MemberAccount; bikes: LibraryBike[]; heroMembers: HeroMember[]; busy: boolean;
  connect: (heroMemberId: string) => Promise<boolean>; change: (operation: 'link' | 'unlink', bikeId: string) => Promise<boolean>;
}) {
  const [bikeId, setBikeId] = useState('');
  const [heroId, setHeroId] = useState(account.heroMemberId || '');
  useEffect(() => setHeroId(account.heroMemberId || ''), [account.heroMemberId]);
  const owned = account.bikes.filter(bike => bike.bikeId);
  const available = bikes.filter(bike => !owned.some(item => item.bikeId === bike.id));
  const full = owned.length >= 6;
  const sameName = (member: HeroMember) => !!account.name && member.name.trim().toLowerCase() === account.name.trim().toLowerCase();
  const choices = heroMembers.filter(member => !member.accountId || member.accountId === account.id).sort((a, b) => Number(sameName(b)) - Number(sameName(a)));
  const current = heroMembers.find(member => member.id === account.heroMemberId);
  return <div className="membership-profile-actions">
    <form className="membership-form" onSubmit={event => { event.preventDefault(); void connect(heroId); }}>
      <label>Hero member{current && <span className="admin-muted">Connected to {current.name}</span>}
        <select disabled={busy} value={heroId} onChange={event => setHeroId(event.target.value)}><option value="">Not connected</option>{choices.map(member => <option key={member.id} value={member.id}>{member.name} · {member.bikes} {member.bikes === 1 ? 'bike' : 'bikes'}{sameName(member) ? ' · same name' : ''}{member.active ? '' : ' · inactive'}</option>)}</select>
      </label>
      <button disabled={busy || heroId === (account.heroMemberId || '')}>{heroId ? 'Connect' : 'Disconnect'}</button>
    </form>
    {!!owned.length && <ul className="membership-linked-bikes" aria-label={`Bikes on ${account.name || account.email}’s profile`}>{owned.map(bike => <li key={bike.bikeId}>
      <span>{bike.bikeName} · {bike.bikeColour}{bike.bikeNickname && <em> · {bike.bikeNickname}</em>}</span>
      {bike.source === 'hero' ? <span className="admin-muted">Hero lineup</span> : <button type="button" disabled={busy} aria-label={`Unlink ${bike.bikeName} from ${account.name || account.email}`} onClick={() => void change('unlink', bike.bikeId!)}><X size={15}/> Unlink</button>}
    </li>)}</ul>}
    <form className="membership-form" onSubmit={async event => { event.preventDefault(); if (bikeId && await change('link', bikeId)) setBikeId(''); }}>
      <label>{owned.length ? 'Link another bike' : 'Link a library bike'}
        <select disabled={busy || full} value={bikeId} onChange={event => setBikeId(event.target.value)}><option value="">{full ? 'Six bikes on this profile' : 'Choose a library bike'}</option>{available.map(bike => <option key={bike.id} value={bike.id}>{bike.brand} {bike.model} · {bike.colorName} · {bike.frames > 1 ? `${bike.frames} views` : 'single photo'}</option>)}</select>
      </label>
      <button disabled={busy || !bikeId}>Link bike</button>
    </form>
  </div>;
}

function DreamAssignment({ account, bikes, busy, save }: { account: MemberAccount; bikes: LibraryBike[]; busy: boolean; save: (bikeId: string) => Promise<boolean> }) {
  const [id, setId] = useState(account.dreamBikeId || '');
  return <form className="membership-form" onSubmit={event => { event.preventDefault(); void save(id); }}>
    <label>Dream bike display
      <select value={id} disabled={busy} onChange={event => setId(event.target.value)}><option value="">No display assigned</option>{bikes.filter(bike => bike.frames > 1).map(bike => <option key={bike.id} value={bike.id}>{bike.brand} {bike.model} · {bike.colorName} · {bike.frames} views</option>)}</select>
    </label>
    <button disabled={busy || id === (account.dreamBikeId || '')}>Save display</button>
  </form>;
}
