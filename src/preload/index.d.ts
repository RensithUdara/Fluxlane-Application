import { ElectronAPI } from '@electron-toolkit/preload'
import type { FluxlaneApi } from './index'

declare global {
  interface Window {
    electron: ElectronAPI
    fluxlane: FluxlaneApi
  }
}
