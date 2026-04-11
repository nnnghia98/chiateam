const { GoogleGenerativeAI } = require('@google/generative-ai');
const { sendMessage } = require('../../utils/chat');
const bot = require('../../telegram-client');

let genAI;
let chatSession;

/**
 * Initialize Google AI with API key
 */
function initializeAI() {
  if (!process.env.GEMINI_API_KEY) {
    console.warn('⚠️ GEMINI_API_KEY not found. AI chat will be disabled.');
    return false;
  }
  genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  return true;
}

/**
 * AI Chat Command
 * Usage: /ai <question>
 * Example: /ai Hãy viết một câu slogan cho đội bóng của chúng tôi
 */
const aiCommand = () => {
  const isAIEnabled = initializeAI();

  bot.onText(/^\/ai(?:\s+(.+))?$/, async (msg, match) => {
    const query = match[1]?.trim();

    if (!isAIEnabled) {
      sendMessage({
        msg,
        type: 'DEFAULT',
        message:
          '❌ Tính năng AI chưa được kích hoạt. Vui lòng cấu hình GEMINI_API_KEY.',
      });
      return;
    }

    if (!query) {
      sendMessage({
        msg,
        type: 'DEFAULT',
        message:
          '💬 *Cách dùng:* `/ai <câu hỏi của bạn>`\n\n' +
          '*Ví dụ:*\n' +
          '• `/ai Hãy viết một câu slogan cho đội bóng`\n' +
          '• `/ai Gợi ý tên đội bóng hay`\n' +
          '• `/ai Tóm tắt luật bóng đá 5 người`',
        options: { parse_mode: 'Markdown' },
      });
      return;
    }

    try {
      // Show typing indicator
      sendMessage({
        msg,
        type: 'DEFAULT',
        message: '🤔 Đang suy nghĩ...',
      });

      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

      // For simple one-off queries
      const result = await model.generateContent(query);
      const response = result.response.text();

      sendMessage({
        msg,
        type: 'DEFAULT',
        message: `🤖 *AI trả lời:*\n\n${response}`,
        options: { parse_mode: 'Markdown' },
      });
    } catch (err) {
      console.error('❌ AI command error:', err);
      sendMessage({
        msg,
        type: 'DEFAULT',
        message:
          '❌ Có lỗi xảy ra khi gọi AI. Vui lòng kiểm tra lại API key hoặc thử lại sau.',
      });
    }
  });

  // AI Chat Session Command (maintains conversation context)
  bot.onText(/^\/aichat(?:\s+(.+))?$/, async (msg, match) => {
    const query = match[1]?.trim();

    if (!isAIEnabled) {
      sendMessage({
        msg,
        type: 'DEFAULT',
        message:
          '❌ Tính năng AI chưa được kích hoạt. Vui lòng cấu hình GEMINI_API_KEY.',
      });
      return;
    }

    if (!query) {
      sendMessage({
        msg,
        type: 'DEFAULT',
        message:
          '💬 *Cách dùng:* `/aichat <tin nhắn>`\n\n' +
          'Khác với `/ai`, lệnh này duy trì ngữ cảnh cuộc trò chuyện.\n' +
          'Sử dụng `/aichat reset` để bắt đầu cuộc trò chuyện mới.',
        options: { parse_mode: 'Markdown' },
      });
      return;
    }

    if (query.toLowerCase() === 'reset') {
      chatSession = null;
      sendMessage({
        msg,
        type: 'DEFAULT',
        message: '✅ Đã reset cuộc trò chuyện AI. Bắt đầu cuộc trò chuyện mới!',
      });
      return;
    }

    try {
      // Show typing indicator
      sendMessage({
        msg,
        type: 'DEFAULT',
        message: '🤔 Đang suy nghĩ...',
      });

      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

      // Initialize chat session if not exists
      if (!chatSession) {
        chatSession = model.startChat({
          history: [],
          generationConfig: {
            maxOutputTokens: 1000,
          },
        });
      }

      const result = await chatSession.sendMessage(query);
      const response = result.response.text();

      sendMessage({
        msg,
        type: 'DEFAULT',
        message: `🤖 *AI trả lời:*\n\n${response}`,
        options: { parse_mode: 'Markdown' },
      });
    } catch (err) {
      console.error('❌ AI chat error:', err);
      sendMessage({
        msg,
        type: 'DEFAULT',
        message:
          '❌ Có lỗi xảy ra khi gọi AI. Vui lòng kiểm tra lại API key hoặc thử lại sau.',
      });
    }
  });
};

module.exports = aiCommand;
