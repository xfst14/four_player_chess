import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import ... from "../game/settings";
import { MenuScreen } from '../components/MenuScreen';
import { EditorScreen } from '../components/EditorScreen';
import { GameScreen } from '../components/GameScreen';

type Screen = 'menu' | 'editor' | 'game';

export default function App() {
  const [screen, setScreen] = useState<Screen>('menu');
  const [session, setSession] = useState(0);
  const [settings, setSettings] = useState<Settings>({
    seats: defaultSeats(),
    timeSec: 300,
    commandeer: true,
    kingHunt: false,
    setup: null,
  });

  return (
    <div className="min-h-screen bg-[#07080c]">
      <AnimatePresence mode="wait">
        {screen === 'menu' && (
          <motion.div key="menu" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 0.995 }} transition={{ duration: 0.35 }}>
            <MenuScreen
              settings={settings}
              setSettings={setSettings}
              onStart={() => { setSession(s => s + 1); setScreen('game'); }}
              onOpenEditor={() => setScreen('editor')}
            />
          </motion.div>
        )}

        {screen === 'editor' && (
          <motion.div key="editor" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 0.995 }} transition={{ duration: 0.35 }}>
            <EditorScreen
              initial={settings.setup}
              onSave={setup => { setSettings(s => ({ ...s, setup })); setScreen('menu'); }}
              onBack={() => setScreen('menu')}
            />
          </motion.div>
        )}

        {screen === 'game' && (
          <motion.div key={`game-${session}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 0.995 }} transition={{ duration: 0.35 }}>
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
