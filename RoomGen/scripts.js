import * as THREE from 'https://cdn.skypack.dev/three@0.129.0/build/three.module.js';
import { OrbitControls } from 'https://unpkg.com/three@0.160.0/examples/jsm/controls/OrbitControls.js';
import * as u from './utils.js';
import { GLTFLoader } from 'https://cdn.skypack.dev/three@0.129.0/examples/jsm/loaders/GLTFLoader.js';
const scene = new THREE.Scene(); 

const camera = new THREE.PerspectiveCamera(75, 600/400, 0.1, 1000);

const renderer = new THREE.WebGLRenderer({
    canvas: document.querySelector('#bg'),
    //alpha: true,
});
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(600, 400);
camera.position.set(0, 2.5, 6);

const light = new THREE.AmbientLight(0xffffff);
light.position.set(20,20,20);
scene.add(light);
const gridHelper= new THREE.GridHelper(50,12);
scene.add(gridHelper);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 1.5, 0); // np. środek pokoju
controls.update();


// FLOOR
const floor = new THREE.Mesh(
  new THREE.BoxGeometry(5, 0.1, 4),
  new THREE.MeshStandardMaterial({color: 0xFF6247})
);
floor.position.y = -0.05; // górna krawędź na y = 0
scene.add(floor);

// WALL 1 (tylna ściana)
const wall1 = new THREE.Mesh(
  new THREE.BoxGeometry(5, 3, 0.1),
  new THREE.MeshStandardMaterial({ color: 0xffffff})
);
wall1.position.set(0, 1.5, -2); // Y = połowa wysokości

// WALL 2 (przednia ściana)
const wall2 = wall1.clone();
wall2.material = wall1.material.clone();
wall2.position.z = 2;

// WALL 3 (lewa ściana)
const wall3 = new THREE.Mesh(
  new THREE.BoxGeometry(0.1, 3, 4),
  new THREE.MeshStandardMaterial({ color: 0xffffff })
);
wall3.position.set(-2.5, 1.5, 0);

// WALL 4 (prawa ściana)
const wall4 = wall3.clone();
wall4.material = wall3.material.clone();
wall4.position.x = 2.5;

const walls = [wall1, wall2, wall3, wall4];

//Room
const room = new THREE.Group();
room.add(floor, wall1, wall2, wall3, wall4);
scene.add(room);


wall1.userData.localNormal = new THREE.Vector3(0, 0, 1);   // tył (patrzy Z+)
wall2.userData.localNormal = new THREE.Vector3(0, 0, -1);  // przód (Z-)
wall3.userData.localNormal = new THREE.Vector3(1, 0, 0);   // lewa (X+)
wall4.userData.localNormal = new THREE.Vector3(-1, 0, 0);  // prawa (X-)

//renderowanie mebli
const mebleDoZaladowania = [
  { file: 'mebel1.glb', position: new THREE.Vector3(0, 0.5, 0) },
  { file: 'mebel2.glb', position: new THREE.Vector3(1, 0.5, -1) },
  { file: 'mebel3.glb', position: new THREE.Vector3(-1, 0.5, 1) },
];

const loader = new GLTFLoader();

mebleDoZaladowania.forEach((item) => {
  loader.load(
    item.file,
    function (gltf) {
      const mebel = gltf.scene;
      mebel.position.copy(item.position);
      furnitureGroup.add(mebel);
    },
    undefined,
    function (error) {
      console.error(`Błąd ładowania ${item.file}:`, error);
    }
  );
});


const furnitureGroup = new THREE.Group();
room.add(furnitureGroup); // meble będą się obracać razem z pokojem



function animate()
{
    room.rotation.y+=0.005;
    u.make_backfacing_walls_transparent(walls, camera);  
    controls.update();
    renderer.render(scene,camera);
    requestAnimationFrame(animate);
}

animate();