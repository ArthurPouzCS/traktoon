import crypto from "crypto";

export interface OAuth1Config {
  consumerKey: string;
  consumerSecret: string;
  token?: string;
  tokenSecret?: string;
}

export interface OAuth1Params {
  method: "GET" | "POST";
  url: string;
  queryParams?: Record<string, string | undefined>;
  bodyParams?: Record<string, string | undefined>;
  extraOAuthParams?: Record<string, string | undefined>;
}

export interface OAuth1HeaderResult {
  authorizationHeader: string;
  oauthParams: Record<string, string>;
}

function percentEncode(value: string): string {
  return encodeURIComponent(value)
    .replace(/[!*()']/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}

function generateNonce(length: number = 32): string {
  return crypto.randomBytes(length).toString("hex");
}

function generateTimestamp(): string {
  return Math.floor(Date.now() / 1000).toString();
}

function buildBaseString(
  method: "GET" | "POST",
  url: string,
  allParams: Record<string, string>,
): string {
  const normalizedUrl = (() => {
    const parsed = new URL(url);
    const scheme = parsed.protocol.toLowerCase();
    const host = parsed.hostname.toLowerCase();
    const port = parsed.port;

    const isDefaultPort =
      (!port && (scheme === "http:" || scheme === "https:")) ||
      (scheme === "http:" && port === "80") ||
      (scheme === "https:" && port === "443");

    const authority = isDefaultPort ? host : `${host}:${port}`;
    return `${scheme}//${authority}${parsed.pathname}`;
  })();

  const sortedParams = Object.entries(allParams)
    .sort(([aKey], [bKey]) => (aKey < bKey ? -1 : aKey > bKey ? 1 : 0))
    .map(([key, value]) => `${percentEncode(key)}=${percentEncode(value)}`)
    .join("&");

  const baseParts = [
    method.toUpperCase(),
    percentEncode(normalizedUrl),
    percentEncode(sortedParams),
  ];

  return baseParts.join("&");
}

function buildSigningKey(consumerSecret: string, tokenSecret?: string): string {
  return `${percentEncode(consumerSecret)}&${tokenSecret ? percentEncode(tokenSecret) : ""}`;
}

function sign(baseString: string, signingKey: string): string {
  return crypto.createHmac("sha1", signingKey).update(baseString).digest("base64");
}

export function buildOAuth1Header(
  config: OAuth1Config,
  params: OAuth1Params,
): OAuth1HeaderResult {
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: config.consumerKey,
    oauth_nonce: generateNonce(),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: generateTimestamp(),
    oauth_version: "1.0",
  };

  if (config.token) {
    oauthParams.oauth_token = config.token;
  }

  if (params.extraOAuthParams) {
    for (const [key, value] of Object.entries(params.extraOAuthParams)) {
      if (value !== undefined) {
        oauthParams[key] = value;
      }
    }
  }

  const queryParams: Record<string, string> = {};
  if (params.queryParams) {
    for (const [key, value] of Object.entries(params.queryParams)) {
      if (value !== undefined) {
        queryParams[key] = value;
      }
    }
  }

  const bodyParams: Record<string, string> = {};
  if (params.bodyParams) {
    for (const [key, value] of Object.entries(params.bodyParams)) {
      if (value !== undefined) {
        bodyParams[key] = value;
      }
    }
  }

  const allParams: Record<string, string> = {
    ...queryParams,
    ...bodyParams,
    ...oauthParams,
  };

  const baseString = buildBaseString(params.method, params.url, allParams);
  const signingKey = buildSigningKey(config.consumerSecret, config.tokenSecret);
  const signature = sign(baseString, signingKey);

  const headerParams: Record<string, string> = {
    ...oauthParams,
    oauth_signature: signature,
  };

  const headerValue =
    "OAuth " +
    Object.entries(headerParams)
      .sort(([aKey], [bKey]) => (aKey < bKey ? -1 : aKey > bKey ? 1 : 0))
      .map(([key, value]) => `${percentEncode(key)}="${percentEncode(value)}"`)
      .join(", ");

  return {
    authorizationHeader: headerValue,
    oauthParams: headerParams,
  };
}

