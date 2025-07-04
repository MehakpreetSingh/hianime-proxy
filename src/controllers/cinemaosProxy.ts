import axios from "axios";
import { Request, Response } from "express";
import { allowedExtensions, LineTransform } from "../utils/cinemaos-transform";

export const cinemaosProxy = async (req: Request, res: Response) => {
    // Set CORS headers immediately
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Referer, User-Agent');

    // Handle preflight OPTIONS request
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        const url = req.query.url as string;
        if (!url) return res.status(400).json("url is required");

        const isStaticFiles = allowedExtensions.some(ext => url.endsWith(ext));
        const baseUrl = url.replace(/[^/]+$/, "");
        console.log("CinemaOS: Processing URL:", url);

        // Build the original headers query string for passing to subsequent requests
        const buildHeadersQuery = () => {
            const headerParams: string[] = [];

            if (req.query.referer) {
                headerParams.push(`referer=${encodeURIComponent(req.query.referer as string)}`);
            }
            if (req.query.userAgent) {
                headerParams.push(`userAgent=${encodeURIComponent(req.query.userAgent as string)}`);
            }
            if (req.query.origin) {
                headerParams.push(`origin=${encodeURIComponent(req.query.origin as string)}`);
            }

            // Add custom headers
            Object.keys(req.query).forEach(key => {
                if (key.startsWith('header-')) {
                    headerParams.push(`${key}=${encodeURIComponent(req.query[key] as string)}`);
                }
            });

            return headerParams.join('&');
        };

        const originalHeadersQuery = buildHeadersQuery();
        const getRandomUserAgent = () => {
    const userAgents = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    ];
    return userAgents[Math.floor(Math.random() * userAgents.length)];
};

        // Extract custom headers from request query parameters or use defaults
        const customReferer = req.query.referer as string || req.headers.referer || "https://cinemaos.live/";
        const customUserAgent = req.query.userAgent as string || req.headers['user-agent'] ||
            getRandomUserAgent();
        const customOrigin = req.query.origin as string || req.headers.origin || customReferer;
        console.log("CinemaOS: Using Referer:", customReferer);
        console.log("CinemaOS: Using User-Agent:", customUserAgent);
        console.log("CinemaOS: Using Origin:", customOrigin);

        // Build request headers
        const requestHeaders: any = {
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
            'Sec-Ch-Ua': '"Google Chrome";v="119", "Chromium";v="119", "Not?A_Brand";v="24"',
            'Sec-Ch-Ua-Mobile': '?0',
            'Sec-Ch-Ua-Platform': '"macOS"',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1',
            'Upgrade-Insecure-Requests': '1',
            'Referer': customReferer,
            'Origin': customOrigin,
            'User-Agent': customUserAgent,
            // Remove X-Forwarded headers that might expose Vercel
            'CF-Ray': undefined,
            'CF-Visitor': undefined,
            'CF-Connecting-IP': undefined,
            'X-Forwarded-For': undefined,
            'X-Forwarded-Proto': undefined,
            'X-Vercel-Id': undefined,
            'X-Real-IP': undefined
        };

        // Add any additional custom headers from query parameters
        Object.keys(req.query).forEach(key => {
            if (key.startsWith('header-')) {
                const headerName = key.replace('header-', '');
                requestHeaders[headerName] = req.query[key] as string;
            }
        });

        const response = await axios.get(url, {
            responseType: 'stream',
            headers: requestHeaders,
            maxRedirects: 5,
            timeout: 30000
        });

        const headers = { ...response.headers };

        // Remove problematic headers
        delete headers['content-length'];
        delete headers['content-encoding'];
        delete headers['transfer-encoding'];
        delete headers['connection'];

        // Set appropriate content type
        if (url.endsWith('.m3u8')) {
            headers['Content-Type'] = 'application/vnd.apple.mpegurl';
        } else if (url.endsWith('.ts')) {
            headers['Content-Type'] = 'video/mp2t';
        } else if (url.endsWith('.jpg') || url.endsWith('.jpeg')) {
            headers['Content-Type'] = 'image/jpeg';
        } else if (url.endsWith('.png')) {
            headers['Content-Type'] = 'image/png';
        }

        res.set({
            'Content-Type': 'application/vnd.apple.mpegurl',
            'Cache-Control': 'no-cache',
            'Access-Control-Allow-Origin': '*'
        });

        if (isStaticFiles) {
            console.log(`CinemaOS: Piping static file: ${url.split('/').pop()}`);
            return response.data.pipe(res);
        }

        console.log(`CinemaOS: Transforming m3u8: ${url.split('/').pop()}`);
        const transform = new LineTransform(baseUrl, originalHeadersQuery);
        response.data.pipe(transform).pipe(res);
    } catch (error: any) {
        console.error("CinemaOS proxy error:", {
            message: error.message,
            status: error.response?.status,
            statusText: error.response?.statusText,
            headers: error.response?.headers,
            url: req.query.url
        });

        res.status(error.response?.status || 500).send(
            `Error: ${error.message}. Status: ${error.response?.status || 'unknown'}`
        );
    }
};