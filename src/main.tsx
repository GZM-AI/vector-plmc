import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Amplify } from 'aws-amplify'
import { generateClient } from 'aws-amplify/data'
import './index.css'
import App from './App.tsx'
import { configureHotspotAmplify } from './lib/hotspotLayoutStore'
import type { Schema } from '../amplify/data/resource'

async function boot() {
  try {
    // Loaded at runtime from /public so Vite build does not need the file in git
    const res = await fetch('/amplify_outputs.json')
    if (!res.ok) throw new Error(`amplify_outputs.json HTTP ${res.status}`)
    const outputs = await res.json()
    Amplify.configure(outputs)

    // Prefer IAM/guest when the backend allows it (identityPool).
    // Falls back to default (userPool) if identityPool is not accepted.
    let client
    try {
      client = generateClient<Schema>({ authMode: 'identityPool' })
      console.log('PLM Console — Data client authMode: identityPool')
    } catch {
      client = generateClient<Schema>()
      console.log('PLM Console — Data client authMode: default')
    }

    configureHotspotAmplify(client as any)
    console.log('PLM Console starting — Amplify Data client configured (MapLayout)')
  } catch (err) {
    console.warn(
      'PLM Console starting — Amplify not configured (no amplify_outputs.json). Layout will use local cache only.',
      err
    )
  }

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>
  )
}

boot()