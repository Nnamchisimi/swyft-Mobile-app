import React, { useState, useEffect } from 'react'
import RideBookingViewDesktop from './passengerdashboard'
import RideBookingViewMobile from './RideBookingViewMobile'
import { useLocation } from 'react-router-dom'

export default function RideBookingView (props) {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)

  const location = useLocation()

  const [passengerEmail, setPassengerEmail] = useState('')

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return isMobile ? <RideBookingViewMobile {...props} /> : <RideBookingViewDesktop {...props} />
}

useEffect(() => {
  if (location.state?.email) {
    setPassengerEmail(location.state.email)
  } else {
    async function fetchUserEmail () {
      try {
        const res = await fetch('http://localhost:3001/api/users/profile')
        const data = await res.json()
        if (res.ok && data.email) {
          setPassengerEmail(data.email)
        }
      } catch (err) {
        console.error('Failed to fetch user email', err)
      }
    }
    fetchUserEmail()
  }
}, [location.state])
