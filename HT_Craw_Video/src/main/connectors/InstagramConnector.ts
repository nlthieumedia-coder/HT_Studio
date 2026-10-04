import type { ConnectorItem, PlatformConnector } from './PlatformConnector';
export class InstagramConnector implements PlatformConnector {
  name = 'Instagram'; status = 'NOT_CONNECTED' as const;
  async load(_source: string): Promise<ConnectorItem[]> { throw new Error('Instagram Connector chưa kết nối. Cần API credentials và quyền truy cập hợp lệ.'); }
}
