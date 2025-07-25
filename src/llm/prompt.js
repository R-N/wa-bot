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

  buildSystemPart(article=null){
    let systemParts = [];
    if (this.role){
      systemParts.push(this.role);
    }
    if (article) {
      if (systemParts.length){
        systemParts.push(`

          -------

        `);
      }
      systemParts.push(`
        ### Artikel:
        ${article}
      `);
    }
    return systemParts;
  }
  /**
   * Format as OpenAI-style ChatML prompt
   */
  getChatMLPrompt(article=null, chatHistory=null) {
    article = article || this.article;
    chatHistory = chatHistory || this.chatHistory;

    const messages = [];

    let systemParts = this.buildSystemPart(article);
    if (systemParts.length){
      messages.push({
        role: 'system',
        content: systemParts.join("\n\n")
      });
    }

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

    let systemParts = this.buildSystemPart(article);
    if (systemParts.length){
      systemParts = [
        `<|im_start|>system`,
        ...systemParts,
        `<|im_end|>`
      ];
    }


    return [
      systemParts.join('\n'), 
      history.join('\n'), 
      `<|im_start|>assistant`
    ].join('\n\n');
  }

  /**
   * (Optional) Format as plain-text debug-friendly version
   */
  getPlainPrompt(article, chatHistory) {
    article = article || this.article;
    chatHistory = chatHistory || this.chatHistory;

    let history = chatHistory.map(({ senderId, message }) => {
      return `
        ### ${this.getRole(senderId)}:
        ${message.trim()}
      `;
    });
    if (history.length){
      history = [
        `## Riwayat percakapan:`,
        ...history,
      ];
    }

    
    let systemParts = this.buildSystemPart(article);
    if (systemParts.length){
      systemParts = [
        `## Peran:`,
        ...systemParts,
      ];
    }

    return [
      systemParts.join('\n'), 
      history.join('\n'), 
      `### Jawaban IT Support:`
    ].join('\n\n');
  }
}
export default PromptBuilder;
