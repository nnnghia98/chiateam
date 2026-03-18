import { NextResponse } from 'next/server';
import { getMatchData, saveMatchData, generateId, deleteMatchData } from '@/lib/storage';
import { parseTeamMessage, parseVenueMessage } from '@/lib/parser';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const message = body.message;

    if (!message || !message.text) {
      return NextResponse.json({ ok: true });
    }

    const text: string = message.text;
    const textLower = text.toLowerCase();
    const chatId = message.chat?.id;

    // Get or create match data
    let matchData = await getMatchData();
    const now = new Date().toISOString();

    if (!matchData) {
      matchData = {
        id: generateId(),
        teams: [],
        venue: {},
        createdAt: now,
        updatedAt: now,
      };
    }

    let replyText = '';

    // Handle /Team command - team lineup
    if (textLower.startsWith('/team')) {
      const teams = parseTeamMessage(text);
      if (teams.length > 0) {
        matchData.teams = teams;
        matchData.updatedAt = now;
        matchData.rawMessage = text;
        await saveMatchData(matchData);

        const totalPlayers = teams.reduce((sum, t) => sum + t.players.length, 0);
        replyText = `✅ Đã cập nhật đội hình!\n${teams.map(t => `${t.name}: ${t.players.length} người`).join('\n')}\nTổng: ${totalPlayers} người`;
      } else {
        replyText = '❌ Không parse được đội hình. Hãy kiểm tra format.';
      }
    }

    // Handle /San command - venue info or team lineup
    else if (textLower.startsWith('/san')) {
      // Check if it contains team lineup (has 👤)
      if (text.includes('👤')) {
        const teams = parseTeamMessage(text);
        if (teams.length > 0) {
          matchData.teams = teams;
          matchData.updatedAt = now;
          matchData.rawMessage = text;
          await saveMatchData(matchData);

          const totalPlayers = teams.reduce((sum, t) => sum + t.players.length, 0);
          replyText = `✅ Đã cập nhật đội hình!\n${teams.map(t => `${t.name}: ${t.players.length} người`).join('\n')}\nTổng: ${totalPlayers} người`;
        } else {
          replyText = '❌ Không parse được đội hình.';
        }
      } else {
        // Parse venue info
        const venue = parseVenueMessage(text);
        if (venue.date || venue.time || venue.venue) {
          matchData.venue = { ...matchData.venue, ...venue };
          matchData.updatedAt = now;
          await saveMatchData(matchData);

          replyText = `✅ Đã cập nhật thông tin sân!\n`;
          if (venue.date) replyText += `📅 Ngày: ${venue.date}\n`;
          if (venue.time) replyText += `⏰ Giờ: ${venue.time}\n`;
          if (venue.venue) replyText += `📍 Sân: ${venue.venue}\n`;
          if (venue.googleMapLink) replyText += `🗺️ Map: ${venue.googleMapLink}\n`;
        } else {
          replyText = '❌ Không parse được thông tin sân. Format: /San 12/3 - 19h15 - Sân số 8';
        }
      }
    }

    // Handle /reset command
    else if (text.toLowerCase().startsWith('/reset')) {
      await deleteMatchData();
      replyText = '🗑️ Đã xoá toàn bộ dữ liệu trận đấu!';
    }

    // Send reply via Telegram API
    if (replyText && chatId) {
      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      if (botToken) {
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: replyText,
          }),
        });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ ok: true }); // Always return 200 to Telegram
  }
}

export async function GET() {
  return NextResponse.json({ status: 'Bot webhook is running' });
}
