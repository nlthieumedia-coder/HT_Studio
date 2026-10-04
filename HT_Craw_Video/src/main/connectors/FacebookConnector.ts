import type { ConnectorItem, PlatformConnector } from './PlatformConnector';
export class FacebookConnector implements PlatformConnector {
  name = 'Facebook'; status = 'NOT_CONNECTED' as const;
  async load(_source: string): Promise<ConnectorItem[]> { throw new Error('Facebook Connector chưa kết nối. Cần API credentials và quyền truy cập hợp lệ.'); }
}
