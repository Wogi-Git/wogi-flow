/**
 * Auth Lambda Handlers
 *
 * Handles:
 * - POST /auth/login - Exchange invite code for authentication
 * - POST /auth/refresh - Refresh access token
 */

const { CognitoIdentityProviderClient, InitiateAuthCommand, AdminCreateUserCommand, AdminSetUserPasswordCommand, AdminGetUserCommand } = require('@aws-sdk/client-cognito-identity-provider');
const { success, badRequest, unauthorized, serverError, getItem, putItem, deleteItem, generateId } = require('./utils');

const cognito = new CognitoIdentityProviderClient({});
const USER_POOL_ID = process.env.USER_POOL_ID;
const USER_POOL_CLIENT_ID = process.env.USER_POOL_CLIENT_ID;

/**
 * POST /auth/login
 * Exchange invite code for JWT tokens
 */
exports.login = async (event) => {
  try {
    const body = JSON.parse(event.body || '{}');
    const { inviteCode, email, password } = body;

    // Option 1: Login with invite code (first time setup)
    if (inviteCode) {
      // Validate invite code
      const invite = await getItem(`INVITE#${inviteCode}`, 'METADATA');

      if (!invite) {
        return unauthorized('Invalid invite code');
      }

      if (invite.TTL && invite.TTL < Math.floor(Date.now() / 1000)) {
        return unauthorized('Invite code has expired');
      }

      if (!email || !password) {
        return badRequest('Email and password required for first-time setup');
      }

      // Create or get Cognito user
      let userId;
      try {
        // Try to get existing user
        const existingUser = await cognito.send(new AdminGetUserCommand({
          UserPoolId: USER_POOL_ID,
          Username: email
        }));
        userId = existingUser.Username;
      } catch (e) {
        if (e.name === 'UserNotFoundException') {
          // Create new user
          const newUser = await cognito.send(new AdminCreateUserCommand({
            UserPoolId: USER_POOL_ID,
            Username: email,
            UserAttributes: [
              { Name: 'email', Value: email },
              { Name: 'email_verified', Value: 'true' }
            ],
            MessageAction: 'SUPPRESS'
          }));
          userId = newUser.User.Username;

          // Set password
          await cognito.send(new AdminSetUserPasswordCommand({
            UserPoolId: USER_POOL_ID,
            Username: email,
            Password: password,
            Permanent: true
          }));
        } else {
          throw e;
        }
      }

      // Add user to team
      const teamId = invite.teamId;
      await putItem({
        PK: `TEAM#${teamId}`,
        SK: `MEMBER#${userId}`,
        role: 'member',
        email,
        joinedAt: new Date().toISOString(),
        GSI1PK: `USER#${userId}`,
        GSI1SK: `TEAM#${teamId}`
      });

      // Also create user index entry
      await putItem({
        PK: `USER#${userId}`,
        SK: `TEAM#${teamId}`,
        role: 'member'
      });

      // Delete used invite (one-time use) or decrement uses
      if (invite.maxUses === 1) {
        await deleteItem(`INVITE#${inviteCode}`, 'METADATA');
      } else if (invite.maxUses > 1) {
        // Update uses count
        await putItem({
          ...invite,
          usesRemaining: (invite.usesRemaining || invite.maxUses) - 1
        });
      }

      // Now authenticate
      const authResult = await cognito.send(new InitiateAuthCommand({
        AuthFlow: 'USER_PASSWORD_AUTH',
        ClientId: USER_POOL_CLIENT_ID,
        AuthParameters: {
          USERNAME: email,
          PASSWORD: password
        }
      }));

      return success({
        accessToken: authResult.AuthenticationResult.AccessToken,
        refreshToken: authResult.AuthenticationResult.RefreshToken,
        idToken: authResult.AuthenticationResult.IdToken,
        expiresIn: authResult.AuthenticationResult.ExpiresIn,
        teamId,
        userId
      });
    }

    // Option 2: Regular email/password login
    if (email && password) {
      const authResult = await cognito.send(new InitiateAuthCommand({
        AuthFlow: 'USER_PASSWORD_AUTH',
        ClientId: USER_POOL_CLIENT_ID,
        AuthParameters: {
          USERNAME: email,
          PASSWORD: password
        }
      }));

      return success({
        accessToken: authResult.AuthenticationResult.AccessToken,
        refreshToken: authResult.AuthenticationResult.RefreshToken,
        idToken: authResult.AuthenticationResult.IdToken,
        expiresIn: authResult.AuthenticationResult.ExpiresIn
      });
    }

    return badRequest('Either inviteCode or email/password required');
  } catch (error) {
    console.error('Login error:', error);
    if (error.name === 'NotAuthorizedException') {
      return unauthorized('Invalid credentials');
    }
    return serverError(error.message);
  }
};

/**
 * POST /auth/refresh
 * Refresh access token using refresh token
 */
exports.refresh = async (event) => {
  try {
    const body = JSON.parse(event.body || '{}');
    const { refreshToken } = body;

    if (!refreshToken) {
      return badRequest('Refresh token required');
    }

    const authResult = await cognito.send(new InitiateAuthCommand({
      AuthFlow: 'REFRESH_TOKEN_AUTH',
      ClientId: USER_POOL_CLIENT_ID,
      AuthParameters: {
        REFRESH_TOKEN: refreshToken
      }
    }));

    return success({
      accessToken: authResult.AuthenticationResult.AccessToken,
      idToken: authResult.AuthenticationResult.IdToken,
      expiresIn: authResult.AuthenticationResult.ExpiresIn
    });
  } catch (error) {
    console.error('Refresh error:', error);
    if (error.name === 'NotAuthorizedException') {
      return unauthorized('Invalid or expired refresh token');
    }
    return serverError(error.message);
  }
};
