## Sprint 11 – Vote System Enhancement & Command Cleanup (chiateam-bot)

**Period**: 2026, Sprint 11  
**Area**: Enhanced poll voting system with persistence, friend syncing, and removed obsolete commands for simplified bot management.

### Goals

- Implement persistent vote storage to survive bot restarts
- Add automatic syncing of poll voters to bench with friend addition support
- Remove deprecated financial and scheduling features
- Improve vote system with comprehensive debug logging
- Simplify command structure and improve user experience

### Key Changes

#### Vote System Enhancements

- **Persistent Vote Storage**:
  - Added `activeVote` to storage system (`bot/utils/storage.js`)
  - Vote state now persists in `storage.json` and survives bot restarts
  - Added `getActiveVote()` and `setActiveVote()` functions
  - Console logs active vote on bot startup

- **New `/sync` Command** (`bot/commands/management/tao-vote.js`):
  - Syncs poll voters into bench automatically
  - Smart friend addition based on vote option:
    - `0` → Not added (not coming)
    - `+1` → Adds voter only
    - `+2` → Adds voter + 1 friend ("Name 1")
    - `+3` → Adds voter + 2 friends ("Name 1", "Name 2")
    - `+4` → Adds voter + 3 friends ("Name 1", "Name 2", "Name 3")
  - Duplicate detection with detailed reporting
  - Friends get unique IDs (`userId_friend_1`, etc.)

- **Enhanced Poll Debugging**:
  - Comprehensive logging for `poll_answer` events
  - Tracks poll creation, vote recording, and sync operations
  - Real-time voter count updates
  - Error handling with detailed error messages

#### Command Improvements

- **New `/reset` Command** (`bot/commands/management/reset.js`):
  - Admin-only command to wipe all JSON data
  - Resets bench, teams, and financial data to defaults
  - Clear confirmation message showing what was reset

- **Enhanced `/tiensan` Command**:
  - Without params: Shows current field cost with proper "current" message
  - With params: Sets new value and shows "updated" message
  - Improved message clarity (changed from "Added" to "Updated")

- **Improved `/addme` Command**:
  - Better duplicate detection with user ID check
  - Console logging for all duplicate attempts
  - Prevents users from adding themselves multiple times

#### Removed Commands & Features

- **Deleted `/teamthua` Command**:
  - Removed winner/loser team tracking
  - Simplified `/chiatien` to equal split for all players
  - Removed from help menu and constants

- **Deleted `/tiennuoc` Command**:
  - Removed water cost tracking
  - Simplified financial management
  - Updated `/reset` to no longer handle water cost

- **Removed Scheduler System**:
  - Deleted `bot/scheduler/weekly-vote.js`
  - Removed automatic weekly poll scheduling
  - Removed commands: `/autopoll`, `/setschedule`, `/setautopoll`, `/setautoremind`, `/testcron`
  - Cleaned up imports and references in main bot file

#### Documentation Updates

- **Help Menu** (`bot/commands/common/start.js`):
  - Added `/sync` to vote section
  - Removed `/teamthua` and `/tiennuoc`
  - Updated vote instructions with `/demvote` and `/sync`

- **Constants** (`bot/utils/constants.js`):
  - Added `/sync` to command list
  - Removed deprecated scheduler commands
  - Removed financial tracking commands

- **Messages** (`bot/utils/messages.js`):
  - Added RESET success message
  - Updated TIEN_SAN with "current" message
  - Enhanced TAO_VOTE instruction with sync details
  - Removed TEAM_THUA and TIEN_NUOC messages

### Technical Details

#### Storage Schema Updates

```json
{
  "bench": [],
  "teamA": [],
  "teamB": [],
  "team3A": [],
  "team3B": [],
  "team3C": [],
  "tiensan": 580000,
  "activeVote": {
    "id": "poll_id",
    "question": "Poll question",
    "options": ["0", "+1", "+2", "+3", "+4"],
    "votes": {},
    "totalVoters": 0
  },
  "lastUpdated": "ISO_DATE"
}
```

#### Friend ID Scheme

- Main voter: Uses Telegram `userId`
- Friend 1: `${userId}_friend_1`
- Friend 2: `${userId}_friend_2`
- Friend 3: `${userId}_friend_3`

### Files Modified

- `bot/commands/management/tao-vote.js` – Enhanced with sync and persistence
- `bot/commands/management/reset.js` – New command
- `bot/commands/management/chia-tien.js` – Simplified (no teamThua)
- `bot/commands/management/tien-san.js` – Enhanced display
- `bot/commands/add/add-me.js` – Better duplicate detection
- `bot/utils/storage.js` – Added activeVote persistence
- `bot/utils/messages.js` – Updated messages
- `bot/utils/constants.js` – Updated command list
- `bot/commands/common/start.js` – Updated help menu
- `bot/index.js` – Removed scheduler, updated imports
- `bot/storage.json.example` – Added activeVote field

### Files Deleted

- `bot/commands/management/team-thua.js`
- `bot/commands/management/tien-nuoc.js`
- `bot/scheduler/weekly-vote.js` (entire scheduler directory)

### Impact

- **Improved Reliability**: Vote state persists through restarts, no data loss
- **Better User Experience**: `/sync` automates member addition from polls with friend support
- **Simplified Management**: Fewer commands to maintain and document
- **Enhanced Debugging**: Comprehensive logging helps diagnose polling issues
- **Cleaner Codebase**: Removed 3 command files and 1 scheduler, ~500 lines of code
- **Flexible Friend Addition**: Smart logic handles group signups automatically

### Testing Checklist

- [x] `/taovote` creates polls with persistence
- [x] Poll votes are tracked in real-time
- [x] `/sync` adds voters and friends correctly
- [x] `/sync` skips duplicates properly
- [x] `/demvote` shows vote counts
- [x] `/clearvote` removes active vote
- [x] `/reset` wipes all data
- [x] `/tiensan` displays current value
- [x] `/addme` prevents duplicates
- [x] Bot restart preserves active vote
- [x] Console logging provides clear diagnostics

---

## Sprint 11.1 – Production Stability & Storage Improvements (chiateam-bot)

**Date**: March 30, 2026  
**Focus**: Fixed production deployment issues, improved error handling, and optimized storage system.

### Issues Resolved

#### 1. Telegram Error Handling (`bot/utils/chat.js`)
- **Problem**: Unhandled rejections from Telegram API errors causing bot crashes
  - "message thread not found" when thread IDs are invalid/deleted
  - "TOPIC_CLOSED" when trying to send to locked topics
- **Solution**: 
  - Added comprehensive try-catch error handling in `sendMessage()`
  - Automatic fallback to main chat when thread errors occur
  - Detailed error logging with context (chatId, threadId, type, error code)
  - Prevents unhandled promise rejections

#### 2. Environment Configuration (`bot/bot/index.js`)
- **Problem**: Production environment variables not loading (`.env.production` ignored)
  - `DEFAULT_THREAD_ID` was undefined, causing "Unknown thread type" warnings
  - `dotenv.config()` only loaded `.env` by default
- **Solution**:
  - Load `.env.production` when `NODE_ENV=production`
  - Load `.env` for development/other environments
  - Added console log showing which config file was loaded
  - Added thread configuration debug logging on startup

#### 3. Storage File Naming
- **Change**: Renamed `data.json` → `storage.json` throughout codebase
- **Files Updated**:
  - `bot/utils/storage.js` – Updated STORAGE_FILE path
  - `.gitignore` – Ignore `storage.json` instead of `data.json`
  - `nodemon.json` – Updated ignore pattern
  - `bot/index.js` – Updated comment
  - `docs/JSON_STORAGE.md` – All references updated
  - `2026/sprint-11.md` – Documentation updated
- **Files Renamed**:
  - `bot/data.json` → `bot/storage.json`
  - `bot/data.json.example` → `bot/storage.json.example`

#### 4. `/reset` Command Completeness (`bot/commands/management/reset.js`)
- **Problem**: `/reset` only cleared 8 out of 10 storage values
  - Missing: `tiennuoc` (water cost), `activeVote` (poll state)
- **Solution**: 
  - Added `setTiennuoc()` and `setActiveVote()` to reset parameters
  - Now properly resets all 10 values to defaults:
    - Arrays → `[]`: bench, teamA, teamB, team3A, team3B, team3C
    - Values → defaults: tiensan (580000), tiennuoc (60000), teamThua (null), activeVote (null)

#### 5. `/reset` Save Loop Fix (`bot/utils/storage.js`)
- **Problem**: Each clear/set operation triggered individual saves (10 saves per reset)
  - Performance issue with rapid file writes
  - Potential file system bottleneck
- **Solution**: 
  - Created batch `resetAll()` function that bypasses auto-save wrappers
  - Uses original Map `clear()` methods directly
  - Single save operation at the end
  - **Result**: 10x performance improvement (1 save instead of 10)

### Technical Improvements

- **Error Resilience**: Bot continues operating even when threads are closed/deleted
- **Production Ready**: Proper environment configuration loading for deployment
- **Naming Consistency**: Clear distinction between storage files and other JSON data
- **Complete Reset**: `/reset` now truly wipes all state to defaults
- **Performance**: Batch operations prevent save loops and improve efficiency

### Files Modified

- `bot/utils/chat.js` – Error handling and fallback logic
- `bot/bot/index.js` – Environment-aware dotenv configuration
- `bot/utils/storage.js` – Renamed file path, added `resetAll()` batch function
- `bot/commands/management/reset.js` – Simplified to use `resetAll()`
- `bot/index.js` – Added `resetAll` to storage exports
- `.gitignore` – Updated storage file pattern
- `nodemon.json` – Updated ignore pattern
- `docs/JSON_STORAGE.md` – Updated all documentation references

### Impact

- **Production Stability**: No more crashes from Telegram thread errors
- **Proper Configuration**: Environment variables load correctly in all environments
- **Clear Naming**: `storage.json` better reflects its purpose
- **Complete Data Wiping**: `/reset` works as expected for fresh starts
- **Better Performance**: Batch operations prevent unnecessary file I/O
