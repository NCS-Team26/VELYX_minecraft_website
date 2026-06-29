import * as THREE from "three";
import "./styles.css";

const SERVER_ADDRESS = "nfoifsb.kr";
const STATUS_API = `https://api.mcstatus.io/v2/status/java/${SERVER_ADDRESS}`;

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

function initLogin() {
  if (!loginDialog || !loginForm || !loginButton) return;

  const savedName = localStorage.getItem("nfoifsb.nickname");
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

    if (remember) localStorage.setItem("nfoifsb.nickname", nickname);
    else localStorage.removeItem("nfoifsb.nickname");

    loginButton.textContent = nickname;
    if (loginMessage) loginMessage.textContent = `${nickname} 닉네임으로 로그인됨.`;
    window.setTimeout(() => loginDialog.close(), 450);
  });
}

function makeBlock(materials, x, y, z, sx = 1, sy = 1, sz = 1) {
  const geometry = new THREE.BoxGeometry(sx, sy, sz);
  const mesh = new THREE.Mesh(geometry, materials);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function makeTree(materials, x, z, scale = 1) {
  const tree = new THREE.Group();
  const trunkHeight = 3 * scale;
  const trunk = makeBlock(materials.trunk, x, trunkHeight / 2, z, 0.72 * scale, trunkHeight, 0.72 * scale);
  tree.add(trunk);

  const leafOffsets = [
    [0, 3.2, 0, 2.4, 1.1, 2.4],
    [-0.85, 3.65, 0.1, 1.45, 1.05, 1.45],
    [0.9, 3.75, -0.05, 1.55, 1.1, 1.55],
    [0.05, 4.35, 0.2, 1.7, 1.1, 1.7],
    [-0.15, 4.85, -0.25, 1.1, 0.9, 1.1],
  ];

  leafOffsets.forEach(([ox, oy, oz, sx, sy, sz], index) => {
    const leaf = makeBlock(
      index % 2 ? materials.blossomDeep : materials.blossom,
      x + ox * scale,
      oy * scale,
      z + oz * scale,
      sx * scale,
      sy * scale,
      sz * scale,
    );
    tree.add(leaf);
  });

  return tree;
}

function makeCloud(material, x, y, z, scale = 1) {
  const cloud = new THREE.Group();
  const chunks = [
    [0, 0, 0, 2.4, 0.7, 1.1],
    [1.35, 0.12, 0.1, 1.6, 0.8, 1.0],
    [-1.25, 0.08, 0, 1.6, 0.7, 0.9],
    [0.35, 0.42, -0.05, 1.4, 0.8, 1.1],
  ];
  chunks.forEach(([ox, oy, oz, sx, sy, sz]) => {
    cloud.add(makeBlock(material, ox * scale, oy * scale, oz * scale, sx * scale, sy * scale, sz * scale));
  });
  cloud.position.set(x, y, z);
  return cloud;
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
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.7));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0xb9ddff, 0.027);

  const camera = new THREE.PerspectiveCamera(44, 1, 0.1, 120);
  camera.position.set(13, 8.2, 16);

  const world = new THREE.Group();
  scene.add(world);

  const materials = {
    grass: new THREE.MeshLambertMaterial({ color: 0x7ca556 }),
    dirt: new THREE.MeshLambertMaterial({ color: 0x8a6547 }),
    stone: new THREE.MeshLambertMaterial({ color: 0x8f9693 }),
    trunk: new THREE.MeshLambertMaterial({ color: 0x5c3b29 }),
    plank: new THREE.MeshLambertMaterial({ color: 0xad7f46 }),
    roof: new THREE.MeshLambertMaterial({ color: 0x6d4b36 }),
    blossom: new THREE.MeshLambertMaterial({ color: 0xf4b7cc }),
    blossomDeep: new THREE.MeshLambertMaterial({ color: 0xd987ab }),
    cloud: new THREE.MeshLambertMaterial({ color: 0xf8fbff }),
    lantern: new THREE.MeshBasicMaterial({ color: 0xffc75a }),
  };

  const terrain = new THREE.Group();
  for (let x = -18; x <= 18; x += 1) {
    for (let z = -14; z <= 18; z += 1) {
      const hill = Math.sin(x * 0.34) + Math.cos(z * 0.28) + Math.sin((x + z) * 0.18);
      const shore = z > -2 && z < 7 && x > -7 && x < 8 ? -2.4 : 0;
      const height = Math.max(-1, Math.round(hill * 0.48 + shore));
      if (height < -1) continue;
      const material = height < 0 ? materials.stone : materials.grass;
      terrain.add(makeBlock(material, x, height, z, 1, 1, 1));
      if (height > -1) terrain.add(makeBlock(materials.dirt, x, height - 1, z, 1, 1, 1));
    }
  }
  terrain.position.y = -1.2;
  world.add(terrain);

  const waterGeometry = new THREE.PlaneGeometry(16, 13, 16, 10);
  const waterMaterial = new THREE.MeshStandardMaterial({
    color: 0x74c7e8,
    roughness: 0.22,
    metalness: 0.08,
    transparent: true,
    opacity: 0.58,
  });
  const water = new THREE.Mesh(waterGeometry, waterMaterial);
  water.rotation.x = -Math.PI / 2;
  water.position.set(1, -1.24, 2.5);
  water.receiveShadow = true;
  world.add(water);

  const house = new THREE.Group();
  for (let x = -15; x <= -11; x += 1) {
    for (let z = -3; z <= 1; z += 1) {
      house.add(makeBlock(materials.plank, x, 0.35, z, 1, 1.4, 1));
    }
  }
  for (let x = -16; x <= -10; x += 1) {
    for (let z = -4; z <= 2; z += 1) {
      const y = 1.55 + Math.abs(x + 13) * 0.16;
      house.add(makeBlock(materials.roof, x, y, z, 1, 0.45, 1));
    }
  }
  house.add(makeBlock(materials.lantern, -10.5, 0.25, -1.4, 0.35, 0.35, 0.35));
  house.position.y = -0.5;
  world.add(house);

  const trees = [
    makeTree(materials, -8.4, -5.2, 1.08),
    makeTree(materials, 10.2, -3.8, 1.25),
    makeTree(materials, 14.2, 8.2, 1.05),
    makeTree(materials, -13.5, 8.2, 1.2),
  ];
  trees.forEach((tree) => {
    tree.position.y = -0.8;
    world.add(tree);
  });

  const clouds = [
    makeCloud(materials.cloud, -13, 10.8, -8, 1.25),
    makeCloud(materials.cloud, 1, 12.5, -12, 1.7),
    makeCloud(materials.cloud, 14, 11.5, -7, 1.1),
  ];
  clouds.forEach((cloud) => world.add(cloud));

  const petalGeometry = new THREE.BufferGeometry();
  const petalCount = 180;
  const petalPositions = new Float32Array(petalCount * 3);
  for (let i = 0; i < petalCount; i += 1) {
    petalPositions[i * 3] = (Math.random() - 0.5) * 34;
    petalPositions[i * 3 + 1] = Math.random() * 13 + 1;
    petalPositions[i * 3 + 2] = (Math.random() - 0.5) * 25;
  }
  petalGeometry.setAttribute("position", new THREE.BufferAttribute(petalPositions, 3));
  const petals = new THREE.Points(
    petalGeometry,
    new THREE.PointsMaterial({
      color: 0xf0a9c4,
      size: 0.08,
      transparent: true,
      opacity: 0.78,
    }),
  );
  world.add(petals);

  const sun = new THREE.DirectionalLight(0xffffff, 2.5);
  sun.position.set(-10, 18, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0xdff2ff, 0x5b7047, 1.6));

  const clock = new THREE.Clock();
  let frameId = 0;

  function resize() {
    const { clientWidth, clientHeight } = canvas;
    if (clientWidth === 0 || clientHeight === 0) return;
    renderer.setSize(clientWidth, clientHeight, false);
    camera.aspect = clientWidth / clientHeight;
    camera.updateProjectionMatrix();
  }

  function animate() {
    const elapsed = clock.getElapsedTime();
    resize();

    if (!reduceMotion) {
      camera.position.x = Math.sin(elapsed * 0.12) * 4.8 + 10.5;
      camera.position.y = Math.sin(elapsed * 0.22) * 0.42 + 7.8;
      camera.position.z = Math.cos(elapsed * 0.11) * 3.2 + 16;
      camera.lookAt(0.5, 1.2, 1.5);

      water.position.y = -1.24 + Math.sin(elapsed * 1.35) * 0.05;
      water.rotation.z = Math.sin(elapsed * 0.28) * 0.015;
      clouds.forEach((cloud, index) => {
        cloud.position.x += 0.006 + index * 0.0015;
        if (cloud.position.x > 22) cloud.position.x = -22;
      });
      trees.forEach((tree, index) => {
        tree.rotation.z = Math.sin(elapsed * 0.75 + index) * 0.006;
      });

      const positions = petals.geometry.attributes.position.array;
      for (let i = 0; i < petalCount; i += 1) {
        const offset = i * 3;
        positions[offset] += Math.sin(elapsed * 0.7 + i) * 0.003 + 0.01;
        positions[offset + 1] -= 0.012;
        positions[offset + 2] += Math.cos(elapsed * 0.5 + i) * 0.004;
        if (positions[offset + 1] < -0.8) {
          positions[offset] = (Math.random() - 0.5) * 34;
          positions[offset + 1] = Math.random() * 10 + 7;
          positions[offset + 2] = (Math.random() - 0.5) * 25;
        }
        if (positions[offset] > 18) positions[offset] = -18;
      }
      petals.geometry.attributes.position.needsUpdate = true;
    } else {
      camera.lookAt(0.5, 1.2, 1.5);
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

document.querySelectorAll("[data-copy-address]").forEach((button) => {
  button.addEventListener("click", copyAddress);
});

initLogin();
initMinecraftScene();
refreshStatus();
setInterval(refreshStatus, 60000);
