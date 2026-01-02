/**
 * Sync Lambda Handlers
 *
 * Handles:
 * - POST /teams/{teamId}/sync - Sync local data with team
 * - SQS processor for async sync operations
 */

const { SQSClient, SendMessageCommand } = require('@aws-sdk/client-sqs');
const {
  success, badRequest, forbidden, serverError,
  getUserIdFromEvent,
  getItem, putItem, queryItems,
  isTeamMember, generateId
} = require('./utils');

const sqs = new SQSClient({});
const SYNC_QUEUE_URL = process.env.SYNC_QUEUE_URL;

/**
 * POST /teams/{teamId}/sync
 * Synchronize local data with team
 */
exports.handler = async (event) => {
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
    const { proposals, lastSyncTimestamp } = body;

    // 1. Push local proposals to team
    const pushedProposals = [];
    if (proposals && Array.isArray(proposals)) {
      for (const proposal of proposals) {
        const proposalId = generateId('prop');
        const now = new Date().toISOString();

        await putItem({
          PK: `TEAM#${teamId}`,
          SK: `PROPOSAL#${proposalId}`,
          rule: proposal.rule,
          category: proposal.category || 'pattern',
          rationale: proposal.rationale || '',
          sourceContext: proposal.sourceContext || null,
          status: 'pending',
          votes: '[]',
          proposerId: userId,
          localId: proposal.localId, // Track original local ID
          createdAt: now,
          GSI2PK: `TEAM#${teamId}#PROPOSAL#pending`,
          GSI2SK: now
        });

        pushedProposals.push({
          localId: proposal.localId,
          remoteId: proposalId
        });
      }
    }

    // 2. Pull approved knowledge since last sync
    let knowledge = await queryItems(`TEAM#${teamId}`, 'KNOWLEDGE#');

    if (lastSyncTimestamp) {
      const since = new Date(lastSyncTimestamp);
      knowledge = knowledge.filter(k =>
        new Date(k.approvedAt || k.createdAt) > since
      );
    }

    // 3. Pull proposal updates
    let proposalUpdates = await queryItems(`TEAM#${teamId}`, 'PROPOSAL#');

    if (lastSyncTimestamp) {
      const since = new Date(lastSyncTimestamp);
      proposalUpdates = proposalUpdates.filter(p =>
        new Date(p.decidedAt || p.createdAt) > since &&
        p.status !== 'pending'
      );
    }

    return success({
      pushed: {
        proposals: pushedProposals.length
      },
      pulled: {
        knowledge: knowledge.map(k => ({
          id: k.SK.replace('KNOWLEDGE#', ''),
          fact: k.fact,
          category: k.category,
          modelSpecific: k.modelSpecific,
          approvedAt: k.approvedAt
        })),
        proposalUpdates: proposalUpdates.map(p => ({
          id: p.SK.replace('PROPOSAL#', ''),
          localId: p.localId,
          status: p.status,
          decidedAt: p.decidedAt
        }))
      },
      syncTimestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Sync error:', error);
    return serverError(error.message);
  }
};

/**
 * SQS processor for async sync operations
 * Handles large batch syncs and background processing
 */
exports.process = async (event) => {
  const results = [];

  for (const record of event.Records) {
    try {
      const body = JSON.parse(record.body);
      const { operation, teamId, userId, data } = body;

      switch (operation) {
        case 'batch_knowledge_sync':
          // Process batch knowledge import
          for (const item of data.items || []) {
            const knowledgeId = generateId('know');
            await putItem({
              PK: `TEAM#${teamId}`,
              SK: `KNOWLEDGE#${knowledgeId}`,
              fact: item.fact,
              category: item.category,
              modelSpecific: item.modelSpecific,
              createdBy: userId,
              approvedAt: new Date().toISOString(),
              createdAt: new Date().toISOString(),
              GSI1PK: `TEAM#${teamId}#KNOWLEDGE#${item.category}`,
              GSI1SK: new Date().toISOString()
            });
          }
          results.push({ operation, success: true, count: data.items?.length || 0 });
          break;

        case 'team_export':
          // Export team data for backup/transfer
          // This would typically upload to S3
          console.log('Team export requested for:', teamId);
          results.push({ operation, success: true, message: 'Export queued' });
          break;

        default:
          results.push({ operation, success: false, error: 'Unknown operation' });
      }
    } catch (error) {
      console.error('Process record error:', error);
      results.push({ success: false, error: error.message });
    }
  }

  return { results };
};
