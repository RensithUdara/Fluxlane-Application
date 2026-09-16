import { FONT_UI, TITLE_BAR_HEIGHT, pillStyle } from '../theme'

export type TitleBarStatus =
  | { kind: 'none' }
  | { kind: 'merged'; networkCount: number }
  | { kind: 'paused'; networkCount: number }
  | { kind: 'offline' }

const isMac = window.fluxlane.platform === 'darwin'

export function TitleBar({ status }: { status: TitleBarStatus }): React.JSX.Element {
  const dimmed = status.kind === 'offline'

  return (
    <div
      style={{
        height: TITLE_BAR_HEIGHT,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        gap: 13,
        padding: `0 14px 0 ${isMac ? 94 : 14}px`,
        background: 'var(--bg-secondary)',
        borderBottom: '0.5px solid var(--border)',
        boxShadow: '0 1px 0 var(--border-subtle)',
        WebkitAppRegion: 'drag'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div
          style={{
            width: 22,
            height: 22,
            borderRadius: 6,
            background: dimmed ? 'var(--track-bg)' : 'var(--color-accent-bg)',
            border: `0.5px solid ${dimmed ? 'var(--border-strong)' : 'var(--color-accent-border)'}`,
            boxShadow: dimmed ? 'none' : '0 6px 16px var(--color-accent-shadow)',
            flexShrink: 0
          }}
        >
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 2,
              padding: 4,
              alignItems: 'end'
            }}
          >
            {[8, 13, 10].map((height, index) => (
              <span
                key={height + index}
                style={{
                  display: 'block',
                  height,
                  borderRadius: 2,
                  background: dimmed
                    ? 'var(--icon-muted)'
                    : index === 0
                      ? 'var(--color-wifi)'
                      : index === 1
                        ? 'var(--color-accent)'
                        : 'var(--color-ethernet)'
                }}
              />
            ))}
          </div>
        </div>
        <div
          style={{
            font: `800 13.5px/1 ${FONT_UI}`,
            letterSpacing: '0.02em',
            color: dimmed ? 'var(--text-tertiary)' : 'var(--text)'
          }}
        >
          Fluxlane
        </div>
      </div>
      <div style={{ flex: 1 }} />
      {status.kind === 'merged' && (
        <div style={pillStyle('positive')}>
          <div
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: 'var(--color-wifi)',
              animation: 'fluxlane-glow 2s ease-in-out infinite'
            }}
          />
          {status.networkCount} {status.networkCount === 1 ? 'network' : 'networks'} merged
        </div>
      )}
      {status.kind === 'paused' && (
        <div style={pillStyle('paused')}>
          <div
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: 'var(--color-usb)'
            }}
          />
          {status.networkCount} {status.networkCount === 1 ? 'network' : 'networks'} paused
        </div>
      )}
      {status.kind === 'offline' && (
        <div style={pillStyle('negative')}>
          <div
            style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-danger)' }}
          />
          Offline
        </div>
      )}
    </div>
  )
}
