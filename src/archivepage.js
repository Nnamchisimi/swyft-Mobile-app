import React, { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box, Typography, Button, Dialog, DialogTitle, DialogContent, DialogActions,
  CircularProgress, Chip, useTheme, useMediaQuery, Grid, Divider, TextField, Alert
} from '@mui/material'

const API = 'http://localhost:3001'

const authHeaders = () => ({
  Authorization: `Bearer ${sessionStorage.getItem('authToken')}`,
  'Content-Type': 'application/json'
})

const decisionColor = (decision) => (decision === 'approved' ? 'success' : 'error')

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
      {status != null && <Chip size='small' label={status} color={status === 'approved' || status === 'verified' ? 'success' : 'warning'} />}
    </Box>
    <Divider sx={{ mb: 2 }} />
    {children}
  </Box>
)

export default function ArchivePage () {
  const navigate = useNavigate()
  const theme = useTheme()
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'))

  const [archived, setArchived] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [selected, setSelected] = useState(null)
  const [bundle, setBundle] = useState(null)
  const [loadingBundle, setLoadingBundle] = useState(false)

  const loadArchived = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${API}/api/admin/drivers/archived`, { headers: authHeaders() })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to load archived drivers')
      }
      setArchived(await res.json())
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadArchived() }, [loadArchived])

  const openDriver = async (driver) => {
    setSelected(driver)
    setBundle(null)
    setLoadingBundle(true)
    try {
      const res = await fetch(
        `${API}/api/admin/drivers/archived/${driver.id}`,
        { headers: authHeaders() }
      )
      if (res.ok) {
        const full = await res.json()
        setSelected(full)
        setBundle(full)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoadingBundle(false)
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
          <span>SWYFT - Driver Archive</span>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant='outlined' sx={{ borderRadius: '15px', borderColor: '#fff', color: '#fff' }} onClick={() => navigate('/moderator')}>
            Review Queue
          </Button>
          <Button variant='outlined' sx={{ borderRadius: '15px', borderColor: '#fff', color: '#fff' }} onClick={() => navigate('/')}>
            Home
          </Button>
        </Box>
      </Box>

      <Box sx={{ p: isDesktop ? 5 : 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
          <Typography variant='h6'>Archived Driver Details (Reference)</Typography>
          <Button variant='contained' onClick={loadArchived}>Refresh</Button>
        </Box>

        {loading && <CircularProgress sx={{ mt: 2 }} />}
        {error && <Typography color='error'>{error}</Typography>}
        {!loading && !error && archived.length === 0 && (
          <Typography sx={{ mt: 2 }}>No archived drivers yet.</Typography>
        )}

        <Grid container spacing={2}>
          {archived.map((d) => (
            <Grid item xs={12} sm={6} md={4} key={d.id}>
              <Box sx={{ border: '1px solid #ccc', borderRadius: 2, p: 2, bgcolor: '#fff', height: '100%', display: 'flex', flexDirection: 'column' }}>
                <Typography fontWeight='bold'>{d.first_name} {d.last_name}</Typography>
                <Typography variant='body2' color='text.secondary'>{d.email}</Typography>
                <Typography variant='body2' color='text.secondary'>{d.phone || '—'}</Typography>
                <Box sx={{ mt: 1, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  <Chip size='small' label={d.decision} color={decisionColor(d.decision)} />
                  <Typography variant='caption' color='text.secondary' sx={{ alignSelf: 'center' }}>
                    {new Date(d.archived_at).toLocaleDateString()}
                  </Typography>
                </Box>
                <Box sx={{ mt: 'auto', pt: 2 }}>
                  <Button fullWidth variant='contained' onClick={() => openDriver(d)}>View Details</Button>
                </Box>
              </Box>
            </Grid>
          ))}
        </Grid>
      </Box>

      <Dialog open={!!selected} onClose={() => setSelected(null)} maxWidth='md' fullWidth>
        <DialogTitle>
          Archived Driver — {selected?.first_name} {selected?.last_name}
        </DialogTitle>
        <DialogContent dividers>
          {loadingBundle && <CircularProgress />}
          {bundle && (
            <>
              <Section title='Driver' status={null}>
                <Typography>Email: {bundle.email}</Typography>
                <Typography>Phone: {bundle.phone || '—'}</Typography>
                <Typography>Decision: <Chip size='small' label={bundle.decision} color={decisionColor(bundle.decision)} /></Typography>
                <Typography>Archived At: {new Date(bundle.archived_at).toLocaleString()}</Typography>
                {bundle.reviewer_email && <Typography>Reviewed By: {bundle.reviewer_email}</Typography>}
                {bundle.notes && <Typography>Notes: {bundle.notes}</Typography>}
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
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSelected(null)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
