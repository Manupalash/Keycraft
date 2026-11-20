import { useCallback, useEffect, useState } from 'react';
import { AudioMixerPanel } from './components/AudioMixerPanel';
import { AnalyticsView } from './components/AnalyticsView';
import { PracticeView } from './components/PracticeView';
import { ThemesView } from './components/ThemesView';
import { TopBar } from './components/TopBar';
import { applyThemeTokens, getThemeById } from './data/themes';
import {
  AppSettings,
  KeyStat,
  NavTab,
  SessionRecord,
} from './types/typing';
import { audioEngine } from './utils/audioEngine';
import {
  clearHistoryStorage,
  loadHistory,
  loadKeyStats,
  loadSettings,
  mergeKeyStats,
  saveSession,
  saveSettings,
} from './utils/storage';

export default function App() {
  const [activeTab, setActiveTab] = useState<NavTab>('practice');
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());
  const [history, setHistory] = useState<SessionRecord[]>(() => loadHistory());
  const [keyStats, setKeyStats] = useState<Record<string, KeyStat>>(() =>
    loadKeyStats()
  );
  const [isAudioPanelOpen, setIsAudioPanelOpen] = useState(false);
  const [isTypingRunning, setIsTypingRunning] = useState(false);

  // Sync theme CSS variables immediately
  useEffect(() => {
    const theme = getThemeById(settings.themeId);
    applyThemeTokens(theme);
  }, [settings.themeId]);

  // Persist settings updates
  const handleUpdateSettings = useCallback((next: AppSettings) => {
    setSettings(next);
    saveSettings(next);
  }, []);

  // Sync ambient audio on first interaction if saved volumes were non-zero
  useEffect(() => {
    const unlockAmbient = () => {
      audioEngine.syncAmbientState(
        settings.audio.ambientVolumes,
        settings.audio.masterMuted
      );
      window.removeEventListener('pointerdown', unlockAmbient);
      window.removeEventListener('keydown', unlockAmbient);
    };
    window.addEventListener('pointerdown', unlockAmbient, { once: true });
    window.addEventListener('keydown', unlockAmbient, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlockAmbient);
      window.removeEventListener('keydown', unlockAmbient);
    };
  }, [settings.audio.ambientVolumes, settings.audio.masterMuted]);

  const handleSessionComplete = useCallback(
    (
      session: SessionRecord,
      keyDelta: Record<string, { presses: number; errors: number; totalLatencyMs: number }>
    ) => {
      const updatedHistory = saveSession(session);
      const updatedKeys = mergeKeyStats(keyDelta);
      setHistory(updatedHistory);
      setKeyStats(updatedKeys);
    },
    []
  );

  const handleClearHistory = useCallback(() => {
    clearHistoryStorage();
    setHistory([]);
    setKeyStats({});
  }, []);

  const bestWpm = history.reduce((max, item) => Math.max(max, item.wpm), 0);

  return (
    <div
      className="min-h-screen"
      style={{
        backgroundColor: 'var(--bg-canvas)',
        color: 'var(--ink-primary)',
      }}
    >
      <TopBar
        activeTab={activeTab}
        onSelectTab={(tab) => {
          setActiveTab(tab);
          setIsAudioPanelOpen(false);
        }}
        audioSettings={settings.audio}
        isAudioPanelOpen={isAudioPanelOpen}
        onToggleAudioPanel={() => setIsAudioPanelOpen((o) => !o)}
        isFocusDimmed={activeTab === 'practice' && isTypingRunning}
      />

      <AudioMixerPanel
        isOpen={isAudioPanelOpen}
        onClose={() => setIsAudioPanelOpen(false)}
        audioSettings={settings.audio}
        onChange={(nextAudio) =>
          handleUpdateSettings({ ...settings, audio: nextAudio })
        }
      />

      <main className="mx-auto max-w-6xl px-6 py-6">
        {activeTab === 'practice' && (
          <PracticeView
            settings={settings}
            onUpdateSettings={handleUpdateSettings}
            isAudioPanelOpen={isAudioPanelOpen}
            bestWpm={bestWpm}
            onSessionComplete={handleSessionComplete}
            onRunningChange={setIsTypingRunning}
          />
        )}

        {activeTab === 'analytics' && (
          <AnalyticsView
            history={history}
            keyStats={keyStats}
            themeId={settings.themeId}
            onClearHistory={handleClearHistory}
            onGoToPractice={() => setActiveTab('practice')}
          />
        )}

        {activeTab === 'themes' && (
          <ThemesView
            settings={settings}
            onUpdateSettings={handleUpdateSettings}
          />
        )}
      </main>
    </div>
  );
}
