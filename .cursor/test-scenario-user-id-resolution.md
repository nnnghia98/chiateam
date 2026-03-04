# Test Scenario: User ID Resolution for Match Save

## Problem Fixed
Previously, `resolvePlayer()` used partial name matching, causing "Nghia2" to match the registered player "Nghia". Now resolution uses:
1. **Telegram user_id** (when available) - Most stable
2. **Exact name match** (fallback) - Only when name exactly matches

## Resolution Priority

### Identifier Stability Ranking (Best → Worst)
1. **`user_id` (Telegram ID)** ✅ Most Stable
   - Assigned by Telegram, never changes
   - Persists even if user changes display name or username
   - Only available for entries added via `/addme`

2. **`number` (Shirt Number)** ⚠️ Less Stable
   - Can change if player updates their registration
   - Used for stats commands (`/match goal 10 2`)

3. **`name`** ❌ Least Stable
   - User can change first_name in Telegram anytime
   - Used as fallback only

## Flow Examples

### Case 1: You use /addme (has userId)
```
1. /addme
   → members.set(123456789, { name: "Nghia (@user)", userId: 123456789 })
   
2. /register 10
   → DB: players { id: 1, user_id: 123456789, number: 10, name: "Nghia" }
   
3. /addtoteam HOME 1
   → teamA.set(fakeId, { name: "Nghia (@user)", userId: 123456789 })
   
4. /match SAVE
   → resolvePlayer({ name: "Nghia (@user)", userId: 123456789 }, allPlayers)
   → getPlayerByUserId(123456789) → finds player with id: 1 ✅
   → Result: { playerId: 1, displayName: "Nghia (@user)" }
   → Saved to match_players with player_id = 1
```

### Case 2: Someone else uses /add "Nghia2" (no userId)
```
1. /add Nghia2
   → members.set(fakeId, { name: "Nghia2" })  // no userId
   
2. /addtoteam HOME 1
   → teamA.set(fakeId, { name: "Nghia2" })  // no userId
   
3. /match SAVE
   → resolvePlayer({ name: "Nghia2" }, allPlayers)
   → getUserId() → undefined, skip user_id lookup
   → Exact name check: "nghia2" === "nghia" ? NO ❌
   → Result: { playerId: null, displayName: "Nghia2" }
   → Saved to match_players with player_id = NULL, display_name = "Nghia2"
```

### Case 3: Exact name match (without userId)
```
1. /add Nghia
   → members.set(fakeId, { name: "Nghia" })  // no userId
   
2. /addtoteam HOME 1
   → teamA.set(fakeId, { name: "Nghia" })
   
3. /match SAVE
   → resolvePlayer({ name: "Nghia" }, allPlayers)
   → getUserId() → undefined
   → Exact name check: "nghia" === "nghia" ? YES ✅
   → Result: { playerId: 1, displayName: "Nghia" }
   → Saved to match_players with player_id = 1
```

## Expected Behavior After Fix

### Scenario from User
1. User with name "Nghia" does `/addme`
   - Stored as `{ name: "Nghia (@user)", userId: 123456789 }`
   
2. Same user does `/add Nghia2`
   - Stored as `{ name: "Nghia2" }` (no userId, different name)
   
3. Both added to team and saved via `/match SAVE`
   - **"Nghia (@user)"**: Resolved by `user_id` → linked to registered player
   - **"Nghia2"**: No userId, no exact match → stays as display-only (different player)
   
✅ Result: Two separate entries in match lineup, no duplicate counting

## Code Changes Summary

1. **`src/utils/team-member.js`** (NEW)
   - `toEntry(name, userId?)` - Creates entry with optional userId
   - `getDisplayName(value)` - Extracts display name
   - `getUserId(value)` - Extracts userId if present

2. **`src/commands/add/add-me.js`**
   - Changed: `members.set(userId, toEntry(name, userId))`
   - Stores userId so it can be used for resolution

3. **`src/commands/add/add.js`**
   - Changed: `members.set(fakeId, toEntry(name))`
   - No userId (manually added names)

4. **`src/commands/match/match.js`**
   - `resolvePlayer()` now async, checks `getPlayerByUserId(userId)` first
   - Falls back to exact name match only
   - Removed partial matching (was causing bug)
   - `buildPlayerEntries()` now returns Promise

5. **All team management commands**
   - Updated to use `getDisplayName()` helper
   - Carry full entry `{ name, userId? }` through the flow
