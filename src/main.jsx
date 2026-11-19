import React from 'react'
import ReactDOM from 'react-dom/client'
import PageLoading from './components/PageLoading.jsx'
const App = React.lazy(async () => {
  if(import.meta.env.MODE==='preview'){
    if(import.meta.env.DEV){const {initializeLocalDataset}=await import('./preview/local-dataset.js');await initializeLocalDataset()}
    return import('./bi/Preview.jsx')
  }
  return import('./App.jsx')
})
import './index.css'
import './pv/tema.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <React.Suspense fallback={<PageLoading fullPage/>}><App /></React.Suspense>
  </React.StrictMode>
)

requestAnimationFrame(() => import('./pv/avatares.js'))
