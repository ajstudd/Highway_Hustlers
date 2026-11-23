import { LoaderCircle } from 'lucide-react';
import './loading.css';

export function LoadingSpinner({ size = 18 }: { size?: number }) {
  return <LoaderCircle size={size} className="hh-loading-spinner" aria-hidden="true"/>;
}

export function LoadingStatus({ label, floating = false }: { label: string; floating?: boolean }) {
  return <p className={`hh-loading-status${floating ? ' hh-loading-toast' : ''}`} role="status"><LoadingSpinner/>{label}</p>;
}
