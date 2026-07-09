import * as THREE from "three";

const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function lowPowerDevice() {
  return (
    window.innerWidth < 820 ||
    navigator.hardwareConcurrency <= 4 ||
    navigator.deviceMemory <= 4
  );
}

function createMaterial(color, accent) {
  return new THREE.MeshPhysicalMaterial({
    color,
    emissive: accent,
    emissiveIntensity: 0.06,
    roughness: 0.13,
    metalness: 0.02,
    transmission: 0.62,
    thickness: 1.1,
    ior: 1.42,
    transparent: true,
    opacity: 0.68,
    clearcoat: 1,
    clearcoatRoughness: 0.08,
    specularIntensity: 1,
  });
}

function createRibbonMaterial(color) {
  return new THREE.MeshPhysicalMaterial({
    color,
    emissive: color,
    emissiveIntensity: 0.08,
    roughness: 0.18,
    metalness: 0.08,
    transmission: 0.45,
    thickness: 0.7,
    ior: 1.36,
    transparent: true,
    opacity: 0.55,
    clearcoat: 1,
    clearcoatRoughness: 0.1,
    side: THREE.DoubleSide,
  });
}

function createShape(geometry, material, edgeColor) {
  const group = new THREE.Group();
  const mesh = new THREE.Mesh(geometry, material);
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(geometry, 28),
    new THREE.LineBasicMaterial({
      color: edgeColor,
      transparent: true,
      opacity: 0.3,
    }),
  );

  group.add(mesh, edges);
  return group;
}

function createParticles(count) {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const palette = [
    new THREE.Color(0x8dfff0),
    new THREE.Color(0xffc278),
    new THREE.Color(0x8bb8ff),
    new THREE.Color(0xc9ffe0),
  ];

  for (let i = 0; i < count; i += 1) {
    const stride = i * 3;
    positions[stride] = (Math.random() - 0.5) * 12;
    positions[stride + 1] = (Math.random() - 0.5) * 6.5;
    positions[stride + 2] = -2.5 - Math.random() * 5.5;

    const color = palette[i % palette.length];
    colors[stride] = color.r;
    colors[stride + 1] = color.g;
    colors[stride + 2] = color.b;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

  return new THREE.Points(
    geometry,
    new THREE.PointsMaterial({
      size: 0.018,
      vertexColors: true,
      transparent: true,
      opacity: 0.62,
      depthWrite: false,
    }),
  );
}

export function initAbstractScene(canvas) {
  if (!(canvas instanceof HTMLCanvasElement)) return null;

  const reduceMotion = prefersReducedMotion();
  const lowPower = lowPowerDevice();
  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: !lowPower,
    powerPreference: "high-performance",
    preserveDrawingBuffer: false,
  });

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lowPower ? 1.1 : 1.45));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 80);
  camera.position.set(0, 0.2, 9.5);

  const group = new THREE.Group();
  scene.add(group);

  const mainGeometry = lowPower ? new THREE.IcosahedronGeometry(1.72, 2) : new THREE.IcosahedronGeometry(1.72, 4);
  const prismGeometry = lowPower ? new THREE.OctahedronGeometry(0.95, 1) : new THREE.OctahedronGeometry(0.95, 3);
  const sphereGeometry = lowPower ? new THREE.SphereGeometry(0.62, 24, 12) : new THREE.SphereGeometry(0.62, 40, 20);
  const torusGeometry = new THREE.TorusKnotGeometry(1.42, 0.075, lowPower ? 96 : 160, 8, 2, 5);
  const ringGeometry = new THREE.TorusGeometry(2.12, 0.055, 8, lowPower ? 96 : 150);

  const main = createShape(createShapeGeometry(mainGeometry), createMaterial(0x9fffe1, 0x53d49b), 0xd9fff2);
  main.position.set(-1.7, 0.35, -0.6);
  main.scale.set(1.05, 1.22, 0.92);

  const prism = createShape(createShapeGeometry(prismGeometry), createMaterial(0xffb269, 0xff7a32), 0xffdfb3);
  prism.position.set(2.15, 1.05, -1.25);
  prism.scale.set(0.95, 1.22, 0.95);

  const satellite = createShape(createShapeGeometry(sphereGeometry), createMaterial(0xaac6ff, 0x5b7dff), 0xdbe6ff);
  satellite.position.set(2.65, -1.05, -0.75);
  satellite.scale.set(1.35, 0.82, 1.35);

  const knot = new THREE.Mesh(torusGeometry, createRibbonMaterial(0x496dff));
  knot.position.set(0.3, -0.15, -0.15);
  knot.rotation.set(0.9, 0.2, -0.42);

  const ringA = new THREE.Mesh(ringGeometry, createRibbonMaterial(0x7bffcf));
  ringA.position.set(0.15, -0.06, -0.1);
  ringA.rotation.set(1.32, 0.28, -0.16);
  ringA.scale.set(1.22, 0.62, 1.22);

  const ringB = new THREE.Mesh(ringGeometry, createRibbonMaterial(0xff985f));
  ringB.position.set(-0.1, 0.08, -0.18);
  ringB.rotation.set(1.04, -0.5, 0.68);
  ringB.scale.set(0.92, 0.5, 0.92);

  const particles = createParticles(lowPower ? 42 : 78);
  scene.add(particles);
  group.add(ringA, ringB, knot, main, prism, satellite);

  scene.add(new THREE.AmbientLight(0x8ccfff, 1.4));

  const key = new THREE.DirectionalLight(0xffffff, 3.6);
  key.position.set(-3.5, 4.2, 5);
  scene.add(key);

  const cyan = new THREE.PointLight(0x72ffe6, 8, 18, 1.8);
  cyan.position.set(-3.4, -1.9, 2.6);
  scene.add(cyan);

  const amber = new THREE.PointLight(0xffa35c, 7, 14, 1.9);
  amber.position.set(4.4, 2.2, 1.6);
  scene.add(amber);

  const pointer = { x: 0, y: 0 };
  const target = { x: 0, y: 0 };
  const canParallax = !reduceMotion && !window.matchMedia("(pointer: coarse)").matches;
  const frameInterval = 1000 / (lowPower ? 28 : 42);
  let width = 0;
  let height = 0;
  let frameId = 0;
  let lastFrameAt = 0;
  let inView = true;
  let disposed = false;

  function resize() {
    const nextWidth = canvas.clientWidth;
    const nextHeight = canvas.clientHeight;
    if (!nextWidth || !nextHeight || (nextWidth === width && nextHeight === height)) return;

    width = nextWidth;
    height = nextHeight;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.fov = camera.aspect < 0.86 ? 42 : 36;
    camera.position.z = camera.aspect < 0.86 ? 10.8 : 9.5;
    camera.updateProjectionMatrix();
  }

  function render(timestamp = performance.now()) {
    resize();
    const elapsed = timestamp * 0.001;
    const drift = reduceMotion ? 0 : elapsed;

    pointer.x += (target.x - pointer.x) * 0.04;
    pointer.y += (target.y - pointer.y) * 0.04;

    group.rotation.x = -0.06 + pointer.y * 0.06 + Math.sin(drift * 0.22) * 0.025;
    group.rotation.y = pointer.x * 0.08 + Math.sin(drift * 0.18) * 0.16;
    group.position.y = Math.sin(drift * 0.34) * 0.14;

    main.rotation.x = 0.34 + drift * 0.12;
    main.rotation.y = -0.46 + drift * 0.16;
    prism.rotation.x = -0.22 + drift * 0.2;
    prism.rotation.z = 0.38 + drift * 0.14;
    satellite.rotation.y = drift * -0.22;
    satellite.rotation.z = 0.6 + drift * 0.13;
    knot.rotation.y = 0.2 + drift * 0.2;
    knot.rotation.z = -0.42 + drift * 0.1;
    ringA.rotation.z = -0.16 + drift * 0.16;
    ringB.rotation.y = -0.5 + drift * -0.14;
    particles.rotation.y = drift * 0.035;
    particles.rotation.x = Math.sin(drift * 0.15) * 0.025;

    renderer.render(scene, camera);
  }

  function animate(timestamp) {
    if (disposed) return;
    if (inView && document.visibilityState === "visible" && timestamp - lastFrameAt >= frameInterval) {
      lastFrameAt = timestamp;
      render(timestamp);
    }
    frameId = window.requestAnimationFrame(animate);
  }

  function handlePointerMove(event) {
    target.x = (event.clientX / Math.max(window.innerWidth, 1)) * 2 - 1;
    target.y = (event.clientY / Math.max(window.innerHeight, 1)) * 2 - 1;
  }

  const observer =
    "IntersectionObserver" in window
      ? new IntersectionObserver(([entry]) => {
          inView = Boolean(entry?.isIntersecting);
          if (inView) lastFrameAt = 0;
        })
      : null;

  observer?.observe(canvas);
  window.addEventListener("resize", resize);
  if (canParallax) window.addEventListener("pointermove", handlePointerMove, { passive: true });

  canvas.dataset.sceneReady = "true";
  render();
  if (!reduceMotion) animate(performance.now());

  return () => {
    disposed = true;
    window.cancelAnimationFrame(frameId);
    observer?.disconnect();
    window.removeEventListener("resize", resize);
    if (canParallax) window.removeEventListener("pointermove", handlePointerMove);
    mainGeometry.dispose();
    prismGeometry.dispose();
    sphereGeometry.dispose();
    torusGeometry.dispose();
    ringGeometry.dispose();
    particles.geometry.dispose();
    particles.material.dispose();
    group.traverse((object) => {
      if (object.material) object.material.dispose();
      if (object.geometry && ![mainGeometry, prismGeometry, sphereGeometry, torusGeometry, ringGeometry].includes(object.geometry)) {
        object.geometry.dispose();
      }
    });
    renderer.dispose();
  };
}

function createShapeGeometry(geometry) {
  geometry.computeVertexNormals();
  return geometry;
}
