import { useEffect, useRef } from 'react';

export default function CustomCursor() {
  const cursorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let x = 0, y = 0;
    let raf: number;

    const onMove = (e: MouseEvent) => {
      x = e.clientX;
      y = e.clientY;
    };

    const animate = () => {
      if (cursorRef.current) {
        cursorRef.current.style.transform = `translate(${x}px, ${y}px)`;
      }
      raf = requestAnimationFrame(animate);
    };

    window.addEventListener('mousemove', onMove);
    raf = requestAnimationFrame(animate);
    return () => {
      window.removeEventListener('mousemove', onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <>
      <div
        ref={cursorRef}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          pointerEvents: 'none',
          zIndex: 9999,
          willChange: 'transform',
        }}
      >
        <svg
          width="28"
          height="28"
          viewBox="0 0 28 28"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="arrowGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%"   stopColor="#40D9FF" />
              <stop offset="100%" stopColor="#0090FF" />
            </linearGradient>
          </defs>
          {/*
            Arrow shape: tip at top-left (0,0), body goes down-right.
            Matches the Telegram-style send arrow.
          */}
          <path
            d="M2 2 L26 13 L15 15 L13 26 Z"
            fill="url(#arrowGrad)"
            style={{ filter: 'drop-shadow(0 2px 6px rgba(0,144,255,0.45))' }}
          />
        </svg>
      </div>

      <style>{`* { cursor: none !important; }`}</style>
    </>
  );
}
