"use client";

import { motion } from "motion/react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CompetencyFramework } from "@/lib/types";

interface FrameworkViewProps {
  framework: CompetencyFramework;
}

export function FrameworkView({ framework }: FrameworkViewProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h3 className="text-lg font-semibold">
          {framework.track}
        </h3>
        <p className="text-sm text-muted-foreground">{framework.description}</p>
      </div>

      <Accordion type="multiple" className="space-y-2">
        {framework.domains.map((domain, i) => (
          <motion.div
            key={domain.name}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 * i }}
          >
            <AccordionItem value={domain.name} className="border rounded-lg px-1">
              <AccordionTrigger className="px-3 hover:no-underline">
                <div className="flex items-center gap-3">
                  <span className="font-medium">{domain.name}</span>
                  <Badge variant="outline" className="text-xs">
                    {domain.skills.length} skills
                  </Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-3 pb-4">
                <p className="mb-3 text-sm text-muted-foreground">
                  {domain.description}
                </p>
                <div className="grid gap-3 md:grid-cols-2">
                  {domain.skills.map((skill) => (
                    <Card key={skill.name} className="border-border/50">
                      <CardHeader className="p-3 pb-1">
                        <CardTitle className="text-sm">{skill.name}</CardTitle>
                      </CardHeader>
                      <CardContent className="p-3 pt-0">
                        <p className="mb-2 text-xs text-muted-foreground">
                          {skill.description}
                        </p>
                        <div className="flex gap-1">
                          {skill.proficiency_levels.map((lvl, j) => (
                            <Badge
                              key={j}
                              variant="secondary"
                              className="text-[10px]"
                            >
                              {lvl}
                            </Badge>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          </motion.div>
        ))}
      </Accordion>
    </div>
  );
}
