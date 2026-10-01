// Keep work running after the HTTP response is sent.
//
// On Cloudflare Workers (the Lovable Cloud runtime) unawaited work is
// cancelled when the response ends or the browser disconnects, unless it is
// registered with waitUntil. srvx/nitro expose it on the request; on Node the
// process simply keeps running the promise.
import { getRequest } from "@tanstack/react-start/server";

type WaitUntil = (promise: Promise<unknown>) => void;

export function runInBackground(task: () => Promise<unknown>): void {
  const promise = task().catch((error) => {
    console.error("[background] task failed:", error);
  });
  let waitUntil: WaitUntil | undefined;
  try {
    const request = getRequest() as Request & {
      waitUntil?: WaitUntil;
      runtime?: { cloudflare?: { context?: { waitUntil?: WaitUntil } } };
    };
    waitUntil =
      request.waitUntil?.bind(request) ??
      request.runtime?.cloudflare?.context?.waitUntil?.bind(request.runtime.cloudflare.context);
  } catch {
    // Outside a request (tests, scripts): nothing to register.
  }
  waitUntil?.(promise);
}
