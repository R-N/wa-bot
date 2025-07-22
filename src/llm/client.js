import axios from 'axios';
import { PromptBuilder } from './prompt.js';

export class LLMClient {
  constructor({ url, role, model=null, headers={} }) {
    this.url = url;
    this.model = model;
    this.promptBuilder = new PromptBuilder(role);
    this.headers = {
      'Content-Type': 'application/json',
      ...headers,
    };
  }

  async send(payload, options={}){
    const res = await axios.post(this.url, payload, {
      headers: this.headers,
      responseType: 'json'
    });

    return res.data.response || res.data.result || res.data.reply || res.data.text;
  }

  async generate(prompt, options = {}) {
    // const cleanedPrompt = prompt.replace(/\n/g, '\\n').replace(/"/g, '\\"');
    const payload = {
      prompt,
      model: this.model,
      ...options,
    };

    return this.send(payload, options);
  }

  async generateReply(chatHistory, article=null, options={}){
    // const prompt = this.promptBuilder.getQwenPrompt(article, chatHistory);
    // return this.generate(prompt, options);

    const payload = {
      role: this.promptBuilder.role,
      chat_history: chatHistory,
      article: article,
      model: this.model,
      ...options,
    }
    
    return this.send(payload, options);
  }
}
