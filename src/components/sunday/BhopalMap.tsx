import { geographicPosition, projectRoutePoint, ROUTE_OUTLINE, routePath, ROUTE_PLACES, waypoints } from './geography';

/** Broadcast-style route HUD. Real road geometry, without a tile-map UI. */
export function BhopalMap({ progress, chapter, onSeek }: { progress: number; chapter: number; onSeek: (index: number) => void }) {
  const current = geographicPosition(progress);
  const formation = [0, .009, .018].map(offset => projectRoutePoint(geographicPosition(Math.max(0, progress-offset)).point));
  const active = chapter===5 ? 0 : chapter;

  return <div className="sunday-route-hud" onPointerMove={event=>event.stopPropagation()}>
    <svg viewBox="0 0 220 184" aria-label="Example Bhopal to Kerwa loop with live rider positions" role="group">
      <title>Real Bhopal road route · scroll to follow the ride</title>
      <g fill="none" strokeLinecap="round" strokeLinejoin="round" pointerEvents="none">
        <path className="sunday-hud-road-shadow" d={ROUTE_OUTLINE} />
        <path className="sunday-hud-road" d={ROUTE_OUTLINE} />
        <path className="sunday-hud-traveled" d={routePath(current.traveled)} />
      </g>
      {waypoints.slice(0,5).map((point,index) => {
        const [x,y]=projectRoutePoint(point);
        const destination=index===0 && chapter===5 ? 5 : index;
        return <g key={index} className={'sunday-hud-stop'+(active===index ? ' is-active' : '')} role="button" tabIndex={0} aria-label={'Go to '+ROUTE_PLACES[destination]} onClick={()=>onSeek(destination)} onKeyDown={event=>{
          if(event.key==='Enter' || event.key===' ') { event.preventDefault(); onSeek(destination); }
        }}>
          <title>{ROUTE_PLACES[destination]}</title>
          <circle className="sunday-hud-hit" cx={x} cy={y} r="13" />
          <circle className="sunday-hud-stop-dot" cx={x} cy={y} r="2.7" />
        </g>;
      })}
      <g className="sunday-hud-riders" aria-hidden="true" pointerEvents="none">
        {formation.slice().reverse().map(([x,y],index)=><circle key={index} cx={x} cy={y} r={index===2 ? 5 : 3.1} className={index===2 ? 'sunday-hud-lead' : 'sunday-hud-follow'} />)}
      </g>
    </svg>
  </div>;
}
