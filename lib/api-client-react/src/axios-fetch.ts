import axios from "axios";

export type AxiosFetchOptions = RequestInit & {
  responseType?: "json" | "text" | "blob" | "auto";
};

export type AuthTokenGetter = () => Promise<string | null> | string | null;

let baseUrl: string | null = null;
let authTokenGetter: AuthTokenGetter | null = null;

const client = axios.create({
  timeout: 20_000,
  headers: {
    Accept: "application/json",
  },
});

export function setBaseUrl(url: string | null): void {
  baseUrl = url ? url.replace(/\/+$/, "") : null;
}

export function setAuthTokenGetter(getter: AuthTokenGetter | null): void {
  authTokenGetter = getter;
}

export class AxiosApiError<T = unknown> extends Error {
  readonly status: number;
  readonly data: T;
  readonly method: string;
  readonly url: string;

  constructor(status: number, data: T, method: string, url: string) {
    const payload =
      data && typeof data === "object"
        ? (data as Record<string, unknown>)
        : undefined;
    const message =
      (typeof payload?.message === "string" && payload.message) ||
      (typeof payload?.detail === "string" && payload.detail) ||
      `Request failed (${status})`;
    super(message);
    this.name = "AxiosApiError";
    this.status = status;
    this.data = data;
    this.method = method;
    this.url = url;
  }
}

function getInputUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

function getInputMethod(input: RequestInfo | URL): string {
  if (typeof input !== "string" && !(input instanceof URL)) {
    return input.method.toUpperCase();
  }
  return "GET";
}

function toHeaderRecord(headers: HeadersInit | undefined): Record<string, string> {
  const result: Record<string, string> = {};
  if (!headers) return result;
  new Headers(headers).forEach((value, key) => {
    result[key] = value;
  });
  return result;
}

export async function axiosFetch<T = unknown>(
  input: RequestInfo | URL,
  options: AxiosFetchOptions = {},
): Promise<T> {
  const { responseType = "auto", headers: requestHeaders, ...init } = options;
  const relativeUrl = getInputUrl(input);
  const isAbsolute = /^https?:\/\//i.test(relativeUrl);
  if (!isAbsolute && !baseUrl) {
    throw new Error("The Alibhai Points API address is not configured.");
  }

  const method = (init.method ?? getInputMethod(input)).toUpperCase();
  const url = isAbsolute
    ? relativeUrl
    : `${baseUrl}${relativeUrl.startsWith("/") ? "" : "/"}${relativeUrl}`;
  const headers = toHeaderRecord(
    typeof input !== "string" && !(input instanceof URL)
      ? input.headers
      : undefined,
  );
  Object.assign(headers, toHeaderRecord(requestHeaders));

  if (
    authTokenGetter &&
    !Object.keys(headers).some((header) => header.toLowerCase() === "authorization")
  ) {
    const token = await authTokenGetter();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const body =
    init.body ??
    (typeof input !== "string" && !(input instanceof URL) ? input.body : undefined);
  const response = await client.request<T>({
    url,
    method,
    headers,
    data: body,
    signal:
      init.signal ??
      (typeof input !== "string" && !(input instanceof URL)
        ? input.signal
        : undefined),
    responseType: responseType === "text" ? "text" : "json",
    validateStatus: () => true,
  });

  if (response.status < 200 || response.status >= 300) {
    throw new AxiosApiError(
      response.status,
      response.data,
      method,
      url,
    );
  }

  return response.data;
}
