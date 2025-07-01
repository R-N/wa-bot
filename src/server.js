import express from 'express'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { fileURLToPath } from 'url'

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || ''
const HMAC_ENCODING = "base64"

export const createServer = (getSock, queueMessage) => {
	const app = express()

	// Raw body parser to preserve body for signature check
	app.use(express.json({
		verify: (req, res, buf) => {
			req.rawBody = buf
		}
	}))

	const __dirname = path.dirname(fileURLToPath(import.meta.url))
	const webhooksDir = path.join(__dirname, 'webhooks')

	fs.readdirSync(webhooksDir).forEach(file => {
		if (file.endsWith('.js')) {
			import(`./webhooks/${file}`).then(module => {
				if (module.enabled === false) {
					console.log(`Skipped disabled webhook: ${file}`)
					return
				}

				const route = module.path || `/${file.replace('.js', '')}`
				const method = (module.method || 'post').toLowerCase()

				if (typeof module.default === 'function' && app[method]) {
					app[method](route, (req, res) => {
						if (WEBHOOK_SECRET){
							const providedSig = req.get('X-Signature')
	
							if (!providedSig) {
								return res.status(400).send('Missing signature')
							}
	
							const expectedSig = crypto.createHmac('sha256', WEBHOOK_SECRET)
								.update(req.rawBody)
								.digest(HMAC_ENCODING)
	
							if (providedSig !== expectedSig) {
								return res.status(403).send('Invalid signature')
							}
						}

						module.default(req, res, getSock(), queueMessage)
					})
					console.log(`Loaded webhook ${method.toUpperCase()} ${route}`)
				} else {
					console.warn(`Invalid webhook file: ${file}`)
				}
			})
		}
	})

	return app
}
