"use client";

import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import {
  GraduationCap,
  Hammer,
  FolderOpen,
  BrainCircuit,
} from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const MODES = [
  {
    key: "exemplar",
    title: "Explore Exemplar",
    description:
      "Explore pre-built certification programs with a guided walkthrough of every artifact.",
    icon: GraduationCap,
    href: "/exemplar",
    disabled: false,
  },
  {
    key: "create",
    title: "Build Your Own",
    description:
      "Upload your own documents and links to generate a fully custom certification package.",
    icon: Hammer,
    href: "/create",
    disabled: false,
  },
  {
    key: "saved",
    title: "Saved Programs",
    description:
      "Browse, view reports, and manage your saved certification programs.",
    icon: FolderOpen,
    href: "/saved",
    disabled: false,
  },
  {
    key: "assess",
    title: "Adaptive Exam",
    description:
      "AI-driven adaptive certification assessments powered by a second LangGraph agent.",
    icon: BrainCircuit,
    href: "/assess",
    disabled: false,
  },
];

export default function Home() {
  const router = useRouter();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-16">
      <motion.div
        className="mb-12 text-center"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <h1 className="text-5xl font-bold tracking-tight sm:text-6xl">
          Cert<span className="text-primary">Ops</span>
        </h1>
        <p className="mt-4 max-w-xl text-lg text-muted-foreground">
          AI-Native Certification Builder for Enterprise AI Platforms.
        </p>
      </motion.div>

      <motion.div
        className="w-full max-w-3xl"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.5 }}
      >
        <div className="grid gap-6 md:grid-cols-2">
          {MODES.map((mode, i) => {
            const Icon = mode.icon;
            return (
              <motion.div
                key={mode.key}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  delay: 0.15 * i,
                  duration: 0.5,
                  ease: "easeOut",
                }}
              >
                <Card
                  className={`group relative h-full transition-all ${
                    mode.disabled
                      ? "opacity-50 cursor-not-allowed"
                      : "cursor-pointer border-border/50 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5"
                  }`}
                  onClick={() => !mode.disabled && router.push(mode.href)}
                >
                  {mode.disabled && (
                    <Badge
                      variant="secondary"
                      className="absolute top-3 right-3 text-[10px]"
                    >
                      Coming Soon
                    </Badge>
                  )}
                  <CardHeader className="space-y-3">
                    <Icon className="h-8 w-8 text-primary/70 group-hover:text-primary transition-colors" />
                    <CardTitle className="text-xl group-hover:text-primary transition-colors">
                      {mode.title}
                    </CardTitle>
                    <CardDescription className="text-sm leading-relaxed">
                      {mode.description}
                    </CardDescription>
                  </CardHeader>
                </Card>
              </motion.div>
            );
          })}
        </div>
      </motion.div>

      <motion.p
        className="mt-12 text-xs text-muted-foreground/60"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
      >
        Powered by LangGraph &middot; OpenAI GPT-4o &middot; Qdrant &middot;
        Cohere Rerank
      </motion.p>
    </div>
  );
}
