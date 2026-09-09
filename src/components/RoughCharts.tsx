import React, { useEffect, useRef, useState } from 'react';
import rough from 'roughjs';

interface RoughDonutSlice {
  key: string;
  value: number;
  color: string;
}

interface RoughDonutProps {
  data: RoughDonutSlice[];
  size?: number;
}

/**
 * A donut chart where each wedge is a hand-drawn, colored-pencil hachure fill
 * (rough.js) instead of a flat solid Recharts sector.
 */
export const RoughDonut: React.FC<RoughDonutProps> = ({ data, size = 160 }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const total = data.reduce((s, d) => s + d.value, 0);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || total <= 0) return;
    svg.innerHTML = '';
    const rc = rough.svg(svg);

    const cx = size / 2;
    const cy = size / 2;
    const outerR = size * 0.46;
    const innerR = size * 0.29;
    let angle = -Math.PI / 2;

    data.forEach((slice, i) => {
      if (slice.value <= 0) return;
      const sweep = (slice.value / total) * 2 * Math.PI;
      const a0 = angle;
      const a1 = angle + sweep;

      // Donut-wedge polygon: outer arc out, inner arc back
      const steps = Math.max(2, Math.ceil((sweep / (Math.PI * 2)) * 60));
      let d = '';
      for (let s = 0; s <= steps; s++) {
        const a = a0 + (sweep * s) / steps;
        const x = cx + outerR * Math.cos(a);
        const y = cy + outerR * Math.sin(a);
        d += `${s === 0 ? 'M' : 'L'} ${x} ${y} `;
      }
      for (let s = steps; s >= 0; s--) {
        const a = a0 + (sweep * s) / steps;
        const x = cx + innerR * Math.cos(a);
        const y = cy + innerR * Math.sin(a);
        d += `L ${x} ${y} `;
      }
      d += 'Z';

      const node = rc.path(d, {
        stroke: '#3a2e18',
        strokeWidth: 1.4,
        roughness: 1.7,
        fill: slice.color,
        fillStyle: 'hachure',
        hachureGap: 3.2,
        hachureAngle: i % 2 === 0 ? 45 : -45,
        seed: i * 137 + 7,
      });
      svg.appendChild(node);
      angle = a1;
    });
  }, [data, total, size]);

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${size} ${size}`}
      className="w-full h-full"
      preserveAspectRatio="xMidYMid meet"
    />
  );
};

interface RoughStackedBarDatum {
  label: string;
  segments: { key: string; value: number; color: string }[];
}

interface RoughStackedBarChartProps {
  data: RoughStackedBarDatum[];
  height?: number;
}

/**
 * A stacked bar chart where every segment is a hand-drawn hachure-filled
 * rectangle (rough.js) instead of a flat Recharts <Bar>.
 */
export const RoughStackedBarChart: React.FC<RoughStackedBarChartProps> = ({ data, height = 130 }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [width, setWidth] = useState(300);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setWidth(Math.round(w));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const maxTotal = Math.max(1, ...data.map((d) => d.segments.reduce((s, seg) => s + seg.value, 0)));

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || width < 20) return;
    svg.innerHTML = '';
    const rc = rough.svg(svg);

    const padLeft = 4;
    const padBottom = 16;
    const chartH = height - padBottom;
    const barGap = 6;
    const barW = (width - padLeft * 2 - barGap * (data.length - 1)) / data.length;

    data.forEach((month, i) => {
      const x = padLeft + i * (barW + barGap);
      let yCursor = chartH;

      month.segments.forEach((seg, si) => {
        if (seg.value <= 0) return;
        const segH = (seg.value / maxTotal) * chartH;
        const y = yCursor - segH;
        const node = rc.rectangle(x, y, barW, segH, {
          stroke: '#3a2e18',
          strokeWidth: 1,
          roughness: 1.5,
          fill: seg.color,
          fillStyle: 'hachure',
          hachureGap: 2.6,
          hachureAngle: si % 2 === 0 ? 45 : -45,
          seed: i * 31 + si * 11 + 3,
        });
        svg.appendChild(node);
        yCursor -= segH;
      });

      // month label
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', String(x + barW / 2));
      text.setAttribute('y', String(height - 2));
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('font-size', '9');
      text.setAttribute('font-family', 'Kalam');
      text.setAttribute('fill', '#78716c');
      text.textContent = month.label;
      svg.appendChild(text);
    });
  }, [data, width, height, maxTotal]);

  return (
    <div ref={containerRef} className="w-full" style={{ height }}>
      <svg ref={svgRef} viewBox={`0 0 ${width} ${height}`} className="w-full h-full" />
    </div>
  );
};
