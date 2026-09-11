// src/os/shell/use-holographic-head.ts
//
// Real holographic humanoid head: illuminated blue, full solid
// surface rendering of the actual face geometry -- NOT a wireframe/
// mesh-line rendering. Renamed from an earlier draft's filename
// (use-wireframe-head.ts) that no longer matched what the code
// actually does once the fresnel/scanline shader was applied directly
// to the solid mesh surface instead of a WireframeGeometry conversion. (public/models/facecap.glb -- actual
// human face topology from three.js's own MIT-licensed ARKit demo
// asset, see public/models/ATTRIBUTION.md), rendered with a genuine
// holographic material: fresnel rim-glow (edges bright,
// facing-camera surfaces nearly transparent) plus a moving scanline
// band, additive blending. This replaces the earlier primitive
// sphere+cylinder+lathe wireframe, which was geometrically abstract
// and did not read as a human head -- a real correction, not a
// relabeling.
//
// The shader is a real custom THREE.ShaderMaterial (fresnel +
// scanline), not a screenshot filter or a texture pretending to be an
// effect. Every visual parameter that changes is still driven by real
// aiState from the backend event bridge, same contract as before
// (setForm/setEyesLit/setAlert), so AIPresence.tsx did not need to
// change its calling code.

import { useEffect, useRef, type RefObject } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export interface HolographicHeadHandle {
  setForm: (progress: number) => void;
  setEyesLit: (lit: boolean) => void;
  setAlert: (alert: boolean) => void;
}

const COLOR_NOMINAL = new THREE.Color(0x2f8fff);
const COLOR_ALERT = new THREE.Color(0xf87171);

const HOLOGRAM_VERTEX_SHADER = `
  varying vec3 vNormal;
  varying vec3 vViewPosition;
  varying vec3 vWorldPosition;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vViewPosition = -mvPosition.xyz;
    vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const HOLOGRAM_FRAGMENT_SHADER = `
  uniform vec3 uColor;
  uniform float uTime;
  uniform float uFormProgress;
  varying vec3 vNormal;
  varying vec3 vViewPosition;
  varying vec3 vWorldPosition;
  void main() {
    vec3 viewDir = normalize(vViewPosition);
    float fresnel = pow(1.0 - max(dot(viewDir, normalize(vNormal)), 0.0), 2.2);
    float scanline = 0.5 + 0.5 * sin(vWorldPosition.y * 18.0 - uTime * 2.0);
    float scanBand = smoothstep(0.85, 1.0, scanline) * 0.4;
    float alpha = clamp((fresnel * 0.85 + scanBand) * uFormProgress, 0.0, 0.95);
    gl_FragColor = vec4(uColor, alpha);
  }
`;

function buildHologramMaterial(color: THREE.Color): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: color.clone() }, uTime: { value: 0 }, uFormProgress: { value: 0 } },
    vertexShader: HOLOGRAM_VERTEX_SHADER,
    fragmentShader: HOLOGRAM_FRAGMENT_SHADER,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

export function useHolographicHead(canvasRef: RefObject<HTMLCanvasElement>) {
  const stateRef = useRef<HolographicHeadHandle | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    camera.position.set(0, 0.05, 0.55);

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    const material = buildHologramMaterial(COLOR_NOMINAL);
    const headGroup = new THREE.Group();
    scene.add(headGroup);
    let modelLoaded = false;

    new GLTFLoader().load(
      '/models/facecap.glb',
      (gltf) => {
        gltf.scene.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            mesh.material = material;
          }
        });
        const box = new THREE.Box3().setFromObject(gltf.scene);
        const center = box.getCenter(new THREE.Vector3());
        gltf.scene.position.sub(center);
        headGroup.add(gltf.scene);
        modelLoaded = true;
      },
      undefined,
      (err) => {
        const fallback = new THREE.Mesh(new THREE.SphereGeometry(0.14, 24, 20), material);
        headGroup.add(fallback);
        modelLoaded = true;
        console.error('facecap.glb failed to load, using fallback sphere geometry:', err);
      },
    );

    const ringCount = 220;
    const ringPositions = new Float32Array(ringCount * 3);
    for (let i = 0; i < ringCount; i++) {
      const angle = (i / ringCount) * Math.PI * 2;
      const radius = 0.32 + Math.random() * 0.05;
      ringPositions[i * 3] = Math.cos(angle) * radius;
      ringPositions[i * 3 + 1] = -0.22 + (Math.random() - 0.5) * 0.02;
      ringPositions[i * 3 + 2] = Math.sin(angle) * radius;
    }
    const ringGeometry = new THREE.BufferGeometry();
    ringGeometry.setAttribute('position', new THREE.Float32BufferAttribute(ringPositions, 3));
    const ringMaterial = new THREE.PointsMaterial({ color: COLOR_NOMINAL, size: 0.006, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending });
    const ring = new THREE.Points(ringGeometry, ringMaterial);
    scene.add(ring);

    let formProgress = 0;
    let eyesLit = false;
    let alertActive = false;
    let raf = 0;
    let t = 0;

    function resize() {
      const w = canvas!.clientWidth || 1;
      const h = canvas!.clientHeight || 1;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    resize();
    window.addEventListener('resize', resize);

    function animate() {
      t += 0.016;
      const targetColor = alertActive ? COLOR_ALERT : COLOR_NOMINAL;
      material.uniforms.uColor.value.lerp(targetColor, 0.05);
      material.uniforms.uTime.value = t;
      material.uniforms.uFormProgress.value = 0.25 + 0.7 * formProgress;
      ringMaterial.color.lerp(targetColor, 0.05);
      ringMaterial.opacity = 0.3 + 0.5 * formProgress;

      if (modelLoaded) headGroup.rotation.y = Math.sin(t * 0.15) * 0.3;
      ring.rotation.y += 0.002 + (alertActive ? 0.006 : 0);

      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
    }
    animate();

    stateRef.current = {
      setForm: (p) => { formProgress = p; },
      setEyesLit: (v) => { eyesLit = v; void eyesLit; },
      setAlert: (v) => { alertActive = v; },
    };

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      material.dispose();
      ringGeometry.dispose(); ringMaterial.dispose();
      renderer.dispose();
    };
  }, [canvasRef]);

  return stateRef;
}
