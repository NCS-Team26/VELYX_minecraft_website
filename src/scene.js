import * as THREE from "three";

const BLOCK_GEOMETRY = new THREE.BoxGeometry(1, 1, 1);
const TERRAIN_MIN_Y = -4;
const WATER_LEVEL = -0.38;
const WATER_BED_Y = -2;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function hash2(x, z, salt = 0) {
  return Math.abs(Math.sin(x * 127.1 + z * 311.7 + salt * 91.3) * 43758.5453) % 1;
}

function smooth(t) {
  return t * t * (3 - 2 * t);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function valueNoise(x, z, salt = 0) {
  const x0 = Math.floor(x);
  const z0 = Math.floor(z);
  const xf = smooth(x - x0);
  const zf = smooth(z - z0);

  const a = hash2(x0, z0, salt);
  const b = hash2(x0 + 1, z0, salt);
  const c = hash2(x0, z0 + 1, salt);
  const d = hash2(x0 + 1, z0 + 1, salt);
  return lerp(lerp(a, b, xf), lerp(c, d, xf), zf);
}

function fbm(x, z, salt = 0) {
  return (
    valueNoise(x * 0.08, z * 0.08, salt) * 0.55 +
    valueNoise(x * 0.18, z * 0.18, salt + 4) * 0.3 +
    valueNoise(x * 0.38, z * 0.38, salt + 8) * 0.15
  );
}

function pickColor(palette, x, y, salt = 0) {
  return palette[Math.floor(hash2(x, y, salt) * palette.length) % palette.length];
}

function createPixelTexture(palette, size = 16, salt = 0) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");

  context.fillStyle = palette[0];
  context.fillRect(0, 0, size, size);

  for (let x = 0; x < size; x += 1) {
    for (let y = 0; y < size; y += 1) {
      const blockX = Math.floor(x / 2);
      const blockY = Math.floor(y / 2);
      const baseIndex = Math.floor(hash2(blockX, blockY, salt) * palette.length) % palette.length;
      const highlight = hash2(x, y, salt + 20) > 0.92 ? 1 : 0;
      context.fillStyle = palette[(baseIndex + highlight) % palette.length];
      context.fillRect(x, y, 1, 1);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestMipmapNearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createSquareTexture(fill, edge, size = 64) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  context.fillStyle = edge;
  context.fillRect(0, 0, size, size);
  context.fillStyle = fill;
  context.fillRect(4, 4, size - 8, size - 8);

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createGrassSideTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 16;
  canvas.height = 16;
  const context = canvas.getContext("2d");
  const dirt = createPixelTexture(["#866043", "#79543a", "#6d4932", "#926947"], 16, 42);
  context.drawImage(dirt.image, 0, 0);

  const grass = ["#74b44b", "#63a13e", "#83c45b", "#568c35"];
  for (let x = 0; x < 16; x += 1) {
    const drip = 4 + Math.floor(hash2(x, 0, 43) * 4);
    for (let y = 0; y < drip; y += 1) {
      context.fillStyle = grass[Math.floor(hash2(x, y, 44) * grass.length) % grass.length];
      context.fillRect(x, y, 1, 1);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestMipmapNearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createMaterials() {
  const textures = {
    grassTop: createPixelTexture(["#6caf45", "#75b84d", "#5f9f3b", "#82c455", "#4f8d32"], 16, 1),
    grassSide: createGrassSideTexture(),
    dirt: createPixelTexture(["#866043", "#79543a", "#6d4932", "#926947", "#60412d"], 16, 3),
    stone: createPixelTexture(["#7f7f7f", "#737373", "#8d8d8d", "#686868", "#9a9a9a"], 16, 4),
    sand: createPixelTexture(["#d8c783", "#e2d18f", "#c8b673", "#eadb9a"], 16, 5),
    oakLog: createPixelTexture(["#6b4b2e", "#765536", "#5d3f27", "#84613d"], 16, 6),
    oakPlank: createPixelTexture(["#b8894d", "#c29358", "#a87842", "#d0a064"], 16, 7),
    leaves: createPixelTexture(["#3f7d32", "#4d8f3b", "#5ba346", "#356d2d"], 16, 8),
    birchLog: createPixelTexture(["#e3dec8", "#f0ead8", "#d3cab0", "#2f2f2b"], 16, 9),
    spruce: createPixelTexture(["#2e5a35", "#244a2d", "#38693e", "#1f3d26"], 16, 10),
    path: createPixelTexture(["#9a7449", "#8a643d", "#aa8353", "#745337"], 16, 11),
    glass: createPixelTexture(["#9fd8ee", "#c6f2ff", "#7fc4dd", "#e6fbff"], 16, 12),
  };

  const standard = (texture, options = {}) =>
    new THREE.MeshStandardMaterial({
      map: texture,
      color: options.color ?? 0xffffff,
      roughness: options.roughness ?? 0.9,
      metalness: 0,
    });

  const grassTop = standard(textures.grassTop);
  const grassSide = standard(textures.grassSide);
  const dirt = standard(textures.dirt);

  return {
    grassBlock: [grassSide, grassSide, grassTop, dirt, grassSide, grassSide],
    dirt,
    stone: standard(textures.stone, { roughness: 0.95 }),
    sand: standard(textures.sand),
    oakLog: standard(textures.oakLog, { roughness: 0.96 }),
    oakPlank: standard(textures.oakPlank, { roughness: 0.88 }),
    leaves: standard(textures.leaves, { roughness: 0.82 }),
    birchLog: standard(textures.birchLog, { roughness: 0.94 }),
    spruce: standard(textures.spruce, { roughness: 0.84 }),
    path: standard(textures.path, { roughness: 0.92 }),
    glass: new THREE.MeshStandardMaterial({
      map: textures.glass,
      color: 0xd7f8ff,
      roughness: 0.18,
      transparent: true,
      opacity: 0.58,
    }),
    tallGrass: new THREE.MeshStandardMaterial({ color: 0x62a83d, roughness: 0.95 }),
    flowerRed: new THREE.MeshStandardMaterial({ color: 0xd73d32, roughness: 0.86 }),
    flowerYellow: new THREE.MeshStandardMaterial({ color: 0xf1d14a, roughness: 0.86 }),
    torch: new THREE.MeshStandardMaterial({
      color: 0xffc463,
      emissive: 0xff922e,
      emissiveIntensity: 1.8,
      roughness: 0.42,
    }),
    cloud: new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false }),
    sun: new THREE.SpriteMaterial({
      map: createSquareTexture("#fff0a9", "#ffd36a"),
      color: 0xffffff,
      fog: false,
      transparent: true,
    }),
  };
}

function isWaterTile(x, z) {
  const center = 6.2 + Math.sin(x * 0.19) * 1.3 + (fbm(x + 40, z - 10, 18) - 0.5) * 2.2;
  const halfWidth = 3.2 + fbm(x - 10, z + 18, 22) * 2.2;
  const lake = x > -18 && x < 15 && Math.abs(z - center) < halfWidth;
  const inlet = x > -7 && x < 8 && z > 0 && z < 15 && fbm(x, z, 27) > 0.52;
  return lake || inlet;
}

function terrainHeightAt(x, z) {
  if (isWaterTile(x, z)) return WATER_BED_Y;

  const rolling = (fbm(x, z, 3) - 0.48) * 6.2;
  const farRise = z < -11 ? 1.6 : 0;
  const rightHill = Math.max(0, 1 - Math.hypot(x - 17, z - 9) / 15) * 3.8;
  const leftBank = Math.max(0, 1 - Math.hypot(x + 18, z + 4) / 12) * 2.4;
  const shoreCut = Math.max(0, 1 - Math.abs(z - 6) / 7) * 0.8;
  return clamp(Math.round(rolling + farRise + rightHill + leftBank - shoreCut), -1, 6);
}

function touchesWater(x, z) {
  for (let dx = -1; dx <= 1; dx += 1) {
    for (let dz = -1; dz <= 1; dz += 1) {
      if (isWaterTile(x + dx, z + dz)) return true;
    }
  }
  return false;
}

function addInstancedBlocks(world, material, transforms, options = {}) {
  if (!transforms.length) return null;

  const mesh = new THREE.InstancedMesh(BLOCK_GEOMETRY, material, transforms.length);
  const matrix = new THREE.Matrix4();

  transforms.forEach(([x, y, z, sx = 1, sy = 1, sz = 1], index) => {
    matrix.makeScale(sx, sy, sz);
    matrix.setPosition(x, y, z);
    mesh.setMatrixAt(index, matrix);
  });

  mesh.castShadow = options.cast ?? true;
  mesh.receiveShadow = options.receive ?? true;
  world.add(mesh);
  return mesh;
}

function makeBlock(material, x, y, z, sx = 1, sy = 1, sz = 1, options = {}) {
  const block = new THREE.Mesh(BLOCK_GEOMETRY, material);
  block.position.set(x, y, z);
  block.scale.set(sx, sy, sz);
  block.castShadow = options.cast ?? true;
  block.receiveShadow = options.receive ?? true;
  return block;
}

function addTerrain(world, materials) {
  const surface = new Map();
  const waterTiles = [];
  const transforms = {
    grass: [],
    dirt: [],
    stone: [],
    sand: [],
  };

  for (let x = -34; x <= 34; x += 1) {
    for (let z = -27; z <= 34; z += 1) {
      const water = isWaterTile(x, z);
      const top = terrainHeightAt(x, z);
      const beach = !water && touchesWater(x, z) && top <= 1;
      surface.set(`${x},${z}`, top);
      if (water) waterTiles.push([x, z]);

      for (let y = TERRAIN_MIN_Y; y <= top; y += 1) {
        if (y < -2) {
          transforms.stone.push([x, y, z]);
        } else if (y === top && (water || beach)) {
          transforms.sand.push([x, y, z]);
        } else if (y === top) {
          transforms.grass.push([x, y, z]);
        } else {
          transforms.dirt.push([x, y, z]);
        }
      }
    }
  }

  addInstancedBlocks(world, materials.stone, transforms.stone);
  addInstancedBlocks(world, materials.dirt, transforms.dirt);
  addInstancedBlocks(world, materials.sand, transforms.sand);
  addInstancedBlocks(world, materials.grassBlock, transforms.grass);

  return { surface, waterTiles };
}

function createWaterMaterial() {
  return new THREE.ShaderMaterial({
    transparent: false,
    depthWrite: true,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uDeep: { value: new THREE.Color(0x2e78b7) },
      uShallow: { value: new THREE.Color(0x5fb2d8) },
      uSun: { value: new THREE.Color(0xfff4c2) },
    },
    vertexShader: `
      uniform float uTime;
      varying vec2 vUv;
      varying vec3 vWorld;

      void main() {
        vUv = uv;
        vec3 pos = position;
        pos.y += sin((pos.x * 0.7 + pos.z * 0.45) + uTime * 0.8) * 0.008;
        pos.y += cos((pos.x * 0.32 - pos.z * 0.52) - uTime * 0.6) * 0.006;

        vec4 worldPosition = modelMatrix * vec4(pos, 1.0);

        vWorld = worldPosition.xyz;
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uDeep;
      uniform vec3 uShallow;
      uniform vec3 uSun;
      varying vec2 vUv;
      varying vec3 vWorld;

      void main() {
        float broad = sin(vWorld.x * 0.28 + vWorld.z * 0.2 + uTime * 0.22) * 0.5 + 0.5;
        float soft = sin(vWorld.x * 0.55 - vWorld.z * 0.38 + uTime * 0.28) * 0.5 + 0.5;
        vec3 color = mix(uDeep, uShallow, 0.38 + broad * 0.08 + soft * 0.04);
        color += uSun * 0.025;
        gl_FragColor = vec4(color, 1.0);
      }
    `,
  });
}

function addWater(world, waterTiles) {
  const material = createWaterMaterial();
  const positions = [];
  const uvs = [];
  const indices = [];

  waterTiles.forEach(([x, z], index) => {
    const base = index * 4;
    const left = x - 0.51;
    const right = x + 0.51;
    const back = z - 0.51;
    const front = z + 0.51;

    positions.push(
      left,
      WATER_LEVEL,
      back,
      right,
      WATER_LEVEL,
      back,
      right,
      WATER_LEVEL,
      front,
      left,
      WATER_LEVEL,
      front,
    );
    uvs.push(left * 0.06, back * 0.06, right * 0.06, back * 0.06, right * 0.06, front * 0.06, left * 0.06, front * 0.06);
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true;
  mesh.renderOrder = 1;
  world.add(mesh);
  return material;
}

function surfaceY(surface, x, z) {
  return surface.get(`${Math.round(x)},${Math.round(z)}`) ?? terrainHeightAt(Math.round(x), Math.round(z));
}

function canPlace(surface, x, z) {
  return !isWaterTile(Math.round(x), Math.round(z)) && surfaceY(surface, x, z) >= -1;
}

function addOakTree(world, materials, surface, x, z, variant = 0) {
  if (!canPlace(surface, x, z)) return null;

  const ground = surfaceY(surface, x, z);
  const group = new THREE.Group();
  const height = 4 + (variant % 2);

  for (let y = 1; y <= height; y += 1) {
    group.add(makeBlock(materials.oakLog, x, ground + y, z));
  }

  for (let ly = height - 1; ly <= height + 2; ly += 1) {
    const radius = ly >= height + 2 ? 1 : 2;
    for (let lx = -radius; lx <= radius; lx += 1) {
      for (let lz = -radius; lz <= radius; lz += 1) {
        const corner = Math.abs(lx) === radius && Math.abs(lz) === radius;
        if (corner && hash2(x + lx, z + lz, ly) < 0.42) continue;
        group.add(makeBlock(materials.leaves, x + lx, ground + ly, z + lz));
      }
    }
  }

  world.add(group);
  return group;
}

function addSpruceTree(world, materials, surface, x, z) {
  if (!canPlace(surface, x, z)) return null;

  const ground = surfaceY(surface, x, z);
  const group = new THREE.Group();
  const height = 6;

  for (let y = 1; y <= height; y += 1) {
    group.add(makeBlock(materials.oakLog, x, ground + y, z));
  }

  for (let layer = 0; layer < 4; layer += 1) {
    const y = ground + height - layer;
    const radius = 1 + Math.floor(layer / 1.3);
    for (let lx = -radius; lx <= radius; lx += 1) {
      for (let lz = -radius; lz <= radius; lz += 1) {
        if (Math.abs(lx) + Math.abs(lz) > radius + 1) continue;
        group.add(makeBlock(materials.spruce, x + lx, y, z + lz));
      }
    }
  }

  world.add(group);
  return group;
}

function addBirchTree(world, materials, surface, x, z) {
  if (!canPlace(surface, x, z)) return null;

  const ground = surfaceY(surface, x, z);
  const group = new THREE.Group();

  for (let y = 1; y <= 5; y += 1) {
    group.add(makeBlock(materials.birchLog, x, ground + y, z));
  }

  for (let ly = 4; ly <= 6; ly += 1) {
    const radius = ly === 6 ? 1 : 2;
    for (let lx = -radius; lx <= radius; lx += 1) {
      for (let lz = -radius; lz <= radius; lz += 1) {
        if (Math.abs(lx) === 2 && Math.abs(lz) === 2 && ly === 5) continue;
        group.add(makeBlock(materials.leaves, x + lx, ground + ly, z + lz));
      }
    }
  }

  world.add(group);
  return group;
}

function addTrees(world, materials, surface) {
  const trees = [];
  const treeSpecs = [
    ["oak", -18, -7],
    ["oak", -20, 3],
    ["birch", -7, -11],
    ["oak", 4, -16],
    ["spruce", 18, -13],
    ["oak", 20, 5],
    ["birch", 18, 22],
    ["spruce", -22, 14],
    ["oak", -10, 22],
    ["spruce", 27, 18],
  ];

  treeSpecs.forEach(([type, x, z], index) => {
    const tree =
      type === "spruce"
        ? addSpruceTree(world, materials, surface, x, z)
        : type === "birch"
          ? addBirchTree(world, materials, surface, x, z)
          : addOakTree(world, materials, surface, x, z, index);
    if (tree) trees.push(tree);
  });

  return trees;
}

function addCabin(world, materials, surface) {
  const originX = -27;
  const originZ = -12;
  const ground = surfaceY(surface, originX, originZ);
  const group = new THREE.Group();

  for (let x = 0; x < 6; x += 1) {
    for (let z = 0; z < 5; z += 1) {
      group.add(makeBlock(materials.path, originX + x, ground + 1, originZ + z));
    }
  }

  for (let y = 2; y <= 4; y += 1) {
    for (let x = 0; x < 6; x += 1) {
      for (let z = 0; z < 5; z += 1) {
        const wall = x === 0 || x === 5 || z === 0 || z === 4;
        const door = x === 2 && z === 4 && y <= 3;
        const window = x === 5 && z === 2 && y === 3;
        if (wall && !door) {
          group.add(makeBlock(window ? materials.glass : materials.oakPlank, originX + x, ground + y, originZ + z));
        }
      }
    }
  }

  for (let layer = 0; layer < 3; layer += 1) {
    for (let x = -1 + layer; x <= 6 - layer; x += 1) {
      for (let z = -1 + layer; z <= 5 - layer; z += 1) {
        const edge = x === -1 + layer || x === 6 - layer || z === -1 + layer || z === 5 - layer;
        if (edge) group.add(makeBlock(materials.oakLog, originX + x, ground + 5 + layer, originZ + z));
      }
    }
  }

  world.add(group);

  const torch = makeBlock(materials.torch, originX + 3, ground + 3, originZ + 4.55, 0.28, 0.42, 0.28, {
    cast: false,
    receive: false,
  });
  const light = new THREE.PointLight(0xffb25c, 1.7, 7, 2.2);
  light.position.set(originX + 3, ground + 3.2, originZ + 4.7);
  world.add(torch, light);
}

function addGroundDetails(world, materials, surface) {
  const grassTransforms = [];
  const redFlowers = [];
  const yellowFlowers = [];

  for (let i = 0; i < 170; i += 1) {
    const x = Math.floor(hash2(i, 5, 30) * 60 - 30);
    const z = Math.floor(hash2(i, 8, 31) * 54 - 22);
    if (!canPlace(surface, x, z) || touchesWater(x, z)) continue;

    const y = surfaceY(surface, x, z) + 0.72;
    const h = 0.38 + hash2(i, 9, 32) * 0.32;
    grassTransforms.push([
      x + hash2(i, 1, 33) * 0.56 - 0.28,
      y,
      z + hash2(i, 2, 34) * 0.56 - 0.28,
      0.08,
      h,
      0.08,
    ]);
  }

  for (let i = 0; i < 34; i += 1) {
    const x = Math.floor(hash2(i, 14, 35) * 52 - 26);
    const z = Math.floor(hash2(i, 17, 36) * 46 - 18);
    if (!canPlace(surface, x, z) || touchesWater(x, z)) continue;
    const y = surfaceY(surface, x, z) + 0.72;
    const target = i % 2 === 0 ? redFlowers : yellowFlowers;
    target.push([x + 0.22, y, z - 0.18, 0.18, 0.22, 0.18]);
  }

  addInstancedBlocks(world, materials.tallGrass, grassTransforms, { cast: false });
  addInstancedBlocks(world, materials.flowerRed, redFlowers, { cast: false });
  addInstancedBlocks(world, materials.flowerYellow, yellowFlowers, { cast: false });
}

function addLilyPads(world, materials) {
  [
    [-8, 6],
    [-4, 8],
    [3, 5],
    [8, 7],
    [0, 12],
  ].forEach(([x, z]) => {
    if (!isWaterTile(x, z)) return;
    world.add(makeBlock(materials.leaves, x, WATER_LEVEL + 0.06, z, 0.72, 0.08, 0.72, { cast: false }));
  });
}

function addCloud(world, material, x, y, z, scale = 1) {
  const group = new THREE.Group();
  const pieces = [
    [0, 0, 0, 4, 0.45, 1],
    [2.4, 0, 0, 2.4, 0.45, 1],
    [-2.4, 0, 0, 2.4, 0.45, 1],
    [0.8, 0, 0.9, 2.2, 0.45, 1],
    [-0.8, 0, -0.9, 2.2, 0.45, 1],
  ];

  pieces.forEach(([ox, oy, oz, sx, sy, sz]) => {
    group.add(makeBlock(material, ox * scale, oy * scale, oz * scale, sx * scale, sy * scale, sz * scale, {
      cast: false,
      receive: false,
    }));
  });

  group.position.set(x, y, z);
  world.add(group);
  return group;
}

function addSky(scene, materials) {
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(120, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        uTop: { value: new THREE.Color(0x74bff0) },
        uHorizon: { value: new THREE.Color(0xd7f2ff) },
        uLow: { value: new THREE.Color(0xf3fbff) },
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
          vec3 color = mix(uLow, uHorizon, smoothstep(0.18, 0.44, h));
          color = mix(color, uTop, smoothstep(0.5, 1.0, h));
          gl_FragColor = vec4(color, 1.0);
        }
      `,
    }),
  );

  const sun = new THREE.Sprite(materials.sun);
  sun.position.set(-34, 35, -46);
  sun.scale.set(9, 9, 1);
  scene.add(sky, sun);
}

function frameCamera(camera, canvas, elapsed, reduceMotion) {
  const aspect = canvas.clientWidth / Math.max(canvas.clientHeight, 1);
  const portrait = aspect < 0.85;
  const base = portrait ? new THREE.Vector3(10, 6.4, 24) : new THREE.Vector3(13.5, 6.1, 22);
  const target = portrait ? new THREE.Vector3(-1.2, 1.4, 4.8) : new THREE.Vector3(-2, 1.2, 5.2);

  if (!reduceMotion) {
    base.x += Math.sin(elapsed * 0.12) * 0.55;
    base.y += Math.sin(elapsed * 0.24) * 0.08;
    base.z += Math.cos(elapsed * 0.1) * 0.45;
    target.x += Math.sin(elapsed * 0.1) * 0.28;
    target.z += Math.cos(elapsed * 0.08) * 0.28;
  }

  camera.position.copy(base);
  camera.lookAt(target);
}

// canvas is resolved and guarded (saveData / existence) by the caller in main.js.
export function initMinecraftScene(canvas) {
  if (!(canvas instanceof HTMLCanvasElement)) return;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const lowPower =
    window.innerWidth < 760 ||
    navigator.hardwareConcurrency <= 4 ||
    navigator.deviceMemory <= 4;
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: !lowPower,
    alpha: true,
    powerPreference: "high-performance",
    preserveDrawingBuffer: false,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, lowPower ? 1.15 : 1.35));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.LinearToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = !lowPower;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x8fd0ff);
  scene.fog = new THREE.Fog(0xbfe9ff, 34, 92);

  const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 180);
  const materials = createMaterials();
  addSky(scene, materials);

  const world = new THREE.Group();
  scene.add(world);

  const { surface, waterTiles } = addTerrain(world, materials);
  const waterMaterial = addWater(world, waterTiles);
  addTrees(world, materials, surface);
  addCabin(world, materials, surface);
  addGroundDetails(world, materials, surface);
  addLilyPads(world, materials);

  const clouds = [
    addCloud(world, materials.cloud, -20, 17, -34, 1.55),
    addCloud(world, materials.cloud, 18, 18, -38, 1.25),
    addCloud(world, materials.cloud, 2, 20, -48, 1.8),
  ];

  const sun = new THREE.DirectionalLight(0xfff1c7, 3.35);
  sun.position.set(-26, 36, 24);
  sun.castShadow = !lowPower;
  sun.shadow.mapSize.set(lowPower ? 512 : 1024, lowPower ? 512 : 1024);
  sun.shadow.bias = -0.00008;
  sun.shadow.normalBias = 0.02;
  sun.shadow.camera.left = -42;
  sun.shadow.camera.right = 42;
  sun.shadow.camera.top = 42;
  sun.shadow.camera.bottom = -42;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 90;
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0xe6f6ff, 0x587047, 1.55));

  const fill = new THREE.DirectionalLight(0xa9d6ff, 0.58);
  fill.position.set(22, 11, -18);
  scene.add(fill);

  const startTime = performance.now();
  let frameId = 0;
  let lastFrameAt = 0;
  let lastWidth = 0;
  let lastHeight = 0;
  let isVisible = !document.hidden;
  const frameInterval = lowPower ? 1000 / 30 : 1000 / 45;

  function resize() {
    const { clientWidth, clientHeight } = canvas;
    if (clientWidth === 0 || clientHeight === 0) return;
    if (clientWidth === lastWidth && clientHeight === lastHeight) return;

    lastWidth = clientWidth;
    lastHeight = clientHeight;
    renderer.setSize(clientWidth, clientHeight, false);
    camera.aspect = clientWidth / clientHeight;
    camera.fov = camera.aspect < 0.85 ? 58 : 52;
    camera.updateProjectionMatrix();
  }

  function renderFrame(timestamp = performance.now()) {
    const elapsed = (performance.now() - startTime) / 1000;
    resize();
    frameCamera(camera, canvas, elapsed, reduceMotion);

    if (!reduceMotion) {
      waterMaterial.uniforms.uTime.value = elapsed;
      clouds.forEach((cloud, index) => {
        cloud.position.x += 0.002 + index * 0.0008;
        if (cloud.position.x > 38) cloud.position.x = -38;
      });
    }

    renderer.render(scene, camera);
  }

  function animate(timestamp) {
    if (!isVisible) {
      frameId = window.requestAnimationFrame(animate);
      return;
    }

    if (timestamp - lastFrameAt >= frameInterval) {
      lastFrameAt = timestamp;
      renderFrame(timestamp);
    }

    frameId = window.requestAnimationFrame(animate);
  }

  function handleVisibility() {
    isVisible = !document.hidden;
    if (isVisible) lastFrameAt = 0;
  }

  function handleResize() {
    resize();
    if (reduceMotion) renderFrame();
  }

  window.addEventListener("resize", handleResize);
  document.addEventListener("visibilitychange", handleVisibility);
  if (reduceMotion) renderFrame();
  else animate(performance.now());

  return () => {
    window.cancelAnimationFrame(frameId);
    window.removeEventListener("resize", handleResize);
    document.removeEventListener("visibilitychange", handleVisibility);
    renderer.dispose();
  };
}
