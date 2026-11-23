import { useEffect, useRef, useState } from 'react';
import { Send, X } from 'lucide-react';
import { LoadingSpinner } from '../components/Loading';
import type { PublishReview } from './types';

export default function PublishReviewDialog({ review, unsaved, local, busy, error, close, confirm }: {
  review: PublishReview; unsaved: string[]; local: boolean; busy: boolean; error: string;
  close: () => void; confirm: (selection: string[]) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [selected, setSelected] = useState<string[]>([]);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);

  function toggle(id: string) {
    const opposite = id === 'ride' ? 'remove-ride' : id === 'remove-ride' ? 'ride' : '';
    setSelected(previous => previous.includes(id) ? previous.filter(item => item !== id) : [...previous.filter(item => item !== opposite), id]);
  }

  function dismiss() {
    if (busy) return;
    dialog.current?.close();
    close();
  }

  const hasDraftChanges = review.changes.some(change => change.id !== 'remove-ride');
  return <dialog ref={dialog} className="admin-library admin-review" aria-labelledby="publish-review-title" onCancel={event => { event.preventDefault(); dismiss(); }}>
    <header><div>
      <h2 id="publish-review-title">Review &amp; publish</h2>
      <p className="admin-muted">Select the changes to publish. Leave other drafts unchecked.</p>
    </div><button type="button" onClick={dismiss} disabled={busy} aria-label="Close publication review"><X size={20}/></button></header>
    {!!unsaved.length && <p className="admin-warning">Unsaved edits are excluded from this review. Save the draft in {unsaved.join(', ')} to review those edits.</p>}
    {review.changes.some(change => change.area === 'Homepage hero') && <p className="admin-muted admin-review-detail">If a lineup change uses a new member or bike, select the matching Hero members or Bike library changes too. Only visible entries with an active member and available bike appear on the homepage.</p>}
    {!hasDraftChanges && <p className="admin-muted admin-review-empty">No saved changes to publish.</p>}
    <ul className="admin-review-list">
      {review.changes.map(change => <li key={change.id}>
        <label className="admin-review-choice">
          <input type="checkbox" disabled={busy || !!change.issue} checked={selected.includes(change.id)} onChange={() => toggle(change.id)}/>
          <span><strong>{change.action} {change.title}</strong><small>{change.area}</small></span>
        </label>
        {change.issue && <p className="admin-review-detail">{change.issue}</p>}
        {!!change.details?.length && <ul className="admin-review-detail">{change.details.map((detail, index) => <li key={index}>{detail}</li>)}</ul>}
      </li>)}
    </ul>
    {error && <p className="admin-error admin-review-error" role="alert">{error}</p>}
    <footer><span className="admin-muted" role="status">{busy ? 'Publishing selected changes…' : `${selected.length} selected`}</span><button type="button" onClick={dismiss} disabled={busy}>Back to drafts</button><button type="button" className="admin-primary" disabled={!selected.length || busy} onClick={() => confirm(selected)}>{busy ? <LoadingSpinner size={16}/> : <Send size={16}/>} {busy ? 'Publishing…' : local ? 'Publish to preview' : 'Publish selected'}</button></footer>
  </dialog>;
}
