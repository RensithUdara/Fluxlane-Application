import { MergeDiagram } from '../components/MergeDiagram'
import { useNetworkPolling } from '../hooks/useNetworkPolling'
import { useAppStore } from '../store/useAppStore'
import { FONT_MONO, FONT_UI, disabledPrimaryButtonStyle, secondaryButtonStyle } from '../theme'

const PLACEHOLDER_NETWORKS = [
  { solid: 'var(--icon-muted)', label: 'Wi-Fi' },
  { solid: 'var(--icon-muted)', label: 'USB' },
  { solid: 'var(--icon-muted)', label: 'Ethernet' }
]

export function NoConnectionsScreen(): React.JSX.Element {
  useNetworkPolling(true)

  const loadInterfaces = useAppStore((store) => store.loadInterfaces)

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg)' }}
    >
      <div
        style={{
          flex: 1,
          padding: '40px 20px 44px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 18
        }}
      >
        <MergeDiagram networks={PLACEHOLDER_NETWORKS} muted />
        <div
          style={{
            width: 'min(430px, 100%)',
            padding: '24px 26px',
            borderRadius: 12,
            background: 'var(--bg-secondary)',
            border: '0.5px solid var(--border-strong)',
            boxShadow: 'var(--panel-shadow-strong)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 13,
            textAlign: 'center'
          }}
        >
          <div
            style={{
              width: 44,
              height: 8,
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 4
            }}
          >
            {[
              'var(--color-wifi)',
              'var(--color-usb)',
              'var(--color-ethernet)',
              'var(--color-bridge)'
            ].map((color) => (
              <span key={color} style={{ borderRadius: 999, background: color }} />
            ))}
          </div>
          <div style={{ font: `800 18px/1.2 ${FONT_UI}`, color: 'var(--text)' }}>
            No networks to merge
          </div>
          <div
            style={{
              maxWidth: 360,
              font: `12.5px/1.6 ${FONT_UI}`,
              color: 'var(--text-secondary)'
            }}
          >
            Fluxlane needs at least one active network. Join a Wi-Fi network, plug in Ethernet, or
            connect an iPhone over USB with Personal Hotspot enabled.
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button type="button" onClick={() => loadInterfaces()} style={secondaryButtonStyle}>
              Scan Again
            </button>
            <button
              type="button"
              onClick={() => window.fluxlane.openNetworkSettings()}
              style={secondaryButtonStyle}
            >
              Network Settings...
            </button>
          </div>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '11px 20px',
          background: 'var(--bg-tertiary)',
          borderTop: '0.5px solid var(--footer-border)'
        }}
      >
        <div style={{ font: `11px/1.4 ${FONT_MONO}`, color: 'var(--text-tertiary)' }}>
          0 networks - watching for changes
        </div>
        <div style={{ flex: 1 }} />
        <button type="button" disabled style={disabledPrimaryButtonStyle}>
          Start
        </button>
      </div>
    </div>
  )
}
