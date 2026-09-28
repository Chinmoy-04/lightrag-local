import axios from 'axios'

// Vite's dev server proxies /api/* to the FastAPI backend on :8000 (see
// vite.config.js). Query latency can run into minutes for global/hybrid
// mode on local hardware, so the client timeout is generous rather than
// matching typical web-app defaults.
const client = axios.create({
  baseURL: '/api',
  timeout: 15 * 60 * 1000,
})

function unwrapError(error) {
  const detail = error?.response?.data?.detail
  return new Error(detail || error.message || 'Request failed')
}

export async function getHealth() {
  try {
    const { data } = await client.get('/health')
    return data
  } catch (error) {
    throw unwrapError(error)
  }
}

export async function postIndex() {
  try {
    const { data } = await client.post('/index')
    return data
  } catch (error) {
    throw unwrapError(error)
  }
}

export async function postQuery(prompt, mode, { signal } = {}) {
  try {
    const { data } = await client.post('/query', { prompt, mode }, { signal })
    return data
  } catch (error) {
    if (error.code === 'ERR_CANCELED' || error.name === 'CanceledError') {
      const cancelled = new Error('cancelled')
      cancelled.cancelled = true
      throw cancelled
    }
    throw unwrapError(error)
  }
}

export async function getGraph(limit = 400) {
  try {
    const { data } = await client.get('/graph', { params: { limit } })
    return data
  } catch (error) {
    throw unwrapError(error)
  }
}

export async function getCompare() {
  try {
    const { data } = await client.get('/compare', {
      params: { _: Date.now() },
      headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
    })
    return data
  } catch (error) {
    throw unwrapError(error)
  }
}
