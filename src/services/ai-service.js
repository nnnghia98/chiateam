const { GoogleGenerativeAI, SchemaType } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Generate a fun match summary in Vietnamese.
 * @param {Object} matchData - match object with homePlayers, awayPlayers, home_score, away_score, etc.
 * @returns {Promise<string|null>}
 */
async function generateMatchSummary(matchData) {
  if (!process.env.GEMINI_API_KEY) return null;
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const prompt = `
Bạn là một bình luận viên bóng đá hài hước. Hãy viết một đoạn tóm tắt vui vẻ cho trận đấu bóng đá nội bộ này bằng tiếng Việt (tối đa 3 câu):

Ngày: ${matchData.match_date}
Tỉ số: Đội nhà ${matchData.home_score} - ${matchData.away_score} Đội khách
Đội nhà: ${(matchData.homePlayers || []).map(p => p.displayName || p.name).join(', ')}
Đội khách: ${(matchData.awayPlayers || []).map(p => p.displayName || p.name).join(', ')}
Sân: ${matchData.san || 'không rõ'}
    `.trim();
    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (err) {
    console.error('❌ Gemini generateMatchSummary error:', err);
    return null;
  }
}

/**
 * Parse a natural-language match result message into structured JSON.
 * Example input: "thua 3-5, Nam ghi 2 bàn, Hùng 1 kiến tạo"
 * @param {string} text
 * @returns {Promise<Object|null>} { home_score, away_score, goals: [{player, count}], assists: [{player, count}] }
 */
async function parseMatchResultText(text) {
  if (!process.env.GEMINI_API_KEY) return null;
  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            home_score: { type: SchemaType.INTEGER },
            away_score: { type: SchemaType.INTEGER },
            goals: {
              type: SchemaType.ARRAY,
              items: {
                type: SchemaType.OBJECT,
                properties: {
                  player: { type: SchemaType.STRING },
                  count: { type: SchemaType.INTEGER },
                },
              },
            },
            assists: {
              type: SchemaType.ARRAY,
              items: {
                type: SchemaType.OBJECT,
                properties: {
                  player: { type: SchemaType.STRING },
                  count: { type: SchemaType.INTEGER },
                },
              },
            },
          },
        },
      },
    });
    const prompt = `Parse this Vietnamese football match result text into JSON. Text: "${text}"`;
    const result = await model.generateContent(prompt);
    return JSON.parse(result.response.text());
  } catch (err) {
    console.error('❌ Gemini parseMatchResultText error:', err);
    return null;
  }
}

module.exports = { generateMatchSummary, parseMatchResultText };
