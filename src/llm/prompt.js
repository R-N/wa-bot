import fs from 'fs';
import path from 'path';

export class PromptBuilder {
  constructor(role, article=null, chatHistory = []) {
    this.role = role?.trim() || '';
    this.article = article?.trim() || '';
    this.chatHistory = chatHistory;
    
    const filePath = path.resolve(this.role);
    if (fs.existsSync(filePath)) {
      this.role = fs.readFileSync(filePath, 'utf-8');
    }
  }

  getRole(sender){
    return sender ? 'user' : 'assistant';
  }
  /**
   * Format as OpenAI-style ChatML prompt
   */
  getChatMLPrompt(article=null, chatHistory=null) {
    article = article || this.article;
    chatHistory = chatHistory || this.chatHistory;

    const messages = [];

    // System message (role + article)
    let content = this.role;
    if (article) {
      content += `\n\nArtikel:\n${article}`;
    }
    messages.push({
      role: 'system',
      content
    });

    // Chat history
    for (const { senderId, message } of chatHistory) {
      messages.push({
        role: this.getRole(senderId),
        content: message.trim()
      });
    }

    return messages;
  }

  /**
   * Format as Qwen-style prompt (which also uses ChatML-like syntax)
   */
  getQwenPrompt(article, chatHistory) {
    article = article || this.article;
    chatHistory = chatHistory || this.chatHistory;

    const history = chatHistory.map(({ senderId, message }) => {
      const role = this.getRole(senderId);
      return `
      <|im_start|>${role}
      ${message.trim()}
      <|im_end|>
      `;
    });

    const systemParts = [`<|im_start|>system`, this.role];
    if (article) {
      systemParts.push(`
        ------
        
        Artikel:
        ${article}
      `);
    }
    systemParts.push(`<|im_end|>`);

    return [systemParts.join('\n'), ...history, `<|im_start|>assistant`].join('\n');
  }

  /**
   * (Optional) Format as plain-text debug-friendly version
   */
  getPlainPrompt(article, chatHistory) {
    article = article || this.article;
    chatHistory = chatHistory || this.chatHistory;

    const history = chatHistory.map(({ sender, message }) => {
      return `### ${sender}:\n${message.trim()}`;
    });

    const parts = [
      `## Peran:\n${this.role}`,
      '------',
    ];

    if (article) {
      parts.push(`## Artikel:\n${article}`, '------');
    }

    parts.push(`## Riwayat percakapan:\n${history.join('\n\n')}`, '### Jawaban IT Support: \n');

    return parts.join('\n\n').trim();
  }
}
export default PromptBuilder;
