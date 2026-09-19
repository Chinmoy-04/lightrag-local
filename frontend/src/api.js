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

export async function postQuery(prompt, mode) {
  try {
    const { data } = await client.post('/query', { prompt, mode })
    return data
  } catch (error) {
    throw unwrapError(error)
  }
}
