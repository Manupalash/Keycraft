import { useCallback, useEffect, useState } from 'react';
import { AudioMixerPanel } from './components/AudioMixerPanel';
import { AnalyticsView } from './components/AnalyticsView';
import { DrillRequest, PracticeView } from './components/PracticeView';
import { ThemesView } from './components/ThemesView';
import { TopBar } from './components/TopBar';
import { applyThemeTokens, getThemeById } from './data/themes';
import {
  AppSettings,
  DailyStreakData,
  KeyStat,
  NavTab,
  SessionRecord,
} from './types/typing';
import { audioEngine } from './utils/audioEngine';
import {
  clearHistoryStorage,
  loadDailyStreak,
  loadHistory,
  loadKeyStats,
  loadSettings,
  mergeKeyStats,
  recordPracticeDay,
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
  const [dailyStreak, setDailyStreak] = useState<DailyStreakData>(() =>
    loadDailyStreak()
  );
  const [drillRequest, setDrillRequest] = useState<DrillRequest | null>(null);
  const [isAudioPanelOpen, setIsAudioPanelOpen] = useState(false);
  const [isTypingRunning, setIsTypingRunning] = useState(false);

  // Sync theme CSS variables immediately
  useEffect(() => {
    const theme = getThemeById(settings.themeId);
    applyThemeTokens(theme);
  }, [settings.themeId]);

  // Keep AudioEngine desired volumes synced without re-registering gesture listeners
  useEffect(() => {
    audioEngine.configureDesiredState(
      settings.audio.ambientVolumes,
      settings.audio.masterMuted
    );
  }, [settings.audio.ambientVolumes, settings.audio.masterMuted]);

  // Unlock AudioContext once on first user gesture
  useEffect(() => {
    const unlock = () => {
      audioEngine.unlockFromGesture();
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  const handleUpdateSettings = useCallback((next: AppSettings) => {
    setSettings(next);
    saveSettings(next);
  }, []);

  const handleSessionComplete = useCallback(
    (
      session: SessionRecord,
      keyDelta: Record<
        string,
        { presses: number; errors: number; totalLatencyMs: number }
      >
    ) => {
      const updatedHistory = saveSession(session);
      const updatedKeys = mergeKeyStats(keyDelta);
      const updatedStreak = recordPracticeDay();
      setHistory(updatedHistory);
      setKeyStats(updatedKeys);
      setDailyStreak(updatedStreak);
    },
    []
  );

  const handleClearHistory = useCallback(() => {
    clearHistoryStorage();
    setHistory([]);
    setKeyStats({});
    setDailyStreak(loadDailyStreak());
  }, []);

  const handleLaunchWeakDrill = useCallback((keys: string[]) => {
    setDrillRequest({ keys, nonce: Date.now() });
    setActiveTab('practice');
    setIsAudioPanelOpen(false);
  }, []);

  const handleConsumeDrillRequest = useCallback(() => {
    setDrillRequest(null);
  }, []);

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
            history={history}
            keyStats={keyStats}
            dailyStreak={dailyStreak}
            drillRequest={drillRequest}
            onConsumeDrillRequest={handleConsumeDrillRequest}
            onSessionComplete={handleSessionComplete}
            onRunningChange={setIsTypingRunning}
          />
        )}

        {activeTab === 'analytics' && (
          <AnalyticsView
            history={history}
            keyStats={keyStats}
            dailyStreak={dailyStreak}
            themeId={settings.themeId}
            onClearHistory={handleClearHistory}
            onGoToPractice={() => setActiveTab('practice')}
            onDrillKeys={handleLaunchWeakDrill}
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
