import { config } from 'dotenv';
config();

import { KnowledgeBaseEngine } from '../../kb/engine.js';
import { LLMClient } from '../../llm/client.js';

export const priority = 0;
export const enabled = false;

const llmQuery = new LLMClient({
  url: process.env.LLM_QUERY_SERVER_URL, 
  role: process.env.LLM_QUERY_ROLE_FILE
});
const llmReply = new LLMClient({
  url: process.env.LLM_REPLY_SERVER_URL, 
  role: process.env.LLM_REPLY_ROLE_FILE
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
  const chatHistory = await sessionManager.getChatHistory(senderId, groupId);
  const chatHistoryQuery = chatHistory.filter(({ senderId }) => senderId != null);

  console.log("chatHistoryQuery: " );
  console.log(chatHistoryQuery);
  let query;
  try {
    query = await llmQuery.generateReply(chatHistoryQuery);
  } catch (err) {
    console.error('LLM query fallback:', err);
    query = chatHistoryQuery
      .map(({ message }) => message)
      .join('\n');
  }

  console.log("query: " + query);

  let hits;
  try {
    hits = await engine.query(query);
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

  // Call llama
  try {
    const llamaOutput = await llmReply.generateReply(chatHistory, articleContent);
    queueReply({ text: llamaOutput + footer });
  } catch (err) {
    console.error('LLM reply fallback:', err);
    queueReply({ text: articleContent + footer });
  }

  return true;
};
