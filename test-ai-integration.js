#!/usr/bin/env node

/**
 * Test Google AI Integration
 * Run with: node test-ai-integration.js
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

async function testAIIntegration() {
  console.log('🧪 Testing Google AI Integration...\n');

  // Check API key
  console.log('1️⃣ Checking API Key...');
  if (!process.env.GEMINI_API_KEY) {
    console.error('❌ GEMINI_API_KEY not found in environment');
    process.exit(1);
  }
  console.log(
    '✅ API Key found:',
    `${process.env.GEMINI_API_KEY.substring(0, 10)}...`
  );

  // Test AI Service
  console.log('\n2️⃣ Testing AI Service...');
  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const prompt = 'Viết một câu slogan ngắn gọn về bóng đá (5-7 chữ)';
    console.log('   Prompt:', prompt);

    const result = await model.generateContent(prompt);
    const response = result.response.text();

    console.log('✅ AI Response:', response);
  } catch (error) {
    console.error('❌ AI Service Error:', error.message);
    process.exit(1);
  }

  // Test Match Summary Generation
  console.log('\n3️⃣ Testing Match Summary Generation...');
  try {
    const { generateMatchSummary } = require('./api/services/ai-service');

    const mockMatch = {
      match_date: '2026-03-28',
      home_score: 3,
      away_score: 2,
      san: 'Sân ABC',
      homePlayers: [
        { displayName: 'Nam', goals: 2, assists: 1 },
        { displayName: 'Hùng', goals: 1 },
        { displayName: 'Tuấn' },
      ],
      awayPlayers: [
        { displayName: 'Minh', goals: 1 },
        { displayName: 'Long', isMvp: true },
        { displayName: 'Bình', goals: 1 },
      ],
    };

    const summary = await generateMatchSummary(mockMatch);

    if (summary) {
      console.log('✅ Match Summary Generated:');
      console.log(`   ${summary}`);
    } else {
      console.log('⚠️  Summary is null (API key might not be set)');
    }
  } catch (error) {
    console.error('❌ Match Summary Error:', error.message);
    process.exit(1);
  }

  console.log('\n✅ All tests passed! AI integration is working! 🎉');
}

testAIIntegration().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
