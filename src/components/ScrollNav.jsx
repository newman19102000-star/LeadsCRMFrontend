import { useRef, useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

// Horizontally scrollable row that shows a fade + arrow on whichever side has hidden content.
export default function ScrollNav({ children, className = '' }) {
  const ref = useRef(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setEdges({
      left: el.scrollLeft > 4,
      right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4,
    });
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    update();
    el.addEventListener('scroll', update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    Array.from(el.children).forEach((c) => ro.observe(c));
    return () => {
      el.removeEventListener('scroll', update);
      ro.disconnect();
    };
  }, [update]);

  const scrollBy = (dx) => ref.current?.scrollBy({ left: dx, behavior: 'smooth' });

  return (
    <div className={`relative min-w-0 ${className}`}>
      <div ref={ref} className="flex gap-1 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
        {children}
      </div>

      {edges.left && (
        <div className="absolute inset-y-0 left-0 w-10 flex items-center justify-start bg-gradient-to-r from-slate-900 via-slate-900/90 to-transparent pointer-events-none">
          <button
            type="button"
            aria-label="Scroll tabs left"
            onClick={() => scrollBy(-160)}
            className="pointer-events-auto p-1 rounded-full bg-slate-700 hover:bg-slate-600 text-slate-100"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
      {edges.right && (
        <div className="absolute inset-y-0 right-0 w-10 flex items-center justify-end bg-gradient-to-l from-slate-900 via-slate-900/90 to-transparent pointer-events-none">
          <button
            type="button"
            aria-label="Scroll tabs right"
            onClick={() => scrollBy(160)}
            className="pointer-events-auto p-1 rounded-full bg-slate-700 hover:bg-slate-600 text-slate-100"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
