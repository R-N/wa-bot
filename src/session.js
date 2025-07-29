import { createClient } from 'redis';
import { InMemoryRedis } from './memory.js'; // Adjust path

export class ChatSessionManager {
  constructor(botId, redisUrl = null) {
    redisUrl = redisUrl || process.env.REDIS_URL;
    this.botId = botId;
    this.redisUrl = redisUrl;
    this.client = null;
  }

  async init() {
    try {
      const redisClient = createClient({ 
        url: this.redisUrl,
        socket: {
          // connectTimeout: 2000,
          reconnectStrategy: () => false,
        },
      });
      // redisClient.on('error', (err) => console.error('Redis Client Error', err));
      await redisClient.connect();
      this.client = redisClient;
    } catch (err) {
      console.warn('Redis unavailable. Falling back to in-memory store.');
      this.client = new InMemoryRedis();
    }
  }

  sessionKey(senderId, groupId) {
    return groupId
      ? `chat-session:${groupId}:${senderId}`
      : `chat-session:private:${senderId}`;
  }

  extractMsg(msg){
		const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text
		const senderId = msg.key.participant || msg.key.remoteJid;
		const groupId = msg.key.remoteJid.includes('@g.us') ? msg.key.remoteJid : null;
		const mentionedJidList = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    return {
      text, senderId, groupId, mentionedJidList
    }
  }

  async isTalkingToMe(msg) {
    const { senderId, groupId, mentionedJidList } = this.extractMsg(msg);

    const key = this.sessionKey(senderId, groupId);
    const sessionActive = await this.client.exists(key);
  
    const isTagged = mentionedJidList?.includes(this.botId);
    const isPrivate = !groupId;
  
    return sessionActive || isTagged || isPrivate;
  }

  async touchSession(msg) {
    const { senderId, groupId, text } = this.extractMsg(msg);

    const key = this.sessionKey(senderId, groupId);
    await this.client.setEx(key, SESSION_TTL, 'active');
    await this.appendHistory(key, senderId, text);
  }

  async getChatHistory(senderId, groupId) {
    const key = this.sessionKey(senderId, groupId) + ':history';
    const history = await this.client.lRange(key, 0, -1);
    return history.map(msg => JSON.parse(msg));
  }

  async appendHistory(sessionKey, senderId, message) {
    const historyKey = sessionKey + ':history';
    await this.client.rPush(historyKey, JSON.stringify({ senderId, message, at: Date.now() }));
    await this.client.expire(historyKey, SESSION_TTL);
  }

  async close() {
    await this.client.quit();
  }
}
export default ChatSessionManager;
