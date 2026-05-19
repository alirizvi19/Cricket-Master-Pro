// src/components/Loading.tsx
import { Trophy } from 'lucide-react';
import { motion } from 'motion/react';

export default function Loading() {
  return (
    <div className="min-h-[40vh] flex flex-col items-center justify-center gap-4">
      <motion.div
        animate={{ rotateY: 360 }}
        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        className="w-16 h-16 bg-[#141414] rounded-sm flex items-center justify-center"
      >
        <Trophy className="text-[#F5F5F0] w-8 h-8" />
      </motion.div>
      <span className="text-xs font-mono uppercase tracking-widest animate-pulse">Initializing Pitch...</span>
    </div>
  );
}
