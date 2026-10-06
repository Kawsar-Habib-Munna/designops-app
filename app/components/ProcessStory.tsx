'use client';

// "How Do We Bring Ideas To Life?" সেকশন - pinned scroll-driven: একটা লম্বা track
// (VH_PER_STEP * ধাপসংখ্যা) স্ক্রল করার পুরো সময়টায় diagram-টা position:sticky
// দিয়ে viewport-এ আটকে (pinned) থাকে, আর সেই স্ক্রল-প্রোগ্রেসই activeStep ঠিক করে।
// সেকশনটা viewport-এ ঢোকার সাথে সাথেই ৫টা কার্ড একসাথে দেখা যায় (useInView,
// once:true, Figma-র static ডিজাইনের মতো), তারপর স্ক্রল করলে লাইন/ডট হাইলাইট
// Discover→Launch ধাপে ধাপে এগোয় (উল্টো স্ক্রলে আগের ধাপেও ফিরে যায়)। সেগমেন্ট/ডট
// আঁকার visual logic (SegmentLine/SegmentDot/segmentState ইত্যাদি) অপরিবর্তিত।
//
// টাইমিং/পজিশন সবই নিচের কনস্ট্যান্টে - পরে সহজে টিউন করা যাবে।

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { motion, useInView, useScroll, useMotionValueEvent, useTransform } from 'framer-motion';

export type ProcessStep = { name: string; desc: string; top: number; left: number };

export const PROCESS_STEPS: ProcessStep[] = [
  { name: 'Discover', desc: 'Understand the business, users and problem.', top: 51.15, left: 2.34 },
  { name: 'Define', desc: 'Find opportunities and set product direction.', top: 39.51, left: 22.34 },
  { name: 'Design', desc: 'Design flows, wireframes and H-fidelity interfaces.', top: 25.58, left: 42.34 },
  { name: 'Develop', desc: 'Transform designs into digital products.', top: 14.07, left: 62.34 },
  { name: 'Launch', desc: 'Test, refine and launch with confidence.', top: 0, left: 82.34 },
];

// প্রতিটা ধাপের জন্য কত vh স্ক্রল করলে পরের ধাপে যাবে - বাড়ালে ধাপগুলো বেশিক্ষণ
// ধরে রাখবে, কমালে দ্রুত পার হবে।
const VH_PER_STEP = 90;
// একটা ধাপ থেকে পরের ধাপে ট্রানজিশনের সময় (সেকেন্ডে) - স্পেক অনুযায়ী 400-600ms।
const STEP_TRANSITION_SEC = 0.5;
const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

// diagram-এর ভার্চুয়াল কোঅর্ডিনেট বক্স (.process-diagram এর aspect-ratio এর সাথে মেলে)।
const BOX_W = 1280;
const BOX_H = 782;

// আগে এই অ্যাঙ্কর পয়েন্টগুলো কার্ডের top/left% থেকে আন্দাজ করে বসানো হয়েছিল, যেটা
// background-এ থাকা আসল staircase line-এর সাথে না মিলে একটা আলাদা/ভুল-কোণের রেখা
// তৈরি করছিল। এখন timeline-graph.svg-র নিজের path ("M41 813L296 634L552 593L808
// 434L1064 394L1320 234", viewBox 1362.67x862) থেকে exact vertex বের করে এখানে
// বসানো হয়েছে - .process-diagram-graph এর CSS অফসেট (top:-4.09%, left:-3.13%,
// scale 1:1) হিসাব করে svg-coordinate কে এই 1280x782 বক্সে কনভার্ট করা হয়েছে
// (box_x = svg_x - 40, box_y = svg_y - 32)। ফলে overlay লাইনটা background-এর
// আসল রেখার উপরেই ঠিক বসে - নতুন কোনো রেখা তৈরি হয় না, শুধু existing রেখাটাই
// segment-ভিত্তিতে হাইলাইট হয়।
const ANCHORS: { x: number; y: number }[] = [
  { x: 1, y: 781 }, // Discover
  { x: 256, y: 602 }, // Define
  { x: 512, y: 561 }, // Design
  { x: 768, y: 402 }, // Develop
  { x: 1024, y: 362 }, // Launch
];
// মূল timeline-graph.svg-র path-এ আসলে ৬টা পয়েন্ট আছে - ৫টা কার্ডের সাথে মেলে, ৬ষ্ঠটা
// (svg 1320,234 → এই বক্সে 1280,202) Launch-এর পরে আরও একটু এগিয়ে যাওয়া একটা decorative
// লেজ, কোনো কার্ড নেই ওখানে। সেই পয়েন্টটাকেই Launch-এর "নিজের" আউটগোয়িং segment
// (segment 4) হিসেবে ব্যবহার করা হচ্ছে, যাতে Launch active হলে (বাকি সব ফেজের মতোই)
// তার নিজস্ব একটা লাইন হাইলাইট হয় - বাকি ৪টা phase-এর প্যাটার্নের সাথে সামঞ্জস্যপূর্ণ।
// x=1280 হুবহু diagram box-এর ডান কিনারা (BOX_W) - stroke ওই পয়েন্টের উপর centered
// হওয়ায় অর্ধেকটা (ডান দিকে) কিনারার বাইরে চলে যেত, আর .process-scroll-stage-এর
// overflow:hidden সেই অংশটা কেটে ফেলত (SVG-এর নিজের overflow:visible দিয়ে বাঁচা
// যায়নি, কারণ clip-টা বাইরের stage-এ হচ্ছিল)। tick-এর top dot-টা (r=3, active
// অবস্থায় 1.2x scale = radius 3.6) আরও বেশি বাইরে বেরিয়ে যেত, তাই শুধু 2px না
// সরিয়ে পুরো 5px ভেতরে সরানো হয়েছে যাতে dot-সহ পুরো stroke নিরাপদে বক্সের
// ভেতরে থাকে।
const LAUNCH_TAIL = { x: 1275, y: 202 };

// প্রতিটা কার্ডের নিচে মূল staircase line থেকে একটা ছোট vertical tick উপরে উঠে যায়
// (background SVG-তেই আছে, সবসময় dim) - ওটাও এখন dot-এর মতোই সেই ফেজ active হলে
// purple হবে। দৈর্ঘ্যগুলো মূল SVG-র Line289-293 থেকে decode করা (Define/Develop=50,
// Design/Launch=100, alternating) - Discover-এর নিজস্ব কোনো tick মূল ডিজাইনে নেই,
// visual সামঞ্জস্যের জন্য 50 ব্যবহার করা হয়েছে।
const TICK_LENGTHS = [50, 50, 100, 50, 100];
const LAUNCH_TAIL_TICK_LENGTH = 50;

const PURPLE = '#8133f1';
const DIM = 'rgba(254, 255, 255, 0.16)';
// Figma-তে active লাইনের stroke আসলে flat purple না, একটা gradient
// (C8C5CD 80% → 9654F4 80%) - from পয়েন্ট থেকে to পয়েন্ট পর্যন্ত ধূসর থেকে
// বেগুনিতে মিলিয়ে যায়।
const GRADIENT_FROM = '#C8C5CD';
const GRADIENT_TO = '#9654F4';

// pathLength/scale/opacity (নতুন সেগমেন্ট/ডট reveal হওয়া) 400-600ms জুড়ে আঁকা হয়
// স্পেক অনুযায়ী, কিন্তু stroke/fill রং (active↔past সুইচ) সেই একই ধীর duration-এ
// রাখলে দ্রুত পরপর কয়েক ধাপ স্ক্রল করার সময় আগের active রং এখনো fade-out হতে হতেই
// পরের ধাপ চলে আসে - purple emphasis "এক ধাপ পিছিয়ে" আছে বলে মনে হয় (রং transition
// শেষ না হওয়া পর্যন্ত)। রং বদলানোটা আলাদাভাবে অনেক দ্রুত (150ms) রাখায় "কোন ধাপ এখন
// active" এই ফিডব্যাক স্ক্রলের সাথে প্রায় সাথে সাথেই মেলে, draw/reveal animation-টা
// তার নিজের ধীর গতিতেই থাকে।
function SegmentLine({ from, to, state }: { from: { x: number; y: number }; to: { x: number; y: number }; state: 'hidden' | 'active' | 'past' }) {
  // url(#...) gradient reference framer-motion দিয়ে color হিসেবে animate করা যায় না
  // (RGB ইন্টারপোলেশন ভেঙে পড়ে), তাই stroke-টা animate={} প্রপের বাইরে রেখে সরাসরি
  // attribute হিসেবে সেট করা হয়েছে - active↔dim সুইচ তাৎক্ষণিক হয়, যা 150ms-এর দ্রুত
  // ফ্লিপের সাথে দৃশ্যত অভিন্ন।
  const gradientId = `segline-grad-${from.x}-${from.y}-${to.x}-${to.y}`;
  return (
    <>
      <defs>
        <linearGradient id={gradientId} gradientUnits="userSpaceOnUse" x1={from.x} y1={from.y} x2={to.x} y2={to.y}>
          <stop offset="0%" stopColor={GRADIENT_FROM} stopOpacity={0.8} />
          <stop offset="100%" stopColor={GRADIENT_TO} stopOpacity={0.8} />
        </linearGradient>
      </defs>
      <motion.line
        x1={from.x}
        y1={from.y}
        x2={to.x}
        y2={to.y}
        strokeLinecap="round"
        stroke={state === 'active' ? `url(#${gradientId})` : DIM}
        initial={false}
        animate={{
          pathLength: state === 'hidden' ? 0 : 1,
          opacity: state === 'hidden' ? 0 : 1,
          strokeWidth: state === 'active' ? 2.5 : 2,
        }}
        transition={{
          default: { duration: STEP_TRANSITION_SEC, ease: EASE },
          strokeWidth: { duration: 0.15 },
        }}
      />
    </>
  );
}

function SegmentDot({ point, state, r = 5 }: { point: { x: number; y: number }; state: 'hidden' | 'active' | 'past'; r?: number }) {
  return (
    <motion.circle
      cx={point.x}
      cy={point.y}
      r={r}
      initial={false}
      animate={{
        scale: state === 'hidden' ? 0 : state === 'active' ? 1.2 : 1,
        opacity: state === 'hidden' ? 0 : 1,
        fill: state === 'active' ? PURPLE : DIM,
      }}
      transition={{
        default: { duration: STEP_TRANSITION_SEC, ease: EASE },
        fill: { duration: 0.15 },
      }}
    />
  );
}

function StepCard({ step, index, activeStep, cardsVisible }: { step: ProcessStep; index: number; activeStep: number; cardsVisible: boolean }) {
  const isRevealed = index <= activeStep;
  const isActive = index === activeStep;
  return (
    <motion.div
      className={`process-step${isRevealed ? ' revealed' : ''}${isActive ? ' active' : ''}`}
      style={{ top: `${step.top}%`, left: `${step.left}%` }}
      initial={false}
      animate={cardsVisible ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
      transition={{ duration: STEP_TRANSITION_SEC, ease: EASE }}
    >
      <h3 className="process-step-title">{step.name}</h3>
      <p className="process-step-desc">{step.desc}</p>
    </motion.div>
  );
}

function segmentState(segmentIndex: number, activeStep: number): 'hidden' | 'active' | 'past' {
  if (activeStep < segmentIndex) return 'hidden';
  if (activeStep === segmentIndex) return 'active';
  return 'past';
}

function dotState(pointIndex: number, activeStep: number): 'hidden' | 'active' | 'past' {
  if (activeStep < pointIndex) return 'hidden';
  if (activeStep === pointIndex) return 'active';
  return 'past';
}

// mূল timeline-graph.svg-র dot/tick পয়েন্টগুলো আসলে প্রতিটা কার্ডের ডান কোণা বরাবর বসানো
// (anchor[i].x === card[i-1]-এর right edge, exact px মিলিয়ে দেখা গেছে) - কার্ড i-এর
// নিজের নিচে না। তাই tick[i] visually card[i-1]-এর সাথে "লাগানো" থাকে, card[i]-এর সাথে
// না। ফলে dotState-এর মতো সরাসরি index ব্যবহার করলে tick-টা ভুল কার্ডে (এক ধাপ আগেরটায়)
// হাইলাইট হয়ে যাচ্ছিল। এই ফাংশন সেই অফসেট ঠিক করে - tick[i] এখন card[i-1] active হলে
// purple হয় (i=0 বাদে, যেটার আগে কোনো কার্ড নেই, তাই নিজের ধাপেই থাকে)।
function tickState(pointIndex: number, activeStep: number): 'hidden' | 'active' | 'past' {
  const ownerStep = pointIndex === 0 ? 0 : pointIndex - 1;
  return dotState(ownerStep, activeStep);
}

function DesktopDiagram() {
  const trackRef = useRef<HTMLDivElement>(null);
  const diagramRef = useRef<HTMLDivElement>(null);
  // once:true মানে inView একবার true হয়ে গেলে আর কখনো false-এ ফেরে না, তাই এটাই
  // সরাসরি "কার্ডগুলো দেখা যাবে কিনা" হিসেবে ব্যবহার করা যায় - আলাদা cardsVisible
  // state লাগে না।
  const inView = useInView(diagramRef, { once: true, amount: 0.4 });
  const [activeStep, setActiveStep] = useState(0);
  const [navOffset, setNavOffset] = useState(0);
  const [panDistance, setPanDistance] = useState(0);
  const anchors = ANCHORS;

  // ছোট/কম-উচ্চতার viewport-এ diagram (782px, size বদলানো যাবে না) পুরো 100vh
  // stage-এর চেয়ে লম্বা হয়ে গেলে উপরের অংশ (Develop/Launch) sticky navbar-এর
  // আড়ালে ঢাকা পড়ে যাচ্ছিল। এখন stage-টা viewport-এর একদম উপর (top:0) থেকে না,
  // navbar-এর ঠিক নিচ থেকে pin হয় - .nav নিজেও sticky (top:-28px) বলে তার আসল
  // visible bottom edge-টা CSS থেকে আন্দাজ না করে সরাসরি মেপে নেওয়া হচ্ছে। একই
  // মাপ থেকে panDistance-ও বের করা হয় (diagram-এর আসল height বনাম stage-এর
  // দৃশ্যমান height-এর পার্থক্য) - এটাই Launch-এর ধাপে diagram-টা ঠিক কতটা উপরে
  // প্যান করলে bottom-এর X-axis পুরোপুরি দেখা যাবে তার পরিমাণ। mount-এর সময়
  // (scrollY=0) nav তখনো "stuck" অবস্থায় যায়নি, তাই ভুল (অনেক বড়) offset মাপবে -
  // inView true হলে (ততক্ষণে nav নিশ্চিতভাবেই stuck) আবার মাপা হয়।
  useEffect(() => {
    function measure() {
      const nav = document.querySelector('.home-root .nav');
      const navBottom = nav ? nav.getBoundingClientRect().bottom : 0;
      setNavOffset(navBottom);
      if (diagramRef.current) {
        const diagramHeight = diagramRef.current.getBoundingClientRect().height;
        const available = window.innerHeight - navBottom;
        setPanDistance(Math.max(0, diagramHeight - available));
      }
    }
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [inView]);

  // সেকশনটা এখন আবার pinned - একটা লম্বা track (VH_PER_STEP * ধাপসংখ্যা) স্ক্রল
  // করার পুরোটা সময় diagram-টা position:sticky দিয়ে viewport-এ আটকে থাকে, আর সেই
  // স্ক্রল-প্রোগ্রেসই activeStep ঠিক করে (['start start','end end'] - track-এর
  // শুরু থেকে শেষ পর্যন্ত পুরোটাই 0→1 progress)।
  const { scrollYProgress } = useScroll({ target: trackRef, offset: ['start start', 'end end'] });
  useMotionValueEvent(scrollYProgress, 'change', (v) => {
    const idx = Math.min(PROCESS_STEPS.length - 1, Math.max(0, Math.floor(v * PROCESS_STEPS.length)));
    setActiveStep((prev) => (prev === idx ? prev : idx));
  });
  // Launch active হওয়ার ঠিক আগে-পরে (v: 0.8→1, যেটা activeStep-এর নিজস্ব হিসাবেই
  // Launch-এর bin) diagram-টা ওপরে প্যান করে, যাতে bottom-এর X-axis পুরোপুরি
  // দেখা যায় পিন শেষ হওয়ার আগেই - আলাদা করে পিন-পরবর্তী লম্বা "dead scroll"
  // লাগে না এটা দেখতে।
  const panY = useTransform(scrollYProgress, [0.8, 1], [0, -panDistance]);

  return (
    <div
      className="process-scroll-track"
      ref={trackRef}
      style={{ height: `${PROCESS_STEPS.length * VH_PER_STEP}vh` }}
    >
      <div className="process-scroll-stage" style={{ top: navOffset, height: `calc(100vh - ${navOffset}px)` }}>
        <motion.div className="process-diagram" ref={diagramRef} style={{ y: panY }}>
          <img src="/process/timeline-graph.svg" alt="" className="process-diagram-graph" aria-hidden="true" />
          <span className="process-axis-y" aria-hidden="true">PROGRESS &amp; TIMELINE</span>
          <span className="process-axis-x" aria-hidden="true">DESIGN THINKING PROCESS</span>

          <svg
            className="process-scroll-svg"
            viewBox={`0 0 ${BOX_W} ${BOX_H}`}
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            {anchors.slice(0, -1).map((from, i) => (
              <SegmentLine key={`seg-${PROCESS_STEPS[i].name}`} from={from} to={anchors[i + 1]} state={segmentState(i, activeStep)} />
            ))}
            <SegmentLine from={anchors[anchors.length - 1]} to={LAUNCH_TAIL} state={segmentState(anchors.length - 1, activeStep)} />
            {anchors.map((point, i) => (
              // Discover (i=0) এর tick x=1-এ বসে, Y-axis-এরও ঠিক একই x - তাই এই
              // ছোট tick-টা axis joint point-এর ওপর একটা আলাদা/বেমানান খাড়া দাগের
              // মতো দেখায়। i=0 বাদ দেওয়া হয়েছে (dot আগেই বাদ দেওয়া হয়েছিল)।
              i === 0 ? null : (
                <SegmentLine
                  key={`tick-${PROCESS_STEPS[i].name}`}
                  from={point}
                  to={{ x: point.x, y: point.y - TICK_LENGTHS[i] }}
                  state={tickState(i, activeStep)}
                />
              )
            ))}
            <SegmentLine
              from={LAUNCH_TAIL}
              to={{ x: LAUNCH_TAIL.x, y: LAUNCH_TAIL.y - LAUNCH_TAIL_TICK_LENGTH }}
              state={segmentState(anchors.length - 1, activeStep)}
            />
            {anchors.map((point, i) => (
              // Discover (i=0) এর tick x=1-এ, Y-axis-এরও ঠিক একই x - এই tick-এর
              // top-dot টা তাই Y-axis লাইনের ওপর ভাসমান একটা "বেমানান" বিন্দুর মতো
              // দেখায় (Discover-এর কার্ডের সাথে দৃশ্যত কোনো সংযোগ বোঝা যায় না)। তাই
              // শুধু i=0-এর top-dot বাদ দেওয়া হয়েছে, বাকিগুলো অক্ষত।
              i === 0 ? null : (
                <SegmentDot
                  key={`tickdot-${PROCESS_STEPS[i].name}`}
                  point={{ x: point.x, y: point.y - TICK_LENGTHS[i] }}
                  state={tickState(i, activeStep)}
                  r={3}
                />
              )
            ))}
            <SegmentDot
              key="tickdot-launch-tail"
              point={{ x: LAUNCH_TAIL.x, y: LAUNCH_TAIL.y - LAUNCH_TAIL_TICK_LENGTH }}
              state={segmentState(anchors.length - 1, activeStep)}
              r={3}
            />
          </svg>

          {PROCESS_STEPS.map((step, i) => (
            <StepCard key={step.name} step={step} index={i} activeStep={activeStep} cardsVisible={inView} />
          ))}
        </motion.div>
      </div>
    </div>
  );
}

// মোবাইলে (900px এর নিচে) pin/scroll-jack করা হয় না - সাধারণ ভার্টিকাল লিস্ট,
// প্রতিটা কার্ড নিজে ভিউপোর্টে ঢুকলে IntersectionObserver দিয়ে fade-up হয়, একই
// ক্রমে (Discover → Launch), বাঁ পাশে একটা ভার্টিকাল purple/dim connector লাইন।
function MobileStepList() {
  const [visibleCount, setVisibleCount] = useState(1);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  const observerRef = useRef<IntersectionObserver | null>(null);
  const setItemRef = (i: number) => (el: HTMLDivElement | null) => {
    itemRefs.current[i] = el;
    if (!el) return;
    if (!observerRef.current) {
      observerRef.current = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            const idx = itemRefs.current.findIndex((node) => node === entry.target);
            if (idx === -1) return;
            setVisibleCount((prev) => Math.max(prev, idx + 1));
          });
        },
        { threshold: 0.35 }
      );
    }
    observerRef.current.observe(el);
  };

  return (
    <div className="process-mobile-steps">
      {PROCESS_STEPS.map((step, i) => {
        const isVisible = i < visibleCount;
        const isActive = i === visibleCount - 1;
        return (
          <div key={step.name} ref={setItemRef(i)} className="process-mobile-item">
            {i > 0 && (
              <span
                className={`process-mobile-connector${isVisible ? ' visible' : ''}${isActive ? ' active' : ''}`}
                aria-hidden="true"
              />
            )}
            <motion.div
              className={`process-step${isVisible ? ' revealed' : ''}${isActive ? ' active' : ''}`}
              initial={false}
              animate={isVisible ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
              transition={{ duration: STEP_TRANSITION_SEC, ease: EASE }}
            >
              <h3 className="process-step-title">{step.name}</h3>
              <p className="process-step-desc">{step.desc}</p>
            </motion.div>
          </div>
        );
      })}
    </div>
  );
}

// প্রফার্স-reduced-motion হলে আগের static diagram-এর মতোই দেখাবে - সব কার্ড + পুরো
// লাইন একসাথে, কোনো pin/animation ছাড়া।
function StaticDiagram() {
  return (
    <div className="process-diagram">
      <img src="/process/timeline-graph.svg" alt="" className="process-diagram-graph" aria-hidden="true" />
      <span className="process-axis-y" aria-hidden="true">PROGRESS &amp; TIMELINE</span>
      <span className="process-axis-x" aria-hidden="true">DESIGN THINKING PROCESS</span>
      {PROCESS_STEPS.map((step, i) => (
        <div className={`process-step${i === 0 ? ' active' : ''}`} key={step.name} style={{ top: `${step.top}%`, left: `${step.left}%` }}>
          <h3 className="process-step-title">{step.name}</h3>
          <p className="process-step-desc">{step.desc}</p>
        </div>
      ))}
    </div>
  );
}

function StaticMobileList() {
  return (
    <div className="process-mobile-steps">
      {PROCESS_STEPS.map((step, i) => (
        <div className={`process-step${i === 0 ? ' active' : ''}`} key={step.name}>
          <h3 className="process-step-title">{step.name}</h3>
          <p className="process-step-desc">{step.desc}</p>
        </div>
      ))}
    </div>
  );
}

// framer-motion এর useReducedMotion() ব্রাউজারের matchMedia সরাসরি প্রথম client
// render-এই resolve করে ফেলে - কিন্তু server তো ইউজারের preference জানে না, তাই
// reduced-motion অন থাকা ইউজারদের জন্য server ও client-এর প্রথম render আলাদা JSX
// tree রিটার্ন করত, যেটা React hydration mismatch দেয়। useSyncExternalStore এই
// ঠিক এই ধরনের "বাইরের browser API-র সাথে sync" কাজের জন্যই বানানো - getServerSnapshot
// সবসময় false দেয় (server-এর সাথে হাইড্রেশন মেলে), আসল প্রেফারেন্স মাউন্টের পরে
// normal client re-render-এ বসে, কোনো hydration mismatch বা effect-এর ভেতরে
// setState ছাড়াই।
function subscribeReducedMotion(onChange: () => void) {
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
}
function getReducedMotionSnapshot() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
function getReducedMotionServerSnapshot() {
  return false;
}
function useReducedMotionSafe() {
  return useSyncExternalStore(subscribeReducedMotion, getReducedMotionSnapshot, getReducedMotionServerSnapshot);
}

export default function ProcessStory() {
  const reducedMotion = useReducedMotionSafe();

  if (reducedMotion) {
    return (
      <>
        <StaticDiagram />
        <StaticMobileList />
      </>
    );
  }

  return (
    <>
      <div className="process-diagram-desktop-only">
        <DesktopDiagram />
      </div>
      <div className="process-diagram-mobile-only">
        <MobileStepList />
      </div>
    </>
  );
}
