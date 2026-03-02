"use client";

import { motion } from "motion/react";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { TRACKS, type TrackInfo } from "@/lib/types";

interface TrackSelectorProps {
  onSelect: (track: TrackInfo) => void;
}

export function TrackSelector({ onSelect }: TrackSelectorProps) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      {TRACKS.map((track, i) => (
        <motion.div
          key={track.key}
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 * i, duration: 0.5, ease: "easeOut" }}
        >
          <Card
            className="group cursor-pointer border-border/50 transition-all hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5"
            onClick={() => onSelect(track)}
          >
            <CardHeader className="space-y-3">
              <CardTitle className="text-xl group-hover:text-primary transition-colors">
                {track.name}
              </CardTitle>
              <CardDescription className="text-sm leading-relaxed">
                {track.description}
              </CardDescription>
            </CardHeader>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}
