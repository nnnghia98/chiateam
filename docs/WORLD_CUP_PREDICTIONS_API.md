# World Cup Predictions API

## Auth

Admin endpoints require:

```http
x-internal-api-auth: <INTERNAL_API_AUTH_TOKEN>
x-admin-role: admin
Content-Type: application/json
```

Viewer/admin read endpoints may also work with:

```http
x-admin-role: viewer
```

Member-key endpoints do not require admin headers.

## Prediction Values

```text
0 = draw
1 = home team win
2 = away team win
```

Each correct prediction adds `1` point.

Predictions are censored as `***` until match start time. Prediction submission is locked automatically 10 minutes before match start.

## Admin Board

```http
GET /api/world-cup-predictions
```

Returns:

```json
{
  "scoringMode": "OUTCOME",
  "matches": [],
  "members": [],
  "predictions": {
    "tung": {
      "1": {
        "memberId": "tung",
        "matchId": "1",
        "winner": null,
        "value": "***",
        "censored": true,
        "updatedAt": "2026-06-12T08:00:00.000Z"
      }
    }
  },
  "totals": {
    "tung": 0
  }
}
```

## Matches

```http
GET /api/world-cup-predictions/matches
```

```http
POST /api/world-cup-predictions/matches
```

Body:

```json
{
  "matchNumber": 1,
  "date": "2026-06-12",
  "time": "08:00",
  "homeTeam": "Mexico",
  "awayTeam": "USA"
}
```

```http
PUT /api/world-cup-predictions/matches/:matchId
```

Body:

```json
{
  "date": "2026-06-12",
  "time": "09:00",
  "homeTeam": "Mexico",
  "awayTeam": "United States"
}
```

```http
DELETE /api/world-cup-predictions/matches/:matchId
```

`matchId` is usually the match number as a string, for example:

```http
DELETE /api/world-cup-predictions/matches/1
```

## Match Result

```http
POST /api/world-cup-predictions/matches/:matchId/result
```

Body:

```json
{
  "result": 1
}
```

Legacy score body also works:

```json
{
  "score": "2-1"
}
```

## Leaderboard

```http
GET /api/world-cup-predictions/leaderboard
```

Returns:

```json
{
  "rows": [
    {
      "userId": "tung",
      "name": "Tung",
      "username": null,
      "points": 3,
      "predictions": 4,
      "exactScores": 0,
      "correctResults": 3
    }
  ]
}
```

## Members And Keys

```http
GET /api/world-cup-predictions/member-keys
```

```http
POST /api/world-cup-predictions/member-keys
```

Generated 6-digit key:

```json
{
  "memberId": "tung",
  "name": "Tung"
}
```

Manual 6-digit key:

```json
{
  "memberId": "tung",
  "name": "Tung",
  "key": "123456"
}
```

```http
POST /api/world-cup-predictions/member-keys/:memberId/regenerate
```

```http
DELETE /api/world-cup-predictions/member-keys/:memberId
```

Deleting a member key revokes it.

## Member Prediction Page

No admin headers required.

```http
GET /api/world-cup-predictions/member/:key
```

Returns only that member's own prediction board.

```http
PUT /api/world-cup-predictions/member/:key/predictions/:matchId
```

Body:

```json
{
  "prediction": 1
}
```

Errors:

```text
401 INVALID_MEMBER_KEY
404 MATCH_NOT_FOUND
409 MATCH_CLOSED
```

