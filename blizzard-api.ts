interface BlizzardTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface WowTokenData {
  last_updated_timestamp: number;
  price: number;
}

let cachedToken: string | null = null;
let tokenExpiry: number = 0;

export async function getBlizzardAccessToken(region: string): Promise<string> {
  // Return cached token if still valid
  if (cachedToken && Date.now() < tokenExpiry) {
    return cachedToken;
  }

  const tokenUrl = `https://${region}.battle.net/oauth/token`;

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${btoa(
        `${process.env.BLIZZARD_CLIENT_ID}:${process.env.BLIZZARD_CLIENT_SECRET}`
      )}`,
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to get Blizzard access token: ${response.statusText}`);
  }

  const data = (await response.json()) as BlizzardTokenResponse;

  // Cache the token (expires in ~24 hours, but we'll refresh 5 min early)
  cachedToken = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in - 300) * 1000;

  return data.access_token;
}

export async function fetchWowTokenPrice(region: string = 'us'): Promise<{
  price: number;
  lastUpdated: Date;
}> {
  const accessToken = await getBlizzardAccessToken(region);

  const namespace = `dynamic-${region}`;
  const apiUrl = `https://${region}.api.blizzard.com/data/wow/token/index`;

  const response = await fetch(`${apiUrl}?namespace=${namespace}&locale=en_US`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch WoW Token price: ${response.statusText}`);
  }

  const data = (await response.json()) as WowTokenData;

  return {
    price: Math.floor(data.price / 10000), // Convert copper to gold
    lastUpdated: new Date(data.last_updated_timestamp),
  };
}

