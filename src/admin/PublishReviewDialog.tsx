import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Eye, Send, X } from 'lucide-react';
import { LoadingSpinner } from '../components/Loading';
import { cmsRequest } from '../lib/gallery';
import { validateSnapshot, type PublicSnapshot } from '../lib/public-content';
import WebsitePreview from './WebsitePreview';
import type { PublishReview } from './types';

export default function PublishReviewDialog({ review, unsaved, local, busy, error, close, confirm }: {
  review: PublishReview; unsaved: string[]; local: boolean; busy: boolean; error: string;
  close: () => void; confirm: (selection: string[]) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [preview, setPreview] = useState<{ snapshot: PublicSnapshot; selection: string[] } | null>(null);
  const [showReview, setShowReview] = useState(true);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const waiting = busy || previewLoading;
  useEffect(() => {
    const element = dialog.current;
    if (!showReview) return;
    element?.showModal();
    return () => element?.close();
  }, [showReview]);

  function toggle(id: string) {
    const opposite = id === 'ride' ? 'remove-ride' : id === 'remove-ride' ? 'ride' : '';
    setSelected(previous => previous.includes(id) ? previous.filter(item => item !== id) : [...previous.filter(item => item !== opposite), id]);
  }

  function dismiss() {
    if (waiting) return;
    dialog.current?.close();
    if (preview) {
      setSelected(preview.selection);
      setPreviewError('');
      setShowReview(false);
    } else close();
  }

  async function showPreview() {
    setPreviewLoading(true);
    setPreviewError('');
    try {
      const { revision, garageRevision, reviewId } = review;
      const result = await cmsRequest<{ snapshot: PublicSnapshot }>('preview-publication', {
        method: 'POST',
        body: JSON.stringify({ revision, garageRevision, reviewId, selection: selected }),
      });
      const snapshot = validateSnapshot(result.snapshot);
      dialog.current?.close();
      setPreview({ snapshot, selection: selected });
      setShowReview(false);
    } catch (failure) {
      setPreviewError(failure instanceof Error ? failure.message : 'Could not load the website preview.');
    } finally { setPreviewLoading(false); }
  }

  const hasDraftChanges = review.changes.some(change => change.id !== 'remove-ride');
  return createPortal(<>
    {preview && <WebsitePreview snapshot={preview.snapshot} count={preview.selection.length}
      chooseDrafts={() => setShowReview(true)} back={() => { setPreview(null); setShowReview(true); }}/>}
    <dialog ref={dialog} className="hh-admin admin-library admin-review" aria-labelledby="publish-review-title" onCancel={event => { event.preventDefault(); dismiss(); }}>
      <header><div>
        <h2 id="publish-review-title">{preview ? 'Choose drafts for preview' : 'Review & publish'}</h2>
        <p className="admin-muted">{preview ? 'Choose which changes to show on the website.' : 'Choose saved changes to preview or publish.'}</p>
      </div><button type="button" onClick={dismiss} disabled={waiting} aria-label={preview ? 'Close draft picker' : 'Close publication review'}><X size={20}/></button></header>
      {!!unsaved.length && <p className="admin-warning">Unsaved edits are excluded from this review. Save the draft in {unsaved.join(', ')} to review those edits.</p>}
      {review.changes.some(change => change.area === 'Homepage hero') && <p className="admin-muted admin-review-detail">If a lineup change uses a new member or bike, select the matching Hero members or Bike library changes too. Only visible entries with an active member and available bike appear on the homepage.</p>}
      {!hasDraftChanges && <p className="admin-muted admin-review-empty">No saved changes to publish.</p>}
      <ul className="admin-review-list">
        {review.changes.map(change => <li key={change.id}>
          <label className="admin-review-choice">
            <input type="checkbox" disabled={waiting || !!change.issue} checked={selected.includes(change.id)} onChange={() => toggle(change.id)}/>
            <span><strong>{change.action} {change.title}</strong><small>{change.area}</small></span>
          </label>
          {change.issue && <p className="admin-review-detail">{change.issue}</p>}
          {!!change.details?.length && <ul className="admin-review-detail">{change.details.map((detail, index) => <li key={index}>{detail}</li>)}</ul>}
        </li>)}
      </ul>
      {(previewError || (!preview && error)) && <p className="admin-error admin-review-error" role="alert">{previewError || error}</p>}
      <footer>
        <span className="admin-muted" role="status">{previewLoading ? 'Preparing website preview…' : busy ? 'Publishing selected changes…' : `${selected.length} selected`}</span>
        <button type="button" onClick={dismiss} disabled={waiting}>{preview ? 'Cancel' : 'Back to drafts'}</button>
        <button type="button" className={preview ? 'admin-primary' : ''} disabled={waiting} onClick={() => void showPreview()}>{previewLoading ? <LoadingSpinner size={16}/> : <Eye size={16}/>} {preview ? 'Update preview' : 'Preview website'}</button>
        {!preview && <button type="button" className="admin-primary" disabled={!selected.length || waiting} onClick={() => confirm(selected)}>{busy ? <LoadingSpinner size={16}/> : <Send size={16}/>} {busy ? 'Publishing…' : local ? 'Publish to local site' : 'Publish selected'}</button>}
      </footer>
    </dialog>
  </>, document.body);
}
