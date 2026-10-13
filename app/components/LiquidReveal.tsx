'use client';

// "Liquid Mouse Reveal" (Framer Marketplace) ঘরানার cursor-driven image-reveal
// ব্রাশ - from scratch লেখা, কোনো বাইরের কোড কপি করা হয়নি। হিরো ব্যাকগ্রাউন্ড
// ছবির ওপর একটা solid-color canvas বসে পুরো ছবি ঢেকে রাখে; কার্সর যেখানে যায়
// সেখানে canvas-থেকে গোল গর্ত "মুছে" (globalCompositeOperation:
// destination-out) আসল ছবিটা দেখায় - প্রতি ফ্রেমে canvas আবার ঢেকে redraw হয়,
// তাই এটা স্থায়ী scratch-off না, বরং কার্সরের লাইভ ট্রেইল। একাধিক blob
// (প্রতিটার নিজস্ব lag) পরপর কার্সরকে ফলো করে একটা chain বানায় - তরল/liquid
// ভাব দেয়। CSS blur+contrast filter (ক্লাসিক "gooey" টেকনিক) দিয়ে কাছাকাছি
// blob-গুলো একটাতে মিশে যায়।

import { useEffect, useRef } from 'react';
import { useReducedMotion } from 'framer-motion';

const BLOB_COUNT = 6;
const LAGS = [0.5, 0.36, 0.28, 0.22, 0.18, 0.14];
const RADIUS = 80;
// রেফারেন্সের মতো liquid-টা নিজেই রঙিন - flat dark color-এর বদলে সাইটের brand
// gradient (purple family) দিয়ে ঢাকনাটা আঁকা হয়, তাই কার্সর যেখানে wipe করে
// সেই liquid edge-টাও রঙিন দেখায়, শুধু dark-থেকে-ছবি transition না।
const GRADIENT_STOPS: [number, string][] = [
  [0, '#290064'],
  [0.5, '#6200ee'],
  [1, '#8133f1'],
];
// home.css-এর .hero-fig-bg/.liquid-reveal-এর fixed height (974px) এর সাথে হুবহু
// মিলিয়ে - parent.clientHeight ব্যবহার করলে .hero-fig-এর আসল লেআউট-উচ্চতা
// (যেটা ভিন্ন, সাধারণত কম) থেকে canvas বানিয়ে ফেলত, ফলে ছবির নিচের অংশ
// canvas-এর বাইরে পড়ে সবসময় দৃশ্যমান থেকে যেত (reveal effect ভাঙা মনে হতো)।
const BG_HEIGHT = 974;

type Point = { x: number; y: number };

export default function LiquidReveal() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (reduceMotion) return;
    if (!window.matchMedia('(pointer: fine)').matches) return;

    const canvas = canvasRef.current;
    const parent = canvas?.parentElement;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !parent || !ctx) return;

    let width = 0;
    let height = 0;
    let frameId = 0;
    let active = false;
    let baseFill: CanvasGradient | string = '#0e0e12';
    const target: Point = { x: 0, y: 0 };
    const blobs: Point[] = Array.from({ length: BLOB_COUNT }, () => ({ x: -9999, y: -9999 }));

    function resize() {
      const dpr = window.devicePixelRatio || 1;
      width = parent!.clientWidth;
      height = BG_HEIGHT;
      canvas!.width = width * dpr;
      canvas!.height = height * dpr;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);

      const gradient = ctx!.createLinearGradient(0, 0, width, height);
      for (const [stop, color] of GRADIENT_STOPS) gradient.addColorStop(stop, color);
      baseFill = gradient;
    }

    function onMove(e: PointerEvent) {
      const rect = canvas!.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      active = x >= 0 && x <= width && y >= 0 && y <= height;
      target.x = x;
      target.y = y;
    }

    function tick() {
      ctx!.globalCompositeOperation = 'source-over';
      ctx!.fillStyle = baseFill;
      ctx!.fillRect(0, 0, width, height);

      if (active) {
        blobs[0].x += (target.x - blobs[0].x) * LAGS[0];
        blobs[0].y += (target.y - blobs[0].y) * LAGS[0];
        for (let i = 1; i < blobs.length; i++) {
          const lag = LAGS[i] ?? 0.14;
          blobs[i].x += (blobs[i - 1].x - blobs[i].x) * lag;
          blobs[i].y += (blobs[i - 1].y - blobs[i].y) * lag;
        }

        ctx!.globalCompositeOperation = 'destination-out';
        for (let i = 0; i < blobs.length; i++) {
          const r = RADIUS * (1 - (i / blobs.length) * 0.5);
          const gradient = ctx!.createRadialGradient(blobs[i].x, blobs[i].y, 0, blobs[i].x, blobs[i].y, r);
          gradient.addColorStop(0, 'rgba(0, 0, 0, 1)');
          gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
          ctx!.fillStyle = gradient;
          ctx!.beginPath();
          ctx!.arc(blobs[i].x, blobs[i].y, r, 0, Math.PI * 2);
          ctx!.fill();
        }
      }

      frameId = requestAnimationFrame(tick);
    }

    resize();
    tick();
    window.addEventListener('resize', resize);
    window.addEventListener('pointermove', onMove, { passive: true });

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', onMove);
    };
  }, [reduceMotion]);

  if (reduceMotion) return null;

  return <canvas ref={canvasRef} className="liquid-reveal" aria-hidden="true" />;
}
