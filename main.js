import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// =============================================================================
// 1. CONFIGURACIÓN BASE Y ESCENA DEL LABORATORIO
// =============================================================================
const container = document.getElementById('canvas-container');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xdbeafe);
scene.fog = new THREE.Fog(0xdbeafe, 15, 38);

const initialCameraPos = new THREE.Vector3(0, 4.0, 8.5);
const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.copy(initialCameraPos);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
container.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.target.set(0, 2.1, 0);

// =============================================================================
// 2. ILUMINACIÓN Y ENTORNO CLÍNICO
// =============================================================================
const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 1.6);
dirLight.position.set(6, 11, 7);
dirLight.castShadow = true;
dirLight.shadow.mapSize.set(2048, 2048);
scene.add(dirLight);

const growLight = new THREE.PointLight(0xa855f7, 1.6, 8);
growLight.position.set(0, 5.5, 0);
scene.add(growLight);

// Suelo, Paredes y Ventanal de Ventilación
const floorMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(32, 32),
    new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.25 })
);
floorMesh.rotation.x = -Math.PI / 2;
floorMesh.receiveShadow = true;
scene.add(floorMesh);

const gridHelper = new THREE.GridHelper(32, 32, 0x94a3b8, 0xcbd5e1);
gridHelper.position.y = 0.005;
scene.add(gridHelper);

const wallMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.45 });
const backWall = new THREE.Mesh(new THREE.PlaneGeometry(32, 14), wallMat);
backWall.position.set(0, 7, -5.2);
backWall.receiveShadow = true;
scene.add(backWall);

// Ventanal e instrumentación
const mainTable = new THREE.Mesh(
    new THREE.BoxGeometry(8.8, 0.2, 2.6),
    new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.2, metalness: 0.3 })
);
mainTable.position.set(0, 1.2, 0);
mainTable.castShadow = true;
mainTable.receiveShadow = true;
scene.add(mainTable);

const legMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.85 });
[[-4.1, 0.6, -1.1], [4.1, 0.6, -1.1], [-4.1, 0.6, 1.1], [4.1, 0.6, 1.1]].forEach(([x, y, z]) => {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.2, 16), legMat);
    leg.position.set(x, y, z);
    scene.add(leg);
});

// =============================================================================
// 3. SHADERS GLSL PERSONALIZADOS Y MATERIALES
// =============================================================================
const vertexShaderSource = `
    uniform float uTime;
    uniform float uWindIntensity;
    varying vec2 vUv;
    varying float vLocalY;

    void main() {
        vUv = uv;
        vLocalY = position.y;
        vec3 pos = position;
        float windEffect = sin(uTime * 2.5 + pos.y * 3.0) * 0.08 * uWindIntensity * max(0.0, pos.y);
        pos.x += windEffect;
        pos.z += cos(uTime * 1.8 + pos.y * 2.0) * 0.05 * uWindIntensity * max(0.0, pos.y);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }
`;

const fragmentShaderSource = `
    uniform vec3 uBaseColor;
    uniform vec3 uTipColor;
    uniform float uGrowthProgress;
    varying vec2 vUv;
    varying float vLocalY;

    void main() {
        float factor = clamp(vLocalY * 2.0 + 0.2, 0.0, 1.0);
        vec3 finalColor = mix(uBaseColor, uTipColor, factor);
        finalColor *= (0.5 + 0.5 * clamp(uGrowthProgress * 1.5, 0.0, 1.0));
        gl_FragColor = vec4(finalColor, 1.0);
    }
`;

const shaderUniforms = {
    uTime: { value: 0.0 },
    uWindIntensity: { value: 1.0 },
    uBaseColor: { value: new THREE.Color(0x15803d) },
    uTipColor: { value: new THREE.Color(0x84cc16) },
    uGrowthProgress: { value: 0.0 }
};

const leafShaderMaterial = new THREE.ShaderMaterial({
    vertexShader: vertexShaderSource,
    fragmentShader: fragmentShaderSource,
    uniforms: shaderUniforms,
    side: THREE.DoubleSide
});

// =============================================================================
// 4. ESTRUCTURA Y SIMULACIÓN DE CRECIMIENTO
// =============================================================================
const clickableParts = [];
const plantNodes = []; // Colección de estructuras con lógica de propagación de crecimiento
let globalGrowthProgress = 0.0; // Estado global 0.0 (semilla) -> 1.0 (adulta)
let growthSpeed = 1.0;
let windIntensity = 1.0;
let isSimulationActive = true;

function tagPart(mesh, name, desc) {
    mesh.userData = {
        name: name,
        geoName: mesh.geometry.type,
        desc: desc,
        growthPct: 0
    };
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    clickableParts.push(mesh);
}

function createGrowthPlant(posX, posZ, scale = 1.0, plantId = 1, specimenCode = "SIM-01") {
    const plantRoot = new THREE.Group();
    plantRoot.position.set(posX, 1.3, posZ);
    plantRoot.scale.set(scale, scale, scale);
    scene.add(plantRoot);

    // Maceta y Sustrato (Constantes en tamaño)
    const potMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
    const potMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.52, 1.1, 32), potMat);
    potMesh.position.y = 0.55;
    tagPart(potMesh, `Maceta Hidropónica #${plantId}`, "Contenedor de cultivo estéril.");
    plantRoot.add(potMesh);

    const soilMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.68, 0.60, 0.1, 32),
        new THREE.MeshStandardMaterial({ color: 0x1f1614, roughness: 0.95 })
    );
    soilMesh.position.y = 1.0;
    tagPart(soilMesh, `Sustrato Nutritivo #${plantId}`, "Medio de soporte enriquecido.");
    plantRoot.add(soilMesh);

    // Nivel 1: Tallo Principal (Escala de 0 a 1 entre el 0% y el 40% del progreso global)
    const stemGroup = new THREE.Group();
    stemGroup.position.set(0, 1.1, 0);
    plantRoot.add(stemGroup);

    const stemHeight = 1.85;
    const stemMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.08, stemHeight, 16),
        new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.35 })
    );
    stemMesh.position.y = stemHeight / 2;
    tagPart(stemMesh, `Tallo Caulinario #${plantId}`, "Eje vascular en elongación celular.");
    stemGroup.add(stemMesh);

    plantNodes.push({
        type: 'stem',
        group: stemGroup,
        mesh: stemMesh,
        startThreshold: 0.0,
        endThreshold: 0.4,
        maxScaleY: 1.0
    });

    // Nivel 2: Hojas Helicoidales (Nacen progresivamente entre 30% y 80%)
    const leafGeo = new THREE.SphereGeometry(0.28, 16, 12);
    leafGeo.scale(1.75, 0.12, 0.55);

    const numLeaves = 7;
    for (let i = 0; i < numLeaves; i++) {
        const leafNode = new THREE.Group();
        const yPos = (i + 1) * (stemHeight / (numLeaves + 1.2));
        const rotY = i * (Math.PI * 0.55) + plantId;

        leafNode.position.set(0, yPos, 0);
        leafNode.rotation.y = rotY;

        const leafMesh = new THREE.Mesh(leafGeo, leafShaderMaterial);
        leafMesh.position.set(0.32, 0, 0);
        leafMesh.rotation.z = -0.22;
        tagPart(leafMesh, `Hoja #${i + 1} (${specimenCode})`, "Órgano fotosintético foliar.");
        leafNode.add(leafMesh);
        stemGroup.add(leafNode);

        const leafStart = 0.3 + (i / numLeaves) * 0.4;
        plantNodes.push({
            type: 'leaf',
            group: leafNode,
            mesh: leafMesh,
            startThreshold: leafStart,
            endThreshold: Math.min(1.0, leafStart + 0.2),
            maxScale: 1.0
        });
    }

    // Nivel 3: Flor Apical (Nace entre 75% y 100%)
    const flowerGroup = new THREE.Group();
    flowerGroup.position.set(0, stemHeight, 0);
    stemGroup.add(flowerGroup);

    const pistil = new THREE.Mesh(
        new THREE.ConeGeometry(0.14, 0.35, 16),
        new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.25 })
    );
    pistil.position.y = 0.12;
    tagPart(pistil, `Pistilo / Receptáculo (${specimenCode})`, "Órgano reproductor florido.");
    flowerGroup.add(pistil);

    const petalGeo = new THREE.ConeGeometry(0.28, 0.95, 16);
    petalGeo.scale(1.0, 1.0, 0.18);
    const petalMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 });

    for (let p = 0; p < 6; p++) {
        const petal = new THREE.Mesh(petalGeo, petalMat.clone());
        const angle = (p * Math.PI) / 3;
        petal.rotation.y = angle;
        petal.rotation.z = -Math.PI / 4;
        petal.position.set(Math.cos(angle) * 0.32, 0.4, Math.sin(angle) * 0.32);
        tagPart(petal, `Pétalo #${p + 1} (${specimenCode})`, "Tépalo corolino florido.");
        flowerGroup.add(petal);
    }

    plantNodes.push({
        type: 'flower',
        group: flowerGroup,
        startThreshold: 0.75,
        endThreshold: 1.0,
        maxScale: 1.0
    });
}

// Instanciar 3 plantas en el laboratorio
createGrowthPlant(-2.4, 0, 0.92, 1, "LC-01");
createGrowthPlant(0.0, 0, 1.05, 2, "LC-02");
createGrowthPlant(2.4, 0, 0.95, 3, "LC-03");

// =============================================================================
// 5. BUCLE DE ANIMACIÓN Y PROPAGACIÓN DE JERARQUÍAS
// =============================================================================
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);

    const delta = clock.getDelta();
    const time = clock.getElapsedTime();

    if (isSimulationActive) {
        // Avance temporal del crecimiento
        globalGrowthProgress += delta * 0.08 * growthSpeed;
        if (globalGrowthProgress > 1.0) globalGrowthProgress = 1.0;

        // Actualizar uniforms de shader
        shaderUniforms.uTime.value = time;
        shaderUniforms.uWindIntensity.value = windIntensity;
        shaderUniforms.uGrowthProgress.value = globalGrowthProgress;

        // Propagar transformaciones a lo largo de la jerarquía
        plantNodes.forEach(node => {
            if (globalGrowthProgress < node.startThreshold) {
                // Aún no ha empezado a crecer
                node.group.scale.set(0.0001, 0.0001, 0.0001);
                if (node.mesh) node.mesh.userData.growthPct = 0;
            } else if (globalGrowthProgress >= node.endThreshold) {
                // Completamente desarrollado
                node.group.scale.set(1, 1, 1);
                if (node.mesh) node.mesh.userData.growthPct = 100;
            } else {
                // Crecimiento en interpolación suave (Smoothstep)
                const localProgress = (globalGrowthProgress - node.startThreshold) / (node.endThreshold - node.startThreshold);
                const smoothScale = THREE.MathUtils.smoothstep(localProgress, 0.0, 1.0);

                if (node.type === 'stem') {
                    // El tallo escala principalmente a lo alto (eje Y)
                    node.group.scale.set(smoothScale * 0.8 + 0.2, smoothScale, smoothScale * 0.8 + 0.2);
                } else {
                    node.group.scale.set(smoothScale, smoothScale, smoothScale);
                }

                if (node.mesh) node.mesh.userData.growthPct = Math.round(smoothScale * 100);
            }
        });
    }

    controls.update();
    renderer.render(scene, camera);
}
animate();

// =============================================================================
// 6. RAYCASTING Y DETECCIÓN CLÍNICA
// =============================================================================
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

const infoPanelData = document.getElementById('plant-data');
const hintText = document.getElementById('hint-text');
const partNameEl = document.getElementById('part-name');
const partGeoEl = document.getElementById('part-geo');
const partGrowthEl = document.getElementById('part-growth');
const partHeightEl = document.getElementById('part-height');
const partDescEl = document.getElementById('part-desc');

let lastSelectedMesh = null;
let lastSelectedColor = null;

window.addEventListener('pointerdown', (event) => {
    if (event.target.closest('.hud-card')) return;

    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObjects(clickableParts, false);

    if (hits.length > 0) {
        const target = hits[0].object;

        if (lastSelectedMesh && lastSelectedMesh !== target && lastSelectedColor) {
            if (lastSelectedMesh.material.color) {
                lastSelectedMesh.material.color.setHex(lastSelectedColor);
            }
        }

        if (lastSelectedMesh !== target) {
            if (target.material.color) lastSelectedColor = target.material.color.getHex();
        }
        lastSelectedMesh = target;

        if (target.material.color) target.material.color.setHex(0x00ffff);

        const worldPos = new THREE.Vector3();
        target.getWorldPosition(worldPos);

        hintText.classList.add('hidden');
        infoPanelData.classList.remove('hidden');

        partNameEl.textContent = target.userData.name;
        partGeoEl.textContent = target.userData.geoName;
        partGrowthEl.textContent = `${target.userData.growthPct || Math.round(globalGrowthProgress * 100)}%`;
        partHeightEl.textContent = `${worldPos.y.toFixed(2)} m`;
        partDescEl.textContent = target.userData.desc;
    }
});

// =============================================================================
// 7. CONTROLES INTERACTIVOS UI
// =============================================================================
const btnToggleSim = document.getElementById('btn-toggle-sim');
btnToggleSim.addEventListener('click', () => {
    isSimulationActive = !isSimulationActive;
    btnToggleSim.textContent = isSimulationActive ? '⏸️ Pausar Simulación' : '▶️ Reanudar Simulación';
});

document.getElementById('btn-reset-growth').addEventListener('click', () => {
    globalGrowthProgress = 0.0;
});

const leafPalettes = [
    { base: 0x15803d, tip: 0x84cc16 },
    { base: 0x0284c7, tip: 0x38bdf8 },
    { base: 0xb45309, tip: 0xfde047 }
];
let paletteIdx = 0;
document.getElementById('btn-color-leaves').addEventListener('click', () => {
    paletteIdx = (paletteIdx + 1) % leafPalettes.length;
    shaderUniforms.uBaseColor.value.setHex(leafPalettes[paletteIdx].base);
    shaderUniforms.uTipColor.value.setHex(leafPalettes[paletteIdx].tip);
});

document.getElementById('btn-reset-cam').addEventListener('click', () => {
    camera.position.copy(initialCameraPos);
    controls.target.set(0, 2.1, 0);
    controls.update();
});

const sliderGrowthSpeed = document.getElementById('slider-growth-speed');
const valGrowthSpeedText = document.getElementById('val-growth-speed');
sliderGrowthSpeed.addEventListener('input', (e) => {
    growthSpeed = parseFloat(e.target.value);
    valGrowthSpeedText.textContent = `${growthSpeed.toFixed(1)}x`;
});

const sliderWind = document.getElementById('slider-wind');
const valWindText = document.getElementById('val-wind');
sliderWind.addEventListener('input', (e) => {
    windIntensity = parseFloat(e.target.value);
    valWindText.textContent = windIntensity.toFixed(1);
});

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});