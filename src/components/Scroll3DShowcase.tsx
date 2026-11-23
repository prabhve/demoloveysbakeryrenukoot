import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { ArrowRight, Layers, Eye } from 'lucide-react';

export interface ShowcasePanelData {
  id: string;
  chapter: string;
  title: string;
  subtitle: string;
  description: string;
  imageUrl: string;
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
    ctaLabel: 'Browse Bakery Menu',
    ctaPath: '/menu',
    metaTag: 'Fresh Morning Batches · Gift Boxes',
  },
];

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
  const [useCssFallback, setUseCssFallback] = useState(false);

  // Refs shared with Three.js render loop
  const targetProgressRef = useRef(0);
  const currentProgressRef = useRef(0);
  const pointerTargetRef = useRef({ x: 0, y: 0 });
  const pointerCurrentRef = useRef({ x: 0, y: 0 });
  const requestRenderRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reducedMotion) {
      setUseCssFallback(true);
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
      setUseCssFallback(true);
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

    const initialW = container.clientWidth || 640;
    const initialH = container.clientHeight || 480;
    renderer.setSize(initialW, initialH, false);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(36, initialW / initialH, 0.1, 50);
    camera.position.set(0, 0.1, 6.4);

    // Studio Environment Lighting
    const pmrem = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    const envTarget = pmrem.fromScene(roomEnv, 0.04);
    scene.environment = envTarget.texture;
    roomEnv.dispose();
    pmrem.dispose();

    const keyLight = new THREE.DirectionalLight(0xfff3e2, 2.2);
    keyLight.position.set(4.5, 6.5, 5.5);
    if (!isSoftwareGl) {
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.set(1024, 1024);
      keyLight.shadow.bias = -0.0005;
    }
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0xe5b867, 1.1);
    rimLight.position.set(-4.5, -2.5, 3.0);
    scene.add(rimLight);

    const hemiLight = new THREE.HemisphereLight(0xfff8f1, 0x2c1b18, 0.75);
    scene.add(hemiLight);

    // Root architectural exhibition stage group
    const stageGroup = new THREE.Group();
    scene.add(stageGroup);

    // Subtle floating brass ring & architectural pedestal plinth beneath the 3D photo panels
    const brassMaterial = new THREE.MeshStandardMaterial({
      color: 0xd9a45b,
      metalness: 0.78,
      roughness: 0.26,
    });
    const espressoMatteMaterial = new THREE.MeshStandardMaterial({
      color: 0x281a17,
      metalness: 0.08,
      roughness: 0.72,
    });
    const creamBevelMaterial = new THREE.MeshStandardMaterial({
      color: 0xf7ece1,
      metalness: 0.04,
      roughness: 0.85,
    });

    const orbitalRingGeo = new THREE.TorusGeometry(2.65, 0.012, 16, 96);
    const orbitalRing = new THREE.Mesh(orbitalRingGeo, brassMaterial);
    orbitalRing.rotation.x = Math.PI * 0.44;
    orbitalRing.position.set(0, -1.35, -0.5);
    stageGroup.add(orbitalRing);

    const innerRingGeo = new THREE.TorusGeometry(1.9, 0.008, 12, 72);
    const innerRing = new THREE.Mesh(innerRingGeo, brassMaterial);
    innerRing.rotation.x = Math.PI * 0.44;
    innerRing.position.set(0, -1.35, -0.5);
    stageGroup.add(innerRing);

    // Create layered 3D Photographic Monolith Panels using authentic Lovey's photographs
    const textureLoader = new THREE.TextureLoader();
    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    const disposables: Array<{ dispose: () => void }> = [
      orbitalRingGeo,
      innerRingGeo,
      brassMaterial,
      espressoMatteMaterial,
      creamBevelMaterial,
      envTarget,
    ];

    const panelGroups: THREE.Group[] = [];

    const frameOuterGeo = new THREE.BoxGeometry(2.96, 2.22, 0.09);
    const passepartoutGeo = new THREE.BoxGeometry(2.82, 2.08, 0.11);
    const photoPlaneGeo = new THREE.PlaneGeometry(2.64, 1.9);
    const accentCornerGeo = new THREE.BoxGeometry(0.32, 0.03, 0.13);

    disposables.push(frameOuterGeo, passepartoutGeo, photoPlaneGeo, accentCornerGeo);

    panels.forEach((panel, idx) => {
      const cardGroup = new THREE.Group();

      // 1. Espresso architectural backing monolith
      const backingMesh = new THREE.Mesh(frameOuterGeo, espressoMatteMaterial);
      if (!isSoftwareGl) {
        backingMesh.castShadow = true;
        backingMesh.receiveShadow = true;
      }
      cardGroup.add(backingMesh);

      // 2. Warm cream museum passepartout bevel layer
      const bevelMesh = new THREE.Mesh(passepartoutGeo, creamBevelMaterial);
      cardGroup.add(bevelMesh);

      // 3. Brushed gold trim bars top & bottom
      const topTrim = new THREE.Mesh(accentCornerGeo, brassMaterial);
      topTrim.position.set(-1.15, 1.07, 0.01);
      cardGroup.add(topTrim);

      const bottomTrim = new THREE.Mesh(accentCornerGeo, brassMaterial);
      bottomTrim.position.set(1.15, -1.07, 0.01);
      cardGroup.add(bottomTrim);

      // 4. Authentic Lovey's Photograph textured plane (front and subtle back)
      const photoMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.32,
        metalness: 0.04,
      });
      disposables.push(photoMat);

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

      const photoMesh = new THREE.Mesh(photoPlaneGeo, photoMat);
      photoMesh.position.z = 0.062;
      cardGroup.add(photoMesh);

      // Initial spatial placement
      cardGroup.position.set(idx * 2.1, -idx * 0.25, -idx * 1.4);
      cardGroup.rotation.y = -idx * 0.22;

      stageGroup.add(cardGroup);
      panelGroups.push(cardGroup);
    });

    // ResizeObserver for responsive container sizing
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          const aspect = width / height;
          camera.aspect = aspect;
          // On narrow mobile/portrait viewports (aspect < 1.15), pull camera slightly back
          // so the 3D framed photographic monolith fits cleanly without side clipping.
          // Desktop (aspect >= 1.15) remains at the exact 6.4 baseline distance.
          camera.position.z =
            aspect < 1.15
              ? THREE.MathUtils.clamp(6.4 / Math.max(0.64, aspect * 0.88), 6.4, 9.1)
              : 6.4;
          camera.updateProjectionMatrix();
          renderer.setSize(width, height, false);
          if (requestRenderRef.current) requestRenderRef.current();
        }
      }
    });
    resizeObserver.observe(container);

    // IntersectionObserver to pause rendering when offscreen
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

    // On-demand / damped animation loop with software-WebGL fence pacing
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
        6.5,
        dt
      );
      pointerCurrentRef.current.x = THREE.MathUtils.damp(
        pointerCurrentRef.current.x,
        pointerTargetRef.current.x,
        5.5,
        dt
      );
      pointerCurrentRef.current.y = THREE.MathUtils.damp(
        pointerCurrentRef.current.y,
        pointerTargetRef.current.y,
        5.5,
        dt
      );

      const continuousIndex = currentProgressRef.current * Math.max(1, panels.length - 1);

      panelGroups.forEach((group, idx) => {
        const offset = idx - continuousIndex;
        const absOffset = Math.abs(offset);

        // 3D depth gallery choreography: active photograph comes forward & centers;
        // past and upcoming photographs fan out in 3D space with perspective rotation
        group.position.x = offset * 2.25 + pointerCurrentRef.current.x * 0.22;
        group.position.y =
          -absOffset * 0.22 +
          Math.sin(offset * 1.2) * 0.08 +
          pointerCurrentRef.current.y * 0.16;
        group.position.z = -absOffset * 1.45;

        group.rotation.y =
          THREE.MathUtils.clamp(-offset * 0.42, -0.75, 0.75) +
          pointerCurrentRef.current.x * 0.18;
        group.rotation.x = pointerCurrentRef.current.y * -0.12 + offset * 0.04;
        group.rotation.z = -offset * 0.035;

        const scale = THREE.MathUtils.lerp(1.04, 0.82, Math.min(1, absOffset * 0.75));
        group.scale.setScalar(scale);
      });

      orbitalRing.rotation.z = continuousIndex * 0.45;
      innerRing.rotation.z = -continuousIndex * 0.65;

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
  }, [panels]);

  // Listen to window scroll to drive 3D depth progression through Section B
  useEffect(() => {
    const handleScroll = () => {
      const el = sectionRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const viewH = window.innerHeight || 800;

      // Progress from 0 when section enters view to 1 as user scrolls through it
      const totalTravel = rect.height + viewH * 0.35;
      const currentTravel = viewH * 0.75 - rect.top;
      const progress = Math.max(0, Math.min(1, currentTravel / Math.max(1, totalTravel)));

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
  }, [panels.length]);

  const handleSelectChapter = (idx: number) => {
    setActiveIndex(idx);
    const prog = panels.length > 1 ? idx / (panels.length - 1) : 0;
    setScrollProgress(prog);
    targetProgressRef.current = prog;
    if (requestRenderRef.current) {
      requestRenderRef.current();
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
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
    if (requestRenderRef.current) {
      requestRenderRef.current();
    }
  };

  const activePanel = panels[activeIndex] || panels[0];

  return (
    <section
      ref={sectionRef}
      aria-label="Interactive 3D Culinary Showcase"
      className="relative bg-[#1E1412] text-[#FFF8F1] py-20 lg:py-28 overflow-hidden border-y border-[#3B2824]"
    >
      {/* Subtle radial warmth */}
      <div
        className="pointer-events-none absolute inset-0 opacity-35"
        style={{
          background:
            'radial-gradient(circle at 65% 45%, rgba(217, 164, 91, 0.22), transparent 60%), radial-gradient(circle at 20% 80%, rgba(185, 78, 98, 0.18), transparent 55%)',
        }}
      />

      <div className="relative max-w-[1440px] mx-auto px-4 sm:px-8">
        {/* Top Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-[#E5B867] font-semibold mb-2 flex items-center gap-2">
              <Layers className="w-3.5 h-3.5" />
              Interactive 3D Photographic Gallery · Scroll or Select Chapter
            </p>
            <h2 className="font-serif text-3xl sm:text-5xl font-bold tracking-tight text-[#FFF8F1]">
              Crafted in Layers of Flavour &amp; Texture.
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-[#D7C4B7] max-w-md leading-relaxed">
            Scroll through our dimensional showcase featuring authentic photography from Lovey&apos;s Bakery &amp; Pizza Corners in Renukoot.
          </p>
        </div>

        {/* Main 12-Column Interactive 3D Stage + Narrative Panel */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
          {/* Left 5 Columns: Synchronized Chapter Selector & Active Story Card */}
          <div className="lg:col-span-5 space-y-6 order-2 lg:order-1">
            {/* Chapter Progress Tabs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 gap-2.5">
              {panels.map((item, idx) => {
                const isSelected = idx === activeIndex;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelectChapter(idx)}
                    className={`text-left p-3 rounded-2xl border transition-all ${
                      isSelected
                        ? 'bg-[#3B2824] border-[#E5B867] text-[#FFF8F1] shadow-md'
                        : 'bg-[#281B18]/70 border-[#3B2824] text-[#C6B1A3] hover:border-[#B94E62]/60'
                    }`}
                  >
                    <p className="text-[10px] font-mono-num uppercase tracking-widest text-[#E5B867]">
                      {item.chapter}
                    </p>
                    <p className="font-serif text-xs sm:text-sm font-bold mt-1 line-clamp-1">
                      {item.title}
                    </p>
                  </button>
                );
              })}
            </div>

            {/* Active Chapter Narrative Card */}
            <div className="p-5 sm:p-8 rounded-3xl bg-[#281B18]/90 border border-[#49332E] space-y-5 shadow-xl">
              <div className="flex flex-wrap items-center justify-between gap-1.5 text-xs text-[#E5B867] font-mono-num">
                <span>{activePanel.chapter}</span>
                <span>{activePanel.metaTag}</span>
              </div>

              <div className="space-y-2">
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

              <div className="pt-2 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => onNavigate(activePanel.ctaPath)}
                  className="px-6 py-3 rounded-xl bg-[#B94E62] hover:bg-[#A13E51] text-white text-xs sm:text-sm font-semibold flex items-center gap-2 transition-colors"
                >
                  <span>{activePanel.ctaLabel}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleSelectChapter((activeIndex + 1) % Math.max(1, panels.length))
                  }
                  className="px-4 py-3 rounded-xl border border-[#49332E] hover:border-[#E5B867] text-xs font-semibold text-[#FFF8F1] transition-colors"
                >
                  Next Layer &rarr;
                </button>
              </div>
            </div>
          </div>

          {/* Right 7 Columns: Three.js WebGL 3D Photographic Stage (with CSS 3D fallback) */}
          <div
            onPointerMove={handlePointerMove}
            onPointerLeave={handlePointerLeave}
            className="lg:col-span-7 order-1 lg:order-2 relative rounded-3xl border border-[#49332E] bg-gradient-to-b from-[#2B1D1A] to-[#170F0D] overflow-hidden shadow-2xl"
          >
            {!useCssFallback ? (
              <div
                ref={canvasMountRef}
                style={{ touchAction: 'pan-y' }}
                className="w-full h-[310px] sm:h-[460px] lg:h-[520px] cursor-grab active:cursor-grabbing"
              />
            ) : (
              /* CSS 3D Perspective Fallback for Reduced Motion / Mobile / WebGL Disabled */
              <div
                className="w-full h-[310px] sm:h-[460px] lg:h-[520px] flex items-center justify-center p-4 sm:p-6 relative"
                style={{ perspective: '1200px', touchAction: 'pan-y' }}
              >
                {panels.map((panel, idx) => {
                  const offset = idx - activeIndex;
                  const isCurrent = idx === activeIndex;
                  return (
                    <div
                      key={panel.id}
                      onClick={() => handleSelectChapter(idx)}
                      className="absolute w-[78%] sm:w-[70%] max-w-lg rounded-2xl overflow-hidden border-2 border-[#E5B867]/60 bg-[#281B18] shadow-2xl transition-all duration-500 cursor-pointer"
                      style={{
                        transform: `translate3d(${offset * 42}px, ${Math.abs(offset) * 14}px, ${
                          -Math.abs(offset) * 110
                        }px) rotateY(${-offset * 14}deg)`,
                        opacity: Math.max(0, 1 - Math.abs(offset) * 0.35),
                        zIndex: panels.length - Math.abs(offset),
                      }}
                    >
                      <img
                        src={panel.imageUrl}
                        alt={panel.title}
                        className="w-full h-64 sm:h-80 object-cover"
                      />
                      {isCurrent && (
                        <div className="p-4 bg-[#1E1412]/95 border-t border-[#49332E] flex items-center justify-between">
                          <span className="font-serif text-sm font-bold text-[#FFF8F1]">
                            {panel.title}
                          </span>
                          <span className="text-[11px] font-mono-num text-[#E5B867]">
                            {panel.chapter}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Bottom Stage HUD Bar */}
            <div className="px-5 py-3 bg-[#170F0D]/90 border-t border-[#3B2824] flex flex-wrap items-center justify-between gap-3 text-xs text-[#C6B1A3]">
              <div className="flex items-center gap-2">
                <Eye className="w-3.5 h-3.5 text-[#E5B867]" />
                <span>Move pointer or scroll to tilt 3D photographic planes</span>
              </div>
              <div className="flex items-center gap-2 font-mono-num">
                <span>Depth Progress: {Math.round(scrollProgress * 100)}%</span>
                <span>·</span>
                <span className="text-[#E5B867]">
                  Layer {activeIndex + 1} of {panels.length}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Scroll3DShowcase;
