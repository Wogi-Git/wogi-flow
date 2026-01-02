/**
 * Proposals Lambda Handlers
 *
 * Handles:
 * - GET /teams/{teamId}/proposals - List proposals
 * - POST /teams/{teamId}/proposals - Create proposal
 * - POST /teams/{teamId}/proposals/{proposalId}/vote - Vote on proposal
 */

const {
  success, created, badRequest, forbidden, notFound, serverError,
  getUserIdFromEvent, getUserEmailFromEvent,
  getItem, putItem, queryItems, queryByGSI, updateItem,
  isTeamMember, isTeamAdmin, generateId, validateRequired
} = require('./utils');

/**
 * GET /teams/{teamId}/proposals
 * List team proposals
 */
exports.list = async (event) => {
  try {
    const userId = getUserIdFromEvent(event);
    const teamId = event.pathParameters?.teamId;
    const status = event.queryStringParameters?.status || 'pending';

    if (!userId) {
      return forbidden('User not authenticated');
    }

    if (!teamId) {
      return badRequest('Team ID required');
    }

    // Check membership
    if (!(await isTeamMember(teamId, userId))) {
      return forbidden('Not a member of this team');
    }

    // Query proposals by status using GSI
    const items = await queryByGSI('GSI2', `TEAM#${teamId}#PROPOSAL#${status}`);

    const proposals = items.map(item => ({
      id: item.SK.replace('PROPOSAL#', ''),
      rule: item.rule,
      category: item.category,
      rationale: item.rationale,
      sourceContext: item.sourceContext,
      status: item.status,
      votes: JSON.parse(item.votes || '[]'),
      proposerId: item.proposerId,
      createdAt: item.createdAt,
      decidedAt: item.decidedAt
    }));

    return success({ proposals });
  } catch (error) {
    console.error('List proposals error:', error);
    return serverError(error.message);
  }
};

/**
 * POST /teams/{teamId}/proposals
 * Create a new proposal
 */
exports.create = async (event) => {
  try {
    const userId = getUserIdFromEvent(event);
    const teamId = event.pathParameters?.teamId;

    if (!userId) {
      return forbidden('User not authenticated');
    }

    if (!teamId) {
      return badRequest('Team ID required');
    }

    // Check membership
    if (!(await isTeamMember(teamId, userId))) {
      return forbidden('Not a member of this team');
    }

    const body = JSON.parse(event.body || '{}');
    const validationError = validateRequired(body, ['rule']);
    if (validationError) {
      return badRequest(validationError);
    }

    const { rule, category, rationale, sourceContext } = body;
    const proposalId = generateId('prop');
    const now = new Date().toISOString();

    await putItem({
      PK: `TEAM#${teamId}`,
      SK: `PROPOSAL#${proposalId}`,
      rule,
      category: category || 'pattern',
      rationale: rationale || '',
      sourceContext: sourceContext || null,
      status: 'pending',
      votes: '[]',
      proposerId: userId,
      createdAt: now,
      // GSI for status-based queries
      GSI2PK: `TEAM#${teamId}#PROPOSAL#pending`,
      GSI2SK: now
    });

    return created({
      id: proposalId,
      rule,
      category: category || 'pattern',
      status: 'pending',
      createdAt: now
    });
  } catch (error) {
    console.error('Create proposal error:', error);
    return serverError(error.message);
  }
};

/**
 * POST /teams/{teamId}/proposals/{proposalId}/vote
 * Vote on a proposal
 */
exports.vote = async (event) => {
  try {
    const userId = getUserIdFromEvent(event);
    const teamId = event.pathParameters?.teamId;
    const proposalId = event.pathParameters?.proposalId;

    if (!userId) {
      return forbidden('User not authenticated');
    }

    if (!teamId || !proposalId) {
      return badRequest('Team ID and Proposal ID required');
    }

    // Check membership
    if (!(await isTeamMember(teamId, userId))) {
      return forbidden('Not a member of this team');
    }

    const body = JSON.parse(event.body || '{}');
    const { vote, comment } = body;

    if (!vote || !['approve', 'reject'].includes(vote)) {
      return badRequest('Vote must be "approve" or "reject"');
    }

    // Get proposal
    const proposal = await getItem(`TEAM#${teamId}`, `PROPOSAL#${proposalId}`);
    if (!proposal) {
      return notFound('Proposal not found');
    }

    if (proposal.status !== 'pending') {
      return badRequest('Proposal is no longer pending');
    }

    // Add vote
    const votes = JSON.parse(proposal.votes || '[]');

    // Check if user already voted
    const existingVote = votes.find(v => v.userId === userId);
    if (existingVote) {
      return badRequest('You have already voted on this proposal');
    }

    votes.push({
      userId,
      vote,
      comment: comment || '',
      timestamp: new Date().toISOString()
    });

    // Get team member count for threshold calculation
    const members = await queryItems(`TEAM#${teamId}`, 'MEMBER#');
    const memberCount = members.length;
    const threshold = Math.ceil(memberCount / 2); // 50% approval needed

    const approvals = votes.filter(v => v.vote === 'approve').length;
    const rejections = votes.filter(v => v.vote === 'reject').length;

    let newStatus = 'pending';
    let decidedAt = null;

    if (approvals >= threshold) {
      newStatus = 'approved';
      decidedAt = new Date().toISOString();

      // Auto-add to knowledge base
      const knowledgeId = generateId('know');
      await putItem({
        PK: `TEAM#${teamId}`,
        SK: `KNOWLEDGE#${knowledgeId}`,
        fact: proposal.rule,
        category: proposal.category,
        createdBy: proposal.proposerId,
        approvedAt: decidedAt,
        createdAt: proposal.createdAt,
        fromProposal: proposalId,
        GSI1PK: `TEAM#${teamId}#KNOWLEDGE#${proposal.category}`,
        GSI1SK: decidedAt
      });
    } else if (rejections >= threshold) {
      newStatus = 'rejected';
      decidedAt = new Date().toISOString();
    }

    // Update proposal
    await putItem({
      ...proposal,
      votes: JSON.stringify(votes),
      status: newStatus,
      decidedAt,
      // Update GSI for new status
      GSI2PK: `TEAM#${teamId}#PROPOSAL#${newStatus}`,
      GSI2SK: proposal.createdAt
    });

    return success({
      id: proposalId,
      status: newStatus,
      votes: votes.length,
      approvals,
      rejections,
      threshold,
      decidedAt
    });
  } catch (error) {
    console.error('Vote proposal error:', error);
    return serverError(error.message);
  }
};
