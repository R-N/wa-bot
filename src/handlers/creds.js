export const event = 'creds.update'
export const enabled = true

export const init = null;

export default async (data, { saveCreds }) => {
	await saveCreds()
}
