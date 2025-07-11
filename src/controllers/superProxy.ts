import axios from "axios";
import { Request, Response } from "express";

export const superProxy = async (req: Request, res: Response) => {
    // Set CORS headers immediately
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, OPTIONS, HEAD');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Referer, User-Agent');
    res.header('Access-Control-Expose-Headers', 'Content-Type, Content-Length');

    // Handle preflight OPTIONS request
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        const url = req.query.url as string;
        const referer = req.query.referer as string || 'https://hexa.watch/';

        if (!url) return res.status(400).json("url is required");

        console.log("Super Proxy M3U8: Processing URL:", url);
        console.log("Super Proxy M3U8: Using Referer:", referer);

        // Build request headers
        const requestHeaders: any = {
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
            'Referer': referer,
            'Origin': referer.replace(/\/$/, ''), // Remove trailing slash
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'
        };

        const response = await axios.get(url, {
            headers: requestHeaders,
            timeout: 30000,
            responseType: 'text'
        });

        let m3u8Content = response.data;

        // Helper function to construct full URL based on the input URL
        const constructFullUrl = (inputUrl: string, relativePath: string): string => {
            if (relativePath.startsWith('http')) {
                return relativePath; // Already a full URL
            }

            // Extract the base URL from the input URL dynamically
            const urlObj = new URL(inputUrl);
            const baseUrl = `${urlObj.protocol}//${urlObj.host}`;

            // Get the directory path from the original URL
            const pathDir = urlObj.pathname.substring(0, urlObj.pathname.lastIndexOf('/') + 1);

            // Handle absolute paths (starting with /)
            if (relativePath.startsWith('/')) {
                return `${baseUrl}${relativePath}`;
            }

            // Handle relative paths
            return `${baseUrl}${pathDir}${relativePath}`;
        };

        // Check if this is a master playlist (contains #EXT-X-STREAM-INF)
        if (m3u8Content.includes('#EXT-X-STREAM-INF') || m3u8Content.includes('#EXT-X-MEDIA:TYPE=AUDIO')) {
            console.log("Super Proxy M3U8: Processing master playlist");

            // Parse and modify master playlist
            const lines = m3u8Content.split('\n');
            const modifiedLines = lines.map((line: string) => {
                // Handle EXT-X-MEDIA lines with URI attribute (for audio/subtitle tracks)
                if (line.startsWith('#EXT-X-MEDIA:') && line.includes('URI=')) {
                    const uriMatch = line.match(/URI="([^"]+)"/);
                    if (uriMatch && uriMatch[1]) {
                        let audioUri = uriMatch[1];

                        // Convert to full URL if needed
                        const fullUrl = constructFullUrl(url, audioUri);
                        const proxyUrl = `/super-proxy?url=${encodeURIComponent(fullUrl)}&referer=${encodeURIComponent(referer)}`;

                        return line.replace(uriMatch[0], `URI="${proxyUrl}"`);
                    }
                    return line;
                }

                // Skip empty lines and comments (except EXT-X-MEDIA which we handled above)
                if (line.trim() === '' || line.startsWith('#')) {
                    return line;
                }

                // This is a playlist URL - convert to our proxy
                if (line.trim() && !line.startsWith('#')) {
                    const fullUrl = constructFullUrl(url, line.trim());
                    return `/super-proxy?url=${encodeURIComponent(fullUrl)}&referer=${encodeURIComponent(referer)}`;
                }

                return line;
            });

            m3u8Content = modifiedLines.join('\n');
        }
        // This is a media playlist (contains #EXTINF)
        else if (m3u8Content.includes('#EXTINF')) {
            console.log("Super Proxy M3U8: Processing media playlist");

            // Parse and modify media playlist
            const lines = m3u8Content.split('\n');
            const modifiedLines = lines.map((line: string) => {
                // Handle EXT-X-KEY lines for encryption keys
                if (line.startsWith('#EXT-X-KEY:') && line.includes('URI=')) {
                    const uriMatch = line.match(/URI="([^"]+)"/);
                    if (uriMatch && uriMatch[1]) {
                        const keyUri = uriMatch[1];
                        const fullUrl = constructFullUrl(url, keyUri);
                        const proxyUrl = `/super-transform?url=${encodeURIComponent(fullUrl)}&referer=${encodeURIComponent(referer)}`;
                        return line.replace(uriMatch[0], `URI="${proxyUrl}"`);
                    }
                    return line;
                }

                // Skip empty lines and comments
                if (line.trim() === '' || line.startsWith('#')) {
                    return line;
                }

                // This is a segment URL - convert to our transform proxy
                if (line.trim() && !line.startsWith('#')) {
                    const fullUrl = constructFullUrl(url, line.trim());
                    return `/super-transform?url=${encodeURIComponent(fullUrl)}&referer=${encodeURIComponent(referer)}`;
                }

                return line;
            });

            m3u8Content = modifiedLines.join('\n');
        }

        // Set appropriate headers for M3U8
        res.set({
            'Content-Type': 'application/vnd.apple.mpegurl',
            'Cache-Control': 'no-cache',
            'Access-Control-Allow-Origin': '*'
        });

        console.log(`Super Proxy M3U8: Successfully processed playlist from: ${url}`);
        res.send(m3u8Content);

    } catch (error: any) {
        console.error("Super Proxy M3U8 error:", {
            message: error.message,
            status: error.response?.status,
            statusText: error.response?.statusText,
            url: req.query.url
        });

        res.status(error.response?.status || 500).send(
            `Error: ${error.message}. Status: ${error.response?.status || 'unknown'}`
        );
    }
};