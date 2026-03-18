const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load env
require('dotenv').config({ path: path.join(__dirname, '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function seed() {
  console.log('🌱 Seeding Supabase...\n');

  // --- Seed Players ---
  const playersFile = path.join(__dirname, 'data', 'players.json');
  if (fs.existsSync(playersFile)) {
    const players = JSON.parse(fs.readFileSync(playersFile, 'utf-8'));

    // Clear existing players
    await supabase.from('players').delete().neq('id', '');
    console.log('🗑️  Cleared existing players');

    const rows = players.map((p) => ({
      id: p.id,
      name: p.name,
      sub_names: p.subNames,
      telegram_handle: p.telegramHandle || '',
      jersey_number: p.jerseyNumber,
    }));

    const { error: playersError } = await supabase.from('players').insert(rows);
    if (playersError) {
      console.error('❌ Failed to seed players:', playersError.message);
    } else {
      console.log(`✅ Seeded ${rows.length} players`);
    }
  } else {
    console.log('⚠️  No data/players.json found, skipping players');
  }

  // --- Seed Match Data ---
  const matchFile = path.join(__dirname, 'data', 'match.json');
  if (fs.existsSync(matchFile)) {
    const match = JSON.parse(fs.readFileSync(matchFile, 'utf-8'));

    // Clear existing match data
    await supabase.from('match_data').delete().neq('id', '');
    console.log('🗑️  Cleared existing match data');

    const { error: matchError } = await supabase.from('match_data').insert({
      id: match.id,
      teams: match.teams,
      venue: match.venue,
      raw_message: match.rawMessage || null,
      created_at: match.createdAt,
      updated_at: match.updatedAt,
    });

    if (matchError) {
      console.error('❌ Failed to seed match data:', matchError.message);
    } else {
      console.log('✅ Seeded match data');
      console.log(`   Teams: ${match.teams.map(t => `${t.name} (${t.players.length})`).join(', ')}`);
      console.log(`   Venue: ${match.venue.venue || 'N/A'} @ ${match.venue.date || 'N/A'} ${match.venue.time || 'N/A'}`);
    }
  } else {
    console.log('⚠️  No data/match.json found, skipping match data');
  }

  console.log('\n🎉 Done!');
}

seed().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
