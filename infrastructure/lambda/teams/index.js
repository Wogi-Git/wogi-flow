/**
 * Teams API Lambda Handler
 *
 * Endpoints:
 *   GET    /teams              - List user's teams
 *   POST   /teams              - Create a new team
 *   GET    /teams/{teamId}     - Get team details
 *   PUT    /teams/{teamId}     - Update team
 *   DELETE /teams/{teamId}     - Delete team
 *   GET    /teams/{teamId}/members - List team members
 *   POST   /teams/{teamId}/invite  - Invite member
 */

const {
  docClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  DeleteCommand,
  UpdateCommand,
  success,
  created,
  error,
  getUserFromEvent,
  parseBody,
  getPathParam,
  generateId,
  now
} = require('../shared/utils');

const TEAMS_TABLE = process.env.TEAMS_TABLE;
const TEAM_MEMBERS_TABLE = process.env.TEAM_MEMBERS_TABLE;

// Route handlers
const handlers = {
  'GET /teams': listTeams,
  'POST /teams': createTeam,
  'GET /teams/{teamId}': getTeam,
  'PUT /teams/{teamId}': updateTeam,
  'DELETE /teams/{teamId}': deleteTeam,
  'GET /teams/{teamId}/members': listMembers,
  'POST /teams/{teamId}/invite': inviteMember
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
 * List teams the user belongs to
 */
async function listTeams(event, user) {
  // Query team memberships
  const memberships = await docClient.send(new QueryCommand({
    TableName: TEAM_MEMBERS_TABLE,
    IndexName: 'user-teams-index',
    KeyConditionExpression: 'userId = :userId',
    ExpressionAttributeValues: {
      ':userId': user.userId
    }
  }));

  if (!memberships.Items?.length) {
    return success([]);
  }

  // Get team details for each membership
  const teams = [];
  for (const membership of memberships.Items) {
    const team = await docClient.send(new GetCommand({
      TableName: TEAMS_TABLE,
      Key: { teamId: membership.teamId }
    }));

    if (team.Item) {
      teams.push({
        ...team.Item,
        role: membership.role,
        joinedAt: membership.joinedAt
      });
    }
  }

  return success(teams);
}

/**
 * Create a new team
 */
async function createTeam(event, user) {
  const body = parseBody(event);

  if (!body.name) {
    return error(400, 'Team name is required');
  }

  const teamId = generateId('team');
  const timestamp = now();

  // Create team
  const team = {
    teamId,
    name: body.name,
    description: body.description || '',
    ownerEmail: user.email,
    ownerId: user.userId,
    settings: body.settings || {},
    createdAt: timestamp,
    updatedAt: timestamp
  };

  await docClient.send(new PutCommand({
    TableName: TEAMS_TABLE,
    Item: team
  }));

  // Add owner as admin member
  await docClient.send(new PutCommand({
    TableName: TEAM_MEMBERS_TABLE,
    Item: {
      teamId,
      userId: user.userId,
      email: user.email,
      name: user.name,
      role: 'admin',
      joinedAt: timestamp
    }
  }));

  return created(team);
}

/**
 * Get team details
 */
async function getTeam(event, user) {
  const teamId = getPathParam(event, 'teamId');

  // Verify membership
  const membership = await docClient.send(new GetCommand({
    TableName: TEAM_MEMBERS_TABLE,
    Key: { teamId, userId: user.userId }
  }));

  if (!membership.Item) {
    return error(403, 'Not a member of this team');
  }

  // Get team
  const team = await docClient.send(new GetCommand({
    TableName: TEAMS_TABLE,
    Key: { teamId }
  }));

  if (!team.Item) {
    return error(404, 'Team not found');
  }

  return success({
    ...team.Item,
    role: membership.Item.role
  });
}

/**
 * Update team
 */
async function updateTeam(event, user) {
  const teamId = getPathParam(event, 'teamId');
  const body = parseBody(event);

  // Verify admin membership
  const membership = await docClient.send(new GetCommand({
    TableName: TEAM_MEMBERS_TABLE,
    Key: { teamId, userId: user.userId }
  }));

  if (!membership.Item || membership.Item.role !== 'admin') {
    return error(403, 'Only admins can update team');
  }

  // Build update expression
  const updates = [];
  const values = {};
  const names = {};

  if (body.name) {
    updates.push('#name = :name');
    values[':name'] = body.name;
    names['#name'] = 'name';
  }

  if (body.description !== undefined) {
    updates.push('description = :description');
    values[':description'] = body.description;
  }

  if (body.settings) {
    updates.push('settings = :settings');
    values[':settings'] = body.settings;
  }

  updates.push('updatedAt = :updatedAt');
  values[':updatedAt'] = now();

  const result = await docClient.send(new UpdateCommand({
    TableName: TEAMS_TABLE,
    Key: { teamId },
    UpdateExpression: `SET ${updates.join(', ')}`,
    ExpressionAttributeValues: values,
    ExpressionAttributeNames: Object.keys(names).length ? names : undefined,
    ReturnValues: 'ALL_NEW'
  }));

  return success(result.Attributes);
}

/**
 * Delete team
 */
async function deleteTeam(event, user) {
  const teamId = getPathParam(event, 'teamId');

  // Verify owner
  const team = await docClient.send(new GetCommand({
    TableName: TEAMS_TABLE,
    Key: { teamId }
  }));

  if (!team.Item) {
    return error(404, 'Team not found');
  }

  if (team.Item.ownerId !== user.userId) {
    return error(403, 'Only the owner can delete the team');
  }

  // Get all members to delete
  const members = await docClient.send(new QueryCommand({
    TableName: TEAM_MEMBERS_TABLE,
    KeyConditionExpression: 'teamId = :teamId',
    ExpressionAttributeValues: {
      ':teamId': teamId
    }
  }));

  // Delete all memberships
  for (const member of members.Items || []) {
    await docClient.send(new DeleteCommand({
      TableName: TEAM_MEMBERS_TABLE,
      Key: { teamId, userId: member.userId }
    }));
  }

  // Delete team
  await docClient.send(new DeleteCommand({
    TableName: TEAMS_TABLE,
    Key: { teamId }
  }));

  return success({ deleted: true });
}

/**
 * List team members
 */
async function listMembers(event, user) {
  const teamId = getPathParam(event, 'teamId');

  // Verify membership
  const membership = await docClient.send(new GetCommand({
    TableName: TEAM_MEMBERS_TABLE,
    Key: { teamId, userId: user.userId }
  }));

  if (!membership.Item) {
    return error(403, 'Not a member of this team');
  }

  // Get all members
  const members = await docClient.send(new QueryCommand({
    TableName: TEAM_MEMBERS_TABLE,
    KeyConditionExpression: 'teamId = :teamId',
    ExpressionAttributeValues: {
      ':teamId': teamId
    }
  }));

  return success(members.Items || []);
}

/**
 * Invite member to team
 */
async function inviteMember(event, user) {
  const teamId = getPathParam(event, 'teamId');
  const body = parseBody(event);

  if (!body.email) {
    return error(400, 'Email is required');
  }

  // Verify admin membership
  const membership = await docClient.send(new GetCommand({
    TableName: TEAM_MEMBERS_TABLE,
    Key: { teamId, userId: user.userId }
  }));

  if (!membership.Item || membership.Item.role !== 'admin') {
    return error(403, 'Only admins can invite members');
  }

  // Check if already a member (by email)
  const existing = await docClient.send(new QueryCommand({
    TableName: TEAM_MEMBERS_TABLE,
    IndexName: 'email-index',
    KeyConditionExpression: 'email = :email',
    FilterExpression: 'teamId = :teamId',
    ExpressionAttributeValues: {
      ':email': body.email,
      ':teamId': teamId
    }
  }));

  if (existing.Items?.length > 0) {
    return error(409, 'User is already a member');
  }

  // Create pending invitation
  // For now, create with a placeholder userId that will be updated when user accepts
  const inviteId = generateId('invite');
  const timestamp = now();

  await docClient.send(new PutCommand({
    TableName: TEAM_MEMBERS_TABLE,
    Item: {
      teamId,
      userId: inviteId, // Will be replaced with actual userId when accepted
      email: body.email,
      name: body.name || body.email.split('@')[0],
      role: body.role || 'member',
      status: 'pending',
      invitedBy: user.userId,
      joinedAt: timestamp
    }
  }));

  // TODO: Send invitation email via SES

  return created({
    inviteId,
    email: body.email,
    status: 'pending'
  });
}
