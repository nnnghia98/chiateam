const TelegramBot = require('node-telegram-bot-api');

// Replace this with your actual bot token
const token = 'REDACTED_TELEGRAM_BOT_TOKEN';
const bot = new TelegramBot(token, { polling: true });

// Store members who typed /addme
const members = new Map();

// Expected number of members before auto-split
const EXPECTED_MEMBER_COUNT = 4; // Adjust as needed

// Command: /start
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, "👋 Welcome! Type /addme to join the list.");
});

// Command: /addme
bot.onText(/\/addme/, (msg) => {
    const userId = msg.from.id;
    const name = msg.from.first_name + (msg.from.username ? ` (@${msg.from.username})` : "");
  
    if (members.has(userId)) {
      bot.sendMessage(msg.chat.id, `⚠️ ${name}, you are already in the list.`);
      return;
    }
  
    members.set(userId, name);
    bot.sendMessage(msg.chat.id, `✅ ${name} has been added to the list.`);
  });
  
  

// Command: /split - manual trigger
bot.onText(/\/split/, (msg) => {
  if (members.size < 2) {
    bot.sendMessage(msg.chat.id, "❗ Not enough members to split.");
    return;
  }

  lastMembersBeforeSplit = new Map(members);  // Backup full list

  const names = Array.from(members.values());
  shuffleArray(names);

  const half = Math.ceil(names.length / 2);
  groupA = names.slice(0, half);
  groupB = names.slice(half);

  const message = `🎲 *Random Groups* 🎲\n\n👤 *Group A:*\n${groupA.join('\n')}\n\n👤 *Group B:*\n${groupB.join('\n')}`;

  bot.sendMessage(msg.chat.id, message, { parse_mode: 'Markdown' });

  members.clear();  // Clear list after split
});


  bot.onText(/\/unsplit/, (msg) => {
    if (lastMembersBeforeSplit.size === 0) {
      bot.sendMessage(msg.chat.id, "⚠️ No previous list to restore.");
      return;
    }
  
    members.clear();
    for (let [id, name] of lastMembersBeforeSplit) {
      members.set(id, name);
    }
  
    bot.sendMessage(msg.chat.id, "✅ The member list has been restored to the state before the last split.");
  });
  

// Optional Command: /list - show current members
bot.onText(/\/list/, (msg) => {
  if (members.size === 0) {
    bot.sendMessage(msg.chat.id, "No members have joined yet.");
    return;
  }
  const names = Array.from(members.values());
  bot.sendMessage(msg.chat.id, `👥 Current members:\n${names.join('\n')}`);
});

// Function to split groups randomly
function splitGroups(chatId) {
  const names = Array.from(members.values());
  shuffleArray(names);

  const half = Math.ceil(names.length / 2);
  const groupA = names.slice(0, half);
  const groupB = names.slice(half);

  const message = `🎲 *Random Groups* 🎲\n\n👤 *Group A:*\n${groupA.join('\n')}\n\n👤 *Group B:*\n${groupB.join('\n')}`;

  bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });

  members.clear();  // Reset for next round
}

// Fisher-Yates Shuffle
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

// Command: /remove <name> - remove a member by name (admin-style command)
bot.onText(/\/remove (.+)/, (msg, match) => {
    const nameToRemove = match[1].trim().toLowerCase();
  
    if (!nameToRemove) {
      bot.sendMessage(msg.chat.id, "⚠️ Please provide a name to remove. Example:\n`/remove John`", { parse_mode: 'Markdown' });
      return;
    }
  
    let removed = false;
  
    for (let [userId, name] of members) {
      if (name.toLowerCase().includes(nameToRemove)) {
        members.delete(userId);
        bot.sendMessage(msg.chat.id, `❌ Removed *${name}* from the list.`, { parse_mode: 'Markdown' });
        removed = true;
        break;  // Remove only first match, adjust if you want to remove all
      }
    }
  
    if (!removed) {
      bot.sendMessage(msg.chat.id, `⚠️ No member found matching "${nameToRemove}".`);
    }
  });

  // Command: /reset - clear the entire member list
bot.onText(/\/reset/, (msg) => {
    if (members.size === 0) {
      bot.sendMessage(msg.chat.id, "📝 The member list is already empty.");
      return;
    }
  
    members.clear();
    bot.sendMessage(msg.chat.id, "✅ The member list has been cleared.");
  });

  // Command: /addlist name1, name2, name3 - add multiple names at once, avoid duplicates
// Command: /addlist [name1, name2, name3] - add multiple names, avoid duplicates
bot.onText(/\/addlist\s*\[(.+)\]/, (msg, match) => {
    const rawNames = match[1];
    const namesToAdd = rawNames.split(',').map(n => n.trim()).filter(n => n);
  
    if (namesToAdd.length === 0) {
      bot.sendMessage(msg.chat.id, "⚠️ Please provide at least one name inside brackets. Example:\n`/addlist [John, Mary, Alice]`", { parse_mode: 'Markdown' });
      return;
    }
  
    const existingNames = Array.from(members.values()).map(name => name.toLowerCase());
  
    let addedCount = 0;
    namesToAdd.forEach(name => {
      if (!existingNames.includes(name.toLowerCase())) {
        const fakeId = Date.now() + Math.random();
        members.set(fakeId, name);
        addedCount++;
      }
    });
  
    if (addedCount === 0) {
      bot.sendMessage(msg.chat.id, "⚠️ No new names were added. All provided names already exist in the list.");
    } else {
      bot.sendMessage(msg.chat.id, `✅ Added ${addedCount} new member(s) to the list.`);
    }
  });
  

  // Command: /switch [name1, name2] - swap members from Group A to B, pick same amount from B
  bot.onText(/\/switch\s*\[(.+)\]/, (msg, match) => {
    if (groupA.length === 0 || groupB.length === 0) {
      bot.sendMessage(msg.chat.id, "⚠️ Groups not available. Use /split first.");
      return;
    }
  
    const rawNames = match[1];
    const namesToSwitch = rawNames.split(',').map(n => n.trim()).filter(n => n);
  
    if (namesToSwitch.length === 0) {
      bot.sendMessage(msg.chat.id, "⚠️ Provide at least one name to switch. Example:\n`/switch [John, Mary]`", { parse_mode: 'Markdown' });
      return;
    }
  
    // Check all names exist in Group A
    for (let name of namesToSwitch) {
      if (!groupA.some(n => n.toLowerCase() === name.toLowerCase())) {
        bot.sendMessage(msg.chat.id, `⚠️ ${name} is not in Group A.`);
        return;
      }
    }
  
    if (groupB.length < namesToSwitch.length) {
      bot.sendMessage(msg.chat.id, "⚠️ Not enough members in Group B to swap.");
      return;
    }
  
    // Remove members from Group A
    const newGroupA = groupA.filter(n => !namesToSwitch.some(s => s.toLowerCase() === n.toLowerCase()));
  
    // Randomly select members from Group B
    const shuffledB = [...groupB];
    shuffleArray(shuffledB);
    const pickedFromB = shuffledB.slice(0, namesToSwitch.length);
  
    // Remove picked members from Group B
    const newGroupB = groupB.filter(n => !pickedFromB.includes(n));
  
    // Perform the swap
    groupA = [...newGroupA, ...pickedFromB];
    groupB = [...newGroupB, ...namesToSwitch];
  
    // Show new groups
    const message = `🔄 *Groups After Swap*\n\n👤 *Group A:*\n${groupA.join('\n')}\n\n👤 *Group B:*\n${groupB.join('\n')}`;
    bot.sendMessage(msg.chat.id, message, { parse_mode: 'Markdown' });
  });
  


console.log("🤖 Bot is running...");
