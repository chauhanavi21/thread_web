import { useEffect, useRef } from 'react';
import ProductImage from './ProductImage.jsx';

const clamp = (n) => Math.min(1, Math.max(0, n));
const easeOut = (t) => 1 - (1 - t) ** 3;

/**
 * Scroll-driven landing hero. The section is 260vh tall and its content sticks to the viewport:
 *   0 – 55 %  a small framed picture grows to fill the screen (the title blends from black to white over it)
 *   70 – 100 %  an off-white circle wipes up from the bottom edge into the next section
 * Progress is written straight to CSS variables so scrolling never re-renders React.
 */
export default function Hero({ product }) {
  const section = useRef(null);

  useEffect(() => {
    const el = section.current;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let raf = 0;
    const update = () => {
      raf = 0;
      const rect = el.getBoundingClientRect();
      const p = reduce ? 0 : clamp(-rect.top / (rect.height - window.innerHeight));
      el.style.setProperty('--e', easeOut(clamp(p / 0.55)).toFixed(4));
      el.style.setProperty('--w', easeOut(clamp((p - 0.7) / 0.3)).toFixed(4));
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  const color = product?.colors[0].hex ?? '#3b3f45';

  return (
    <section ref={section} style={{ '--e': 0, '--w': 0 }} className="relative h-[260vh]">
      <div className="sticky top-0 h-screen overflow-hidden bg-brand-50">
        {/* The framed picture: clip-path insets shrink to zero as --e goes from 0 to 1. */}
        <div
          className="absolute inset-0 bg-brand-200 [--b:-2%] [--l:12%] [--r:12%] [--t:38%] sm:[--l:35%] sm:[--r:37%] sm:[--t:41%]"
          style={{
            clipPath:
              'inset(calc(var(--t) * (1 - var(--e))) calc(var(--r) * (1 - var(--e))) calc(var(--b) * (1 - var(--e))) calc(var(--l) * (1 - var(--e))))',
          }}
        >
          <ProductImage type={product?.type ?? 'hoodies'} color={color} name="" square={false} className="h-full" />
          {/* Darkens as the picture fills the screen, so the blended title flips from black to white. */}
          <div className="absolute inset-0 bg-black" style={{ opacity: 'calc(var(--e) * 0.8)' }} />
        </div>

        <h1 className="pointer-events-none absolute inset-x-0 top-12 flex justify-between px-2 text-[clamp(4rem,15vw,16rem)] leading-[0.82] text-white mix-blend-difference sm:px-3">
          <span>Threads<sup className="align-top text-[0.25em]">®</sup></span>
          <span className="hidden sm:inline">Studio</span>
        </h1>

        {/* Intro copy sits under the title and fades as the picture grows. */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 top-[44%] hidden px-4 sm:block sm:px-8" style={{ opacity: 'calc(1 - var(--e) * 2.4)' }}>
          <p className="font-display text-xl uppercase leading-tight sm:text-2xl">
            This is a space<br />for everyday
          </p>
          <div className="absolute bottom-10 left-4 max-w-[min(30rem,40vw)] sm:left-8">
            <p className="mb-3 flex justify-between font-display text-xl uppercase">
              <span>Index</span><span>1/2</span>
            </p>
            <p className="hidden text-sm leading-relaxed sm:block">
              Our collections are studies in honest fabric and simple cuts. We work with organic cotton, linen and wool, in colours that go with everything. No seasonal rules. Just fit, material and wear.
            </p>
          </div>
        </div>

        <p
          className="absolute inset-x-0 bottom-10 mx-auto max-w-sm px-4 text-center text-xs font-bold uppercase tracking-wider text-white"
          style={{ opacity: 'calc((var(--e) - 0.6) * 2.5)' }}
        >
          Each piece is presented as form, material and movement in dialogue with the body.
        </p>

        {/* The wipe: an off-white circle growing from the bottom centre covers the picture. */}
        <div className="pointer-events-none absolute inset-0 bg-brand-50" style={{ clipPath: 'circle(calc(var(--w) * 150%) at 50% 100%)' }} />
      </div>
    </section>
  );
}
