interface KeyDef {
  id: string;
  label: string;
  width?: string;
  kind: 'alpha' | 'mod' | 'accent';
}

const KEYBOARD_ROWS: KeyDef[][] = [
  [
    { id: 'Escape', label: 'ESC', width: 'w-12', kind: 'accent' },
    { id: '1', label: '1', width: 'w-10', kind: 'alpha' },
    { id: '2', label: '2', width: 'w-10', kind: 'alpha' },
    { id: '3', label: '3', width: 'w-10', kind: 'alpha' },
    { id: '4', label: '4', width: 'w-10', kind: 'alpha' },
    { id: '5', label: '5', width: 'w-10', kind: 'alpha' },
    { id: '6', label: '6', width: 'w-10', kind: 'alpha' },
    { id: '7', label: '7', width: 'w-10', kind: 'alpha' },
    { id: '8', label: '8', width: 'w-10', kind: 'alpha' },
    { id: '9', label: '9', width: 'w-10', kind: 'alpha' },
    { id: '0', label: '0', width: 'w-10', kind: 'alpha' },
    { id: '-', label: '-', width: 'w-10', kind: 'alpha' },
    { id: '=', label: '=', width: 'w-10', kind: 'alpha' },
    { id: 'Backspace', label: 'BKSP', width: 'w-20', kind: 'mod' },
  ],
  [
    { id: 'Tab', label: 'TAB', width: 'w-15', kind: 'mod' },
    { id: 'q', label: 'Q', width: 'w-10', kind: 'alpha' },
    { id: 'w', label: 'W', width: 'w-10', kind: 'alpha' },
    { id: 'e', label: 'E', width: 'w-10', kind: 'alpha' },
    { id: 'r', label: 'R', width: 'w-10', kind: 'alpha' },
    { id: 't', label: 'T', width: 'w-10', kind: 'alpha' },
    { id: 'y', label: 'Y', width: 'w-10', kind: 'alpha' },
    { id: 'u', label: 'U', width: 'w-10', kind: 'alpha' },
    { id: 'i', label: 'I', width: 'w-10', kind: 'alpha' },
    { id: 'o', label: 'O', width: 'w-10', kind: 'alpha' },
    { id: 'p', label: 'P', width: 'w-10', kind: 'alpha' },
    { id: '[', label: '[', width: 'w-10', kind: 'alpha' },
    { id: ']', label: ']', width: 'w-10', kind: 'alpha' },
    { id: '\\', label: '\\', width: 'w-14', kind: 'mod' },
  ],
  [
    { id: 'CapsLock', label: 'CAPS', width: 'w-18', kind: 'mod' },
    { id: 'a', label: 'A', width: 'w-10', kind: 'alpha' },
    { id: 's', label: 'S', width: 'w-10', kind: 'alpha' },
    { id: 'd', label: 'D', width: 'w-10', kind: 'alpha' },
    { id: 'f', label: 'F', width: 'w-10', kind: 'alpha' },
    { id: 'g', label: 'G', width: 'w-10', kind: 'alpha' },
    { id: 'h', label: 'H', width: 'w-10', kind: 'alpha' },
    { id: 'j', label: 'J', width: 'w-10', kind: 'alpha' },
    { id: 'k', label: 'K', width: 'w-10', kind: 'alpha' },
    { id: 'l', label: 'L', width: 'w-10', kind: 'alpha' },
    { id: ';', label: ';', width: 'w-10', kind: 'alpha' },
    { id: "'", label: "'", width: 'w-10', kind: 'alpha' },
    { id: 'Enter', label: 'ENTER', width: 'w-22', kind: 'accent' },
  ],
  [
    { id: 'ShiftLeft', label: 'SHIFT', width: 'w-24', kind: 'mod' },
    { id: 'z', label: 'Z', width: 'w-10', kind: 'alpha' },
    { id: 'x', label: 'X', width: 'w-10', kind: 'alpha' },
    { id: 'c', label: 'C', width: 'w-10', kind: 'alpha' },
    { id: 'v', label: 'V', width: 'w-10', kind: 'alpha' },
    { id: 'b', label: 'B', width: 'w-10', kind: 'alpha' },
    { id: 'n', label: 'N', width: 'w-10', kind: 'alpha' },
    { id: 'm', label: 'M', width: 'w-10', kind: 'alpha' },
    { id: ',', label: ',', width: 'w-10', kind: 'alpha' },
    { id: '.', label: '.', width: 'w-10', kind: 'alpha' },
    { id: '/', label: '/', width: 'w-10', kind: 'alpha' },
    { id: 'ShiftRight', label: 'SHIFT', width: 'w-26', kind: 'mod' },
  ],
  [
    { id: 'Control', label: 'CTRL', width: 'w-14', kind: 'mod' },
    { id: 'Meta', label: 'CMD', width: 'w-14', kind: 'mod' },
    { id: 'Alt', label: 'ALT', width: 'w-14', kind: 'mod' },
    { id: ' ', label: 'SPACE', width: 'flex-1 max-w-72', kind: 'alpha' },
    { id: 'AltRight', label: 'ALT', width: 'w-14', kind: 'mod' },
    { id: 'Fn', label: 'FN', width: 'w-14', kind: 'mod' },
    { id: 'ControlRight', label: 'CTRL', width: 'w-14', kind: 'mod' },
  ],
];

export interface KeyHeatData {
  backgroundColor?: string;
  textColor?: string;
  subLabel?: string;
  isSelected?: boolean;
}

interface TactileKeyboardProps {
  pressedKey?: string | null;
  lastErrorKey?: string | null;
  heatMap?: Record<string, KeyHeatData>;
  onKeyClick?: (keyId: string) => void;
  compact?: boolean;
}

export function TactileKeyboard({
  pressedKey = null,
  lastErrorKey = null,
  heatMap,
  onKeyClick,
  compact = false,
}: TactileKeyboardProps) {
  const normalizedPressed = pressedKey
    ? pressedKey.length === 1
      ? pressedKey.toLowerCase()
      : pressedKey
    : null;

  const isKeyMatch = (defId: string, active: string | null) => {
    if (!active) return false;
    if (defId === active) return true;
    if (active === 'Shift' && (defId === 'ShiftLeft' || defId === 'ShiftRight')) {
      return true;
    }
    return false;
  };

  return (
    <div
      className="mx-auto w-fit max-w-full overflow-x-auto rounded-2xl p-3"
      style={{
        backgroundColor: 'var(--bg-surface-alt)',
        border: '1px solid var(--border-hairline)',
        boxShadow: '0 4px 0 0 var(--keycap-lip)',
      }}
    >
      <div className="flex flex-col gap-1.5">
        {KEYBOARD_ROWS.map((row, rowIndex) => (
          <div key={rowIndex} className="flex items-center justify-center gap-1.5">
            {row.map((keyDef) => {
              const pressed = isKeyMatch(keyDef.id, normalizedPressed);
              const isError = isKeyMatch(keyDef.id, lastErrorKey);
              const heat = heatMap?.[keyDef.id];
              const baseClass =
                keyDef.kind === 'accent'
                  ? 'keycap-accent'
                  : keyDef.kind === 'mod'
                    ? 'keycap-mod'
                    : 'keycap-alpha';

              const customStyle: React.CSSProperties = {};
              if (heat?.backgroundColor && !pressed) {
                customStyle.backgroundColor = heat.backgroundColor;
              }
              if (heat?.textColor && !pressed) {
                customStyle.color = heat.textColor;
              }
              if (heat?.isSelected) {
                customStyle.outline = '2px solid var(--accent)';
                customStyle.outlineOffset = '1px';
              }
              if (pressed) {
                if (isError) {
                  customStyle.backgroundColor = 'var(--error)';
                  customStyle.color = '#FFFFFF';
                } else {
                  customStyle.backgroundColor = 'var(--accent)';
                  customStyle.color = 'var(--accent-ink)';
                }
              }

              return (
                <button
                  key={keyDef.id}
                  type="button"
                  onClick={() => onKeyClick?.(keyDef.id)}
                  tabIndex={-1}
                  className={`${baseClass} ${keyDef.width ?? 'w-10'} ${
                    compact ? 'h-9' : 'h-10'
                  } ${pressed ? 'is-pressed' : ''} relative flex cursor-pointer flex-col items-center justify-center rounded-md select-none font-mono-typing`}
                  style={customStyle}
                >
                  <span
                    className={`leading-none font-semibold ${
                      keyDef.label.length > 1 ? 'text-[10px]' : 'text-xs'
                    }`}
                  >
                    {keyDef.label}
                  </span>
                  {heat?.subLabel && (
                    <span className="mt-0.5 text-[9px] leading-none opacity-85 tabular-nums">
                      {heat.subLabel}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
