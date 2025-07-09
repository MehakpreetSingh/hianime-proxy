import { Transform } from 'stream';

export const allowedExtensions = ['.ts', '.m4s', '.mp4', '.webm', '.m3u8'];

export class LineTransformMaxflix extends Transform {
  private buffer: string = '';
  private baseUrl: string;

  constructor(baseUrl: string) {
    super({ objectMode: false });
    this.baseUrl = baseUrl;
  }

  _transform(chunk: any, encoding: string, callback: Function) {
    this.buffer += chunk.toString();
    const lines = this.buffer.split('\n');
    
    // Keep the last line in buffer as it might be incomplete
    this.buffer = lines.pop() || '';
    
    for (const line of lines) {
      const transformedLine = this.transformLine(line);
      this.push(transformedLine + '\n');
    }
    
    callback();
  }

  _flush(callback: Function) {
    if (this.buffer) {
      const transformedLine = this.transformLine(this.buffer);
      this.push(transformedLine);
    }
    callback();
  }

  private transformLine(line: string): string {
    const trimmedLine = line.trim();
    
    // Skip empty lines and comments
    if (!trimmedLine || trimmedLine.startsWith('#')) {
      return line;
    }

    // Check if line is a URL (segment or sub-playlist)
    if (this.isUrl(trimmedLine)) {
      return this.transformUrl(trimmedLine);
    }

    return line;
  }

  private isUrl(line: string): boolean {
    // Check for relative URLs or full URLs
    return !line.startsWith('#') && 
           (line.includes('.') || line.startsWith('http') || line.startsWith('/'));
  }

  private transformUrl(url: string): string {
    let targetUrl: string;

    // Check if this is already a maxflix proxy URL
    if (url.includes('proxy.maxflix.top/m3u8-proxy?url=')) {
      // Extract the URL parameter from the maxflix proxy URL
      const urlMatch = url.match(/url=([^&]+)/);
      if (urlMatch) {
        targetUrl = decodeURIComponent(urlMatch[1]);
      } else {
        targetUrl = url;
      }
    } else {
      // Handle regular URLs
      if (url.startsWith('http')) {
        targetUrl = url;
      } else if (url.startsWith('/')) {
        const urlObj = new URL(this.baseUrl);
        targetUrl = `${urlObj.protocol}//${urlObj.host}${url}`;
      } else {
        targetUrl = this.baseUrl + url;
      }
    }

    // URL encode the target URL for our proxy
    const encodedUrl = encodeURIComponent(targetUrl);
    
    // Return our proxy endpoint
    return `/maxflix-proxy?url=${encodedUrl}`;
  }
}