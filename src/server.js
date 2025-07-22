import express from 'express'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { fileURLToPath } from 'url'

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || ''
const HMAC_ENCODING = "base64"

const blacklistEnv = process.env.WEBHOOK_BLACKLIST || ''
const whitelistEnv = process.env.WEBHOOK_WHITELIST || ''

const blacklist = blacklistEnv.split(',').map(f => f.trim()).filter(Boolean)
const whitelist = whitelistEnv.split(',').map(f => f.trim()).filter(Boolean)

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
			const fileName = file.replace('.js', '')

			if (blacklist.includes(fileName)) {
				console.log(`Skipped blacklisted webhook: ${file}`)
				return
			}

			if (whitelist.length > 0 && !whitelist.includes(fileName)) {
				console.log(`Skipped non-whitelisted webhook: ${file}`)
				return
			}

			import(`./webhooks/${file}`).then(module => {
				if (module.enabled === false && !whitelist.includes(fileName)) {
					console.log(`Skipped disabled webhook: ${file}`)
					return
				}

				const route = module.path || `/${fileName}`
				const method = (module.method || 'post').toLowerCase()

				if (typeof module.default === 'function' && app[method]) {
					app[method](route, (req, res) => {
						if (WEBHOOK_SECRET) {
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
			}).catch(err => {
				console.error(`Failed to load webhook ${file}:`, err)
			})
		}
	})

	return app
}
