import { X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { AmbientTrack, AudioSettings, SwitchProfile } from '../types/typing';
import { audioEngine } from '../utils/audioEngine';

interface AudioMixerPanelProps {
  isOpen: boolean;
  onClose: () => void;
  audioSettings: AudioSettings;
  onChange: (next: AudioSettings) => void;
}

const SWITCH_OPTIONS: { id: SwitchProfile; label: string }[] = [
  { id: 'tactile', label: 'Tactile' },
  { id: 'clicky', label: 'Clicky' },
  { id: 'thocky', label: 'Thocky' },
  { id: 'muted', label: 'Muted' },
];

const AMBIENT_TRACKS: { id: AmbientTrack; label: string }[] = [
  { id: 'rain', label: 'Rain' },
  { id: 'cafe', label: 'Cafe' },
  { id: 'brownNoise', label: 'Brown Noise' },
];

export function AudioMixerPanel({
  isOpen,
  onClose,
  audioSettings,
  onChange,
}: AudioMixerPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (target.closest('[data-audio-trigger="true"]')) return;
      if (panelRef.current && !panelRef.current.contains(target)) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    window.addEventListener('pointerdown', handlePointerDown);
    return () => {
      window.removeEventListener('keydown', handleEsc);
      window.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const setSwitchProfile = (profile: SwitchProfile) => {
    const next = { ...audioSettings, switchProfile: profile };
    onChange(next);
    if (profile !== 'muted') {
      audioEngine.playKeyClick('a', profile, audioSettings.switchVolume, false);
    }
  };

  const setSwitchVolume = (vol: number) => {
    onChange({ ...audioSettings, switchVolume: vol });
  };

  const setAmbientVolume = (track: AmbientTrack, vol: number) => {
    const nextVolumes = {
      ...audioSettings.ambientVolumes,
      [track]: vol,
    };
    const next: AudioSettings = {
      ...audioSettings,
      masterMuted: false,
      ambientVolumes: nextVolumes,
    };
    onChange(next);
    audioEngine.setMasterMuted(false);
    audioEngine.updateAmbientTrack(track, vol);
  };

  const toggleAmbientTrack = (track: AmbientTrack) => {
    const current = audioSettings.ambientVolumes[track];
    const nextVol = current > 0.01 ? 0 : 0.45;
    setAmbientVolume(track, nextVol);
  };

  const toggleMasterMute = () => {
    const nextMuted = !audioSettings.masterMuted;
    onChange({ ...audioSettings, masterMuted: nextMuted });
    audioEngine.setMasterMuted(nextMuted);
  };

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label="Sound Mixer"
      className="fixed top-18 right-6 z-50 w-84 rounded-xl p-5 shadow-lg"
      style={{
        backgroundColor: 'var(--bg-surface)',
        border: '1px solid var(--border-hairline)',
        color: 'var(--ink-primary)',
      }}
    >
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold tracking-tight">Sound Mixer</h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleMasterMute}
            className="cursor-pointer rounded-md px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-colors"
            style={{
              backgroundColor: audioSettings.masterMuted
                ? 'var(--accent)'
                : 'var(--bg-surface-alt)',
              color: audioSettings.masterMuted
                ? 'var(--accent-ink)'
                : 'var(--ink-primary)',
            }}
          >
            {audioSettings.masterMuted ? 'Unmute All' : 'Mute All'}
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close sound mixer"
            className="cursor-pointer rounded-md p-1 transition-colors"
            style={{ color: 'var(--ink-muted)' }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div
        className="space-y-4 border-t pt-4"
        style={{ borderColor: 'var(--border-hairline)' }}
      >
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span
              className="text-xs font-medium"
              style={{ color: 'var(--ink-muted)' }}
            >
              Switch Profile
            </span>
            <span
              className="font-mono-typing text-xs tabular-nums"
              style={{ color: 'var(--ink-muted)' }}
            >
              {Math.round(audioSettings.switchVolume * 100)}%
            </span>
          </div>

          <div
            className="grid grid-cols-4 gap-1 rounded-lg p-1"
            style={{ backgroundColor: 'var(--bg-surface-alt)' }}
          >
            {SWITCH_OPTIONS.map((opt) => {
              const active = audioSettings.switchProfile === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setSwitchProfile(opt.id)}
                  className="cursor-pointer rounded-md py-1.5 text-xs font-medium whitespace-nowrap transition-colors"
                  style={{
                    backgroundColor: active
                      ? 'var(--bg-surface)'
                      : 'transparent',
                    color: active ? 'var(--ink-primary)' : 'var(--ink-muted)',
                    boxShadow: active ? '0 1px 0 0 var(--keycap-lip)' : 'none',
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex items-center gap-3">
            <input
              type="range"
              min={0}
              max={1}
              step={0.02}
              value={audioSettings.switchVolume}
              onChange={(e) => setSwitchVolume(parseFloat(e.target.value))}
              aria-label="Switch click volume"
              className="flat-slider flex-1"
            />
            <button
              type="button"
              onClick={() =>
                audioEngine.playKeyClick(
                  'k',
                  audioSettings.switchProfile,
                  audioSettings.switchVolume,
                  false
                )
              }
              className="keycap-alpha cursor-pointer rounded-md px-2.5 py-1 text-xs font-medium whitespace-nowrap"
            >
              Test
            </button>
          </div>
        </div>

        <div
          className="border-t pt-4"
          style={{ borderColor: 'var(--border-hairline)' }}
        >
          <div className="mb-3">
            <span
              className="text-xs font-medium"
              style={{ color: 'var(--ink-muted)' }}
            >
              Ambient Soundscapes
            </span>
          </div>

          <div className="space-y-3">
            {AMBIENT_TRACKS.map((track) => {
              const vol = audioSettings.ambientVolumes[track.id];
              const isOn = vol > 0.01 && !audioSettings.masterMuted;
              return (
                <div key={track.id} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => toggleAmbientTrack(track.id)}
                      className="cursor-pointer text-xs font-medium whitespace-nowrap transition-colors"
                      style={{
                        color: isOn
                          ? 'var(--accent)'
                          : 'var(--ink-primary)',
                      }}
                    >
                      {track.label}
                    </button>
                    <span
                      className="font-mono-typing text-xs tabular-nums"
                      style={{ color: 'var(--ink-muted)' }}
                    >
                      {Math.round(vol * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.02}
                    value={vol}
                    onChange={(e) =>
                      setAmbientVolume(track.id, parseFloat(e.target.value))
                    }
                    aria-label={`${track.label} ambient volume`}
                    className="flat-slider w-full"
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
