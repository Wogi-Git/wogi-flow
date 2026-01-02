/**
 * Proposals API Lambda Handler
 *
 * Endpoints:
 *   GET    /teams/{teamId}/proposals                    - List proposals
 *   POST   /teams/{teamId}/proposals                    - Create proposal
 *   GET    /teams/{teamId}/proposals/{proposalId}       - Get proposal
 *   POST   /teams/{teamId}/proposals/{proposalId}/vote  - Vote on proposal
 *   POST   /teams/{teamId}/proposals/{proposalId}/decide - Admin decision
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

const PROPOSALS_TABLE = process.env.PROPOSALS_TABLE;
const VOTES_TABLE = process.env.VOTES_TABLE;
const TEAMS_TABLE = process.env.TEAMS_TABLE;
const TEAM_MEMBERS_TABLE = process.env.TEAM_MEMBERS_TABLE || TEAMS_TABLE.replace('teams', 'team-members');

// Route handlers
const handlers = {
  'GET /teams/{teamId}/proposals': listProposals,
  'POST /teams/{teamId}/proposals': createProposal,
  'GET /teams/{teamId}/proposals/{proposalId}': getProposal,
  'POST /teams/{teamId}/proposals/{proposalId}/vote': voteOnProposal,
  'POST /teams/{teamId}/proposals/{proposalId}/decide': decideProposal
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
 * List proposals for a team
 */
async function listProposals(event, user) {
  const teamId = getPathParam(event, 'teamId');
  const status = getQueryParam(event, 'status');

  // Verify membership
  const membership = await verifyMembership(teamId, user.userId);
  if (!membership) {
    return error(403, 'Not a member of this team');
  }

  // Query proposals
  let params = {
    TableName: PROPOSALS_TABLE,
    KeyConditionExpression: 'teamId = :teamId',
    ExpressionAttributeValues: {
      ':teamId': teamId
    },
    ScanIndexForward: false // newest first
  };

  if (status) {
    params.IndexName = 'status-index';
    params.KeyConditionExpression = 'teamId = :teamId AND #status = :status';
    params.ExpressionAttributeValues[':status'] = status;
    params.ExpressionAttributeNames = { '#status': 'status' };
  }

  const result = await docClient.send(new QueryCommand(params));

  return success(result.Items || []);
}

/**
 * Create a new proposal
 */
async function createProposal(event, user) {
  const teamId = getPathParam(event, 'teamId');
  const body = parseBody(event);

  // Verify membership
  const membership = await verifyMembership(teamId, user.userId);
  if (!membership) {
    return error(403, 'Not a member of this team');
  }

  // Validate
  if (!body.rule) {
    return error(400, 'Rule text is required');
  }

  const proposalId = generateId('prop');
  const timestamp = now();

  const proposal = {
    teamId,
    proposalId,
    rule: body.rule,
    category: body.category || 'general',
    scope: body.scope || 'team',
    rationale: body.rationale || '',
    source: body.source || 'manual', // manual, auto-promoted, correction
    sourceFactId: body.sourceFactId,
    status: 'pending',
    votes: { approve: 0, reject: 0 },
    createdBy: user.userId,
    createdByEmail: user.email,
    createdByName: user.name,
    createdAt: timestamp,
    updatedAt: timestamp,
    expiresAt: body.expiresAt // optional TTL
  };

  await docClient.send(new PutCommand({
    TableName: PROPOSALS_TABLE,
    Item: proposal
  }));

  return created(proposal);
}

/**
 * Get proposal details with votes
 */
async function getProposal(event, user) {
  const teamId = getPathParam(event, 'teamId');
  const proposalId = getPathParam(event, 'proposalId');

  // Verify membership
  const membership = await verifyMembership(teamId, user.userId);
  if (!membership) {
    return error(403, 'Not a member of this team');
  }

  // Get proposal
  const proposal = await docClient.send(new GetCommand({
    TableName: PROPOSALS_TABLE,
    Key: { teamId, proposalId }
  }));

  if (!proposal.Item) {
    return error(404, 'Proposal not found');
  }

  // Get votes
  const votes = await docClient.send(new QueryCommand({
    TableName: VOTES_TABLE,
    KeyConditionExpression: 'proposalId = :proposalId',
    ExpressionAttributeValues: {
      ':proposalId': proposalId
    }
  }));

  // Check if user has voted
  const userVote = (votes.Items || []).find(v => v.userId === user.userId);

  return success({
    ...proposal.Item,
    voteDetails: votes.Items || [],
    userVote: userVote?.vote,
    userRole: membership.role
  });
}

/**
 * Vote on a proposal
 */
async function voteOnProposal(event, user) {
  const teamId = getPathParam(event, 'teamId');
  const proposalId = getPathParam(event, 'proposalId');
  const body = parseBody(event);

  if (!body.vote || !['approve', 'reject'].includes(body.vote)) {
    return error(400, 'Vote must be "approve" or "reject"');
  }

  // Verify membership
  const membership = await verifyMembership(teamId, user.userId);
  if (!membership) {
    return error(403, 'Not a member of this team');
  }

  // Get proposal
  const proposal = await docClient.send(new GetCommand({
    TableName: PROPOSALS_TABLE,
    Key: { teamId, proposalId }
  }));

  if (!proposal.Item) {
    return error(404, 'Proposal not found');
  }

  if (proposal.Item.status !== 'pending') {
    return error(400, 'Proposal is no longer open for voting');
  }

  // Check for existing vote
  const existingVote = await docClient.send(new GetCommand({
    TableName: VOTES_TABLE,
    Key: { proposalId, userId: user.userId }
  }));

  const timestamp = now();
  const oldVote = existingVote.Item?.vote;

  // Record vote
  await docClient.send(new PutCommand({
    TableName: VOTES_TABLE,
    Item: {
      proposalId,
      userId: user.userId,
      vote: body.vote,
      comment: body.comment || '',
      votedAt: timestamp
    }
  }));

  // Update vote counts
  const updateExpression = [];
  const expressionValues = { ':one': 1, ':updatedAt': timestamp };

  if (oldVote) {
    // Changing vote - decrement old, increment new
    if (oldVote !== body.vote) {
      updateExpression.push(`votes.${oldVote} = votes.${oldVote} - :one`);
      updateExpression.push(`votes.${body.vote} = votes.${body.vote} + :one`);
    }
  } else {
    // New vote
    updateExpression.push(`votes.${body.vote} = votes.${body.vote} + :one`);
  }

  updateExpression.push('updatedAt = :updatedAt');

  await docClient.send(new UpdateCommand({
    TableName: PROPOSALS_TABLE,
    Key: { teamId, proposalId },
    UpdateExpression: `SET ${updateExpression.join(', ')}`,
    ExpressionAttributeValues: expressionValues
  }));

  return success({
    vote: body.vote,
    previousVote: oldVote,
    changed: oldVote !== body.vote
  });
}

/**
 * Admin decision on proposal
 */
async function decideProposal(event, user) {
  const teamId = getPathParam(event, 'teamId');
  const proposalId = getPathParam(event, 'proposalId');
  const body = parseBody(event);

  if (!body.decision || !['approved', 'rejected'].includes(body.decision)) {
    return error(400, 'Decision must be "approved" or "rejected"');
  }

  // Verify admin membership
  const membership = await verifyMembership(teamId, user.userId);
  if (!membership || membership.role !== 'admin') {
    return error(403, 'Only admins can make decisions');
  }

  // Get proposal
  const proposal = await docClient.send(new GetCommand({
    TableName: PROPOSALS_TABLE,
    Key: { teamId, proposalId }
  }));

  if (!proposal.Item) {
    return error(404, 'Proposal not found');
  }

  if (proposal.Item.status !== 'pending') {
    return error(400, 'Proposal already decided');
  }

  const timestamp = now();

  // Update proposal
  const result = await docClient.send(new UpdateCommand({
    TableName: PROPOSALS_TABLE,
    Key: { teamId, proposalId },
    UpdateExpression: 'SET #status = :status, decidedBy = :decidedBy, decidedByEmail = :email, decidedAt = :decidedAt, decisionReason = :reason, updatedAt = :updatedAt',
    ExpressionAttributeNames: {
      '#status': 'status'
    },
    ExpressionAttributeValues: {
      ':status': body.decision,
      ':decidedBy': user.userId,
      ':email': user.email,
      ':decidedAt': timestamp,
      ':reason': body.reason || '',
      ':updatedAt': timestamp
    },
    ReturnValues: 'ALL_NEW'
  }));

  return success(result.Attributes);
}
