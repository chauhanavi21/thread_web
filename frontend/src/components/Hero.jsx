import { Link } from 'react-router-dom';
import ProductImage from './ProductImage.jsx';
import { ease, setVars, span, useScrollScene } from './useScrollScene.js';

/**
 * Landing hero, a single scroll-driven scene (the section is 420vh tall; its content sticks to the screen).
 * The stages follow the reference recording:
 *   0.00 – 0.40  a small tilted picture grows from its box to fill the screen, wobbling as it goes
 *   0.30 – 0.50  the title fades black → grey → white while the picture darkens
 *   0.50 – 0.80  two text blocks rise from the bottom, one after the other
 *   0.82 – 1.00  an off-white circle grows from the bottom edge and covers everything
 * The scroll position is smoothed in useScrollScene and written to CSS variables, so React never re-renders.
 */
export default function Hero({ product }) {
  const ref = useScrollScene((p, el) => {
    const grow = ease(span(p, 0, 0.4));
    setVars(el, {
      '--grow': grow,
      '--tilt': `${(1 - grow) * -5 + Math.sin(grow * Math.PI * 2.5) * 1.6}deg`,
      '--dark': span(p, 0.3, 0.5),
      '--intro': 1 - span(p, 0.02, 0.2),
      '--rise1': ease(span(p, 0.52, 0.66)),
      '--rise2': ease(span(p, 0.62, 0.78)),
      '--wipe': ease(span(p, 0.82, 1)),
    });
  });

  const color = product?.colors[0].hex ?? '#3b3f45';

  return (
    <section ref={ref} style={{ '--grow': 0, '--dark': 0, '--wipe': 0, '--intro': 1, '--rise1': 0, '--rise2': 0, '--tilt': '-5deg' }} className="relative h-[420vh]">
      <div className="sticky top-0 h-screen overflow-hidden bg-brand-50">
        {/* The picture. Its box grows from a small tilted frame to the full screen. */}
        <div
          className="absolute inset-0 overflow-hidden bg-brand-200 [--b:-2%] [--l:12%] [--r:12%] [--t:38%] sm:[--l:35%] sm:[--r:37%] sm:[--t:41%]"
          style={{
            clipPath:
              'inset(calc(var(--t) * (1 - var(--grow))) calc(var(--r) * (1 - var(--grow))) calc(var(--b) * (1 - var(--grow))) calc(var(--l) * (1 - var(--grow))))',
            transform: 'rotate(var(--tilt)) scale(calc(1 + (1 - var(--grow)) * 0.04))',
          }}
        >
          {/* The whole garment stays recognisable; it just gets a slow push-in as the frame grows. */}
          <div className="h-full w-full" style={{ transform: 'scale(calc(1 + var(--grow) * 0.18))' }}>
            <ProductImage type={product?.type ?? 'hoodies'} color={color} name="" square={false} fit="meet" bg="bg-brand-300" className="h-full" />
          </div>
          <div className="absolute inset-0 bg-black" style={{ opacity: 'calc(var(--dark) * 0.78)' }} />
        </div>

        {/* Title: black on paper → grey → white on the dark picture. */}
        <h1
          className="pointer-events-none absolute inset-x-0 top-12 flex justify-between px-2 text-[clamp(4rem,15vw,16rem)] leading-[0.82] sm:px-3"
          style={{ color: 'color-mix(in srgb, #fff calc(var(--dark) * 100%), #0a0a0a)' }}
        >
          <span>Threads<sup className="align-top text-[0.25em]">®</sup></span>
          <span className="hidden sm:inline">Studio</span>
        </h1>

        {/* Intro copy, fades as the picture grows. */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 top-[44%] hidden px-4 sm:block sm:px-8" style={{ opacity: 'var(--intro)' }}>
          <p className="font-display text-xl uppercase leading-tight sm:text-2xl">
            This is a space<br />for everyday
          </p>
          <div className="absolute bottom-10 left-4 max-w-[min(30rem,40vw)] sm:left-8">
            <p className="mb-3 flex justify-between font-display text-xl uppercase"><span>Index</span><span>1/2</span></p>
            <p className="text-sm leading-relaxed">
              Our collections are studies in honest fabric and simple cuts. We work with organic cotton, linen and wool, in colours that go with everything. No seasonal rules. Just fit, material and wear.
            </p>
          </div>
        </div>

        {/* Two text blocks that rise over the dark picture. */}
        <p
          className="pointer-events-none absolute left-[26%] top-[40%] max-w-md text-sm font-bold uppercase leading-snug text-white sm:text-base"
          style={{ opacity: 'var(--rise1)', transform: 'translateY(calc((1 - var(--rise1)) * 60px))' }}
        >
          Each piece is presented as form, material and movement in dialogue with the body.
          <span className="mt-1 block pl-[20%]">Each collection explores silhouette, texture and the relationship between body and space.</span>
        </p>
        <div
          className="absolute bottom-[12%] left-[10%] right-[8%] flex flex-col gap-6 text-white sm:left-[38%] sm:flex-row sm:gap-24"
          style={{ opacity: 'var(--rise2)', transform: 'translateY(calc((1 - var(--rise2)) * 80px))' }}
        >
          <Link to="/shop" className="pointer-events-auto font-display text-3xl uppercase underline-offset-4 hover:underline">Collection</Link>
          <div className="max-w-md space-y-4 text-sm leading-relaxed sm:text-base">
            <p>Collection is presented as a curated archive of garments exploring silhouette, material and movement. Each piece is documented as a visual study.</p>
            <p>The collection examines form, texture and engineered proportions.</p>
          </div>
        </div>

        {/* The wipe. */}
        <div className="pointer-events-none absolute inset-0 bg-brand-50" style={{ clipPath: 'circle(calc(var(--wipe) * 150%) at 50% 100%)' }} />
      </div>
    </section>
  );
}
