import React, { useState } from 'react'
import { LandingPage } from './pages/LandingPage'
import { RoomPage } from './pages/RoomPage'
import { AdminPage } from './pages/AdminPage'
import './index.css'

export default function App() {
  const [inRoom, setInRoom] = useState(false)

  if (window.location.pathname.replace(/\/+$/, '') === '/admin') {
    return <AdminPage />
  }

  return inRoom
    ? <RoomPage onLeaveRoom={() => setInRoom(false)} />
    : <LandingPage onEnterRoom={() => setInRoom(true)} />
}
