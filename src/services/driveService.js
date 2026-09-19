const { google } = require('googleapis');
const AppError = require('../utils/AppError');

const SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/drive.file',
];

function isGoogleConfigured() {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
  );
}

function getOAuthClient(redirectUri) {
  if (!isGoogleConfigured()) {
    throw new AppError(
      'Google OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.',
      503
    );
  }
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    redirectUri ||
      process.env.GOOGLE_REDIRECT_URI ||
      'http://localhost:5000/api/auth/google/callback'
  );
}

function getAuthUrl(state = 'login') {
  const client = getOAuthClient();
  const redirectUri =
    process.env.GOOGLE_REDIRECT_URI ||
    'http://localhost:5000/api/auth/google/callback';
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES,
    state,
    // Explicit so production never silently drifts from env
    redirect_uri: redirectUri,
  });
}

async function exchangeCode(code) {
  const client = getOAuthClient();
  const { tokens } = await client.getToken(code);
  client.setCredentials(tokens);
  const oauth2 = google.oauth2({ version: 'v2', auth: client });
  const { data: profile } = await oauth2.userinfo.get();
  return { tokens, profile, client };
}

function clientFromUserTokens(user) {
  const tokens = user.googleTokens;
  if (!tokens || (!tokens.refreshToken && !tokens.accessToken)) {
    throw new AppError('Connect Google Drive first', 400);
  }
  const client = getOAuthClient();
  client.setCredentials({
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken,
    expiry_date: tokens.expiryDate,
  });
  client.on('tokens', (fresh) => {
    if (!fresh) return;
    user.googleTokens = user.googleTokens || {};
    if (fresh.access_token) user.googleTokens.accessToken = fresh.access_token;
    if (fresh.refresh_token) {
      user.googleTokens.refreshToken = fresh.refresh_token;
    }
    if (fresh.expiry_date) user.googleTokens.expiryDate = fresh.expiry_date;
    user
      .save()
      .catch((e) => console.warn('Token refresh persist failed:', e.message));
  });
  return client;
}

async function persistUserTokens(user, tokens) {
  user.googleTokens = {
    accessToken:
      tokens.access_token ||
      tokens.accessToken ||
      user.googleTokens?.accessToken,
    refreshToken:
      tokens.refresh_token ||
      tokens.refreshToken ||
      user.googleTokens?.refreshToken,
    expiryDate:
      tokens.expiry_date || tokens.expiryDate || user.googleTokens?.expiryDate,
    scope: tokens.scope || user.googleTokens?.scope,
  };
  user.driveConnected = Boolean(user.googleTokens.refreshToken);
  await user.save();
}

async function ensureAksharaRoot(user) {
  const auth = clientFromUserTokens(user);
  const drive = google.drive({ version: 'v3', auth });

  if (user.driveRootFolderId) {
    try {
      await drive.files.get({
        fileId: user.driveRootFolderId,
        fields: 'id,name',
      });
      return user.driveRootFolderId;
    } catch {
      // recreate
    }
  }

  const existing = await drive.files.list({
    q: "mimeType='application/vnd.google-apps.folder' and name='AksharaX' and trashed=false",
    fields: 'files(id,name)',
    spaces: 'drive',
  });
  if (existing.data.files && existing.data.files[0]) {
    return existing.data.files[0].id;
  }

  const created = await drive.files.create({
    requestBody: {
      name: 'AksharaX',
      mimeType: 'application/vnd.google-apps.folder',
    },
    fields: 'id',
  });
  return created.data.id;
}

async function createFolder(user, name, parentId) {
  const auth = clientFromUserTokens(user);
  const drive = google.drive({ version: 'v3', auth });
  const created = await drive.files.create({
    requestBody: {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: parentId ? [parentId] : undefined,
    },
    fields: 'id',
  });
  return created.data.id;
}

async function saveTextFile(user, { name, content, parentId }) {
  const auth = clientFromUserTokens(user);
  const drive = google.drive({ version: 'v3', auth });
  const { Readable } = require('stream');
  const stream = Readable.from([content]);

  const res = await drive.files.create({
    requestBody: {
      name,
      parents: parentId ? [parentId] : undefined,
      mimeType: 'text/markdown',
    },
    media: {
      mimeType: 'text/markdown',
      body: stream,
    },
    fields: 'id,name',
  });
  return res.data.id;
}

async function updateTextFile(user, fileId, content) {
  const auth = clientFromUserTokens(user);
  const drive = google.drive({ version: 'v3', auth });
  const { Readable } = require('stream');
  await drive.files.update({
    fileId,
    media: {
      mimeType: 'text/markdown',
      body: Readable.from([content]),
    },
  });
}

async function readTextFile(user, fileId) {
  const auth = clientFromUserTokens(user);
  const drive = google.drive({ version: 'v3', auth });
  const res = await drive.files.get(
    { fileId, alt: 'media' },
    { responseType: 'text' }
  );
  return String(res.data || '');
}

module.exports = {
  SCOPES,
  isGoogleConfigured,
  getOAuthClient,
  getAuthUrl,
  exchangeCode,
  ensureAksharaRoot,
  createFolder,
  saveTextFile,
  updateTextFile,
  readTextFile,
  persistUserTokens,
  clientFromUserTokens,
};
