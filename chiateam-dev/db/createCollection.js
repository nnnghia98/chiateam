const { client } = require('./init.js');

async function createCollections() {
  const db = client.db('chiateam'); // replace with your DB name

  // Create 'chats' collection with validation
  await db.createCollection('chats', {
    validator: {
      $jsonSchema: {
        bsonType: 'object',
        required: ['chatId', 'title', 'createdAt'],
        properties: {
          chatId: { bsonType: 'number' },
          title: { bsonType: 'string' },
          createdAt: { bsonType: 'date' },
        },
      },
    },
  });

  // Create 'list' collection with validation
  await db.createCollection('list', {
    validator: {
      $jsonSchema: {
        bsonType: 'object',
        required: ['chatId', 'members', 'createdAt'],
        properties: {
          chatId: { bsonType: 'number' },
          members: {
            bsonType: 'array',
            items: {
              bsonType: 'object',
              required: ['userId', 'name'],
              properties: {
                userId: { bsonType: 'number' },
                name: { bsonType: 'string' },
              },
            },
          },
          createdAt: { bsonType: 'date' },
        },
      },
    },
  });
}
