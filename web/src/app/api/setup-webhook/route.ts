import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');
  const token = process.env.TELEGRAM_BOT_TOKEN;

  if (!token) {
    return NextResponse.json({ error: 'TELEGRAM_BOT_TOKEN not set' }, { status: 500 });
  }

  if (!url) {
    return NextResponse.json({
      error: 'Please provide webhook URL as ?url=https://your-domain.com/api/webhook',
      current_token: token.substring(0, 10) + '...',
    }, { status: 400 });
  }

  try {
    // Set webhook
    const setResponse = await fetch(
      `https://api.telegram.org/bot${token}/setWebhook?url=${encodeURIComponent(url)}`
    );
    const setResult = await setResponse.json();

    // Get webhook info
    const infoResponse = await fetch(
      `https://api.telegram.org/bot${token}/getWebhookInfo`
    );
    const infoResult = await infoResponse.json();

    return NextResponse.json({
      setWebhook: setResult,
      webhookInfo: infoResult,
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
