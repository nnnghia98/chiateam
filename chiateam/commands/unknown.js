const unknownCommand = bot => {
  bot.on('message', msg => {
    // Skip if it's not a command (doesn't start with /)
    if (!msg.text || !msg.text.startsWith('/')) {
      return;
    }

    // Skip if it's a known command
    const knownCommands = [
      '/start',
      '/addme',
      '/chiateam',
      '/unsplit',
      '/list',
      '/remove',
      '/reset',
      '/addlist',
      '/teams',
      // '/switch'
    ];

    const command = msg.text.split(' ')[0];
    if (knownCommands.includes(command)) {
      return;
    }

    // Handle unknown command
    const userName = msg.from.first_name || msg.from.username || 'Unknown User';
    bot.sendMessage(msg.chat.id, `${userName}: chưa integrate, gọi cái lồn`);
  });
};

module.exports = unknownCommand;
