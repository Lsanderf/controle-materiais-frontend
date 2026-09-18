import { expect } from '@playwright/test';

export const failureModes = ['proxy', 'network', 'timeout'];
export const PROXY_HTML = '<!DOCTYPE html><html><body>Cloudflare Tunnel error 1033<pre>java.lang.IllegalStateException\n at private.Service:42</pre></body></html>';
export const CONNECTION_MESSAGE = 'Não foi possível se comunicar com o servidor. Verifique sua conexão e tente novamente.';
export const TIMEOUT_MESSAGE = 'O servidor demorou para responder. Verifique sua conexão e tente novamente.';

export async function prepareFailure(page, mode) {
  let release = () => {};
  const gate = new Promise((resolve) => { release = resolve; });
  if (mode === 'timeout') await page.clock.install();
  return {
    release,
    respond: async (route) => {
      if (mode === 'proxy') return route.fulfill({ status: 503, contentType: 'text/html', body: PROXY_HTML });
      if (mode === 'timeout') await gate;
      return route.abort('internetdisconnected');
    },
    expectError: async (alert) => {
      if (mode === 'timeout') await page.clock.fastForward(30_001);
      await expect(alert).toHaveText(mode === 'timeout' ? TIMEOUT_MESSAGE : CONNECTION_MESSAGE);
      await expect(page.locator('body')).not.toContainText(/<!DOCTYPE|Cloudflare|1033|IllegalStateException|private\.Service/);
    },
  };
}
