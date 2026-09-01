require('../config/load-env').loadEnv();

const { createZaloBotClient } = require('../platforms/zalo/client');

function requireEnvironmentValue(env, name) {
  const value = String(env?.[name] ?? '').trim();

  if (!value) {
    throw new Error(`Missing ${name}.`);
  }

  return value;
}

async function runZaloWebhookCommand({
  action = process.argv[2],
  env = process.env,
  client = createZaloBotClient({
    token: requireEnvironmentValue(env, 'ZALO_BOT_TOKEN'),
  }),
  log = console.log,
} = {}) {
  if (action === 'set') {
    const result = await client.setWebhook(
      requireEnvironmentValue(env, 'ZALO_WEBHOOK_URL'),
      requireEnvironmentValue(env, 'ZALO_WEBHOOK_SECRET')
    );

    if (result?.verification?.ok === false) {
      throw new Error(
        `Zalo saved the webhook, but verification failed (${result.verification.outcome || 'unknown outcome'}).`
      );
    }

    log('✅ Zalo webhook registered.');
    return result;
  }

  if (action === 'info') {
    const result = await client.getWebhookInfo();
    log(JSON.stringify(result, null, 2));
    return result;
  }

  if (action === 'test') {
    const result = await client.testWebhook();
    log(JSON.stringify(result, null, 2));

    if (result?.ok === false) {
      throw new Error(
        `Zalo webhook test failed (${result.outcome || 'unknown outcome'}).`
      );
    }

    return result;
  }

  if (action === 'delete') {
    const result = await client.deleteWebhook();
    log('✅ Zalo webhook removed.');
    return result;
  }

  throw new Error('Use set, info, test, or delete.');
}

if (require.main === module) {
  runZaloWebhookCommand().catch(error => {
    console.error(`❌ ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = {
  requireEnvironmentValue,
  runZaloWebhookCommand,
};
