// EverGuide → n8n: check each event's signature before acting on it.
// Runs in the "Verify signature" Code node. Needs the n8n settings
// NODE_FUNCTION_ALLOW_BUILTIN=crypto and EVERGUIDE_WEBHOOK_SECRET (see README).
//
// The signature is HMAC-SHA256 over "<timestamp>.<body>", sent as "v1=<hex>".
// Events older than 5 minutes are refused, so a captured request can't be replayed.
// The body is rebuilt with JSON.stringify: EverGuide sends compact JSON made by
// JSON.stringify, which parses and re-serialises to exactly the same text.
const crypto = require('crypto')

const secret = $env.EVERGUIDE_WEBHOOK_SECRET
const now = Math.floor(Date.now() / 1000)

return $input.all().map((item) => {
  const headers = item.json.headers || {}
  const body = JSON.stringify(item.json.body)
  const timestamp = Number(headers['x-everguide-timestamp'])
  let valid = false
  if (secret && Number.isInteger(timestamp) && Math.abs(now - timestamp) <= 300) {
    const expected =
      'v1=' +
      crypto
        .createHmac('sha256', secret)
        .update(timestamp + '.' + body)
        .digest('hex')
    const received = String(headers['x-everguide-signature'] || '')
    valid =
      expected.length === received.length &&
      crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(received))
  }
  return { json: { valid, event: valid ? item.json.body : null } }
})
