import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { advanceGame, targetDistance, walkingDuration, type GameInput, type GameState } from './controller';
import { bays, cafeSite, home, sampleRoad } from './route';
import { createGameRider, loadGameAssets } from './bike';
import { buildScenery } from './scenery';
import { advanceCompanion, createCompanion } from './companions';
import { createSkinPaletteSync } from './skinning';

export async function createGameWorld(host: HTMLDivElement, state: GameState, input: GameInput, onUpdate: () => void, signal?: AbortSignal) {
  const template = await loadGameAssets();
  if (!host.isConnected || signal?.aborted) throw new Error('Ride view closed');
  const mobile = host.clientWidth < 700;
  const renderer = new THREE.WebGLRenderer({ antialias: true, stencil: true, powerPreference: 'high-performance', preserveDrawingBuffer: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.25 : 1.6));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = .9;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.setAttribute('aria-hidden', 'true'); host.append(renderer.domElement);
  const scene = new THREE.Scene(); scene.fog = new THREE.Fog('#a6cbc1', 140, 480);
  const camera = new THREE.PerspectiveCamera(53, 1, .15, 1700);
  const hemi = new THREE.HemisphereLight('#c8e4ff', '#617d4d', 1.65); scene.add(hemi);
  const sun = new THREE.DirectionalLight('#ffcf8a', 3.3); sun.castShadow = true;
  sun.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -27, right: 27, top: 27, bottom: -27, near: 1, far: 160 });
  sun.shadow.bias = -.0002; sun.shadow.normalBias = .015;
  scene.add(sun, sun.target);
  const sky = new Sky(); sky.scale.setScalar(1400); scene.add(sky);
  const uniforms = sky.material.uniforms; uniforms.turbidity.value = 2; uniforms.rayleigh.value = 2.6; uniforms.mieCoefficient.value = .003; uniforms.mieDirectionalG.value = .8;
  const scenery = buildScenery(scene, mobile);
  const pmrem = new THREE.PMREMGenerator(renderer);
  let environment: THREE.WebGLRenderTarget | undefined, disposed = false;
  new HDRLoader().load('/ride-environment/sunrise.hdr', hdr => {
    if (!disposed) { environment = pmrem.fromEquirectangular(hdr); scene.environment = environment.texture; scene.environmentIntensity = .72; }
    hdr.dispose();
  }, undefined, () => { /* Hemisphere/sun remain a complete lighting fallback. */ });
  const player = createGameRider(template, true, '#ce9640', '#171b1d');
  let hip:THREE.Object3D|undefined;
  if(import.meta.env.DEV)player.person.group.traverse(object=>{if(object instanceof THREE.Bone&&/Hips$/.test(object.name))hip=object;});
  const hipPoint=new THREE.Vector3();let saddleReference:THREE.Vector3|undefined,maxSaddleDrift=0;
  const companions = [createGameRider(template, false, '#3d7280', '#3c6270'), createGameRider(template, true, '#747d42', '#c4c4b9')];
  scene.add(player.root, ...companions.map(r => r.root));
  scene.onBeforeRender = createSkinPaletteSync([player.person.group, ...companions.map(r => r.person.group)]);
  const headlight = new THREE.SpotLight('#fff0c5', 5, 16, .4, .8, 1.6);
  headlight.position.set(0, .85, .85); headlight.target.position.set(0, .1, 12); player.bike.add(headlight, headlight.target);
  const lookAt = new THREE.Vector3(), cameraPosition = new THREE.Vector3(), targetLook = new THREE.Vector3();
  const sunDirection = new THREE.Vector3(), forward = new THREE.Vector3();
  let last = performance.now(), frame = 0, lastPublish = 0, fpsStart = last, frameCount = 0, lastPhoto = 0, cameraReady = false;
  let posed = false, lastShadow = 0;
  let npcStates = [createCompanion(0), createCompanion(1)];
  let visible = true;
  const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; if (!visible && state.phase !== 'garage') { state.paused = true; input.throttle = input.brake = input.steer = 0; onUpdate(); } }, { threshold: .05 }); observer.observe(host);
  const resize = new ResizeObserver(() => { const width = host.clientWidth, height = host.clientHeight; if (!width || !height) return; renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix(); }); resize.observe(host);
  const lostContext = (event: Event) => { event.preventDefault(); state.paused = true; host.dispatchEvent(new CustomEvent('ride-error', { bubbles: true })); };
  renderer.domElement.addEventListener('webglcontextlost', lostContext);
  if(import.meta.env.DEV)host.dataset.riderRig='shared-lean/current-skin-palette';
  state.ready = true; onUpdate();
  const smooth = (t: number) => THREE.MathUtils.smoothstep(t, 0, 1);
  function tick(now: number) {
    if (disposed) return;
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    if (visible && !document.hidden) {
      const animationStart=performance.now();
      advanceGame(state, input, dt);
      const atStop = state.phase === 'activity' || state.phase === 'complete';
      let mounted = state.phase === 'garage' ? 0 : 1, walk = 0;
      if (state.phase === 'mount') mounted = smooth((state.timer - 1.5) / 2.3);
      if (state.phase === 'dismount') { mounted = 1 - smooth(state.timer / 2.1); walk = smooth((state.timer - 2.2) / walkingDuration(state)); }
      if (atStop) { mounted = 0; walk = 1; }
      if (state.phase === 'remount') { walk = 1 - smooth(state.timer / walkingDuration(state)); mounted = smooth((state.timer - walkingDuration(state)) / 2.2); }
      if (!state.paused || !posed) player.setPose(state.x, state.z, state.heading, state.lean, state.steering, state.odometer, mounted, walk, state.chapter, state.timer, atStop, scenery.activities[state.chapter], state.speed, bays[state.chapter].heading + (state.chapter===1 ? Math.PI : state.chapter===4 ? Math.PI/2 : 0));
      else player.updateVehicle(state.x,state.z,state.heading,state.lean,state.steering,state.odometer);
      if(import.meta.env.DEV && hip) {
        if(state.phase==='ride') {
          player.bike.worldToLocal(hip.getWorldPosition(hipPoint));
          saddleReference??=hipPoint.clone();maxSaddleDrift=Math.max(maxSaddleDrift,hipPoint.distanceTo(saddleReference));
          host.dataset.saddleDrift=maxSaddleDrift.toExponential(1);
        } else { saddleReference=undefined;maxSaddleDrift=0; }
      }
      if (state.phase === 'garage' || state.phase === 'mount') {
        scenery.door.position.y = state.phase === 'garage' ? 0 : 3.15 * smooth(state.timer / 2.8);
        scenery.door.scale.y = 1 - (state.phase === 'garage' ? 0 : .90 * smooth(state.timer / 2.8));
      }
      companions.forEach((rider, i) => {
        if (state.phase === 'garage') npcStates[i] = createCompanion(i);
        const npc = npcStates[i];
        advanceCompanion(npc, i, state, dt);
        state.companions[i] = npc.distance;
        const separation = Math.hypot(npc.x-state.x,npc.z-state.z);
        // The fog is fully opaque at 480 m. Only hide beyond it, never at the
        // old visible 140 m boundary; this avoids riders popping out of view.
        rider.root.visible = separation < 520;
        if (rider.root.visible && (!state.paused || !posed)) {
          rider.setPose(npc.x, npc.z, npc.heading, npc.lean, npc.steering, npc.odometer, npc.mounted, npc.walk, state.chapter === 3 ? 1 : state.chapter, state.timer + i * .5, npc.mounted < .1, undefined, npc.speed);
        }
        else rider.updateVehicle(npc.x,npc.z,npc.heading,npc.lean,npc.steering,npc.odometer);
      });
      posed = true;
      const animationMs=performance.now()-animationStart;
      const bay = bays[state.chapter]; scenery.ring.visible = state.phase === 'ride' && state.chapter !== 2;
      scenery.ring.position.set(bay.x, .095, bay.z); scenery.ring.scale.setScalar(1.15);
      scenery.arrows.forEach((arrow, i) => {
        const d = state.distance + 13 + i * 8;
        // Retire chevrons individually at the bay; clamping them all to the
        // same point created a flashing, overlapping stack at every stop.
        arrow.visible = state.phase === 'ride' && d < targetDistance(state) - 12;
        const p = sampleRoad(d, -1.25); arrow.position.set(p.x, .18 + (state.reduced ? 0 : Math.sin(now * .0018 + i) * .035), p.z); arrow.rotation.y = p.heading;
        arrow.scale.setScalar(1.8);
      });
      const daylight = THREE.MathUtils.clamp(state.distance / Math.max(1, targetDistance({ ...state, chapter: 5 })), 0, 1);
      sunDirection.setFromSphericalCoords(1, THREE.MathUtils.degToRad(79 - daylight * 37), THREE.MathUtils.degToRad(128));
      uniforms.sunPosition.value.copy(sunDirection);
      sun.position.set(state.x + sunDirection.x * 100, sunDirection.y * 100 + 8, state.z + sunDirection.z * 100); sun.target.position.set(state.x, 0, state.z);
      sun.color.set('#ffcf8a').lerp(new THREE.Color('#fff2d4'), daylight);
      (scene.fog as THREE.Fog).color.set('#b4d0bc').lerp(new THREE.Color('#a8d1cd'), daylight);
      forward.set(Math.sin(state.heading), 0, Math.cos(state.heading));
      const intro = state.phase === 'garage' || state.phase === 'mount';
      if (intro) {
        cameraPosition.set(home.x + Math.sin(home.heading) * 9 + Math.cos(home.heading) * 3, 2.7, home.z + Math.cos(home.heading) * 9 - Math.sin(home.heading) * 3);
        targetLook.set(state.x, 1.15, state.z);
      } else if (atStop || state.phase === 'dismount' || state.phase === 'remount') {
        const stop = bays[state.chapter], side = state.chapter === 3 ? 10 : -9, back = state.chapter === 3 ? 8 : -8;
        cameraPosition.set(stop.x + Math.cos(stop.heading) * side + Math.sin(stop.heading) * back, 3.5, stop.z - Math.sin(stop.heading) * side + Math.cos(stop.heading) * back);
        if (state.chapter===3) cameraPosition.set(cafeSite.x+Math.cos(stop.heading)*7+Math.sin(stop.heading)*12,3.0,cafeSite.z-Math.sin(stop.heading)*7+Math.cos(stop.heading)*12);
        targetLook.set(stop.x, 1.1, stop.z).lerp(scenery.activities[state.chapter].clone().add(new THREE.Vector3(0, 1.1, 0)), walk * (state.chapter===3 ? .85 : .3));
      } else {
        const trailing = mobile ? 6.6 : 5.7;
        cameraPosition.set(state.x - forward.x * trailing, state.reduced ? 2.9 : 2.5 + state.speed * .018, state.z - forward.z * trailing);
        targetLook.set(state.x + forward.x * 4.5, 1.12, state.z + forward.z * 4.5);
      }
      if (!cameraReady) { camera.position.copy(cameraPosition); lookAt.copy(targetLook); cameraReady = true; }
      camera.position.lerp(cameraPosition, 1 - Math.exp(-dt * (state.reduced ? 10 : 4.8)));
      lookAt.lerp(targetLook, 1 - Math.exp(-dt * 5)); camera.lookAt(lookAt);
      const fov = state.reduced ? 53 : 53 + state.speed * .25;
      if (Math.abs(camera.fov - fov) > .03) { camera.fov = fov; camera.updateProjectionMatrix(); }
      // Cache the expensive forest map, but never receive its old actor
      // silhouette on the rider (see bike.ts). Pose updates remain render-rate.
      if (now-lastShadow>45) { renderer.shadowMap.needsUpdate=true; lastShadow=now; }
      sky.position.copy(camera.position);
      const renderStart=performance.now();
      renderer.render(scene, camera);
      if(import.meta.env.DEV && now-lastPublish>100) {
        host.dataset.animationMs=animationMs.toFixed(1);host.dataset.renderMs=(performance.now()-renderStart).toFixed(1);
        host.dataset.companions=npcStates.map(n=>`${n.distance.toFixed(0)}m/${n.speed.toFixed(1)}mps/${Math.hypot(n.x-state.x,n.z-state.z).toFixed(0)}m away`).join(';');
      }
      if (state.photo !== lastPhoto) {
        lastPhoto = state.photo;
        try { const photo = renderer.domElement.toDataURL('image/jpeg', .92); host.dispatchEvent(new CustomEvent('ride-photo', { detail: photo, bubbles: true })); }
        catch { host.dispatchEvent(new CustomEvent('ride-photo-error', { bubbles: true })); }
      }
      frameCount++;
      if (now - fpsStart > 1500) {
        const fps = Math.round(frameCount * 1000 / (now - fpsStart));
        host.dataset.fps = String(fps); host.dataset.drawCalls = String(renderer.info.render.calls); host.dataset.triangles = String(renderer.info.render.triangles);
        if (state.elapsed > 8 && fps < 42 && renderer.getPixelRatio() > 1) renderer.setPixelRatio(Math.max(1, renderer.getPixelRatio() - .2));
        fpsStart = now; frameCount = 0;
      }
      host.dataset.phase = state.phase; host.dataset.chapter = String(state.chapter); host.dataset.distance = state.distance.toFixed(1); host.dataset.speed = state.speed.toFixed(2);
      if (now - lastPublish > 100) { lastPublish = now; onUpdate(); }
    }
    frame = requestAnimationFrame(tick);
  }
  frame = requestAnimationFrame(tick);
  return () => {
    disposed = true; state.ready = false; cancelAnimationFrame(frame); observer.disconnect(); resize.disconnect();
    renderer.domElement.removeEventListener('webglcontextlost', lostContext);
    const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>(), textures = new Set<THREE.Texture>(scenery.textures);
    scene.traverse(object => { if (object instanceof THREE.Mesh) { geometries.add(object.geometry); (Array.isArray(object.material) ? object.material : [object.material]).forEach(m => materials.add(m)); } });
    materials.forEach(material => { Object.values(material).forEach(v => { if (v instanceof THREE.Texture) textures.add(v); }); material.dispose(); });
    geometries.forEach(g => g.dispose()); textures.forEach(t => t.dispose()); environment?.dispose(); pmrem.dispose(); renderer.dispose(); renderer.domElement.remove();
  };
}
