import { THEMES } from '../data/themes';
import { AppSettings, CaretStyle, FontSizeOption, ThemeId } from '../types/typing';

interface ThemesViewProps {
  settings: AppSettings;
  onUpdateSettings: (next: AppSettings) => void;
}

export function ThemesView({ settings, onUpdateSettings }: ThemesViewProps) {
  const selectTheme = (themeId: ThemeId) => {
    onUpdateSettings({ ...settings, themeId });
  };

  const setCaretStyle = (caretStyle: CaretStyle) => {
    onUpdateSettings({ ...settings, caretStyle });
  };

  const setFontSize = (fontSize: FontSizeOption) => {
    onUpdateSettings({ ...settings, fontSize });
  };

  const toggleKeyboard = () => {
    onUpdateSettings({ ...settings, showKeyboard: !settings.showKeyboard });
  };

  const previewFontClass =
    settings.fontSize === 'sm'
      ? 'text-lg'
      : settings.fontSize === 'lg'
        ? 'text-2xl'
        : 'text-xl';

  return (
    <div className="mx-auto max-w-5xl space-y-10 py-6">
      <h1 className="text-2xl font-bold tracking-tight">Themes</h1>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {THEMES.map((theme) => {
          const isSelected = settings.themeId === theme.id;
          return (
            <button
              key={theme.id}
              type="button"
              onClick={() => selectTheme(theme.id)}
              className="flex cursor-pointer flex-col justify-between rounded-2xl p-5 text-left transition-transform duration-150 active:translate-y-0.5"
              style={{
                backgroundColor: theme.tokens.bgCanvas,
                color: theme.tokens.inkPrimary,
                border: isSelected
                  ? `2px solid ${theme.tokens.accent}`
                  : `1px solid ${theme.tokens.borderHairline}`,
              }}
            >
              <div className="mb-5 flex items-center justify-between">
                <span className="text-base font-semibold tracking-tight">
                  {theme.name}
                </span>
                {isSelected && (
                  <span
                    className="text-xs font-semibold"
                    style={{ color: theme.tokens.accent }}
                  >
                    Active
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <span
                  className="font-mono-typing flex h-10 w-10 items-center justify-center rounded-md text-xs font-semibold"
                  style={{
                    backgroundColor: theme.tokens.accent,
                    color: theme.tokens.accentInk,
                    border: `1px solid ${theme.tokens.keycapAccentLip}`,
                    boxShadow: `0 3px 0 0 ${theme.tokens.keycapAccentLip}`,
                  }}
                >
                  ESC
                </span>
                <span
                  className="font-mono-typing flex h-10 w-10 items-center justify-center rounded-md text-xs font-semibold"
                  style={{
                    backgroundColor: theme.tokens.bgSurface,
                    color: theme.tokens.inkPrimary,
                    border: `1px solid ${theme.tokens.borderHairline}`,
                    boxShadow: `0 3px 0 0 ${theme.tokens.keycapLip}`,
                  }}
                >
                  A
                </span>
                <span
                  className="font-mono-typing flex h-10 w-10 items-center justify-center rounded-md text-xs font-semibold"
                  style={{
                    backgroundColor: theme.tokens.bgSurface,
                    color: theme.tokens.inkPrimary,
                    border: `1px solid ${theme.tokens.borderHairline}`,
                    boxShadow: `0 3px 0 0 ${theme.tokens.keycapLip}`,
                  }}
                >
                  S
                </span>
                <span
                  className="font-mono-typing flex h-10 flex-1 items-center justify-center rounded-md text-xs font-semibold"
                  style={{
                    backgroundColor: theme.tokens.bgSurfaceAlt,
                    color: theme.tokens.inkPrimary,
                    border: `1px solid ${theme.tokens.borderHairline}`,
                    boxShadow: `0 3px 0 0 ${theme.tokens.keycapLip}`,
                  }}
                >
                  RETURN
                </span>
              </div>
            </button>
          );
        })}
      </div>

      <section
        className="rounded-2xl p-6"
        style={{
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-hairline)',
        }}
      >
        <h2 className="mb-5 text-base font-semibold tracking-tight">
          Canvas Preferences
        </h2>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          <div>
            <div
              className="mb-2 text-xs font-medium"
              style={{ color: 'var(--ink-muted)' }}
            >
              Caret Style
            </div>
            <div
              className="grid grid-cols-3 gap-1 rounded-lg p-1"
              style={{ backgroundColor: 'var(--bg-surface-alt)' }}
            >
              {(
                [
                  { id: 'line', label: 'Line' },
                  { id: 'block', label: 'Block' },
                  { id: 'underline', label: 'Bar' },
                ] as { id: CaretStyle; label: string }[]
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setCaretStyle(opt.id)}
                  className="cursor-pointer rounded-md py-1.5 text-xs font-medium whitespace-nowrap"
                  style={{
                    backgroundColor:
                      settings.caretStyle === opt.id
                        ? 'var(--bg-surface)'
                        : 'transparent',
                    color:
                      settings.caretStyle === opt.id
                        ? 'var(--ink-primary)'
                        : 'var(--ink-muted)',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div
              className="mb-2 text-xs font-medium"
              style={{ color: 'var(--ink-muted)' }}
            >
              Type Size
            </div>
            <div
              className="grid grid-cols-3 gap-1 rounded-lg p-1"
              style={{ backgroundColor: 'var(--bg-surface-alt)' }}
            >
              {(
                [
                  { id: 'sm', label: 'Small' },
                  { id: 'md', label: 'Medium' },
                  { id: 'lg', label: 'Large' },
                ] as { id: FontSizeOption; label: string }[]
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setFontSize(opt.id)}
                  className="cursor-pointer rounded-md py-1.5 text-xs font-medium whitespace-nowrap"
                  style={{
                    backgroundColor:
                      settings.fontSize === opt.id
                        ? 'var(--bg-surface)'
                        : 'transparent',
                    color:
                      settings.fontSize === opt.id
                        ? 'var(--ink-primary)'
                        : 'var(--ink-muted)',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div
              className="mb-2 text-xs font-medium"
              style={{ color: 'var(--ink-muted)' }}
            >
              On-Screen Keyboard
            </div>
            <button
              type="button"
              onClick={toggleKeyboard}
              className="keycap-alpha w-full cursor-pointer rounded-lg py-2 text-xs font-semibold whitespace-nowrap"
            >
              {settings.showKeyboard ? 'Visible' : 'Hidden'}
            </button>
          </div>
        </div>

        <div
          className="mt-6 border-t pt-5"
          style={{ borderColor: 'var(--border-hairline)' }}
        >
          <div
            className="mb-2 text-xs font-medium"
            style={{ color: 'var(--ink-muted)' }}
          >
            Preview
          </div>
          <div className={`font-mono-typing leading-relaxed ${previewFontClass}`}>
            <span style={{ color: 'var(--ink-primary)' }}>steady rhythm </span>
            <span className="relative inline-block">
              {settings.caretStyle === 'line' && (
                <span
                  className="absolute top-0.5 bottom-0.5 left-0 w-0.5"
                  style={{ backgroundColor: 'var(--accent)' }}
                />
              )}
              {settings.caretStyle === 'block' && (
                <span
                  className="inline-block px-0.5"
                  style={{
                    backgroundColor: 'var(--accent)',
                    color: 'var(--accent-ink)',
                  }}
                >
                  f
                </span>
              )}
              {settings.caretStyle === 'underline' && (
                <span
                  className="inline-block border-b-2"
                  style={{
                    borderColor: 'var(--accent)',
                    color: 'var(--ink-primary)',
                  }}
                >
                  f
                </span>
              )}
              {settings.caretStyle === 'line' && (
                <span style={{ color: 'var(--ink-upcoming)' }}>f</span>
              )}
            </span>
            <span style={{ color: 'var(--ink-upcoming)' }}>ocuses the mind</span>
          </div>
        </div>
      </section>
    </div>
  );
}
