export const priority = 0
export const enabled = false

export const init = null;

export default async (msg, { queueReply }) => {
	const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text
	if (!text) return false

	queueReply({ text })
	return true
}
