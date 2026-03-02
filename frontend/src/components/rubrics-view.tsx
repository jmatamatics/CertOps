"use client";

import { motion } from "motion/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Rubric } from "@/lib/types";

interface RubricsViewProps {
  rubrics: Rubric[];
}

export function RubricsView({ rubrics }: RubricsViewProps) {
  return (
    <div className="space-y-4">
      {rubrics.map((rubric, i) => (
        <motion.div
          key={rubric.assessment_ref}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 * i }}
        >
          <Card className="border-border/50">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-sm">{rubric.assessment_ref}</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="py-2 pr-4 text-left font-medium">
                        Criterion
                      </th>
                      <th className="py-2 px-4 text-left font-medium">
                        Novice
                      </th>
                      <th className="py-2 px-4 text-left font-medium">
                        Competent
                      </th>
                      <th className="py-2 pl-4 text-left font-medium">
                        Expert
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rubric.criteria.map((c) => (
                      <tr key={c.criterion} className="border-b last:border-0">
                        <td className="py-2 pr-4 font-medium">{c.criterion}</td>
                        <td className="py-2 px-4 text-muted-foreground">
                          {c.novice}
                        </td>
                        <td className="py-2 px-4 text-muted-foreground">
                          {c.competent}
                        </td>
                        <td className="py-2 pl-4 text-muted-foreground">
                          {c.expert}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}
