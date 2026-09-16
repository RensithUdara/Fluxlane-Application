import type { ProbeResult } from '@shared/types'
import { useEffect, useMemo, useRef, useState } from 'react'
import { NetworkCard } from '../components/NetworkCard'
import { useNetworkPolling } from '../hooks/useNetworkPolling'
import { useAppStore } from '../store/useAppStore'
import {
  DANGER,
  FONT_MONO,
  FONT_UI,
  disabledPrimaryButtonStyle,
  primaryButtonStyle,
  secondaryButtonStyle,
  sectionHeaderLabelStyle,
  sectionHeaderMetaStyle
} from '../theme'
import { describeError, formatBytes, toDisplayPath } from '../utils/format'

type ProbeState =
  | { status: 'idle' }
  | { status: 'probing' }
  | { status: 'ready'; result: ProbeResult; multiChunkAllowed: boolean }
  | { status: 'error'; message: string }

const PROBE_DEBOUNCE_MS = 600
const PRESET_STREAMS = [1, 2, 4, 8] as const
const RECENT_URLS_KEY = 'fluxlane:recent-urls'
const RECENT_URL_LIMIT = 5

const fieldLabelStyle: React.CSSProperties = {
  font: `500 10px/1 ${FONT_MONO}`,
  letterSpacing: '0.14em',
  color: 'var(--text-tertiary)',
  flexShrink: 0
}

const miniButtonStyle: React.CSSProperties = {
  borderRadius: 5,
  background: 'var(--color-accent-bg)',
  border: '0.5px solid var(--color-accent-border)',
  padding: '3px 8px',
  font: `600 9.5px/1 ${FONT_MONO}`,
  color: 'var(--color-accent-text)',
  whiteSpace: 'nowrap',
  cursor: 'pointer',
  flexShrink: 0
}

const setupPanelStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
  padding: 12,
  borderRadius: 12,
  background: 'var(--bg-secondary)',
  border: '0.5px solid var(--border)',
  boxShadow: 'var(--panel-shadow)'
}

function readRecentUrls(): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(RECENT_URLS_KEY) || '[]')
    return Array.isArray(parsed) ? parsed.filter((entry) => typeof entry === 'string') : []
  } catch {
    return []
  }
}

function displayHost(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return url
  }
}

function saveRecentUrl(url: string, current: string[]): string[] {
  const trimmed = url.trim()
  if (!trimmed) return current
  const next = [trimmed, ...current.filter((entry) => entry !== trimmed)].slice(0, RECENT_URL_LIMIT)
  localStorage.setItem(RECENT_URLS_KEY, JSON.stringify(next))
  return next
}

function suggestedStreams(networkCount: number, probe: ProbeState): number {
  if (probe.status === 'ready' && !probe.multiChunkAllowed) return 1
  if (networkCount >= 2) return 4
  return 2
}

export function IdleScreen(): React.JSX.Element {
  useNetworkPolling(true)

  const interfaces = useAppStore((store) => store.interfaces)
  const homeDir = useAppStore((store) => store.homeDir)
  const downloadsDir = useAppStore((store) => store.downloadsDir)
  const latencies = useAppStore((store) => store.latencies)
  const loadInterfaces = useAppStore((store) => store.loadInterfaces)
  const refreshLatencies = useAppStore((store) => store.refreshLatencies)
  const loadInitialPaths = useAppStore((store) => store.loadInitialPaths)
  const url = useAppStore((store) => store.draftUrl)
  const setUrl = useAppStore((store) => store.setDraftUrl)
  const destinationDir = useAppStore((store) => store.draftDestinationDir)
  const setDestinationDir = useAppStore((store) => store.setDraftDestinationDir)

  const [probe, setProbe] = useState<ProbeState>({ status: 'idle' })
  const [recentUrls, setRecentUrls] = useState<string[]>(() => readRecentUrls())
  const [deselectedInterfaceIds, setDeselectedInterfaceIds] = useState<string[]>([])
  const [chunksPerNetwork, setChunksPerNetwork] = useState(2)
  const [starting, setStarting] = useState(false)
  const [startError, setStartError] = useState<string | null>(null)
  const probeRequestId = useRef(0)

  useEffect(() => {
    loadInitialPaths()
  }, [loadInitialPaths])

  useEffect(() => {
    if (!destinationDir && downloadsDir) setDestinationDir(downloadsDir)
  }, [destinationDir, downloadsDir, setDestinationDir])

  useEffect(() => {
    const trimmed = url.trim()
    const requestId = ++probeRequestId.current

    if (!trimmed) {
      const timer = setTimeout(() => {
        if (probeRequestId.current === requestId) setProbe({ status: 'idle' })
      }, 0)
      return () => clearTimeout(timer)
    }

    const timer = setTimeout(async () => {
      setProbe({ status: 'probing' })
      try {
        const result = await window.fluxlane.probeUrl(trimmed)
        if (probeRequestId.current !== requestId) return
        const multiChunkAllowed = result.supportsRanges && result.totalBytes !== null
        setProbe({ status: 'ready', result, multiChunkAllowed })
      } catch (error) {
        if (probeRequestId.current !== requestId) return
        setProbe({ status: 'error', message: describeError(error) })
      }
    }, PROBE_DEBOUNCE_MS)

    return () => clearTimeout(timer)
  }, [url])

  const sortedInterfaces = useMemo(
    () =>
      [...interfaces].sort((a, b) => {
        const aLatency = latencies[a.id] ?? Number.POSITIVE_INFINITY
        const bLatency = latencies[b.id] ?? Number.POSITIVE_INFINITY
        return aLatency - bLatency
      }),
    [interfaces, latencies]
  )

  const isSingleRangeServer = probe.status === 'ready' && !probe.multiChunkAllowed
  const activeDetectedIds = interfaces.map((iface) => iface.id)
  const rawSelectedIds = activeDetectedIds.filter((id) => !deselectedInterfaceIds.includes(id))
  const selectedInterfaceIds = isSingleRangeServer ? rawSelectedIds.slice(0, 1) : rawSelectedIds
  const effectiveNetworkCount = Math.max(1, selectedInterfaceIds.length)
  const totalChunks = isSingleRangeServer ? 1 : effectiveNetworkCount * chunksPerNetwork
  const recommendedStreams = suggestedStreams(selectedInterfaceIds.length, probe)

  const selectedLatencyValues = selectedInterfaceIds
    .map((id) => latencies[id])
    .filter((latency): latency is number => latency != null)
  const averageLatency =
    selectedLatencyValues.length > 0
      ? Math.round(
          selectedLatencyValues.reduce((sum, latency) => sum + latency, 0) /
            selectedLatencyValues.length
        )
      : null

  const handleToggleInterface = (id: string): void => {
    if (isSingleRangeServer) {
      setDeselectedInterfaceIds(activeDetectedIds.filter((otherId) => otherId !== id))
      return
    }

    setDeselectedInterfaceIds((prev) => {
      const isCurrentlySelected = !prev.includes(id)
      if (!isCurrentlySelected) return prev.filter((entry) => entry !== id)

      const remainingCount = activeDetectedIds.filter(
        (otherId) => !prev.includes(otherId) && otherId !== id
      ).length
      if (remainingCount === 0) return prev
      return [...prev, id]
    })
  }

  const handleRefreshNetworks = (): void => {
    void loadInterfaces().then(() => refreshLatencies())
  }

  const handleSelectAll = (): void => setDeselectedInterfaceIds([])

  const handleFastestOnly = (): void => {
    const fastest = sortedInterfaces[0]
    if (!fastest) return
    setDeselectedInterfaceIds(activeDetectedIds.filter((id) => id !== fastest.id))
  }

  const handleAutoTune = (): void => {
    setChunksPerNetwork(recommendedStreams)
    if (!isSingleRangeServer) setDeselectedInterfaceIds([])
  }

  const handleBrowse = async (): Promise<void> => {
    const chosen = await window.fluxlane.chooseDestinationFolder(destinationDir || downloadsDir)
    if (chosen) setDestinationDir(chosen)
  }

  const handlePaste = async (): Promise<void> => {
    const text = await window.fluxlane.readClipboardText()
    if (text.trim()) setUrl(text.trim())
  }

  const handleClearUrl = (): void => {
    probeRequestId.current += 1
    setUrl('')
    setProbe({ status: 'idle' })
    setStartError(null)
  }

  const handleClearHistory = (): void => {
    localStorage.removeItem(RECENT_URLS_KEY)
    setRecentUrls([])
  }

  const handleStart = async (): Promise<void> => {
    if (probe.status !== 'ready' || selectedInterfaceIds.length === 0 || !destinationDir) return
    setStarting(true)
    setStartError(null)
    try {
      await window.fluxlane.startDownload({
        url: probe.result.finalUrl,
        destinationDir,
        suggestedFileName: probe.result.suggestedFileName,
        totalBytes: probe.result.totalBytes ?? 0,
        supportsRanges: probe.multiChunkAllowed,
        interfaceIds: selectedInterfaceIds,
        chunkCount: probe.multiChunkAllowed ? selectedInterfaceIds.length * chunksPerNetwork : 1,
        connectionsPerNetwork: probe.multiChunkAllowed ? chunksPerNetwork : 1,
        etag: probe.result.etag,
        lastModified: probe.result.lastModified
      })
      setRecentUrls((current) => saveRecentUrl(probe.result.finalUrl, current))
    } catch (error) {
      setStartError(describeError(error))
    } finally {
      setStarting(false)
    }
  }

  const canStart =
    probe.status === 'ready' &&
    selectedInterfaceIds.length > 0 &&
    Boolean(destinationDir) &&
    !starting

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg)' }}
    >
      <div
        style={{
          padding: '16px 20px 15px',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          background: 'var(--hero-bg)',
          borderBottom: '0.5px solid var(--hero-border)',
          boxShadow: 'var(--panel-shadow)'
        }}
      >
        <div style={setupPanelStyle}>
          <div style={{ display: 'flex', gap: 9, alignItems: 'center' }}>
            <div
              style={{
                flex: 1,
                minWidth: 0,
                display: 'flex',
                alignItems: 'center',
                gap: 9,
                padding: '9px 12px',
                borderRadius: 9,
                background: 'var(--input-bg)',
                border: '0.5px solid var(--border-strong)',
                boxShadow: '0 0 0 4px var(--focus-ring)'
              }}
            >
              <div style={fieldLabelStyle}>LINK</div>
              <input
                type="text"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="https://"
                style={{
                  flex: 1,
                  minWidth: 0,
                  border: 'none',
                  outline: 'none',
                  background: 'transparent',
                  font: `13px/1.3 ${FONT_MONO}`,
                  color: 'var(--text)'
                }}
              />
              {url.trim() && (
                <button type="button" onClick={handleClearUrl} style={miniButtonStyle}>
                  CLEAR
                </button>
              )}
              <button type="button" onClick={handlePaste} style={miniButtonStyle}>
                PASTE
              </button>
            </div>
            <button
              type="button"
              onClick={handleStart}
              disabled={!canStart}
              style={canStart ? primaryButtonStyle : disabledPrimaryButtonStyle}
            >
              {starting ? 'Starting...' : probe.status === 'probing' ? 'Checking...' : 'Start'}
            </button>
          </div>

          {recentUrls.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
              <div style={fieldLabelStyle}>RECENT</div>
              <div style={{ display: 'flex', gap: 6, overflow: 'hidden', flex: 1 }}>
                {recentUrls.map((recentUrl) => (
                  <button
                    key={recentUrl}
                    type="button"
                    title={recentUrl}
                    onClick={() => setUrl(recentUrl)}
                    style={{
                      minWidth: 0,
                      border: '0.5px solid var(--border)',
                      borderRadius: 999,
                      background: 'var(--input-bg)',
                      padding: '4px 9px',
                      font: `500 10px/1 ${FONT_MONO}`,
                      color: 'var(--text-secondary)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      cursor: 'pointer'
                    }}
                  >
                    {displayHost(recentUrl)}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={handleClearHistory}
                style={{
                  border: 'none',
                  background: 'none',
                  padding: '2px 4px',
                  font: `600 9.5px/1 ${FONT_MONO}`,
                  color: 'var(--text-tertiary)',
                  cursor: 'pointer',
                  flexShrink: 0
                }}
              >
                CLEAR HISTORY
              </button>
            </div>
          )}

          <div style={{ display: 'flex', gap: 9, alignItems: 'center' }}>
            <div
              style={{
                flex: 1,
                minWidth: 0,
                display: 'flex',
                alignItems: 'center',
                gap: 9,
                padding: '7px 12px',
                borderRadius: 9,
                background: 'var(--input-bg)',
                border: '0.5px solid var(--border)'
              }}
            >
              <div style={fieldLabelStyle}>SAVE TO</div>
              <div
                style={{
                  flex: 1,
                  minWidth: 0,
                  font: `12.5px/1.3 ${FONT_MONO}`,
                  color: 'var(--text-secondary)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}
              >
                {toDisplayPath(destinationDir || downloadsDir, homeDir)}
              </div>
              {destinationDir && downloadsDir && destinationDir !== downloadsDir && (
                <button
                  type="button"
                  onClick={() => setDestinationDir(downloadsDir)}
                  style={{
                    border: 'none',
                    background: 'none',
                    font: `600 10px/1 ${FONT_MONO}`,
                    color: 'var(--text-tertiary)',
                    whiteSpace: 'nowrap',
                    cursor: 'pointer',
                    flexShrink: 0
                  }}
                >
                  RESET
                </button>
              )}
              <button
                type="button"
                onClick={handleBrowse}
                style={{
                  border: 'none',
                  background: 'none',
                  font: `600 11px/1 ${FONT_MONO}`,
                  color: 'var(--color-accent)',
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                  flexShrink: 0
                }}
              >
                Browse...
              </button>
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr) auto',
              gap: 9,
              alignItems: 'stretch'
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                padding: '8px 12px',
                borderRadius: 9,
                background: 'var(--input-bg)',
                border: '0.5px solid var(--border)',
                opacity: isSingleRangeServer ? 0.6 : 1
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <div style={fieldLabelStyle}>PARALLEL STREAMS</div>
                <div style={{ display: 'flex', gap: 4 }}>
                  {PRESET_STREAMS.map((preset) => {
                    const isSelected = chunksPerNetwork === preset
                    return (
                      <button
                        key={preset}
                        type="button"
                        disabled={isSingleRangeServer}
                        onClick={() => setChunksPerNetwork(preset)}
                        style={{
                          border: isSelected
                            ? '0.5px solid var(--color-accent)'
                            : '0.5px solid var(--border)',
                          borderRadius: 5,
                          background: isSelected ? 'var(--color-accent-bg)' : 'var(--track-bg)',
                          color: isSelected ? 'var(--color-accent-text)' : 'var(--text-secondary)',
                          font: `600 10.5px/1 ${FONT_MONO}`,
                          padding: '4px 8px',
                          cursor: isSingleRangeServer ? 'not-allowed' : 'pointer'
                        }}
                      >
                        {preset}x
                      </button>
                    )
                  })}
                </div>
              </div>
              <div
                style={{
                  font: `500 11px/1 ${FONT_MONO}`,
                  color: isSingleRangeServer ? 'var(--text-tertiary)' : 'var(--text-secondary)',
                  textAlign: 'right',
                  whiteSpace: 'nowrap'
                }}
              >
                {isSingleRangeServer ? (
                  '1 stream'
                ) : (
                  <>
                    <span style={{ color: 'var(--text)', fontWeight: 600 }}>{totalChunks}</span>{' '}
                    total streams
                  </>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={handleAutoTune}
              disabled={isSingleRangeServer}
              style={{
                ...secondaryButtonStyle,
                padding: '8px 12px',
                color: 'var(--color-bridge-text)'
              }}
            >
              Auto Tune
            </button>
          </div>
        </div>

        {probe.status === 'ready' && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1.5fr) repeat(3, minmax(92px, 0.6fr))',
              gap: 1,
              overflow: 'hidden',
              borderRadius: 9,
              border: '0.5px solid var(--color-accent-border)',
              background: 'var(--color-accent-border)'
            }}
          >
            {[
              { label: 'FILE', value: probe.result.suggestedFileName },
              {
                label: 'SIZE',
                value:
                  probe.result.totalBytes === null
                    ? 'Unknown'
                    : formatBytes(probe.result.totalBytes)
              },
              { label: 'MODE', value: probe.multiChunkAllowed ? 'Multi-range' : 'Single stream' },
              { label: 'HOST', value: displayHost(probe.result.finalUrl) }
            ].map((item) => (
              <div
                key={item.label}
                title={item.value}
                style={{ minWidth: 0, padding: '9px 11px', background: 'var(--input-bg)' }}
              >
                <div style={fieldLabelStyle}>{item.label}</div>
                <div
                  style={{
                    marginTop: 5,
                    font: `600 11.5px/1.2 ${FONT_UI}`,
                    color: 'var(--text)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {item.value}
                </div>
              </div>
            ))}
          </div>
        )}

        {probe.status === 'error' && (
          <div style={{ font: `12px/1.4 ${FONT_UI}`, color: DANGER }}>{probe.message}</div>
        )}
        {isSingleRangeServer && (
          <div style={{ font: `11.5px/1.4 ${FONT_UI}`, color: 'var(--text-tertiary)' }}>
            This server does not support multi-chunk downloads for this file, so Fluxlane will use
            one network.
          </div>
        )}
        {startError && (
          <div style={{ font: `11.5px/1.4 ${FONT_UI}`, color: DANGER }}>{startError}</div>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px 14px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            paddingBottom: 8,
            borderBottom: '0.5px solid var(--border)'
          }}
        >
          <div>
            <div style={sectionHeaderLabelStyle}>Networks</div>
            <div
              style={{
                marginTop: 5,
                font: `500 11px/1 ${FONT_MONO}`,
                color: 'var(--text-tertiary)'
              }}
            >
              {interfaces.length} detected - {selectedInterfaceIds.length} selected
              {averageLatency !== null ? ` - avg ${averageLatency} ms` : ''}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <button type="button" onClick={handleRefreshNetworks} style={secondaryButtonStyle}>
              Refresh
            </button>
            <button type="button" onClick={handleSelectAll} style={secondaryButtonStyle}>
              Select All
            </button>
            <button type="button" onClick={handleFastestOnly} style={secondaryButtonStyle}>
              Fastest Only
            </button>
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
            gap: 10,
            paddingTop: 12
          }}
        >
          {sortedInterfaces.map((iface) => (
            <NetworkCard
              key={iface.id}
              iface={iface}
              selected={selectedInterfaceIds.includes(iface.id)}
              latencyMs={latencies[iface.id]}
              onToggle={() => handleToggleInterface(iface.id)}
            />
          ))}
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
          {selectedInterfaceIds.length} {selectedInterfaceIds.length === 1 ? 'network' : 'networks'}{' '}
          selected
          {selectedInterfaceIds.length > 0
            ? ` - ${totalChunks} ${totalChunks === 1 ? 'stream' : 'parallel streams'}`
            : ''}
          {probe.status === 'ready' && probe.result.totalBytes !== null
            ? ` - ${formatBytes(probe.result.totalBytes)}`
            : ''}
        </div>
        <div style={{ flex: 1 }} />
        <div style={sectionHeaderMetaStyle}>
          {probe.status === 'probing'
            ? 'checking link'
            : probe.status === 'ready'
              ? 'ready'
              : 'waiting'}
        </div>
      </div>
    </div>
  )
}
