/**
 * Shared utilities for Lambda functions
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, UpdateCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');

// Initialize DynamoDB client
const client = new DynamoDBClient({});
const dynamodb = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.TABLE_NAME;

// ============================================================
// Response Helpers
// ============================================================

function response(statusCode, body, headers = {}) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
      ...headers
    },
    body: JSON.stringify(body)
  };
}

function success(data) {
  return response(200, data);
}

function created(data) {
  return response(201, data);
}

function badRequest(message) {
  return response(400, { error: message });
}

function unauthorized(message = 'Unauthorized') {
  return response(401, { error: message });
}

function forbidden(message = 'Forbidden') {
  return response(403, { error: message });
}

function notFound(message = 'Not found') {
  return response(404, { error: message });
}

function serverError(message = 'Internal server error') {
  console.error('Server error:', message);
  return response(500, { error: message });
}

// ============================================================
// Auth Helpers
// ============================================================

function getUserIdFromEvent(event) {
  return event.requestContext?.authorizer?.claims?.sub || null;
}

function getUserEmailFromEvent(event) {
  return event.requestContext?.authorizer?.claims?.email || null;
}

// ============================================================
// DynamoDB Helpers
// ============================================================

async function getItem(pk, sk) {
  const result = await dynamodb.send(new GetCommand({
    TableName: TABLE_NAME,
    Key: { PK: pk, SK: sk }
  }));
  return result.Item;
}

async function putItem(item) {
  await dynamodb.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: item
  }));
}

async function queryItems(pk, skPrefix = null, options = {}) {
  const params = {
    TableName: TABLE_NAME,
    KeyConditionExpression: skPrefix
      ? 'PK = :pk AND begins_with(SK, :sk)'
      : 'PK = :pk',
    ExpressionAttributeValues: {
      ':pk': pk,
      ...(skPrefix && { ':sk': skPrefix })
    },
    ...options
  };

  const result = await dynamodb.send(new QueryCommand(params));
  return result.Items || [];
}

async function queryByGSI(indexName, pk, skPrefix = null, options = {}) {
  const pkAttr = indexName === 'GSI1' ? 'GSI1PK' : 'GSI2PK';
  const skAttr = indexName === 'GSI1' ? 'GSI1SK' : 'GSI2SK';

  const params = {
    TableName: TABLE_NAME,
    IndexName: indexName,
    KeyConditionExpression: skPrefix
      ? `${pkAttr} = :pk AND begins_with(${skAttr}, :sk)`
      : `${pkAttr} = :pk`,
    ExpressionAttributeValues: {
      ':pk': pk,
      ...(skPrefix && { ':sk': skPrefix })
    },
    ...options
  };

  const result = await dynamodb.send(new QueryCommand(params));
  return result.Items || [];
}

async function updateItem(pk, sk, updates) {
  const updateExpression = [];
  const expressionAttributeNames = {};
  const expressionAttributeValues = {};

  Object.entries(updates).forEach(([key, value], index) => {
    const nameKey = `#attr${index}`;
    const valueKey = `:val${index}`;
    updateExpression.push(`${nameKey} = ${valueKey}`);
    expressionAttributeNames[nameKey] = key;
    expressionAttributeValues[valueKey] = value;
  });

  await dynamodb.send(new UpdateCommand({
    TableName: TABLE_NAME,
    Key: { PK: pk, SK: sk },
    UpdateExpression: `SET ${updateExpression.join(', ')}`,
    ExpressionAttributeNames: expressionAttributeNames,
    ExpressionAttributeValues: expressionAttributeValues
  }));
}

async function deleteItem(pk, sk) {
  await dynamodb.send(new DeleteCommand({
    TableName: TABLE_NAME,
    Key: { PK: pk, SK: sk }
  }));
}

// ============================================================
// ID Generation
// ============================================================

function generateId(prefix = '') {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 8);
  return prefix ? `${prefix}_${timestamp}${random}` : `${timestamp}${random}`;
}

function generateInviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// ============================================================
// Validation
// ============================================================

function validateRequired(body, fields) {
  const missing = fields.filter(f => !body[f]);
  if (missing.length > 0) {
    return `Missing required fields: ${missing.join(', ')}`;
  }
  return null;
}

// ============================================================
// Team Membership
// ============================================================

async function isTeamMember(teamId, userId) {
  const member = await getItem(`TEAM#${teamId}`, `MEMBER#${userId}`);
  return !!member;
}

async function isTeamAdmin(teamId, userId) {
  const member = await getItem(`TEAM#${teamId}`, `MEMBER#${userId}`);
  return member?.role === 'admin' || member?.role === 'owner';
}

async function getUserTeams(userId) {
  const items = await queryItems(`USER#${userId}`, 'TEAM#');
  return items.map(item => ({
    teamId: item.SK.replace('TEAM#', ''),
    role: item.role
  }));
}

module.exports = {
  dynamodb,
  TABLE_NAME,
  // Response helpers
  response,
  success,
  created,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  serverError,
  // Auth helpers
  getUserIdFromEvent,
  getUserEmailFromEvent,
  // DynamoDB helpers
  getItem,
  putItem,
  queryItems,
  queryByGSI,
  updateItem,
  deleteItem,
  // ID generation
  generateId,
  generateInviteCode,
  // Validation
  validateRequired,
  // Team membership
  isTeamMember,
  isTeamAdmin,
  getUserTeams
};
