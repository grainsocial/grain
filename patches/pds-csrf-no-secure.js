"use strict";
// Patched for local HTTP development: Secure flag removed from CSRF cookie
// so ASWebAuthenticationSession on iOS can send it over HTTP://localhost.
// This file is mounted into the PDS container via docker-compose.yml.
// See: @atproto/oauth-provider/dist/router/assets/csrf.js
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupCsrfToken = setupCsrfToken;
exports.validateCsrfToken = validateCsrfToken;
exports.getCookieCsrf = getCookieCsrf;
exports.getHeadersCsrf = getHeadersCsrf;
const http_errors_1 = __importDefault(require("http-errors"));
const oauth_provider_api_1 = require("@atproto/oauth-provider-api");
const index_js_1 = require("../../lib/http/index.js");
const crypto_js_1 = require("../../lib/util/crypto.js");
const TOKEN_BYTE_LENGTH = 12;
const TOKEN_LENGTH = TOKEN_BYTE_LENGTH * 2; // 2 hex chars per byte
const CSRF_COOKIE_OPTIONS = {
  expires: undefined,
  secure: false, // patched: was true, breaks iOS ASWebAuthenticationSession over HTTP
  httpOnly: false,
  sameSite: "lax",
  path: `/`,
};
async function generateCsrfToken() {
  return (0, crypto_js_1.randomHexId)(TOKEN_BYTE_LENGTH);
}
async function setupCsrfToken(req, res) {
  const token = getCookieCsrf(req) || (await generateCsrfToken());
  (0, index_js_1.setCookie)(res, oauth_provider_api_1.CSRF_COOKIE_NAME, token, CSRF_COOKIE_OPTIONS);
}
async function validateCsrfToken(req, res) {
  const cookieValue = getCookieCsrf(req);
  const headerValue = getHeadersCsrf(req);
  (0, index_js_1.setCookie)(
    res,
    oauth_provider_api_1.CSRF_COOKIE_NAME,
    cookieValue || (await generateCsrfToken()),
    CSRF_COOKIE_OPTIONS,
  );
  if (!headerValue) {
    throw (0, http_errors_1.default)(400, `Missing CSRF header`);
  }
  if (!cookieValue) {
    throw (0, http_errors_1.default)(400, `Missing CSRF cookie`);
  }
  if (cookieValue !== headerValue) {
    throw (0, http_errors_1.default)(400, `CSRF mismatch`);
  }
}
function getCookieCsrf(req) {
  const cookieValue = (0, index_js_1.getCookie)(req, oauth_provider_api_1.CSRF_COOKIE_NAME);
  if (cookieValue?.length === TOKEN_LENGTH) {
    return cookieValue;
  }
  return undefined;
}
function getHeadersCsrf(req) {
  const headerValue = req.headers[oauth_provider_api_1.CSRF_HEADER_NAME];
  if (typeof headerValue === "string" && headerValue.length === TOKEN_LENGTH) {
    return headerValue;
  }
  return undefined;
}
