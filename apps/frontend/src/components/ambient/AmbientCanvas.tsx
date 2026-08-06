import React, { useEffect, useRef } from "react";
import * as THREE from "three";

interface AmbientCanvasProps {
  isThinking?: boolean;
  severityColor?: string;
  onRevealReady?: () => void;
}

/**
 * Award-Winning Living Intelligence WebGL Canvas.
 *
 * Implements the 7-Scene Emotional Journey:
 * 1. The Void — Deep charcoal #050608 with subtle particle drift.
 * 2. Awakening — Physics attraction towards upper-center (18% above center).
 * 3. Emergence of Intelligence — Organic living sphere with 3D noise deformation & breathing motion.
 * 4. Agentic Reasoning — Internal neural network nodes with travelling energy pulses.
 * 5. Human Presence — Organism & particles deform towards cursor with soft magnetic attraction.
 * 6. Reveal — Living intelligence parts smoothly outward to frame the hero content.
 * 7. Continuous Life — Settles into background ambient breathing & responsive neural pulses.
 */
export const AmbientCanvas: React.FC<AmbientCanvasProps> = ({
  onRevealReady,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mouseRef = useRef<{ x: number; y: number; targetX: number; targetY: number }>({
    x: 0,
    y: 0,
    targetX: 0,
    targetY: 0,
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // --- 1. Scene, Camera, Renderer Setup ---
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x050608, 0.12);

    const camera = new THREE.PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      0.1,
      100,
    );
    camera.position.set(0, 0, 9);

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x050608, 1);
    container.appendChild(renderer.domElement);

    // --- 2. Geometry & Shader Setup ---

    // A. Particle Intelligence System (650 Particles)
    const PARTICLE_COUNT = 650;
    const particlePositions = new Float32Array(PARTICLE_COUNT * 3);
    const particleOriginals = new Float32Array(PARTICLE_COUNT * 3);
    const particleTargetSphere = new Float32Array(PARTICLE_COUNT * 3);
    const particlePhases = new Float32Array(PARTICLE_COUNT);

    // Seed initial void positions & sphere target positions
    const SPHERE_RADIUS = 1.45;
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      // Scene 1 Void random positions
      const vx = (Math.random() - 0.5) * 14;
      const vy = (Math.random() - 0.5) * 10;
      const vz = (Math.random() - 0.5) * 6 - 2;

      particlePositions[i * 3] = vx;
      particlePositions[i * 3 + 1] = vy;
      particlePositions[i * 3 + 2] = vz;

      particleOriginals[i * 3] = vx;
      particleOriginals[i * 3 + 1] = vy;
      particleOriginals[i * 3 + 2] = vz;

      // Golden ratio sphere distribution
      const phi = Math.acos(1 - (2 * (i + 0.5)) / PARTICLE_COUNT);
      const theta = Math.PI * (1 + Math.sqrt(5)) * i;

      const sx = SPHERE_RADIUS * Math.sin(phi) * Math.cos(theta);
      const sy = SPHERE_RADIUS * Math.sin(phi) * Math.sin(theta) + 0.8; // 18% above center
      const sz = SPHERE_RADIUS * Math.cos(phi);

      particleTargetSphere[i * 3] = sx;
      particleTargetSphere[i * 3 + 1] = sy;
      particleTargetSphere[i * 3 + 2] = sz;

      particlePhases[i] = Math.random() * Math.PI * 2;
    }

    const particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute("position", new THREE.BufferAttribute(particlePositions, 3));

    // Custom Particle Canvas Texture (Soft glowing radial disc)
    const createParticleTexture = (): THREE.CanvasTexture => {
      const canvas = document.createElement("canvas");
      canvas.width = 64;
      canvas.height = 64;
      const ctx = canvas.getContext("2d")!;

      const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
      grad.addColorStop(0, "rgba(255, 255, 255, 1.0)");
      grad.addColorStop(0.25, "rgba(200, 212, 255, 0.85)");
      grad.addColorStop(0.55, "rgba(123, 141, 255, 0.35)");
      grad.addColorStop(1, "rgba(123, 141, 255, 0.0)");

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(32, 32, 32, 0, Math.PI * 2);
      ctx.fill();

      const texture = new THREE.CanvasTexture(canvas);
      texture.needsUpdate = true;
      return texture;
    };

    const particleMaterial = new THREE.PointsMaterial({
      size: 0.08,
      map: createParticleTexture(),
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      opacity: 0.85,
    });

    const particlePoints = new THREE.Points(particleGeometry, particleMaterial);
    scene.add(particlePoints);

    // B. Internal Neural Reasoning Network Nodes & Edges
    const NODE_COUNT = 16;
    const nodePositions: THREE.Vector3[] = [];
    const nodeBasePositions: THREE.Vector3[] = [];

    for (let i = 0; i < NODE_COUNT; i++) {
      const u = Math.random() * Math.PI * 2;
      const v = Math.acos(Math.random() * 2 - 1);
      const r = 0.85 + Math.random() * 0.4;
      const pos = new THREE.Vector3(
        r * Math.sin(v) * Math.cos(u),
        r * Math.sin(v) * Math.sin(u) + 0.8,
        r * Math.cos(v),
      );
      nodePositions.push(pos.clone());
      nodeBasePositions.push(pos.clone());
    }

    // Node Visual Spheres
    const nodeGroup = new THREE.Group();
    const nodeMeshList: THREE.Mesh[] = [];
    const nodeGeo = new THREE.SphereGeometry(0.025, 16, 16);
    const nodeMat = new THREE.MeshBasicMaterial({
      color: 0xc8d4ff,
      transparent: true,
      opacity: 0.0,
    });

    nodePositions.forEach((pos) => {
      const mesh = new THREE.Mesh(nodeGeo, nodeMat.clone());
      mesh.position.copy(pos);
      nodeGroup.add(mesh);
      nodeMeshList.push(mesh);
    });
    scene.add(nodeGroup);

    // Connection Lines & Pulse Energy Lines
    const lineIndices: [number, number][] = [];
    for (let i = 0; i < NODE_COUNT; i++) {
      for (let j = i + 1; j < NODE_COUNT; j++) {
        const p1 = nodePositions[i];
        const p2 = nodePositions[j];
        if (p1 && p2 && p1.distanceTo(p2) < 1.45) {
          lineIndices.push([i, j]);
        }
      }
    }

    const linePositions = new Float32Array(lineIndices.length * 2 * 3);
    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute("position", new THREE.BufferAttribute(linePositions, 3));

    const lineMat = new THREE.LineBasicMaterial({
      color: 0x7b8dff,
      transparent: true,
      opacity: 0.0,
      blending: THREE.AdditiveBlending,
    });
    const lineSegments = new THREE.LineSegments(lineGeo, lineMat);
    scene.add(lineSegments);

    // Pulse Energy Traveling Sprites
    const PULSE_COUNT = 8;
    const pulseData: { edgeIdx: number; progress: number; speed: number }[] = [];
    const pulsePositions = new Float32Array(PULSE_COUNT * 3);

    for (let p = 0; p < PULSE_COUNT; p++) {
      pulseData.push({
        edgeIdx: Math.floor(Math.random() * Math.max(1, lineIndices.length)),
        progress: Math.random(),
        speed: 0.008 + Math.random() * 0.012,
      });
    }

    const pulseGeo = new THREE.BufferGeometry();
    pulseGeo.setAttribute("position", new THREE.BufferAttribute(pulsePositions, 3));
    const pulseMat = new THREE.PointsMaterial({
      size: 0.07,
      map: createParticleTexture(),
      color: 0xffffff,
      transparent: true,
      blending: THREE.AdditiveBlending,
      opacity: 0.0,
    });
    const pulsePoints = new THREE.Points(pulseGeo, pulseMat);
    scene.add(pulsePoints);

    // --- 3. Mouse Event Handling (Scene 5) ---
    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current.targetX = (e.clientX / window.innerWidth - 0.5) * 2;
      mouseRef.current.targetY = -(e.clientY / window.innerHeight - 0.5) * 2;
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener("resize", handleResize);

    // --- 4. Organic Noise Function (3D Perlin Approximation) ---
    const noise3D = (x: number, y: number, z: number, t: number): number => {
      return (
        Math.sin(x * 2.2 + t * 1.2) * Math.cos(y * 1.8 + t * 0.9) * 0.35 +
        Math.cos(z * 2.5 + t * 1.5) * Math.sin(x * 1.4 - t * 0.7) * 0.25
      );
    };

    // --- 5. Animation Loop (Scene Orchestration) ---
    let startTime: number | null = null;
    let animFrameId: number;
    let revealTriggered = false;

    const renderLoop = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const elapsedTime = (timestamp - startTime) / 1000; // Time in seconds

      // Smooth Mouse Spring Interpolation
      mouseRef.current.x += (mouseRef.current.targetX - mouseRef.current.x) * 0.05;
      mouseRef.current.y += (mouseRef.current.targetY - mouseRef.current.y) * 0.05;

      const mx = mouseRef.current.x * 2.5;
      const my = mouseRef.current.y * 2.5;

      // ── SCENE TIMELINE ORCHESTRATION ────────────────────────────────────
      const scene2Progress = THREE.MathUtils.clamp((elapsedTime - 1.0) / 1.5, 0, 1);
      const scene3Progress = THREE.MathUtils.clamp((elapsedTime - 2.5) / 2.0, 0, 1);
      const scene4Progress = THREE.MathUtils.clamp((elapsedTime - 4.5) / 1.5, 0, 1);
      const scene6Progress = THREE.MathUtils.clamp((elapsedTime - 6.0) / 1.5, 0, 1);

      // Notify parent when reveal completes
      if (scene6Progress >= 0.95 && !revealTriggered) {
        revealTriggered = true;
        onRevealReady?.();
      }

      // Smooth Easing (Cubic Out)
      const ease2 = 1 - Math.pow(1 - scene2Progress, 3);
      const ease6 = 1 - Math.pow(1 - scene6Progress, 3);

      // Camera Slow Drift
      camera.position.z = 9.0 - ease2 * 0.8;
      camera.position.x = mouseRef.current.x * 0.4;
      camera.position.y = mouseRef.current.y * 0.3;

      // --- Update Particle Positions ---
      const posAttr = particleGeometry.attributes.position as THREE.BufferAttribute;
      const posArr = posAttr.array as Float32Array;

      // Lateral opening factor for Scene 6 Reveal
      const revealPartingX = ease6 * 2.8;

      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const ix = i * 3;
        const iy = i * 3 + 1;
        const iz = i * 3 + 2;

        const origX = particleOriginals[ix] ?? 0;
        const origY = particleOriginals[iy] ?? 0;
        const origZ = particleOriginals[iz] ?? 0;

        const targetX = particleTargetSphere[ix] ?? 0;
        const targetY = particleTargetSphere[iy] ?? 0;
        const targetZ = particleTargetSphere[iz] ?? 0;

        // Smooth transition from Void to Living Organic Sphere
        let curX = THREE.MathUtils.lerp(origX, targetX, ease2);
        let curY = THREE.MathUtils.lerp(origY, targetY, ease2);
        let curZ = THREE.MathUtils.lerp(origZ, targetZ, ease2);

        // Apply 3D Organic Perlin Noise Deformation (Scene 3)
        if (scene3Progress > 0) {
          const phase = particlePhases[i] ?? 0;
          const n = noise3D(curX, curY, curZ, elapsedTime);
          const deformScale = scene3Progress * 0.45;
          curX += Math.cos(phase + elapsedTime * 0.8) * n * deformScale;
          curY += Math.sin(phase + elapsedTime * 0.8) * n * deformScale;
          curZ += Math.sin(n * Math.PI) * deformScale * 0.5;
        }

        // Apply Human Presence Magnetic Attraction (Scene 5)
        const dx = mx - curX;
        const dy = my - curY;
        const distSq = dx * dx + dy * dy + 0.1;
        const pull = (0.25 / distSq) * scene3Progress;
        curX += dx * pull * 0.08;
        curY += dy * pull * 0.08;

        // Apply Scene 6 Reveal (Parting like curtains outward to frame title)
        const sign = curX >= 0 ? 1 : -1;
        curX += sign * revealPartingX;

        posArr[ix] = curX;
        posArr[iy] = curY;
        posArr[iz] = curZ;
      }
      posAttr.needsUpdate = true;

      // Update Particle Opacity & Breathing
      particleMaterial.opacity = 0.4 + ease2 * 0.45 + Math.sin(elapsedTime * 1.5) * 0.08;

      // --- Update Neural Reasoning Network Nodes & Lines (Scene 4) ---
      const linePosAttr = lineGeo.attributes.position as THREE.BufferAttribute;
      const linePosArr = linePosAttr.array as Float32Array;

      nodePositions.forEach((pos, idx) => {
        const base = nodeBasePositions[idx];
        if (!base) return;

        const n = noise3D(base.x, base.y, base.z, elapsedTime * 0.9);

        // Smooth breathing & mouse interaction
        let nx = base.x + Math.sin(elapsedTime + idx) * 0.08 + n * 0.15;
        let ny = base.y + Math.cos(elapsedTime * 0.8 + idx) * 0.08 + n * 0.15;
        let nz = base.z + n * 0.1;

        // Mouse attraction
        nx += (mx - nx) * 0.04;
        ny += (my - ny) * 0.04;

        // Parting reveal
        const sign = nx >= 0 ? 1 : -1;
        nx += sign * revealPartingX * 0.7;

        pos.set(nx, ny, nz);

        // Update mesh position
        if (nodeMeshList[idx]) {
          const nodeMesh = nodeMeshList[idx];
          if (nodeMesh) {
            nodeMesh.position.copy(pos);
            const mat = nodeMesh.material as THREE.MeshBasicMaterial;
            mat.opacity = scene4Progress * 0.75 * (0.6 + Math.sin(elapsedTime * 3 + idx) * 0.4);
          }
        }
      });

      // Update Connection Line Positions
      let lIdx = 0;
      lineIndices.forEach(([i, j]) => {
        const p1 = nodePositions[i];
        const p2 = nodePositions[j];
        if (p1 && p2) {
          linePosArr[lIdx++] = p1.x;
          linePosArr[lIdx++] = p1.y;
          linePosArr[lIdx++] = p1.z;

          linePosArr[lIdx++] = p2.x;
          linePosArr[lIdx++] = p2.y;
          linePosArr[lIdx++] = p2.z;
        }
      });
      linePosAttr.needsUpdate = true;
      lineMat.opacity = scene4Progress * 0.35;

      // Update Pulse Energy Positions
      const pulsePosAttr = pulseGeo.attributes.position as THREE.BufferAttribute;
      const pulsePosArr = pulsePosAttr.array as Float32Array;

      pulseData.forEach((pulse, pIdx) => {
        pulse.progress += pulse.speed;
        if (pulse.progress > 1.0) {
          pulse.progress = 0.0;
          pulse.edgeIdx = Math.floor(Math.random() * Math.max(1, lineIndices.length));
        }

        const pair = lineIndices[pulse.edgeIdx];
        if (pair) {
          const [i, j] = pair;
          const p1 = nodePositions[i];
          const p2 = nodePositions[j];
          if (p1 && p2) {
            pulsePosArr[pIdx * 3] = THREE.MathUtils.lerp(p1.x, p2.x, pulse.progress);
            pulsePosArr[pIdx * 3 + 1] = THREE.MathUtils.lerp(p1.y, p2.y, pulse.progress);
            pulsePosArr[pIdx * 3 + 2] = THREE.MathUtils.lerp(p1.z, p2.z, pulse.progress);
          }
        }
      });
      pulsePosAttr.needsUpdate = true;
      pulseMat.opacity = scene4Progress * 0.85;

      // Render Scene
      renderer.render(scene, camera);
      animFrameId = requestAnimationFrame(renderLoop);
    };

    animFrameId = requestAnimationFrame(renderLoop);

    return () => {
      cancelAnimationFrame(animFrameId);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("resize", handleResize);
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      particleGeometry.dispose();
      particleMaterial.dispose();
      lineGeo.dispose();
      lineMat.dispose();
      pulseGeo.dispose();
      pulseMat.dispose();
      renderer.dispose();
    };
  }, [onRevealReady]);

  return (
    <div
      ref={containerRef}
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      aria-hidden
    />
  );
};
