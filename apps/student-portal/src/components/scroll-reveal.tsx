'use client';

import { motion, type HTMLMotionProps } from 'motion/react';

interface ScrollRevealProps extends Omit<HTMLMotionProps<'div'>, 'initial' | 'whileInView'> {
  delay?: number;
  duration?: number;
  yOffset?: number;
  amount?: number;
}

export function ScrollReveal({
  children,
  delay = 0,
  duration = 0.5,
  yOffset = 24,
  amount = 0.2,
  ...rest
}: ScrollRevealProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: yOffset }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount }}
      transition={{ duration, delay, ease: [0.16, 1, 0.3, 1] }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}
