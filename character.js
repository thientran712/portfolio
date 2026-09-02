// 3D character companion — sticky overlay that follows scroll position across sections.
// Self-contained module: safe to delete this file + its <script type="module"> tag in
// index.html to remove the feature entirely. Skips itself on mobile/narrow viewports and
// when WebGL is unavailable, since Three.js + a GLB render loop is too heavy there.

const MOBILE_BREAKPOINT = 860;

if (window.innerWidth >= MOBILE_BREAKPOINT && hasWebGL()) {
  init();
}

function hasWebGL() {
  try {
    const canvas = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
  } catch (e) {
    return false;
  }
}

async function init() {
  const THREE = await import('three');
  const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');

  // --- Waypoints: where the character sits (in viewport %) for each section, and how big. ---
  // x/y are fractions of viewport width/height for the character's anchor point.
  // scale controls apparent size; rotationY gives a subtle turn-to-face-content effect.
  const waypoints = [
    { id: 'top',        x: 0.95, y: 0.88, scale: 0.42, rotationY: -0.5 },
    { id: 'about',      x: 0.05, y: 0.50, scale: 0.34, rotationY: 0.5 },
    { id: 'featured',   x: 0.96, y: 0.85, scale: 0.3,  rotationY: -0.5 },
    { id: 'products',   x: 0.04, y: 0.35, scale: 0.32, rotationY: 0.5 },
    { id: 'experience', x: 0.96, y: 0.80, scale: 0.28, rotationY: -0.5 },
    { id: 'contact',    x: 0.5,  y: 0.85, scale: 0.4,  rotationY: 0 },
  ];
  const sections = waypoints
    .map((wp) => ({ ...wp, el: document.getElementById(wp.id) }))
    .filter((wp) => wp.el);
  if (sections.length === 0) return;

  // --- Canvas overlay, fixed over the whole viewport, clicks pass through to the page. ---
  const canvas = document.createElement('canvas');
  canvas.id = 'character-canvas';
  Object.assign(canvas.style, {
    position: 'fixed',
    inset: '0',
    width: '100vw',
    height: '100vh',
    pointerEvents: 'none',
    zIndex: '5',
  });
  document.body.appendChild(canvas);

  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, window.innerWidth / window.innerHeight, 0.1, 100);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x445566, 1.3));
  const keyLight = new THREE.DirectionalLight(0xffffff, 1.4);
  keyLight.position.set(2, 4, 3);
  scene.add(keyLight);

  let mixer = null;
  let model = null;
  let modelHeight = 1.8; // fallback until the real bounding box is measured

  const loader = new GLTFLoader();
  loader.load(
    'assets/character/character.glb',
    (gltf) => {
      model = gltf.scene;
      // Ensure world matrices (including the armature's baked-in scale) are resolved
      // before measuring the bounding box, or the height comes out ~100x too large.
      model.updateMatrixWorld(true);
      scene.add(model);

      const box = new THREE.Box3().setFromObject(model);
      const size = new THREE.Vector3();
      box.getSize(size);
      modelHeight = size.y || modelHeight;

      mixer = new THREE.AnimationMixer(model);
      const waveClip = gltf.animations.find((a) => /wave/i.test(a.name)) || gltf.animations[0];
      if (waveClip) mixer.clipAction(waveClip).play();

      renderer.setAnimationLoop(renderLoop);
    },
    undefined,
    () => {
      // Model failed to load (offline, blocked, etc.) — fail quiet, no character shown.
      canvas.remove();
    }
  );

  // --- Scroll-driven placement: find which two waypoints straddle the current scroll
  // position and lerp between them, so the character eases smoothly section-to-section. ---
  const target = { x: sections[0].x, y: sections[0].y, scale: sections[0].scale, rotationY: sections[0].rotationY };
  const current = { ...target };

  function computeTarget() {
    const scrollCenter = window.scrollY + window.innerHeight / 2;

    let active = sections[0];
    for (const s of sections) {
      const rect = s.el.getBoundingClientRect();
      const top = rect.top + window.scrollY;
      if (scrollCenter >= top) active = s;
    }
    target.x = active.x;
    target.y = active.y;
    target.scale = active.scale;
    target.rotationY = active.rotationY;
  }

  window.addEventListener('scroll', computeTarget, { passive: true });
  window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  });
  computeTarget();

  const clock = new THREE.Clock();

  function renderLoop() {
    const delta = clock.getDelta();
    if (mixer) mixer.update(delta);

    // Smoothly ease current position toward the target waypoint (framerate-independent lerp).
    const ease = 1 - Math.pow(0.001, delta);
    current.x += (target.x - current.x) * ease;
    current.y += (target.y - current.y) * ease;
    current.scale += (target.scale - current.scale) * ease;
    current.rotationY += (target.rotationY - current.rotationY) * ease;

    if (model) {
      // Fit the camera distance to the model height once, then move the character in
      // screen-space by placing it on a plane facing the camera at that fixed distance.
      const fitDist = (modelHeight / (2 * Math.tan((camera.fov * Math.PI) / 180 / 2))) * 1.7;
      camera.position.set(0, modelHeight * 0.55, fitDist);
      camera.lookAt(0, modelHeight * 0.55, 0);

      const vFov = (camera.fov * Math.PI) / 180;
      const viewHeight = 2 * Math.tan(vFov / 2) * fitDist;
      const viewWidth = viewHeight * camera.aspect;

      const worldX = (current.x - 0.5) * viewWidth;
      const worldY = (0.5 - current.y) * viewHeight + modelHeight * 0.55 - modelHeight / 2;

      model.position.set(worldX, worldY, 0);
      model.scale.setScalar(current.scale);
      model.rotation.y = current.rotationY;
    }

    renderer.render(scene, camera);
  }
}
