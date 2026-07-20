import React, { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box, Typography, Button, Dialog, DialogTitle, DialogContent, DialogActions,
  CircularProgress, Chip, TextField, useTheme, useMediaQuery, Grid, Divider, Alert
} from '@mui/material'

const API = 'http://localhost:3001'

const authHeaders = () => ({
  Authorization: `Bearer ${sessionStorage.getItem('authToken')}`,
  'Content-Type': 'application/json'
})

const statusColor = (status) => {
  if (status === 'verified') return 'success'
  if (status === 'rejected') return 'error'
  return 'warning'
}

const renderImage = (img) => {
  if (!img || !img.url) return <Typography color='text.secondary' variant='body2'>No image on file</Typography>
  return (
    <Box>
      <Box
        component='img'
        src={img.url}
        alt='verification image'
        sx={{ width: '100%', maxHeight: 260, objectFit: 'contain', borderRadius: 2, bgcolor: '#111', border: '1px solid #ddd' }}
      />
      <Typography variant='caption' color='text.secondary'>
        source: {img.type === 'base64' ? 'embedded in database' : 'Supabase Storage'}
      </Typography>
    </Box>
  )
}

const Section = ({ title, status, children }) => (
  <Box sx={{ border: '1px solid #e0e0e0', borderRadius: 2, p: 2, mb: 2, bgcolor: '#fff' }}>
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
      <Typography variant='h6'>{title}</Typography>
      {status != null && <Chip size='small' label={status} color={statusColor(status)} />}
    </Box>
    <Divider sx={{ mb: 2 }} />
    {children}
  </Box>
)

export default function ModeratorDashboard () {
  const navigate = useNavigate()
  const theme = useTheme()
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'))

  const [drivers, setDrivers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [selected, setSelected] = useState(null)
  const [bundle, setBundle] = useState(null)
  const [loadingBundle, setLoadingBundle] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [rejectTarget, setRejectTarget] = useState('')
  const [acting, setActing] = useState(false)
  const [message, setMessage] = useState('')

  const loadDrivers = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${API}/api/admin/drivers/pending`, { headers: authHeaders() })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to load drivers')
      }
      setDrivers(await res.json())
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadDrivers() }, [loadDrivers])

  const openDriver = async (driver) => {
    setSelected(driver)
    setBundle(null)
    setRejectReason('')
    setRejectTarget('')
    setMessage('')
    setLoadingBundle(true)
    try {
      const res = await fetch(`${API}/api/admin/drivers/${encodeURIComponent(driver.email)}/verification`, {
        headers: authHeaders()
      })
      if (res.ok) setBundle(await res.json())
    } catch (e) {
      console.error(e)
    } finally {
      setLoadingBundle(false)
    }
  }

  const review = async (kind, decision) => {
    if (!selected) return
    setActing(true)
    setMessage('')
    try {
      const body = decision === 'reject'
        ? { decision, rejection_reason: rejectReason || 'Rejected by moderator' }
        : { decision }
      const res = await fetch(
        `${API}/api/admin/drivers/${encodeURIComponent(selected.email)}/${kind}/review`,
        { method: 'POST', headers: authHeaders(), body: JSON.stringify(body) }
      )
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Review failed')
      setMessage(`${kind} ${decision === 'approve' ? 'approved' : 'rejected'}`)
      setRejectTarget('')
      setRejectReason('')
      await openDriver(selected)
    } catch (err) {
      setMessage(`Error: ${err.message}`)
    } finally {
      setActing(false)
    }
  }

  const approveAll = async () => {
    if (!selected) return
    setActing(true)
    try {
      for (const kind of ['id-document', 'selfie', 'phone', 'bank']) {
        const body = kind === 'phone' ? { decision: 'approve' } : { decision: 'approve' }
        await fetch(`${API}/api/admin/drivers/${encodeURIComponent(selected.email)}/${kind}/review`, {
          method: 'POST', headers: authHeaders(), body: JSON.stringify(body)
        })
      }
      setMessage('All sections approved')
      await openDriver(selected)
    } catch (err) {
      setMessage(`Error: ${err.message}`)
    } finally {
      setActing(false)
    }
  }

  return (
    <Box sx={{ p: 0, bgcolor: '#f0f2f5', minHeight: '100vh' }}>
      <Box sx={{
        bgcolor: '#82b1ff', color: 'white', p: 2, display: 'flex',
        alignItems: 'center', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '1.5rem'
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <img src='/taxifav.png' alt='' style={{ width: 35, height: 35, marginRight: 10 }} />
          <span>SWYFT - Moderator Review</span>
        </Box>
        <Button variant='outlined' sx={{ borderRadius: '15px', borderColor: '#fff', color: '#fff' }} onClick={() => navigate('/')}>
          Home
        </Button>
      </Box>

      <Box sx={{ p: isDesktop ? 5 : 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
          <Typography variant='h6'>Newly Registered Drivers Awaiting Verification</Typography>
          <Button variant='contained' onClick={loadDrivers}>Refresh</Button>
        </Box>

        {loading && <CircularProgress sx={{ mt: 2 }} />}
        {error && <Typography color='error'>{error}</Typography>}
        {!loading && !error && drivers.length === 0 && (
          <Typography sx={{ mt: 2 }}>No drivers pending review.</Typography>
        )}

        <Grid container spacing={2}>
          {drivers.map((d) => (
            <Grid item xs={12} sm={6} md={4} key={d.id}>
              <Box sx={{ border: '1px solid #ccc', borderRadius: 2, p: 2, bgcolor: '#fff', height: '100%', display: 'flex', flexDirection: 'column' }}>
                <Typography fontWeight='bold'>{d.first_name} {d.last_name}</Typography>
                <Typography variant='body2' color='text.secondary'>{d.email}</Typography>
                <Typography variant='body2' color='text.secondary'>{d.phone}</Typography>
                {d.is_approved && <Chip size='small' sx={{ mt: 1, width: 'fit-content' }} label='Approved' color='success' />}
                <Box sx={{ mt: 'auto', pt: 2 }}>
                  <Button fullWidth variant='contained' onClick={() => openDriver(d)}>Review Details</Button>
                </Box>
              </Box>
            </Grid>
          ))}
        </Grid>
      </Box>

      <Dialog open={!!selected} onClose={() => setSelected(null)} maxWidth='md' fullWidth>
        <DialogTitle>
          Verification Details — {selected?.first_name} {selected?.last_name}
        </DialogTitle>
        <DialogContent dividers>
          {message && <Alert severity={message.startsWith('Error') ? 'error' : 'success'} sx={{ mb: 2 }}>{message}</Alert>}
          {loadingBundle && <CircularProgress />}
          {bundle && (
            <>
              <Section title='Driver' status={null}>
                <Typography>Email: {bundle.driver.email}</Typography>
                <Typography>Phone: {bundle.driver.phone || '—'}</Typography>
                <Typography>Registered: {new Date(bundle.driver.created_at).toLocaleString()}</Typography>
              </Section>

              <Section title='ID Document' status={bundle.id_document?.verification_status}>
                {bundle.id_document ? (
                  <>
                    <Typography>Type: {bundle.id_document.document_type}</Typography>
                    <Typography>Number: {bundle.id_document.document_number}</Typography>
                    <Typography>Expiry: {bundle.id_document.expiry_date || '—'}</Typography>
                    {bundle.id_document.rejection_reason && (
                      <Typography color='error'>Reason: {bundle.id_document.rejection_reason}</Typography>
                    )}
                    <Grid container spacing={2} sx={{ mt: 1 }}>
                      <Grid item xs={6}><Typography variant='subtitle2'>Front</Typography>{renderImage(bundle.id_document.front_image)}</Grid>
                      <Grid item xs={6}><Typography variant='subtitle2'>Back</Typography>{renderImage(bundle.id_document.back_image)}</Grid>
                    </Grid>
                  </>
                ) : <Typography color='text.secondary'>Not submitted</Typography>}
              </Section>

              <Section title='Selfie' status={bundle.selfie?.verification_status}>
                {bundle.selfie ? (
                  <>
                    {bundle.selfie.match_confidence != null && <Chip size='small' label={`Match ${bundle.selfie.match_confidence}%`} sx={{ mb: 1 }} />}
                    {bundle.selfie.rejection_reason && <Typography color='error'>Reason: {bundle.selfie.rejection_reason}</Typography>}
                    <Grid container spacing={2} sx={{ mt: 1 }}>
                      <Grid item xs={6}><Typography variant='subtitle2'>Selfie</Typography>{renderImage(bundle.selfie.selfie_image)}</Grid>
                      <Grid item xs={6}><Typography variant='subtitle2'>ID Used For Match</Typography>{renderImage(bundle.selfie.id_document_image)}</Grid>
                    </Grid>
                  </>
                ) : <Typography color='text.secondary'>Not submitted</Typography>}
              </Section>

              <Section title='Phone' status={bundle.phone?.is_verified ? 'verified' : 'pending'}>
                {bundle.phone ? (
                  <>
                    <Typography>Number: {bundle.phone.phone_number}</Typography>
                    <Typography>Verified: {bundle.phone.is_verified ? 'Yes' : 'No'}</Typography>
                  </>
                ) : <Typography color='text.secondary'>Not submitted</Typography>}
              </Section>

              <Section title='Bank Account' status={bundle.bank_account?.verification_status}>
                {bundle.bank_account ? (
                  <>
                    <Typography>Bank: {bundle.bank_account.bank_name}</Typography>
                    <Typography>Holder: {bundle.bank_account.account_holder_name}</Typography>
                    <Typography>Account: {bundle.bank_account.account_number}</Typography>
                    {bundle.bank_account.routing_number && <Typography>Routing: {bundle.bank_account.routing_number}</Typography>}
                    {bundle.bank_account.iban && <Typography>IBAN: {bundle.bank_account.iban}</Typography>}
                    {bundle.bank_account.swift_code && <Typography>Swift: {bundle.bank_account.swift_code}</Typography>}
                    {bundle.bank_account.rejection_reason && <Typography color='error'>Reason: {bundle.bank_account.rejection_reason}</Typography>}
                  </>
                ) : <Typography color='text.secondary'>Not submitted</Typography>}
              </Section>

              {rejectTarget && (
                <TextField
                  fullWidth
                  size='small'
                  label={`Rejection reason for ${rejectTarget}`}
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  sx={{ mb: 2 }}
                />
              )}
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ flexWrap: 'wrap', gap: 1 }}>
          <Button onClick={() => setSelected(null)}>Close</Button>
          <Button
            variant='outlined'
            color='success'
            disabled={acting || !bundle}
            onClick={approveAll}
          >
            Approve All
          </Button>
          {['id-document', 'selfie', 'phone', 'bank'].map((kind) => (
            <Box key={kind} sx={{ display: 'flex', gap: 0.5 }}>
              <Button
                size='small'
                color='success'
                disabled={acting || !bundle}
                onClick={() => review(kind, 'approve')}
              >Approve {kind.split('-')[0]}</Button>
              <Button
                size='small'
                color='error'
                disabled={acting || !bundle}
                onClick={() => {
                  setRejectTarget(kind)
                  review(kind, 'reject')
                }}
              >Reject</Button>
            </Box>
          ))}
        </DialogActions>
      </Dialog>
    </Box>
  )
}
