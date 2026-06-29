import * as THREE from "three";
import "./styles.css";

const SERVER_ADDRESS = "nfoifsb.kr";
const STATUS_API = `https://api.mcstatus.io/v2/status/java/${SERVER_ADDRESS}`;
const BLOCK_GEOMETRY = new THREE.BoxGeometry(1, 1, 1);

const statusDot = document.querySelector("[data-status-dot]");
const statusLabel = document.querySelector("[data-status-label]");
const playerCount = document.querySelector("[data-player-count]");
const playerMeter = document.querySelector("[data-player-meter]");
const versionLabel = document.querySelector("[data-version]");
const copyFeedback = document.querySelector("[data-copy-feedback]");
const loginDialog = document.querySelector("[data-login-dialog]");
const loginForm = document.querySelector("[data-login-form]");
const loginMessage = document.querySelector("[data-login-message]");
const loginButton = document.querySelector("[data-open-login]");

function fallbackCopy(text) {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.inset = "0 auto auto 0";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);
  const copied = document.execCommand("copy");
  textarea.remove();
  return copied;
}

async function copyAddress() {
  let copied = false;

  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(SERVER_ADDRESS);
      copied = true;
    }
  } catch {
    copied = false;
  }

  if (!copied) {
    try {
      copied = fallbackCopy(SERVER_ADDRESS);
    } catch {
      copied = false;
    }
  }

  if (copied) {
    if (copyFeedback) copyFeedback.textContent = "복사 완료. 마크 서버 주소에 붙여넣으면 돼.";
  } else if (copyFeedback) {
    copyFeedback.textContent = `복사가 막히면 직접 입력: ${SERVER_ADDRESS}`;
  }
}

async function refreshStatus() {
  try {
    const response = await fetch(STATUS_API, { cache: "no-store" });
    if (!response.ok) throw new Error(`status ${response.status}`);
    const data = await response.json();

    const online = Boolean(data.online);
    const playersOnline = data.players?.online ?? 0;
    const playersMax = data.players?.max ?? 10;
    const meterWidth = Math.min(100, Math.round((playersOnline / Math.max(playersMax, 1)) * 100));

    statusDot?.classList.toggle("is-online", online);
    if (statusLabel) statusLabel.textContent = online ? "온라인" : "오프라인";
    if (playerCount) playerCount.textContent = `${playersOnline} / ${playersMax}`;
    if (playerMeter) playerMeter.style.width = `${meterWidth}%`;
    if (versionLabel) versionLabel.textContent = data.version?.name_clean || "Paper 26.1.2";
  } catch {
    statusDot?.classList.remove("is-online");
    if (statusLabel) statusLabel.textContent = "상태 확인 실패";
    if (playerCount) playerCount.textContent = "-- / 10";
    if (playerMeter) playerMeter.style.width = "0%";
  }
}

function readStoredNickname() {
  try {
    return localStorage.getItem("nfoifsb.nickname") || "";
  } catch {
    return "";
  }
}

function writeStoredNickname(nickname, remember) {
  try {
    if (remember) localStorage.setItem("nfoifsb.nickname", nickname);
    else localStorage.removeItem("nfoifsb.nickname");
  } catch {
    // The UI still works when storage is unavailable.
  }
}

function initLogin() {
  if (!loginDialog || !loginForm || !loginButton) return;

  const savedName = readStoredNickname();
  if (savedName) {
    loginButton.textContent = savedName;
    const nicknameInput = loginForm.elements.namedItem("nickname");
    if (nicknameInput instanceof HTMLInputElement) nicknameInput.value = savedName;
  }

  loginButton.addEventListener("click", () => {
    if (typeof loginDialog.showModal === "function") {
      loginDialog.showModal();
    } else {
      loginDialog.setAttribute("open", "");
    }
  });

  document.querySelector("[data-close-login]")?.addEventListener("click", () => {
    loginDialog.close();
  });

  loginDialog.addEventListener("click", (event) => {
    if (event.target === loginDialog) loginDialog.close();
  });

  loginForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(loginForm);
    const nickname = String(formData.get("nickname") || "").trim();
    const remember = formData.get("remember") === "on";

    if (!nickname) {
      if (loginMessage) loginMessage.textContent = "닉네임을 입력해줘.";
      return;
    }

    writeStoredNickname(nickname, remember);
    loginButton.textContent = nickname;
    if (loginMessage) loginMessage.textContent = `${nickname} 닉네임으로 로그인됨.`;
    window.setTimeout(() => loginDialog.close(), 450);
  });
}

function seededNoise(x, y, salt = 0) {
  return Math.abs(Math.sin(x * 127.1 + y * 311.7 + salt * 74.7) * 43758.5453) % 1;
}

function pickColor(palette, x, y, salt = 0) {
  return palette[Math.floor(seededNoise(x, y, salt) * palette.length) % palette.length];
}

function createPixelTexture(palette, size = 16, salt = 0) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");

  for (let x = 0; x < size; x += 1) {
    for (let y = 0; y < size; y += 1) {
      context.fillStyle = pickColor(palette, x, y, salt);
      context.fillRect(x, y, 1, 1);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestMipmapNearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createRadialTexture(center, edge, size = 128) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, center);
  gradient.addColorStop(0.48, center);
  gradient.addColorStop(1, edge);
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createMaterials() {
  const textures = {
    grassTop: createPixelTexture(["#6fbb5f", "#5fa84e", "#91d172", "#4f963f", "#a4de84"], 16, 1),
    grassSide: createPixelTexture(["#5d9a45", "#4f7f35", "#73ae55", "#94683e", "#6f4d31"], 16, 2),
    dirt: createPixelTexture(["#7d5638", "#8d6444", "#6b472f", "#9b7151", "#5c3f2c"], 16, 3),
    stone: createPixelTexture(["#8f9b97", "#707b78", "#a9b0ac", "#5f6966", "#bec5bf"], 16, 4),
    sand: createPixelTexture(["#d8c178", "#cbb36c", "#e6d08d", "#bfa865"], 16, 5),
    trunk: createPixelTexture(["#5c3a25", "#6d472e", "#4a2f1f", "#7a5134"], 16, 6),
    plank: createPixelTexture(["#b98245", "#9d6b38", "#c89455", "#8d5d31"], 16, 7),
    roof: createPixelTexture(["#5d382d", "#6d4636", "#4f2f27", "#80533e"], 16, 8),
    blossom: createPixelTexture(["#ffb9d4", "#ffd8e6", "#d986b0", "#f09fc4", "#fff4f8"], 16, 9),
    leaves: createPixelTexture(["#83bd57", "#6ca244", "#a1d872", "#578c37"], 16, 10),
    waterFoam: createPixelTexture(["#dff9ff", "#aee9ff", "#75d4f2", "#4ab6df"], 16, 11),
    lily: createPixelTexture(["#4b9b54", "#63bd68", "#387d43", "#7ed77c"], 16, 12),
  };

  const standard = (texture, options = {}) =>
    new THREE.MeshStandardMaterial({
      map: texture,
      color: options.color || 0xffffff,
      roughness: options.roughness ?? 0.72,
      metalness: options.metalness ?? 0.02,
      emissive: options.emissive || 0x000000,
      emissiveIntensity: options.emissiveIntensity ?? 0,
    });

  const grassTop = standard(textures.grassTop, { roughness: 0.78 });
  const grassSide = standard(textures.grassSide, { roughness: 0.86 });
  const dirt = standard(textures.dirt, { roughness: 0.9 });
  const stone = standard(textures.stone, { roughness: 0.83, metalness: 0.02 });

  return {
    grassBlock: [grassSide, grassSide, grassTop, dirt, grassSide, grassSide],
    dirt,
    stone,
    sand: standard(textures.sand, { roughness: 0.86 }),
    trunk: standard(textures.trunk, { roughness: 0.9 }),
    plank: standard(textures.plank, { roughness: 0.72 }),
    roof: standard(textures.roof, { roughness: 0.76 }),
    blossom: standard(textures.blossom, { roughness: 0.7, color: 0xffeef5 }),
    leaves: standard(textures.leaves, { roughness: 0.72 }),
    grassBlade: new THREE.MeshStandardMaterial({ color: 0x6fb24e, roughness: 0.9 }),
    reed: new THREE.MeshStandardMaterial({ color: 0x9aa95a, roughness: 0.8 }),
    flower: new THREE.MeshStandardMaterial({ color: 0xffb6d3, roughness: 0.68 }),
    lantern: new THREE.MeshStandardMaterial({
      color: 0xffc15a,
      emissive: 0xff9d2e,
      emissiveIntensity: 2.65,
      roughness: 0.35,
    }),
    lily: standard(textures.lily, { roughness: 0.74 }),
    glass: new THREE.MeshPhysicalMaterial({
      color: 0xbdefff,
      roughness: 0.05,
      transmission: 0.25,
      transparent: true,
      opacity: 0.6,
    }),
    cloud: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5, emissive: 0xe8f9ff, emissiveIntensity: 0.08 }),
    waterEdge: new THREE.MeshBasicMaterial({
      color: 0xaaf3ff,
      transparent: true,
      opacity: 0.38,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
    softShadow: new THREE.MeshBasicMaterial({
      color: 0x102412,
      map: createRadialTexture("rgba(0, 0, 0, 0.42)", "rgba(0, 0, 0, 0)", 128),
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
    }),
    lanternGlow: new THREE.SpriteMaterial({
      map: createRadialTexture("rgba(255, 197, 93, 0.74)", "rgba(255, 151, 61, 0)", 128),
      color: 0xffc46a,
      transparent: true,
      opacity: 0.74,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  };
}

function makeBlock(materials, x, y, z, sx = 1, sy = 1, sz = 1, options = {}) {
  const mesh = new THREE.Mesh(BLOCK_GEOMETRY, materials);
  mesh.position.set(x, y, z);
  mesh.scale.set(sx, sy, sz);
  mesh.castShadow = options.cast ?? true;
  mesh.receiveShadow = options.receive ?? true;
  return mesh;
}

function terrainHeightAt(x, z) {
  const lake = z > -3 && z < 8 && x > -8 && x < 9;
  if (lake) return -2;

  const hill =
    Math.sin(x * 0.31) * 0.8 +
    Math.cos(z * 0.26) * 0.7 +
    Math.sin((x + z) * 0.17) * 0.8 +
    Math.cos((x - z) * 0.11) * 0.45;

  const terrace = Math.round(hill * 0.74);
  const ridge = x > 7 && z > 2 ? 1 : 0;
  return Math.max(-1, Math.min(4, terrace + ridge));
}

function isLakeTile(x, z) {
  return z > -3 && z < 8 && x > -8 && x < 9;
}

function addTerrain(world, materials) {
  const surface = new Map();

  for (let x = -20; x <= 20; x += 1) {
    for (let z = -15; z <= 20; z += 1) {
      const lake = isLakeTile(x, z);
      const top = terrainHeightAt(x, z);
      surface.set(`${x},${z}`, top);

      for (let y = -3; y <= top; y += 1) {
        let material = materials.dirt;
        if (y === top) material = lake ? materials.sand : materials.grassBlock;
        if (y < -2) material = materials.stone;
        world.add(makeBlock(material, x, y - 1.15, z, 1, 1, 1, { cast: y === top, receive: true }));
      }
    }
  }

  return surface;
}

function makeTree(materials, x, z, groundY, scale = 1, blossom = true) {
  const tree = new THREE.Group();
  const trunkHeight = 3.2 * scale;
  tree.add(makeBlock(materials.trunk, x, groundY + trunkHeight / 2, z, 0.68 * scale, trunkHeight, 0.68 * scale));

  const crownMaterial = blossom ? materials.blossom : materials.leaves;
  const leafOffsets = [
    [0, 3.25, 0, 2.6, 1.05, 2.6],
    [-1.0, 3.75, 0.1, 1.75, 1.0, 1.75],
    [1.0, 3.75, -0.05, 1.75, 1.05, 1.75],
    [0.0, 4.38, 0.15, 1.9, 1.05, 1.9],
    [-0.25, 5.0, -0.2, 1.18, 0.9, 1.18],
  ];

  leafOffsets.forEach(([ox, oy, oz, sx, sy, sz], index) => {
    const material = blossom && index % 3 === 1 ? materials.leaves : crownMaterial;
    tree.add(
      makeBlock(
        material,
        x + ox * scale,
        groundY + oy * scale,
        z + oz * scale,
        sx * scale,
        sy * scale,
        sz * scale,
      ),
    );
  });

  return tree;
}

function makeCloud(material, x, y, z, scale = 1) {
  const cloud = new THREE.Group();
  const chunks = [
    [0, 0, 0, 2.8, 0.72, 1.1],
    [1.45, 0.08, 0.08, 1.8, 0.78, 1.0],
    [-1.45, 0.06, 0, 1.7, 0.7, 0.95],
    [0.35, 0.42, -0.05, 1.5, 0.86, 1.1],
  ];
  chunks.forEach(([ox, oy, oz, sx, sy, sz]) => {
    cloud.add(makeBlock(material, ox * scale, oy * scale, oz * scale, sx * scale, sy * scale, sz * scale));
  });
  cloud.position.set(x, y, z);
  return cloud;
}

function makeLantern(world, materials, x, y, z) {
  const lantern = makeBlock(materials.lantern, x, y, z, 0.34, 0.34, 0.34);
  const glow = new THREE.PointLight(0xffb759, 2.8, 9.5, 2.05);
  glow.position.set(x, y + 0.18, z);
  glow.castShadow = false;

  const halo = new THREE.Sprite(materials.lanternGlow.clone());
  halo.position.set(x, y + 0.14, z);
  halo.scale.set(2.8, 2.8, 1);
  world.add(lantern, glow, halo);
  return { light: glow, halo };
}

function addHouse(world, materials, groundY) {
  const house = new THREE.Group();

  for (let x = -17; x <= -11; x += 1) {
    for (let z = -4; z <= 2; z += 1) {
      const wall = x === -17 || x === -11 || z === -4 || z === 2;
      if (wall) house.add(makeBlock(materials.plank, x, groundY + 0.72, z, 1, 1.45, 1));
    }
  }

  house.add(makeBlock(materials.glass, -11, groundY + 1.0, -1, 0.92, 0.62, 0.16));
  house.add(makeBlock(materials.glass, -14, groundY + 1.0, -4, 0.92, 0.62, 0.16));
  house.add(makeBlock(materials.trunk, -14, groundY + 0.45, 2, 0.8, 0.9, 0.8));

  for (let x = -18; x <= -10; x += 1) {
    for (let z = -5; z <= 3; z += 1) {
      const pitch = Math.abs(z + 1) * 0.23;
      house.add(makeBlock(materials.roof, x, groundY + 2.0 + pitch, z, 1, 0.38, 1));
    }
  }

  house.add(makeBlock(materials.stone, -17.2, groundY + 2.8, 2.2, 0.7, 1.6, 0.7));
  world.add(house);
  makeLantern(world, materials, -10.75, groundY + 0.9, -1.55);
  makeLantern(world, materials, -14.4, groundY + 0.55, 3.1);
}

function addBridge(world, materials, y) {
  for (let x = -5; x <= 6; x += 1) {
    world.add(makeBlock(materials.plank, x, y, 7.5, 1, 0.22, 1.28));
    if (x % 3 === 0) {
      world.add(makeBlock(materials.trunk, x, y + 0.52, 6.75, 0.24, 1.25, 0.24));
      world.add(makeBlock(materials.trunk, x, y + 0.52, 8.25, 0.24, 1.25, 0.24));
    }
  }

  for (let x = -5; x <= 6; x += 1) {
    if (x % 3 !== 0) continue;
    world.add(makeBlock(materials.trunk, x, y + 1.08, 6.75, 1.05, 0.18, 0.18));
    world.add(makeBlock(materials.trunk, x, y + 1.08, 8.25, 1.05, 0.18, 0.18));
  }
}

function addFoliage(world, materials, surface) {
  const grassBlades = [];
  const flowers = [];
  const reeds = [];

  for (let i = 0; i < 190; i += 1) {
    const x = Math.floor(seededNoise(i, 3, 1) * 38 - 19);
    const z = Math.floor(seededNoise(i, 9, 2) * 33 - 13);
    if (isLakeTile(x, z)) continue;
    const ground = (surface.get(`${x},${z}`) ?? 0) - 0.15;
    const blade = makeBlock(
      materials.grassBlade,
      x + seededNoise(i, 2, 3) * 0.62 - 0.31,
      ground + 0.42,
      z + seededNoise(i, 4, 4) * 0.62 - 0.31,
      0.06,
      0.52 + seededNoise(i, 6, 6) * 0.28,
      0.06,
      { cast: false },
    );
    blade.rotation.y = seededNoise(i, 6, 5) * Math.PI;
    grassBlades.push(blade);
    world.add(blade);
  }

  for (let i = 0; i < 34; i += 1) {
    const x = Math.floor(seededNoise(i, 14, 7) * 34 - 17);
    const z = Math.floor(seededNoise(i, 20, 8) * 29 - 10);
    if (isLakeTile(x, z)) continue;
    const ground = (surface.get(`${x},${z}`) ?? 0) - 0.15;
    const flower = makeBlock(
      materials.flower,
      x + 0.35,
      ground + 0.72,
      z - 0.22,
      0.18,
      0.18,
      0.18,
      { cast: false },
    );
    flowers.push(flower);
    world.add(flower);
  }

  for (let i = 0; i < 46; i += 1) {
    const x = Math.floor(seededNoise(i, 12, 9) * 17 - 8);
    const z = Math.floor(seededNoise(i, 30, 10) * 12 - 3);
    if (!isLakeTile(x, z)) continue;
    const reed = makeBlock(
      materials.reed,
      x + seededNoise(i, 2, 11) * 0.7 - 0.35,
      -0.58,
      z + seededNoise(i, 3, 12) * 0.7 - 0.35,
      0.08,
      0.86,
      0.08,
      { cast: false },
    );
    reeds.push(reed);
    world.add(reed);
  }

  return { grassBlades, flowers, reeds };
}

function createWaterMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uDeep: { value: new THREE.Color(0x086a9b) },
      uShallow: { value: new THREE.Color(0x83edff) },
      uSun: { value: new THREE.Color(0xfff0b8) },
    },
    vertexShader: `
      uniform float uTime;
      varying vec2 vUv;
      varying float vWave;

      void main() {
        vUv = uv;
        vec3 pos = position;
        float waveA = sin((pos.x * 0.75 + uTime * 1.65)) * 0.075;
        float waveB = cos((pos.y * 1.18 - uTime * 1.18)) * 0.052;
        float waveC = sin((pos.x + pos.y) * 1.42 + uTime * 0.85) * 0.028;
        pos.z += waveA + waveB + waveC;
        vWave = waveA + waveB;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uDeep;
      uniform vec3 uShallow;
      uniform vec3 uSun;
      varying vec2 vUv;
      varying float vWave;

      void main() {
        float ripple = sin((vUv.x + vUv.y) * 34.0 + uTime * 2.4) * 0.5 + 0.5;
        ripple += sin((vUv.x * 21.0 - vUv.y * 15.0) - uTime * 1.6) * 0.18;
        float band = smoothstep(0.0, 1.0, vUv.y);
        float fresnel = pow(1.0 - smoothstep(0.0, 1.0, abs(vUv.y - 0.52) * 1.55), 2.0);
        vec3 water = mix(uDeep, uShallow, band * 0.8 + vWave * 1.6 + ripple * 0.08);
        float glintA = pow(max(0.0, sin(vUv.x * 34.0 - uTime * 2.25) * cos(vUv.y * 19.0 + uTime)), 9.0);
        float glintB = pow(max(0.0, sin((vUv.x + vUv.y) * 52.0 + uTime * 1.7)), 16.0);
        water += uSun * (glintA * 0.72 + glintB * 0.42);
        water += vec3(0.07, 0.2, 0.22) * ripple * 0.14;
        water = mix(water, vec3(0.82, 0.98, 1.0), fresnel * 0.16);
        gl_FragColor = vec4(water, 0.76);
      }
    `,
  });
}

function addSunRays(world) {
  const rays = new THREE.Group();
  const rayMaterial = new THREE.MeshBasicMaterial({
    color: 0xfff2c2,
    transparent: true,
    opacity: 0.16,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });

  for (let i = 0; i < 5; i += 1) {
    const ray = new THREE.Mesh(new THREE.PlaneGeometry(2.6 + i * 0.45, 18), rayMaterial.clone());
    ray.position.set(-9 + i * 4.4, 5.5, -4 - i * 0.8);
    ray.rotation.set(-0.72, 0.32, -0.32);
    ray.material.opacity = 0.09 + i * 0.018;
    rays.add(ray);
  }

  world.add(rays);
  return rays;
}

function createSkyDome() {
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(76, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        uTop: { value: new THREE.Color(0x88cff7) },
        uHorizon: { value: new THREE.Color(0xffe5bd) },
        uLow: { value: new THREE.Color(0xdaf8ff) },
      },
      vertexShader: `
        varying vec3 vWorldPosition;

        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uTop;
        uniform vec3 uHorizon;
        uniform vec3 uLow;
        varying vec3 vWorldPosition;

        void main() {
          float h = normalize(vWorldPosition).y * 0.5 + 0.5;
          vec3 color = mix(uLow, uHorizon, smoothstep(0.18, 0.46, h));
          color = mix(color, uTop, smoothstep(0.48, 1.0, h));
          gl_FragColor = vec4(color, 1.0);
        }
      `,
    }),
  );
  sky.renderOrder = -10;
  return sky;
}

function createSunDisc() {
  const texture = createRadialTexture("rgba(255, 246, 190, 0.95)", "rgba(255, 210, 99, 0)", 256);
  const sun = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: texture,
      color: 0xffefb0,
      transparent: true,
      opacity: 0.86,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  sun.position.set(-24, 20, -20);
  sun.scale.set(18, 18, 1);
  return sun;
}

function createCausticsMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(0xcefaff) },
    },
    vertexShader: `
      varying vec2 vUv;

      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uColor;
      varying vec2 vUv;

      void main() {
        vec2 uv = vUv * vec2(2.4, 1.7);
        float a = sin(uv.x * 34.0 + sin(uv.y * 13.0 + uTime * 1.4) * 2.8 - uTime * 2.2);
        float b = cos(uv.y * 39.0 + cos(uv.x * 9.0 - uTime * 0.9) * 2.0 + uTime * 1.6);
        float line = smoothstep(0.88, 1.0, a * b);
        float fade = smoothstep(0.03, 0.18, vUv.x) * smoothstep(0.97, 0.78, vUv.x);
        fade *= smoothstep(0.03, 0.18, vUv.y) * smoothstep(0.97, 0.78, vUv.y);
        gl_FragColor = vec4(uColor, line * fade * 0.34);
      }
    `,
  });
}

function addLakeCaustics(world) {
  const material = createCausticsMaterial();
  const caustics = new THREE.Mesh(new THREE.PlaneGeometry(17.8, 12.5, 1, 1), material);
  caustics.rotation.x = -Math.PI / 2;
  caustics.position.set(0.5, -1.93, 2.55);
  caustics.renderOrder = 2;
  world.add(caustics);
  return caustics;
}

function addSoftShadow(world, material, x, y, z, sx, sz, opacity = 0.42) {
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material.clone());
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.set(x, y + 0.012, z);
  shadow.scale.set(sx, sz, 1);
  shadow.material.opacity = opacity;
  shadow.renderOrder = 1;
  world.add(shadow);
  return shadow;
}

function makeLampPost(world, materials, x, y, z) {
  world.add(makeBlock(materials.trunk, x, y + 0.78, z, 0.22, 1.65, 0.22));
  world.add(makeBlock(materials.plank, x + 0.38, y + 1.48, z, 0.86, 0.18, 0.18));
  return makeLantern(world, materials, x + 0.86, y + 1.24, z);
}

function addShaderDetails(world, materials, surface) {
  const lanterns = [];
  const waterEdges = [];

  [
    [-8.2, -1.15, -3.2],
    [-8.2, -1.15, 7.8],
    [9.2, -1.15, -2.8],
    [9.2, -1.15, 7.6],
  ].forEach(([x, y, z]) => {
    const edge = makeBlock(materials.waterEdge.clone(), x, y, z, 0.08, 0.05, 1.9, { cast: false, receive: false });
    waterEdges.push(edge);
    world.add(edge);
  });

  [
    [-2.4, 0.2, 8.9],
    [2.4, 0.2, 8.8],
    [8.4, 0.35, 5.3],
    [-9.1, 0.15, 1.2],
  ].forEach(([x, y, z]) => {
    lanterns.push(makeLampPost(world, materials, x, y, z));
  });

  [
    [-6.4, -1.48, -0.8, 0.62, 0.08, 0.52],
    [-4.1, -1.5, 1.1, 0.48, 0.08, 0.48],
    [5.7, -1.49, 4.6, 0.7, 0.08, 0.42],
    [7.1, -1.48, 1.0, 0.5, 0.08, 0.62],
  ].forEach(([x, y, z, sx, sy, sz]) => {
    world.add(makeBlock(materials.lily, x, y, z, sx, sy, sz, { cast: false, receive: true }));
  });

  [
    [-7.5, -1.05, 9.8, 0.8, 0.35, 0.6],
    [11.4, 1.2, 9.1, 0.85, 0.55, 0.74],
    [-12.2, 0.1, -7.4, 0.78, 0.42, 0.7],
    [2.4, -1.2, -4.5, 0.6, 0.32, 0.5],
    [15.4, 2.0, 3.4, 0.7, 0.42, 0.62],
  ].forEach(([x, y, z, sx, sy, sz]) => {
    world.add(makeBlock(materials.stone, x, y, z, sx, sy, sz, { receive: true }));
  });

  [
    [-8.8, -0.2, -5.5, 5.8, 3.8, 0.28],
    [10.5, -0.1, -4.1, 6.2, 4.2, 0.3],
    [14.8, 1.2, 8.1, 5.5, 3.7, 0.24],
    [-14.2, 0.9, 8.2, 5.0, 3.2, 0.24],
    [-14.0, 0.1, -0.8, 8.0, 5.5, 0.22],
  ].forEach(([x, y, z, sx, sz, opacity]) => {
    addSoftShadow(world, materials.softShadow, x + 1.1, y, z + 0.75, sx, sz, opacity);
  });

  for (let i = 0; i < 18; i += 1) {
    const x = Math.floor(seededNoise(i, 42, 30) * 34 - 17);
    const z = Math.floor(seededNoise(i, 51, 31) * 27 - 10);
    if (isLakeTile(x, z)) continue;
    const ground = (surface.get(`${x},${z}`) ?? 0) - 0.08;
    world.add(
      makeBlock(
        materials.stone,
        x + seededNoise(i, 3, 32) * 0.42,
        ground + 0.08,
        z + seededNoise(i, 4, 33) * 0.42,
        0.24 + seededNoise(i, 5, 34) * 0.34,
        0.12,
        0.24 + seededNoise(i, 6, 35) * 0.3,
        { cast: false, receive: true },
      ),
    );
  }

  return { lanterns, waterEdges };
}

function initMinecraftScene() {
  const canvas = document.querySelector("#minecraft-scene");
  if (!(canvas instanceof HTMLCanvasElement)) return;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    preserveDrawingBuffer: true,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.65));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.04;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x9fdcff);
  scene.fog = new THREE.FogExp2(0xa9e2ff, 0.015);

  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 160);
  camera.position.set(11.8, 7.0, 15.4);

  scene.add(createSkyDome(), createSunDisc());

  const world = new THREE.Group();
  scene.add(world);

  const materials = createMaterials();
  const surface = addTerrain(world, materials);

  const waterMaterial = createWaterMaterial();
  const water = new THREE.Mesh(new THREE.PlaneGeometry(18, 12.8, 96, 72), waterMaterial);
  water.rotation.x = -Math.PI / 2;
  water.position.set(0.5, -2.03, 2.55);
  water.receiveShadow = true;
  world.add(water);
  const caustics = addLakeCaustics(world);

  addBridge(world, materials, -0.55);
  addHouse(world, materials, 0.25);
  const foliage = addFoliage(world, materials, surface);
  const shaderDetails = addShaderDetails(world, materials, surface);

  const treeSpecs = [
    [-8.8, -5.5, 1.0, true],
    [10.5, -4.1, 1.34, true],
    [14.8, 8.1, 1.08, true],
    [-14.2, 8.2, 1.2, false],
    [6.2, 12.7, 1.0, true],
    [-18.3, -9.2, 1.15, false],
  ];
  const trees = treeSpecs.map(([x, z, scale, blossom]) => {
    const ground = (surface.get(`${Math.round(x)},${Math.round(z)}`) ?? 0) - 0.65;
    const tree = makeTree(materials, x, z, ground, scale, blossom);
    world.add(tree);
    return tree;
  });

  const clouds = [
    makeCloud(materials.cloud, -13, 11.2, -9, 1.3),
    makeCloud(materials.cloud, 1.2, 12.8, -13, 1.75),
    makeCloud(materials.cloud, 14.5, 11.6, -7, 1.08),
    makeCloud(materials.cloud, -3.5, 10.6, 8, 1.0),
  ];
  clouds.forEach((cloud) => world.add(cloud));

  const petals = createPetals();
  world.add(petals);
  const sunRays = addSunRays(world);

  const sun = new THREE.DirectionalLight(0xffedc0, 5.2);
  sun.position.set(-16, 22, 12);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.00018;
  sun.shadow.normalBias = 0.045;
  sun.shadow.camera.left = -25;
  sun.shadow.camera.right = 25;
  sun.shadow.camera.top = 25;
  sun.shadow.camera.bottom = -25;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 70;
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0xdff7ff, 0x4b6b36, 1.0));

  const fill = new THREE.DirectionalLight(0x7bbcff, 0.72);
  fill.position.set(12, 7, -11);
  scene.add(fill);

  const startTime = performance.now();
  let frameId = 0;

  function resize() {
    const { clientWidth, clientHeight } = canvas;
    if (clientWidth === 0 || clientHeight === 0) return;
    renderer.setSize(clientWidth, clientHeight, false);
    camera.aspect = clientWidth / clientHeight;
    camera.updateProjectionMatrix();
  }

  function animate() {
    const elapsed = (performance.now() - startTime) / 1000;
    resize();

    if (!reduceMotion) {
      camera.position.x = Math.sin(elapsed * 0.115) * 5.1 + 10.6;
      camera.position.y = Math.sin(elapsed * 0.18) * 0.48 + 7.4;
      camera.position.z = Math.cos(elapsed * 0.105) * 3.8 + 16.2;
      camera.lookAt(0.35, 0.85, 2.2);

      waterMaterial.uniforms.uTime.value = elapsed;
      caustics.material.uniforms.uTime.value = elapsed;
      clouds.forEach((cloud, index) => {
        cloud.position.x += 0.006 + index * 0.0018;
        if (cloud.position.x > 24) cloud.position.x = -24;
      });

      trees.forEach((tree, index) => {
        tree.rotation.z = Math.sin(elapsed * 0.65 + index) * 0.006;
      });

      foliage.grassBlades.forEach((blade, index) => {
        blade.rotation.z = Math.sin(elapsed * 1.15 + index * 0.31) * 0.035;
      });
      foliage.reeds.forEach((reed, index) => {
        reed.rotation.z = Math.sin(elapsed * 1.0 + index * 0.27) * 0.045;
      });

      sunRays.children.forEach((ray, index) => {
        ray.material.opacity = 0.1 + Math.sin(elapsed * 0.38 + index) * 0.025;
      });

      shaderDetails.lanterns.forEach((lantern, index) => {
        const pulse = 1 + Math.sin(elapsed * 1.6 + index * 0.9) * 0.045;
        lantern.halo.scale.set(2.75 * pulse, 2.75 * pulse, 1);
        lantern.halo.material.opacity = 0.62 + Math.sin(elapsed * 1.2 + index) * 0.08;
        lantern.light.intensity = 2.5 + Math.sin(elapsed * 1.45 + index) * 0.24;
      });

      shaderDetails.waterEdges.forEach((edge, index) => {
        edge.material.opacity = 0.28 + Math.sin(elapsed * 0.95 + index * 1.8) * 0.08;
      });

      animatePetals(petals, elapsed);
    } else {
      camera.lookAt(0.35, 0.85, 2.2);
    }

    renderer.render(scene, camera);
    frameId = window.requestAnimationFrame(animate);
  }

  window.addEventListener("resize", resize);
  animate();

  return () => {
    window.cancelAnimationFrame(frameId);
    window.removeEventListener("resize", resize);
    renderer.dispose();
  };
}

function createPetals() {
  const petalGeometry = new THREE.BufferGeometry();
  const petalCount = 260;
  const petalPositions = new Float32Array(petalCount * 3);
  for (let i = 0; i < petalCount; i += 1) {
    petalPositions[i * 3] = seededNoise(i, 1, 20) * 38 - 19;
    petalPositions[i * 3 + 1] = seededNoise(i, 2, 21) * 14 + 1;
    petalPositions[i * 3 + 2] = seededNoise(i, 3, 22) * 29 - 12;
  }
  petalGeometry.setAttribute("position", new THREE.BufferAttribute(petalPositions, 3));
  const petals = new THREE.Points(
    petalGeometry,
    new THREE.PointsMaterial({
      color: 0xffc6d8,
      size: 0.095,
      transparent: true,
      opacity: 0.86,
      depthWrite: false,
    }),
  );
  petals.userData.count = petalCount;
  return petals;
}

function animatePetals(petals, elapsed) {
  const positions = petals.geometry.attributes.position.array;
  const petalCount = petals.userData.count;
  for (let i = 0; i < petalCount; i += 1) {
    const offset = i * 3;
    positions[offset] += Math.sin(elapsed * 0.72 + i) * 0.004 + 0.012;
    positions[offset + 1] -= 0.012 + seededNoise(i, 5, 24) * 0.007;
    positions[offset + 2] += Math.cos(elapsed * 0.5 + i) * 0.005;
    if (positions[offset + 1] < -1.2) {
      positions[offset] = seededNoise(i, elapsed, 25) * 38 - 19;
      positions[offset + 1] = seededNoise(i, elapsed, 26) * 10 + 8;
      positions[offset + 2] = seededNoise(i, elapsed, 27) * 29 - 12;
    }
    if (positions[offset] > 20) positions[offset] = -20;
  }
  petals.geometry.attributes.position.needsUpdate = true;
}

document.querySelectorAll("[data-copy-address]").forEach((button) => {
  button.addEventListener("click", copyAddress);
});

initLogin();
initMinecraftScene();
refreshStatus();
setInterval(refreshStatus, 60000);
