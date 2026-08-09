/**
 * AirOps API proxy for AWS Amplify / Lambda Function URL.
 *
 * Browser → Amplify rewrite `/api/airops/*` → this function → api.airops.com
 * Injects Authorization from AIROPS_API_KEY (never shipped to the client).
 *
 * Deploy: zip this file, create a Lambda (Node.js 20.x), add Function URL
 * (Auth type: NONE), set env AIROPS_API_KEY (+ optional AIROPS_API_BASE).
 * Then add an Amplify rewrite (see README "Deploy to Amplify").
 */

const API_PREFIX = '/api/airops'

function corsHeaders(requestHeaders = {}) {
  const origin = requestHeaders.origin || requestHeaders.Origin || '*'
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers':
      requestHeaders['access-control-request-headers'] ||
      'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  }
}

function getHeader(headers, name) {
  if (!headers) return undefined
  const lower = name.toLowerCase()
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === lower) return value
  }
  return undefined
}

export const handler = async (event) => {
  const requestHeaders = event.headers || {}
  const method =
    event.requestContext?.http?.method ||
    event.httpMethod ||
    'GET'

  if (method === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders(requestHeaders), body: '' }
  }

  const apiKey = process.env.AIROPS_API_KEY
  if (!apiKey) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders(requestHeaders) },
      body: JSON.stringify({
        error: 'AIROPS_API_KEY is not configured on the proxy.',
      }),
    }
  }

  const base = (process.env.AIROPS_API_BASE || 'https://api.airops.com').replace(/\/$/, '')
  const rawPath = event.rawPath || event.path || '/'
  const stripped = rawPath.startsWith(API_PREFIX)
    ? rawPath.slice(API_PREFIX.length) || '/'
    : rawPath
  const qs = event.rawQueryString
    ? `?${event.rawQueryString}`
    : event.queryStringParameters
      ? `?${new URLSearchParams(event.queryStringParameters).toString()}`
      : ''
  const url = `${base}${stripped}${qs}`

  const upstreamHeaders = {
    Authorization: `Bearer ${apiKey}`,
  }
  const contentType = getHeader(requestHeaders, 'content-type')
  if (contentType) upstreamHeaders['Content-Type'] = contentType

  let body = event.body
  if (body && event.isBase64Encoded) {
    body = Buffer.from(body, 'base64').toString('utf8')
  }

  try {
    const upstream = await fetch(url, {
      method,
      headers: upstreamHeaders,
      body: method === 'GET' || method === 'HEAD' ? undefined : body,
    })

    const text = await upstream.text()
    const responseHeaders = {
      ...corsHeaders(requestHeaders),
      'Content-Type':
        upstream.headers.get('content-type') || 'application/json',
    }

    return {
      statusCode: upstream.status,
      headers: responseHeaders,
      body: text,
    }
  } catch (err) {
    return {
      statusCode: 502,
      headers: { 'Content-Type': 'application/json', ...corsHeaders(requestHeaders) },
      body: JSON.stringify({
        error: 'Proxy failed to reach AirOps API',
        detail: err instanceof Error ? err.message : String(err),
      }),
    }
  }
}
