'use client'

import { createContext, useContext, useState, useCallback, ReactNode } from 'react'

interface ToastCtx {
  showToast: (icon: string, msg: string) => void
}

const ToastContext = createContext<ToastCtx>({ showToast: () => {} })

export function ToastProvider({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(false)
  const [icon, setIcon] = useState('✅')
  const [msg, setMsg] = useState('')

  const showToast = useCallback((ic: string, message: string) => {
    setIcon(ic)
    setMsg(message)
    setVisible(true)
    setTimeout(() => setVisible(false), 2500)
  }, [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className={`toast ${visible ? 'show' : ''}`}>
        <span className="toast-icon">{icon}</span>
        <span>{msg}</span>
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}
