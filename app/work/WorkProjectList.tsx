'use client';

import { useMemo, useState } from 'react';
import { ProjectMiniCard, type ProjectCard } from '@/app/components/ProjectsCarousel';

// Figma "Project Section" (node 2718:5073): category ট্যাব + ৫টা কার্ড/পেজ +
// নম্বরড পেজিনেশন ("01 02 03 ... 09")। কার্ডের নিজের মার্কআপ/CSS
// (ProjectsCarousel.tsx-এর ProjectMiniCard, home.css-এর .project-* ক্লাস)
// হুবহু রিইউজ করা হলো - এগুলো আগে থেকেই light-themed (এই পেজের মতোই), শুধু
// এখানে carousel-এর stacking/motion ছাড়া প্লেইন ফিল্টারড+পেজিনেটেড লিস্ট।
// category ট্যাবের তালিকা হার্ডকোড না করে ডেটাতে যা আছে তা থেকেই বানানো হয় -
// case_studies.category একটা ফ্রি-টেক্সট কলাম (DB-তে কোনো enum/CHECK নেই),
// তাই Figma-র ঠিক একই বানান হার্ডকোড করলে বাস্তব ডেটার সাথে না মিললে ট্যাব
// কোনো কাজই করত না।
const PAGE_SIZE = 5;

// DB-র category ভ্যালু ফ্রি-টেক্সট, প্রায়ই সব-ক্যাপস ("FINTECH", "E-COMMERCE") -
// ট্যাবে সেটা সরাসরি না দেখিয়ে টাইটেল-কেসে ফরম্যাট করা হয় (filter-matching এখনও
// আসল ভ্যালু দিয়েই হয়, শুধু দেখানোর টেক্সট বদলায়)।
function toTitleCase(s: string) {
  return s.toLowerCase().replace(/(^|[\s-])\S/g, (c) => c.toUpperCase());
}

export default function WorkProjectList({ projects }: { projects: ProjectCard[] }) {
  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const p of projects) if (p.category) set.add(p.category);
    return ['All Projects', ...Array.from(set)];
  }, [projects]);

  const [activeCategory, setActiveCategory] = useState('All Projects');
  const [page, setPage] = useState(0);

  const filtered = useMemo(
    () => (activeCategory === 'All Projects' ? projects : projects.filter((p) => p.category === activeCategory)),
    [projects, activeCategory],
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageItems = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  function selectCategory(c: string) {
    setActiveCategory(c);
    setPage(0);
  }

  return (
    <div className="wp-list">
      <div className="wp-tabs">
        {categories.map((c) => (
          <button key={c} type="button" className={`wp-tab${c === activeCategory ? ' active' : ''}`} onClick={() => selectCategory(c)}>
            {toTitleCase(c)}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="wp-empty">No projects found in this category yet.</p>
      ) : (
        <div className="wp-cards">
          {pageItems.map((p, i) => {
            const globalIndex = safePage * PAGE_SIZE + i;
            return <ProjectMiniCard key={p.slug} project={p} reversed={globalIndex % 2 === 1} number={String(globalIndex + 1).padStart(2, '0')} />;
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="wp-pagination">
          <button type="button" className="wp-page-arrow" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={safePage === 0} aria-label="Previous page">
            <img src="/projects/arrow-prev.svg" alt="" />
          </button>
          <div className="wp-page-numbers">
            {Array.from({ length: totalPages }, (_, i) => (
              <button
                key={i}
                type="button"
                className={`wp-page-num${i === safePage ? ' active' : ''}`}
                onClick={() => setPage(i)}
                aria-current={i === safePage}
              >
                {String(i + 1).padStart(2, '0')}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="wp-page-arrow"
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={safePage === totalPages - 1}
            aria-label="Next page"
          >
            <img src="/projects/arrow-next.svg" alt="" />
          </button>
        </div>
      )}
    </div>
  );
}
