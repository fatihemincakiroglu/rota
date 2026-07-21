import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { IS_RTL } from './i18n.js'
import './styles.css'

// Arapca gibi RTL dillerde belge yonunu ayarla (statik HTML'de de var, burada garanti)
document.documentElement.dir = IS_RTL ? 'rtl' : 'ltr'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
