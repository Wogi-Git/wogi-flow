/**
 * Invites Lambda Handlers
 *
 * Handles:
 * - POST /teams/{teamId}/invites - Generate invite code (admin only)
 * - GET /invites/{code} - Validate invite code (public)
 */

const {
  success, created, badRequest, forbidden, notFound, serverError,
  getUserIdFromEvent,
  getItem, putItem,
  isTeamAdmin, generateInviteCode
} = require('./utils');

/**
 * POST /teams/{teamId}/invites
 * Generate an invite code for the team
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

    // Check admin permission
    if (!(await isTeamAdmin(teamId, userId))) {
      return forbidden('Admin permission required to create invites');
    }

    const body = JSON.parse(event.body || '{}');
    const { expiresInDays = 7, maxUses = 1 } = body;

    const code = generateInviteCode();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + expiresInDays * 24 * 60 * 60 * 1000);

    await putItem({
      PK: `INVITE#${code}`,
      SK: 'METADATA',
      teamId,
      createdBy: userId,
      maxUses,
      usesRemaining: maxUses,
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      TTL: Math.floor(expiresAt.getTime() / 1000) // DynamoDB TTL
    });

    return created({
      code,
      teamId,
      maxUses,
      expiresAt: expiresAt.toISOString(),
      url: `https://wogi-flow.com/join/${code}` // Frontend join URL
    });
  } catch (error) {
    console.error('Create invite error:', error);
    return serverError(error.message);
  }
};

/**
 * GET /invites/{code}
 * Validate an invite code (public endpoint)
 */
exports.validate = async (event) => {
  try {
    const code = event.pathParameters?.code;

    if (!code) {
      return badRequest('Invite code required');
    }

    const invite = await getItem(`INVITE#${code}`, 'METADATA');

    if (!invite) {
      return notFound('Invalid invite code');
    }

    // Check expiration
    if (invite.TTL && invite.TTL < Math.floor(Date.now() / 1000)) {
      return notFound('Invite code has expired');
    }

    // Check uses remaining
    if (invite.usesRemaining !== undefined && invite.usesRemaining <= 0) {
      return notFound('Invite code has been fully used');
    }

    // Get team details
    const team = await getItem(`TEAM#${invite.teamId}`, 'METADATA');

    return success({
      valid: true,
      teamId: invite.teamId,
      teamName: team?.name || 'Unknown Team',
      expiresAt: invite.expiresAt
    });
  } catch (error) {
    console.error('Validate invite error:', error);
    return serverError(error.message);
  }
};
