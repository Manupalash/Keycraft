import { Volume2, VolumeX } from 'lucide-react';
import { AudioSettings, NavTab } from '../types/typing';

interface TopBarProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  audioSettings: AudioSettings;
  isAudioPanelOpen: boolean;
  onToggleAudioPanel: () => void;
  isFocusDimmed?: boolean;
}

export function TopBar({
  activeTab,
  onSelectTab,
  audioSettings,
  isAudioPanelOpen,
  onToggleAudioPanel,
  isFocusDimmed = false,
}: TopBarProps) {
  const activeAmbients = (
    Object.entries(audioSettings.ambientVolumes) as [string, number][]
  ).filter(([, vol]) => vol > 0.01);

  const isMuted = audioSettings.masterMuted;
  const soundLabel = isMuted
    ? 'Muted'
    : activeAmbients.length > 0
      ? `Sound · ${activeAmbients.length} Ambient`
      : 'Sound';

  return (
    <header
      className={`w-full border-b transition-opacity duration-200 ${
        isFocusDimmed ? 'opacity-40 hover:opacity-100' : 'opacity-100'
      }`}
      style={{
        borderColor: 'var(--border-hairline)',
        backgroundColor: 'var(--bg-canvas)',
      }}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-8 px-6 py-4">
        <button
          type="button"
          onClick={() => onSelectTab('practice')}
          className="cursor-pointer text-lg font-bold tracking-tight whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4"
          style={{
            color: 'var(--ink-primary)',
            outlineColor: 'var(--accent)',
          }}
        >
          Keycraft
        </button>

        <nav className="flex items-center gap-7" aria-label="Primary navigation">
          {(
            [
              { id: 'practice', label: 'Practice' },
              { id: 'analytics', label: 'Analytics' },
              { id: 'themes', label: 'Themes' },
            ] as { id: NavTab; label: string }[]
          ).map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                className="relative cursor-pointer py-1 text-sm font-medium whitespace-nowrap shrink-0 transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-4"
                style={{
                  color: isActive ? 'var(--ink-primary)' : 'var(--ink-muted)',
                  outlineColor: 'var(--accent)',
                }}
              >
                {item.label}
                {isActive && (
                  <span
                    className="absolute right-0 bottom-0 left-0 h-0.5"
                    style={{ backgroundColor: 'var(--accent)' }}
                    aria-hidden="true"
                  />
                )}
              </button>
            );
          })}
        </nav>

        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={onToggleAudioPanel}
            aria-expanded={isAudioPanelOpen}
            className="flex cursor-pointer items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold whitespace-nowrap shrink-0 transition-transform duration-150 active:translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{
              backgroundColor: isAudioPanelOpen
                ? 'var(--accent)'
                : 'var(--bg-surface)',
              color: isAudioPanelOpen
                ? 'var(--accent-ink)'
                : 'var(--ink-primary)',
              border: `1px solid ${
                isAudioPanelOpen
                  ? 'var(--keycap-accent-lip)'
                  : 'var(--border-hairline)'
              }`,
              boxShadow: isAudioPanelOpen
                ? '0 2px 0 0 var(--keycap-accent-lip)'
                : '0 2px 0 0 var(--keycap-lip)',
              outlineColor: 'var(--accent)',
            }}
          >
            {isMuted ? (
              <VolumeX className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            ) : (
              <Volume2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            )}
            <span>{soundLabel}</span>
          </button>
        </div>
      </div>
    </header>
  );
}
