export const method = 'post'
export const path = '/send-message'
export const enabled = true

// TODO: init support for webhooks
export const init = null;

export default (req, res, sock, queueMessage) => {
	const { phone, message } = req.body

	if (!phone || !message) {
		return res.status(400).send('Missing phone or message')
	}

	if (!sock?.user) {
		return res.status(500).send('WhatsApp not ready yet')
	}

	const jid = phone.replace(/\D/g, '') + '@s.whatsapp.net'
	queueMessage(jid, { text: message })

	console.log(`Sent message to ${phone}: ${message}`)
	res.send('OK')
}
