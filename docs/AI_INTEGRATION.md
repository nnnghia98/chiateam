# Google AI Integration Guide

## ✅ Completed Integration

Your Google AI (Gemini) has been successfully integrated into the Chiateam Bot!

### 🔑 API Key Configuration

- **Status**: Configured ✅
- **API Key**: `your_google_ai_studio_key`
- **Location**: `.env` file
- **Model**: `gemini-2.5-flash` (latest and fast)

---

## 🎯 Available AI Features

### 1. **AI Chat Command** - `/ai`

Ask the AI any question and get instant answers.

**Usage:**

```
/ai <your question>
```

**Examples:**

- `/ai Hãy viết một câu slogan cho đội bóng`
- `/ai Gợi ý tên đội bóng hay`
- `/ai Tóm tắt luật bóng đá 5 người`
- `/ai Viết một bài thơ về bóng đá`

### 2. **AI Chat Session** - `/aichat`

Maintains conversation context for multi-turn conversations.

**Usage:**

```
/aichat <your message>
/aichat reset  # Reset conversation to start fresh
```

**Examples:**

- `/aichat Hãy giúp tôi nghĩ tên cho đội bóng`
- `/aichat Tên đó phải liên quan đến sấm sét`
- `/aichat Giờ hãy viết slogan cho tên đó`
- `/aichat reset` # Start new conversation

### 3. **AI Match Commentary** (Automatic)

When viewing matches with results, AI automatically generates fun Vietnamese commentary!

**Commands that trigger AI commentary:**

- `/match` - View match details (includes AI commentary if match has score)
- `/match <date> <score>` - Update match score (generates AI commentary)

**Example:**

```
/match 3-2
```

The bot will show match details + AI-generated fun commentary about the game! 🎤⚽

---

## 📁 Files Modified

### New Files:

1. **`/bot/commands/ai/ai.js`** - New AI command implementation

### Modified Files:

1. **`.env`** - Added `GEMINI_API_KEY`
2. **`/bot/commands/match/match.js`** - Integrated AI match summaries
3. **`/bot/commands/index.js`** - Exported AI command
4. **`/bot/index.js`** - Registered AI command

---

## 🧪 Testing

### Test AI Chat:

Send these commands in your Telegram bot:

```
/ai Xin chào! Bạn là ai?
/ai Viết một câu slogan về teamwork
```

### Test AI Chat Session:

```
/aichat Hãy giúp tôi đặt tên đội bóng
/aichat Tên phải liên quan đến rồng
/aichat Giờ viết slogan cho nó
/aichat reset
```

### Test AI Match Commentary:

1. Create/view a match with score:
   ```
   /match 28/03/2026 3-2
   ```
2. The AI will generate a fun commentary in Vietnamese!

---

## 🎨 AI Commentary Example

When you update a match score, the bot will show something like:

```
⚽ Trận đấu 28/03/2026 ⚽

📍 Sân: Sân ABC
💸 Tiền sân: 500,000 VND

📊 Kết quả: 3 - 2

👤 HOME:
• Nam (2⚽ 1🎯)
• Hùng
• Tuấn

👤 AWAY:
• Minh (1⚽)
• Long (⭐)
• Bình

🤖 Bình luận AI:
Trận cầu kịch tính! Đội nhà giành chiến thắng vàng với tỷ số 3-2
nhờ vào màn trình diễn xuất sắc của Nam với cú đúp. Đội khách tuy
thua nhưng đã chiến đấu hết mình!
```

---

## 🔧 Technical Details

### AI Service Functions:

Located in `/api/services/ai-service.js`:

1. **`generateMatchSummary(matchData)`**
   - Generates fun Vietnamese commentary for completed matches
   - Maximum 3 sentences
   - Automatically called when viewing/updating matches with scores

2. **`parseMatchResultText(text)`**
   - Parses natural language match results
   - Structured JSON output
   - Available for future enhancements

### SDK Used:

- **Package**: `@google/generative-ai` v0.21.0
- **Already installed** in your `package.json`
- **No additional installation needed**

---

## 🚀 Deployment Notes

When deploying to production:

1. **Update `.env` in production** with the API key:

   ```bash
   GEMINI_API_KEY=your_google_ai_studio_key
   ```

2. **Restart the bot**:

   ```bash
   yarn start:bot
   ```

3. **Monitor API usage** at [Google AI Studio](https://aistudio.google.com/)

---

## 📝 Notes

- The AI key is currently hardcoded in `.env` - keep it secure!
- Google Gemini Flash model is free and fast
- AI commentary is optional - if API fails, match still displays normally
- Chat sessions are in-memory and reset on bot restart

---

## 🎉 Ready to Use!

Your bot is now AI-powered! Try the commands in your Telegram group and enjoy the AI features! 🤖⚽
