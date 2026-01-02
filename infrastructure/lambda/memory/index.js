/**
 * Memory API Lambda Handler
 *
 * Endpoints:
 *   GET    /teams/{teamId}/memory         - Pull shared memory
 *   POST   /teams/{teamId}/memory         - Push facts to shared memory
 *   POST   /teams/{teamId}/memory/sync    - Full sync (push + pull)
 *   GET    /teams/{teamId}/memory/metrics - Get memory metrics
 */

const {
  docClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
  success,
  created,
  error,
  getUserFromEvent,
  parseBody,
  getPathParam,
  getQueryParam,
  generateId,
  now
} = require('../shared/utils');

const SHARED_MEMORY_TABLE = process.env.SHARED_MEMORY_TABLE;
const MEMORY_METRICS_TABLE = process.env.MEMORY_METRICS_TABLE;
const TEAMS_TABLE = process.env.TEAMS_TABLE;
const TEAM_MEMBERS_TABLE = TEAMS_TABLE.replace('teams', 'team-members');

// Route handlers
const handlers = {
  'GET /teams/{teamId}/memory': pullMemory,
  'POST /teams/{teamId}/memory': pushMemory,
  'POST /teams/{teamId}/memory/sync': syncMemory,
  'GET /teams/{teamId}/memory/metrics': getMetrics
};

exports.handler = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));

  const user = getUserFromEvent(event);
  if (!user) {
    return error(401, 'Unauthorized');
  }

  const routeKey = event.routeKey;
  const handler = handlers[routeKey];

  if (!handler) {
    return error(404, 'Not found');
  }

  try {
    return await handler(event, user);
  } catch (err) {
    console.error('Error:', err);
    return error(500, 'Internal server error', process.env.DEBUG ? err.message : null);
  }
};

/**
 * Verify team membership
 */
async function verifyMembership(teamId, userId) {
  const membership = await docClient.send(new GetCommand({
    TableName: TEAM_MEMBERS_TABLE,
    Key: { teamId, userId }
  }));
  return membership.Item;
}

/**
 * Pull shared memory facts
 */
async function pullMemory(event, user) {
  const teamId = getPathParam(event, 'teamId');
  const category = getQueryParam(event, 'category');
  const since = getQueryParam(event, 'since'); // ISO timestamp for incremental sync
  const limit = parseInt(getQueryParam(event, 'limit', '100'));

  // Verify membership
  const membership = await verifyMembership(teamId, user.userId);
  if (!membership) {
    return error(403, 'Not a member of this team');
  }

  // Build query
  let params = {
    TableName: SHARED_MEMORY_TABLE,
    Limit: Math.min(limit, 500)
  };

  if (category) {
    params.IndexName = 'category-index';
    params.KeyConditionExpression = 'teamId = :teamId AND category = :category';
    params.ExpressionAttributeValues = {
      ':teamId': teamId,
      ':category': category
    };
  } else {
    params.KeyConditionExpression = 'teamId = :teamId';
    params.ExpressionAttributeValues = {
      ':teamId': teamId
    };
  }

  // Filter by timestamp for incremental sync
  if (since) {
    params.FilterExpression = 'updatedAt > :since';
    params.ExpressionAttributeValues[':since'] = since;
  }

  const result = await docClient.send(new QueryCommand(params));

  // Sort by relevance score
  const facts = (result.Items || []).sort((a, b) =>
    (b.relevanceScore || 0) - (a.relevanceScore || 0)
  );

  return success({
    facts,
    count: facts.length,
    syncedAt: now()
  });
}

/**
 * Push facts to shared memory
 */
async function pushMemory(event, user) {
  const teamId = getPathParam(event, 'teamId');
  const body = parseBody(event);

  // Verify membership
  const membership = await verifyMembership(teamId, user.userId);
  if (!membership) {
    return error(403, 'Not a member of this team');
  }

  if (!body.facts || !Array.isArray(body.facts)) {
    return error(400, 'Facts array is required');
  }

  const timestamp = now();
  const results = {
    added: 0,
    updated: 0,
    errors: []
  };

  for (const fact of body.facts) {
    try {
      if (!fact.fact || typeof fact.fact !== 'string') {
        results.errors.push({ fact, error: 'Invalid fact format' });
        continue;
      }

      const factId = fact.factId || generateId('fact');

      // Check if exists
      const existing = await docClient.send(new GetCommand({
        TableName: SHARED_MEMORY_TABLE,
        Key: { teamId, factId }
      }));

      const item = {
        teamId,
        factId,
        fact: fact.fact,
        category: fact.category || 'general',
        relevanceScore: fact.relevanceScore || 0.5,
        scope: fact.scope || 'team',
        source: fact.source || 'member',
        sourceUserId: user.userId,
        sourceUserEmail: user.email,
        tags: fact.tags || [],
        metadata: fact.metadata || {},
        createdAt: existing.Item?.createdAt || timestamp,
        updatedAt: timestamp
      };

      await docClient.send(new PutCommand({
        TableName: SHARED_MEMORY_TABLE,
        Item: item
      }));

      if (existing.Item) {
        results.updated++;
      } else {
        results.added++;
      }
    } catch (err) {
      results.errors.push({ fact: fact.fact?.substring(0, 50), error: err.message });
    }
  }

  // Record metric
  await recordMetric(teamId, 'push', {
    added: results.added,
    updated: results.updated,
    userId: user.userId
  });

  return success(results);
}

/**
 * Full sync - push local changes and pull team changes
 */
async function syncMemory(event, user) {
  const teamId = getPathParam(event, 'teamId');
  const body = parseBody(event);

  // Verify membership
  const membership = await verifyMembership(teamId, user.userId);
  if (!membership) {
    return error(403, 'Not a member of this team');
  }

  const timestamp = now();
  const results = {
    pushed: { added: 0, updated: 0 },
    pulled: [],
    syncedAt: timestamp
  };

  // Push local facts if provided
  if (body.facts && Array.isArray(body.facts)) {
    for (const fact of body.facts) {
      try {
        if (!fact.fact) continue;

        const factId = fact.factId || generateId('fact');

        const existing = await docClient.send(new GetCommand({
          TableName: SHARED_MEMORY_TABLE,
          Key: { teamId, factId }
        }));

        await docClient.send(new PutCommand({
          TableName: SHARED_MEMORY_TABLE,
          Item: {
            teamId,
            factId,
            fact: fact.fact,
            category: fact.category || 'general',
            relevanceScore: fact.relevanceScore || 0.5,
            scope: fact.scope || 'team',
            source: fact.source || 'member',
            sourceUserId: user.userId,
            sourceUserEmail: user.email,
            tags: fact.tags || [],
            metadata: fact.metadata || {},
            createdAt: existing.Item?.createdAt || timestamp,
            updatedAt: timestamp
          }
        }));

        if (existing.Item) {
          results.pushed.updated++;
        } else {
          results.pushed.added++;
        }
      } catch (err) {
        console.error('Push error:', err);
      }
    }
  }

  // Pull team facts (optionally filtered by since timestamp)
  const pullParams = {
    TableName: SHARED_MEMORY_TABLE,
    KeyConditionExpression: 'teamId = :teamId',
    ExpressionAttributeValues: {
      ':teamId': teamId
    },
    Limit: 500
  };

  if (body.since) {
    pullParams.FilterExpression = 'updatedAt > :since';
    pullParams.ExpressionAttributeValues[':since'] = body.since;
  }

  const pullResult = await docClient.send(new QueryCommand(pullParams));
  results.pulled = (pullResult.Items || []).sort((a, b) =>
    (b.relevanceScore || 0) - (a.relevanceScore || 0)
  );

  // Record metric
  await recordMetric(teamId, 'sync', {
    pushed: results.pushed,
    pulled: results.pulled.length,
    userId: user.userId
  });

  return success(results);
}

/**
 * Get memory metrics
 */
async function getMetrics(event, user) {
  const teamId = getPathParam(event, 'teamId');
  const days = parseInt(getQueryParam(event, 'days', '30'));

  // Verify membership
  const membership = await verifyMembership(teamId, user.userId);
  if (!membership) {
    return error(403, 'Not a member of this team');
  }

  // Get total facts count
  const factsResult = await docClient.send(new QueryCommand({
    TableName: SHARED_MEMORY_TABLE,
    KeyConditionExpression: 'teamId = :teamId',
    ExpressionAttributeValues: {
      ':teamId': teamId
    },
    Select: 'COUNT'
  }));

  // Get category breakdown
  const allFacts = await docClient.send(new QueryCommand({
    TableName: SHARED_MEMORY_TABLE,
    KeyConditionExpression: 'teamId = :teamId',
    ExpressionAttributeValues: {
      ':teamId': teamId
    },
    ProjectionExpression: 'category, relevanceScore'
  }));

  const categories = {};
  let totalRelevance = 0;
  for (const fact of allFacts.Items || []) {
    categories[fact.category] = (categories[fact.category] || 0) + 1;
    totalRelevance += fact.relevanceScore || 0;
  }

  // Get recent metrics
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  const metricsResult = await docClient.send(new QueryCommand({
    TableName: MEMORY_METRICS_TABLE,
    KeyConditionExpression: 'teamId = :teamId AND #ts > :cutoff',
    ExpressionAttributeNames: {
      '#ts': 'timestamp'
    },
    ExpressionAttributeValues: {
      ':teamId': teamId,
      ':cutoff': cutoff.toISOString()
    },
    ScanIndexForward: false,
    Limit: 100
  }));

  const factCount = factsResult.Count || 0;

  return success({
    totalFacts: factCount,
    avgRelevance: factCount > 0 ? totalRelevance / factCount : 0,
    categories,
    recentActivity: metricsResult.Items || [],
    reportedAt: now()
  });
}

/**
 * Record memory metric
 */
async function recordMetric(teamId, action, details) {
  const timestamp = now();

  try {
    await docClient.send(new PutCommand({
      TableName: MEMORY_METRICS_TABLE,
      Item: {
        teamId,
        timestamp,
        action,
        details,
        // TTL: 90 days
        expiresAt: Math.floor(Date.now() / 1000) + (90 * 24 * 60 * 60)
      }
    }));
  } catch (err) {
    console.error('Failed to record metric:', err);
  }
}
