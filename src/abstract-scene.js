import * as THREE from "three";

const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function lowPowerDevice() {
  return (
    window.innerWidth < 820 ||
    navigator.hardwareConcurrency <= 4 ||
    navigator.deviceMemory <= 4
  );
}

function createGlowTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext("2d");
  const gradient = context.createRadialGradient(128, 128, 0, 128, 128, 128);
  gradient.addColorStop(0, "rgba(255,255,255,0.95)");
  gradient.addColorStop(0.22, "rgba(198,125,255,0.7)");
  gradient.addColorStop(0.58, "rgba(126,45,255,0.34)");
  gradient.addColorStop(1, "rgba(126,45,255,0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 256, 256);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createEnvironmentTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 512;
  const context = canvas.getContext("2d");
  const sky = context.createLinearGradient(0, 0, canvas.width, canvas.height);
  sky.addColorStop(0, "#ffffff");
  sky.addColorStop(0.18, "#c49cff");
  sky.addColorStop(0.38, "#080807");
  sky.addColorStop(0.58, "#6d2cff");
  sky.addColorStop(0.78, "#f5edff");
  sky.addColorStop(1, "#080807");
  context.fillStyle = sky;
  context.fillRect(0, 0, canvas.width, canvas.height);

  for (let i = 0; i < 14; i += 1) {
    const y = 54 + i * 31;
    const glow = context.createLinearGradient(0, y, canvas.width, y + 40);
    glow.addColorStop(0, "rgba(255,255,255,0)");
    glow.addColorStop(0.48, i % 2 ? "rgba(163,79,255,0.34)" : "rgba(255,255,255,0.42)");
    glow.addColorStop(1, "rgba(255,255,255,0)");
    context.fillStyle = glow;
    context.fillRect(0, y, canvas.width, 18);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.mapping = THREE.EquirectangularReflectionMapping;
  return texture;
}

function createSheenTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 96;
  const context = canvas.getContext("2d");
  const gradient = context.createLinearGradient(0, 0, canvas.width, 0);
  gradient.addColorStop(0, "rgba(255,255,255,0)");
  gradient.addColorStop(0.28, "rgba(179,89,255,0.22)");
  gradient.addColorStop(0.5, "rgba(255,255,255,0.92)");
  gradient.addColorStop(0.68, "rgba(209,168,255,0.32)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createLiquidGlassMaterial(color, emissive, opacity = 0.72) {
  return new THREE.MeshPhysicalMaterial({
    color,
    emissive,
    emissiveIntensity: 0.5,
    roughness: 0.018,
    metalness: 0.02,
    transmission: 0.82,
    thickness: 1.72,
    ior: 1.52,
    attenuationColor: new THREE.Color(0xb96cff),
    attenuationDistance: 1.85,
    iridescence: 0.58,
    iridescenceIOR: 1.38,
    iridescenceThicknessRange: [120, 520],
    transparent: true,
    opacity,
    clearcoat: 1,
    clearcoatRoughness: 0.018,
    specularIntensity: 1,
    specularColor: new THREE.Color(0xf6e9ff),
    side: THREE.DoubleSide,
  });
}

function createLightMaterial(color, opacity = 0.82) {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: false,
    toneMapped: false,
    side: THREE.DoubleSide,
  });
}

function createGlassReflection(texture, width, height, position, rotation, opacity) {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.MeshBasicMaterial({
      map: texture,
      color: 0xffffff,
      transparent: true,
      opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
      toneMapped: false,
      side: THREE.DoubleSide,
    }),
  );
  mesh.position.copy(position);
  mesh.rotation.set(rotation.x, rotation.y, rotation.z);
  mesh.userData.baseOpacity = opacity;
  return mesh;
}

function createStarShape() {
  const points = [
    [-3.55, 0.0],
    [-1.18, 0.27],
    [-0.56, 0.58],
    [0.86, 3.12],
    [0.36, 0.42],
    [0.74, 0.18],
    [3.18, 0.04],
    [0.74, -0.18],
    [0.36, -0.42],
    [-0.78, -3.1],
    [-0.56, -0.58],
    [-1.18, -0.27],
  ];

  const shape = new THREE.Shape();
  shape.moveTo(points[0][0], points[0][1]);
  points.slice(1).forEach(([x, y]) => shape.lineTo(x, y));
  shape.closePath();
  return shape;
}

function createNcsStar(lowPower, sheenTexture, glowTexture) {
  const geometry = new THREE.ExtrudeGeometry(createStarShape(), {
    depth: lowPower ? 0.32 : 0.46,
    bevelEnabled: true,
    bevelSegments: lowPower ? 3 : 8,
    bevelSize: 0.105,
    bevelThickness: 0.11,
    curveSegments: lowPower ? 10 : 22,
  });
  geometry.center();
  geometry.computeVertexNormals();

  const star = new THREE.Group();
  const shell = new THREE.Mesh(
    geometry,
    createLiquidGlassMaterial(0xfffbff, 0xa240ff, 0.9),
  );
  const innerColor = createLightMaterial(0x8b32ff, 0.22);
  const innerGlow = new THREE.Mesh(new THREE.ShapeGeometry(createStarShape()), innerColor);
  innerGlow.position.z = 0.26;
  innerGlow.scale.set(0.985, 0.985, 1);

  const edge = new THREE.LineSegments(
    new THREE.EdgesGeometry(geometry, 18),
    new THREE.LineBasicMaterial({
      color: 0xf4e7ff,
      transparent: true,
      opacity: 0.94,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    }),
  );

  star.add(innerGlow, shell, edge);

  const highlightMaterial = createLightMaterial(0xffffff, 0.92);
  const highlightSpecs = [
    [[-3.1, 0.03], [-0.65, 0.2], [0.1, 0.1]],
    [[0.18, 0.18], [0.72, 2.58], [0.5, 0.18]],
    [[0.26, -0.12], [2.58, 0.03], [0.52, 0.12]],
    [[-0.45, -0.46], [-0.74, -2.6], [0.05, -0.38]],
  ];

  highlightSpecs.forEach((spec) => {
    const shape = new THREE.Shape();
    shape.moveTo(spec[0][0], spec[0][1]);
    shape.lineTo(spec[1][0], spec[1][1]);
    shape.lineTo(spec[2][0], spec[2][1]);
    shape.closePath();
    const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape), highlightMaterial);
    mesh.position.z = 0.22;
    star.add(mesh);
  });

  const glowPlate = new THREE.Mesh(
    new THREE.ShapeGeometry(createStarShape()),
    createLightMaterial(0x9d48ff, 0.34),
  );
  glowPlate.position.z = -0.28;
  glowPlate.scale.set(1.09, 1.09, 1);
  star.add(glowPlate);

  const reflections = [
    createGlassReflection(
      sheenTexture,
      2.75,
      0.22,
      new THREE.Vector3(-0.84, 0.2, 0.38),
      new THREE.Vector3(0.08, -0.18, -0.08),
      0.42,
    ),
    createGlassReflection(
      sheenTexture,
      1.8,
      0.16,
      new THREE.Vector3(0.42, 1.12, 0.42),
      new THREE.Vector3(0.14, -0.22, 1.2),
      0.34,
    ),
    createGlassReflection(
      sheenTexture,
      2.18,
      0.18,
      new THREE.Vector3(0.58, -0.72, 0.4),
      new THREE.Vector3(0.16, -0.18, -1.1),
      0.32,
    ),
  ];
  reflections.forEach((reflection) => star.add(reflection));
  star.userData.reflections = reflections;

  const glints = [
    createGlow(glowTexture, 0.92, new THREE.Vector3(0, 0, 0.58), 0.9, 0xffffff),
    createGlow(glowTexture, 0.46, new THREE.Vector3(0.68, 2.58, 0.56), 0.64, 0xf7ecff),
    createGlow(glowTexture, 0.38, new THREE.Vector3(2.72, 0.05, 0.54), 0.5, 0xf7ecff),
    createGlow(glowTexture, 0.42, new THREE.Vector3(-0.64, -2.42, 0.54), 0.54, 0xc77dff),
  ];
  glints.forEach((glint) => {
    glint.userData.baseOpacity = glint.material.opacity;
    glint.userData.baseScale = glint.scale.x;
    star.add(glint);
  });
  star.userData.glints = glints;

  return { group: star, geometry };
}

function createSwoosh(lowPower, radius, thickness, yOffset, zOffset, start, end, color, opacity) {
  const points = [];
  const segments = lowPower ? 72 : 128;
  for (let i = 0; i <= segments; i += 1) {
    const t = i / segments;
    const angle = start + (end - start) * t;
    const squash = 0.34 + Math.sin(t * Math.PI) * 0.08;
    points.push(
      new THREE.Vector3(
        Math.cos(angle) * radius,
        Math.sin(angle) * radius * squash + yOffset,
        zOffset + Math.sin(t * Math.PI) * 0.24,
      ),
    );
  }

  const curve = new THREE.CatmullRomCurve3(points);
  const geometry = new THREE.TubeGeometry(curve, segments, thickness, lowPower ? 8 : 12, false);
  const mesh = new THREE.Mesh(geometry, createLiquidGlassMaterial(color, 0x8b32ff, opacity));
  mesh.rotation.z = -0.12;

  const core = new THREE.Mesh(
    new THREE.TubeGeometry(curve, segments, thickness * 0.26, 8, false),
    createLightMaterial(0xffffff, 0.68),
  );
  core.rotation.copy(mesh.rotation);
  return { mesh, core, geometry, coreGeometry: core.geometry };
}

function createGlassCube(size, position, rotation) {
  const group = new THREE.Group();
  const geometry = new THREE.BoxGeometry(size, size, size);
  const mesh = new THREE.Mesh(
    geometry,
    createLiquidGlassMaterial(0xf2e6ff, 0xa341ff, 0.76),
  );
  const edge = new THREE.LineSegments(
    new THREE.EdgesGeometry(geometry),
    new THREE.LineBasicMaterial({
      color: 0xf9eaff,
      transparent: true,
      opacity: 0.52,
    }),
  );
  const shine = new THREE.Mesh(
    new THREE.PlaneGeometry(size * 0.74, size * 0.14),
    createLightMaterial(0xffffff, 0.68),
  );
  shine.position.z = size * 0.52;
  shine.rotation.z = -0.7;
  shine.position.y = size * 0.16;

  group.add(mesh, edge, shine);
  group.position.copy(position);
  group.rotation.set(rotation.x, rotation.y, rotation.z);
  group.userData.geometry = geometry;
  return group;
}

function createCubeCluster(lowPower) {
  const group = new THREE.Group();
  const cubes = [
    [0.3, 3.12, 1.52, -0.18],
    [0.23, 2.86, 1.74, -0.16],
    [0.24, 3.35, 1.75, -0.2],
    [0.2, 3.12, 1.96, -0.18],
    [0.52, 3.62, 0.85, -0.26],
    [0.38, 2.72, 0.58, -0.2],
    [0.25, 3.22, 0.52, -0.15],
    [0.19, 3.84, 0.42, -0.12],
    [0.16, 3.62, 0.1, -0.16],
    [0.14, 3.92, -0.02, -0.1],
  ];

  cubes.slice(0, lowPower ? 7 : cubes.length).forEach(([size, x, y, z], index) => {
    const cube = createGlassCube(
      size,
      new THREE.Vector3(x, y, z),
      new THREE.Vector3(0.55 + index * 0.08, 0.2 + index * 0.1, 0.78 + index * 0.16),
    );
    cube.userData.base = cube.position.clone();
    cube.userData.phase = index * 0.8;
    group.add(cube);
  });

  return group;
}

function createGlow(texture, scale, position, opacity = 0.6, color = 0xb35cff) {
  const material = new THREE.SpriteMaterial({
    map: texture,
    color,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(scale, scale, 1);
  sprite.position.copy(position);
  return sprite;
}

function createParticles(count) {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const palette = [
    new THREE.Color(0xffffff),
    new THREE.Color(0xd9a8ff),
    new THREE.Color(0x8d45ff),
  ];

  for (let i = 0; i < count; i += 1) {
    const stride = i * 3;
    const angle = Math.random() * Math.PI * 2;
    const radius = 1.5 + Math.random() * 4.6;
    positions[stride] = Math.cos(angle) * radius;
    positions[stride + 1] = Math.sin(angle) * radius * 0.42;
    positions[stride + 2] = -1.2 - Math.random() * 2.6;

    const color = palette[i % palette.length];
    colors[stride] = color.r;
    colors[stride + 1] = color.g;
    colors[stride + 2] = color.b;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

  const material = new THREE.PointsMaterial({
    size: 0.024,
    vertexColors: true,
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  return new THREE.Points(geometry, material);
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

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lowPower ? 1.05 : 1.4));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.34;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 80);
  camera.position.set(0, 0.08, 10.8);

  const group = new THREE.Group();
  scene.add(group);

  const glowTexture = createGlowTexture();
  const environmentTexture = createEnvironmentTexture();
  const sheenTexture = createSheenTexture();
  scene.environment = environmentTexture;

  const star = createNcsStar(lowPower, sheenTexture, glowTexture);
  star.group.scale.set(0.86, 0.86, 0.86);
  star.group.position.set(-0.82, -0.08, 0.18);
  star.group.rotation.set(0.12, -0.18, -0.03);

  const swooshA = createSwoosh(lowPower, 3.18, 0.045, -1.1, -0.34, Math.PI * 1.05, Math.PI * 1.96, 0x9d48ff, 0.66);
  const swooshB = createSwoosh(lowPower, 3.46, 0.026, -1.18, -0.42, Math.PI * 1.02, Math.PI * 1.94, 0xf3e9ff, 0.42);
  const swooshC = createSwoosh(lowPower, 2.86, 0.018, -1.04, -0.22, Math.PI * 1.09, Math.PI * 1.88, 0xffffff, 0.24);
  const cubes = createCubeCluster(lowPower);
  const particles = createParticles(lowPower ? 36 : 68);

  const starGlow = createGlow(glowTexture, 5.9, new THREE.Vector3(-0.86, -0.05, -0.8), 0.72);
  const sweepGlow = createGlow(glowTexture, 3.8, new THREE.Vector3(1.5, -1.15, -1.0), 0.52);
  const cubeGlow = createGlow(glowTexture, 2.4, new THREE.Vector3(3.15, 1.05, -0.9), 0.42);

  group.add(
    swooshA.mesh,
    swooshA.core,
    swooshB.mesh,
    swooshB.core,
    swooshC.mesh,
    swooshC.core,
    star.group,
    cubes,
    particles,
  );
  scene.add(starGlow, sweepGlow, cubeGlow);

  scene.add(new THREE.AmbientLight(0xbaa4ff, 1.3));

  const key = new THREE.DirectionalLight(0xffffff, 6.2);
  key.position.set(-3.6, 4.5, 5.4);
  scene.add(key);

  const purple = new THREE.PointLight(0x9138ff, 22, 18, 1.55);
  purple.position.set(-1.2, -0.1, 2.4);
  scene.add(purple);

  const rim = new THREE.PointLight(0xf0d6ff, 13, 16, 1.6);
  rim.position.set(3.6, 1.6, 2.2);
  scene.add(rim);

  const violetFill = new THREE.DirectionalLight(0x7d34ff, 2.8);
  violetFill.position.set(4.8, -3.1, 4.5);
  scene.add(violetFill);

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
    camera.fov = camera.aspect < 0.86 ? 43 : 35;
    camera.position.z = camera.aspect < 0.86 ? 13.2 : 10.8;
    group.scale.setScalar(camera.aspect < 0.86 ? 0.68 : 0.88);
    group.position.y = camera.aspect < 0.86 ? -0.02 : -0.18;
    camera.updateProjectionMatrix();
  }

  function render(timestamp = performance.now()) {
    resize();
    const elapsed = timestamp * 0.001;
    const drift = reduceMotion ? 0 : elapsed;

    pointer.x += (target.x - pointer.x) * 0.045;
    pointer.y += (target.y - pointer.y) * 0.045;

    group.rotation.x = -0.05 + pointer.y * 0.05 + Math.sin(drift * 0.28) * 0.018;
    group.rotation.y = pointer.x * 0.08 + Math.sin(drift * 0.22) * 0.16;
    group.rotation.z = Math.sin(drift * 0.12) * 0.035;

    star.group.rotation.y = -0.18 + Math.sin(drift * 0.42) * 0.1;
    star.group.rotation.x = 0.12 + Math.sin(drift * 0.34) * 0.04;
    swooshA.mesh.rotation.z = -0.12 + drift * 0.035;
    swooshA.core.rotation.z = swooshA.mesh.rotation.z;
    swooshB.mesh.rotation.z = -0.08 + drift * 0.032;
    swooshB.core.rotation.z = swooshB.mesh.rotation.z;
    swooshC.mesh.rotation.z = -0.1 + drift * 0.044;
    swooshC.core.rotation.z = swooshC.mesh.rotation.z;
    particles.rotation.z = drift * 0.055;
    particles.rotation.y = Math.sin(drift * 0.2) * 0.12;

    cubes.children.forEach((cube) => {
      cube.position.y = cube.userData.base.y + Math.sin(drift * 0.9 + cube.userData.phase) * 0.055;
      cube.position.x = cube.userData.base.x + Math.cos(drift * 0.72 + cube.userData.phase) * 0.035;
      cube.rotation.x += reduceMotion ? 0 : 0.004;
      cube.rotation.y += reduceMotion ? 0 : 0.006;
    });

    const pulse = 0.82 + Math.sin(drift * 1.2) * 0.18;
    starGlow.material.opacity = 0.66 * pulse;
    sweepGlow.material.opacity = 0.44 * pulse;
    cubeGlow.material.opacity = 0.34 * pulse;

    star.group.userData.reflections?.forEach((reflection, index) => {
      reflection.material.opacity =
        reflection.userData.baseOpacity * (0.72 + Math.sin(drift * 1.6 + index * 1.1) * 0.28);
      reflection.position.x += Math.sin(drift * 0.95 + index) * 0.0008;
    });
    star.group.userData.glints?.forEach((glint, index) => {
      const sparkle = 0.78 + Math.sin(drift * 1.8 + index * 1.45) * 0.22;
      glint.material.opacity = glint.userData.baseOpacity * sparkle;
      glint.scale.setScalar(glint.userData.baseScale * (0.92 + sparkle * 0.12));
    });

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

    const disposedGeometries = new Set();
    const disposeGeometry = (geometry) => {
      if (!geometry || disposedGeometries.has(geometry)) return;
      geometry.dispose();
      disposedGeometries.add(geometry);
    };

    [
      star.geometry,
      swooshA.geometry,
      swooshA.coreGeometry,
      swooshB.geometry,
      swooshB.coreGeometry,
      swooshC.geometry,
      swooshC.coreGeometry,
      particles.geometry,
    ].forEach(disposeGeometry);
    particles.material.dispose();
    glowTexture.dispose();
    environmentTexture.dispose();
    sheenTexture.dispose();

    group.traverse((object) => {
      if (object.material) object.material.dispose();
      disposeGeometry(object.userData.geometry);
      disposeGeometry(object.geometry);
    });
    [starGlow, sweepGlow, cubeGlow].forEach((sprite) => sprite.material.dispose());
    renderer.dispose();
  };
}
