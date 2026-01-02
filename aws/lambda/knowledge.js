/**
 * Knowledge Lambda Handlers
 *
 * Handles:
 * - GET /teams/{teamId}/knowledge - List team knowledge
 * - POST /teams/{teamId}/knowledge - Add approved knowledge
 */

const {
  success, created, badRequest, forbidden, serverError,
  getUserIdFromEvent,
  putItem, queryItems, queryByGSI,
  isTeamMember, isTeamAdmin, generateId, validateRequired
} = require('./utils');

/**
 * GET /teams/{teamId}/knowledge
 * List team knowledge base
 */
exports.list = async (event) => {
  try {
    const userId = getUserIdFromEvent(event);
    const teamId = event.pathParameters?.teamId;
    const since = event.queryStringParameters?.since;
    const category = event.queryStringParameters?.category;

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

    // Query knowledge items
    let items;
    if (category) {
      // Use GSI for category filtering
      items = await queryByGSI('GSI1', `TEAM#${teamId}#KNOWLEDGE#${category}`);
    } else {
      items = await queryItems(`TEAM#${teamId}`, 'KNOWLEDGE#');
    }

    // Filter by since if provided
    if (since) {
      const sinceDate = new Date(since);
      items = items.filter(item => new Date(item.approvedAt || item.createdAt) > sinceDate);
    }

    const knowledge = items.map(item => ({
      id: item.SK.replace('KNOWLEDGE#', ''),
      fact: item.fact,
      category: item.category,
      modelSpecific: item.modelSpecific,
      approvedAt: item.approvedAt,
      createdAt: item.createdAt,
      createdBy: item.createdBy
    }));

    return success({ knowledge });
  } catch (error) {
    console.error('List knowledge error:', error);
    return serverError(error.message);
  }
};

/**
 * POST /teams/{teamId}/knowledge
 * Add approved knowledge to team
 */
exports.add = async (event) => {
  try {
    const userId = getUserIdFromEvent(event);
    const teamId = event.pathParameters?.teamId;

    if (!userId) {
      return forbidden('User not authenticated');
    }

    if (!teamId) {
      return badRequest('Team ID required');
    }

    // Check admin permission for direct add
    const isAdmin = await isTeamAdmin(teamId, userId);
    if (!isAdmin) {
      return forbidden('Admin permission required to add knowledge directly. Use proposals instead.');
    }

    const body = JSON.parse(event.body || '{}');
    const validationError = validateRequired(body, ['fact', 'category']);
    if (validationError) {
      return badRequest(validationError);
    }

    const { fact, category, modelSpecific } = body;
    const knowledgeId = generateId('know');
    const now = new Date().toISOString();

    await putItem({
      PK: `TEAM#${teamId}`,
      SK: `KNOWLEDGE#${knowledgeId}`,
      fact,
      category,
      modelSpecific: modelSpecific || null,
      createdBy: userId,
      approvedAt: now,
      createdAt: now,
      // GSI for category-based queries
      GSI1PK: `TEAM#${teamId}#KNOWLEDGE#${category}`,
      GSI1SK: now
    });

    return created({
      id: knowledgeId,
      fact,
      category,
      approvedAt: now
    });
  } catch (error) {
    console.error('Add knowledge error:', error);
    return serverError(error.message);
  }
};
