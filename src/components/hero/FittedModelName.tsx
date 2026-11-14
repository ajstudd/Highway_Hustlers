import { useLayoutEffect,useRef } from 'react';

/** Keep the actual typeface/letter proportions, fitting its measured width rather
 * than assuming every model name fits the same viewport-relative font size. */
export function FittedModelName({model}:{model:string}) {
  const box=useRef<HTMLDivElement>(null),text=useRef<HTMLSpanElement>(null);
  useLayoutEffect(()=>{
    let active=true;
    const fit=()=>{
      if(!active||!box.current||!text.current)return;
      const available=box.current.clientWidth-4;
      if(available<=0)return;
      const maximum=Math.min(window.innerWidth*.17,260);
      // offsetWidth ignores the fade-up transform. Text width is not perfectly
      // proportional to font size (glyph rounding), so correct a second time.
      let size=maximum;
      for(let pass=0;pass<3;pass++){
        text.current.style.fontSize=`${size}px`;
        const measured=text.current.offsetWidth;
        if(measured<=available)break;
        size=size*available/Math.max(1,measured)-(pass?0.5:0);
      }
    };
    fit();const observer=new ResizeObserver(fit);if(box.current)observer.observe(box.current);
    void document.fonts.ready.then(fit);document.fonts.addEventListener('loadingdone',fit);
    return()=>{active=false;observer.disconnect();document.fonts.removeEventListener('loadingdone',fit);};
  },[model]);
  return <div ref={box} aria-hidden="true" className="hero-model-backdrop ghost-text fade-up pointer-events-none absolute inset-x-4 top-[30%] select-none text-center font-display font-extrabold leading-[1.1] tracking-tight sm:inset-x-8"><span ref={text} className="inline-block whitespace-nowrap text-[min(17vw,260px)]">{model.toUpperCase()}</span></div>;
}
