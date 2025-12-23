// ワイルドカードサブドメインをPages(subsidy-app)にプロキシするWorker
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // リクエストをsubsidy-app.pages.devに転送
    const targetUrl = new URL(request.url);
    targetUrl.hostname = 'subsidy-app.pages.dev';
    
    // 元のHostヘッダーを保持して転送
    const newRequest = new Request(targetUrl.toString(), {
      method: request.method,
      headers: request.headers,
      body: request.body,
      redirect: 'manual'
    });
    
    // 元のホスト名をヘッダーに追加（アプリ側でテナント判別用）
    newRequest.headers.set('X-Original-Host', url.hostname);
    
    const response = await fetch(newRequest);
    
    // レスポンスを返す
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers
    });
  }
};
