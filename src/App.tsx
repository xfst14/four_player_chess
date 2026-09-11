// src/App.tsx
import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { defaultSettings, type Settings } from './game/settings';
import { MenuScreen } from './components/MenuScreen';
// FIX: default exports — not named
import EditorScreen from './components/EditorScreen';
import GameScreen from './components/GameScreen';

type Screen = 'menu' | 'editor' | 'game';

export default function App() {
  const [screen, setScreen] = useState<Screen>('menu');
  const [session, setSession] = useState(0);
  // If defaultSettings is a function in settings.ts, call it:
  const [settings, setSettings] = useState<Settings>(() =>
    typeof defaultSettings === 'function'
      ? (defaultSettings as () => Settings)()
      : (defaultSettings as Settings),
  );
  // Prefer the simple form once settings.ts is cleaned up:
  // const [settings, setSettings] = useState<Settings>(defaultSettings);        // const object
  // const [settings, setSettings] = useState<Settings>(() => defaultSettings()); // factory fn

  return (
    <div className="min-h-screen bg-[#07080c] text-slate-100 selection:bg-amber-300/30">
      <AnimatePresence mode="wait">
        {screen === 'menu' && (
          <motion.div
            key="menu"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.995 }}
            transition={{ duration: 0.35 }}
          >
            <MenuScreen
              settings={settings}
              setSettings={setSettings}
              onStart={() => {
                setSession(s => s + 1);
                setScreen('game');
              }}
              onOpenEditor={() => setScreen('editor')}
            />
          </motion.div>
        )}

        {screen === 'editor' && (
          <motion.div
            key="editor"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.995 }}
            transition={{ duration: 0.35 }}
          >
            <EditorScreen
              initial={settings.setup}
              onSave={setup => {
                setSettings(s => ({ ...s, setup }));
                setScreen('menu');
              }}
              onBack={() => setScreen('menu')}
            />
          </motion.div>
        )}

        {screen === 'game' && (
          <motion.div
            key={`game-${session}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.995 }}
            transition={{ duration: 0.35 }}
          >
            <GameScreen
              settings={settings}
              onRestart={() => setSession(s => s + 1)}
              onExit={() => setScreen('menu')}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
