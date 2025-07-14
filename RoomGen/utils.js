import * as THREE from 'https://cdn.skypack.dev/three@0.129.0/build/three.module.js';

/**
 * Robi przezroczyste ściany, jeśli kamera patrzy na nie od zewnętrznej strony
 * @param {THREE.Mesh[]} walls - tablica ścian
 * @param {THREE.Camera} camera - kamera Three.js
 */
export function make_backfacing_walls_transparent(walls, camera) {
  walls.forEach(wall => {
    if (!wall.userData.localNormal) return;

    // Pozycja ściany w świecie
    const wallPos = new THREE.Vector3();
    wall.getWorldPosition(wallPos);

    // Skopiuj wektor lokalny i przelicz go na świat
    const worldNormal = wall.userData.localNormal.clone()
      .applyQuaternion(wall.getWorldQuaternion(new THREE.Quaternion()))
      .normalize();

    const toCamera = new THREE.Vector3()
      .subVectors(camera.position, wallPos)
      .normalize();

    const dot = worldNormal.dot(toCamera);

    const material = wall.material;
    material.transparent = true;
    material.depthWrite = false;

    // Jeśli kamera jest po drugiej stronie ściany (od tyłu)
    if (dot < 0) {
      material.opacity = 0.2;
    } else {
      material.opacity = 1.0;
    }
  });
}
