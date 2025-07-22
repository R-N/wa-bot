import { config } from 'dotenv';
config();

import { KnowledgeBaseEngine } from '../../kb/engine.js';
import { LLMClient } from '../../llm/client.js';

export const priority = 0;
export const enabled = false;

const llmClient = new LLMClient({
  url: process.env.LLM_SERVER_URL, 
  role: process.env.LLM_ROLE_FILE
});

let initialized = false;
let initializing = false;
export const init = async () => {
  try {
    if (!initialized && !initializing) {
      initializing = true;
      await engine.init();
      initialized = true;
      initializing = false;
    }
  } catch (err) {
    console.error('Engine init failed:', err);
    queueReply({ text: 'Gagal memuat basis pengetahuan.' });
    return true;
  }
};

const engine = new KnowledgeBaseEngine(
  {
    serverUrl: process.env.KB_SERVER_URL,
    email: process.env.KB_EMAIL,
    password: process.env.KB_PASSWORD,
    spaceId: process.env.KB_SPACE_ID,
  },
  {
    host: process.env.QDRANT_HOST || 'localhost',
    port: parseInt(process.env.QDRANT_PORT || '6333'),
    collectionName: process.env.QDRANT_COLLECTION || 'knowledge_base',
  }
);

export default async (msg, { text, senderId, groupId, queueReply, sessionManager }) => {
  if (!text) return false;

  let hits;
  try {
    hits = await engine.query(text);
    if (hits.length == 0){
      queueReply({ text: 'Maaf, saya tidak menemukan jawaban.' });
      return true;
    }
  } catch (err) {
    console.error('Query failed:', err);
    queueReply({ text: 'Gagal mencari jawaban dari basis pengetahuan.' });
    return true;
  }

  // Build prompt
  const article = hits[0];
  let articleContent = article.content.trim();
  let footer = "";
  if (article.metadata.public){
    footer += "\n\nBaca lebih lanjut: \n" + article.metadata.url + "\n";
  }
  if (article.metadata.request){
    footer += "\n\Link form request: \n" + article.metadata.request + "\n";
  }

  const chatHistory = await sessionManager.getChatHistory(senderId, groupId);

  // Call llama
  try {
    const llamaOutput = await llmClient.generateReply(chatHistory, articleContent);
    queueReply({ text: llamaOutput + footer });
  } catch (err) {
    console.error('LLaMA fallback:', err);

    queueReply({ text: articleContent + footer });
  }

  return true;
};
