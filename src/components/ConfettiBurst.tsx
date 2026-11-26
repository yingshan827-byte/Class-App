import { useEffect, useRef } from 'react';

interface ConfettiBurstProps {
  triggerKey: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  rotation: number;
  vRot: number;
  alpha: number;
  shape: 'rect' | 'circle';
}

const COLORS = [
  '#0284C7', // Classroom Cobalt
  '#059669', // Emerald
  '#D97706', // Warm Amber
  '#0EA5E9', // Sky Blue
  '#E11D48', // Coral Rose
  '#4F46E5', // Indigo
];

export function ConfettiBurst({ triggerKey }: ConfettiBurstProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (triggerKey <= 0) return;

    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const originX = rect.width / 2;
    const originY = rect.height * 0.48;

    const particles: Particle[] = Array.from({ length: 56 }, () => {
      const angle = Math.random() * Math.PI * 2;
      const speed = 3 + Math.random() * 7.5;
      return {
        x: originX,
        y: originY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 3.2,
        size: 5 + Math.random() * 5,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        rotation: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 0.24,
        alpha: 1,
        shape: Math.random() > 0.35 ? 'rect' : 'circle',
      };
    });

    let rafId = 0;
    const startTime = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startTime;
      ctx.clearRect(0, 0, rect.width, rect.height);

      let alive = false;
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.22; // gentle gravity
        p.vx *= 0.985;
        p.rotation += p.vRot;
        if (elapsed > 650) {
          p.alpha = Math.max(0, p.alpha - 0.025);
        }

        if (p.alpha > 0.02 && p.y < rect.height + 30) {
          alive = true;
          ctx.save();
          ctx.globalAlpha = p.alpha;
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rotation);
          ctx.fillStyle = p.color;

          if (p.shape === 'rect') {
            ctx.fillRect(-p.size / 2, -p.size / 3, p.size, p.size * 0.65);
          } else {
            ctx.beginPath();
            ctx.arc(0, 0, p.size * 0.4, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
        }
      }

      if (alive && elapsed < 2400) {
        rafId = requestAnimationFrame(animate);
      } else {
        ctx.clearRect(0, 0, rect.width, rect.height);
      }
    };

    rafId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafId);
  }, [triggerKey]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full z-10"
    />
  );
}
