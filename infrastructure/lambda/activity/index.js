/**
 * Activity API Lambda Handler
 *
 * Endpoints:
 *   GET    /teams/{teamId}/activity - List team activity
 *   POST   /teams/{teamId}/activity - Log activity
 */

const {
  docClient,
  GetCommand,
  PutCommand,
  QueryCommand,
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

const ACTIVITY_LOG_TABLE = process.env.ACTIVITY_LOG_TABLE;
const TEAMS_TABLE = process.env.TEAMS_TABLE;
const TEAM_MEMBERS_TABLE = TEAMS_TABLE.replace('teams', 'team-members');

// Route handlers
const handlers = {
  'GET /teams/{teamId}/activity': listActivity,
  'POST /teams/{teamId}/activity': logActivity
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
 * List team activity
 */
async function listActivity(event, user) {
  const teamId = getPathParam(event, 'teamId');
  const limit = parseInt(getQueryParam(event, 'limit', '50'));
  const since = getQueryParam(event, 'since');
  const type = getQueryParam(event, 'type');

  // Verify membership
  const membership = await verifyMembership(teamId, user.userId);
  if (!membership) {
    return error(403, 'Not a member of this team');
  }

  // Build query
  const params = {
    TableName: ACTIVITY_LOG_TABLE,
    KeyConditionExpression: 'teamId = :teamId',
    ExpressionAttributeValues: {
      ':teamId': teamId
    },
    ScanIndexForward: false, // newest first
    Limit: Math.min(limit, 200)
  };

  // Filter by timestamp
  if (since) {
    params.KeyConditionExpression += ' AND #ts > :since';
    params.ExpressionAttributeNames = { '#ts': 'timestamp' };
    params.ExpressionAttributeValues[':since'] = since;
  }

  // Filter by type
  if (type) {
    params.FilterExpression = 'activityType = :type';
    params.ExpressionAttributeValues[':type'] = type;
  }

  const result = await docClient.send(new QueryCommand(params));

  return success({
    activities: result.Items || [],
    count: result.Items?.length || 0
  });
}

/**
 * Log team activity
 */
async function logActivity(event, user) {
  const teamId = getPathParam(event, 'teamId');
  const body = parseBody(event);

  // Verify membership
  const membership = await verifyMembership(teamId, user.userId);
  if (!membership) {
    return error(403, 'Not a member of this team');
  }

  if (!body.type) {
    return error(400, 'Activity type is required');
  }

  const timestamp = now();

  const activity = {
    teamId,
    timestamp,
    activityId: generateId('act'),
    activityType: body.type,
    description: body.description || '',
    userId: user.userId,
    userEmail: user.email,
    userName: user.name,
    metadata: body.metadata || {},
    // TTL: 90 days for activity logs
    expiresAt: Math.floor(Date.now() / 1000) + (90 * 24 * 60 * 60)
  };

  // Add contextual fields based on activity type
  switch (body.type) {
    case 'task_started':
    case 'task_completed':
      activity.taskId = body.taskId;
      activity.taskTitle = body.taskTitle;
      break;

    case 'proposal_created':
    case 'proposal_voted':
    case 'proposal_decided':
      activity.proposalId = body.proposalId;
      activity.proposalRule = body.proposalRule;
      break;

    case 'memory_synced':
      activity.factsAdded = body.factsAdded || 0;
      activity.factsPulled = body.factsPulled || 0;
      break;

    case 'member_joined':
    case 'member_invited':
    case 'member_left':
      activity.targetUserId = body.targetUserId;
      activity.targetEmail = body.targetEmail;
      break;

    case 'session_started':
    case 'session_ended':
      activity.sessionDuration = body.sessionDuration;
      activity.tasksCompleted = body.tasksCompleted || 0;
      break;

    case 'pattern_promoted':
      activity.factId = body.factId;
      activity.promotedTo = body.promotedTo;
      break;

    case 'correction_logged':
      activity.correctionId = body.correctionId;
      activity.category = body.category;
      break;
  }

  await docClient.send(new PutCommand({
    TableName: ACTIVITY_LOG_TABLE,
    Item: activity
  }));

  return created(activity);
}
