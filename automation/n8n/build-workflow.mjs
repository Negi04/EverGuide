// Builds workflows/everguide-events.json from the two Code-node scripts beside it.
// Run after editing either script:  node automation/n8n/build-workflow.mjs
import { readFileSync, writeFileSync } from 'node:fs'

const here = new URL('./', import.meta.url)
const read = (file) => readFileSync(new URL(file, here), 'utf8')

const node = (name, type, typeVersion, position, parameters, extra = {}) => ({
  id: name.toLowerCase().replace(/[^a-z]+/g, '-'),
  name,
  type: `n8n-nodes-base.${type}`,
  typeVersion,
  position,
  parameters,
  ...extra,
})

const respond = (name, code, body, position) =>
  node(name, 'respondToWebhook', 1.1, position, {
    respondWith: 'json',
    responseBody: body,
    options: { responseCode: code },
  })

const workflow = {
  id: 'EverGuideEvents1',
  name: 'EverGuide events (demo)',
  nodes: [
    node(
      'EverGuide webhook',
      'webhook',
      2,
      [0, 0],
      { httpMethod: 'POST', path: 'everguide', responseMode: 'responseNode', options: {} },
      { webhookId: '6f3b2a10-5c1e-4c8a-9f3e-2d7a1b0c9e44' },
    ),
    node('Verify signature', 'code', 2, [220, 0], { jsCode: read('verify-signature.js') }),
    node('Signature valid?', 'if', 2, [440, 0], {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' },
        conditions: [
          {
            id: 'valid',
            leftValue: '={{ $json.valid }}',
            rightValue: '',
            operator: { type: 'boolean', operation: 'true', singleValue: true },
          },
        ],
        combinator: 'and',
      },
      options: {},
    }),
    respond('Accept', 200, '={{ { "received": true } }}', [660, -100]),
    respond('Reject', 401, '={{ { "error": "invalid signature" } }}', [660, 100]),
    node('Skip repeats', 'removeDuplicates', 2, [880, -100], {
      operation: 'removeItemsSeenInPreviousExecutions',
      dedupeValue: '={{ $json.event.id }}',
      options: {},
    }),
    node('Compose email', 'code', 2, [1100, -100], { jsCode: read('compose-email.js') }),
    node(
      'Send to test inbox',
      'emailSend',
      2.1,
      [1320, -100],
      {
        fromEmail: 'EverGuide (demo) <no-reply@everguide.test>',
        toEmail: '={{ $json.to }}',
        subject: '={{ $json.subject }}',
        emailFormat: 'text',
        text: '={{ $json.text }}',
        options: { appendAttribution: false },
      },
      { credentials: { smtp: { id: 'everguide-test-inbox', name: 'EverGuide test inbox' } } },
    ),
  ],
  connections: {
    'EverGuide webhook': { main: [[{ node: 'Verify signature', type: 'main', index: 0 }]] },
    'Verify signature': { main: [[{ node: 'Signature valid?', type: 'main', index: 0 }]] },
    'Signature valid?': {
      main: [
        [{ node: 'Accept', type: 'main', index: 0 }],
        [{ node: 'Reject', type: 'main', index: 0 }],
      ],
    },
    Accept: { main: [[{ node: 'Skip repeats', type: 'main', index: 0 }]] },
    'Skip repeats': { main: [[{ node: 'Compose email', type: 'main', index: 0 }]] },
    'Compose email': { main: [[{ node: 'Send to test inbox', type: 'main', index: 0 }]] },
  },
  settings: { executionOrder: 'v1' },
  active: false,
}

writeFileSync(
  new URL('workflows/everguide-events.json', here),
  JSON.stringify(workflow, null, 2) + '\n',
)
console.log('Wrote workflows/everguide-events.json')
