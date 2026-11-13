// Serves the dashboard (web/) from a NEAR testnet account through web4: https://<account>.testnet.page
// The page fetches its data live in the visitor's browser; this contract only serves the files.
import { NearBindgen, view } from "near-sdk-js";
import { WEB4_FILES } from "./web4-files";

@NearBindgen({})
class Site {
  @view({})
  web4_get({ request }: { request: { path?: string } }) {
    const path = !request?.path || request.path === "/" ? "/index.html" : request.path.split("?")[0];
    const file = WEB4_FILES[path];
    if (!file) return { status: 404, contentType: "text/plain; charset=utf-8", body: "Tm90IGZvdW5k" };
    return { contentType: file.t, body: file.b };
  }
}
