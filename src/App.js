import React from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Homepage from './Homepage'
import RideBookingViewDesktop from './passengerdashboard'
import SignIn from './signin'
import GetStarted from './getstarted'
import DriverDashboard from './driverdashboard'
import ModeratorDashboard from './moderatordashboard'
import ArchivePage from './archivepage'

function App () {
  return (
    <Router>
      <Routes>
        <Route path='/' element={<Homepage />} />
        <Route path='/ride-booking' element={<RideBookingViewDesktop />} />
        <Route path='/signin' element={<SignIn />} />
        <Route path='/getstarted' element={<GetStarted />} />
        <Route path='/driver' element={<DriverDashboard />} />
        <Route path='/moderator' element={<ModeratorDashboard />} />
        <Route path='/moderator/archive' element={<ArchivePage />} />

      </Routes>
    </Router>
  )
}

export default App
