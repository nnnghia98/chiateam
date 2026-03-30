# HTTP Test Server - Quick Reference

Examples of using the HTTP test server for development testing.

## Prerequisites

Start the bot in development mode:

```bash
yarn dev:bot
```

Wait for the message:

```
✅ Test server running on http://localhost:3001
```

## Basic Command Testing

### Add yourself to bench

```bash
curl -X POST http://localhost:3001/test-command \
  -H "Content-Type: application/json" \
  -d '{"command": "/addme"}'
```

### Add multiple players

```bash
curl -X POST http://localhost:3001/test-command \
  -H "Content-Type: application/json" \
  -d '{"command": "/add John, Jane, Bob"}'
```

### View bench

```bash
curl -X POST http://localhost:3001/test-command \
  -H "Content-Type: application/json" \
  -d '{"command": "/bench"}'
```

### Divide teams

```bash
curl -X POST http://localhost:3001/test-command \
  -H "Content-Type: application/json" \
  -d '{"command": "/chiateam"}'
```

### View teams

```bash
curl -X POST http://localhost:3001/test-command \
  -H "Content-Type: application/json" \
  -d '{"command": "/team"}'
```

## Advanced Usage

### Custom User ID

```bash
curl -X POST http://localhost:3001/test-command \
  -H "Content-Type: application/json" \
  -d '{
    "command": "/addme",
    "userId": 123456789
  }'
```

### Custom User Info

```bash
curl -X POST http://localhost:3001/test-command \
  -H "Content-Type: application/json" \
  -d '{
    "command": "/addme",
    "userId": 123456789,
    "userInfo": {
      "first_name": "John",
      "username": "johndoe"
    }
  }'
```

## Match Commands

### Set venue

```bash
curl -X POST http://localhost:3001/test-command \
  -H "Content-Type: application/json" \
  -d '{"command": "/san 19h15 - 28/03/2026 - sân số 8"}'
```

### Save match

```bash
curl -X POST http://localhost:3001/test-command \
  -H "Content-Type: application/json" \
  -d '{"command": "/match SAVE"}'
```

### Update match score

```bash
curl -X POST http://localhost:3001/test-command \
  -H "Content-Type: application/json" \
  -d '{"command": "/match 28/03/2026 10-12"}'
```

### View matches

```bash
curl -X POST http://localhost:3001/test-command \
  -H "Content-Type: application/json" \
  -d '{"command": "/matches"}'
```

## Cleanup

### Clear bench

```bash
curl -X POST http://localhost:3001/test-command \
  -H "Content-Type: application/json" \
  -d '{"command": "/clearbench"}'
```

### Clear teams

```bash
curl -X POST http://localhost:3001/test-command \
  -H "Content-Type: application/json" \
  -d '{"command": "/clearteam"}'
```

## Using with Other Tools

### HTTPie

```bash
http POST localhost:3001/test-command command="/addme"
```

### Postman

1. Method: `POST`
2. URL: `http://localhost:3001/test-command`
3. Headers: `Content-Type: application/json`
4. Body (raw JSON):
   ```json
   {
     "command": "/addme"
   }
   ```

### JavaScript (fetch)

```javascript
fetch('http://localhost:3001/test-command', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    command: '/addme',
    userId: 123456789,
  }),
})
  .then(res => res.json())
  .then(data => console.log(data));
```

### Node.js (http module)

```javascript
const http = require('http');

const data = JSON.stringify({
  command: '/addme',
  userId: 123456789,
});

const options = {
  hostname: 'localhost',
  port: 3001,
  path: '/test-command',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length,
  },
};

const req = http.request(options, res => {
  let responseData = '';

  res.on('data', chunk => {
    responseData += chunk;
  });

  res.on('end', () => {
    console.log(JSON.parse(responseData));
  });
});

req.write(data);
req.end();
```

## Configuration

### Custom Port

Set in your `.env.dev`:

```bash
TEST_SERVER_PORT=3002
```

Then use:

```bash
curl -X POST http://localhost:3002/test-command \
  -H "Content-Type: application/json" \
  -d '{"command": "/addme"}'
```

## Troubleshooting

### Connection refused

- Make sure the bot is running: `yarn dev:bot`
- Check that you see "Test server running" in the console
- Verify the port is correct (default: 3001)

### Command not working

- Check the bot console for errors
- Verify command syntax is correct
- Ensure the user has necessary permissions

### Response errors

- `400`: Missing or invalid command field
- `404`: Wrong endpoint (use `/test-command`)
- `500`: Internal server error (check bot logs)
