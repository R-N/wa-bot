export const priority = 0

export default async (msg, { queueMessage }) => {
	const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text
	if (!text) return false

	queueMessage(msg.key.remoteJid, { text })
	return true
}
