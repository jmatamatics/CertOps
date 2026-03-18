"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import {
  Hammer,
  Settings2,
  FlaskConical,
  Rocket,
  BarChart3,
} from "lucide-react";

const STEPS = [
  {
    number: "01",
    title: "Build",
    subtitle: "Create Certification",
    description:
      "Upload documents and links to generate a competency framework, assessments, and item bank.",
    icon: Hammer,
    href: "/create",
    color: "from-blue-500/20 to-blue-500/5",
    accent: "text-blue-400",
    ring: "group-hover:ring-blue-500/30",
    glow: "group-hover:shadow-blue-500/10",
  },
  {
    number: "02",
    title: "Configure",
    subtitle: "Customize Agent",
    description:
      "Tailor the exam agent's evaluation style, scoring thresholds, and messaging to fit your team's needs.",
    icon: Settings2,
    href: "/configure",
    color: "from-violet-500/20 to-violet-500/5",
    accent: "text-violet-400",
    ring: "group-hover:ring-violet-500/30",
    glow: "group-hover:shadow-violet-500/10",
  },
  {
    number: "03",
    title: "Test",
    subtitle: "Take the Exam",
    description:
      "Experience the adaptive exam yourself. See how questions adapt to responses and refine until it's right.",
    icon: FlaskConical,
    href: "/assess",
    color: "from-amber-500/20 to-amber-500/5",
    accent: "text-amber-400",
    ring: "group-hover:ring-amber-500/30",
    glow: "group-hover:shadow-amber-500/10",
  },
  {
    number: "04",
    title: "Deploy",
    subtitle: "Share with Learners",
    description:
      "Export reports, share exam links, and roll out certifications across your organization.",
    icon: Rocket,
    href: "/saved",
    color: "from-emerald-500/20 to-emerald-500/5",
    accent: "text-emerald-400",
    ring: "group-hover:ring-emerald-500/30",
    glow: "group-hover:shadow-emerald-500/10",
  },
  {
    number: "05",
    title: "Analyze",
    subtitle: "Learner Analytics",
    description:
      "Track pass rates, review domain proficiency, and export learner results across programs.",
    icon: BarChart3,
    href: "/results",
    color: "from-rose-500/20 to-rose-500/5",
    accent: "text-rose-400",
    ring: "group-hover:ring-rose-500/30",
    glow: "group-hover:shadow-rose-500/10",
  },
];

const spring = { type: "spring" as const, stiffness: 100, damping: 18 };

export function PipelineJourney() {
  const router = useRouter();
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  return (
    <div className="w-full max-w-4xl mx-auto">
      {/* Section label */}
      <motion.p
        className="text-xs font-medium tracking-[0.2em] uppercase text-muted-foreground/50 text-center mb-6"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.5 }}
      >
        The Pipeline
      </motion.p>

      {/* Steps container */}
      <div className="relative">
        {/* Connecting line */}
        <motion.div
          className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-px hidden md:block"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ delay: 0.8, duration: 1.2, ease: "easeInOut" }}
          style={{ originX: 0 }}
        >
          <div className="h-full w-full bg-gradient-to-r from-blue-500/30 via-violet-500/30 via-amber-500/30 via-emerald-500/30 to-rose-500/30" />
        </motion.div>

        {/* Animated glow that follows hover */}
        {hoveredIndex !== null && (
          <motion.div
            className="absolute top-1/2 -translate-y-1/2 h-px hidden md:block"
            layoutId="pipeline-glow"
            style={{
              left: 0,
              width: `${((hoveredIndex + 1) / STEPS.length) * 100}%`,
            }}
            transition={spring}
          >
            <div className="h-[2px] w-full bg-gradient-to-r from-blue-500/60 via-violet-500/60 to-current shadow-[0_0_8px_rgba(139,92,246,0.3)]" />
          </motion.div>
        )}

        {/* Steps grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 relative z-10">
          {STEPS.map((step, i) => {
            const Icon = step.icon;
            const isHovered = hoveredIndex === i;

            return (
              <motion.div
                key={step.number}
                className="group cursor-pointer h-full"
                initial={{ opacity: 0, y: 40, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{
                  delay: 0.6 + i * 0.15,
                  ...spring,
                }}
                onHoverStart={() => setHoveredIndex(i)}
                onHoverEnd={() => setHoveredIndex(null)}
                onClick={() => router.push(step.href)}
              >
                <motion.div
                  className={`relative rounded-2xl border border-border/40 bg-gradient-to-b ${step.color} p-5 transition-all ring-1 ring-transparent ${step.ring} ${step.glow} group-hover:shadow-xl h-full`}
                  whileHover={{ y: -6 }}
                  transition={spring}
                >
                  {/* Step number */}
                  <motion.span
                    className="absolute -top-3 -right-2 text-[64px] font-black leading-none text-foreground/[0.03] select-none pointer-events-none"
                    animate={isHovered ? { scale: 1.1, opacity: 0.08 } : { scale: 1, opacity: 0.03 }}
                    transition={spring}
                  >
                    {step.number}
                  </motion.span>

                  {/* Icon with animated ring */}
                  <div className="relative mb-4">
                    <motion.div
                      className={`inline-flex items-center justify-center w-10 h-10 rounded-xl bg-background/80 border border-border/50`}
                      animate={isHovered ? { scale: 1.1 } : { scale: 1 }}
                      transition={spring}
                    >
                      <Icon className={`h-5 w-5 ${step.accent} transition-colors`} />
                    </motion.div>
                    {isHovered && (
                      <motion.div
                        className={`absolute inset-0 w-10 h-10 rounded-xl`}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1.3 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.4 }}
                        style={{
                          background: `radial-gradient(circle, var(--color-primary) 0%, transparent 70%)`,
                          opacity: 0.08,
                        }}
                      />
                    )}
                  </div>

                  {/* Title */}
                  <h3 className={`text-lg font-bold tracking-tight mb-0.5 transition-colors ${isHovered ? step.accent : "text-foreground"}`}>
                    {step.title}
                  </h3>
                  <p className="text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wider mb-2">
                    {step.subtitle}
                  </p>

                  {/* Description - expands on hover */}
                  <motion.p
                    className="text-xs leading-relaxed text-muted-foreground"
                    animate={isHovered ? { opacity: 1 } : { opacity: 0.6 }}
                    transition={{ duration: 0.2 }}
                  >
                    {step.description}
                  </motion.p>

                  {/* Bottom accent bar */}
                  <motion.div
                    className={`absolute bottom-0 left-4 right-4 h-[2px] rounded-full`}
                    initial={{ scaleX: 0 }}
                    animate={isHovered ? { scaleX: 1 } : { scaleX: 0 }}
                    transition={spring}
                    style={{
                      background: `linear-gradient(to right, transparent, var(--color-primary), transparent)`,
                    }}
                  />
                </motion.div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
