/**
 * Teams Lambda Handlers
 *
 * Handles:
 * - GET /teams - List user's teams
 * - POST /teams - Create a new team
 * - GET /teams/{teamId} - Get team details
 */

const {
  success, created, badRequest, forbidden, notFound, serverError,
  getUserIdFromEvent, getUserEmailFromEvent,
  getItem, putItem, queryItems, getUserTeams,
  isTeamMember, generateId, validateRequired
} = require('./utils');

/**
 * GET /teams
 * List all teams the user belongs to
 */
exports.list = async (event) => {
  try {
    const userId = getUserIdFromEvent(event);
    if (!userId) {
      return forbidden('User not authenticated');
    }

    const userTeams = await getUserTeams(userId);

    // Fetch team details for each
    const teams = await Promise.all(
      userTeams.map(async ({ teamId, role }) => {
        const team = await getItem(`TEAM#${teamId}`, 'METADATA');
        if (!team) return null;
        return {
          id: teamId,
          name: team.name,
          slug: team.slug,
          role,
          memberCount: team.memberCount || 1,
          createdAt: team.createdAt
        };
      })
    );

    return success({
      teams: teams.filter(Boolean)
    });
  } catch (error) {
    console.error('List teams error:', error);
    return serverError(error.message);
  }
};

/**
 * POST /teams
 * Create a new team (paid feature)
 */
exports.create = async (event) => {
  try {
    const userId = getUserIdFromEvent(event);
    const userEmail = getUserEmailFromEvent(event);

    if (!userId) {
      return forbidden('User not authenticated');
    }

    const body = JSON.parse(event.body || '{}');
    const validationError = validateRequired(body, ['name']);
    if (validationError) {
      return badRequest(validationError);
    }

    const { name, description } = body;

    // Generate team ID and slug
    const teamId = generateId('team');
    const slug = name.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    // Create team
    await putItem({
      PK: `TEAM#${teamId}`,
      SK: 'METADATA',
      name,
      slug,
      description: description || '',
      ownerId: userId,
      memberCount: 1,
      subscription: 'free',
      createdAt: new Date().toISOString()
    });

    // Add creator as owner
    await putItem({
      PK: `TEAM#${teamId}`,
      SK: `MEMBER#${userId}`,
      role: 'owner',
      email: userEmail,
      joinedAt: new Date().toISOString(),
      GSI1PK: `USER#${userId}`,
      GSI1SK: `TEAM#${teamId}`
    });

    // User index entry
    await putItem({
      PK: `USER#${userId}`,
      SK: `TEAM#${teamId}`,
      role: 'owner'
    });

    return created({
      id: teamId,
      name,
      slug,
      role: 'owner'
    });
  } catch (error) {
    console.error('Create team error:', error);
    return serverError(error.message);
  }
};

/**
 * GET /teams/{teamId}
 * Get team details
 */
exports.get = async (event) => {
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

    // Get team details
    const team = await getItem(`TEAM#${teamId}`, 'METADATA');
    if (!team) {
      return notFound('Team not found');
    }

    // Get member count
    const members = await queryItems(`TEAM#${teamId}`, 'MEMBER#');

    // Get setups
    const setups = await queryItems(`TEAM#${teamId}`, 'SETUP#');

    return success({
      id: teamId,
      name: team.name,
      slug: team.slug,
      description: team.description,
      subscription: team.subscription,
      memberCount: members.length,
      setups: setups.map(s => ({
        id: s.SK.replace('SETUP#', ''),
        name: s.name,
        description: s.description,
        isDefault: s.isDefault || false
      })),
      createdAt: team.createdAt
    });
  } catch (error) {
    console.error('Get team error:', error);
    return serverError(error.message);
  }
};
