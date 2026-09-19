import {
  Component,
  createEffect,
  createMemo,
  createSignal,
  For,
  onCleanup,
  onMount,
  Show,
} from "solid-js";
import * as THREE from "three";
import { Calendar, Droplets, Flame, RefreshCw, Rotate3d, Thermometer, Wind } from "lucide-solid";
import type { SimulationFrame } from "../lib/types";

export interface Land3DViewProps {
  frames: SimulationFrame[];
  t: number;
  currentFrame: SimulationFrame | null;
  theme: "dark" | "light";
  speed: number;
  isPlaying: boolean;
  visible?: boolean;
  onScrub?: (t: number) => void;
}

interface Persistent3DState {
  cameraPreset: "isometric" | "topdown" | "crossSection";
  autoRotate: boolean;
  showWaterCutaway: boolean;
  showParticles: boolean;
  spherical: { radius: number; theta: number; phi: number };
  targetLookAt: { x: number; y: number; z: number };
}

const persistent3DState: Persistent3DState = {
  cameraPreset: "isometric",
  autoRotate: false,
  showWaterCutaway: true,
  showParticles: true,
  spherical: { radius: 24, theta: Math.PI * 0.25, phi: Math.PI * 0.32 },
  targetLookAt: { x: 0, y: 0, z: 0 },
};

export const Land3DView: Component<Land3DViewProps> = (props) => {
  let canvasContainerRef: HTMLDivElement | null = null;

  // Camera presets and feature toggles restored from persistent state
  const [cameraPreset, setCameraPreset] = createSignal<"isometric" | "topdown" | "crossSection">(
    persistent3DState.cameraPreset,
  );
  const [autoRotate, setAutoRotate] = createSignal(persistent3DState.autoRotate);
  const [showWaterCutaway, setShowWaterCutaway] = createSignal(persistent3DState.showWaterCutaway);
  const [showParticles, setShowParticles] = createSignal(persistent3DState.showParticles);

  createEffect(() => {
    persistent3DState.cameraPreset = cameraPreset();
    persistent3DState.autoRotate = autoRotate();
    persistent3DState.showWaterCutaway = showWaterCutaway();
    persistent3DState.showParticles = showParticles();
  });

  // Calendar split-flap digit tracking
  const [prevDigits, setPrevDigits] = createSignal<string[]>(["0", "1"]);
  const [currDigits, setCurrDigits] = createSignal<string[]>(["0", "1"]);
  const [isFlipping, setIsFlipping] = createSignal(false);

  // Scan frames once to detect if a real historical year exists in the dataset
  const datasetYear = createMemo(() => {
    for (const frame of props.frames) {
      if (!frame.time_label) continue;
      const m = frame.time_label.match(/\b(19\d\d|20\d\d)\b/);
      if (m) return m[1];
    }
    return null;
  });

  // Parse date/calendar info cleanly from frame without hardcoded years or month fallbacks
  const calendarInfo = createMemo(() => {
    const f = props.currentFrame;
    const currentT = props.t;
    const total = Math.max(1, props.frames.length);

    if (!f) {
      const dStr = String(currentT).padStart(2, "0");
      return {
        digits: dStr.split(""),
        month: "TIMELINE",
        year: datasetYear() ?? "TIMELINE",
        dayLabel: `Step ${currentT} of ${total}`,
        subLabel: `t = ${currentT}/${total}`,
        isForecast: false,
      };
    }

    const label = (f.time_label || "").trim();
    let month = f.is_forecast ? "FORECAST" : "TIMELINE";
    let year: string = datasetYear() ?? (f.is_forecast ? "FORECAST" : "TIMELINE");
    let dayNum: string = String(currentT);
    let isRealDate = false;

    // 1. Try parsing ISO date e.g. "2024-10-01" or "2024/10/01"
    const isoMatch = label.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
    if (isoMatch) {
      year = isoMatch[1];
      const monthNum = parseInt(isoMatch[2]);
      const months = [
        "JANUARY",
        "FEBRUARY",
        "MARCH",
        "APRIL",
        "MAY",
        "JUNE",
        "JULY",
        "AUGUST",
        "SEPTEMBER",
        "OCTOBER",
        "NOVEMBER",
        "DECEMBER",
      ];
      month = months[monthNum - 1] || "TIMELINE";
      dayNum = String(parseInt(isoMatch[3]));
      isRealDate = true;
    } else {
      // 2. Try parsing "15-10-2024" or "15/10/2024"
      const dmyMatch = label.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
      if (dmyMatch) {
        dayNum = String(parseInt(dmyMatch[1]));
        const monthNum = parseInt(dmyMatch[2]);
        const months = [
          "JANUARY",
          "FEBRUARY",
          "MARCH",
          "APRIL",
          "MAY",
          "JUNE",
          "JULY",
          "AUGUST",
          "SEPTEMBER",
          "OCTOBER",
          "NOVEMBER",
          "DECEMBER",
        ];
        month = months[monthNum - 1] || "TIMELINE";
        year = dmyMatch[3];
        isRealDate = true;
      } else {
        // 3. Try parsing text dates: "12 Oct 2024", "12 October"
        const dateWords = label.match(/^(\d{1,2})\s+([A-Za-z]+)(?:\s+(\d{4}))?/);
        if (dateWords) {
          dayNum = dateWords[1];
          month = dateWords[2].toUpperCase();
          if (dateWords[3]) year = dateWords[3];
          isRealDate = true;
        } else {
          // 4. Try parsing "Oct 12, 2024"
          const monthFirst = label.match(/^([A-Za-z]+)\s+(\d{1,2})(?:\s+(\d{4}))?/);
          if (monthFirst && monthFirst[1].toLowerCase() !== "t") {
            month = monthFirst[1].toUpperCase();
            dayNum = monthFirst[2];
            if (monthFirst[3]) year = monthFirst[3];
            isRealDate = true;
          } else if (f.is_forecast && label.startsWith("+")) {
            // Forecast step label like "+1d", "+2d"
            month = "FORECAST";
            const stepNum = label.replace(/\D/g, "");
            dayNum = stepNum.length > 0 ? stepNum : String(currentT);
            year = datasetYear() ?? "FORECAST";
          }
        }
      }
    }

    // Pad digits cleanly (e.g. 2 digits: "01", "15")
    const rawDigits = isRealDate
      ? dayNum.length === 1
        ? `0${dayNum}`
        : dayNum
      : dayNum.length <= 2
        ? dayNum.padStart(2, "0")
        : dayNum;

    const padded = rawDigits.split("");

    const dayLabel = isRealDate
      ? `Day ${dayNum} of ${month}`
      : f.is_forecast
        ? `Forecast Horizon ${label}`
        : `Step ${currentT} of ${total}`;

    const subLabel =
      f.t !== currentT
        ? `Row #${f.t.toLocaleString()} · t = ${currentT}/${total}`
        : `t = ${currentT}/${total}`;

    return {
      digits: padded,
      month,
      year,
      dayLabel,
      subLabel,
      isForecast: f.is_forecast,
    };
  });

  // Trigger authentic 3D split-flap flip animation whenever digits change
  createEffect(() => {
    const newDigits = calendarInfo().digits;
    const oldDigits = currDigits();
    if (newDigits.join("") !== oldDigits.join("")) {
      setPrevDigits(oldDigits);
      setCurrDigits(newDigits);
      setIsFlipping(true);
      const timer = setTimeout(() => setIsFlipping(false), 280);
      onCleanup(() => clearTimeout(timer));
    }
  });

  // Risk classification helper
  const riskTier = () => {
    const pfvi = props.currentFrame?.pfvi ?? 0;
    if (pfvi <= 75)
      return { label: "Low", color: "#22c55e", bg: "bg-emerald-500", text: "text-emerald-400" };
    if (pfvi <= 150)
      return { label: "Moderate", color: "#eab308", bg: "bg-amber-500", text: "text-amber-400" };
    if (pfvi <= 225)
      return { label: "High", color: "#f97316", bg: "bg-orange-500", text: "text-orange-400" };
    return { label: "Extreme", color: "#ef4444", bg: "bg-rose-500", text: "text-rose-400" };
  };

  const fmt = (val: number | null | undefined, digits = 2, fallback = "-") => {
    if (val === null || val === undefined || isNaN(val)) return fallback;
    return val.toFixed(digits);
  };

  const fmtRain = (rf: number | null | undefined) => {
    if (rf === null || rf === undefined || isNaN(rf) || rf <= 0.00001) return "0.00 mm";
    if (rf < 0.01) return `${rf.toFixed(3)} mm`;
    return `${rf.toFixed(2)} mm`;
  };

  // Three.js Scene Variables
  let scene: THREE.Scene;
  let camera: THREE.PerspectiveCamera;
  let renderer: THREE.WebGLRenderer;
  let terrainMesh: THREE.Mesh;
  let terrainGeometry: THREE.PlaneGeometry;
  let waterPlane: THREE.Mesh;
  let canalWater: THREE.Mesh;
  let soilBlock: THREE.Mesh;
  let treeGroup: THREE.Group;
  let smokeParticles: THREE.Points;
  let rainParticles: THREE.Points;
  let firePointLight: THREE.PointLight;
  let sunLight: THREE.DirectionalLight;
  let ambientLight: THREE.AmbientLight;

  let animFrameId: number;
  let isPointerDown = false;
  let prevMouseX = 0;
  let prevMouseY = 0;
  let spherical = { ...persistent3DState.spherical };
  let targetLookAt = new THREE.Vector3(
    persistent3DState.targetLookAt.x,
    persistent3DState.targetLookAt.y,
    persistent3DState.targetLookAt.z,
  );

  // Preset camera vectors
  const applyCameraPreset = (preset: "isometric" | "topdown" | "crossSection") => {
    setCameraPreset(preset);
    if (preset === "isometric") {
      spherical = { radius: 24, theta: Math.PI * 0.25, phi: Math.PI * 0.32 };
      targetLookAt.set(0, 0, 0);
    } else if (preset === "topdown") {
      spherical = { radius: 22, theta: 0, phi: 0.05 }; // nearly vertical
      targetLookAt.set(0, 0, 0);
    } else if (preset === "crossSection") {
      spherical = { radius: 22, theta: Math.PI * 0.5, phi: Math.PI * 0.48 }; // side cutaway
      targetLookAt.set(0, -0.6, 0);
    }
    persistent3DState.spherical = { ...spherical };
    persistent3DState.targetLookAt = { x: targetLookAt.x, y: targetLookAt.y, z: targetLookAt.z };
  };

  // Color heat function for vertices
  const getHeatmapColor = (
    pfvi: number,
    elevation: number,
    distCanal: number,
    moisture: number,
  ) => {
    // Normalised risk factor 0..1
    const risk = Math.max(0, Math.min(1, pfvi / 300));
    const dryFactor = Math.max(0, Math.min(1, 1 - moisture / 60));

    const color = new THREE.Color();

    if (risk < 0.25) {
      // Low Risk (0..75): Deep lush wetland emerald greens
      const baseGreen = new THREE.Color(0x15803d); // rich dark green
      const lushGreen = new THREE.Color(0x22c55e); // bright moist green
      color.lerpColors(baseGreen, lushGreen, 0.4 + elevation * 0.4);
      // Darker damp green along canal
      color.lerp(new THREE.Color(0x0f766e), Math.exp(-distCanal * 1.6) * 0.45);
    } else if (risk < 0.5) {
      // Moderate Risk (75..150): Yellow-Green to Golden Amber
      const t = (risk - 0.25) / 0.25;
      const greenAmber = new THREE.Color(0x65a30d); // olive green
      const goldAmber = new THREE.Color(0xd97706); // golden amber
      color.lerpColors(greenAmber, goldAmber, t * 0.8 + dryFactor * 0.2);
    } else if (risk < 0.75) {
      // High Risk (150..225): Vivid Fire Hazard Orange & Burnt Peat
      const t = (risk - 0.5) / 0.25;
      const orange1 = new THREE.Color(0xea580c); // vivid fire orange
      const orange2 = new THREE.Color(0xc2410c); // deep burnt red-orange
      color.lerpColors(orange1, orange2, t * 0.75 + dryFactor * 0.25);
      color.lerp(new THREE.Color(0x7c2d12), (1 - Math.exp(-distCanal * 1.6)) * 0.25);
    } else {
      // Extreme Risk (>225): Intense Scorched Crimson & Smoldering Charred Black
      const t = (risk - 0.75) / 0.25;
      const fireCrimson = new THREE.Color(0xdc2626); // intense crimson
      const charredPeat = new THREE.Color(0x18181b); // charred ash black
      const smolder = elevation > 0.12 ? 0.85 : 0.35;
      color.lerpColors(charredPeat, fireCrimson, smolder * (0.6 + t * 0.4));
    }
    return color;
  };

  onMount(() => {
    if (!canvasContainerRef) return;

    const width = canvasContainerRef.clientWidth;
    const height = canvasContainerRef.clientHeight;

    // 1. Scene & Camera Setup
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 100);

    renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    canvasContainerRef.appendChild(renderer.domElement);

    // 2. Lighting
    ambientLight = new THREE.AmbientLight(
      props.theme === "light" ? 0xffffff : 0xe2e8f0,
      props.theme === "light" ? 0.75 : 0.6,
    );
    scene.add(ambientLight);

    sunLight = new THREE.DirectionalLight(0xfffbeb, 0.95);
    sunLight.position.set(15, 25, 15);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 1024;
    sunLight.shadow.mapSize.height = 1024;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 60;
    sunLight.shadow.camera.left = -12;
    sunLight.shadow.camera.right = 12;
    sunLight.shadow.camera.top = 12;
    sunLight.shadow.camera.bottom = -12;
    scene.add(sunLight);

    // Fire point light in center of terrain
    firePointLight = new THREE.PointLight(0xff4500, 0, 18);
    firePointLight.position.set(0, 2, 0);
    scene.add(firePointLight);

    // 3. Peatland Terrain Geometry (Plane 14x14 with micro-topography & canal)
    const gridSize = 48;
    terrainGeometry = new THREE.PlaneGeometry(14, 14, gridSize, gridSize);
    terrainGeometry.rotateX(-Math.PI / 2);

    const posAttr = terrainGeometry.attributes.position;
    const colors = new Float32Array(posAttr.count * 3);

    for (let i = 0; i < posAttr.count; i++) {
      const x = posAttr.getX(i);
      const z = posAttr.getZ(i);

      // Peat dome elevation: gentle curvature
      const domeY = 0.55 * Math.cos((x / 7) * Math.PI * 0.45) * Math.cos((z / 7) * Math.PI * 0.45);

      // Drainage canal trench running at x ≈ -1.8
      const distCanal = Math.abs(x - -1.8);
      const canalDepth = Math.exp(-Math.pow(distCanal / 0.75, 2)) * 0.75;

      // Hummock micro-topography
      const microY =
        Math.sin(x * 2.2) * Math.cos(z * 2.2) * 0.08 + Math.sin(x * 4.1 + z * 3.5) * 0.04;

      const y = Math.max(-0.65, domeY - canalDepth + microY);
      posAttr.setY(i, y);

      // Initial color
      const initColor = getHeatmapColor(180, y, distCanal, 35);
      colors[i * 3] = initColor.r;
      colors[i * 3 + 1] = initColor.g;
      colors[i * 3 + 2] = initColor.b;
    }

    terrainGeometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    terrainGeometry.computeVertexNormals();

    const terrainMaterial = new THREE.MeshStandardMaterial({
      roughness: 0.85,
      metalness: 0.1,
      vertexColors: true,
      flatShading: true,
    });

    terrainMesh = new THREE.Mesh(terrainGeometry, terrainMaterial);
    terrainMesh.receiveShadow = true;
    terrainMesh.castShadow = true;
    scene.add(terrainMesh);

    // 4. Subsurface Peat Soil Cutaway Block
    const soilGeom = new THREE.BoxGeometry(13.9, 1.8, 13.9);
    const soilMat = new THREE.MeshStandardMaterial({
      color: 0x27170e, // Rich dark organic peat
      roughness: 0.95,
      metalness: 0.05,
      flatShading: true,
    });
    soilBlock = new THREE.Mesh(soilGeom, soilMat);
    soilBlock.position.set(0, -1.0, 0);
    soilBlock.receiveShadow = true;
    scene.add(soilBlock);

    // 5. Water Table Horizontal Horizon Plane
    const waterGeom = new THREE.PlaneGeometry(13.8, 13.8);
    waterGeom.rotateX(-Math.PI / 2);
    const waterMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      roughness: 0.1,
      metalness: 0.2,
      transparent: true,
      opacity: 0.65,
    });
    waterPlane = new THREE.Mesh(waterGeom, waterMat);
    waterPlane.position.set(0, -0.4, 0);
    scene.add(waterPlane);

    // Canal surface water ribbon
    const canalGeom = new THREE.PlaneGeometry(1.2, 13.8);
    canalGeom.rotateX(-Math.PI / 2);
    canalWater = new THREE.Mesh(canalGeom, waterMat);
    canalWater.position.set(-1.8, -0.35, 0);
    scene.add(canalWater);

    // 6. Stylized Low-Poly Peat Swamp Trees & Vegetation
    treeGroup = new THREE.Group();
    const treePositions = [
      [-4.5, -4.0],
      [-3.8, -1.5],
      [-5.0, 2.5],
      [-3.5, 4.5],
      [1.0, -5.0],
      [2.5, -3.5],
      [4.5, -4.5],
      [3.2, -1.0],
      [1.5, 1.5],
      [4.0, 2.0],
      [2.2, 4.5],
      [4.8, 4.0],
      [-0.5, 3.5],
      [-0.8, -3.2],
      [5.2, -0.5],
      [-5.5, -0.2],
    ];

    const trunkGeom = new THREE.CylinderGeometry(0.06, 0.1, 0.9, 5);
    const foliageGeom = new THREE.DodecahedronGeometry(0.45, 0);

    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x3d2314, roughness: 0.9 });
    const foliageMat = new THREE.MeshStandardMaterial({
      color: 0x22c55e,
      roughness: 0.8,
      flatShading: true,
    });

    treePositions.forEach(([tx, tz]) => {
      // Find ground Y
      const domeY =
        0.55 * Math.cos((tx / 7) * Math.PI * 0.45) * Math.cos((tz / 7) * Math.PI * 0.45);
      const groundY = Math.max(-0.6, domeY);

      const tree = new THREE.Group();
      const trunk = new THREE.Mesh(trunkGeom, trunkMat);
      trunk.position.y = 0.45;
      trunk.castShadow = true;

      const foliage = new THREE.Mesh(foliageGeom, foliageMat.clone());
      foliage.position.y = 1.05;
      foliage.scale.set(
        1 + Math.random() * 0.3,
        1.1 + Math.random() * 0.3,
        1 + Math.random() * 0.3,
      );
      foliage.castShadow = true;

      tree.add(trunk);
      tree.add(foliage);
      tree.position.set(tx, groundY, tz);
      treeGroup.add(tree);
    });
    scene.add(treeGroup);

    // 7. Atmospheric Particle Systems (Smoke/Ember & Rain)
    // Smoke / Embers
    const smokeCount = 100;
    const smokeGeom = new THREE.BufferGeometry();
    const smokePos = new Float32Array(smokeCount * 3);
    const smokeColors = new Float32Array(smokeCount * 3);

    for (let i = 0; i < smokeCount; i++) {
      smokePos[i * 3] = (Math.random() - 0.5) * 12;
      smokePos[i * 3 + 1] = Math.random() * 6;
      smokePos[i * 3 + 2] = (Math.random() - 0.5) * 12;

      smokeColors[i * 3] = 0.95;
      smokeColors[i * 3 + 1] = 0.35;
      smokeColors[i * 3 + 2] = 0.1;
    }
    smokeGeom.setAttribute("position", new THREE.BufferAttribute(smokePos, 3));
    smokeGeom.setAttribute("color", new THREE.BufferAttribute(smokeColors, 3));

    const smokeMat = new THREE.PointsMaterial({
      size: 0.25,
      vertexColors: true,
      transparent: true,
      opacity: 0, // initially off
      blending: THREE.AdditiveBlending,
    });
    smokeParticles = new THREE.Points(smokeGeom, smokeMat);
    scene.add(smokeParticles);

    // Rain
    const rainCount = 140;
    const rainGeom = new THREE.BufferGeometry();
    const rainPos = new Float32Array(rainCount * 3);
    for (let i = 0; i < rainCount; i++) {
      rainPos[i * 3] = (Math.random() - 0.5) * 14;
      rainPos[i * 3 + 1] = Math.random() * 10;
      rainPos[i * 3 + 2] = (Math.random() - 0.5) * 14;
    }
    rainGeom.setAttribute("position", new THREE.BufferAttribute(rainPos, 3));
    const rainMat = new THREE.PointsMaterial({
      size: 0.12,
      color: 0x38bdf8,
      transparent: true,
      opacity: 0, // initially off
    });
    rainParticles = new THREE.Points(rainGeom, rainMat);
    scene.add(rainParticles);

    // Mouse Interaction for Camera Orbit
    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      e.preventDefault();
      isPointerDown = true;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isPointerDown) return;
      const deltaX = e.clientX - prevMouseX;
      const deltaY = e.clientY - prevMouseY;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;

      spherical.theta -= deltaX * 0.007;
      spherical.phi = Math.max(0.1, Math.min(Math.PI * 0.48, spherical.phi - deltaY * 0.007));
    };

    const onMouseUp = () => {
      isPointerDown = false;
      persistent3DState.spherical = { ...spherical };
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      spherical.radius = Math.max(10, Math.min(42, spherical.radius + e.deltaY * 0.015));
      persistent3DState.spherical = { ...spherical };
    };

    const dom = renderer.domElement;
    dom.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    dom.addEventListener("wheel", onWheel, { passive: false });

    // Handle Window Resize
    const onResize = () => {
      if (!canvasContainerRef) return;
      const w = canvasContainerRef.clientWidth;
      const h = canvasContainerRef.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", onResize);

    // Animation Loop
    let clock = new THREE.Clock();
    const animate = () => {
      animFrameId = requestAnimationFrame(animate);
      const delta = clock.getDelta();

      // Auto-rotation if enabled
      if (autoRotate() && !isPointerDown) {
        spherical.theta += delta * 0.18;
      }

      // Update camera position from spherical coordinates
      camera.position.x = spherical.radius * Math.sin(spherical.phi) * Math.sin(spherical.theta);
      camera.position.y = spherical.radius * Math.cos(spherical.phi);
      camera.position.z = spherical.radius * Math.sin(spherical.phi) * Math.cos(spherical.theta);
      camera.lookAt(targetLookAt);

      // Animate atmospheric particles
      if (smokeParticles && (smokeParticles.material as THREE.PointsMaterial).opacity > 0.02) {
        const positions = (smokeParticles.geometry.attributes.position as THREE.BufferAttribute)
          .array as Float32Array;
        for (let i = 0; i < smokeCount; i++) {
          positions[i * 3 + 1] += delta * 1.8; // rise up
          positions[i * 3] += Math.sin(positions[i * 3 + 1] * 2) * delta * 0.4;
          if (positions[i * 3 + 1] > 7) {
            positions[i * 3 + 1] = 0.2;
            positions[i * 3] = (Math.random() - 0.5) * 12;
            positions[i * 3 + 2] = (Math.random() - 0.5) * 12;
          }
        }
        smokeParticles.geometry.attributes.position.needsUpdate = true;
      }

      if (rainParticles && (rainParticles.material as THREE.PointsMaterial).opacity > 0.05) {
        const positions = (rainParticles.geometry.attributes.position as THREE.BufferAttribute)
          .array as Float32Array;
        for (let i = 0; i < rainCount; i++) {
          positions[i * 3 + 1] -= delta * 14; // fall down
          if (positions[i * 3 + 1] < 0) {
            positions[i * 3 + 1] = 10;
          }
        }
        rainParticles.geometry.attributes.position.needsUpdate = true;
      }

      if (props.visible !== false) {
        renderer.render(scene, camera);
      }
    };

    animate();

    onCleanup(() => {
      cancelAnimationFrame(animFrameId);
      dom.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      dom.removeEventListener("wheel", onWheel);
      window.removeEventListener("resize", onResize);
      renderer.dispose();
      terrainGeometry.dispose();
      (terrainMesh.material as THREE.Material).dispose();
      if (dom.parentElement) dom.parentElement.removeChild(dom);
    });
  });
  // Trigger resize and camera aspect update when visibility flips to true
  createEffect(() => {
    const isVis = props.visible !== false;
    if (isVis && renderer && camera && canvasContainerRef) {
      const w = canvasContainerRef.clientWidth;
      const h = canvasContainerRef.clientHeight;
      if (w > 0 && h > 0) {
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      }
    }
  });

  // Reactive Effect: Update 3D Surface Heatmap & Telemetry when frame changes
  createEffect(() => {
    const f = props.currentFrame;
    if (!f || !terrainGeometry) return;

    const pfvi = f.pfvi;
    const wt = f.wt;
    const sm = f.sm;
    const rf = f.rf;

    // 1. Update Surface Heatmap Vertex Colors
    const colors = terrainGeometry.attributes.color.array as Float32Array;
    const posAttr = terrainGeometry.attributes.position;

    for (let i = 0; i < posAttr.count; i++) {
      const x = posAttr.getX(i);
      const y = posAttr.getY(i);
      const distCanal = Math.abs(x - -1.8);

      const targetCol = getHeatmapColor(pfvi, y, distCanal, sm);
      colors[i * 3] = targetCol.r;
      colors[i * 3 + 1] = targetCol.g;
      colors[i * 3 + 2] = targetCol.b;
    }
    terrainGeometry.attributes.color.needsUpdate = true;

    // 2. Animate Water Table Horizon Height based on WT (meters)
    // WT ranges typically from 0.0m to -2.0m
    const targetWaterY = Math.max(-1.4, Math.min(0.05, -0.15 + wt * 0.5));
    if (waterPlane) {
      waterPlane.position.y = targetWaterY;
      waterPlane.visible = showWaterCutaway();
    }
    if (canalWater) {
      canalWater.position.y = Math.max(-0.6, targetWaterY + 0.05);
    }

    // 3. Update Tree Foliage Colors based on Fire Risk & Moisture
    if (treeGroup) {
      treeGroup.children.forEach((tree) => {
        const foliage = (tree as THREE.Group).children[1] as THREE.Mesh;
        if (foliage && foliage.material) {
          const mat = foliage.material as THREE.MeshStandardMaterial;
          if (pfvi <= 75) {
            mat.color.setHex(0x22c55e); // healthy green
          } else if (pfvi <= 150) {
            mat.color.setHex(0xca8a04); // olive/yellow wilted
          } else if (pfvi <= 225) {
            mat.color.setHex(0xea580c); // dry crispy orange
          } else {
            mat.color.setHex(0x451a03); // charred brown/black
          }
        }
      });
    }

    // 4. Update Atmospheric Particles
    if (smokeParticles) {
      const smokeMat = smokeParticles.material as THREE.PointsMaterial;
      if (pfvi > 150 && showParticles()) {
        const intensity = Math.min(1, (pfvi - 150) / 100);
        smokeMat.opacity = 0.4 + intensity * 0.45;
        smokeMat.size = 0.25 + intensity * 0.2;
      } else {
        smokeMat.opacity = 0;
      }
    }

    if (rainParticles) {
      const rainMat = rainParticles.material as THREE.PointsMaterial;
      if (rf > 0.0005 && showParticles()) {
        rainMat.opacity = 0.75;
      } else {
        rainMat.opacity = 0;
      }
    }

    // 5. Fire Point Light Intensity & Color
    if (firePointLight) {
      if (pfvi > 150) {
        const hazard = Math.min(1, (pfvi - 150) / 120);
        firePointLight.intensity = hazard * 3.5;
        firePointLight.color.setHex(pfvi > 225 ? 0xdc2626 : 0xf97316);
      } else {
        firePointLight.intensity = 0;
      }
    }

    // 6. Theme adaptation for ambient light
    if (ambientLight) {
      ambientLight.color.setHex(props.theme === "light" ? 0xffffff : 0xd1d5db);
      ambientLight.intensity = props.theme === "light" ? 0.75 : 0.6;
    }
  });

  return (
    <div class="relative w-full h-full flex flex-col overflow-hidden rounded-xl bg-slate-950 border border-slate-200 dark:border-slate-800/80 select-none shadow-xs transition-colors">
      {/* 3D WebGL Canvas Viewport */}
      <div
        ref={(el) => (canvasContainerRef = el)}
        class="w-full h-full cursor-grab active:cursor-grabbing"
      />

      {/* Keyframe Styles for 3D Split-Flap Drop Animation */}
      <style>{`
        @keyframes calendarFlapDown {
          0% {
            transform: rotateX(0deg);
            filter: brightness(1);
          }
          50% {
            transform: rotateX(-90deg);
            filter: brightness(0.65);
          }
          100% {
            transform: rotateX(-180deg);
            filter: brightness(0.3);
            opacity: 0;
          }
        }
      `}</style>

      {/* Floating Split-Flap Mechanical Flip Calendar HUD (Top Left) */}
      <div class="absolute left-3 top-3 z-20 pointer-events-none">
        <div class="backdrop-blur-md bg-white/92 dark:bg-slate-900/92 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-2.5 shadow-xl space-y-2 pointer-events-auto min-w-52.5 transition-all">
          {/* Calendar Header: Month + Status Badge */}
          <div class="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-1.5 text-slate-500 text-[10px] font-mono">
            <div class="flex items-center space-x-1.5">
              <Calendar size={13} class="text-emerald-500" />
              <span class="font-black tracking-wider text-slate-800 dark:text-slate-200 uppercase">
                {calendarInfo().month}
              </span>
            </div>
            <span
              class={`px-1.5 py-0.2 rounded text-[8px] font-bold ${
                calendarInfo().isForecast
                  ? "bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30"
                  : "bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/30"
              }`}
            >
              {calendarInfo().isForecast ? "FORECAST" : "HISTORY"}
            </span>
          </div>

          {/* Mechanical Split-Flap Date Number Flip Display */}
          <div class="py-1 flex items-center justify-between gap-3">
            <div class="flex items-center space-x-1.5">
              <For each={currDigits()}>
                {(digit, idx) => {
                  const prevDigit = () => prevDigits()[idx()] ?? digit;
                  return (
                    <div
                      class="relative w-10.5 h-15 rounded-xl overflow-hidden bg-slate-100 dark:bg-zinc-950 border border-slate-300 dark:border-zinc-700/80 shadow-md select-none"
                      style={{ perspective: "450px" }}
                    >
                      {/* Top Static Half */}
                      <div class="absolute inset-x-0 top-0 h-7.5 bg-linear-to-b from-slate-50 to-slate-100 dark:from-zinc-800 dark:to-zinc-900 overflow-hidden border-b border-slate-300/80 dark:border-black/90">
                        <div class="h-15 flex items-center justify-center">
                          <span class="text-3xl font-black font-mono text-slate-900 dark:text-white tracking-tight drop-shadow-[0_1px_1px_rgba(0,0,0,0.2)] dark:drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                            {digit}
                          </span>
                        </div>
                      </div>

                      {/* Bottom Static Half */}
                      <div class="absolute inset-x-0 bottom-0 h-7.5 bg-linear-to-b from-slate-100 to-slate-200 dark:from-zinc-900 dark:to-zinc-950 overflow-hidden">
                        <div class="h-15 -mt-7.5 flex items-center justify-center">
                          <span class="text-3xl font-black font-mono text-slate-900 dark:text-white tracking-tight drop-shadow-[0_1px_1px_rgba(0,0,0,0.2)] dark:drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                            {digit}
                          </span>
                        </div>
                      </div>

                      {/* Animated Falling Leaf Flap during flip */}
                      <Show when={isFlipping()}>
                        <div
                          class="absolute inset-x-0 top-0 h-7.5 bg-linear-to-b from-slate-50 to-slate-100 dark:from-zinc-800 dark:to-zinc-900 overflow-hidden z-10"
                          style={{
                            "transform-origin": "bottom",
                            animation:
                              "calendarFlapDown 280ms cubic-bezier(0.4, 0, 0.2, 1) forwards",
                          }}
                        >
                          <div class="h-15 flex items-center justify-center">
                            <span class="text-3xl font-black font-mono text-slate-900 dark:text-white tracking-tight drop-shadow-[0_1px_1px_rgba(0,0,0,0.2)] dark:drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                              {prevDigit()}
                            </span>
                          </div>
                        </div>
                      </Show>

                      {/* Mechanical Split Crease Line & Notch Cutouts */}
                      <div class="absolute inset-x-0 top-1/2 -translate-y-1/2 h-px bg-slate-400 dark:bg-black z-20 pointer-events-none" />
                      <div class="absolute inset-x-0 top-1/2 h-px bg-white/40 dark:bg-white/15 z-20 pointer-events-none" />
                      <div class="absolute -left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white dark:bg-slate-900 z-30 pointer-events-none border border-slate-300 dark:border-zinc-700/60 shadow-inner" />
                      <div class="absolute -right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white dark:bg-slate-900 z-30 pointer-events-none border border-slate-300 dark:border-zinc-700/60 shadow-inner" />
                    </div>
                  );
                }}
              </For>
            </div>

            {/* Date Details / Context */}
            <div class="text-right font-mono text-slate-500 dark:text-slate-400 text-[10px] leading-relaxed space-y-0.5">
              <div class="text-sm font-black text-slate-800 dark:text-slate-200 tracking-wide">
                {calendarInfo().year}
              </div>
              <div class="font-bold text-slate-700 dark:text-slate-300">
                {calendarInfo().dayLabel}
              </div>
              <div class="text-[9px] text-slate-400 dark:text-slate-500">
                {calendarInfo().subLabel}
              </div>
            </div>
          </div>

          {/* Current Risk Level Strip */}
          <div class="pt-1 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-[11px] font-mono">
            <span class="text-slate-500 dark:text-slate-400">Risk:</span>
            <span
              class={`px-2 py-0.5 rounded text-[10px] font-bold text-white shadow-2xs ${riskTier().bg}`}
            >
              {riskTier().label} (PFVI {fmt(props.currentFrame?.pfvi, 1)})
            </span>
          </div>
        </div>
      </div>

      {/* Floating Telemetry HUD (Bottom Left - Compact to fit without scrolling) */}
      <div class="absolute left-3 bottom-2.5 z-20 pointer-events-none">
        <div class="backdrop-blur-md bg-white/92 dark:bg-slate-900/92 border border-slate-200 dark:border-slate-700/80 rounded-xl p-2.5 shadow-xl space-y-1.5 pointer-events-auto min-w-67.5 max-w-72.5">
          <div class="flex items-center justify-between text-[9px] font-mono text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 pb-1">
            <span class="font-bold text-slate-800 dark:text-slate-200">Telemetri Lahan 3D</span>
            <span class="text-emerald-500 font-bold flex items-center space-x-1">
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Live Synced</span>
            </span>
          </div>

          {/* 4 Telemetry Metrics 2x2 Grid with generous gap to avoid collision */}
          <div class="grid grid-cols-2 gap-1.5 font-mono text-[10px]">
            {/* Water Table */}
            <div class="p-1 px-2 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between gap-1.5">
              <div class="flex items-center space-x-1 text-slate-500 dark:text-slate-400 text-[9px] shrink-0">
                <Droplets size={10} class="text-cyan-500 shrink-0" />
                <span>WT</span>
              </div>
              <span class="font-bold text-cyan-600 dark:text-cyan-400 text-[11px] shrink-0 font-mono">
                {fmt(props.currentFrame?.wt, 3)} m
              </span>
            </div>

            {/* Soil Moisture */}
            <div class="p-1 px-2 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between gap-1.5">
              <div class="flex items-center space-x-1 text-slate-500 dark:text-slate-400 text-[9px] shrink-0">
                <Wind size={10} class="text-emerald-500 shrink-0" />
                <span>SM</span>
              </div>
              <span class="font-bold text-emerald-600 dark:text-emerald-400 text-[11px] shrink-0 font-mono">
                {fmt(props.currentFrame?.sm, 1)}%
              </span>
            </div>

            {/* Rain - formats cleanly with fmtRain so it never overflows or touches label */}
            <div class="p-1 px-2 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between gap-1.5">
              <div class="flex items-center space-x-1 text-slate-500 dark:text-slate-400 text-[9px] shrink-0">
                <Droplets size={10} class="text-blue-500 shrink-0" />
                <span>Rain</span>
              </div>
              <span class="font-bold text-blue-600 dark:text-blue-400 text-[11px] shrink-0 font-mono">
                {fmtRain(props.currentFrame?.rf)}
              </span>
            </div>

            {/* Temperature */}
            <div class="p-1 px-2 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between gap-1.5">
              <div class="flex items-center space-x-1 text-slate-500 dark:text-slate-400 text-[9px] shrink-0">
                <Thermometer size={10} class="text-rose-500 shrink-0" />
                <span>Temp</span>
              </div>
              <span class="font-bold text-rose-600 dark:text-rose-400 text-[11px] shrink-0 font-mono">
                {fmt(props.currentFrame?.temp, 1)}°C
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Floating 3D Scene Controls (Top Right) */}
      <div class="absolute right-3.5 top-3.5 z-20 pointer-events-none flex flex-col items-end space-y-2">
        {/* Camera Views Preset Pills */}
        <div class="backdrop-blur-md bg-white/92 dark:bg-slate-900/92 border border-slate-200 dark:border-slate-700/80 rounded-xl p-1 shadow-lg flex items-center space-x-1 pointer-events-auto text-[10px] font-mono">
          <button
            type="button"
            onClick={() => applyCameraPreset("isometric")}
            class={`px-2 py-1 rounded-lg transition-colors cursor-pointer ${
              cameraPreset() === "isometric"
                ? "bg-emerald-600 text-white font-bold"
                : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
            title="Angled Isometric View"
          >
            Isometric
          </button>
          <button
            type="button"
            onClick={() => applyCameraPreset("topdown")}
            class={`px-2 py-1 rounded-lg transition-colors cursor-pointer ${
              cameraPreset() === "topdown"
                ? "bg-emerald-600 text-white font-bold"
                : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
            title="Top-Down Aerial Heatmap"
          >
            Top-Down
          </button>
          <button
            type="button"
            onClick={() => applyCameraPreset("crossSection")}
            class={`px-2 py-1 rounded-lg transition-colors cursor-pointer ${
              cameraPreset() === "crossSection"
                ? "bg-emerald-600 text-white font-bold"
                : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
            title="Peat Depth Cross-Section"
          >
            Cutaway
          </button>
        </div>

        {/* Feature Toggles (Water Table Cutaway, Particles, Auto-Rotate) */}
        <div class="backdrop-blur-md bg-white/92 dark:bg-slate-900/92 border border-slate-200 dark:border-slate-700/80 rounded-xl p-1.5 shadow-lg flex items-center space-x-1 pointer-events-auto text-xs">
          <button
            type="button"
            onClick={() => setAutoRotate(!autoRotate())}
            class={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
              autoRotate()
                ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800"
                : "border-transparent text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
            title="Toggle Cinematic Auto-Rotation"
          >
            <Rotate3d size={14} />
          </button>

          <button
            type="button"
            onClick={() => setShowWaterCutaway(!showWaterCutaway())}
            class={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
              showWaterCutaway()
                ? "bg-cyan-50 dark:bg-cyan-950/40 text-cyan-600 dark:text-cyan-400 border-cyan-300 dark:border-cyan-800"
                : "border-transparent text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
            title="Toggle Water Table Subsurface Cutaway"
          >
            <Droplets size={14} />
          </button>

          <button
            type="button"
            onClick={() => setShowParticles(!showParticles())}
            class={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
              showParticles()
                ? "bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 border-orange-300 dark:border-orange-800"
                : "border-transparent text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
            title="Toggle Smoke & Rain Atmospheric Particles"
          >
            <Flame size={14} />
          </button>

          <button
            type="button"
            onClick={() => applyCameraPreset(cameraPreset())}
            class="p-1.5 rounded-lg border border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title="Reset Camera View"
          >
            <RefreshCw size={14} />
          </button>
        </div>

        {/* Heatmap Legend Bar */}
        <div class="backdrop-blur-md bg-white/92 dark:bg-slate-900/92 border border-slate-200 dark:border-slate-700/80 rounded-xl p-2.5 shadow-lg pointer-events-auto w-48 space-y-1 text-[9px] font-mono">
          <div class="flex items-center justify-between text-slate-500">
            <span>PFVI Heatmap Index</span>
            <span class="font-bold text-slate-700 dark:text-slate-300">0..300+</span>
          </div>
          <div
            class="h-2 rounded-full w-full shadow-inner"
            style={{
              background:
                "linear-gradient(to right, #22c55e 0%, #eab308 30%, #f97316 65%, #dc2626 100%)",
            }}
          />
          <div class="flex items-center justify-between text-[8px] text-slate-400 pt-0.5">
            <span>Low (0)</span>
            <span>Mod (75)</span>
            <span>High (150)</span>
            <span>Ext (225+)</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Land3DView;
