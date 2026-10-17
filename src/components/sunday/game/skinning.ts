import * as THREE from 'three';

/** Install on Scene.onBeforeRender, after world/bind matrices are current. */
export function createSkinPaletteSync(roots: readonly THREE.Object3D[]) {
  const skeletons = new Set<THREE.Skeleton>();
  roots.forEach(root => root.traverse(object => {
    if (object instanceof THREE.SkinnedMesh) skeletons.add(object.skeleton);
  }));
  return () => {
    // Three's main-list and shadow passes use different render.frame values.
    // A cached shadow pass can therefore suppress the next main-list update,
    // leaving clothing one pose behind its rigid helmet and motorcycle.
    // Publish the final palette explicitly, independently of that frame cache.
    skeletons.forEach(skeleton => skeleton.update());
  };
}
