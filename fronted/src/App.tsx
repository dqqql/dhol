import React, { useState } from 'react'
import { LandingPage } from './pages/LandingPage'
import { RoomPage } from './pages/RoomPage'
import './index.css'

export default function App() {
  const [inRoom, setInRoom] = useState(false)

  return inRoom
    ? <RoomPage onLeaveRoom={() => setInRoom(false)} />
    : <LandingPage onEnterRoom={() => setInRoom(true)} />
}
