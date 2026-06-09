import React from 'react'
import ReactDOM from 'react-dom/client'
import { ScreenshotRegionPicker } from './features/screenshot/ScreenshotRegionPicker'
import './styles/screenshot-overlay.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ScreenshotRegionPicker />
  </React.StrictMode>
)
