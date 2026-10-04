import { AppError } from '../utils/app-error';

export function validatePublicUrl(input: string): URL {
  let trimmed = input.trim();
  if (trimmed.startsWith('@')) {
    trimmed = `https://www.tiktok.com/${trimmed}`;
  } else if (/^(?:www\.)?tiktok\.com\//i.test(trimmed)) {
    trimmed = `https://${trimmed}`;
  }
  let url: URL;
  try { url = new URL(trimmed); } catch { throw new AppError('INVALID_URL', 'Enter a valid HTTP or HTTPS URL.'); }
  if (!['http:', 'https:'].includes(url.protocol) || !url.hostname) throw new AppError('INVALID_URL', 'Only HTTP and HTTPS URLs are supported.');
  if (url.username || url.password) throw new AppError('INVALID_URL', 'URLs containing credentials are not supported.');
  return url;
}
