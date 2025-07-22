import { delay } from '@whiskeysockets/baileys'

export const delayNoise = (mean, noise = 0.25) => {
	if (noise < 1) noise = mean * noise
	const min = Math.max(0, mean - noise)
	const max = mean + noise
	return Math.floor(Math.random() * (max - min + 1)) + min
}

export const createMessagingHelpers = (sockRef) => {
	const messageQueue = []
	let processingQueue = false

	const sendMessageWTyping = async (jid, msg) => {
		const sock = sockRef()
		if (!sock?.user) {
			console.log('Socket not ready, skipping message')
			return
		}
		await sock.presenceSubscribe(jid)
		await delay(delayNoise(1000))
		await sock.sendPresenceUpdate('composing', jid)
		await delay(delayNoise(2000))
		await sock.sendPresenceUpdate('paused', jid)
		await sock.sendMessage(jid, msg)
	}

	const queueMessage = (jid, msg) => {
		messageQueue.push({ jid, msg })
		processQueue()
	}

	const processQueue = async () => {
		if (processingQueue) return
		processingQueue = true

		while (messageQueue.length) {
			const { jid, msg } = messageQueue.shift()
			await sendMessageWTyping(jid, msg)
		}

		processingQueue = false
	}

	return { queueMessage }
}
