import { loadConfig } from "./config.mjs";

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

/** Call the ReactPress API of the logged-in site. `path` starts with /api/... */
export async function api(method, path, body) {
  const { url, token } = await loadConfig();
  if (!url || !token) throw new Error("Not logged in. Run: reactpress login <site-url>");
  return request(url, token, method, path, body);
}

export async function request(baseUrl, token, method, path, body) {
  let res;
  try {
    res = await fetch(baseUrl + path, {
      method,
      headers: {
        Accept: "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      redirect: "manual",
    });
  } catch (e) {
    throw new Error(`Could not reach ${baseUrl}: ${e.cause?.code ?? e.message}`);
  }
  if (res.status >= 300 && res.status < 400) {
    throw new Error(`${baseUrl}${path} redirected to ${res.headers.get("location")}: check the site URL`);
  }
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    // not JSON
  }
  if (!res.ok) {
    const hint = res.status === 401 ? " (run `reactpress login` again)" : res.status === 403 ? " (your role on this site does not allow it)" : "";
    throw new ApiError(`${json?.error ?? `HTTP ${res.status}`}${hint}`, res.status);
  }
  return json;
}
