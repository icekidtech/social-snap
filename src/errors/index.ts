export class SocialSnapError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'SocialSnapError';
    }
}

export class UnsupportedPlatformerror extends SocialSnapError {
    constructor(url: string) {
        super(`Could not detect a supported platform from the URL: ${url}`);
        this.name = 'UnsupportedPlatformError';
    }
}

export class FetchError extends SocialSnapError {
    public readonly status?: number;
    constructor(message: string, status?: number) {
        super(message);
        this.name = ' FetchError';
        this.status = status;
    }
}

export class ParseError extends SocialSnapError {
  constructor(platform: string, detail?: string) {
    super(`Failed to parse response from ${platform}${detail ? `: ${detail}` : ''}`);
    this.name = 'ParseError';
  }
}
