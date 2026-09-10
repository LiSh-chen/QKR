import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import rough from 'roughjs';

interface RoughWheelProps {
  labels: string[];
  colors: string[];
  targetIndex: number;
  spinKey: number;
  onSpinEnd?: () => void;
  size?: number;
}

export const RoughWheel: React.FC<RoughWheelProps> = ({ labels, colors, targetIndex, spinKey, onSpinEnd, size = 180 }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [rotation, setRotation] = useState(0);
  const segAngle = 360 / labels.length;

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    svg.innerHTML = '';
    const rc = rough.svg(svg);
    const cx = size / 2;
    const cy = size / 2;
    const r = size * 0.46;

    labels.forEach((_, i) => {
      const a0 = (-90 + i * segAngle) * (Math.PI / 180);
      const a1 = (-90 + (i + 1) * segAngle) * (Math.PI / 180);
      const x1 = cx + r * Math.cos(a0);
      const y1 = cy + r * Math.sin(a0);
      const x2 = cx + r * Math.cos(a1);
      const y2 = cy + r * Math.sin(a1);
      const d = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2} Z`;
      const node = rc.path(d, {
        stroke: '#3a2e18',
        strokeWidth: 1.6,
        roughness: 1.7,
        fill: colors[i % colors.length],
        fillStyle: 'hachure',
        hachureGap: 3,
        hachureAngle: i % 2 === 0 ? 45 : -45,
        seed: i * 71 + 5,
      });
      svg.appendChild(node);
    });

    const rim = rc.circle(cx, cy, r * 2, { stroke: '#3a2e18', strokeWidth: 2.2, roughness: 1.6, seed: 99 });
    svg.appendChild(rim);

    labels.forEach((label, i) => {
      const mid = (-90 + (i + 0.5) * segAngle) * (Math.PI / 180);
      const lx = cx + r * 0.62 * Math.cos(mid);
      const ly = cy + r * 0.62 * Math.sin(mid);
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', String(lx));
      text.setAttribute('y', String(ly));
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('dominant-baseline', 'middle');
      text.setAttribute('font-family', 'Kalam');
      text.setAttribute('font-weight', '700');
      text.setAttribute('font-size', String(size * 0.06));
      text.setAttribute('fill', '#fff');
      text.setAttribute('transform', `rotate(${(-90 + (i + 0.5) * segAngle) + 90}, ${lx}, ${ly})`);
      text.textContent = label;
      svg.appendChild(text);
    });
  }, [labels, colors, size, segAngle]);

  useEffect(() => {
    if (spinKey === 0) return;
    const targetMidAngle = targetIndex * segAngle + segAngle / 2;
    const extraSpins = 4 + Math.floor(Math.random() * 2);
    const finalRotation = extraSpins * 360 + (360 - targetMidAngle);
    setRotation((prev) => prev - (prev % 360) + finalRotation);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spinKey]);

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <div
        className="absolute left-1/2 z-10"
        style={{ top: -6, transform: 'translateX(-50%)', filter: 'drop-shadow(1px 2px 2px rgba(0,0,0,0.4))' }}
      >
        <svg width="20" height="24" viewBox="0 0 20 24">
          <path d="M10 24 L0 4 Q10 -4 20 4 Z" fill="#c0392b" stroke="#3a2e18" strokeWidth="1.5" />
        </svg>
      </div>
      <motion.div
        animate={{ rotate: rotation }}
        transition={{ duration: 2.2, ease: [0.17, 0.67, 0.3, 1] }}
        onAnimationComplete={() => spinKey > 0 && onSpinEnd?.()}
        style={{ width: size, height: size, filter: 'drop-shadow(1px 3px 6px rgba(0,0,0,0.35))' }}
      >
        <svg ref={svgRef} viewBox={`0 0 ${size} ${size}`} width={size} height={size} />
      </motion.div>
    </div>
  );
};
