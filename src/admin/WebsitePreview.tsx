import { useLayoutEffect, useRef, type MouseEvent } from 'react';
import { ArrowLeft, SlidersHorizontal } from 'lucide-react';
import { PublicSite } from '../components/PublicSite';
import type { PublicSnapshot } from '../lib/public-content';

export default function WebsitePreview({ snapshot, count, chooseDrafts, back }: {
  snapshot: PublicSnapshot; count: number; chooseDrafts: () => void; back: () => void;
}) {
  const heading = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const position = window.scrollY;
    document.body.classList.add('website-preview-open');
    window.scrollTo({ top: 0, behavior: 'instant' });
    heading.current?.focus({ preventScroll: true });
    return () => {
      document.body.classList.remove('website-preview-open');
      window.scrollTo({ top: position, behavior: 'instant' });
    };
  }, []);

  function navigate(event: MouseEvent<HTMLDivElement>) {
    if (event.defaultPrevented || event.button !== 0 || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (!(event.target instanceof Element)) return;
    const link = event.target.closest<HTMLAnchorElement>('a[href]');
    if (!link || link.target || link.hasAttribute('download')) return;
    event.preventDefault();
    const href = link.getAttribute('href')!;
    if (href.startsWith('#')) document.getElementById(href.slice(1))?.scrollIntoView();
    else window.open(link.href, '_blank', 'noopener,noreferrer');
  }

  return <div className="website-preview">
    <aside className="hh-admin website-preview-controls" aria-label="Website preview controls">
      <div><strong ref={heading} tabIndex={-1}>Website preview</strong><p className="admin-muted" role="status">{count ? `${count} draft ${count === 1 ? 'change' : 'changes'} shown` : 'Current website'}</p></div>
      <div className="website-preview-actions">
        <button type="button" aria-haspopup="dialog" className="admin-primary" onClick={chooseDrafts}><SlidersHorizontal size={16}/> Choose drafts</button>
        <button type="button" onClick={back}><ArrowLeft size={16}/> Back to review</button>
      </div>
    </aside>
    <div onClick={navigate}><PublicSite snapshot={snapshot}/></div>
  </div>;
}
