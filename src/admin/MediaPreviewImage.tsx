import { useState, type ImgHTMLAttributes } from 'react';
import { LoadingSpinner } from '../components/Loading';

export default function MediaPreviewImage({ src, alt, ...props }: ImgHTMLAttributes<HTMLImageElement> & { src: string; alt: string }) {
  const [result, setResult] = useState<{ src: string; ok: boolean } | null>(null);
  const loaded = result?.src === src;
  return <span className="admin-preview-image" data-loaded={loaded && result.ok}>
    <img {...props} src={src} alt={alt} onLoad={() => setResult({ src, ok: true })} onError={() => setResult({ src, ok: false })}/>
    {!loaded && <span className="admin-preview-image-status"><LoadingSpinner size={21}/><span className="sr-only">Loading image</span></span>}
    {loaded && !result.ok && <span className="admin-preview-image-status">Image unavailable</span>}
  </span>;
}
