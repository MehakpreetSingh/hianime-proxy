import axios from "axios";
import { Request, Response } from "express";
import crypto from "crypto";

const SECRET_KEY = "12345678901234567890123456789012"; // 32 bytes for AES-256
const IV_LENGTH = 16; // AES block size

export function encodePayload(payload: { url: string; ismp4?: boolean }): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv("aes-256-cbc", Buffer.from(SECRET_KEY), iv);
  let encrypted = cipher.update(JSON.stringify(payload), "utf8", "base64");
  encrypted += cipher.final("base64");
  // Return iv + encrypted, both base64
  return iv.toString("base64") + ":" + encrypted;
}

export function decodePayload(token: string): { url: string; ismp4?: boolean } {
  const [ivBase64, encrypted] = token.split(":");
  const iv = Buffer.from(ivBase64, "base64");
  const decipher = crypto.createDecipheriv("aes-256-cbc", Buffer.from(SECRET_KEY), iv);
  let decrypted = decipher.update(encrypted, "base64", "utf8");
  decrypted += decipher.final("utf8");
  return JSON.parse(decrypted);
}

// Function to rewrite URLs in M3U8 content using AES encoding
function rewriteM3U8Content(content: string, baseUrl: string, proxyBaseUrl: string) {
  const lines = content.split('\n');
  const rewrittenLines = lines.map(line => {
    // Handle URI in EXT-X-KEY
    if (line.includes('URI=')) {
      return line.replace(/URI="([^"]+)"/g, (match, url) => {
        let fullUrl = url;
        if (!/^https?:\/\//.test(url)) {
          if (url.startsWith('/')) {
            fullUrl = baseUrl + url;
          } else {
            fullUrl = baseUrl + '/' + url;
          }
        }
        const encoded = encodePayload({ url: fullUrl });
        return `URI="${proxyBaseUrl}/prime-proxy?url=${encodeURIComponent(encoded)}"`;
      });
    }

    // Handle media segments and other URIs
    if (line.startsWith('/') && !line.startsWith('#')) {
      const fullUrl = baseUrl + line;
      const encoded = encodePayload({ url: fullUrl });
      return `${proxyBaseUrl}/prime-proxy?url=${encodeURIComponent(encoded)}`;
    } else if (line.startsWith('http') && !line.startsWith('#')) {
      const encoded = encodePayload({ url: line });
      return `${proxyBaseUrl}/prime-proxy?url=${encodeURIComponent(encoded)}`;
    } else if (!line.startsWith('#') && !line.startsWith('http') && line.trim() !== '') {
      const fullUrl = baseUrl + '/' + line;
      const encoded = encodePayload({ url: fullUrl });
      return `${proxyBaseUrl}/prime-proxy?url=${encodeURIComponent(encoded)}`;
    }

    return line;
  });

  return rewrittenLines.join('\n');
}

// Main proxy controller
export const primeProxy = async (req: Request, res: Response) => {
  // CORS allow list
  const allowedOrigins = [
    'http://localhost:3000',
    'https://cinemaos.live',
    'https://cinemaos-v3.vercel.app'
  ];

  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  } else {
    res.header('Access-Control-Allow-Origin', '*');
  }

  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS, HEAD');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Referer, User-Agent, Range');
  res.header('Access-Control-Expose-Headers', 'Accept-Ranges, Content-Length, Content-Range, Content-Type');

  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const encodedToken = req.query.url as string;
    if (!encodedToken) {
      return res.status(400).send('Missing url parameter');
    }

    // Always decode the payload
    const { url: targetUrl, ismp4 } = decodePayload(decodeURIComponent(encodedToken));

    console.log("Prime Proxy: Processing URL:", targetUrl);
    console.log("Prime Proxy: Is MP4:", ismp4);

    if (ismp4) {
      // --- MP4 Streaming Logic ---
      const requestHeaders: any = {
        'Accept': '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Sec-Ch-Ua': '"Google Chrome";v="123", "Chromium";v="123", "Not?A_Brand";v="24"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"macOS"',
        'Sec-Fetch-Dest': 'video',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'cross-site',
        'Referer': 'https://xprime.tv/',
        'Origin': 'https://xprime.tv',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'
      };

      if (req.headers.range) {
        requestHeaders['Range'] = req.headers.range;
      }

      const response = await axios.get(targetUrl, {
        responseType: 'stream',
        headers: requestHeaders,
        maxRedirects: 5,
      });

      const streamingHeaders: any = {
        'Content-Type': 'video/mp4',
        'Accept-Ranges': 'bytes',
        'X-Content-Type-Options': 'nosniff'
      };

      if (response.headers['content-length']) {
        streamingHeaders['Content-Length'] = response.headers['content-length'];
      }
      if (response.headers['content-range']) {
        streamingHeaders['Content-Range'] = response.headers['content-range'];
      }
      if (response.headers['etag']) {
        streamingHeaders['ETag'] = response.headers['etag'];
      }
      if (response.headers['cache-control']) {
        streamingHeaders['Cache-Control'] = response.headers['cache-control'];
      } else {
        streamingHeaders['Cache-Control'] = 'public, max-age=3600';
      }

      res.status(response.status);
      res.set(streamingHeaders);

      response.data.pipe(res);
      return;
    }

    // --- M3U8 Proxy Logic ---
    const headers = {
      'Accept': '*/*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      'Sec-Ch-Ua': '"Google Chrome";v="123", "Chromium";v="123", "Not?A_Brand";v="24"',
      'Sec-Ch-Ua-Mobile': '?0',
      'Sec-Ch-Ua-Platform': '"macOS"',
      'Sec-Fetch-Dest': 'empty',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Site': 'cross-site',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
      'Referer': 'https://xprime.tv/',
      'Origin': 'https://xprime.tv'
    };

    const response = await axios.get(targetUrl, {
      headers: headers,
      responseType: 'text',
      timeout: 30000,
    });

    const contentType = response.headers['content-type'] || '';
    
    res.set({
      'Content-Type': contentType,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });

    if (
      contentType.includes('application/vnd.apple.mpegurl') ||
      contentType.includes('application/x-mpegURL') ||
      targetUrl.includes('.m3u8') ||
      response.data.includes('#EXTM3U')
    ) {
      const content = response.data;
      const baseUrl = targetUrl.substring(0, targetUrl.lastIndexOf('/'));
      const proxyBaseUrl = `${req.protocol}://${req.get('host')}`;

      const rewrittenContent = rewriteM3U8Content(content, baseUrl, proxyBaseUrl);
      console.log("Prime Proxy: Successfully processed M3U8 content");
      res.send(rewrittenContent);
    } else {
      console.log("Prime Proxy: Returning raw content, Content-Type:", contentType);
      res.send(response.data);
    }
  } catch (error: any) {
    console.error('Prime proxy error:', {
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      headers: error.response?.headers,
      url: req.query.url
    });

    // Set CORS headers even on error
    const origin = req.headers.origin;
    const allowedOrigins = [
      'http://localhost:3000',
      'https://cinemaos.live',
      'https://cinemaos-v3.vercel.app'
    ];

    if (origin && allowedOrigins.includes(origin)) {
      res.header('Access-Control-Allow-Origin', origin);
    } else {
      res.header('Access-Control-Allow-Origin', '*');
    }

    res.header('Access-Control-Allow-Methods', 'GET, OPTIONS, HEAD');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Referer, User-Agent, Range');
    res.header('Access-Control-Expose-Headers', 'Accept-Ranges, Content-Length, Content-Range, Content-Type');

    res.status(error.response?.status || 500).send(
      `Error: ${error.message}. Status: ${error.response?.status || 'unknown'}`
    );
  }
};