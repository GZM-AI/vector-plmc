import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Amplify } from 'aws-amplify'
import { generateClient } from 'aws-amplify/data'
import './index.css'
import App from './App.tsx'
import { configureHotspotAmplify } from './lib/hotspotLayoutStore'
import { configureProductAmplify } from './lib/productAmplify'
import { hydrateConfigStoreFromCloud } from './lib/configStore'
import { ensurePlanningHydrated } from './lib/planningStore'
import { hydrateSuppliersStoreFromCloud } from './lib/suppliersStore'
import { hydrateDocumentsStoreFromCloud } from './lib/documentsStore'
import { hydrateResearchStoreFromCloud } from './lib/researchStore'
import { applySharedCognitoLock, SHARED_COGNITO } from './lib/sharedCognito'
import type { Schema } from '../amplify/data/resource'

async function boot() {
  try {
    const res = await fetch('/amplify_outputs.json')
    if (!res.ok) throw new Error(`amplify_outputs.json HTTP ${res.status}`)
    const outputs = (await res.json()) as Record<string, unknown>
    Amplify.configure(applySharedCognitoLock(outputs) as never)
    console.log(
      'PLM Console — Cognito lock',
      SHARED_COGNITO.userPoolId,
      SHARED_COGNITO.userPoolClientId
    )

    const client = generateClient<Schema>({ authMode: 'apiKey' })
    configureHotspotAmplify(client as any)
    configureProductAmplify(client)
    console.log(
      'PLM Console — Data client authMode: apiKey (MapLayout + Registry spine + Suppliers); Documents use userPool'
    )

    await hydrateConfigStoreFromCloud()
    await ensurePlanningHydrated()
    await hydrateSuppliersStoreFromCloud()
    await hydrateDocumentsStoreFromCloud()
    await hydrateResearchStoreFromCloud()
  } catch (err) {
    console.warn(
      'PLM Console — Amplify not fully configured; app will use local cache only.',
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
