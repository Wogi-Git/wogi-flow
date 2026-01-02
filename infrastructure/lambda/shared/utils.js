/**
 * Shared utilities for Wogi Flow Team Backend Lambdas
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, DeleteCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');

// Initialize DynamoDB client
const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

/**
 * Standard response helper
 */
function response(statusCode, body, headers = {}) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Team-Id',
      ...headers
    },
    body: JSON.stringify(body)
  };
}

/**
 * Success response
 */
function success(data) {
  return response(200, { success: true, data });
}

/**
 * Created response
 */
function created(data) {
  return response(201, { success: true, data });
}

/**
 * Error response
 */
function error(statusCode, message, details = null) {
  const body = { success: false, error: message };
  if (details) body.details = details;
  return response(statusCode, body);
}

/**
 * Extract user info from JWT claims
 */
function getUserFromEvent(event) {
  const claims = event.requestContext?.authorizer?.jwt?.claims;
  if (!claims) {
    return null;
  }

  return {
    userId: claims.sub,
    email: claims.email,
    name: claims.name || claims.email?.split('@')[0]
  };
}

/**
 * Parse request body
 */
function parseBody(event) {
  try {
    if (!event.body) return {};
    return JSON.parse(event.body);
  } catch {
    return {};
  }
}

/**
 * Get path parameter
 */
function getPathParam(event, name) {
  return event.pathParameters?.[name];
}

/**
 * Get query parameter
 */
function getQueryParam(event, name, defaultValue = null) {
  return event.queryStringParameters?.[name] || defaultValue;
}

/**
 * Generate unique ID
 */
function generateId(prefix = '') {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return prefix ? `${prefix}_${timestamp}${random}` : `${timestamp}${random}`;
}

/**
 * Get ISO timestamp
 */
function now() {
  return new Date().toISOString();
}

module.exports = {
  docClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  DeleteCommand,
  UpdateCommand,
  response,
  success,
  created,
  error,
  getUserFromEvent,
  parseBody,
  getPathParam,
  getQueryParam,
  generateId,
  now
};
