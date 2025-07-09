import axios from "axios";
import { Request, Response } from "express";
import { allowedExtensions, LineTransformMaxflix } from "../utils/lineTransformMaxflix";

export const maxflixProxy = async (req: Request, res: Response) => {
  try {
    const targetUrl = req.query.url as string;
    
     if (!targetUrl) return res.status(400).json("url is required");
    let proxyUrl: string;
    
    // Check if the targetUrl is already a proxy.maxflix.top URL
    if (targetUrl.includes('proxy.maxflix.top')) {
        // If it's already a proxy URL, use it directly
        proxyUrl = targetUrl + `&headers={"Origin":"https://xprime.tv"}`;
        console.log("Using existing maxflix proxy URL:", proxyUrl);
    } else {
        // For regular URLs, create the proxy URL as before
        proxyUrl = `https://proxy.maxflix.top/m3u8-proxy?url=${encodeURIComponent(targetUrl)}`;
        
        // Check if original request contains phoenix.server headers and append them
        if (!targetUrl.includes('proxy.maxflix.top') && req.url.includes('phoenix.server')) {
            proxyUrl += `&headers=%257B%2522referer%2522%253A%2522phoenix.server%252F%2522%252C%2522origin%2522%253A%2522phoenix.server%2522%257D`;
        }
        proxyUrl += `&headers={"Origin":"https://xprime.tv"}`;
        
        console.log("Using new maxflix proxy URL:", proxyUrl);
    } 
    const isStaticFiles = allowedExtensions.some(ext => targetUrl.endsWith(ext) || targetUrl.includes('mon.key'));
    const baseUrl = targetUrl.replace(/[^/]+$/, "");
    console.log("Processing URL through maxflix proxy:", proxyUrl);

    const response = await axios.get(proxyUrl, {
      responseType: 'stream',
      headers: { 
        'Accept': '*/*', 
        'Referer': 'https://maxflix.top',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
        'Origin': 'https://maxflix.top',
      }
    });
    
    const headers = { ...response.headers };
    if (!isStaticFiles) delete headers['content-length'];

    // Add CORS headers
    headers['Access-Control-Allow-Origin'] = '*';
    headers['Access-Control-Allow-Methods'] = 'GET, OPTIONS';
    headers['Access-Control-Allow-Headers'] = 'Origin, X-Requested-With, Content-Type, Accept';
    
    if (targetUrl.endsWith('.m3u8')) {
      headers['Content-Type'] = 'application/vnd.apple.mpegurl';
    } else if (targetUrl.includes('mon.key')) {
      headers['Content-Type'] = 'application/octet-stream';
    }

    res.set(headers);

    if (isStaticFiles) {
      console.log(`Piping static file: ${targetUrl.split('/').pop()}`);
      return response.data.pipe(res);
    }

    console.log(`Transforming m3u8: ${targetUrl.split('/').pop()}`);
    console.log(`Base URL for transformation: ${baseUrl}`);
    const transform = new LineTransformMaxflix(baseUrl);
    response.data.pipe(transform).pipe(res);
  } catch (error: any) {
    console.error("Error details:", {
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      headers: error.response?.headers
    });
    
    res.status(error.response?.status || 500).send(
      `Error: ${error.message}. Status: ${error.response?.status || 'unknown'}`
    );
  }
}