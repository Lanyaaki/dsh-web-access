import z from "@deepseek-ai/schemastery";
import QRCode from "qrcode";

/**
 * @local/dsh-web-access — Host half: a live, page-editable launch token and
 * session lifetime for the Web GUI.
 *
 * `dsh-client-connection` mints a random launch token per process and a
 * 30-day session cookie. The token is only a bootstrap credential — the
 * browser exchanges it for the cookie — but the cookie's expiry leaves the
 * phone without a way back in, because the only copy of the token lives in
 * the startup output of a machine the user may not be near.
 *
 * This plugin keeps both values under the deployment's own configuration:
 *
 * - `launchToken` pins the bootstrap token; empty keeps the per-process
 *   random one.
 * - `cookieMaxAgeDays` lengthens the session cookie; 0 keeps the shipped
 *   30 days.
 * - `publicUrl` is the address the phone reaches the GUI through.
 *
 * All three are volatile fields, so the Settings page edits them live: the
 * Host reads them through the configuration reference on every request
 * instead of capturing them once at boot.
 *
 * The pinned values are applied by redefining `launchToken` and
 * `maxAgeMilliseconds` on the Connection service's browser authentication
 * as accessors over the current configuration. Those are internal fields of
 * `@deepseek-ai/dsh-client-connection`; when a future release renames them
 * this plugin fails loudly at boot instead of silently keeping the random
 * token.
 *
 * @module @local/dsh-web-access
 */

/** Stable Cordis plugin name. */
export const name = "web-access";

/** Services required before the launch token can be pinned. */
export const inject = ["connection", "webApp", "webServer"];

/** Deployment-owned web access values, all editable live from the Settings page. */
export const Config = z.object({
  /** Address the phone reaches this Web GUI through, for example `https://dsh.example.com/`. */
  publicUrl: z.string().default("").volatile(),
  /** Absolute session-cookie lifetime in days; 0 keeps the shipped 30 days. */
  cookieMaxAgeDays: z.number().default(0).volatile(),
  /** Pinned launch token; empty keeps the per-process random token. */
  launchToken: z.string().default("").role("secret").volatile()
});

/** Milliseconds in one day, the unit the browser session cookie uses. */
const DAY_MILLISECONDS = 1440 * 60 * 1e3;
/** Route carrying the page's non-secret view of the current state. */
const STATE_PATH = "/web-access/state";
/** Route serving the QR code of the effective phone URL. */
const QR_PATH = "/web-access/qr.svg";

/**
 * Mount the web-access configuration: pin the token, pin the cookie
 * lifetime, and publish the phone URL as a guarded state route and a QR
 * image.
 * @param ctx - Host plugin context carrying the connection and web server services.
 * @param config - resolved plugin config with volatile field references.
 */
export function apply(ctx, config) {
  const browserAuth = ctx.connection?.browserAuth;
  if (!browserAuth || typeof browserAuth.launchToken !== "string") {
    throw new Error("web-access: this dsh build does not expose connection.browserAuth.launchToken");
  }
  /** The per-process random token, kept for the "leave it empty" case. */
  const randomToken = browserAuth.launchToken;
  /** The session lifetime Connection chose for itself. */
  const defaultMaxAge = browserAuth.maxAgeMilliseconds;

  /** The launch token in force right now. */
  const effectiveToken = () => {
    const value = config.launchToken.get();
    return typeof value === "string" && value.trim() !== "" ? value.trim() : randomToken;
  };
  /** The session-cookie lifetime in force right now. */
  const effectiveMaxAge = () => {
    const days = config.cookieMaxAgeDays.get();
    return typeof days === "number" && days > 0 ? days * DAY_MILLISECONDS : defaultMaxAge;
  };

  Object.defineProperty(browserAuth, "launchToken", {
    configurable: true,
    enumerable: true,
    get: effectiveToken
  });
  Object.defineProperty(browserAuth, "maxAgeMilliseconds", {
    configurable: true,
    enumerable: true,
    get: effectiveMaxAge
  });

  /** The URL the phone opens, carrying the token in force right now. */
  const effectiveUrl = () => {
    const configured = config.publicUrl.get();
    const address = typeof configured === "string" && configured.trim() !== "" ? configured.trim() : ctx.webApp.getAdvertisedUrl();
    const url = new URL(address);
    url.searchParams.set("token", effectiveToken());
    return url.href;
  };

  /**
   * Refuse a request that Connection would refuse, so the state route and
   * the QR image carry the same Host, Origin, and session checks as the API.
   * @param req - incoming request.
   * @param res - response owned when the request is refused.
   * @returns true when the request may proceed.
   */
  const guard = (req, res) => {
    const rejection = ctx.connection.requestRejection(req);
    if (rejection === undefined) return false;
    res.writeHead(rejection);
    res.end(rejection === 401 ? "unauthorized" : "forbidden");
    return true;
  };

  ctx.effect(() => ctx.webServer.register({
    kind: "exact",
    path: STATE_PATH,
    handler: (req, res) => {
      if (guard(req, res)) return;
      const body = JSON.stringify({
        publicUrl: config.publicUrl.get(),
        advertisedUrl: ctx.webApp.getAdvertisedUrl(),
        tokenConfigured: effectiveToken() !== randomToken,
        cookieMaxAgeDays: config.cookieMaxAgeDays.get()
      });
      res.writeHead(200, {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store"
      });
      res.end(body);
    }
  }), "web-access: state route");

  ctx.effect(() => ctx.webServer.register({
    kind: "exact",
    path: QR_PATH,
    handler: (req, res) => {
      if (guard(req, res)) return;
      QRCode.toString(effectiveUrl(), { type: "svg", margin: 1, width: 240 })
        .then((svg) => {
          res.writeHead(200, {
            "content-type": "image/svg+xml; charset=utf-8",
            "cache-control": "no-store"
          });
          res.end(svg);
        })
        .catch((error) => {
          res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
          res.end(`qr failed: ${String(error)}`);
        });
    }
  }), "web-access: qr route");

  // This plugin ships its own Settings page; the automatic page would
  // duplicate it.
  ctx.inject(["settings"], (settingsCtx) => {
    settingsCtx.effect(
      () => settingsCtx.settings.configure({ auto: false }, ctx.fiber),
      "web-access: own settings page"
    );
  });

  console.log(`dsh web-access: phone URL ${effectiveUrl()}`);
}
