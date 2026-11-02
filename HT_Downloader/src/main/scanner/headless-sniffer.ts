import { BrowserWindow } from 'electron';
import { createHash } from 'node:crypto';
import type { VideoItem } from '../../shared/types';
import { logger } from '../utils/logger';

import { AppError } from '../utils/app-error';

const hash = (value: string): string => createHash('sha256').update(value).digest('hex').slice(0, 16);

interface CapturedMedia {
  url: string;
  headers: Record<string, string>;
  isPriority: boolean;
}

export class HeadlessSniffer {
  async sniff(pageUrl: string, timeoutMs = 12000): Promise<VideoItem | null> {
    logger.info('HEADLESS_SNIFFER_START', { pageUrl });

    return new Promise((resolve, reject) => {
      let resolved = false;
      let win: BrowserWindow | null = null;
      let timer: NodeJS.Timeout | null = null;
      let settleTimer: NodeJS.Timeout | null = null;
      let bestMedia: CapturedMedia | null = null;

      const finish = (result: VideoItem | null, error?: Error): void => {
        if (resolved) return;
        resolved = true;
        if (timer) clearTimeout(timer);
        if (settleTimer) clearTimeout(settleTimer);
        if (win && !win.isDestroyed()) {
          try {
            win.destroy();
          } catch {
            // Window already closed or destroyed
          }
          win = null;
        }
        if (error) {
          reject(error);
        } else {
          resolve(result);
        }
      };

      try {
        win = new BrowserWindow({
          width: 1280,
          height: 800,
          show: false,
          webPreferences: {
            autoplayPolicy: 'no-user-gesture-required'
          }
        });

        win.webContents.setUserAgent(
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'
        );

        const filter = { urls: ['*://*/*'] };

        const scheduleResolve = (delayMs: number): void => {
          if (settleTimer) clearTimeout(settleTimer);
          settleTimer = setTimeout(async () => {
            if (!bestMedia || resolved) return;

            let title = 'Video đã phát hiện';
            let thumbnail: string | undefined;
            let duration: number | undefined;

            if (win && !win.isDestroyed()) {
              try {
                const meta = await win.webContents.executeJavaScript(`
                  (() => {
                    let title = '';
                    let cover = '';
                    let duration = 0;
                    try {
                      const rehy = document.getElementById('__UNIVERSAL_DATA_FOR_REHYDRATION__');
                      if (rehy) {
                        const data = JSON.parse(rehy.textContent);
                        const scope = data['__DEFAULT_SCOPE__'];
                        const item = scope?.['webapp.video-detail']?.itemInfo?.itemStruct;
                        if (item) {
                          const drama = item.dramaInfo;
                          if (drama) {
                            title = (drama.dramaName ? drama.dramaName + ' - ' : '') + (item.desc || ('Tập ' + (drama.DramaVideoData?.EpisodeNumber || '1')));
                          } else {
                            title = item.desc || '';
                          }
                          cover = item.video?.cover || item.video?.originCover || '';
                          duration = item.video?.duration || 0;
                        }
                      }
                    } catch (e) {}

                    if (!title) title = document.title.replace(/\\s*\\|\\s*TikTok\\s*$/i, '').trim();
                    if (!cover) cover = document.querySelector('meta[property="og:image"]')?.content || '';
                    return { title, cover, duration };
                  })()
                `).catch(() => null);

                if (meta && typeof meta === 'object') {
                  if (meta.title) title = meta.title;
                  if (meta.cover && typeof meta.cover === 'string' && meta.cover.startsWith('http')) {
                    thumbnail = meta.cover;
                  }
                  if (meta.duration && typeof meta.duration === 'number') {
                    duration = meta.duration;
                  }
                }
              } catch {
                // Ignore metadata extraction errors
              }
            }

            const videoItem: VideoItem = {
              id: hash(bestMedia.url),
              title,
              thumbnail,
              duration,
              sourceType: 'direct',
              sourceUrl: bestMedia.url,
              formats: [
                {
                  id: `sniffed:${hash(bestMedia.url)}`,
                  qualityLabel: 'Original Quality (MP4)',
                  extension: 'mp4',
                  hasVideo: true,
                  hasAudio: true,
                  sourceUrl: bestMedia.url,
                  referer: pageUrl,
                  httpHeaders: bestMedia.headers
                }
              ]
            };

            logger.info('HEADLESS_SNIFFER_RESOLVED', { title, mediaUrl: bestMedia.url });
            finish(videoItem);
          }, delayMs);
        };

        let isDramaEpisode = false;
        let requiresLogin = false;

        win.webContents.session.webRequest.onBeforeSendHeaders(filter, (details, callback) => {
          const url = details.url;

          // If we already detected that this drama page requires login, ignore any background feed videos!
          if (requiresLogin) {
            callback({});
            return;
          }

          // Filter out subtitles, background sounds, and non-target assets
          const isSubtitle = url.includes('-pv-0037/') || url.endsWith('.vtt');
          const isDummy = url.includes('playback1.mp4');

          const isDramaVideo = url.includes('pve-') || (url.includes('/video/tos/') && !isSubtitle);
          const isVideo = (isDramaVideo || url.includes('mime_type=video_mp4')) && !isDummy && !isSubtitle;

          if (isVideo && !resolved) {
            const isPriority = url.includes('pve-') || url.includes('ply_type=2');

            // If it's a drama episode, prioritize actual drama streams or wait for verification
            if (!bestMedia || isPriority) {
              const headers: Record<string, string> = {};
              if (details.requestHeaders['User-Agent']) headers['User-Agent'] = details.requestHeaders['User-Agent'];
              if (details.requestHeaders['Referer']) headers['Referer'] = details.requestHeaders['Referer'];
              if (details.requestHeaders['Cookie']) headers['Cookie'] = details.requestHeaders['Cookie'];
              if (details.requestHeaders['Origin']) headers['Origin'] = details.requestHeaders['Origin'];

              bestMedia = {
                url,
                headers,
                isPriority
              };

              logger.info('HEADLESS_SNIFFER_CANDIDATE', { mediaUrl: url, isPriority });

              // If drama, allow a bit more time for the page script to verify login status
              scheduleResolve(isDramaEpisode ? 2500 : (isPriority ? 1500 : 3000));
            }
          }

          callback({});
        });

        win.webContents.on('did-finish-load', async () => {
          try {
            // Check if page is a TikTok Drama and whether it requires login
            const status = await win?.webContents.executeJavaScript(`
              (() => {
                let isDrama = false;
                let userIsLogin = false;
                try {
                  const rehy = document.getElementById('__UNIVERSAL_DATA_FOR_REHYDRATION__');
                  if (rehy) {
                    const data = JSON.parse(rehy.textContent);
                    const scope = data['__DEFAULT_SCOPE__'];
                    const item = scope?.['webapp.video-detail']?.itemInfo?.itemStruct;
                    if (item?.dramaInfo) {
                      isDrama = true;
                    }
                    const user = scope?.['webapp.app-context']?.user;
                    if (user && user.isLoggedIn) {
                      userIsLogin = true;
                    }
                  }
                } catch (e) {}

                const text = document.body ? document.body.innerText : '';
                const hasLoginModal = text.includes('Log in to start watching') ||
                                      Boolean(document.querySelector('[class*="StyledPrimaryLoginButton"]')) ||
                                      Boolean(document.querySelector('[class*="StyledLoginButton"]'));

                // If logged in, click the episode button or play video to ensure episode stream starts
                if (isDrama && userIsLogin) {
                  const btn = document.querySelector('[data-testid="short-drama-detail"] button') ||
                              document.querySelector('.css-4cayet-7937d88b--ButtonEpisode') ||
                              document.querySelector('[class*="ButtonEpisode"]');
                  if (btn) btn.click();
                  const v = document.querySelector('video');
                  if (v) v.play().catch(() => {});
                }

                return { isDrama, userIsLogin, hasLoginModal };
              })()
            `).catch(() => null);

            if (status && status.isDrama) {
              isDramaEpisode = true;
              if (!status.userIsLogin && status.hasLoginModal) {
                logger.warn('HEADLESS_SNIFFER_DRAMA_LOGIN_REQUIRED');
                requiresLogin = true;
                bestMedia = null; // Discard any background FYP video captured!
                finish(null, new AppError('LOGIN_REQUIRED', 'Tập phim này (TikTok Mini-Drama) yêu cầu đăng nhập tài khoản TikTok để xem và tải. Vui lòng bấm "Đăng nhập TikTok" để tiếp tục.'));
                return;
              }
            }
          } catch {
            // Ignore execution errors
          }
        });

        timer = setTimeout(() => {
          if (requiresLogin) {
            finish(null, new AppError('LOGIN_REQUIRED', 'Tập phim này (TikTok Mini-Drama) yêu cầu đăng nhập tài khoản TikTok để xem và tải. Vui lòng bấm "Đăng nhập TikTok" để tiếp tục.'));
          } else if (bestMedia) {
            scheduleResolve(0);
          } else {
            logger.warn('HEADLESS_SNIFFER_TIMEOUT', { pageUrl });
            finish(null);
          }
        }, timeoutMs);

        win.loadURL(pageUrl).catch(err => {
          logger.warn('HEADLESS_SNIFFER_LOAD_ERROR', { error: String(err) });
        });
      } catch (err) {
        logger.error('HEADLESS_SNIFFER_ERROR', { error: String(err) });
        finish(null);
      }
    });
  }
}
