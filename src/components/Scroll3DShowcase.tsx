import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  ArrowRight,
  Layers,
  Eye,
  Pause,
  Play,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from 'lucide-react';

export interface ShowcasePanelData {
  id: string;
  chapter: string;
  title: string;
  subtitle: string;
  description: string;
  imageUrl: string;
  detailLayerImageUrl?: string;
  depthBadgeLabel?: string;
  depthMetric?: string;
  ctaLabel: string;
  ctaPath: string;
  metaTag: string;
}

const DEFAULT_PANELS: ShowcasePanelData[] = [
  {
    id: 'panel-celebration-cakes',
    chapter: '01 / BESPOKE PATISSERIE',
    title: 'Hand-Finished Celebration Cakes',
    subtitle: '100% Eggless Sponges & Couverture Ganache',
    description:
      'Layered daily in our Renukoot studio with Belgian dark truffle, fresh rasmalai, and hand-piped buttercream architecture for milestone birthdays and weddings.',
    imageUrl: '/assets/cakes/loveys-tier-celebration-cake.jpg',
    detailLayerImageUrl: '/assets/cakes/loveys-chocolate-truffle-gateau.jpg',
    depthBadgeLabel: 'Foreground Layer · Hand-Piped Rosettes',
    depthMetric: '3-Tier Architecture · 1 kg – 5 kg',
    ctaLabel: 'Customise Your Cake',
    ctaPath: '/custom-cake',
    metaTag: '100% Eggless · Same-Day & Custom Tiers',
  },
  {
    id: 'panel-truffle-gateau',
    chapter: '02 / SIGNATURE GATEAUX',
    title: 'Rich Chocolate Truffle & Artisanal Slices',
    subtitle: 'Silky Mirror Glaze & Roasted Hazelnut Praline',
    description:
      'Every signature gateau balances moist dark cocoa sponge with slow-tempered ganache and delicate chocolate curls, available in 500g to 3kg formats.',
    imageUrl: '/assets/cakes/loveys-chocolate-truffle-gateau.jpg',
    detailLayerImageUrl: '/assets/cakes/loveys-tier-celebration-cake.jpg',
    depthBadgeLabel: 'Mid-Plane Layer · 54% Dark Couverture',
    depthMetric: 'Slow-Tempered Mirror Glaze',
    ctaLabel: 'Explore All Cakes',
    ctaPath: '/cakes',
    metaTag: 'Selectable Size, Flavour & Frosting',
  },
  {
    id: 'panel-stone-pizza',
    chapter: '03 / THE PIZZA CORNERS',
    title: 'Stone-Baked Pizzas & Savoury Café Classics',
    subtitle: 'Hand-Stretched Dough & Charred Paneer Tikka',
    description:
      'Baked piping hot to order with stretchy mozzarella, house-simmered San Marzano herb sauce, crispy stuffed garlic bread, and Belgian waffle specials.',
    imageUrl: '/assets/pizza/loveys-stone-baked-pizza.jpg',
    detailLayerImageUrl: '/assets/bakery/loveys-pastries-cookies.jpg',
    depthBadgeLabel: 'Hearth Layer · 320°C Stone Deck',
    depthMetric: '100% Mozzarella Pull · Fresh Dough',
    ctaLabel: 'Order Hot Pizzas',
    ctaPath: '/menu',
    metaTag: 'Hot Delivery · Takeaway · Dine-In QR',
  },
  {
    id: 'panel-bakery-treats',
    chapter: '04 / DAILY OVENS',
    title: 'Flaky Pastries, Cupcakes & Tea-Time Treats',
    subtitle: 'Small-Batch Morning Bakes',
    description:
      'From berry-crowned Danish pastries and fudge brownies to celebratory gift hampers, crafted fresh every morning opposite Tiwari Hotel in Renukoot.',
    imageUrl: '/assets/bakery/loveys-pastries-cookies.jpg',
    detailLayerImageUrl: '/assets/cakes/loveys-chocolate-truffle-gateau.jpg',
    depthBadgeLabel: 'Artisan Layer · 36-Fold Laminated Dough',
    depthMetric: 'Baked Fresh Daily at 8:30 AM',
    ctaLabel: 'Browse Bakery Menu',
    ctaPath: '/menu',
    metaTag: 'Fresh Morning Batches · Gift Boxes',
  },
];

/**
 * Computes controlled opacity and Z-axis depth for a slide given its offset
 * from the current continuous scroll index (`offset = slideIndex - continuousIndex`).
 * - `offset === 0`: Active pinned focal plane (Z = +0.16m, Opacity = 1.0)
 * - `offset > 0`: Upcoming slides receding into negative Z-depth with controlled distance attenuation
 * - `offset < 0`: Passed slides advancing forward along positive Z toward the camera while cross-dissolving out
 */
function computeCinematicSlideMetrics(offset: number) {
  const absOffset = Math.abs(offset);

  // Z-axis movement: upcoming slides emerge from deep -Z, pass through focal 0, and exit toward +Z camera
  const zMeters =
    offset >= 0
      ? THREE.MathUtils.lerp(0.16, -3.4, Math.min(1, offset / 2.6))
      : THREE.MathUtils.lerp(0.16, 1.55, Math.min(1, Math.abs(offset) / 1.15));

  const zPixels =
    offset >= 0
      ? Math.round(24 - Math.min(340, offset * 135))
      : Math.round(24 + Math.min(195, Math.abs(offset) * 165));

  // Controlled opacity curve: full clarity at focal plane, smooth depth fade in -Z, rapid clean dissolve in +Z
  let opacity = 1;
  if (offset > 0) {
    // Receding in -Z
    const norm = Math.min(1, offset / 2.25);
    opacity = THREE.MathUtils.clamp(Math.pow(1 - norm * 0.72, 1.55), 0.14, 1);
  } else if (offset < 0) {
    // Advancing toward viewer in +Z
    const norm = Math.min(1, Math.abs(offset) / 0.92);
    opacity = THREE.MathUtils.clamp(1 - Math.pow(norm, 1.4), 0, 1);
  }

  // Boost focal clarity within narrow central threshold
  if (absOffset < 0.08) {
    opacity = 1;
  }

  return {
    zMeters,
    zPixels,
    opacity: Number(opacity.toFixed(3)),
  };
}

interface SlideThreeBundle {
  rootGroup: THREE.Group;
  backplateLayer: THREE.Mesh;
  bevelLayer: THREE.Mesh;
  photoLayer: THREE.Mesh;
  foregroundFrameLayer: THREE.Group;
  materials: THREE.MeshStandardMaterial[];
}

interface Scroll3DShowcaseProps {
  onNavigate: (path: string) => void;
  panels?: ShowcasePanelData[];
}

export const Scroll3DShowcase: React.FC<Scroll3DShowcaseProps> = ({
  onNavigate,
  panels = DEFAULT_PANELS,
}) => {
  const sectionRef = useRef<HTMLElement | null>(null);
  const canvasMountRef = useRef<HTMLDivElement | null>(null);

  const [activeIndex, setActiveIndex] = useState(0);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [continuousSlideIndex, setContinuousSlideIndex] = useState(0);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState<boolean>(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });
  const [manualMotionPaused, setManualMotionPaused] = useState(false);
  const [webglUnavailable, setWebglUnavailable] = useState(false);

  const isMotionPaused = prefersReducedMotion || manualMotionPaused;

  // Refs shared with Three.js render loop
  const targetProgressRef = useRef(0);
  const currentProgressRef = useRef(0);
  const pointerTargetRef = useRef({ x: 0, y: 0 });
  const pointerCurrentRef = useRef({ x: 0, y: 0 });
  const requestRenderRef = useRef<(() => void) | null>(null);

  // 1. Dynamically subscribe to OS/Browser `prefers-reduced-motion: reduce` changes
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handleMotionPreferenceChange = (event: MediaQueryListEvent | MediaQueryList) => {
      setPrefersReducedMotion(Boolean(event.matches));
    };

    handleMotionPreferenceChange(mediaQuery);

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleMotionPreferenceChange);
      return () => mediaQuery.removeEventListener('change', handleMotionPreferenceChange);
    } else if (typeof (mediaQuery as any).addListener === 'function') {
      (mediaQuery as any).addListener(handleMotionPreferenceChange);
      return () => (mediaQuery as any).removeListener(handleMotionPreferenceChange);
    }
  }, []);

  // 2. Three.js WebGL Multi-Layer 3D Photographic Stage (Paused automatically when isMotionPaused is true)
  useEffect(() => {
    if (isMotionPaused) {
      return;
    }

    const container = canvasMountRef.current;
    if (!container) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance',
      });
    } catch {
      setWebglUnavailable(true);
      return;
    }

    const gl = renderer.getContext();
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    const unmasked = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : '';
    const isSoftwareGl = /SwiftShader|llvmpipe|softpipe|Software/i.test(unmasked);

    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const initialW = container.clientWidth || 680;
    const initialH = container.clientHeight || 500;
    renderer.setSize(initialW, initialH, false);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(36, initialW / initialH, 0.1, 50);
    camera.position.set(0, 0.08, 6.2);

    // Studio Environment Lighting
    const pmrem = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    const envTarget = pmrem.fromScene(roomEnv, 0.04);
    scene.environment = envTarget.texture;
    roomEnv.dispose();
    pmrem.dispose();

    const keyLight = new THREE.DirectionalLight(0xfff3e2, 2.25);
    keyLight.position.set(4.5, 6.5, 5.5);
    if (!isSoftwareGl) {
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.set(1024, 1024);
      keyLight.shadow.bias = -0.0005;
    }
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0xe5b867, 1.15);
    rimLight.position.set(-4.5, -2.5, 3.2);
    scene.add(rimLight);

    const hemiLight = new THREE.HemisphereLight(0xfff8f1, 0x2c1b18, 0.8);
    scene.add(hemiLight);

    const stageGroup = new THREE.Group();
    scene.add(stageGroup);

    // Architectural orbital depth rings
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0xd9a45b,
      metalness: 0.8,
      roughness: 0.25,
      transparent: true,
      opacity: 0.72,
    });

    const orbitalRingGeo = new THREE.TorusGeometry(2.75, 0.012, 16, 96);
    const orbitalRing = new THREE.Mesh(orbitalRingGeo, ringMat);
    orbitalRing.rotation.x = Math.PI * 0.44;
    orbitalRing.position.set(0, -1.38, -0.45);
    stageGroup.add(orbitalRing);

    const innerRingGeo = new THREE.TorusGeometry(1.95, 0.008, 12, 72);
    const innerRing = new THREE.Mesh(innerRingGeo, ringMat);
    innerRing.rotation.x = Math.PI * 0.44;
    innerRing.position.set(0, -1.38, -0.45);
    stageGroup.add(innerRing);

    const textureLoader = new THREE.TextureLoader();
    const maxAniso = renderer.capabilities.getMaxAnisotropy();

    const frameOuterGeo = new THREE.BoxGeometry(3.04, 2.26, 0.07);
    const passepartoutGeo = new THREE.BoxGeometry(2.84, 2.08, 0.06);
    const photoPlaneGeo = new THREE.PlaneGeometry(2.64, 1.88);
    const accentCornerGeo = new THREE.BoxGeometry(0.36, 0.032, 0.04);
    const floatingPlaqueGeo = new THREE.BoxGeometry(1.08, 0.26, 0.03);

    const disposables: Array<{ dispose: () => void }> = [
      orbitalRingGeo,
      innerRingGeo,
      ringMat,
      envTarget,
      frameOuterGeo,
      passepartoutGeo,
      photoPlaneGeo,
      accentCornerGeo,
      floatingPlaqueGeo,
    ];

    const slideBundles: SlideThreeBundle[] = [];

    panels.forEach((panel, idx) => {
      const rootGroup = new THREE.Group();

      // Each slide gets dedicated materials so opacity can be controlled independently along Z-depth
      const backplateMat = new THREE.MeshStandardMaterial({
        color: 0x261714,
        metalness: 0.1,
        roughness: 0.75,
        transparent: true,
        opacity: 1,
      });

      const bevelMat = new THREE.MeshStandardMaterial({
        color: 0xf7ece1,
        metalness: 0.05,
        roughness: 0.82,
        transparent: true,
        opacity: 1,
      });

      const brassTrimMat = new THREE.MeshStandardMaterial({
        color: 0xe5b867,
        metalness: 0.82,
        roughness: 0.22,
        transparent: true,
        opacity: 1,
      });

      const photoMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.3,
        metalness: 0.04,
        transparent: true,
        opacity: 1,
      });

      disposables.push(backplateMat, bevelMat, brassTrimMat, photoMat);

      // LAYER 1 (Deep Backplate Z = -0.14): Architectural shadow monolith
      const backplateLayer = new THREE.Mesh(frameOuterGeo, backplateMat);
      backplateLayer.position.z = -0.14;
      if (!isSoftwareGl) {
        backplateLayer.castShadow = true;
        backplateLayer.receiveShadow = true;
      }
      rootGroup.add(backplateLayer);

      // LAYER 2 (Mid-Back Passepartout Z = -0.02): Archival museum mat
      const bevelLayer = new THREE.Mesh(passepartoutGeo, bevelMat);
      bevelLayer.position.z = -0.02;
      rootGroup.add(bevelLayer);

      // LAYER 3 (Focal Photographic Plane Z = +0.08): High-resolution culinary photograph
      textureLoader.load(
        panel.imageUrl,
        (tex) => {
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.anisotropy = maxAniso;
          photoMat.map = tex;
          photoMat.needsUpdate = true;
          disposables.push(tex);
          if (requestRenderRef.current) requestRenderRef.current();
        },
        undefined,
        () => {}
      );

      const photoLayer = new THREE.Mesh(photoPlaneGeo, photoMat);
      photoLayer.position.z = 0.08;
      rootGroup.add(photoLayer);

      // LAYER 4 (Foreground Parallax Frame & Specular Trim Z = +0.19): Floating depth accents
      const foregroundFrameLayer = new THREE.Group();
      foregroundFrameLayer.position.z = 0.19;

      const topTrim = new THREE.Mesh(accentCornerGeo, brassTrimMat);
      topTrim.position.set(-1.14, 0.98, 0);
      foregroundFrameLayer.add(topTrim);

      const bottomTrim = new THREE.Mesh(accentCornerGeo, brassTrimMat);
      bottomTrim.position.set(1.14, -0.98, 0);
      foregroundFrameLayer.add(bottomTrim);

      const cornerBadge = new THREE.Mesh(floatingPlaqueGeo, backplateMat);
      cornerBadge.position.set(0.76, -0.82, 0.03);
      foregroundFrameLayer.add(cornerBadge);

      rootGroup.add(foregroundFrameLayer);

      // Initial placement along the Z-axis
      const initialMetrics = computeCinematicSlideMetrics(idx);
      rootGroup.position.set(idx * 1.45, -idx * 0.18, initialMetrics.zMeters);
      rootGroup.rotation.y = -idx * 0.24;

      stageGroup.add(rootGroup);
      slideBundles.push({
        rootGroup,
        backplateLayer,
        bevelLayer,
        photoLayer,
        foregroundFrameLayer,
        materials: [backplateMat, bevelMat, brassTrimMat, photoMat],
      });
    });

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          camera.aspect = width / height;
          camera.updateProjectionMatrix();
          renderer.setSize(width, height, false);
          if (requestRenderRef.current) requestRenderRef.current();
        }
      }
    });
    resizeObserver.observe(container);

    let isVisible = true;
    const intersectionObserver = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        isVisible = Boolean(entry && entry.isIntersecting);
        if (isVisible && requestRenderRef.current) {
          requestRenderRef.current();
        }
      },
      { threshold: 0.05 }
    );
    intersectionObserver.observe(container);

    let rafId = 0;
    let disposed = false;
    let lastTime = performance.now();

    const afterDraw = (cb: () => void) => {
      if (!isSoftwareGl || typeof (gl as WebGL2RenderingContext).fenceSync !== 'function') {
        cb();
        return;
      }
      const gl2 = gl as WebGL2RenderingContext;
      const sync = gl2.fenceSync(gl2.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl2.flush();
      const poll = () => {
        if (disposed || !sync) return;
        const status = gl2.clientWaitSync(sync, 0, 0);
        if (status === gl2.TIMEOUT_EXPIRED) {
          setTimeout(poll, 8);
          return;
        }
        gl2.deleteSync(sync);
        cb();
      };
      setTimeout(poll, 0);
    };

    const stepFrame = (now: number) => {
      rafId = 0;
      if (disposed || !isVisible) return;

      const dt = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;

      currentProgressRef.current = THREE.MathUtils.damp(
        currentProgressRef.current,
        targetProgressRef.current,
        6.8,
        dt
      );
      pointerCurrentRef.current.x = THREE.MathUtils.damp(
        pointerCurrentRef.current.x,
        pointerTargetRef.current.x,
        5.8,
        dt
      );
      pointerCurrentRef.current.y = THREE.MathUtils.damp(
        pointerCurrentRef.current.y,
        pointerTargetRef.current.y,
        5.8,
        dt
      );

      const continuousIndex = currentProgressRef.current * Math.max(1, panels.length - 1);
      setContinuousSlideIndex(Number(continuousIndex.toFixed(2)));

      // Subtle camera Z-axis breathing as user transitions between pinned slides
      const transitionWave = Math.sin(continuousIndex * Math.PI);
      camera.position.z = 6.2 - transitionWave * 0.28;

      slideBundles.forEach((bundle, idx) => {
        const offset = idx - continuousIndex;
        const absOffset = Math.abs(offset);
        const { zMeters, opacity } = computeCinematicSlideMetrics(offset);

        // 1. Primary Z-axis dolly movement + X/Y perspective trajectory
        bundle.rootGroup.position.z = zMeters;
        bundle.rootGroup.position.x =
          offset >= 0
            ? offset * 1.38 + pointerCurrentRef.current.x * 0.24
            : offset * 1.95 + pointerCurrentRef.current.x * 0.24;
        bundle.rootGroup.position.y =
          -absOffset * 0.18 +
          Math.sin(offset * 1.15) * 0.06 +
          pointerCurrentRef.current.y * 0.16;

        // 2. 3D rotation choreography
        bundle.rootGroup.rotation.y =
          THREE.MathUtils.clamp(-offset * 0.38, -0.68, 0.68) +
          pointerCurrentRef.current.x * 0.16;
        bundle.rootGroup.rotation.x = pointerCurrentRef.current.y * -0.11 + offset * 0.04;
        bundle.rootGroup.rotation.z = -offset * 0.03;

        // 3. Multi-plane internal Z-axis layer separation (expands dynamically during transitions)
        const depthExpansion = 1 + Math.min(0.85, absOffset * 0.55);
        bundle.backplateLayer.position.z = -0.14 * depthExpansion;
        bundle.backplateLayer.position.x = -pointerCurrentRef.current.x * 0.07;
        bundle.backplateLayer.position.y = -pointerCurrentRef.current.y * 0.05;

        bundle.bevelLayer.position.z = -0.02 * depthExpansion;

        bundle.photoLayer.position.z = 0.08 * depthExpansion;
        bundle.photoLayer.position.x = pointerCurrentRef.current.x * 0.05;
        bundle.photoLayer.position.y = pointerCurrentRef.current.y * 0.04;

        bundle.foregroundFrameLayer.position.z = 0.2 * depthExpansion;
        bundle.foregroundFrameLayer.position.x = pointerCurrentRef.current.x * 0.12 - offset * 0.08;
        bundle.foregroundFrameLayer.position.y = pointerCurrentRef.current.y * 0.09;

        // 4. Controlled opacity across all layers of the slide
        bundle.rootGroup.visible = opacity > 0.015;
        bundle.materials.forEach((mat) => {
          mat.opacity = opacity;
          mat.depthWrite = opacity > 0.25;
        });

        const scale = THREE.MathUtils.lerp(1.04, 0.84, Math.min(1, absOffset * 0.65));
        bundle.rootGroup.scale.setScalar(scale);
      });

      orbitalRing.rotation.z = continuousIndex * 0.52;
      innerRing.rotation.z = -continuousIndex * 0.74;

      stageGroup.rotation.y = pointerCurrentRef.current.x * 0.08;
      stageGroup.rotation.x = -pointerCurrentRef.current.y * 0.05;

      renderer.render(scene, camera);

      const stillMoving =
        Math.abs(currentProgressRef.current - targetProgressRef.current) > 0.001 ||
        Math.abs(pointerCurrentRef.current.x - pointerTargetRef.current.x) > 0.001 ||
        Math.abs(pointerCurrentRef.current.y - pointerTargetRef.current.y) > 0.001;

      if (stillMoving) {
        afterDraw(() => {
          if (!disposed && !rafId) {
            lastTime = performance.now();
            rafId = requestAnimationFrame(stepFrame);
          }
        });
      }
    };

    const requestRender = () => {
      if (disposed || !isVisible || rafId) return;
      lastTime = performance.now();
      rafId = requestAnimationFrame(stepFrame);
    };

    requestRenderRef.current = requestRender;
    requestRender();

    return () => {
      disposed = true;
      requestRenderRef.current = null;
      if (rafId) cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      disposables.forEach((d) => d.dispose());
      renderer.dispose();
    };
  }, [panels, isMotionPaused]);

  // 3. Pinned Scroll Runway Progression (Paused when prefers-reduced-motion or manual pause is active)
  useEffect(() => {
    if (isMotionPaused) {
      return;
    }

    const handleScroll = () => {
      const el = sectionRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const viewH = window.innerHeight || 800;

      // Calculate pinned scroll progress when section is taller than viewport
      const pinnedRunwayDistance = rect.height - viewH;
      let progress = 0;

      if (pinnedRunwayDistance > 80) {
        // True pinned scroll runway calculation
        progress = Math.max(0, Math.min(1, -rect.top / pinnedRunwayDistance));
      } else {
        // Fallback for compact mobile viewports where section isn't sticky-pinned
        const totalTravel = rect.height + viewH * 0.35;
        const currentTravel = viewH * 0.75 - rect.top;
        progress = Math.max(0, Math.min(1, currentTravel / Math.max(1, totalTravel)));
      }

      setScrollProgress(progress);
      targetProgressRef.current = progress;

      const nextIdx = Math.min(
        panels.length - 1,
        Math.max(0, Math.round(progress * (panels.length - 1)))
      );
      setActiveIndex(nextIdx);

      if (requestRenderRef.current) {
        requestRenderRef.current();
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, [panels.length, isMotionPaused]);

  const handleSelectChapter = useCallback(
    (idx: number) => {
      const clampedIdx = Math.max(0, Math.min(panels.length - 1, idx));
      setActiveIndex(clampedIdx);
      const prog = panels.length > 1 ? clampedIdx / (panels.length - 1) : 0;
      setScrollProgress(prog);
      setContinuousSlideIndex(clampedIdx);
      targetProgressRef.current = prog;

      if (isMotionPaused) {
        currentProgressRef.current = prog;
      } else if (requestRenderRef.current) {
        requestRenderRef.current();
      }
    },
    [panels.length, isMotionPaused]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      handleSelectChapter((activeIndex + 1) % Math.max(1, panels.length));
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      handleSelectChapter((activeIndex - 1 + panels.length) % Math.max(1, panels.length));
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isMotionPaused) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const nx = ((e.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1;
    const ny = ((e.clientY - rect.top) / Math.max(1, rect.height)) * 2 - 1;
    pointerTargetRef.current = { x: nx, y: ny };
    if (requestRenderRef.current) {
      requestRenderRef.current();
    }
  };

  const handlePointerLeave = () => {
    pointerTargetRef.current = { x: 0, y: 0 };
    if (!isMotionPaused && requestRenderRef.current) {
      requestRenderRef.current();
    }
  };

  const activePanel = panels[activeIndex] || panels[0];
  const activeMetrics = computeCinematicSlideMetrics(activeIndex - continuousSlideIndex);

  return (
    <section
      ref={sectionRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      aria-label="Pinned 3D Photographic Culinary Showcase"
      data-reduced-motion={isMotionPaused ? 'true' : 'false'}
      className={`relative bg-[#1E1412] text-[#FFF8F1] border-y border-[#3B2824] focus:outline-none ${
        isMotionPaused ? 'py-16 lg:py-24' : 'py-16 lg:py-0 lg:min-h-[255vh]'
      }`}
    >
      {/* Sticky Pinned Viewport Container (automatically unpins when prefers-reduced-motion is active) */}
      <div
        className={`relative w-full overflow-hidden ${
          isMotionPaused
            ? ''
            : 'lg:sticky lg:top-20 lg:min-h-[calc(100vh-5rem)] lg:flex lg:flex-col lg:justify-center lg:py-10'
        }`}
      >
        {/* Subtle radial studio warmth */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-35"
          style={{
            background:
              'radial-gradient(circle at 65% 45%, rgba(217, 164, 91, 0.22), transparent 60%), radial-gradient(circle at 20% 80%, rgba(185, 78, 98, 0.18), transparent 55%)',
          }}
        />

        <div className="relative max-w-[1440px] w-auto mx-auto px-4 sm:px-8">
          {/* Top Section Header + Accessibility Motion Control */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8 lg:mb-10">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-[#E5B867] font-semibold mb-2 flex items-center gap-2">
                <Layers className="w-3.5 h-3.5" />
                <span>
                  {isMotionPaused
                    ? 'Static Accessible Photographic Mode · 3D Motion Paused'
                    : 'Pinned 3D Photographic Stage · Layered Depth & Z-Axis Transitions'}
                </span>
              </p>
              <h2 className="font-serif text-3xl sm:text-5xl font-bold tracking-tight text-[#FFF8F1]">
                Crafted in Layers of Flavour &amp; Texture.
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Slide Stepper Controls */}
              <div
                className="inline-flex items-center rounded-xl border border-[#49332E] bg-[#281B18]/90 p-1"
                role="group"
                aria-label="Pinned Slide Navigation"
              >
                <button
                  type="button"
                  onClick={() =>
                    handleSelectChapter((activeIndex - 1 + panels.length) % Math.max(1, panels.length))
                  }
                  aria-label="Previous Pinned Slide"
                  className="p-2 rounded-lg text-[#DECBC0] hover:text-[#FFF8F1] hover:bg-[#3B2824] transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-3 text-xs font-mono-num font-semibold text-[#E5B867] whitespace-nowrap">
                  Slide {activeIndex + 1} / {panels.length}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    handleSelectChapter((activeIndex + 1) % Math.max(1, panels.length))
                  }
                  aria-label="Next Pinned Slide"
                  className="p-2 rounded-lg text-[#DECBC0] hover:text-[#FFF8F1] hover:bg-[#3B2824] transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* Explicit Accessibility Motion Pause / Resume Control */}
              <button
                type="button"
                aria-pressed={isMotionPaused}
                onClick={() => setManualMotionPaused((prev) => !prev)}
                className="px-3.5 py-2.5 rounded-xl border border-[#49332E] bg-[#281B18]/90 hover:border-[#E5B867] text-xs font-semibold text-[#FFF8F1] inline-flex items-center gap-2 transition-colors whitespace-nowrap"
              >
                {isMotionPaused ? (
                  <>
                    <Play className="w-3.5 h-3.5 text-[#E5B867]" />
                    <span>
                      {prefersReducedMotion
                        ? 'Reduced Motion Active (OS)'
                        : 'Resume 3D Transitions'}
                    </span>
                  </>
                ) : (
                  <>
                    <Pause className="w-3.5 h-3.5 text-[#E5B867]" />
                    <span>Pause 3D Motion</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Main 12-Column Interactive Pinned 3D Stage + Narrative Panel */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
            {/* Left 5 Columns: Synchronized Pinned Slide Selector & Active Narrative Card */}
            <div className="lg:col-span-5 space-y-5 order-2 lg:order-1">
              {/* Chapter Progress Tabs */}
              <div
                className="grid grid-cols-2 gap-2.5"
                role="tablist"
                aria-label="Culinary Showcase Chapters"
              >
                {panels.map((item, idx) => {
                  const isSelected = idx === activeIndex;
                  const itemOffset = idx - continuousSlideIndex;
                  const itemMetrics = computeCinematicSlideMetrics(itemOffset);

                  return (
                    <button
                      key={item.id}
                      type="button"
                      role="tab"
                      aria-selected={isSelected}
                      onClick={() => handleSelectChapter(idx)}
                      className={`text-left p-3 rounded-2xl border transition-colors ${
                        isSelected
                          ? 'bg-[#3B2824] border-[#E5B867] text-[#FFF8F1] shadow-md'
                          : 'bg-[#281B18]/70 border-[#3B2824] text-[#C6B1A3] hover:border-[#B94E62]/60'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[10px] font-mono-num uppercase tracking-widest text-[#E5B867] truncate">
                          {item.chapter}
                        </p>
                        <span className="text-[10px] font-mono-num text-[#C6B1A3]">
                          {isMotionPaused
                            ? isSelected
                              ? '100%'
                              : 'Static'
                            : `${Math.round(itemMetrics.opacity * 100)}%`}
                        </span>
                      </div>
                      <p className="font-serif text-xs sm:text-sm font-bold mt-1 line-clamp-1">
                        {item.title}
                      </p>
                    </button>
                  );
                })}
              </div>

              {/* Active Pinned Slide Narrative Card with Controlled Opacity & Z-Depth Readout */}
              <div
                className="p-6 sm:p-7 rounded-3xl bg-[#281B18]/90 border border-[#49332E] space-y-4 shadow-xl"
                style={
                  isMotionPaused
                    ? { opacity: 1, transform: 'none', transition: 'none' }
                    : {
                        opacity: Math.max(0.78, activeMetrics.opacity),
                        transform: `translate3d(0px, 0px, 0px)`,
                        transition: 'opacity 180ms cubic-bezier(0.16, 1, 0.3, 1)',
                      }
                }
              >
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#E5B867] font-mono-num">
                  <span>{activePanel.chapter}</span>
                  <span>{activePanel.metaTag}</span>
                </div>

                <div className="space-y-1.5">
                  <h3 className="font-serif text-2xl sm:text-3xl font-bold text-[#FFF8F1] leading-snug">
                    {activePanel.title}
                  </h3>
                  <p className="text-xs sm:text-sm font-semibold text-[#E5B867]">
                    {activePanel.subtitle}
                  </p>
                </div>

                <p className="text-sm text-[#DECBC0] leading-relaxed">
                  {activePanel.description}
                </p>

                {/* Layered Depth Specification Strip */}
                <div className="pt-2 border-t border-[#3B2824] flex flex-wrap items-center justify-between gap-2 text-xs text-[#C6B1A3]">
                  <span>
                    {activePanel.depthBadgeLabel || 'Multi-Plane Photographic Composition'}
                  </span>
                  <span className="text-[#E5B867] font-mono-num">
                    {activePanel.depthMetric || 'Focal Z-Plane Locked'}
                  </span>
                </div>

                <div className="pt-2 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => onNavigate(activePanel.ctaPath)}
                    className="px-6 py-3 rounded-xl bg-[#B94E62] hover:bg-[#A13E51] text-white text-xs sm:text-sm font-semibold flex items-center gap-2 transition-colors whitespace-nowrap"
                  >
                    <span>{activePanel.ctaLabel}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      handleSelectChapter((activeIndex + 1) % Math.max(1, panels.length))
                    }
                    className="px-4 py-3 rounded-xl border border-[#49332E] hover:border-[#E5B867] text-xs font-semibold text-[#FFF8F1] transition-colors whitespace-nowrap"
                  >
                    Next Pinned Slide &rarr;
                  </button>
                </div>
              </div>
            </div>

            {/* Right 7 Columns: Pinned 3D Photographic Stage (Three.js + Layered 3D DOM/CSS Composite) */}
            <div
              onPointerMove={handlePointerMove}
              onPointerLeave={handlePointerLeave}
              className="lg:col-span-7 order-1 lg:order-2 relative rounded-3xl border border-[#49332E] bg-gradient-to-b from-[#2B1D1A] to-[#170F0D] overflow-hidden shadow-2xl"
            >
              {/* WebGL 3D Canvas Layer (active only when motion is enabled and WebGL is available) */}
              {!isMotionPaused && !webglUnavailable && (
                <div
                  ref={canvasMountRef}
                  aria-hidden="true"
                  className="w-full h-[380px] sm:h-[460px] lg:h-[500px] cursor-grab active:cursor-grabbing"
                />
              )}

              {/* Layered 3D Photographic Slides Overlay & Reduced-Motion Accessible Stage */}
              <div
                className={`${
                  !isMotionPaused && !webglUnavailable
                    ? 'pointer-events-none absolute inset-x-0 top-0 h-[380px] sm:h-[460px] lg:h-[500px]'
                    : 'w-full h-[380px] sm:h-[460px] lg:h-[500px]'
                } flex items-center justify-center p-6 relative overflow-hidden`}
                style={
                  isMotionPaused
                    ? { perspective: 'none' }
                    : { perspective: '1400px', transformStyle: 'preserve-3d' }
                }
              >
                {panels.map((panel, idx) => {
                  const isCurrent = idx === activeIndex;
                  const slideOffset = isMotionPaused ? idx - activeIndex : idx - continuousSlideIndex;
                  const absOffset = Math.abs(slideOffset);
                  const { zPixels, opacity } = computeCinematicSlideMetrics(slideOffset);

                  // When prefers-reduced-motion or manual pause is active, pause all 3D movement and show only active slide at 100% opacity
                  if (isMotionPaused) {
                    if (!isCurrent) return null;
                    return (
                      <div
                        key={panel.id}
                        data-slide-id={panel.id}
                        data-motion-state="paused"
                        className="w-full max-w-xl rounded-2xl overflow-hidden border-2 border-[#E5B867]/70 bg-[#281B18] shadow-2xl"
                        style={{
                          transform: 'none',
                          opacity: 1,
                          transition: 'none',
                        }}
                      >
                        <div className="relative">
                          <img
                            src={panel.imageUrl}
                            alt={panel.title}
                            referrerPolicy="no-referrer"
                            className="w-full h-64 sm:h-80 object-cover"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
                          <div className="absolute bottom-3 left-4 right-4 flex flex-wrap items-end justify-between gap-2 text-[#FFF8F1]">
                            <div>
                              <p className="text-[11px] font-mono-num uppercase tracking-wider text-[#E5B867]">
                                {panel.chapter}
                              </p>
                              <p className="font-serif text-lg font-bold">{panel.title}</p>
                            </div>
                            <span className="text-xs font-mono-num text-[#DECBC0]">
                              {panel.depthMetric}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  // When WebGL is running, render the synchronized multi-layer 3D foreground HUD plane;
                  // When WebGL is unavailable, render the full CSS 3D multi-plane photographic monolith stack.
                  const translateX = Math.round(slideOffset * 68);
                  const translateY = Math.round(absOffset * 16);
                  const rotateY = Number((-slideOffset * 14).toFixed(2));
                  const rotateX = Number((slideOffset * 2.5).toFixed(2));

                  if (!webglUnavailable) {
                    // Synchronized Foreground 3D Parallax Callout Plane over WebGL Stage
                    return (
                      <div
                        key={panel.id}
                        data-slide-id={panel.id}
                        data-z-depth={zPixels}
                        data-slide-opacity={opacity}
                        className="absolute inset-x-6 bottom-5 flex items-end justify-between pointer-events-none"
                        style={{
                          transform: `translate3d(${Math.round(slideOffset * 44)}px, ${Math.round(
                            absOffset * 10
                          )}px, ${Math.round(zPixels * 0.45)}px)`,
                          opacity: isCurrent ? opacity : 0,
                          transition:
                            'transform 220ms cubic-bezier(0.16, 1, 0.3, 1), opacity 220ms cubic-bezier(0.16, 1, 0.3, 1)',
                        }}
                      >
                        {/* Foreground Layer +Z Floating Detail Card */}
                        <div className="bg-[#1E1412]/90 backdrop-blur-md border border-[#E5B867]/50 rounded-2xl p-3 shadow-2xl flex items-center gap-3 max-w-sm">
                          {panel.detailLayerImageUrl && (
                            <img
                              src={panel.detailLayerImageUrl}
                              alt={`${panel.title} detail layer`}
                              referrerPolicy="no-referrer"
                              className="w-12 h-12 rounded-xl object-cover border border-[#49332E] shrink-0"
                            />
                          )}
                          <div>
                            <p className="text-[10px] font-mono-num uppercase tracking-wider text-[#E5B867] flex items-center gap-1">
                              <Sparkles className="w-3 h-3" />
                              <span>{panel.depthBadgeLabel || 'Foreground Z-Plane (+64px)'}</span>
                            </p>
                            <p className="font-serif text-xs sm:text-sm font-bold text-[#FFF8F1] line-clamp-1">
                              {panel.title}
                            </p>
                            <p className="text-[11px] font-mono-num text-[#C6B1A3]">
                              {panel.depthMetric || 'Layered 3D Photographic Plane'}
                            </p>
                          </div>
                        </div>

                        {/* Live Z-Axis & Opacity Telemetry Readout */}
                        <div className="hidden sm:flex flex-col items-end bg-[#1E1412]/85 backdrop-blur-md border border-[#49332E] rounded-xl px-3 py-2 text-[11px] font-mono-num text-[#DECBC0]">
                          <span className="text-[#E5B867]">
                            Z-Axis Depth: {zPixels >= 0 ? `+${zPixels}px` : `${zPixels}px`}
                          </span>
                          <span>Controlled Opacity: {Math.round(opacity * 100)}%</span>
                        </div>
                      </div>
                    );
                  }

                  // Full Multi-Layer CSS 3D Photographic Stack (when WebGL is unavailable and motion is permitted)
                  return (
                    <div
                      key={panel.id}
                      data-slide-id={panel.id}
                      data-z-depth={zPixels}
                      data-slide-opacity={opacity}
                      onClick={() => handleSelectChapter(idx)}
                      className="pointer-events-auto absolute w-[82%] sm:w-[74%] max-w-lg rounded-2xl cursor-pointer"
                      style={{
                        transformStyle: 'preserve-3d',
                        transform: `translate3d(${translateX}px, ${translateY}px, ${zPixels}px) rotateY(${rotateY}deg) rotateX(${rotateX}deg)`,
                        opacity,
                        zIndex: panels.length * 10 - Math.round(absOffset * 10),
                        transition:
                          'transform 260ms cubic-bezier(0.16, 1, 0.3, 1), opacity 260ms cubic-bezier(0.16, 1, 0.3, 1)',
                      }}
                    >
                      {/* Layer 1: Deep Shadow Backplate (translateZ -48px) */}
                      <div
                        aria-hidden="true"
                        className="absolute -inset-3 rounded-3xl bg-[#140C0A]/90 border border-[#3B2824] shadow-2xl"
                        style={{ transform: 'translateZ(-48px)' }}
                      />

                      {/* Layer 2: Mid-Plane High-Res Photograph (translateZ 0px) */}
                      <div
                        className="relative rounded-2xl overflow-hidden border-2 border-[#E5B867]/65 bg-[#281B18] shadow-2xl"
                        style={{ transform: 'translateZ(0px)' }}
                      >
                        <img
                          src={panel.imageUrl}
                          alt={panel.title}
                          referrerPolicy="no-referrer"
                          className="w-full h-60 sm:h-76 object-cover"
                        />
                        <div className="p-3.5 bg-[#1E1412]/95 border-t border-[#49332E] flex items-center justify-between">
                          <span className="font-serif text-sm font-bold text-[#FFF8F1]">
                            {panel.title}
                          </span>
                          <span className="text-[11px] font-mono-num text-[#E5B867]">
                            Z: {zPixels >= 0 ? `+${zPixels}px` : `${zPixels}px`} ·{' '}
                            {Math.round(opacity * 100)}%
                          </span>
                        </div>
                      </div>

                      {/* Layer 3: Foreground Floating Detail Plane (translateZ +42px) */}
                      {isCurrent && (
                        <div
                          className="hidden sm:flex items-center gap-2.5 absolute -bottom-4 -left-4 bg-[#281B18]/95 border border-[#E5B867] rounded-xl px-3 py-2 shadow-xl"
                          style={{ transform: 'translateZ(42px)' }}
                        >
                          <span className="text-[11px] font-mono-num font-semibold text-[#E5B867]">
                            {panel.depthBadgeLabel}
                          </span>
                          <span className="text-[11px] text-[#DECBC0]">· {panel.depthMetric}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Bottom Stage Progress & Accessibility Status Bar */}
              <div className="px-5 py-3 bg-[#170F0D]/95 border-t border-[#3B2824] flex flex-wrap items-center justify-between gap-3 text-xs text-[#C6B1A3]">
                <div className="flex items-center gap-2">
                  <Eye className="w-3.5 h-3.5 text-[#E5B867]" />
                  <span>
                    {isMotionPaused
                      ? 'Reduced-motion accessibility active: Z-axis & parallax transitions paused'
                      : 'Scroll pinned runway or move pointer for 3D Z-axis & layered depth transitions'}
                  </span>
                </div>
                <div className="flex items-center gap-2 font-mono-num">
                  <span>
                    Z-Plane:{' '}
                    {isMotionPaused
                      ? '0px (Locked)'
                      : `${activeMetrics.zPixels >= 0 ? '+' : ''}${activeMetrics.zPixels}px`}
                  </span>
                  <span>·</span>
                  <span>
                    Opacity:{' '}
                    {isMotionPaused ? '100%' : `${Math.round(activeMetrics.opacity * 100)}%`}
                  </span>
                  <span>·</span>
                  <span className="text-[#E5B867]">
                    Pinned Slide {activeIndex + 1} of {panels.length}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Scroll3DShowcase;
