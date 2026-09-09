import React, { useEffect, useRef, useState } from 'react';
import rough from 'roughjs';

interface RoughBoxProps {
  shape?: 'rectangle' | 'ellipse';
  stroke?: string;
  strokeWidth?: number;
  roughness?: number;
  fill?: string;
  fillStyle?: 'hachure' | 'solid' | 'cross-hatch' | 'zigzag';
  hachureGap?: number;
  hachureAngle?: number;
  /** Re-roll the random "hand-drawn" seed whenever this changes (e.g. on re-render) */
  seedKey?: string | number;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
  onClick?: () => void;
  id?: string;
}

/**
 * Renders a hand-drawn (pencil-sketch) rectangle or ellipse behind its children
 * using rough.js, replacing flat CSS borders/photo assets with a genuinely
 * imperfect, vector line that scales cleanly to any size.
 */
export const RoughBox: React.FC<RoughBoxProps> = ({
  shape = 'rectangle',
  stroke = '#3a2e18',
  strokeWidth = 1.8,
  roughness = 1.6,
  fill,
  fillStyle = 'hachure',
  hachureGap = 4,
  hachureAngle = 45,
  seedKey,
  className = '',
  style,
  children,
  onClick,
  id,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [seed] = useState(() => Math.floor(Math.random() * 10000));
  const [size, setSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        const { width, height } = entry.contentRect;
        setSize({ w: Math.round(width), h: Math.round(height) });
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || size.w < 4 || size.h < 4) return;
    svg.innerHTML = '';
    const rc = rough.svg(svg);
    const pad = Math.max(2, strokeWidth);

    const options = {
      stroke,
      strokeWidth,
      roughness,
      fill,
      fillStyle,
      hachureGap,
      hachureAngle,
      seed,
    };

    const node =
      shape === 'ellipse'
        ? rc.ellipse(size.w / 2, size.h / 2, size.w - pad * 2, size.h - pad * 2, options)
        : rc.rectangle(pad, pad, size.w - pad * 2, size.h - pad * 2, options);
    svg.appendChild(node);
  }, [size, stroke, strokeWidth, roughness, fill, fillStyle, hachureGap, hachureAngle, seed, shape, seedKey]);

  return (
    <div
      ref={containerRef}
      className={`relative ${className}`}
      style={style}
      onClick={onClick}
      id={id}
    >
      <svg
        ref={svgRef}
        viewBox={`0 0 ${size.w} ${size.h}`}
        className="absolute inset-0 w-full h-full pointer-events-none"
        preserveAspectRatio="none"
      />
      <div className="relative z-10 w-full h-full">{children}</div>
    </div>
  );
};
