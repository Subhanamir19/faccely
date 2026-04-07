# Facial Aesthetic App - Codebase Export

This file contains the complete codebase for the facial aesthetic results screen, exported for Claude Code.

## `package.json`
```json
{
  "name": "react-example",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite --port=3000 --host=0.0.0.0",
    "build": "vite build",
    "preview": "vite preview",
    "clean": "rm -rf dist",
    "lint": "tsc --noEmit"
  },
  "dependencies": {
    "@google/genai": "^1.29.0",
    "@tailwindcss/vite": "^4.1.14",
    "@vitejs/plugin-react": "^5.0.4",
    "lucide-react": "^0.546.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "vite": "^6.2.0",
    "express": "^4.21.2",
    "dotenv": "^17.2.3",
    "motion": "^12.23.24"
  },
  "devDependencies": {
    "@types/node": "^22.14.0",
    "autoprefixer": "^10.4.21",
    "tailwindcss": "^4.1.14",
    "tsx": "^4.21.0",
    "typescript": "~5.8.2",
    "vite": "^6.2.0",
    "@types/express": "^4.17.21"
  }
}
```

## `vite.config.ts`
```typescript
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
```

## `src/index.css`
```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&display=swap');
@import "tailwindcss";

@theme {
  --font-sans: "Inter", ui-sans-serif, system-ui, sans-serif;
}

body {
  background-color: #050505;
  color: #ffffff;
  font-family: var(--font-sans);
  -webkit-font-smoothing: antialiased;
}
```

## `src/main.tsx`
```typescript
import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

## `src/App.tsx`
```typescript
import { motion, AnimatePresence } from 'motion/react';
import { useEffect, useState } from 'react';
import { Check, Target, Sparkles, AlertCircle, ChevronDown } from 'lucide-react';

const workingMetrics = [
  { name: 'Facial Symmetry', value: '94%', label: 'Optimal Balance', status: 'fine', details: 'Your facial thirds are highly proportionate. The bizygomatic width aligns perfectly with your gonial angles, creating a highly aesthetic and balanced appearance.' },
  { name: 'Canthal Tilt', value: '+4°', label: 'Positive Angle', status: 'fine', details: 'A positive canthal tilt of 4 degrees is considered highly attractive, giving the eyes a sharp, alert, and striking "hunter" appearance.' },
  { name: 'Jawline Definition', value: 'Sharp', label: 'Strong Structure', status: 'fine', details: 'Excellent masseter development and low body fat in the lower third contribute to a sharply defined, chiseled jawline.' },
  { name: 'Cheekbone Prominence', value: 'High', label: 'Striking Features', status: 'fine', details: 'High-set zygomatic bones provide excellent mid-face support, creating the coveted hollow cheek effect under specific lighting.' },
  { name: 'Skin Clarity', value: '98%', label: 'Clear Complexion', status: 'fine', details: 'Exceptional skin clarity with minimal blemishes. Your current skincare routine is maintaining an excellent moisture barrier.' },
];

const attentionMetrics = [
  { name: 'Under-eye Support', value: 'Mild', label: 'Slight Hollows', status: 'neutral', details: 'Slight lack of infraorbital support leading to mild shadowing. Consider lymphatic drainage massage or adjusting sleep quality.' },
  { name: 'Brow Density', value: 'Sparse', label: 'Thinning Ends', status: 'neutral', details: 'The lateral ends of the eyebrows lack density. Minoxidil or castor oil application could encourage thicker, more dominant brows.' },
  { name: 'Lip Hydration', value: 'Low', label: 'Dry Texture', status: 'alarming', details: 'Visible dryness and micro-fissures on the vermilion border. Increase daily water intake and apply a ceramide-based lip treatment.' },
  { name: 'Nasolabial Folds', value: 'Visible', label: 'Deep Lines', status: 'alarming', details: 'Pronounced lines around the mouth area. This can be improved with targeted facial exercises (like cheek lifters) and retinoid application.' },
  { name: 'Skin Texture', value: 'Uneven', label: 'Enlarged Pores', status: 'alarming', details: 'Noticeable pore enlargement in the T-zone. Incorporating a BHA (salicylic acid) exfoliant 2-3 times a week will help refine texture.' },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.12,
      delayChildren: 0.2,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  visible: { 
    opacity: 1, 
    y: 0,
    scale: 1,
    transition: { duration: 0.5, type: "spring", bounce: 0.4 }
  },
};

const getPillStyle = (status: string) => {
  switch(status) {
    case 'fine': return 'bg-[#B4F06A] border-[#8ECA45] text-[#2D3B1F]';
    case 'neutral': return 'bg-[#F5F5F5] border-[#E0E0E0] text-[#1A1A1A]';
    case 'alarming': return 'bg-[#FF6B6B] border-[#D94A4A] text-[#4A1111]';
    default: return 'bg-[#F5F5F5] border-[#E0E0E0] text-[#1A1A1A]';
  }
};

const getIcon = (status: string) => {
  switch(status) {
    case 'fine': return <Sparkles className="w-6 h-6 text-[#B4F06A] opacity-80" />;
    case 'neutral': return <Target className="w-6 h-6 text-[#A0A0A0] opacity-80" />;
    case 'alarming': return <AlertCircle className="w-6 h-6 text-[#FF6B6B] opacity-80" />;
    default: return <Target className="w-6 h-6 text-[#A0A0A0] opacity-80" />;
  }
};

function MetricCard({ metric, variants }: { metric: any, variants: any }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <motion.div 
      variants={variants}
      className="flex flex-col p-3.5 bg-[#1A1A1A] rounded-[24px] border-b-[6px] border-[#0A0A0A] transition-all"
    >
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between cursor-pointer group select-none"
      >
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-[16px] bg-[#222222] border-b-[4px] border-[#111111] flex items-center justify-center flex-shrink-0 group-active:translate-y-[2px] group-active:border-b-[2px] transition-all duration-100">
            {getIcon(metric.status)}
          </div>
          <div className="flex flex-col justify-center">
            <span className="text-white font-bold text-[16px] leading-tight mb-0.5">{metric.name}</span>
            <span className="text-[#808080] font-bold text-[13px]">{metric.label}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className={`border-b-[4px] rounded-full h-10 min-w-[3rem] px-4 flex items-center justify-center font-extrabold text-[14px] shadow-sm group-active:translate-y-[2px] group-active:border-b-[2px] transition-all duration-100 ${getPillStyle(metric.status)}`}>
            {metric.value}
          </div>
          <motion.div
            animate={{ rotate: isOpen ? 180 : 0 }}
            transition={{ duration: 0.4, type: "spring", bounce: 0.3 }}
            className="text-[#606060] mr-1 group-hover:text-[#A0A0A0] transition-colors"
          >
            <ChevronDown className="w-5 h-5" />
          </motion.div>
        </div>
      </div>
      
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.4, type: "spring", bounce: 0.2 }}
            className="overflow-hidden"
          >
            <div className="pt-4 pb-1 px-1">
              <div className="p-4 bg-[#222222] rounded-[16px] border-b-[3px] border-[#111111]">
                <p className="text-[#A0A0A0] text-[13.5px] leading-relaxed font-medium">
                  {metric.details}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function App() {
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setIsLoaded(true);
  }, []);

  if (!isLoaded) return null;

  return (
    <div className="min-h-screen bg-black flex flex-col items-center py-12 px-4 md:px-8 font-sans selection:bg-white/20">
      <div className="w-full max-w-md mx-auto">
        
        {/* Top Bar matching the screenshot style */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 mb-6"
        >
          <div className="bg-[#1A1A1A] border-b-[3px] border-[#0A0A0A] rounded-full px-4 py-1.5 flex items-center gap-2">
            <span className="text-orange-500 text-sm">🔥</span>
            <span className="text-white font-extrabold text-sm">98</span>
          </div>
          <div className="flex items-center gap-2 text-gray-400 font-bold text-[11px] tracking-widest uppercase">
            <span className="w-2 h-2 rounded-full bg-[#B4F06A]"></span>
            Analysis Results
          </div>
        </motion.div>

        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="text-[#A0A0A0] text-[15px] font-medium leading-relaxed mb-8"
        >
          A balanced aesthetic breakdown to highlight your striking features, and identify areas for structural improvement and refinement.
        </motion.p>

        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="flex items-center gap-4 mb-10"
        >
          <div className="flex-1 h-1.5 bg-[#1A1A1A] rounded-full overflow-hidden">
            <div className="h-full w-1/2 bg-[#B4F06A] rounded-full"></div>
          </div>
          <span className="text-gray-500 font-bold text-sm">5 / 10</span>
        </motion.div>

        <div className="space-y-10">
          {/* What's Working Section */}
          <section>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="flex justify-between items-end mb-4 px-1"
            >
              <h2 className="text-white font-extrabold text-xl">Strengths</h2>
              <span className="text-gray-500 font-bold text-sm">5 items</span>
            </motion.div>
            
            <motion.div 
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="space-y-3"
            >
              {workingMetrics.map((metric) => (
                <MetricCard key={metric.name} metric={metric} variants={itemVariants} />
              ))}
            </motion.div>
          </section>

          {/* Needs Attention Section */}
          <section>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
              className="flex justify-between items-end mb-4 px-1"
            >
              <h2 className="text-white font-extrabold text-xl">Focus Areas</h2>
              <span className="text-gray-500 font-bold text-sm">5 items</span>
            </motion.div>
            
            <motion.div 
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="space-y-3"
            >
              {attentionMetrics.map((metric) => (
                <MetricCard key={metric.name} metric={metric} variants={itemVariants} />
              ))}
            </motion.div>
          </section>
        </div>
      </div>
    </div>
  );
}
```
