const express = require('express')
const favicon = require('serve-favicon')
const storage = require('node-persist')
const sdk = require('applights-sdk')
const version = require('./package').version

const EFFECTS = sdk.effects

const DISCONNECT_TIMEOUT = process.env.TIMEOUT || 10 * 1000

let app = express(), api = express()

let strings = new sdk.StringsController({ timeout: DISCONNECT_TIMEOUT })

storage.init().then(() => {
  console.log('[server]',`Storage initialized`)
  console.log(storage.values())
})

app.use(favicon(`${__dirname}/public/favicon.ico`))

// Rest API
api.get('/info', (req, res) => {
  res.send({
    version: version,
    sdk_version: sdk.version,
    ble_state: strings.service.state,
    connected: strings.service.connected,
    serviceUUID: strings.service.uuid
  })
})

api.get('/effects', (req, res) => {
  res.send(Object.keys(EFFECTS))
})

api.get('/effects/:id', (req, res, next) => {
  let theme = EFFECTS[req.params.id]
  if (typeof theme !== 'undefined') strings.setTheme(theme).then((all) => res.send(all)).catch(next)
  else res.send({ error: `Invalid effect '${req.params.id}'`})
})

api.get('/on', async (req, res, next) => {
  try {
    const response = await strings.turnOn()

    storage.setItem('status', 'on')
    res.send(response)
  } catch (err) {
    next(err)
  }
})

api.get('/off', async (req, res, next) => {
  try {
    const response = await strings.turnOff()

    storage.setItem('status', 'off')
    res.send(response)
  } catch (err) {
    next(err)
  }
})

api.get('/color', async (req, res, next) => {
  const currentColor = await storage.getItem('color')

  res.send(currentColor)
})

api.get('/color/:hex', async (req, res, next) => {
  try {
    const color = await strings.getThemeFromHex(req.params.hex)
    const response = await strings.setTheme(color.buffer)
    console.log('FROM:', req.params.hex, ' setting theme:', response)

    if (color && response) {
      console.log('saving', color.value.substring(1))
      storage.setItem('color', color.value.substring(1))
    }
    res.send({ ...color, ...response })
  } catch (err) {
    next(err)
  }
})

api.get('/status', async (req, res, next) => {
  const status = storage.getItem('status')
  res.send(status === 'on' ? '1' : '0')
})

// /debug route allows passing custom buffer values
if (process.env.DEBUG) {
  api.get('/debug/:a/:b/:c/:d', (req, res, next) => {
    let theme = Buffer.from([req.params.a, req.params.b, req.params.c, req.params.d])
    if (typeof theme !== 'undefined') strings.setTheme(theme).then(res.send).catch(next)
    else res.send({ error: `Invalid theme '${JSON.stringify(theme)}'`})
  })
}

api.use((err, req, res, next) => {
  if (err) res.status(500)
  else res.status(400)

  res.send({ error: err.message || 'Bad Request' })
})

app.use('/api/v1', api)

const server = app.listen(3000, () => { console.info('\x1b[33m%s\x1b[0m', `[express] Listening on ${server.address().port}`) })
