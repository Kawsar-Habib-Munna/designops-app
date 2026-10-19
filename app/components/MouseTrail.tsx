'use client';

// "Silky Mouse Trail" (Framer Marketplace) ঘরানার cursor-ribbon effect - from
// scratch লেখা, কোনো বাইরের কোড কপি করা হয়নি। কার্সরের পেছনে N-টা পয়েন্টের
// একটা chain থাকে, প্রতিটা পয়েন্ট প্রতি ফ্রেমে তার আগের পয়েন্টের দিকে একটু
// একটু করে (damping) এগোয় - এতেই "ইনার্শিয়া সহ মসৃণ ফিতার মতো" ফলো করার
// অনুভূতি আসে। ribbon-এর width/opacity কার্সরের গতির (speed) সাথে বদলায়,
// মাথা (কার্সরের কাছে) থেকে লেজ পর্যন্ত রং গ্র্যাডিয়েন্ট। পুরো পেজ জুড়ে একটা
// fixed, pointer-events:none canvas - কোনো ক্লিক/ইন্টার‍্যাকশন ব্লক করে না।
// টাচ ডিভাইসে কার্সর concept-ই নেই, তাই শুধু "fine pointer" (মাউস) থাকলেই চলে।

import { useEffect, useRef } from 'react';
import { useReducedMotion } from 'framer-motion';

const SEGMENTS = 18;
const DAMPING = 0.35;
const MAX_WIDTH = 14;
const MIN_WIDTH = 1.5;
const MAX_SPEED = 45; // এর চেয়ে বেশি গতিতে width আর না বাড়িয়ে ক্যাপ করা হয়
const HEAD_COLOR = '206, 176, 250'; // #ceb0fa
const TAIL_COLOR = '129, 51, 241'; // #8133f1

type Point = { x: number; y: number };

export default function MouseTrail() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (reduceMotion) return;
    if (!window.matchMedia('(pointer: fine)').matches) return;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    let width = window.innerWidth;
    let height = window.innerHeight;
    let frameId = 0;
    let lastHead: Point | null = null;
    let speed = 0;
    let active = false;

    const points: Point[] = Array.from({ length: SEGMENTS }, () => ({ x: -100, y: -100 }));
    const target: Point = { x: -100, y: -100 };

    function resize() {
      // canvas-এর CSS সাইজ (display width/height) বসানো হয় না এখানে - .mouse-
      // trail CSS rule-এর position:fixed + inset:0 ইতিমধ্যেই এটা viewport-এর
      // সাথে auto-fill করে। আগে এখানে canvas.style.width/height-ও সেট করা
      // হতো window.innerWidth/innerHeight দিয়ে - inline style থাকায় সেটাই
      // inset:0-কে override করত, আর window.innerWidth কখনো সত্যিকার visual
      // viewport-এর চেয়ে বেশি মাপলে (zoom/scrollbar/devtools quirk) canvas-টা
      // viewport-এর চেয়ে চওড়া হয়ে পেজের ডান পাশে একটা ফাঁকা গ্যাপ তৈরি করত।
      // এখন শুধু drawing-buffer resolution (canvas.width/height, আসল পিক্সেল
      // কাউন্ট) সেট করা হয় - সাইজ মাপা হয় getBoundingClientRect() দিয়ে, যেটা
      // CSS-চালিত আসল রেন্ডারড সাইজ রিপোর্ট করে, window.innerWidth না।
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas!.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      canvas!.width = width * dpr;
      canvas!.height = height * dpr;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function onMove(e: PointerEvent) {
      target.x = e.clientX;
      target.y = e.clientY;
      active = true;
    }

    function onLeave() {
      active = false;
    }

    function tick() {
      ctx!.clearRect(0, 0, width, height);

      if (active) {
        points[0].x = target.x;
        points[0].y = target.y;
        for (let i = 1; i < points.length; i++) {
          points[i].x += (points[i - 1].x - points[i].x) * DAMPING;
          points[i].y += (points[i - 1].y - points[i].y) * DAMPING;
        }

        const head = points[0];
        if (lastHead) {
          const dx = head.x - lastHead.x;
          const dy = head.y - lastHead.y;
          speed = Math.sqrt(dx * dx + dy * dy);
        }
        lastHead = { x: head.x, y: head.y };

        const t = Math.min(1, speed / MAX_SPEED);
        const lineWidth = MIN_WIDTH + (MAX_WIDTH - MIN_WIDTH) * t;
        const alpha = 0.15 + 0.45 * t;

        const tail = points[points.length - 1];
        const gradient = ctx!.createLinearGradient(head.x, head.y, tail.x, tail.y);
        gradient.addColorStop(0, `rgba(${HEAD_COLOR}, ${alpha})`);
        gradient.addColorStop(1, `rgba(${TAIL_COLOR}, 0)`);

        ctx!.strokeStyle = gradient;
        ctx!.lineWidth = lineWidth;
        ctx!.lineCap = 'round';
        ctx!.lineJoin = 'round';
        ctx!.beginPath();
        ctx!.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length - 1; i++) {
          const midX = (points[i].x + points[i + 1].x) / 2;
          const midY = (points[i].y + points[i + 1].y) / 2;
          ctx!.quadraticCurveTo(points[i].x, points[i].y, midX, midY);
        }
        ctx!.stroke();
      }

      frameId = requestAnimationFrame(tick);
    }

    resize();
    tick();
    window.addEventListener('resize', resize);
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerleave', onLeave);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerleave', onLeave);
    };
  }, [reduceMotion]);

  if (reduceMotion) return null;

  return <canvas ref={canvasRef} className="mouse-trail" aria-hidden="true" />;
}
