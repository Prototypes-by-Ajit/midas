"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { PlayCircle, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DEMO_VIDEO_URL } from "@/data/home/site";

type TriggerProps = React.ComponentProps<typeof Button>;

/**
 * Button plus its own demo-video modal. Replaces the near-identical blocks that
 * lived in contact/page.tsx and learn-more/page.tsx.
 *
 * The trigger owns its state deliberately. learn-more has three trigger sites
 * that land in three different sections after the split; lifting the state to a
 * common parent would mean prop-drilling a callback through three of eight
 * sections to serve a modal only one of which is ever open.
 */
export function DemoVideoTrigger({ children, ...buttonProps }: TriggerProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button {...buttonProps} onClick={() => setOpen(true)}>
        {children}
      </Button>
      {open && <DemoVideoModal onClose={() => setOpen(false)} />}
    </>
  );
}

function DemoVideoModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="relative w-full max-w-5xl max-h-[90vh]"
      >
        <div className="absolute -top-10 sm:-top-12 right-0 z-10">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-white hover:bg-white/10 rounded-full h-8 w-8 sm:h-10 sm:w-10 p-0"
          >
            <X className="h-5 w-5 sm:h-6 sm:w-6" />
          </Button>
        </div>

        <Card className="bg-white dark:bg-black border border-gray-200 dark:border-gray-800 overflow-hidden">
          <CardContent className="p-0">
            {DEMO_VIDEO_URL ? (
              <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
                <iframe
                  src={DEMO_VIDEO_URL}
                  className="absolute top-0 left-0 w-full h-full"
                  title="MIDAS Demo Video"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-8 sm:p-12 md:p-16 lg:p-24 text-center">
                <div className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 bg-black/10 dark:bg-white/10 rounded-full flex items-center justify-center mb-6 sm:mb-8">
                  <PlayCircle className="h-8 w-8 sm:h-10 sm:w-10 md:h-12 md:w-12 text-black dark:text-white" />
                </div>
                <h3 className="text-2xl sm:text-3xl font-bold mb-3 sm:mb-4 text-black dark:text-white">
                  Demo Posting Soon
                </h3>
                <p className="text-base sm:text-lg text-gray-600 dark:text-gray-300 max-w-md mb-6 sm:mb-8 px-4">
                  We&apos;re preparing an exciting demo video to showcase MIDAS in action. Check
                  back soon!
                </p>
                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 w-full sm:w-auto px-4 sm:px-0">
                  <Button
                    onClick={onClose}
                    className="bg-black text-white hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200 w-full sm:w-auto"
                  >
                    Close
                  </Button>
                  <Link href="/contact" className="w-full sm:w-auto">
                    <Button
                      variant="outline"
                      className="border-black text-black hover:bg-black hover:text-white dark:border-white dark:text-white dark:hover:bg-white dark:hover:text-black w-full"
                    >
                      Request a Live Demo
                    </Button>
                  </Link>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
