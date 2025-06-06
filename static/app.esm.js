var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// node_modules/.deno/htmx.org@1.9.12/node_modules/htmx.org/dist/htmx.min.js
var require_htmx_min = __commonJS({
  "node_modules/.deno/htmx.org@1.9.12/node_modules/htmx.org/dist/htmx.min.js"(exports, module) {
    (function(e2, t2) {
      if (typeof define === "function" && define.amd) {
        define([], t2);
      } else if (typeof module === "object" && module.exports) {
        module.exports = t2();
      } else {
        e2.htmx = e2.htmx || t2();
      }
    })(typeof self !== "undefined" ? self : exports, function() {
      return function() {
        "use strict";
        var Q = { onLoad: F, process: zt, on: de, off: ge, trigger: ce, ajax: Nr, find: C, findAll: f, closest: v, values: function(e2, t2) {
          var r2 = dr(e2, t2 || "post");
          return r2.values;
        }, remove: _, addClass: z, removeClass: n, toggleClass: $, takeClass: W, defineExtension: Ur, removeExtension: Br, logAll: V, logNone: j, logger: null, config: { historyEnabled: true, historyCacheSize: 10, refreshOnHistoryMiss: false, defaultSwapStyle: "innerHTML", defaultSwapDelay: 0, defaultSettleDelay: 20, includeIndicatorStyles: true, indicatorClass: "htmx-indicator", requestClass: "htmx-request", addedClass: "htmx-added", settlingClass: "htmx-settling", swappingClass: "htmx-swapping", allowEval: true, allowScriptTags: true, inlineScriptNonce: "", attributesToSettle: ["class", "style", "width", "height"], withCredentials: false, timeout: 0, wsReconnectDelay: "full-jitter", wsBinaryType: "blob", disableSelector: "[hx-disable], [data-hx-disable]", useTemplateFragments: false, scrollBehavior: "smooth", defaultFocusScroll: false, getCacheBusterParam: false, globalViewTransitions: false, methodsThatUseUrlParams: ["get"], selfRequestsOnly: false, ignoreTitle: false, scrollIntoViewOnBoost: true, triggerSpecsCache: null }, parseInterval: d, _: t, createEventSource: function(e2) {
          return new EventSource(e2, { withCredentials: true });
        }, createWebSocket: function(e2) {
          var t2 = new WebSocket(e2, []);
          t2.binaryType = Q.config.wsBinaryType;
          return t2;
        }, version: "1.9.12" };
        var r = { addTriggerHandler: Lt, bodyContains: se, canAccessLocalStorage: U, findThisElement: xe, filterValues: yr, hasAttribute: o, getAttributeValue: te, getClosestAttributeValue: ne, getClosestMatch: c, getExpressionVars: Hr, getHeaders: xr, getInputValues: dr, getInternalData: ae, getSwapSpecification: wr, getTriggerSpecs: it, getTarget: ye, makeFragment: l, mergeObjects: le, makeSettleInfo: T, oobSwap: Ee, querySelectorExt: ue, selectAndSwap: je, settleImmediately: nr, shouldCancel: ut, triggerEvent: ce, triggerErrorEvent: fe, withExtensions: R };
        var w = ["get", "post", "put", "delete", "patch"];
        var i = w.map(function(e2) {
          return "[hx-" + e2 + "], [data-hx-" + e2 + "]";
        }).join(", ");
        var S = e("head"), q = e("title"), H = e("svg", true);
        function e(e2, t2) {
          return new RegExp("<" + e2 + "(\\s[^>]*>|>)([\\s\\S]*?)<\\/" + e2 + ">", !!t2 ? "gim" : "im");
        }
        function d(e2) {
          if (e2 == void 0) {
            return void 0;
          }
          let t2 = NaN;
          if (e2.slice(-2) == "ms") {
            t2 = parseFloat(e2.slice(0, -2));
          } else if (e2.slice(-1) == "s") {
            t2 = parseFloat(e2.slice(0, -1)) * 1e3;
          } else if (e2.slice(-1) == "m") {
            t2 = parseFloat(e2.slice(0, -1)) * 1e3 * 60;
          } else {
            t2 = parseFloat(e2);
          }
          return isNaN(t2) ? void 0 : t2;
        }
        function ee(e2, t2) {
          return e2.getAttribute && e2.getAttribute(t2);
        }
        function o(e2, t2) {
          return e2.hasAttribute && (e2.hasAttribute(t2) || e2.hasAttribute("data-" + t2));
        }
        function te(e2, t2) {
          return ee(e2, t2) || ee(e2, "data-" + t2);
        }
        function u(e2) {
          return e2.parentElement;
        }
        function re() {
          return document;
        }
        function c(e2, t2) {
          while (e2 && !t2(e2)) {
            e2 = u(e2);
          }
          return e2 ? e2 : null;
        }
        function L(e2, t2, r2) {
          var n2 = te(t2, r2);
          var i2 = te(t2, "hx-disinherit");
          if (e2 !== t2 && i2 && (i2 === "*" || i2.split(" ").indexOf(r2) >= 0)) {
            return "unset";
          } else {
            return n2;
          }
        }
        function ne(t2, r2) {
          var n2 = null;
          c(t2, function(e2) {
            return n2 = L(t2, e2, r2);
          });
          if (n2 !== "unset") {
            return n2;
          }
        }
        function h(e2, t2) {
          var r2 = e2.matches || e2.matchesSelector || e2.msMatchesSelector || e2.mozMatchesSelector || e2.webkitMatchesSelector || e2.oMatchesSelector;
          return r2 && r2.call(e2, t2);
        }
        function A(e2) {
          var t2 = /<([a-z][^\/\0>\x20\t\r\n\f]*)/i;
          var r2 = t2.exec(e2);
          if (r2) {
            return r2[1].toLowerCase();
          } else {
            return "";
          }
        }
        function s(e2, t2) {
          var r2 = new DOMParser();
          var n2 = r2.parseFromString(e2, "text/html");
          var i2 = n2.body;
          while (t2 > 0) {
            t2--;
            i2 = i2.firstChild;
          }
          if (i2 == null) {
            i2 = re().createDocumentFragment();
          }
          return i2;
        }
        function N(e2) {
          return /<body/.test(e2);
        }
        function l(e2) {
          var t2 = !N(e2);
          var r2 = A(e2);
          var n2 = e2;
          if (r2 === "head") {
            n2 = n2.replace(S, "");
          }
          if (Q.config.useTemplateFragments && t2) {
            var i2 = s("<body><template>" + n2 + "</template></body>", 0);
            var a2 = i2.querySelector("template").content;
            if (Q.config.allowScriptTags) {
              oe(a2.querySelectorAll("script"), function(e3) {
                if (Q.config.inlineScriptNonce) {
                  e3.nonce = Q.config.inlineScriptNonce;
                }
                e3.htmxExecuted = navigator.userAgent.indexOf("Firefox") === -1;
              });
            } else {
              oe(a2.querySelectorAll("script"), function(e3) {
                _(e3);
              });
            }
            return a2;
          }
          switch (r2) {
            case "thead":
            case "tbody":
            case "tfoot":
            case "colgroup":
            case "caption":
              return s("<table>" + n2 + "</table>", 1);
            case "col":
              return s("<table><colgroup>" + n2 + "</colgroup></table>", 2);
            case "tr":
              return s("<table><tbody>" + n2 + "</tbody></table>", 2);
            case "td":
            case "th":
              return s("<table><tbody><tr>" + n2 + "</tr></tbody></table>", 3);
            case "script":
            case "style":
              return s("<div>" + n2 + "</div>", 1);
            default:
              return s(n2, 0);
          }
        }
        function ie(e2) {
          if (e2) {
            e2();
          }
        }
        function I(e2, t2) {
          return Object.prototype.toString.call(e2) === "[object " + t2 + "]";
        }
        function k(e2) {
          return I(e2, "Function");
        }
        function P(e2) {
          return I(e2, "Object");
        }
        function ae(e2) {
          var t2 = "htmx-internal-data";
          var r2 = e2[t2];
          if (!r2) {
            r2 = e2[t2] = {};
          }
          return r2;
        }
        function M(e2) {
          var t2 = [];
          if (e2) {
            for (var r2 = 0; r2 < e2.length; r2++) {
              t2.push(e2[r2]);
            }
          }
          return t2;
        }
        function oe(e2, t2) {
          if (e2) {
            for (var r2 = 0; r2 < e2.length; r2++) {
              t2(e2[r2]);
            }
          }
        }
        function X(e2) {
          var t2 = e2.getBoundingClientRect();
          var r2 = t2.top;
          var n2 = t2.bottom;
          return r2 < window.innerHeight && n2 >= 0;
        }
        function se(e2) {
          if (e2.getRootNode && e2.getRootNode() instanceof window.ShadowRoot) {
            return re().body.contains(e2.getRootNode().host);
          } else {
            return re().body.contains(e2);
          }
        }
        function D(e2) {
          return e2.trim().split(/\s+/);
        }
        function le(e2, t2) {
          for (var r2 in t2) {
            if (t2.hasOwnProperty(r2)) {
              e2[r2] = t2[r2];
            }
          }
          return e2;
        }
        function E(e2) {
          try {
            return JSON.parse(e2);
          } catch (e3) {
            b(e3);
            return null;
          }
        }
        function U() {
          var e2 = "htmx:localStorageTest";
          try {
            localStorage.setItem(e2, e2);
            localStorage.removeItem(e2);
            return true;
          } catch (e3) {
            return false;
          }
        }
        function B(t2) {
          try {
            var e2 = new URL(t2);
            if (e2) {
              t2 = e2.pathname + e2.search;
            }
            if (!/^\/$/.test(t2)) {
              t2 = t2.replace(/\/+$/, "");
            }
            return t2;
          } catch (e3) {
            return t2;
          }
        }
        function t(e) {
          return Tr(re().body, function() {
            return eval(e);
          });
        }
        function F(t2) {
          var e2 = Q.on("htmx:load", function(e3) {
            t2(e3.detail.elt);
          });
          return e2;
        }
        function V() {
          Q.logger = function(e2, t2, r2) {
            if (console) {
              console.log(t2, e2, r2);
            }
          };
        }
        function j() {
          Q.logger = null;
        }
        function C(e2, t2) {
          if (t2) {
            return e2.querySelector(t2);
          } else {
            return C(re(), e2);
          }
        }
        function f(e2, t2) {
          if (t2) {
            return e2.querySelectorAll(t2);
          } else {
            return f(re(), e2);
          }
        }
        function _(e2, t2) {
          e2 = p(e2);
          if (t2) {
            setTimeout(function() {
              _(e2);
              e2 = null;
            }, t2);
          } else {
            e2.parentElement.removeChild(e2);
          }
        }
        function z(e2, t2, r2) {
          e2 = p(e2);
          if (r2) {
            setTimeout(function() {
              z(e2, t2);
              e2 = null;
            }, r2);
          } else {
            e2.classList && e2.classList.add(t2);
          }
        }
        function n(e2, t2, r2) {
          e2 = p(e2);
          if (r2) {
            setTimeout(function() {
              n(e2, t2);
              e2 = null;
            }, r2);
          } else {
            if (e2.classList) {
              e2.classList.remove(t2);
              if (e2.classList.length === 0) {
                e2.removeAttribute("class");
              }
            }
          }
        }
        function $(e2, t2) {
          e2 = p(e2);
          e2.classList.toggle(t2);
        }
        function W(e2, t2) {
          e2 = p(e2);
          oe(e2.parentElement.children, function(e3) {
            n(e3, t2);
          });
          z(e2, t2);
        }
        function v(e2, t2) {
          e2 = p(e2);
          if (e2.closest) {
            return e2.closest(t2);
          } else {
            do {
              if (e2 == null || h(e2, t2)) {
                return e2;
              }
            } while (e2 = e2 && u(e2));
            return null;
          }
        }
        function g(e2, t2) {
          return e2.substring(0, t2.length) === t2;
        }
        function G(e2, t2) {
          return e2.substring(e2.length - t2.length) === t2;
        }
        function J(e2) {
          var t2 = e2.trim();
          if (g(t2, "<") && G(t2, "/>")) {
            return t2.substring(1, t2.length - 2);
          } else {
            return t2;
          }
        }
        function Z(e2, t2) {
          if (t2.indexOf("closest ") === 0) {
            return [v(e2, J(t2.substr(8)))];
          } else if (t2.indexOf("find ") === 0) {
            return [C(e2, J(t2.substr(5)))];
          } else if (t2 === "next") {
            return [e2.nextElementSibling];
          } else if (t2.indexOf("next ") === 0) {
            return [K(e2, J(t2.substr(5)))];
          } else if (t2 === "previous") {
            return [e2.previousElementSibling];
          } else if (t2.indexOf("previous ") === 0) {
            return [Y(e2, J(t2.substr(9)))];
          } else if (t2 === "document") {
            return [document];
          } else if (t2 === "window") {
            return [window];
          } else if (t2 === "body") {
            return [document.body];
          } else {
            return re().querySelectorAll(J(t2));
          }
        }
        var K = function(e2, t2) {
          var r2 = re().querySelectorAll(t2);
          for (var n2 = 0; n2 < r2.length; n2++) {
            var i2 = r2[n2];
            if (i2.compareDocumentPosition(e2) === Node.DOCUMENT_POSITION_PRECEDING) {
              return i2;
            }
          }
        };
        var Y = function(e2, t2) {
          var r2 = re().querySelectorAll(t2);
          for (var n2 = r2.length - 1; n2 >= 0; n2--) {
            var i2 = r2[n2];
            if (i2.compareDocumentPosition(e2) === Node.DOCUMENT_POSITION_FOLLOWING) {
              return i2;
            }
          }
        };
        function ue(e2, t2) {
          if (t2) {
            return Z(e2, t2)[0];
          } else {
            return Z(re().body, e2)[0];
          }
        }
        function p(e2) {
          if (I(e2, "String")) {
            return C(e2);
          } else {
            return e2;
          }
        }
        function ve(e2, t2, r2) {
          if (k(t2)) {
            return { target: re().body, event: e2, listener: t2 };
          } else {
            return { target: p(e2), event: t2, listener: r2 };
          }
        }
        function de(t2, r2, n2) {
          jr(function() {
            var e3 = ve(t2, r2, n2);
            e3.target.addEventListener(e3.event, e3.listener);
          });
          var e2 = k(r2);
          return e2 ? r2 : n2;
        }
        function ge(t2, r2, n2) {
          jr(function() {
            var e2 = ve(t2, r2, n2);
            e2.target.removeEventListener(e2.event, e2.listener);
          });
          return k(r2) ? r2 : n2;
        }
        var pe = re().createElement("output");
        function me(e2, t2) {
          var r2 = ne(e2, t2);
          if (r2) {
            if (r2 === "this") {
              return [xe(e2, t2)];
            } else {
              var n2 = Z(e2, r2);
              if (n2.length === 0) {
                b('The selector "' + r2 + '" on ' + t2 + " returned no matches!");
                return [pe];
              } else {
                return n2;
              }
            }
          }
        }
        function xe(e2, t2) {
          return c(e2, function(e3) {
            return te(e3, t2) != null;
          });
        }
        function ye(e2) {
          var t2 = ne(e2, "hx-target");
          if (t2) {
            if (t2 === "this") {
              return xe(e2, "hx-target");
            } else {
              return ue(e2, t2);
            }
          } else {
            var r2 = ae(e2);
            if (r2.boosted) {
              return re().body;
            } else {
              return e2;
            }
          }
        }
        function be(e2) {
          var t2 = Q.config.attributesToSettle;
          for (var r2 = 0; r2 < t2.length; r2++) {
            if (e2 === t2[r2]) {
              return true;
            }
          }
          return false;
        }
        function we(t2, r2) {
          oe(t2.attributes, function(e2) {
            if (!r2.hasAttribute(e2.name) && be(e2.name)) {
              t2.removeAttribute(e2.name);
            }
          });
          oe(r2.attributes, function(e2) {
            if (be(e2.name)) {
              t2.setAttribute(e2.name, e2.value);
            }
          });
        }
        function Se(e2, t2) {
          var r2 = Fr(t2);
          for (var n2 = 0; n2 < r2.length; n2++) {
            var i2 = r2[n2];
            try {
              if (i2.isInlineSwap(e2)) {
                return true;
              }
            } catch (e3) {
              b(e3);
            }
          }
          return e2 === "outerHTML";
        }
        function Ee(e2, i2, a2) {
          var t2 = "#" + ee(i2, "id");
          var o2 = "outerHTML";
          if (e2 === "true") {
          } else if (e2.indexOf(":") > 0) {
            o2 = e2.substr(0, e2.indexOf(":"));
            t2 = e2.substr(e2.indexOf(":") + 1, e2.length);
          } else {
            o2 = e2;
          }
          var r2 = re().querySelectorAll(t2);
          if (r2) {
            oe(r2, function(e3) {
              var t3;
              var r3 = i2.cloneNode(true);
              t3 = re().createDocumentFragment();
              t3.appendChild(r3);
              if (!Se(o2, e3)) {
                t3 = r3;
              }
              var n2 = { shouldSwap: true, target: e3, fragment: t3 };
              if (!ce(e3, "htmx:oobBeforeSwap", n2)) return;
              e3 = n2.target;
              if (n2["shouldSwap"]) {
                Fe(o2, e3, e3, t3, a2);
              }
              oe(a2.elts, function(e4) {
                ce(e4, "htmx:oobAfterSwap", n2);
              });
            });
            i2.parentNode.removeChild(i2);
          } else {
            i2.parentNode.removeChild(i2);
            fe(re().body, "htmx:oobErrorNoTarget", { content: i2 });
          }
          return e2;
        }
        function Ce(e2, t2, r2) {
          var n2 = ne(e2, "hx-select-oob");
          if (n2) {
            var i2 = n2.split(",");
            for (var a2 = 0; a2 < i2.length; a2++) {
              var o2 = i2[a2].split(":", 2);
              var s2 = o2[0].trim();
              if (s2.indexOf("#") === 0) {
                s2 = s2.substring(1);
              }
              var l2 = o2[1] || "true";
              var u2 = t2.querySelector("#" + s2);
              if (u2) {
                Ee(l2, u2, r2);
              }
            }
          }
          oe(f(t2, "[hx-swap-oob], [data-hx-swap-oob]"), function(e3) {
            var t3 = te(e3, "hx-swap-oob");
            if (t3 != null) {
              Ee(t3, e3, r2);
            }
          });
        }
        function Re(e2) {
          oe(f(e2, "[hx-preserve], [data-hx-preserve]"), function(e3) {
            var t2 = te(e3, "id");
            var r2 = re().getElementById(t2);
            if (r2 != null) {
              e3.parentNode.replaceChild(r2, e3);
            }
          });
        }
        function Te(o2, e2, s2) {
          oe(e2.querySelectorAll("[id]"), function(e3) {
            var t2 = ee(e3, "id");
            if (t2 && t2.length > 0) {
              var r2 = t2.replace("'", "\\'");
              var n2 = e3.tagName.replace(":", "\\:");
              var i2 = o2.querySelector(n2 + "[id='" + r2 + "']");
              if (i2 && i2 !== o2) {
                var a2 = e3.cloneNode();
                we(e3, i2);
                s2.tasks.push(function() {
                  we(e3, a2);
                });
              }
            }
          });
        }
        function Oe(e2) {
          return function() {
            n(e2, Q.config.addedClass);
            zt(e2);
            Nt(e2);
            qe(e2);
            ce(e2, "htmx:load");
          };
        }
        function qe(e2) {
          var t2 = "[autofocus]";
          var r2 = h(e2, t2) ? e2 : e2.querySelector(t2);
          if (r2 != null) {
            r2.focus();
          }
        }
        function a(e2, t2, r2, n2) {
          Te(e2, r2, n2);
          while (r2.childNodes.length > 0) {
            var i2 = r2.firstChild;
            z(i2, Q.config.addedClass);
            e2.insertBefore(i2, t2);
            if (i2.nodeType !== Node.TEXT_NODE && i2.nodeType !== Node.COMMENT_NODE) {
              n2.tasks.push(Oe(i2));
            }
          }
        }
        function He(e2, t2) {
          var r2 = 0;
          while (r2 < e2.length) {
            t2 = (t2 << 5) - t2 + e2.charCodeAt(r2++) | 0;
          }
          return t2;
        }
        function Le(e2) {
          var t2 = 0;
          if (e2.attributes) {
            for (var r2 = 0; r2 < e2.attributes.length; r2++) {
              var n2 = e2.attributes[r2];
              if (n2.value) {
                t2 = He(n2.name, t2);
                t2 = He(n2.value, t2);
              }
            }
          }
          return t2;
        }
        function Ae(e2) {
          var t2 = ae(e2);
          if (t2.onHandlers) {
            for (var r2 = 0; r2 < t2.onHandlers.length; r2++) {
              const n2 = t2.onHandlers[r2];
              e2.removeEventListener(n2.event, n2.listener);
            }
            delete t2.onHandlers;
          }
        }
        function Ne(e2) {
          var t2 = ae(e2);
          if (t2.timeout) {
            clearTimeout(t2.timeout);
          }
          if (t2.webSocket) {
            t2.webSocket.close();
          }
          if (t2.sseEventSource) {
            t2.sseEventSource.close();
          }
          if (t2.listenerInfos) {
            oe(t2.listenerInfos, function(e3) {
              if (e3.on) {
                e3.on.removeEventListener(e3.trigger, e3.listener);
              }
            });
          }
          Ae(e2);
          oe(Object.keys(t2), function(e3) {
            delete t2[e3];
          });
        }
        function m(e2) {
          ce(e2, "htmx:beforeCleanupElement");
          Ne(e2);
          if (e2.children) {
            oe(e2.children, function(e3) {
              m(e3);
            });
          }
        }
        function Ie(t2, e2, r2) {
          if (t2.tagName === "BODY") {
            return Ue(t2, e2, r2);
          } else {
            var n2;
            var i2 = t2.previousSibling;
            a(u(t2), t2, e2, r2);
            if (i2 == null) {
              n2 = u(t2).firstChild;
            } else {
              n2 = i2.nextSibling;
            }
            r2.elts = r2.elts.filter(function(e3) {
              return e3 != t2;
            });
            while (n2 && n2 !== t2) {
              if (n2.nodeType === Node.ELEMENT_NODE) {
                r2.elts.push(n2);
              }
              n2 = n2.nextElementSibling;
            }
            m(t2);
            u(t2).removeChild(t2);
          }
        }
        function ke(e2, t2, r2) {
          return a(e2, e2.firstChild, t2, r2);
        }
        function Pe(e2, t2, r2) {
          return a(u(e2), e2, t2, r2);
        }
        function Me(e2, t2, r2) {
          return a(e2, null, t2, r2);
        }
        function Xe(e2, t2, r2) {
          return a(u(e2), e2.nextSibling, t2, r2);
        }
        function De(e2, t2, r2) {
          m(e2);
          return u(e2).removeChild(e2);
        }
        function Ue(e2, t2, r2) {
          var n2 = e2.firstChild;
          a(e2, n2, t2, r2);
          if (n2) {
            while (n2.nextSibling) {
              m(n2.nextSibling);
              e2.removeChild(n2.nextSibling);
            }
            m(n2);
            e2.removeChild(n2);
          }
        }
        function Be(e2, t2, r2) {
          var n2 = r2 || ne(e2, "hx-select");
          if (n2) {
            var i2 = re().createDocumentFragment();
            oe(t2.querySelectorAll(n2), function(e3) {
              i2.appendChild(e3);
            });
            t2 = i2;
          }
          return t2;
        }
        function Fe(e2, t2, r2, n2, i2) {
          switch (e2) {
            case "none":
              return;
            case "outerHTML":
              Ie(r2, n2, i2);
              return;
            case "afterbegin":
              ke(r2, n2, i2);
              return;
            case "beforebegin":
              Pe(r2, n2, i2);
              return;
            case "beforeend":
              Me(r2, n2, i2);
              return;
            case "afterend":
              Xe(r2, n2, i2);
              return;
            case "delete":
              De(r2, n2, i2);
              return;
            default:
              var a2 = Fr(t2);
              for (var o2 = 0; o2 < a2.length; o2++) {
                var s2 = a2[o2];
                try {
                  var l2 = s2.handleSwap(e2, r2, n2, i2);
                  if (l2) {
                    if (typeof l2.length !== "undefined") {
                      for (var u2 = 0; u2 < l2.length; u2++) {
                        var f2 = l2[u2];
                        if (f2.nodeType !== Node.TEXT_NODE && f2.nodeType !== Node.COMMENT_NODE) {
                          i2.tasks.push(Oe(f2));
                        }
                      }
                    }
                    return;
                  }
                } catch (e3) {
                  b(e3);
                }
              }
              if (e2 === "innerHTML") {
                Ue(r2, n2, i2);
              } else {
                Fe(Q.config.defaultSwapStyle, t2, r2, n2, i2);
              }
          }
        }
        function Ve(e2) {
          if (e2.indexOf("<title") > -1) {
            var t2 = e2.replace(H, "");
            var r2 = t2.match(q);
            if (r2) {
              return r2[2];
            }
          }
        }
        function je(e2, t2, r2, n2, i2, a2) {
          i2.title = Ve(n2);
          var o2 = l(n2);
          if (o2) {
            Ce(r2, o2, i2);
            o2 = Be(r2, o2, a2);
            Re(o2);
            return Fe(e2, r2, t2, o2, i2);
          }
        }
        function _e(e2, t2, r2) {
          var n2 = e2.getResponseHeader(t2);
          if (n2.indexOf("{") === 0) {
            var i2 = E(n2);
            for (var a2 in i2) {
              if (i2.hasOwnProperty(a2)) {
                var o2 = i2[a2];
                if (!P(o2)) {
                  o2 = { value: o2 };
                }
                ce(r2, a2, o2);
              }
            }
          } else {
            var s2 = n2.split(",");
            for (var l2 = 0; l2 < s2.length; l2++) {
              ce(r2, s2[l2].trim(), []);
            }
          }
        }
        var ze = /\s/;
        var x = /[\s,]/;
        var $e = /[_$a-zA-Z]/;
        var We = /[_$a-zA-Z0-9]/;
        var Ge = ['"', "'", "/"];
        var Je = /[^\s]/;
        var Ze = /[{(]/;
        var Ke = /[})]/;
        function Ye(e2) {
          var t2 = [];
          var r2 = 0;
          while (r2 < e2.length) {
            if ($e.exec(e2.charAt(r2))) {
              var n2 = r2;
              while (We.exec(e2.charAt(r2 + 1))) {
                r2++;
              }
              t2.push(e2.substr(n2, r2 - n2 + 1));
            } else if (Ge.indexOf(e2.charAt(r2)) !== -1) {
              var i2 = e2.charAt(r2);
              var n2 = r2;
              r2++;
              while (r2 < e2.length && e2.charAt(r2) !== i2) {
                if (e2.charAt(r2) === "\\") {
                  r2++;
                }
                r2++;
              }
              t2.push(e2.substr(n2, r2 - n2 + 1));
            } else {
              var a2 = e2.charAt(r2);
              t2.push(a2);
            }
            r2++;
          }
          return t2;
        }
        function Qe(e2, t2, r2) {
          return $e.exec(e2.charAt(0)) && e2 !== "true" && e2 !== "false" && e2 !== "this" && e2 !== r2 && t2 !== ".";
        }
        function et(e2, t2, r2) {
          if (t2[0] === "[") {
            t2.shift();
            var n2 = 1;
            var i2 = " return (function(" + r2 + "){ return (";
            var a2 = null;
            while (t2.length > 0) {
              var o2 = t2[0];
              if (o2 === "]") {
                n2--;
                if (n2 === 0) {
                  if (a2 === null) {
                    i2 = i2 + "true";
                  }
                  t2.shift();
                  i2 += ")})";
                  try {
                    var s2 = Tr(e2, function() {
                      return Function(i2)();
                    }, function() {
                      return true;
                    });
                    s2.source = i2;
                    return s2;
                  } catch (e3) {
                    fe(re().body, "htmx:syntax:error", { error: e3, source: i2 });
                    return null;
                  }
                }
              } else if (o2 === "[") {
                n2++;
              }
              if (Qe(o2, a2, r2)) {
                i2 += "((" + r2 + "." + o2 + ") ? (" + r2 + "." + o2 + ") : (window." + o2 + "))";
              } else {
                i2 = i2 + o2;
              }
              a2 = t2.shift();
            }
          }
        }
        function y(e2, t2) {
          var r2 = "";
          while (e2.length > 0 && !t2.test(e2[0])) {
            r2 += e2.shift();
          }
          return r2;
        }
        function tt(e2) {
          var t2;
          if (e2.length > 0 && Ze.test(e2[0])) {
            e2.shift();
            t2 = y(e2, Ke).trim();
            e2.shift();
          } else {
            t2 = y(e2, x);
          }
          return t2;
        }
        var rt = "input, textarea, select";
        function nt(e2, t2, r2) {
          var n2 = [];
          var i2 = Ye(t2);
          do {
            y(i2, Je);
            var a2 = i2.length;
            var o2 = y(i2, /[,\[\s]/);
            if (o2 !== "") {
              if (o2 === "every") {
                var s2 = { trigger: "every" };
                y(i2, Je);
                s2.pollInterval = d(y(i2, /[,\[\s]/));
                y(i2, Je);
                var l2 = et(e2, i2, "event");
                if (l2) {
                  s2.eventFilter = l2;
                }
                n2.push(s2);
              } else if (o2.indexOf("sse:") === 0) {
                n2.push({ trigger: "sse", sseEvent: o2.substr(4) });
              } else {
                var u2 = { trigger: o2 };
                var l2 = et(e2, i2, "event");
                if (l2) {
                  u2.eventFilter = l2;
                }
                while (i2.length > 0 && i2[0] !== ",") {
                  y(i2, Je);
                  var f2 = i2.shift();
                  if (f2 === "changed") {
                    u2.changed = true;
                  } else if (f2 === "once") {
                    u2.once = true;
                  } else if (f2 === "consume") {
                    u2.consume = true;
                  } else if (f2 === "delay" && i2[0] === ":") {
                    i2.shift();
                    u2.delay = d(y(i2, x));
                  } else if (f2 === "from" && i2[0] === ":") {
                    i2.shift();
                    if (Ze.test(i2[0])) {
                      var c2 = tt(i2);
                    } else {
                      var c2 = y(i2, x);
                      if (c2 === "closest" || c2 === "find" || c2 === "next" || c2 === "previous") {
                        i2.shift();
                        var h2 = tt(i2);
                        if (h2.length > 0) {
                          c2 += " " + h2;
                        }
                      }
                    }
                    u2.from = c2;
                  } else if (f2 === "target" && i2[0] === ":") {
                    i2.shift();
                    u2.target = tt(i2);
                  } else if (f2 === "throttle" && i2[0] === ":") {
                    i2.shift();
                    u2.throttle = d(y(i2, x));
                  } else if (f2 === "queue" && i2[0] === ":") {
                    i2.shift();
                    u2.queue = y(i2, x);
                  } else if (f2 === "root" && i2[0] === ":") {
                    i2.shift();
                    u2[f2] = tt(i2);
                  } else if (f2 === "threshold" && i2[0] === ":") {
                    i2.shift();
                    u2[f2] = y(i2, x);
                  } else {
                    fe(e2, "htmx:syntax:error", { token: i2.shift() });
                  }
                }
                n2.push(u2);
              }
            }
            if (i2.length === a2) {
              fe(e2, "htmx:syntax:error", { token: i2.shift() });
            }
            y(i2, Je);
          } while (i2[0] === "," && i2.shift());
          if (r2) {
            r2[t2] = n2;
          }
          return n2;
        }
        function it(e2) {
          var t2 = te(e2, "hx-trigger");
          var r2 = [];
          if (t2) {
            var n2 = Q.config.triggerSpecsCache;
            r2 = n2 && n2[t2] || nt(e2, t2, n2);
          }
          if (r2.length > 0) {
            return r2;
          } else if (h(e2, "form")) {
            return [{ trigger: "submit" }];
          } else if (h(e2, 'input[type="button"], input[type="submit"]')) {
            return [{ trigger: "click" }];
          } else if (h(e2, rt)) {
            return [{ trigger: "change" }];
          } else {
            return [{ trigger: "click" }];
          }
        }
        function at(e2) {
          ae(e2).cancelled = true;
        }
        function ot(e2, t2, r2) {
          var n2 = ae(e2);
          n2.timeout = setTimeout(function() {
            if (se(e2) && n2.cancelled !== true) {
              if (!ct(r2, e2, Wt("hx:poll:trigger", { triggerSpec: r2, target: e2 }))) {
                t2(e2);
              }
              ot(e2, t2, r2);
            }
          }, r2.pollInterval);
        }
        function st(e2) {
          return location.hostname === e2.hostname && ee(e2, "href") && ee(e2, "href").indexOf("#") !== 0;
        }
        function lt(t2, r2, e2) {
          if (t2.tagName === "A" && st(t2) && (t2.target === "" || t2.target === "_self") || t2.tagName === "FORM") {
            r2.boosted = true;
            var n2, i2;
            if (t2.tagName === "A") {
              n2 = "get";
              i2 = ee(t2, "href");
            } else {
              var a2 = ee(t2, "method");
              n2 = a2 ? a2.toLowerCase() : "get";
              if (n2 === "get") {
              }
              i2 = ee(t2, "action");
            }
            e2.forEach(function(e3) {
              ht(t2, function(e4, t3) {
                if (v(e4, Q.config.disableSelector)) {
                  m(e4);
                  return;
                }
                he(n2, i2, e4, t3);
              }, r2, e3, true);
            });
          }
        }
        function ut(e2, t2) {
          if (e2.type === "submit" || e2.type === "click") {
            if (t2.tagName === "FORM") {
              return true;
            }
            if (h(t2, 'input[type="submit"], button') && v(t2, "form") !== null) {
              return true;
            }
            if (t2.tagName === "A" && t2.href && (t2.getAttribute("href") === "#" || t2.getAttribute("href").indexOf("#") !== 0)) {
              return true;
            }
          }
          return false;
        }
        function ft(e2, t2) {
          return ae(e2).boosted && e2.tagName === "A" && t2.type === "click" && (t2.ctrlKey || t2.metaKey);
        }
        function ct(e2, t2, r2) {
          var n2 = e2.eventFilter;
          if (n2) {
            try {
              return n2.call(t2, r2) !== true;
            } catch (e3) {
              fe(re().body, "htmx:eventFilter:error", { error: e3, source: n2.source });
              return true;
            }
          }
          return false;
        }
        function ht(a2, o2, e2, s2, l2) {
          var u2 = ae(a2);
          var t2;
          if (s2.from) {
            t2 = Z(a2, s2.from);
          } else {
            t2 = [a2];
          }
          if (s2.changed) {
            t2.forEach(function(e3) {
              var t3 = ae(e3);
              t3.lastValue = e3.value;
            });
          }
          oe(t2, function(n2) {
            var i2 = function(e3) {
              if (!se(a2)) {
                n2.removeEventListener(s2.trigger, i2);
                return;
              }
              if (ft(a2, e3)) {
                return;
              }
              if (l2 || ut(e3, a2)) {
                e3.preventDefault();
              }
              if (ct(s2, a2, e3)) {
                return;
              }
              var t3 = ae(e3);
              t3.triggerSpec = s2;
              if (t3.handledFor == null) {
                t3.handledFor = [];
              }
              if (t3.handledFor.indexOf(a2) < 0) {
                t3.handledFor.push(a2);
                if (s2.consume) {
                  e3.stopPropagation();
                }
                if (s2.target && e3.target) {
                  if (!h(e3.target, s2.target)) {
                    return;
                  }
                }
                if (s2.once) {
                  if (u2.triggeredOnce) {
                    return;
                  } else {
                    u2.triggeredOnce = true;
                  }
                }
                if (s2.changed) {
                  var r2 = ae(n2);
                  if (r2.lastValue === n2.value) {
                    return;
                  }
                  r2.lastValue = n2.value;
                }
                if (u2.delayed) {
                  clearTimeout(u2.delayed);
                }
                if (u2.throttle) {
                  return;
                }
                if (s2.throttle > 0) {
                  if (!u2.throttle) {
                    o2(a2, e3);
                    u2.throttle = setTimeout(function() {
                      u2.throttle = null;
                    }, s2.throttle);
                  }
                } else if (s2.delay > 0) {
                  u2.delayed = setTimeout(function() {
                    o2(a2, e3);
                  }, s2.delay);
                } else {
                  ce(a2, "htmx:trigger");
                  o2(a2, e3);
                }
              }
            };
            if (e2.listenerInfos == null) {
              e2.listenerInfos = [];
            }
            e2.listenerInfos.push({ trigger: s2.trigger, listener: i2, on: n2 });
            n2.addEventListener(s2.trigger, i2);
          });
        }
        var vt = false;
        var dt = null;
        function gt() {
          if (!dt) {
            dt = function() {
              vt = true;
            };
            window.addEventListener("scroll", dt);
            setInterval(function() {
              if (vt) {
                vt = false;
                oe(re().querySelectorAll("[hx-trigger='revealed'],[data-hx-trigger='revealed']"), function(e2) {
                  pt(e2);
                });
              }
            }, 200);
          }
        }
        function pt(t2) {
          if (!o(t2, "data-hx-revealed") && X(t2)) {
            t2.setAttribute("data-hx-revealed", "true");
            var e2 = ae(t2);
            if (e2.initHash) {
              ce(t2, "revealed");
            } else {
              t2.addEventListener("htmx:afterProcessNode", function(e3) {
                ce(t2, "revealed");
              }, { once: true });
            }
          }
        }
        function mt(e2, t2, r2) {
          var n2 = D(r2);
          for (var i2 = 0; i2 < n2.length; i2++) {
            var a2 = n2[i2].split(/:(.+)/);
            if (a2[0] === "connect") {
              xt(e2, a2[1], 0);
            }
            if (a2[0] === "send") {
              bt(e2);
            }
          }
        }
        function xt(s2, r2, n2) {
          if (!se(s2)) {
            return;
          }
          if (r2.indexOf("/") == 0) {
            var e2 = location.hostname + (location.port ? ":" + location.port : "");
            if (location.protocol == "https:") {
              r2 = "wss://" + e2 + r2;
            } else if (location.protocol == "http:") {
              r2 = "ws://" + e2 + r2;
            }
          }
          var t2 = Q.createWebSocket(r2);
          t2.onerror = function(e3) {
            fe(s2, "htmx:wsError", { error: e3, socket: t2 });
            yt(s2);
          };
          t2.onclose = function(e3) {
            if ([1006, 1012, 1013].indexOf(e3.code) >= 0) {
              var t3 = wt(n2);
              setTimeout(function() {
                xt(s2, r2, n2 + 1);
              }, t3);
            }
          };
          t2.onopen = function(e3) {
            n2 = 0;
          };
          ae(s2).webSocket = t2;
          t2.addEventListener("message", function(e3) {
            if (yt(s2)) {
              return;
            }
            var t3 = e3.data;
            R(s2, function(e4) {
              t3 = e4.transformResponse(t3, null, s2);
            });
            var r3 = T(s2);
            var n3 = l(t3);
            var i2 = M(n3.children);
            for (var a2 = 0; a2 < i2.length; a2++) {
              var o2 = i2[a2];
              Ee(te(o2, "hx-swap-oob") || "true", o2, r3);
            }
            nr(r3.tasks);
          });
        }
        function yt(e2) {
          if (!se(e2)) {
            ae(e2).webSocket.close();
            return true;
          }
        }
        function bt(u2) {
          var f2 = c(u2, function(e2) {
            return ae(e2).webSocket != null;
          });
          if (f2) {
            u2.addEventListener(it(u2)[0].trigger, function(e2) {
              var t2 = ae(f2).webSocket;
              var r2 = xr(u2, f2);
              var n2 = dr(u2, "post");
              var i2 = n2.errors;
              var a2 = n2.values;
              var o2 = Hr(u2);
              var s2 = le(a2, o2);
              var l2 = yr(s2, u2);
              l2["HEADERS"] = r2;
              if (i2 && i2.length > 0) {
                ce(u2, "htmx:validation:halted", i2);
                return;
              }
              t2.send(JSON.stringify(l2));
              if (ut(e2, u2)) {
                e2.preventDefault();
              }
            });
          } else {
            fe(u2, "htmx:noWebSocketSourceError");
          }
        }
        function wt(e2) {
          var t2 = Q.config.wsReconnectDelay;
          if (typeof t2 === "function") {
            return t2(e2);
          }
          if (t2 === "full-jitter") {
            var r2 = Math.min(e2, 6);
            var n2 = 1e3 * Math.pow(2, r2);
            return n2 * Math.random();
          }
          b('htmx.config.wsReconnectDelay must either be a function or the string "full-jitter"');
        }
        function St(e2, t2, r2) {
          var n2 = D(r2);
          for (var i2 = 0; i2 < n2.length; i2++) {
            var a2 = n2[i2].split(/:(.+)/);
            if (a2[0] === "connect") {
              Et(e2, a2[1]);
            }
            if (a2[0] === "swap") {
              Ct(e2, a2[1]);
            }
          }
        }
        function Et(t2, e2) {
          var r2 = Q.createEventSource(e2);
          r2.onerror = function(e3) {
            fe(t2, "htmx:sseError", { error: e3, source: r2 });
            Tt(t2);
          };
          ae(t2).sseEventSource = r2;
        }
        function Ct(a2, o2) {
          var s2 = c(a2, Ot);
          if (s2) {
            var l2 = ae(s2).sseEventSource;
            var u2 = function(e2) {
              if (Tt(s2)) {
                return;
              }
              if (!se(a2)) {
                l2.removeEventListener(o2, u2);
                return;
              }
              var t2 = e2.data;
              R(a2, function(e3) {
                t2 = e3.transformResponse(t2, null, a2);
              });
              var r2 = wr(a2);
              var n2 = ye(a2);
              var i2 = T(a2);
              je(r2.swapStyle, n2, a2, t2, i2);
              nr(i2.tasks);
              ce(a2, "htmx:sseMessage", e2);
            };
            ae(a2).sseListener = u2;
            l2.addEventListener(o2, u2);
          } else {
            fe(a2, "htmx:noSSESourceError");
          }
        }
        function Rt(e2, t2, r2) {
          var n2 = c(e2, Ot);
          if (n2) {
            var i2 = ae(n2).sseEventSource;
            var a2 = function() {
              if (!Tt(n2)) {
                if (se(e2)) {
                  t2(e2);
                } else {
                  i2.removeEventListener(r2, a2);
                }
              }
            };
            ae(e2).sseListener = a2;
            i2.addEventListener(r2, a2);
          } else {
            fe(e2, "htmx:noSSESourceError");
          }
        }
        function Tt(e2) {
          if (!se(e2)) {
            ae(e2).sseEventSource.close();
            return true;
          }
        }
        function Ot(e2) {
          return ae(e2).sseEventSource != null;
        }
        function qt(e2, t2, r2, n2) {
          var i2 = function() {
            if (!r2.loaded) {
              r2.loaded = true;
              t2(e2);
            }
          };
          if (n2 > 0) {
            setTimeout(i2, n2);
          } else {
            i2();
          }
        }
        function Ht(t2, i2, e2) {
          var a2 = false;
          oe(w, function(r2) {
            if (o(t2, "hx-" + r2)) {
              var n2 = te(t2, "hx-" + r2);
              a2 = true;
              i2.path = n2;
              i2.verb = r2;
              e2.forEach(function(e3) {
                Lt(t2, e3, i2, function(e4, t3) {
                  if (v(e4, Q.config.disableSelector)) {
                    m(e4);
                    return;
                  }
                  he(r2, n2, e4, t3);
                });
              });
            }
          });
          return a2;
        }
        function Lt(n2, e2, t2, r2) {
          if (e2.sseEvent) {
            Rt(n2, r2, e2.sseEvent);
          } else if (e2.trigger === "revealed") {
            gt();
            ht(n2, r2, t2, e2);
            pt(n2);
          } else if (e2.trigger === "intersect") {
            var i2 = {};
            if (e2.root) {
              i2.root = ue(n2, e2.root);
            }
            if (e2.threshold) {
              i2.threshold = parseFloat(e2.threshold);
            }
            var a2 = new IntersectionObserver(function(e3) {
              for (var t3 = 0; t3 < e3.length; t3++) {
                var r3 = e3[t3];
                if (r3.isIntersecting) {
                  ce(n2, "intersect");
                  break;
                }
              }
            }, i2);
            a2.observe(n2);
            ht(n2, r2, t2, e2);
          } else if (e2.trigger === "load") {
            if (!ct(e2, n2, Wt("load", { elt: n2 }))) {
              qt(n2, r2, t2, e2.delay);
            }
          } else if (e2.pollInterval > 0) {
            t2.polling = true;
            ot(n2, r2, e2);
          } else {
            ht(n2, r2, t2, e2);
          }
        }
        function At(e2) {
          if (!e2.htmxExecuted && Q.config.allowScriptTags && (e2.type === "text/javascript" || e2.type === "module" || e2.type === "")) {
            var t2 = re().createElement("script");
            oe(e2.attributes, function(e3) {
              t2.setAttribute(e3.name, e3.value);
            });
            t2.textContent = e2.textContent;
            t2.async = false;
            if (Q.config.inlineScriptNonce) {
              t2.nonce = Q.config.inlineScriptNonce;
            }
            var r2 = e2.parentElement;
            try {
              r2.insertBefore(t2, e2);
            } catch (e3) {
              b(e3);
            } finally {
              if (e2.parentElement) {
                e2.parentElement.removeChild(e2);
              }
            }
          }
        }
        function Nt(e2) {
          if (h(e2, "script")) {
            At(e2);
          }
          oe(f(e2, "script"), function(e3) {
            At(e3);
          });
        }
        function It(e2) {
          var t2 = e2.attributes;
          if (!t2) {
            return false;
          }
          for (var r2 = 0; r2 < t2.length; r2++) {
            var n2 = t2[r2].name;
            if (g(n2, "hx-on:") || g(n2, "data-hx-on:") || g(n2, "hx-on-") || g(n2, "data-hx-on-")) {
              return true;
            }
          }
          return false;
        }
        function kt(e2) {
          var t2 = null;
          var r2 = [];
          if (It(e2)) {
            r2.push(e2);
          }
          if (document.evaluate) {
            var n2 = document.evaluate('.//*[@*[ starts-with(name(), "hx-on:") or starts-with(name(), "data-hx-on:") or starts-with(name(), "hx-on-") or starts-with(name(), "data-hx-on-") ]]', e2);
            while (t2 = n2.iterateNext()) r2.push(t2);
          } else if (typeof e2.getElementsByTagName === "function") {
            var i2 = e2.getElementsByTagName("*");
            for (var a2 = 0; a2 < i2.length; a2++) {
              if (It(i2[a2])) {
                r2.push(i2[a2]);
              }
            }
          }
          return r2;
        }
        function Pt(e2) {
          if (e2.querySelectorAll) {
            var t2 = ", [hx-boost] a, [data-hx-boost] a, a[hx-boost], a[data-hx-boost]";
            var r2 = e2.querySelectorAll(i + t2 + ", form, [type='submit'], [hx-sse], [data-hx-sse], [hx-ws], [data-hx-ws], [hx-ext], [data-hx-ext], [hx-trigger], [data-hx-trigger], [hx-on], [data-hx-on]");
            return r2;
          } else {
            return [];
          }
        }
        function Mt(e2) {
          var t2 = v(e2.target, "button, input[type='submit']");
          var r2 = Dt(e2);
          if (r2) {
            r2.lastButtonClicked = t2;
          }
        }
        function Xt(e2) {
          var t2 = Dt(e2);
          if (t2) {
            t2.lastButtonClicked = null;
          }
        }
        function Dt(e2) {
          var t2 = v(e2.target, "button, input[type='submit']");
          if (!t2) {
            return;
          }
          var r2 = p("#" + ee(t2, "form")) || v(t2, "form");
          if (!r2) {
            return;
          }
          return ae(r2);
        }
        function Ut(e2) {
          e2.addEventListener("click", Mt);
          e2.addEventListener("focusin", Mt);
          e2.addEventListener("focusout", Xt);
        }
        function Bt(e2) {
          var t2 = Ye(e2);
          var r2 = 0;
          for (var n2 = 0; n2 < t2.length; n2++) {
            const i2 = t2[n2];
            if (i2 === "{") {
              r2++;
            } else if (i2 === "}") {
              r2--;
            }
          }
          return r2;
        }
        function Ft(t2, e2, r2) {
          var n2 = ae(t2);
          if (!Array.isArray(n2.onHandlers)) {
            n2.onHandlers = [];
          }
          var i2;
          var a2 = function(e3) {
            return Tr(t2, function() {
              if (!i2) {
                i2 = new Function("event", r2);
              }
              i2.call(t2, e3);
            });
          };
          t2.addEventListener(e2, a2);
          n2.onHandlers.push({ event: e2, listener: a2 });
        }
        function Vt(e2) {
          var t2 = te(e2, "hx-on");
          if (t2) {
            var r2 = {};
            var n2 = t2.split("\n");
            var i2 = null;
            var a2 = 0;
            while (n2.length > 0) {
              var o2 = n2.shift();
              var s2 = o2.match(/^\s*([a-zA-Z:\-\.]+:)(.*)/);
              if (a2 === 0 && s2) {
                o2.split(":");
                i2 = s2[1].slice(0, -1);
                r2[i2] = s2[2];
              } else {
                r2[i2] += o2;
              }
              a2 += Bt(o2);
            }
            for (var l2 in r2) {
              Ft(e2, l2, r2[l2]);
            }
          }
        }
        function jt(e2) {
          Ae(e2);
          for (var t2 = 0; t2 < e2.attributes.length; t2++) {
            var r2 = e2.attributes[t2].name;
            var n2 = e2.attributes[t2].value;
            if (g(r2, "hx-on") || g(r2, "data-hx-on")) {
              var i2 = r2.indexOf("-on") + 3;
              var a2 = r2.slice(i2, i2 + 1);
              if (a2 === "-" || a2 === ":") {
                var o2 = r2.slice(i2 + 1);
                if (g(o2, ":")) {
                  o2 = "htmx" + o2;
                } else if (g(o2, "-")) {
                  o2 = "htmx:" + o2.slice(1);
                } else if (g(o2, "htmx-")) {
                  o2 = "htmx:" + o2.slice(5);
                }
                Ft(e2, o2, n2);
              }
            }
          }
        }
        function _t(t2) {
          if (v(t2, Q.config.disableSelector)) {
            m(t2);
            return;
          }
          var r2 = ae(t2);
          if (r2.initHash !== Le(t2)) {
            Ne(t2);
            r2.initHash = Le(t2);
            Vt(t2);
            ce(t2, "htmx:beforeProcessNode");
            if (t2.value) {
              r2.lastValue = t2.value;
            }
            var e2 = it(t2);
            var n2 = Ht(t2, r2, e2);
            if (!n2) {
              if (ne(t2, "hx-boost") === "true") {
                lt(t2, r2, e2);
              } else if (o(t2, "hx-trigger")) {
                e2.forEach(function(e3) {
                  Lt(t2, e3, r2, function() {
                  });
                });
              }
            }
            if (t2.tagName === "FORM" || ee(t2, "type") === "submit" && o(t2, "form")) {
              Ut(t2);
            }
            var i2 = te(t2, "hx-sse");
            if (i2) {
              St(t2, r2, i2);
            }
            var a2 = te(t2, "hx-ws");
            if (a2) {
              mt(t2, r2, a2);
            }
            ce(t2, "htmx:afterProcessNode");
          }
        }
        function zt(e2) {
          e2 = p(e2);
          if (v(e2, Q.config.disableSelector)) {
            m(e2);
            return;
          }
          _t(e2);
          oe(Pt(e2), function(e3) {
            _t(e3);
          });
          oe(kt(e2), jt);
        }
        function $t(e2) {
          return e2.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
        }
        function Wt(e2, t2) {
          var r2;
          if (window.CustomEvent && typeof window.CustomEvent === "function") {
            r2 = new CustomEvent(e2, { bubbles: true, cancelable: true, detail: t2 });
          } else {
            r2 = re().createEvent("CustomEvent");
            r2.initCustomEvent(e2, true, true, t2);
          }
          return r2;
        }
        function fe(e2, t2, r2) {
          ce(e2, t2, le({ error: t2 }, r2));
        }
        function Gt(e2) {
          return e2 === "htmx:afterProcessNode";
        }
        function R(e2, t2) {
          oe(Fr(e2), function(e3) {
            try {
              t2(e3);
            } catch (e4) {
              b(e4);
            }
          });
        }
        function b(e2) {
          if (console.error) {
            console.error(e2);
          } else if (console.log) {
            console.log("ERROR: ", e2);
          }
        }
        function ce(e2, t2, r2) {
          e2 = p(e2);
          if (r2 == null) {
            r2 = {};
          }
          r2["elt"] = e2;
          var n2 = Wt(t2, r2);
          if (Q.logger && !Gt(t2)) {
            Q.logger(e2, t2, r2);
          }
          if (r2.error) {
            b(r2.error);
            ce(e2, "htmx:error", { errorInfo: r2 });
          }
          var i2 = e2.dispatchEvent(n2);
          var a2 = $t(t2);
          if (i2 && a2 !== t2) {
            var o2 = Wt(a2, n2.detail);
            i2 = i2 && e2.dispatchEvent(o2);
          }
          R(e2, function(e3) {
            i2 = i2 && (e3.onEvent(t2, n2) !== false && !n2.defaultPrevented);
          });
          return i2;
        }
        var Jt = location.pathname + location.search;
        function Zt() {
          var e2 = re().querySelector("[hx-history-elt],[data-hx-history-elt]");
          return e2 || re().body;
        }
        function Kt(e2, t2, r2, n2) {
          if (!U()) {
            return;
          }
          if (Q.config.historyCacheSize <= 0) {
            localStorage.removeItem("htmx-history-cache");
            return;
          }
          e2 = B(e2);
          var i2 = E(localStorage.getItem("htmx-history-cache")) || [];
          for (var a2 = 0; a2 < i2.length; a2++) {
            if (i2[a2].url === e2) {
              i2.splice(a2, 1);
              break;
            }
          }
          var o2 = { url: e2, content: t2, title: r2, scroll: n2 };
          ce(re().body, "htmx:historyItemCreated", { item: o2, cache: i2 });
          i2.push(o2);
          while (i2.length > Q.config.historyCacheSize) {
            i2.shift();
          }
          while (i2.length > 0) {
            try {
              localStorage.setItem("htmx-history-cache", JSON.stringify(i2));
              break;
            } catch (e3) {
              fe(re().body, "htmx:historyCacheError", { cause: e3, cache: i2 });
              i2.shift();
            }
          }
        }
        function Yt(e2) {
          if (!U()) {
            return null;
          }
          e2 = B(e2);
          var t2 = E(localStorage.getItem("htmx-history-cache")) || [];
          for (var r2 = 0; r2 < t2.length; r2++) {
            if (t2[r2].url === e2) {
              return t2[r2];
            }
          }
          return null;
        }
        function Qt(e2) {
          var t2 = Q.config.requestClass;
          var r2 = e2.cloneNode(true);
          oe(f(r2, "." + t2), function(e3) {
            n(e3, t2);
          });
          return r2.innerHTML;
        }
        function er() {
          var e2 = Zt();
          var t2 = Jt || location.pathname + location.search;
          var r2;
          try {
            r2 = re().querySelector('[hx-history="false" i],[data-hx-history="false" i]');
          } catch (e3) {
            r2 = re().querySelector('[hx-history="false"],[data-hx-history="false"]');
          }
          if (!r2) {
            ce(re().body, "htmx:beforeHistorySave", { path: t2, historyElt: e2 });
            Kt(t2, Qt(e2), re().title, window.scrollY);
          }
          if (Q.config.historyEnabled) history.replaceState({ htmx: true }, re().title, window.location.href);
        }
        function tr(e2) {
          if (Q.config.getCacheBusterParam) {
            e2 = e2.replace(/org\.htmx\.cache-buster=[^&]*&?/, "");
            if (G(e2, "&") || G(e2, "?")) {
              e2 = e2.slice(0, -1);
            }
          }
          if (Q.config.historyEnabled) {
            history.pushState({ htmx: true }, "", e2);
          }
          Jt = e2;
        }
        function rr(e2) {
          if (Q.config.historyEnabled) history.replaceState({ htmx: true }, "", e2);
          Jt = e2;
        }
        function nr(e2) {
          oe(e2, function(e3) {
            e3.call();
          });
        }
        function ir(a2) {
          var e2 = new XMLHttpRequest();
          var o2 = { path: a2, xhr: e2 };
          ce(re().body, "htmx:historyCacheMiss", o2);
          e2.open("GET", a2, true);
          e2.setRequestHeader("HX-Request", "true");
          e2.setRequestHeader("HX-History-Restore-Request", "true");
          e2.setRequestHeader("HX-Current-URL", re().location.href);
          e2.onload = function() {
            if (this.status >= 200 && this.status < 400) {
              ce(re().body, "htmx:historyCacheMissLoad", o2);
              var e3 = l(this.response);
              e3 = e3.querySelector("[hx-history-elt],[data-hx-history-elt]") || e3;
              var t2 = Zt();
              var r2 = T(t2);
              var n2 = Ve(this.response);
              if (n2) {
                var i2 = C("title");
                if (i2) {
                  i2.innerHTML = n2;
                } else {
                  window.document.title = n2;
                }
              }
              Ue(t2, e3, r2);
              nr(r2.tasks);
              Jt = a2;
              ce(re().body, "htmx:historyRestore", { path: a2, cacheMiss: true, serverResponse: this.response });
            } else {
              fe(re().body, "htmx:historyCacheMissLoadError", o2);
            }
          };
          e2.send();
        }
        function ar(e2) {
          er();
          e2 = e2 || location.pathname + location.search;
          var t2 = Yt(e2);
          if (t2) {
            var r2 = l(t2.content);
            var n2 = Zt();
            var i2 = T(n2);
            Ue(n2, r2, i2);
            nr(i2.tasks);
            document.title = t2.title;
            setTimeout(function() {
              window.scrollTo(0, t2.scroll);
            }, 0);
            Jt = e2;
            ce(re().body, "htmx:historyRestore", { path: e2, item: t2 });
          } else {
            if (Q.config.refreshOnHistoryMiss) {
              window.location.reload(true);
            } else {
              ir(e2);
            }
          }
        }
        function or(e2) {
          var t2 = me(e2, "hx-indicator");
          if (t2 == null) {
            t2 = [e2];
          }
          oe(t2, function(e3) {
            var t3 = ae(e3);
            t3.requestCount = (t3.requestCount || 0) + 1;
            e3.classList["add"].call(e3.classList, Q.config.requestClass);
          });
          return t2;
        }
        function sr(e2) {
          var t2 = me(e2, "hx-disabled-elt");
          if (t2 == null) {
            t2 = [];
          }
          oe(t2, function(e3) {
            var t3 = ae(e3);
            t3.requestCount = (t3.requestCount || 0) + 1;
            e3.setAttribute("disabled", "");
          });
          return t2;
        }
        function lr(e2, t2) {
          oe(e2, function(e3) {
            var t3 = ae(e3);
            t3.requestCount = (t3.requestCount || 0) - 1;
            if (t3.requestCount === 0) {
              e3.classList["remove"].call(e3.classList, Q.config.requestClass);
            }
          });
          oe(t2, function(e3) {
            var t3 = ae(e3);
            t3.requestCount = (t3.requestCount || 0) - 1;
            if (t3.requestCount === 0) {
              e3.removeAttribute("disabled");
            }
          });
        }
        function ur(e2, t2) {
          for (var r2 = 0; r2 < e2.length; r2++) {
            var n2 = e2[r2];
            if (n2.isSameNode(t2)) {
              return true;
            }
          }
          return false;
        }
        function fr(e2) {
          if (e2.name === "" || e2.name == null || e2.disabled || v(e2, "fieldset[disabled]")) {
            return false;
          }
          if (e2.type === "button" || e2.type === "submit" || e2.tagName === "image" || e2.tagName === "reset" || e2.tagName === "file") {
            return false;
          }
          if (e2.type === "checkbox" || e2.type === "radio") {
            return e2.checked;
          }
          return true;
        }
        function cr(e2, t2, r2) {
          if (e2 != null && t2 != null) {
            var n2 = r2[e2];
            if (n2 === void 0) {
              r2[e2] = t2;
            } else if (Array.isArray(n2)) {
              if (Array.isArray(t2)) {
                r2[e2] = n2.concat(t2);
              } else {
                n2.push(t2);
              }
            } else {
              if (Array.isArray(t2)) {
                r2[e2] = [n2].concat(t2);
              } else {
                r2[e2] = [n2, t2];
              }
            }
          }
        }
        function hr(t2, r2, n2, e2, i2) {
          if (e2 == null || ur(t2, e2)) {
            return;
          } else {
            t2.push(e2);
          }
          if (fr(e2)) {
            var a2 = ee(e2, "name");
            var o2 = e2.value;
            if (e2.multiple && e2.tagName === "SELECT") {
              o2 = M(e2.querySelectorAll("option:checked")).map(function(e3) {
                return e3.value;
              });
            }
            if (e2.files) {
              o2 = M(e2.files);
            }
            cr(a2, o2, r2);
            if (i2) {
              vr(e2, n2);
            }
          }
          if (h(e2, "form")) {
            var s2 = e2.elements;
            oe(s2, function(e3) {
              hr(t2, r2, n2, e3, i2);
            });
          }
        }
        function vr(e2, t2) {
          if (e2.willValidate) {
            ce(e2, "htmx:validation:validate");
            if (!e2.checkValidity()) {
              t2.push({ elt: e2, message: e2.validationMessage, validity: e2.validity });
              ce(e2, "htmx:validation:failed", { message: e2.validationMessage, validity: e2.validity });
            }
          }
        }
        function dr(e2, t2) {
          var r2 = [];
          var n2 = {};
          var i2 = {};
          var a2 = [];
          var o2 = ae(e2);
          if (o2.lastButtonClicked && !se(o2.lastButtonClicked)) {
            o2.lastButtonClicked = null;
          }
          var s2 = h(e2, "form") && e2.noValidate !== true || te(e2, "hx-validate") === "true";
          if (o2.lastButtonClicked) {
            s2 = s2 && o2.lastButtonClicked.formNoValidate !== true;
          }
          if (t2 !== "get") {
            hr(r2, i2, a2, v(e2, "form"), s2);
          }
          hr(r2, n2, a2, e2, s2);
          if (o2.lastButtonClicked || e2.tagName === "BUTTON" || e2.tagName === "INPUT" && ee(e2, "type") === "submit") {
            var l2 = o2.lastButtonClicked || e2;
            var u2 = ee(l2, "name");
            cr(u2, l2.value, i2);
          }
          var f2 = me(e2, "hx-include");
          oe(f2, function(e3) {
            hr(r2, n2, a2, e3, s2);
            if (!h(e3, "form")) {
              oe(e3.querySelectorAll(rt), function(e4) {
                hr(r2, n2, a2, e4, s2);
              });
            }
          });
          n2 = le(n2, i2);
          return { errors: a2, values: n2 };
        }
        function gr(e2, t2, r2) {
          if (e2 !== "") {
            e2 += "&";
          }
          if (String(r2) === "[object Object]") {
            r2 = JSON.stringify(r2);
          }
          var n2 = encodeURIComponent(r2);
          e2 += encodeURIComponent(t2) + "=" + n2;
          return e2;
        }
        function pr(e2) {
          var t2 = "";
          for (var r2 in e2) {
            if (e2.hasOwnProperty(r2)) {
              var n2 = e2[r2];
              if (Array.isArray(n2)) {
                oe(n2, function(e3) {
                  t2 = gr(t2, r2, e3);
                });
              } else {
                t2 = gr(t2, r2, n2);
              }
            }
          }
          return t2;
        }
        function mr(e2) {
          var t2 = new FormData();
          for (var r2 in e2) {
            if (e2.hasOwnProperty(r2)) {
              var n2 = e2[r2];
              if (Array.isArray(n2)) {
                oe(n2, function(e3) {
                  t2.append(r2, e3);
                });
              } else {
                t2.append(r2, n2);
              }
            }
          }
          return t2;
        }
        function xr(e2, t2, r2) {
          var n2 = { "HX-Request": "true", "HX-Trigger": ee(e2, "id"), "HX-Trigger-Name": ee(e2, "name"), "HX-Target": te(t2, "id"), "HX-Current-URL": re().location.href };
          Rr(e2, "hx-headers", false, n2);
          if (r2 !== void 0) {
            n2["HX-Prompt"] = r2;
          }
          if (ae(e2).boosted) {
            n2["HX-Boosted"] = "true";
          }
          return n2;
        }
        function yr(t2, e2) {
          var r2 = ne(e2, "hx-params");
          if (r2) {
            if (r2 === "none") {
              return {};
            } else if (r2 === "*") {
              return t2;
            } else if (r2.indexOf("not ") === 0) {
              oe(r2.substr(4).split(","), function(e3) {
                e3 = e3.trim();
                delete t2[e3];
              });
              return t2;
            } else {
              var n2 = {};
              oe(r2.split(","), function(e3) {
                e3 = e3.trim();
                n2[e3] = t2[e3];
              });
              return n2;
            }
          } else {
            return t2;
          }
        }
        function br(e2) {
          return ee(e2, "href") && ee(e2, "href").indexOf("#") >= 0;
        }
        function wr(e2, t2) {
          var r2 = t2 ? t2 : ne(e2, "hx-swap");
          var n2 = { swapStyle: ae(e2).boosted ? "innerHTML" : Q.config.defaultSwapStyle, swapDelay: Q.config.defaultSwapDelay, settleDelay: Q.config.defaultSettleDelay };
          if (Q.config.scrollIntoViewOnBoost && ae(e2).boosted && !br(e2)) {
            n2["show"] = "top";
          }
          if (r2) {
            var i2 = D(r2);
            if (i2.length > 0) {
              for (var a2 = 0; a2 < i2.length; a2++) {
                var o2 = i2[a2];
                if (o2.indexOf("swap:") === 0) {
                  n2["swapDelay"] = d(o2.substr(5));
                } else if (o2.indexOf("settle:") === 0) {
                  n2["settleDelay"] = d(o2.substr(7));
                } else if (o2.indexOf("transition:") === 0) {
                  n2["transition"] = o2.substr(11) === "true";
                } else if (o2.indexOf("ignoreTitle:") === 0) {
                  n2["ignoreTitle"] = o2.substr(12) === "true";
                } else if (o2.indexOf("scroll:") === 0) {
                  var s2 = o2.substr(7);
                  var l2 = s2.split(":");
                  var u2 = l2.pop();
                  var f2 = l2.length > 0 ? l2.join(":") : null;
                  n2["scroll"] = u2;
                  n2["scrollTarget"] = f2;
                } else if (o2.indexOf("show:") === 0) {
                  var c2 = o2.substr(5);
                  var l2 = c2.split(":");
                  var h2 = l2.pop();
                  var f2 = l2.length > 0 ? l2.join(":") : null;
                  n2["show"] = h2;
                  n2["showTarget"] = f2;
                } else if (o2.indexOf("focus-scroll:") === 0) {
                  var v2 = o2.substr("focus-scroll:".length);
                  n2["focusScroll"] = v2 == "true";
                } else if (a2 == 0) {
                  n2["swapStyle"] = o2;
                } else {
                  b("Unknown modifier in hx-swap: " + o2);
                }
              }
            }
          }
          return n2;
        }
        function Sr(e2) {
          return ne(e2, "hx-encoding") === "multipart/form-data" || h(e2, "form") && ee(e2, "enctype") === "multipart/form-data";
        }
        function Er(t2, r2, n2) {
          var i2 = null;
          R(r2, function(e2) {
            if (i2 == null) {
              i2 = e2.encodeParameters(t2, n2, r2);
            }
          });
          if (i2 != null) {
            return i2;
          } else {
            if (Sr(r2)) {
              return mr(n2);
            } else {
              return pr(n2);
            }
          }
        }
        function T(e2) {
          return { tasks: [], elts: [e2] };
        }
        function Cr(e2, t2) {
          var r2 = e2[0];
          var n2 = e2[e2.length - 1];
          if (t2.scroll) {
            var i2 = null;
            if (t2.scrollTarget) {
              i2 = ue(r2, t2.scrollTarget);
            }
            if (t2.scroll === "top" && (r2 || i2)) {
              i2 = i2 || r2;
              i2.scrollTop = 0;
            }
            if (t2.scroll === "bottom" && (n2 || i2)) {
              i2 = i2 || n2;
              i2.scrollTop = i2.scrollHeight;
            }
          }
          if (t2.show) {
            var i2 = null;
            if (t2.showTarget) {
              var a2 = t2.showTarget;
              if (t2.showTarget === "window") {
                a2 = "body";
              }
              i2 = ue(r2, a2);
            }
            if (t2.show === "top" && (r2 || i2)) {
              i2 = i2 || r2;
              i2.scrollIntoView({ block: "start", behavior: Q.config.scrollBehavior });
            }
            if (t2.show === "bottom" && (n2 || i2)) {
              i2 = i2 || n2;
              i2.scrollIntoView({ block: "end", behavior: Q.config.scrollBehavior });
            }
          }
        }
        function Rr(e2, t2, r2, n2) {
          if (n2 == null) {
            n2 = {};
          }
          if (e2 == null) {
            return n2;
          }
          var i2 = te(e2, t2);
          if (i2) {
            var a2 = i2.trim();
            var o2 = r2;
            if (a2 === "unset") {
              return null;
            }
            if (a2.indexOf("javascript:") === 0) {
              a2 = a2.substr(11);
              o2 = true;
            } else if (a2.indexOf("js:") === 0) {
              a2 = a2.substr(3);
              o2 = true;
            }
            if (a2.indexOf("{") !== 0) {
              a2 = "{" + a2 + "}";
            }
            var s2;
            if (o2) {
              s2 = Tr(e2, function() {
                return Function("return (" + a2 + ")")();
              }, {});
            } else {
              s2 = E(a2);
            }
            for (var l2 in s2) {
              if (s2.hasOwnProperty(l2)) {
                if (n2[l2] == null) {
                  n2[l2] = s2[l2];
                }
              }
            }
          }
          return Rr(u(e2), t2, r2, n2);
        }
        function Tr(e2, t2, r2) {
          if (Q.config.allowEval) {
            return t2();
          } else {
            fe(e2, "htmx:evalDisallowedError");
            return r2;
          }
        }
        function Or(e2, t2) {
          return Rr(e2, "hx-vars", true, t2);
        }
        function qr(e2, t2) {
          return Rr(e2, "hx-vals", false, t2);
        }
        function Hr(e2) {
          return le(Or(e2), qr(e2));
        }
        function Lr(t2, r2, n2) {
          if (n2 !== null) {
            try {
              t2.setRequestHeader(r2, n2);
            } catch (e2) {
              t2.setRequestHeader(r2, encodeURIComponent(n2));
              t2.setRequestHeader(r2 + "-URI-AutoEncoded", "true");
            }
          }
        }
        function Ar(t2) {
          if (t2.responseURL && typeof URL !== "undefined") {
            try {
              var e2 = new URL(t2.responseURL);
              return e2.pathname + e2.search;
            } catch (e3) {
              fe(re().body, "htmx:badResponseUrl", { url: t2.responseURL });
            }
          }
        }
        function O(e2, t2) {
          return t2.test(e2.getAllResponseHeaders());
        }
        function Nr(e2, t2, r2) {
          e2 = e2.toLowerCase();
          if (r2) {
            if (r2 instanceof Element || I(r2, "String")) {
              return he(e2, t2, null, null, { targetOverride: p(r2), returnPromise: true });
            } else {
              return he(e2, t2, p(r2.source), r2.event, { handler: r2.handler, headers: r2.headers, values: r2.values, targetOverride: p(r2.target), swapOverride: r2.swap, select: r2.select, returnPromise: true });
            }
          } else {
            return he(e2, t2, null, null, { returnPromise: true });
          }
        }
        function Ir(e2) {
          var t2 = [];
          while (e2) {
            t2.push(e2);
            e2 = e2.parentElement;
          }
          return t2;
        }
        function kr(e2, t2, r2) {
          var n2;
          var i2;
          if (typeof URL === "function") {
            i2 = new URL(t2, document.location.href);
            var a2 = document.location.origin;
            n2 = a2 === i2.origin;
          } else {
            i2 = t2;
            n2 = g(t2, document.location.origin);
          }
          if (Q.config.selfRequestsOnly) {
            if (!n2) {
              return false;
            }
          }
          return ce(e2, "htmx:validateUrl", le({ url: i2, sameHost: n2 }, r2));
        }
        function he(t2, r2, n2, i2, a2, e2) {
          var o2 = null;
          var s2 = null;
          a2 = a2 != null ? a2 : {};
          if (a2.returnPromise && typeof Promise !== "undefined") {
            var l2 = new Promise(function(e3, t3) {
              o2 = e3;
              s2 = t3;
            });
          }
          if (n2 == null) {
            n2 = re().body;
          }
          var M2 = a2.handler || Mr;
          var X2 = a2.select || null;
          if (!se(n2)) {
            ie(o2);
            return l2;
          }
          var u2 = a2.targetOverride || ye(n2);
          if (u2 == null || u2 == pe) {
            fe(n2, "htmx:targetError", { target: te(n2, "hx-target") });
            ie(s2);
            return l2;
          }
          var f2 = ae(n2);
          var c2 = f2.lastButtonClicked;
          if (c2) {
            var h2 = ee(c2, "formaction");
            if (h2 != null) {
              r2 = h2;
            }
            var v2 = ee(c2, "formmethod");
            if (v2 != null) {
              if (v2.toLowerCase() !== "dialog") {
                t2 = v2;
              }
            }
          }
          var d2 = ne(n2, "hx-confirm");
          if (e2 === void 0) {
            var D2 = function(e3) {
              return he(t2, r2, n2, i2, a2, !!e3);
            };
            var U2 = { target: u2, elt: n2, path: r2, verb: t2, triggeringEvent: i2, etc: a2, issueRequest: D2, question: d2 };
            if (ce(n2, "htmx:confirm", U2) === false) {
              ie(o2);
              return l2;
            }
          }
          var g3 = n2;
          var p2 = ne(n2, "hx-sync");
          var m2 = null;
          var x2 = false;
          if (p2) {
            var B2 = p2.split(":");
            var F2 = B2[0].trim();
            if (F2 === "this") {
              g3 = xe(n2, "hx-sync");
            } else {
              g3 = ue(n2, F2);
            }
            p2 = (B2[1] || "drop").trim();
            f2 = ae(g3);
            if (p2 === "drop" && f2.xhr && f2.abortable !== true) {
              ie(o2);
              return l2;
            } else if (p2 === "abort") {
              if (f2.xhr) {
                ie(o2);
                return l2;
              } else {
                x2 = true;
              }
            } else if (p2 === "replace") {
              ce(g3, "htmx:abort");
            } else if (p2.indexOf("queue") === 0) {
              var V2 = p2.split(" ");
              m2 = (V2[1] || "last").trim();
            }
          }
          if (f2.xhr) {
            if (f2.abortable) {
              ce(g3, "htmx:abort");
            } else {
              if (m2 == null) {
                if (i2) {
                  var y2 = ae(i2);
                  if (y2 && y2.triggerSpec && y2.triggerSpec.queue) {
                    m2 = y2.triggerSpec.queue;
                  }
                }
                if (m2 == null) {
                  m2 = "last";
                }
              }
              if (f2.queuedRequests == null) {
                f2.queuedRequests = [];
              }
              if (m2 === "first" && f2.queuedRequests.length === 0) {
                f2.queuedRequests.push(function() {
                  he(t2, r2, n2, i2, a2);
                });
              } else if (m2 === "all") {
                f2.queuedRequests.push(function() {
                  he(t2, r2, n2, i2, a2);
                });
              } else if (m2 === "last") {
                f2.queuedRequests = [];
                f2.queuedRequests.push(function() {
                  he(t2, r2, n2, i2, a2);
                });
              }
              ie(o2);
              return l2;
            }
          }
          var b2 = new XMLHttpRequest();
          f2.xhr = b2;
          f2.abortable = x2;
          var w2 = function() {
            f2.xhr = null;
            f2.abortable = false;
            if (f2.queuedRequests != null && f2.queuedRequests.length > 0) {
              var e3 = f2.queuedRequests.shift();
              e3();
            }
          };
          var j2 = ne(n2, "hx-prompt");
          if (j2) {
            var S2 = prompt(j2);
            if (S2 === null || !ce(n2, "htmx:prompt", { prompt: S2, target: u2 })) {
              ie(o2);
              w2();
              return l2;
            }
          }
          if (d2 && !e2) {
            if (!confirm(d2)) {
              ie(o2);
              w2();
              return l2;
            }
          }
          var E2 = xr(n2, u2, S2);
          if (t2 !== "get" && !Sr(n2)) {
            E2["Content-Type"] = "application/x-www-form-urlencoded";
          }
          if (a2.headers) {
            E2 = le(E2, a2.headers);
          }
          var _2 = dr(n2, t2);
          var C2 = _2.errors;
          var R2 = _2.values;
          if (a2.values) {
            R2 = le(R2, a2.values);
          }
          var z2 = Hr(n2);
          var $2 = le(R2, z2);
          var T2 = yr($2, n2);
          if (Q.config.getCacheBusterParam && t2 === "get") {
            T2["org.htmx.cache-buster"] = ee(u2, "id") || "true";
          }
          if (r2 == null || r2 === "") {
            r2 = re().location.href;
          }
          var O2 = Rr(n2, "hx-request");
          var W2 = ae(n2).boosted;
          var q2 = Q.config.methodsThatUseUrlParams.indexOf(t2) >= 0;
          var H2 = { boosted: W2, useUrlParams: q2, parameters: T2, unfilteredParameters: $2, headers: E2, target: u2, verb: t2, errors: C2, withCredentials: a2.credentials || O2.credentials || Q.config.withCredentials, timeout: a2.timeout || O2.timeout || Q.config.timeout, path: r2, triggeringEvent: i2 };
          if (!ce(n2, "htmx:configRequest", H2)) {
            ie(o2);
            w2();
            return l2;
          }
          r2 = H2.path;
          t2 = H2.verb;
          E2 = H2.headers;
          T2 = H2.parameters;
          C2 = H2.errors;
          q2 = H2.useUrlParams;
          if (C2 && C2.length > 0) {
            ce(n2, "htmx:validation:halted", H2);
            ie(o2);
            w2();
            return l2;
          }
          var G2 = r2.split("#");
          var J2 = G2[0];
          var L2 = G2[1];
          var A2 = r2;
          if (q2) {
            A2 = J2;
            var Z2 = Object.keys(T2).length !== 0;
            if (Z2) {
              if (A2.indexOf("?") < 0) {
                A2 += "?";
              } else {
                A2 += "&";
              }
              A2 += pr(T2);
              if (L2) {
                A2 += "#" + L2;
              }
            }
          }
          if (!kr(n2, A2, H2)) {
            fe(n2, "htmx:invalidPath", H2);
            ie(s2);
            return l2;
          }
          b2.open(t2.toUpperCase(), A2, true);
          b2.overrideMimeType("text/html");
          b2.withCredentials = H2.withCredentials;
          b2.timeout = H2.timeout;
          if (O2.noHeaders) {
          } else {
            for (var N2 in E2) {
              if (E2.hasOwnProperty(N2)) {
                var K2 = E2[N2];
                Lr(b2, N2, K2);
              }
            }
          }
          var I2 = { xhr: b2, target: u2, requestConfig: H2, etc: a2, boosted: W2, select: X2, pathInfo: { requestPath: r2, finalRequestPath: A2, anchor: L2 } };
          b2.onload = function() {
            try {
              var e3 = Ir(n2);
              I2.pathInfo.responsePath = Ar(b2);
              M2(n2, I2);
              lr(k2, P2);
              ce(n2, "htmx:afterRequest", I2);
              ce(n2, "htmx:afterOnLoad", I2);
              if (!se(n2)) {
                var t3 = null;
                while (e3.length > 0 && t3 == null) {
                  var r3 = e3.shift();
                  if (se(r3)) {
                    t3 = r3;
                  }
                }
                if (t3) {
                  ce(t3, "htmx:afterRequest", I2);
                  ce(t3, "htmx:afterOnLoad", I2);
                }
              }
              ie(o2);
              w2();
            } catch (e4) {
              fe(n2, "htmx:onLoadError", le({ error: e4 }, I2));
              throw e4;
            }
          };
          b2.onerror = function() {
            lr(k2, P2);
            fe(n2, "htmx:afterRequest", I2);
            fe(n2, "htmx:sendError", I2);
            ie(s2);
            w2();
          };
          b2.onabort = function() {
            lr(k2, P2);
            fe(n2, "htmx:afterRequest", I2);
            fe(n2, "htmx:sendAbort", I2);
            ie(s2);
            w2();
          };
          b2.ontimeout = function() {
            lr(k2, P2);
            fe(n2, "htmx:afterRequest", I2);
            fe(n2, "htmx:timeout", I2);
            ie(s2);
            w2();
          };
          if (!ce(n2, "htmx:beforeRequest", I2)) {
            ie(o2);
            w2();
            return l2;
          }
          var k2 = or(n2);
          var P2 = sr(n2);
          oe(["loadstart", "loadend", "progress", "abort"], function(t3) {
            oe([b2, b2.upload], function(e3) {
              e3.addEventListener(t3, function(e4) {
                ce(n2, "htmx:xhr:" + t3, { lengthComputable: e4.lengthComputable, loaded: e4.loaded, total: e4.total });
              });
            });
          });
          ce(n2, "htmx:beforeSend", I2);
          var Y2 = q2 ? null : Er(b2, n2, T2);
          b2.send(Y2);
          return l2;
        }
        function Pr(e2, t2) {
          var r2 = t2.xhr;
          var n2 = null;
          var i2 = null;
          if (O(r2, /HX-Push:/i)) {
            n2 = r2.getResponseHeader("HX-Push");
            i2 = "push";
          } else if (O(r2, /HX-Push-Url:/i)) {
            n2 = r2.getResponseHeader("HX-Push-Url");
            i2 = "push";
          } else if (O(r2, /HX-Replace-Url:/i)) {
            n2 = r2.getResponseHeader("HX-Replace-Url");
            i2 = "replace";
          }
          if (n2) {
            if (n2 === "false") {
              return {};
            } else {
              return { type: i2, path: n2 };
            }
          }
          var a2 = t2.pathInfo.finalRequestPath;
          var o2 = t2.pathInfo.responsePath;
          var s2 = ne(e2, "hx-push-url");
          var l2 = ne(e2, "hx-replace-url");
          var u2 = ae(e2).boosted;
          var f2 = null;
          var c2 = null;
          if (s2) {
            f2 = "push";
            c2 = s2;
          } else if (l2) {
            f2 = "replace";
            c2 = l2;
          } else if (u2) {
            f2 = "push";
            c2 = o2 || a2;
          }
          if (c2) {
            if (c2 === "false") {
              return {};
            }
            if (c2 === "true") {
              c2 = o2 || a2;
            }
            if (t2.pathInfo.anchor && c2.indexOf("#") === -1) {
              c2 = c2 + "#" + t2.pathInfo.anchor;
            }
            return { type: f2, path: c2 };
          } else {
            return {};
          }
        }
        function Mr(l2, u2) {
          var f2 = u2.xhr;
          var c2 = u2.target;
          var e2 = u2.etc;
          var t2 = u2.requestConfig;
          var h2 = u2.select;
          if (!ce(l2, "htmx:beforeOnLoad", u2)) return;
          if (O(f2, /HX-Trigger:/i)) {
            _e(f2, "HX-Trigger", l2);
          }
          if (O(f2, /HX-Location:/i)) {
            er();
            var r2 = f2.getResponseHeader("HX-Location");
            var v2;
            if (r2.indexOf("{") === 0) {
              v2 = E(r2);
              r2 = v2["path"];
              delete v2["path"];
            }
            Nr("GET", r2, v2).then(function() {
              tr(r2);
            });
            return;
          }
          var n2 = O(f2, /HX-Refresh:/i) && "true" === f2.getResponseHeader("HX-Refresh");
          if (O(f2, /HX-Redirect:/i)) {
            location.href = f2.getResponseHeader("HX-Redirect");
            n2 && location.reload();
            return;
          }
          if (n2) {
            location.reload();
            return;
          }
          if (O(f2, /HX-Retarget:/i)) {
            if (f2.getResponseHeader("HX-Retarget") === "this") {
              u2.target = l2;
            } else {
              u2.target = ue(l2, f2.getResponseHeader("HX-Retarget"));
            }
          }
          var d2 = Pr(l2, u2);
          var i2 = f2.status >= 200 && f2.status < 400 && f2.status !== 204;
          var g3 = f2.response;
          var a2 = f2.status >= 400;
          var p2 = Q.config.ignoreTitle;
          var o2 = le({ shouldSwap: i2, serverResponse: g3, isError: a2, ignoreTitle: p2 }, u2);
          if (!ce(c2, "htmx:beforeSwap", o2)) return;
          c2 = o2.target;
          g3 = o2.serverResponse;
          a2 = o2.isError;
          p2 = o2.ignoreTitle;
          u2.target = c2;
          u2.failed = a2;
          u2.successful = !a2;
          if (o2.shouldSwap) {
            if (f2.status === 286) {
              at(l2);
            }
            R(l2, function(e3) {
              g3 = e3.transformResponse(g3, f2, l2);
            });
            if (d2.type) {
              er();
            }
            var s2 = e2.swapOverride;
            if (O(f2, /HX-Reswap:/i)) {
              s2 = f2.getResponseHeader("HX-Reswap");
            }
            var v2 = wr(l2, s2);
            if (v2.hasOwnProperty("ignoreTitle")) {
              p2 = v2.ignoreTitle;
            }
            c2.classList.add(Q.config.swappingClass);
            var m2 = null;
            var x2 = null;
            var y2 = function() {
              try {
                var e3 = document.activeElement;
                var t3 = {};
                try {
                  t3 = { elt: e3, start: e3 ? e3.selectionStart : null, end: e3 ? e3.selectionEnd : null };
                } catch (e4) {
                }
                var r3;
                if (h2) {
                  r3 = h2;
                }
                if (O(f2, /HX-Reselect:/i)) {
                  r3 = f2.getResponseHeader("HX-Reselect");
                }
                if (d2.type) {
                  ce(re().body, "htmx:beforeHistoryUpdate", le({ history: d2 }, u2));
                  if (d2.type === "push") {
                    tr(d2.path);
                    ce(re().body, "htmx:pushedIntoHistory", { path: d2.path });
                  } else {
                    rr(d2.path);
                    ce(re().body, "htmx:replacedInHistory", { path: d2.path });
                  }
                }
                var n3 = T(c2);
                je(v2.swapStyle, c2, l2, g3, n3, r3);
                if (t3.elt && !se(t3.elt) && ee(t3.elt, "id")) {
                  var i3 = document.getElementById(ee(t3.elt, "id"));
                  var a3 = { preventScroll: v2.focusScroll !== void 0 ? !v2.focusScroll : !Q.config.defaultFocusScroll };
                  if (i3) {
                    if (t3.start && i3.setSelectionRange) {
                      try {
                        i3.setSelectionRange(t3.start, t3.end);
                      } catch (e4) {
                      }
                    }
                    i3.focus(a3);
                  }
                }
                c2.classList.remove(Q.config.swappingClass);
                oe(n3.elts, function(e4) {
                  if (e4.classList) {
                    e4.classList.add(Q.config.settlingClass);
                  }
                  ce(e4, "htmx:afterSwap", u2);
                });
                if (O(f2, /HX-Trigger-After-Swap:/i)) {
                  var o3 = l2;
                  if (!se(l2)) {
                    o3 = re().body;
                  }
                  _e(f2, "HX-Trigger-After-Swap", o3);
                }
                var s3 = function() {
                  oe(n3.tasks, function(e5) {
                    e5.call();
                  });
                  oe(n3.elts, function(e5) {
                    if (e5.classList) {
                      e5.classList.remove(Q.config.settlingClass);
                    }
                    ce(e5, "htmx:afterSettle", u2);
                  });
                  if (u2.pathInfo.anchor) {
                    var e4 = re().getElementById(u2.pathInfo.anchor);
                    if (e4) {
                      e4.scrollIntoView({ block: "start", behavior: "auto" });
                    }
                  }
                  if (n3.title && !p2) {
                    var t4 = C("title");
                    if (t4) {
                      t4.innerHTML = n3.title;
                    } else {
                      window.document.title = n3.title;
                    }
                  }
                  Cr(n3.elts, v2);
                  if (O(f2, /HX-Trigger-After-Settle:/i)) {
                    var r4 = l2;
                    if (!se(l2)) {
                      r4 = re().body;
                    }
                    _e(f2, "HX-Trigger-After-Settle", r4);
                  }
                  ie(m2);
                };
                if (v2.settleDelay > 0) {
                  setTimeout(s3, v2.settleDelay);
                } else {
                  s3();
                }
              } catch (e4) {
                fe(l2, "htmx:swapError", u2);
                ie(x2);
                throw e4;
              }
            };
            var b2 = Q.config.globalViewTransitions;
            if (v2.hasOwnProperty("transition")) {
              b2 = v2.transition;
            }
            if (b2 && ce(l2, "htmx:beforeTransition", u2) && typeof Promise !== "undefined" && document.startViewTransition) {
              var w2 = new Promise(function(e3, t3) {
                m2 = e3;
                x2 = t3;
              });
              var S2 = y2;
              y2 = function() {
                document.startViewTransition(function() {
                  S2();
                  return w2;
                });
              };
            }
            if (v2.swapDelay > 0) {
              setTimeout(y2, v2.swapDelay);
            } else {
              y2();
            }
          }
          if (a2) {
            fe(l2, "htmx:responseError", le({ error: "Response Status Error Code " + f2.status + " from " + u2.pathInfo.requestPath }, u2));
          }
        }
        var Xr = {};
        function Dr() {
          return { init: function(e2) {
            return null;
          }, onEvent: function(e2, t2) {
            return true;
          }, transformResponse: function(e2, t2, r2) {
            return e2;
          }, isInlineSwap: function(e2) {
            return false;
          }, handleSwap: function(e2, t2, r2, n2) {
            return false;
          }, encodeParameters: function(e2, t2, r2) {
            return null;
          } };
        }
        function Ur(e2, t2) {
          if (t2.init) {
            t2.init(r);
          }
          Xr[e2] = le(Dr(), t2);
        }
        function Br(e2) {
          delete Xr[e2];
        }
        function Fr(e2, r2, n2) {
          if (e2 == void 0) {
            return r2;
          }
          if (r2 == void 0) {
            r2 = [];
          }
          if (n2 == void 0) {
            n2 = [];
          }
          var t2 = te(e2, "hx-ext");
          if (t2) {
            oe(t2.split(","), function(e3) {
              e3 = e3.replace(/ /g, "");
              if (e3.slice(0, 7) == "ignore:") {
                n2.push(e3.slice(7));
                return;
              }
              if (n2.indexOf(e3) < 0) {
                var t3 = Xr[e3];
                if (t3 && r2.indexOf(t3) < 0) {
                  r2.push(t3);
                }
              }
            });
          }
          return Fr(u(e2), r2, n2);
        }
        var Vr = false;
        re().addEventListener("DOMContentLoaded", function() {
          Vr = true;
        });
        function jr(e2) {
          if (Vr || re().readyState === "complete") {
            e2();
          } else {
            re().addEventListener("DOMContentLoaded", e2);
          }
        }
        function _r() {
          if (Q.config.includeIndicatorStyles !== false) {
            re().head.insertAdjacentHTML("beforeend", "<style>                      ." + Q.config.indicatorClass + "{opacity:0}                      ." + Q.config.requestClass + " ." + Q.config.indicatorClass + "{opacity:1; transition: opacity 200ms ease-in;}                      ." + Q.config.requestClass + "." + Q.config.indicatorClass + "{opacity:1; transition: opacity 200ms ease-in;}                    </style>");
          }
        }
        function zr() {
          var e2 = re().querySelector('meta[name="htmx-config"]');
          if (e2) {
            return E(e2.content);
          } else {
            return null;
          }
        }
        function $r() {
          var e2 = zr();
          if (e2) {
            Q.config = le(Q.config, e2);
          }
        }
        jr(function() {
          $r();
          _r();
          var e2 = re().body;
          zt(e2);
          var t2 = re().querySelectorAll("[hx-trigger='restored'],[data-hx-trigger='restored']");
          e2.addEventListener("htmx:abort", function(e3) {
            var t3 = e3.target;
            var r3 = ae(t3);
            if (r3 && r3.xhr) {
              r3.xhr.abort();
            }
          });
          const r2 = window.onpopstate ? window.onpopstate.bind(window) : null;
          window.onpopstate = function(e3) {
            if (e3.state && e3.state.htmx) {
              ar();
              oe(t2, function(e4) {
                ce(e4, "htmx:restored", { document: re(), triggerEvent: ce });
              });
            } else {
              if (r2) {
                r2(e3);
              }
            }
          };
          setTimeout(function() {
            ce(e2, "htmx:load", {});
            e2 = null;
          }, 0);
        });
        return Q;
      }();
    });
  }
});

// node_modules/.deno/hyperscript.org@0.9.14/node_modules/hyperscript.org/dist/_hyperscript.min.js
var require_hyperscript_min = __commonJS({
  "node_modules/.deno/hyperscript.org@0.9.14/node_modules/hyperscript.org/dist/_hyperscript.min.js"(exports2, module2) {
    (function(e2, t2) {
      const r2 = t2(e2);
      if (typeof exports2 === "object" && typeof exports2["nodeName"] !== "string") {
        module2.exports = r2;
      } else {
        e2["_hyperscript"] = r2;
        if ("document" in e2) e2["_hyperscript"].browserInit();
      }
    })(typeof self !== "undefined" ? self : exports2, (e2) => {
      "use strict";
      const t2 = { dynamicResolvers: [function(e3, t3) {
        if (e3 === "Fixed") {
          return Number(t3).toFixed();
        } else if (e3.indexOf("Fixed:") === 0) {
          let r3 = e3.split(":")[1];
          return Number(t3).toFixed(parseInt(r3));
        }
      }], String: function(e3) {
        if (e3.toString) {
          return e3.toString();
        } else {
          return "" + e3;
        }
      }, Int: function(e3) {
        return parseInt(e3);
      }, Float: function(e3) {
        return parseFloat(e3);
      }, Number: function(e3) {
        return Number(e3);
      }, Date: function(e3) {
        return new Date(e3);
      }, Array: function(e3) {
        return Array.from(e3);
      }, JSON: function(e3) {
        return JSON.stringify(e3);
      }, Object: function(e3) {
        if (e3 instanceof String) {
          e3 = e3.toString();
        }
        if (typeof e3 === "string") {
          return JSON.parse(e3);
        } else {
          return Object.assign({}, e3);
        }
      } };
      const r2 = { attributes: "_, script, data-script", defaultTransition: "all 500ms ease-in", disableSelector: "[disable-scripting], [data-disable-scripting]", hideShowStrategies: {}, conversions: t2 };
      class n2 {
        static OP_TABLE = { "+": "PLUS", "-": "MINUS", "*": "MULTIPLY", "/": "DIVIDE", ".": "PERIOD", "..": "ELLIPSIS", "\\": "BACKSLASH", ":": "COLON", "%": "PERCENT", "|": "PIPE", "!": "EXCLAMATION", "?": "QUESTION", "#": "POUND", "&": "AMPERSAND", $: "DOLLAR", ";": "SEMI", ",": "COMMA", "(": "L_PAREN", ")": "R_PAREN", "<": "L_ANG", ">": "R_ANG", "<=": "LTE_ANG", ">=": "GTE_ANG", "==": "EQ", "===": "EQQ", "!=": "NEQ", "!==": "NEQQ", "{": "L_BRACE", "}": "R_BRACE", "[": "L_BRACKET", "]": "R_BRACKET", "=": "EQUALS", "~": "TILDE" };
        static isValidCSSClassChar(e3) {
          return n2.isAlpha(e3) || n2.isNumeric(e3) || e3 === "-" || e3 === "_" || e3 === ":";
        }
        static isValidCSSIDChar(e3) {
          return n2.isAlpha(e3) || n2.isNumeric(e3) || e3 === "-" || e3 === "_" || e3 === ":";
        }
        static isWhitespace(e3) {
          return e3 === " " || e3 === "	" || n2.isNewline(e3);
        }
        static positionString(e3) {
          return "[Line: " + e3.line + ", Column: " + e3.column + "]";
        }
        static isNewline(e3) {
          return e3 === "\r" || e3 === "\n";
        }
        static isNumeric(e3) {
          return e3 >= "0" && e3 <= "9";
        }
        static isAlpha(e3) {
          return e3 >= "a" && e3 <= "z" || e3 >= "A" && e3 <= "Z";
        }
        static isIdentifierChar(e3, t3) {
          return e3 === "_" || e3 === "$";
        }
        static isReservedChar(e3) {
          return e3 === "`" || e3 === "^";
        }
        static isValidSingleQuoteStringStart(e3) {
          if (e3.length > 0) {
            var t3 = e3[e3.length - 1];
            if (t3.type === "IDENTIFIER" || t3.type === "CLASS_REF" || t3.type === "ID_REF") {
              return false;
            }
            if (t3.op && (t3.value === ">" || t3.value === ")")) {
              return false;
            }
          }
          return true;
        }
        static tokenize(e3, t3) {
          var r3 = [];
          var a3 = e3;
          var o3 = 0;
          var s3 = 0;
          var u3 = 1;
          var l3 = "<START>";
          var c3 = 0;
          function f3() {
            return t3 && c3 === 0;
          }
          while (o3 < a3.length) {
            if (q2() === "-" && I2() === "-" && (n2.isWhitespace(C2(2)) || C2(2) === "" || C2(2) === "-") || q2() === "/" && I2() === "/" && (n2.isWhitespace(C2(2)) || C2(2) === "" || C2(2) === "/")) {
              h3();
            } else if (q2() === "/" && I2() === "*" && (n2.isWhitespace(C2(2)) || C2(2) === "" || C2(2) === "*")) {
              v3();
            } else {
              if (n2.isWhitespace(q2())) {
                r3.push(L2());
              } else if (!A2() && q2() === "." && (n2.isAlpha(I2()) || I2() === "{" || I2() === "-")) {
                r3.push(d3());
              } else if (!A2() && q2() === "#" && (n2.isAlpha(I2()) || I2() === "{")) {
                r3.push(k3());
              } else if (q2() === "[" && I2() === "@") {
                r3.push(E3());
              } else if (q2() === "@") {
                r3.push(T3());
              } else if (q2() === "*" && n2.isAlpha(I2())) {
                r3.push(y3());
              } else if (f3() && (n2.isAlpha(q2()) || q2() === "\\")) {
                r3.push(x3());
              } else if (!f3() && (n2.isAlpha(q2()) || n2.isIdentifierChar(q2()))) {
                r3.push(g4());
              } else if (n2.isNumeric(q2())) {
                r3.push(b3());
              } else if (!f3() && (q2() === '"' || q2() === "`")) {
                r3.push(S3());
              } else if (!f3() && q2() === "'") {
                if (n2.isValidSingleQuoteStringStart(r3)) {
                  r3.push(S3());
                } else {
                  r3.push(w3());
                }
              } else if (n2.OP_TABLE[q2()]) {
                if (l3 === "$" && q2() === "{") {
                  c3++;
                }
                if (q2() === "}") {
                  c3--;
                }
                r3.push(w3());
              } else if (f3() || n2.isReservedChar(q2())) {
                r3.push(p3("RESERVED", R2()));
              } else {
                if (o3 < a3.length) {
                  throw Error("Unknown token: " + q2() + " ");
                }
              }
            }
          }
          return new i2(r3, [], a3);
          function m3(e4, t4) {
            var r4 = p3(e4, t4);
            r4.op = true;
            return r4;
          }
          function p3(e4, t4) {
            return { type: e4, value: t4 || "", start: o3, end: o3 + 1, column: s3, line: u3 };
          }
          function h3() {
            while (q2() && !n2.isNewline(q2())) {
              R2();
            }
            R2();
          }
          function v3() {
            while (q2() && !(q2() === "*" && I2() === "/")) {
              R2();
            }
            R2();
            R2();
          }
          function d3() {
            var e4 = p3("CLASS_REF");
            var t4 = R2();
            if (q2() === "{") {
              e4.template = true;
              t4 += R2();
              while (q2() && q2() !== "}") {
                t4 += R2();
              }
              if (q2() !== "}") {
                throw Error("Unterminated class reference");
              } else {
                t4 += R2();
              }
            } else {
              while (n2.isValidCSSClassChar(q2()) || q2() === "\\") {
                if (q2() === "\\") {
                  R2();
                }
                t4 += R2();
              }
            }
            e4.value = t4;
            e4.end = o3;
            return e4;
          }
          function E3() {
            var e4 = p3("ATTRIBUTE_REF");
            var t4 = R2();
            while (o3 < a3.length && q2() !== "]") {
              t4 += R2();
            }
            if (q2() === "]") {
              t4 += R2();
            }
            e4.value = t4;
            e4.end = o3;
            return e4;
          }
          function T3() {
            var e4 = p3("ATTRIBUTE_REF");
            var t4 = R2();
            while (n2.isValidCSSIDChar(q2())) {
              t4 += R2();
            }
            if (q2() === "=") {
              t4 += R2();
              if (q2() === '"' || q2() === "'") {
                let e5 = S3();
                t4 += e5.value;
              } else if (n2.isAlpha(q2()) || n2.isNumeric(q2()) || n2.isIdentifierChar(q2())) {
                let e5 = g4();
                t4 += e5.value;
              }
            }
            e4.value = t4;
            e4.end = o3;
            return e4;
          }
          function y3() {
            var e4 = p3("STYLE_REF");
            var t4 = R2();
            while (n2.isAlpha(q2()) || q2() === "-") {
              t4 += R2();
            }
            e4.value = t4;
            e4.end = o3;
            return e4;
          }
          function k3() {
            var e4 = p3("ID_REF");
            var t4 = R2();
            if (q2() === "{") {
              e4.template = true;
              t4 += R2();
              while (q2() && q2() !== "}") {
                t4 += R2();
              }
              if (q2() !== "}") {
                throw Error("Unterminated id reference");
              } else {
                R2();
              }
            } else {
              while (n2.isValidCSSIDChar(q2())) {
                t4 += R2();
              }
            }
            e4.value = t4;
            e4.end = o3;
            return e4;
          }
          function x3() {
            var e4 = p3("IDENTIFIER");
            var t4 = R2();
            var r4 = t4 === "\\";
            if (r4) {
              t4 = "";
            }
            while (n2.isAlpha(q2()) || n2.isNumeric(q2()) || n2.isIdentifierChar(q2()) || q2() === "\\" || q2() === "{" || q2() === "}") {
              if (q2() === "$" && r4 === false) {
                break;
              } else if (q2() === "\\") {
                r4 = true;
                R2();
              } else {
                r4 = false;
                t4 += R2();
              }
            }
            if (q2() === "!" && t4 === "beep") {
              t4 += R2();
            }
            e4.value = t4;
            e4.end = o3;
            return e4;
          }
          function g4() {
            var e4 = p3("IDENTIFIER");
            var t4 = R2();
            while (n2.isAlpha(q2()) || n2.isNumeric(q2()) || n2.isIdentifierChar(q2())) {
              t4 += R2();
            }
            if (q2() === "!" && t4 === "beep") {
              t4 += R2();
            }
            e4.value = t4;
            e4.end = o3;
            return e4;
          }
          function b3() {
            var e4 = p3("NUMBER");
            var t4 = R2();
            while (n2.isNumeric(q2())) {
              t4 += R2();
            }
            if (q2() === "." && n2.isNumeric(I2())) {
              t4 += R2();
            }
            while (n2.isNumeric(q2())) {
              t4 += R2();
            }
            if (q2() === "e" || q2() === "E") {
              if (n2.isNumeric(I2())) {
                t4 += R2();
              } else if (I2() === "-") {
                t4 += R2();
                t4 += R2();
              }
            }
            while (n2.isNumeric(q2())) {
              t4 += R2();
            }
            e4.value = t4;
            e4.end = o3;
            return e4;
          }
          function w3() {
            var e4 = m3();
            var t4 = R2();
            while (q2() && n2.OP_TABLE[t4 + q2()]) {
              t4 += R2();
            }
            e4.type = n2.OP_TABLE[t4];
            e4.value = t4;
            e4.end = o3;
            return e4;
          }
          function S3() {
            var e4 = p3("STRING");
            var t4 = R2();
            e4.template = t4 === "`";
            var r4 = "";
            while (q2() && q2() !== t4) {
              if (q2() === "\\") {
                R2();
                let t5 = R2();
                if (t5 === "b") {
                  r4 += "\b";
                } else if (t5 === "f") {
                  r4 += "\f";
                } else if (t5 === "n") {
                  r4 += "\n";
                } else if (t5 === "r") {
                  r4 += "\r";
                } else if (t5 === "t") {
                  r4 += "	";
                } else if (t5 === "v") {
                  r4 += "\v";
                } else if (e4.template && t5 === "$") {
                  r4 += "\\$";
                } else if (t5 === "x") {
                  const t6 = N2();
                  if (Number.isNaN(t6)) {
                    throw Error("Invalid hexadecimal escape at " + n2.positionString(e4));
                  }
                  r4 += String.fromCharCode(t6);
                } else {
                  r4 += t5;
                }
              } else {
                r4 += R2();
              }
            }
            if (q2() !== t4) {
              throw Error("Unterminated string at " + n2.positionString(e4));
            } else {
              R2();
            }
            e4.value = r4;
            e4.end = o3;
            return e4;
          }
          function N2() {
            const e4 = 16;
            if (!q2()) {
              return NaN;
            }
            let t4 = e4 * Number.parseInt(R2(), e4);
            if (!q2()) {
              return NaN;
            }
            t4 += Number.parseInt(R2(), e4);
            return t4;
          }
          function q2() {
            return a3.charAt(o3);
          }
          function I2() {
            return a3.charAt(o3 + 1);
          }
          function C2(e4 = 1) {
            return a3.charAt(o3 + e4);
          }
          function R2() {
            l3 = q2();
            o3++;
            s3++;
            return l3;
          }
          function A2() {
            return n2.isAlpha(l3) || n2.isNumeric(l3) || l3 === ")" || l3 === '"' || l3 === "'" || l3 === "`" || l3 === "}" || l3 === "]";
          }
          function L2() {
            var e4 = p3("WHITESPACE");
            var t4 = "";
            while (q2() && n2.isWhitespace(q2())) {
              if (n2.isNewline(q2())) {
                s3 = 0;
                u3++;
              }
              t4 += R2();
            }
            e4.value = t4;
            e4.end = o3;
            return e4;
          }
        }
        tokenize(e3, t3) {
          return n2.tokenize(e3, t3);
        }
      }
      class i2 {
        constructor(e3, t3, r3) {
          this.tokens = e3;
          this.consumed = t3;
          this.source = r3;
          this.consumeWhitespace();
        }
        get list() {
          return this.tokens;
        }
        _lastConsumed = null;
        consumeWhitespace() {
          while (this.token(0, true).type === "WHITESPACE") {
            this.consumed.push(this.tokens.shift());
          }
        }
        raiseError(e3, t3) {
          a2.raiseParseError(e3, t3);
        }
        requireOpToken(e3) {
          var t3 = this.matchOpToken(e3);
          if (t3) {
            return t3;
          } else {
            this.raiseError(this, "Expected '" + e3 + "' but found '" + this.currentToken().value + "'");
          }
        }
        matchAnyOpToken(e3, t3, r3) {
          for (var n3 = 0; n3 < arguments.length; n3++) {
            var i3 = arguments[n3];
            var a3 = this.matchOpToken(i3);
            if (a3) {
              return a3;
            }
          }
        }
        matchAnyToken(e3, t3, r3) {
          for (var n3 = 0; n3 < arguments.length; n3++) {
            var i3 = arguments[n3];
            var a3 = this.matchToken(i3);
            if (a3) {
              return a3;
            }
          }
        }
        matchOpToken(e3) {
          if (this.currentToken() && this.currentToken().op && this.currentToken().value === e3) {
            return this.consumeToken();
          }
        }
        requireTokenType(e3, t3, r3, n3) {
          var i3 = this.matchTokenType(e3, t3, r3, n3);
          if (i3) {
            return i3;
          } else {
            this.raiseError(this, "Expected one of " + JSON.stringify([e3, t3, r3]));
          }
        }
        matchTokenType(e3, t3, r3, n3) {
          if (this.currentToken() && this.currentToken().type && [e3, t3, r3, n3].indexOf(this.currentToken().type) >= 0) {
            return this.consumeToken();
          }
        }
        requireToken(e3, t3) {
          var r3 = this.matchToken(e3, t3);
          if (r3) {
            return r3;
          } else {
            this.raiseError(this, "Expected '" + e3 + "' but found '" + this.currentToken().value + "'");
          }
        }
        peekToken(e3, t3, r3) {
          t3 = t3 || 0;
          r3 = r3 || "IDENTIFIER";
          if (this.tokens[t3] && this.tokens[t3].value === e3 && this.tokens[t3].type === r3) {
            return this.tokens[t3];
          }
        }
        matchToken(e3, t3) {
          if (this.follows.indexOf(e3) !== -1) {
            return;
          }
          t3 = t3 || "IDENTIFIER";
          if (this.currentToken() && this.currentToken().value === e3 && this.currentToken().type === t3) {
            return this.consumeToken();
          }
        }
        consumeToken() {
          var e3 = this.tokens.shift();
          this.consumed.push(e3);
          this._lastConsumed = e3;
          this.consumeWhitespace();
          return e3;
        }
        consumeUntil(e3, t3) {
          var r3 = [];
          var n3 = this.token(0, true);
          while ((t3 == null || n3.type !== t3) && (e3 == null || n3.value !== e3) && n3.type !== "EOF") {
            var i3 = this.tokens.shift();
            this.consumed.push(i3);
            r3.push(n3);
            n3 = this.token(0, true);
          }
          this.consumeWhitespace();
          return r3;
        }
        lastWhitespace() {
          if (this.consumed[this.consumed.length - 1] && this.consumed[this.consumed.length - 1].type === "WHITESPACE") {
            return this.consumed[this.consumed.length - 1].value;
          } else {
            return "";
          }
        }
        consumeUntilWhitespace() {
          return this.consumeUntil(null, "WHITESPACE");
        }
        hasMore() {
          return this.tokens.length > 0;
        }
        token(e3, t3) {
          var r3;
          var n3 = 0;
          do {
            if (!t3) {
              while (this.tokens[n3] && this.tokens[n3].type === "WHITESPACE") {
                n3++;
              }
            }
            r3 = this.tokens[n3];
            e3--;
            n3++;
          } while (e3 > -1);
          if (r3) {
            return r3;
          } else {
            return { type: "EOF", value: "<<<EOF>>>" };
          }
        }
        currentToken() {
          return this.token(0);
        }
        lastMatch() {
          return this._lastConsumed;
        }
        static sourceFor = function() {
          return this.programSource.substring(this.startToken.start, this.endToken.end);
        };
        static lineFor = function() {
          return this.programSource.split("\n")[this.startToken.line - 1];
        };
        follows = [];
        pushFollow(e3) {
          this.follows.push(e3);
        }
        popFollow() {
          this.follows.pop();
        }
        clearFollows() {
          var e3 = this.follows;
          this.follows = [];
          return e3;
        }
        restoreFollows(e3) {
          this.follows = e3;
        }
      }
      class a2 {
        constructor(e3) {
          this.runtime = e3;
          this.possessivesDisabled = false;
          this.addGrammarElement("feature", function(e4, t3, r3) {
            if (r3.matchOpToken("(")) {
              var n3 = e4.requireElement("feature", r3);
              r3.requireOpToken(")");
              return n3;
            }
            var i3 = e4.FEATURES[r3.currentToken().value || ""];
            if (i3) {
              return i3(e4, t3, r3);
            }
          });
          this.addGrammarElement("command", function(e4, t3, r3) {
            if (r3.matchOpToken("(")) {
              const t4 = e4.requireElement("command", r3);
              r3.requireOpToken(")");
              return t4;
            }
            var n3 = e4.COMMANDS[r3.currentToken().value || ""];
            let i3;
            if (n3) {
              i3 = n3(e4, t3, r3);
            } else if (r3.currentToken().type === "IDENTIFIER") {
              i3 = e4.parseElement("pseudoCommand", r3);
            }
            if (i3) {
              return e4.parseElement("indirectStatement", r3, i3);
            }
            return i3;
          });
          this.addGrammarElement("commandList", function(e4, t3, r3) {
            if (r3.hasMore()) {
              var n3 = e4.parseElement("command", r3);
              if (n3) {
                r3.matchToken("then");
                const t4 = e4.parseElement("commandList", r3);
                if (t4) n3.next = t4;
                return n3;
              }
            }
            return { type: "emptyCommandListCommand", op: function(e5) {
              return t3.findNext(this, e5);
            }, execute: function(e5) {
              return t3.unifiedExec(this, e5);
            } };
          });
          this.addGrammarElement("leaf", function(e4, t3, r3) {
            var n3 = e4.parseAnyOf(e4.LEAF_EXPRESSIONS, r3);
            if (n3 == null) {
              return e4.parseElement("symbol", r3);
            }
            return n3;
          });
          this.addGrammarElement("indirectExpression", function(e4, t3, r3, n3) {
            for (var i3 = 0; i3 < e4.INDIRECT_EXPRESSIONS.length; i3++) {
              var a3 = e4.INDIRECT_EXPRESSIONS[i3];
              n3.endToken = r3.lastMatch();
              var o3 = e4.parseElement(a3, r3, n3);
              if (o3) {
                return o3;
              }
            }
            return n3;
          });
          this.addGrammarElement("indirectStatement", function(e4, t3, r3, n3) {
            if (r3.matchToken("unless")) {
              n3.endToken = r3.lastMatch();
              var i3 = e4.requireElement("expression", r3);
              var a3 = { type: "unlessStatementModifier", args: [i3], op: function(e5, t4) {
                if (t4) {
                  return this.next;
                } else {
                  return n3;
                }
              }, execute: function(e5) {
                return t3.unifiedExec(this, e5);
              } };
              n3.parent = a3;
              return a3;
            }
            return n3;
          });
          this.addGrammarElement("primaryExpression", function(e4, t3, r3) {
            var n3 = e4.parseElement("leaf", r3);
            if (n3) {
              return e4.parseElement("indirectExpression", r3, n3);
            }
            e4.raiseParseError(r3, "Unexpected value: " + r3.currentToken().value);
          });
        }
        use(e3) {
          e3(this);
          return this;
        }
        GRAMMAR = {};
        COMMANDS = {};
        FEATURES = {};
        LEAF_EXPRESSIONS = [];
        INDIRECT_EXPRESSIONS = [];
        initElt(e3, t3, r3) {
          e3.startToken = t3;
          e3.sourceFor = i2.sourceFor;
          e3.lineFor = i2.lineFor;
          e3.programSource = r3.source;
        }
        parseElement(e3, t3, r3 = void 0) {
          var n3 = this.GRAMMAR[e3];
          if (n3) {
            var i3 = t3.currentToken();
            var a3 = n3(this, this.runtime, t3, r3);
            if (a3) {
              this.initElt(a3, i3, t3);
              a3.endToken = a3.endToken || t3.lastMatch();
              var r3 = a3.root;
              while (r3 != null) {
                this.initElt(r3, i3, t3);
                r3 = r3.root;
              }
            }
            return a3;
          }
        }
        requireElement(e3, t3, r3, n3) {
          var i3 = this.parseElement(e3, t3, n3);
          if (!i3) a2.raiseParseError(t3, r3 || "Expected " + e3);
          return i3;
        }
        parseAnyOf(e3, t3) {
          for (var r3 = 0; r3 < e3.length; r3++) {
            var n3 = e3[r3];
            var i3 = this.parseElement(n3, t3);
            if (i3) {
              return i3;
            }
          }
        }
        addGrammarElement(e3, t3) {
          this.GRAMMAR[e3] = t3;
        }
        addCommand(e3, t3) {
          var r3 = e3 + "Command";
          var n3 = function(e4, n4, i3) {
            const a3 = t3(e4, n4, i3);
            if (a3) {
              a3.type = r3;
              a3.execute = function(e5) {
                e5.meta.command = a3;
                return n4.unifiedExec(this, e5);
              };
              return a3;
            }
          };
          this.GRAMMAR[r3] = n3;
          this.COMMANDS[e3] = n3;
        }
        addFeature(e3, t3) {
          var r3 = e3 + "Feature";
          var n3 = function(n4, i3, a3) {
            var o3 = t3(n4, i3, a3);
            if (o3) {
              o3.isFeature = true;
              o3.keyword = e3;
              o3.type = r3;
              return o3;
            }
          };
          this.GRAMMAR[r3] = n3;
          this.FEATURES[e3] = n3;
        }
        addLeafExpression(e3, t3) {
          this.LEAF_EXPRESSIONS.push(e3);
          this.addGrammarElement(e3, t3);
        }
        addIndirectExpression(e3, t3) {
          this.INDIRECT_EXPRESSIONS.push(e3);
          this.addGrammarElement(e3, t3);
        }
        static createParserContext(e3) {
          var t3 = e3.currentToken();
          var r3 = e3.source;
          var n3 = r3.split("\n");
          var i3 = t3 && t3.line ? t3.line - 1 : n3.length - 1;
          var a3 = n3[i3];
          var o3 = t3 && t3.line ? t3.column : a3.length - 1;
          return a3 + "\n" + " ".repeat(o3) + "^^\n\n";
        }
        static raiseParseError(e3, t3) {
          t3 = (t3 || "Unexpected Token : " + e3.currentToken().value) + "\n\n" + a2.createParserContext(e3);
          var r3 = new Error(t3);
          r3["tokens"] = e3;
          throw r3;
        }
        raiseParseError(e3, t3) {
          a2.raiseParseError(e3, t3);
        }
        parseHyperScript(e3) {
          var t3 = this.parseElement("hyperscript", e3);
          if (e3.hasMore()) this.raiseParseError(e3);
          if (t3) return t3;
        }
        setParent(e3, t3) {
          if (typeof e3 === "object") {
            e3.parent = t3;
            if (typeof t3 === "object") {
              t3.children = t3.children || /* @__PURE__ */ new Set();
              t3.children.add(e3);
            }
            this.setParent(e3.next, t3);
          }
        }
        commandStart(e3) {
          return this.COMMANDS[e3.value || ""];
        }
        featureStart(e3) {
          return this.FEATURES[e3.value || ""];
        }
        commandBoundary(e3) {
          if (e3.value == "end" || e3.value == "then" || e3.value == "else" || e3.value == "otherwise" || e3.value == ")" || this.commandStart(e3) || this.featureStart(e3) || e3.type == "EOF") {
            return true;
          }
          return false;
        }
        parseStringTemplate(e3) {
          var t3 = [""];
          do {
            t3.push(e3.lastWhitespace());
            if (e3.currentToken().value === "$") {
              e3.consumeToken();
              var r3 = e3.matchOpToken("{");
              t3.push(this.requireElement("expression", e3));
              if (r3) {
                e3.requireOpToken("}");
              }
              t3.push("");
            } else if (e3.currentToken().value === "\\") {
              e3.consumeToken();
              e3.consumeToken();
            } else {
              var n3 = e3.consumeToken();
              t3[t3.length - 1] += n3 ? n3.value : "";
            }
          } while (e3.hasMore());
          t3.push(e3.lastWhitespace());
          return t3;
        }
        ensureTerminated(e3) {
          const t3 = this.runtime;
          var r3 = { type: "implicitReturn", op: function(e4) {
            e4.meta.returned = true;
            if (e4.meta.resolve) {
              e4.meta.resolve();
            }
            return t3.HALT;
          }, execute: function(e4) {
          } };
          var n3 = e3;
          while (n3.next) {
            n3 = n3.next;
          }
          n3.next = r3;
        }
      }
      class o2 {
        constructor(e3, t3) {
          this.lexer = e3 ?? new n2();
          this.parser = t3 ?? new a2(this).use(T2).use(y2);
          this.parser.runtime = this;
        }
        matchesSelector(e3, t3) {
          var r3 = e3.matches || e3.matchesSelector || e3.msMatchesSelector || e3.mozMatchesSelector || e3.webkitMatchesSelector || e3.oMatchesSelector;
          return r3 && r3.call(e3, t3);
        }
        makeEvent(t3, r3) {
          var n3;
          if (e2.Event && typeof e2.Event === "function") {
            n3 = new Event(t3, { bubbles: true, cancelable: true, composed: true });
            n3["detail"] = r3;
          } else {
            n3 = document.createEvent("CustomEvent");
            n3.initCustomEvent(t3, true, true, r3);
          }
          return n3;
        }
        triggerEvent(e3, t3, r3, n3) {
          r3 = r3 || {};
          r3["sender"] = n3;
          var i3 = this.makeEvent(t3, r3);
          var a3 = e3.dispatchEvent(i3);
          return a3;
        }
        isArrayLike(e3) {
          return Array.isArray(e3) || typeof NodeList !== "undefined" && (e3 instanceof NodeList || e3 instanceof HTMLCollection || e3 instanceof FileList);
        }
        isIterable(e3) {
          return typeof e3 === "object" && Symbol.iterator in e3 && typeof e3[Symbol.iterator] === "function";
        }
        shouldAutoIterate(e3) {
          return e3 != null && e3[p2] || this.isArrayLike(e3);
        }
        forEach(e3, t3) {
          if (e3 == null) {
          } else if (this.isIterable(e3)) {
            for (const r4 of e3) {
              t3(r4);
            }
          } else if (this.isArrayLike(e3)) {
            for (var r3 = 0; r3 < e3.length; r3++) {
              t3(e3[r3]);
            }
          } else {
            t3(e3);
          }
        }
        implicitLoop(e3, t3) {
          if (this.shouldAutoIterate(e3)) {
            for (const r3 of e3) t3(r3);
          } else {
            t3(e3);
          }
        }
        wrapArrays(e3) {
          var t3 = [];
          for (var r3 = 0; r3 < e3.length; r3++) {
            var n3 = e3[r3];
            if (Array.isArray(n3)) {
              t3.push(Promise.all(n3));
            } else {
              t3.push(n3);
            }
          }
          return t3;
        }
        unwrapAsyncs(e3) {
          for (var t3 = 0; t3 < e3.length; t3++) {
            var r3 = e3[t3];
            if (r3.asyncWrapper) {
              e3[t3] = r3.value;
            }
            if (Array.isArray(r3)) {
              for (var n3 = 0; n3 < r3.length; n3++) {
                var i3 = r3[n3];
                if (i3.asyncWrapper) {
                  r3[n3] = i3.value;
                }
              }
            }
          }
        }
        static HALT = {};
        HALT = o2.HALT;
        unifiedExec(e3, t3) {
          while (true) {
            try {
              var r3 = this.unifiedEval(e3, t3);
            } catch (n3) {
              if (t3.meta.handlingFinally) {
                console.error(" Exception in finally block: ", n3);
                r3 = o2.HALT;
              } else {
                this.registerHyperTrace(t3, n3);
                if (t3.meta.errorHandler && !t3.meta.handlingError) {
                  t3.meta.handlingError = true;
                  t3.locals[t3.meta.errorSymbol] = n3;
                  e3 = t3.meta.errorHandler;
                  continue;
                } else {
                  t3.meta.currentException = n3;
                  r3 = o2.HALT;
                }
              }
            }
            if (r3 == null) {
              console.error(e3, " did not return a next element to execute! context: ", t3);
              return;
            } else if (r3.then) {
              r3.then((e4) => {
                this.unifiedExec(e4, t3);
              }).catch((e4) => {
                this.unifiedExec({ op: function() {
                  throw e4;
                } }, t3);
              });
              return;
            } else if (r3 === o2.HALT) {
              if (t3.meta.finallyHandler && !t3.meta.handlingFinally) {
                t3.meta.handlingFinally = true;
                e3 = t3.meta.finallyHandler;
              } else {
                if (t3.meta.onHalt) {
                  t3.meta.onHalt();
                }
                if (t3.meta.currentException) {
                  if (t3.meta.reject) {
                    t3.meta.reject(t3.meta.currentException);
                    return;
                  } else {
                    throw t3.meta.currentException;
                  }
                } else {
                  return;
                }
              }
            } else {
              e3 = r3;
            }
          }
        }
        unifiedEval(e3, t3, r3) {
          var n3 = [t3];
          var i3 = false;
          var a3 = false;
          if (e3.args) {
            for (var o3 = 0; o3 < e3.args.length; o3++) {
              var s3 = e3.args[o3];
              if (s3 == null) {
                n3.push(null);
              } else if (Array.isArray(s3)) {
                var u3 = [];
                for (var l3 = 0; l3 < s3.length; l3++) {
                  var c3 = s3[l3];
                  var f3 = c3 ? c3.evaluate(t3) : null;
                  if (f3) {
                    if (f3.then) {
                      i3 = true;
                    } else if (f3.asyncWrapper) {
                      a3 = true;
                    }
                  }
                  u3.push(f3);
                }
                n3.push(u3);
              } else if (s3.evaluate) {
                var f3 = s3.evaluate(t3);
                if (f3) {
                  if (f3.then) {
                    i3 = true;
                  } else if (f3.asyncWrapper) {
                    a3 = true;
                  }
                }
                n3.push(f3);
                if (f3) {
                  if (r3 === true) {
                    break;
                  }
                } else {
                  if (r3 === false) {
                    break;
                  }
                }
              } else {
                n3.push(s3);
              }
            }
          }
          if (i3) {
            return new Promise((t4, r4) => {
              n3 = this.wrapArrays(n3);
              Promise.all(n3).then(function(n4) {
                if (a3) {
                  this.unwrapAsyncs(n4);
                }
                try {
                  var i4 = e3.op.apply(e3, n4);
                  t4(i4);
                } catch (e4) {
                  r4(e4);
                }
              }).catch(function(e4) {
                r4(e4);
              });
            });
          } else {
            if (a3) {
              this.unwrapAsyncs(n3);
            }
            return e3.op.apply(e3, n3);
          }
        }
        _scriptAttrs = null;
        getScriptAttributes() {
          if (this._scriptAttrs == null) {
            this._scriptAttrs = r2.attributes.replace(/ /g, "").split(",");
          }
          return this._scriptAttrs;
        }
        getScript(e3) {
          for (var t3 = 0; t3 < this.getScriptAttributes().length; t3++) {
            var r3 = this.getScriptAttributes()[t3];
            if (e3.hasAttribute && e3.hasAttribute(r3)) {
              return e3.getAttribute(r3);
            }
          }
          if (e3 instanceof HTMLScriptElement && e3.type === "text/hyperscript") {
            return e3.innerText;
          }
          return null;
        }
        hyperscriptFeaturesMap = /* @__PURE__ */ new WeakMap();
        getHyperscriptFeatures(e3) {
          var t3 = this.hyperscriptFeaturesMap.get(e3);
          if (typeof t3 === "undefined") {
            if (e3) {
              this.hyperscriptFeaturesMap.set(e3, t3 = {});
            }
          }
          return t3;
        }
        addFeatures(e3, t3) {
          if (e3) {
            Object.assign(t3.locals, this.getHyperscriptFeatures(e3));
            this.addFeatures(e3.parentElement, t3);
          }
        }
        makeContext(e3, t3, r3, n3) {
          return new f2(e3, t3, r3, n3, this);
        }
        getScriptSelector() {
          return this.getScriptAttributes().map(function(e3) {
            return "[" + e3 + "]";
          }).join(", ");
        }
        convertValue(e3, r3) {
          var n3 = t2.dynamicResolvers;
          for (var i3 = 0; i3 < n3.length; i3++) {
            var a3 = n3[i3];
            var o3 = a3(r3, e3);
            if (o3 !== void 0) {
              return o3;
            }
          }
          if (e3 == null) {
            return null;
          }
          var s3 = t2[r3];
          if (s3) {
            return s3(e3);
          }
          throw "Unknown conversion : " + r3;
        }
        parse(e3) {
          const t3 = this.lexer, r3 = this.parser;
          var n3 = t3.tokenize(e3);
          if (this.parser.commandStart(n3.currentToken())) {
            var i3 = r3.requireElement("commandList", n3);
            if (n3.hasMore()) r3.raiseParseError(n3);
            r3.ensureTerminated(i3);
            return i3;
          } else if (r3.featureStart(n3.currentToken())) {
            var a3 = r3.requireElement("hyperscript", n3);
            if (n3.hasMore()) r3.raiseParseError(n3);
            return a3;
          } else {
            var o3 = r3.requireElement("expression", n3);
            if (n3.hasMore()) r3.raiseParseError(n3);
            return o3;
          }
        }
        evaluateNoPromise(e3, t3) {
          let r3 = e3.evaluate(t3);
          if (r3.next) {
            throw new Error(i2.sourceFor.call(e3) + " returned a Promise in a context that they are not allowed.");
          }
          return r3;
        }
        evaluate(t3, r3, n3) {
          class i3 extends EventTarget {
            constructor(e3) {
              super();
              this.module = e3;
            }
            toString() {
              return this.module.id;
            }
          }
          var a3 = "document" in e2 ? e2.document.body : new i3(n3 && n3.module);
          r3 = Object.assign(this.makeContext(a3, null, a3, null), r3 || {});
          var o3 = this.parse(t3);
          if (o3.execute) {
            o3.execute(r3);
            if (typeof r3.meta.returnValue !== "undefined") {
              return r3.meta.returnValue;
            } else {
              return r3.result;
            }
          } else if (o3.apply) {
            o3.apply(a3, a3, n3);
            return this.getHyperscriptFeatures(a3);
          } else {
            return o3.evaluate(r3);
          }
          function s3() {
            return {};
          }
        }
        processNode(e3) {
          var t3 = this.getScriptSelector();
          if (this.matchesSelector(e3, t3)) {
            this.initElement(e3, e3);
          }
          if (e3 instanceof HTMLScriptElement && e3.type === "text/hyperscript") {
            this.initElement(e3, document.body);
          }
          if (e3.querySelectorAll) {
            this.forEach(e3.querySelectorAll(t3 + ", [type='text/hyperscript']"), (e4) => {
              this.initElement(e4, e4 instanceof HTMLScriptElement && e4.type === "text/hyperscript" ? document.body : e4);
            });
          }
        }
        initElement(e3, t3) {
          if (e3.closest && e3.closest(r2.disableSelector)) {
            return;
          }
          var n3 = this.getInternalData(e3);
          if (!n3.initialized) {
            var i3 = this.getScript(e3);
            if (i3) {
              try {
                n3.initialized = true;
                n3.script = i3;
                const r3 = this.lexer, s3 = this.parser;
                var a3 = r3.tokenize(i3);
                var o3 = s3.parseHyperScript(a3);
                if (!o3) return;
                o3.apply(t3 || e3, e3);
                setTimeout(() => {
                  this.triggerEvent(t3 || e3, "load", { hyperscript: true });
                }, 1);
              } catch (t4) {
                this.triggerEvent(e3, "exception", { error: t4 });
                console.error("hyperscript errors were found on the following element:", e3, "\n\n", t4.message, t4.stack);
              }
            }
          }
        }
        internalDataMap = /* @__PURE__ */ new WeakMap();
        getInternalData(e3) {
          var t3 = this.internalDataMap.get(e3);
          if (typeof t3 === "undefined") {
            this.internalDataMap.set(e3, t3 = {});
          }
          return t3;
        }
        typeCheck(e3, t3, r3) {
          if (e3 == null && r3) {
            return true;
          }
          var n3 = Object.prototype.toString.call(e3).slice(8, -1);
          return n3 === t3;
        }
        getElementScope(e3) {
          var t3 = e3.meta && e3.meta.owner;
          if (t3) {
            var r3 = this.getInternalData(t3);
            var n3 = "elementScope";
            if (e3.meta.feature && e3.meta.feature.behavior) {
              n3 = e3.meta.feature.behavior + "Scope";
            }
            var i3 = h2(r3, n3);
            return i3;
          } else {
            return {};
          }
        }
        isReservedWord(e3) {
          return ["meta", "it", "result", "locals", "event", "target", "detail", "sender", "body"].includes(e3);
        }
        isHyperscriptContext(e3) {
          return e3 instanceof f2;
        }
        resolveSymbol(t3, r3, n3) {
          if (t3 === "me" || t3 === "my" || t3 === "I") {
            return r3.me;
          }
          if (t3 === "it" || t3 === "its" || t3 === "result") {
            return r3.result;
          }
          if (t3 === "you" || t3 === "your" || t3 === "yourself") {
            return r3.you;
          } else {
            if (n3 === "global") {
              return e2[t3];
            } else if (n3 === "element") {
              var i3 = this.getElementScope(r3);
              return i3[t3];
            } else if (n3 === "local") {
              return r3.locals[t3];
            } else {
              if (r3.meta && r3.meta.context) {
                var a3 = r3.meta.context[t3];
                if (typeof a3 !== "undefined") {
                  return a3;
                }
                if (r3.meta.context.detail) {
                  a3 = r3.meta.context.detail[t3];
                  if (typeof a3 !== "undefined") {
                    return a3;
                  }
                }
              }
              if (this.isHyperscriptContext(r3) && !this.isReservedWord(t3)) {
                var o3 = r3.locals[t3];
              } else {
                var o3 = r3[t3];
              }
              if (typeof o3 !== "undefined") {
                return o3;
              } else {
                var i3 = this.getElementScope(r3);
                o3 = i3[t3];
                if (typeof o3 !== "undefined") {
                  return o3;
                } else {
                  return e2[t3];
                }
              }
            }
          }
        }
        setSymbol(t3, r3, n3, i3) {
          if (n3 === "global") {
            e2[t3] = i3;
          } else if (n3 === "element") {
            var a3 = this.getElementScope(r3);
            a3[t3] = i3;
          } else if (n3 === "local") {
            r3.locals[t3] = i3;
          } else {
            if (this.isHyperscriptContext(r3) && !this.isReservedWord(t3) && typeof r3.locals[t3] !== "undefined") {
              r3.locals[t3] = i3;
            } else {
              var a3 = this.getElementScope(r3);
              var o3 = a3[t3];
              if (typeof o3 !== "undefined") {
                a3[t3] = i3;
              } else {
                if (this.isHyperscriptContext(r3) && !this.isReservedWord(t3)) {
                  r3.locals[t3] = i3;
                } else {
                  r3[t3] = i3;
                }
              }
            }
          }
        }
        findNext(e3, t3) {
          if (e3) {
            if (e3.resolveNext) {
              return e3.resolveNext(t3);
            } else if (e3.next) {
              return e3.next;
            } else {
              return this.findNext(e3.parent, t3);
            }
          }
        }
        flatGet(e3, t3, r3) {
          if (e3 != null) {
            var n3 = r3(e3, t3);
            if (typeof n3 !== "undefined") {
              return n3;
            }
            if (this.shouldAutoIterate(e3)) {
              var i3 = [];
              for (var a3 of e3) {
                var o3 = r3(a3, t3);
                i3.push(o3);
              }
              return i3;
            }
          }
        }
        resolveProperty(e3, t3) {
          return this.flatGet(e3, t3, (e4, t4) => e4[t4]);
        }
        resolveAttribute(e3, t3) {
          return this.flatGet(e3, t3, (e4, t4) => e4.getAttribute && e4.getAttribute(t4));
        }
        resolveStyle(e3, t3) {
          return this.flatGet(e3, t3, (e4, t4) => e4.style && e4.style[t4]);
        }
        resolveComputedStyle(e3, t3) {
          return this.flatGet(e3, t3, (e4, t4) => getComputedStyle(e4).getPropertyValue(t4));
        }
        assignToNamespace(t3, r3, n3, i3) {
          let a3;
          if (typeof document !== "undefined" && t3 === document.body) {
            a3 = e2;
          } else {
            a3 = this.getHyperscriptFeatures(t3);
          }
          var o3;
          while ((o3 = r3.shift()) !== void 0) {
            var s3 = a3[o3];
            if (s3 == null) {
              s3 = {};
              a3[o3] = s3;
            }
            a3 = s3;
          }
          a3[n3] = i3;
        }
        getHyperTrace(e3, t3) {
          var r3 = [];
          var n3 = e3;
          while (n3.meta.caller) {
            n3 = n3.meta.caller;
          }
          if (n3.meta.traceMap) {
            return n3.meta.traceMap.get(t3, r3);
          }
        }
        registerHyperTrace(e3, t3) {
          var r3 = [];
          var n3 = null;
          while (e3 != null) {
            r3.push(e3);
            n3 = e3;
            e3 = e3.meta.caller;
          }
          if (n3.meta.traceMap == null) {
            n3.meta.traceMap = /* @__PURE__ */ new Map();
          }
          if (!n3.meta.traceMap.get(t3)) {
            var i3 = { trace: r3, print: function(e4) {
              e4 = e4 || console.error;
              e4("hypertrace /// ");
              var t4 = 0;
              for (var n4 = 0; n4 < r3.length; n4++) {
                t4 = Math.max(t4, r3[n4].meta.feature.displayName.length);
              }
              for (var n4 = 0; n4 < r3.length; n4++) {
                var i4 = r3[n4];
                e4("  ->", i4.meta.feature.displayName.padEnd(t4 + 2), "-", i4.meta.owner);
              }
            } };
            n3.meta.traceMap.set(t3, i3);
          }
        }
        escapeSelector(e3) {
          return e3.replace(/[:&()\[\]\/]/g, function(e4) {
            return "\\" + e4;
          });
        }
        nullCheck(e3, t3) {
          if (e3 == null) {
            throw new Error("'" + t3.sourceFor() + "' is null");
          }
        }
        isEmpty(e3) {
          return e3 == void 0 || e3.length === 0;
        }
        doesExist(e3) {
          if (e3 == null) {
            return false;
          }
          if (this.shouldAutoIterate(e3)) {
            for (const t3 of e3) {
              return true;
            }
            return false;
          }
          return true;
        }
        getRootNode(e3) {
          if (e3 && e3 instanceof Node) {
            var t3 = e3.getRootNode();
            if (t3 instanceof Document || t3 instanceof ShadowRoot) return t3;
          }
          return document;
        }
        getEventQueueFor(e3, t3) {
          let r3 = this.getInternalData(e3);
          var n3 = r3.eventQueues;
          if (n3 == null) {
            n3 = /* @__PURE__ */ new Map();
            r3.eventQueues = n3;
          }
          var i3 = n3.get(t3);
          if (i3 == null) {
            i3 = { queue: [], executing: false };
            n3.set(t3, i3);
          }
          return i3;
        }
        beepValueToConsole(e3, t3, r3) {
          if (this.triggerEvent(e3, "hyperscript:beep", { element: e3, expression: t3, value: r3 })) {
            var n3;
            if (r3) {
              if (r3 instanceof m2) {
                n3 = "ElementCollection";
              } else if (r3.constructor) {
                n3 = r3.constructor.name;
              } else {
                n3 = "unknown";
              }
            } else {
              n3 = "object (null)";
            }
            var a3 = r3;
            if (n3 === "String") {
              a3 = '"' + a3 + '"';
            } else if (r3 instanceof m2) {
              a3 = Array.from(r3);
            }
            console.log("///_ BEEP! The expression (" + i2.sourceFor.call(t3).replace("beep! ", "") + ") evaluates to:", a3, "of type " + n3);
          }
        }
        hyperscriptUrl = "document" in e2 && document.currentScript ? document.currentScript.src : null;
      }
      function s2() {
        let e3 = document.cookie.split("; ").map((e4) => {
          let t3 = e4.split("=");
          return { name: t3[0], value: decodeURIComponent(t3[1]) };
        });
        return e3;
      }
      function u2(e3) {
        document.cookie = e3 + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT";
      }
      function l2() {
        for (const e3 of s2()) {
          u2(e3.name);
        }
      }
      const c2 = new Proxy({}, { get(e3, t3) {
        if (t3 === "then" || t3 === "asyncWrapper") {
          return null;
        } else if (t3 === "length") {
          return s2().length;
        } else if (t3 === "clear") {
          return u2;
        } else if (t3 === "clearAll") {
          return l2;
        } else if (typeof t3 === "string") {
          if (!isNaN(t3)) {
            return s2()[parseInt(t3)];
          } else {
            let e4 = document.cookie.split("; ").find((e5) => e5.startsWith(t3 + "="))?.split("=")[1];
            if (e4) {
              return decodeURIComponent(e4);
            }
          }
        } else if (t3 === Symbol.iterator) {
          return s2()[t3];
        }
      }, set(e3, t3, r3) {
        var n3 = null;
        if ("string" === typeof r3) {
          n3 = encodeURIComponent(r3);
          n3 += ";samesite=lax";
        } else {
          n3 = encodeURIComponent(r3.value);
          if (r3.expires) {
            n3 += ";expires=" + r3.maxAge;
          }
          if (r3.maxAge) {
            n3 += ";max-age=" + r3.maxAge;
          }
          if (r3.partitioned) {
            n3 += ";partitioned=" + r3.partitioned;
          }
          if (r3.path) {
            n3 += ";path=" + r3.path;
          }
          if (r3.samesite) {
            n3 += ";samesite=" + r3.path;
          }
          if (r3.secure) {
            n3 += ";secure=" + r3.path;
          }
        }
        document.cookie = t3 + "=" + n3;
        return true;
      } });
      class f2 {
        constructor(t3, r3, n3, i3, a3) {
          this.meta = { parser: a3.parser, lexer: a3.lexer, runtime: a3, owner: t3, feature: r3, iterators: {}, ctx: this };
          this.locals = { cookies: c2 };
          this.me = n3, this.you = void 0;
          this.result = void 0;
          this.event = i3;
          this.target = i3 ? i3.target : null;
          this.detail = i3 ? i3.detail : null;
          this.sender = i3 ? i3.detail ? i3.detail.sender : null : null;
          this.body = "document" in e2 ? document.body : null;
          a3.addFeatures(t3, this);
        }
      }
      class m2 {
        constructor(e3, t3, r3) {
          this._css = e3;
          this.relativeToElement = t3;
          this.escape = r3;
          this[p2] = true;
        }
        get css() {
          if (this.escape) {
            return o2.prototype.escapeSelector(this._css);
          } else {
            return this._css;
          }
        }
        get className() {
          return this._css.substr(1);
        }
        get id() {
          return this.className();
        }
        contains(e3) {
          for (let t3 of this) {
            if (t3.contains(e3)) {
              return true;
            }
          }
          return false;
        }
        get length() {
          return this.selectMatches().length;
        }
        [Symbol.iterator]() {
          let e3 = this.selectMatches();
          return e3[Symbol.iterator]();
        }
        selectMatches() {
          let e3 = o2.prototype.getRootNode(this.relativeToElement).querySelectorAll(this.css);
          return e3;
        }
      }
      const p2 = Symbol();
      function h2(e3, t3) {
        var r3 = e3[t3];
        if (r3) {
          return r3;
        } else {
          var n3 = {};
          e3[t3] = n3;
          return n3;
        }
      }
      function v2(e3) {
        try {
          return JSON.parse(e3);
        } catch (e4) {
          d2(e4);
          return null;
        }
      }
      function d2(e3) {
        if (console.error) {
          console.error(e3);
        } else if (console.log) {
          console.log("ERROR: ", e3);
        }
      }
      function E2(e3, t3) {
        return new (e3.bind.apply(e3, [e3].concat(t3)))();
      }
      function T2(t3) {
        t3.addLeafExpression("parenthesized", function(e3, t4, r4) {
          if (r4.matchOpToken("(")) {
            var n3 = r4.clearFollows();
            try {
              var i3 = e3.requireElement("expression", r4);
            } finally {
              r4.restoreFollows(n3);
            }
            r4.requireOpToken(")");
            return i3;
          }
        });
        t3.addLeafExpression("string", function(e3, t4, r4) {
          var i3 = r4.matchTokenType("STRING");
          if (!i3) return;
          var a4 = i3.value;
          var o3;
          if (i3.template) {
            var s4 = n2.tokenize(a4, true);
            o3 = e3.parseStringTemplate(s4);
          } else {
            o3 = [];
          }
          return { type: "string", token: i3, args: o3, op: function(e4) {
            var t5 = "";
            for (var r5 = 1; r5 < arguments.length; r5++) {
              var n3 = arguments[r5];
              if (n3 !== void 0) {
                t5 += n3;
              }
            }
            return t5;
          }, evaluate: function(e4) {
            if (o3.length === 0) {
              return a4;
            } else {
              return t4.unifiedEval(this, e4);
            }
          } };
        });
        t3.addGrammarElement("nakedString", function(e3, t4, r4) {
          if (r4.hasMore()) {
            var n3 = r4.consumeUntilWhitespace();
            r4.matchTokenType("WHITESPACE");
            return { type: "nakedString", tokens: n3, evaluate: function(e4) {
              return n3.map(function(e5) {
                return e5.value;
              }).join("");
            } };
          }
        });
        t3.addLeafExpression("number", function(e3, t4, r4) {
          var n3 = r4.matchTokenType("NUMBER");
          if (!n3) return;
          var i3 = n3;
          var a4 = parseFloat(n3.value);
          return { type: "number", value: a4, numberToken: i3, evaluate: function() {
            return a4;
          } };
        });
        t3.addLeafExpression("idRef", function(e3, t4, r4) {
          var i3 = r4.matchTokenType("ID_REF");
          if (!i3) return;
          if (!i3.value) return;
          if (i3.template) {
            var a4 = i3.value.substring(2);
            var o3 = n2.tokenize(a4);
            var s4 = e3.requireElement("expression", o3);
            return { type: "idRefTemplate", args: [s4], op: function(e4, r5) {
              return t4.getRootNode(e4.me).getElementById(r5);
            }, evaluate: function(e4) {
              return t4.unifiedEval(this, e4);
            } };
          } else {
            const e4 = i3.value.substring(1);
            return { type: "idRef", css: i3.value, value: e4, evaluate: function(r5) {
              return t4.getRootNode(r5.me).getElementById(e4);
            } };
          }
        });
        t3.addLeafExpression("classRef", function(e3, t4, r4) {
          var i3 = r4.matchTokenType("CLASS_REF");
          if (!i3) return;
          if (!i3.value) return;
          if (i3.template) {
            var a4 = i3.value.substring(2);
            var o3 = n2.tokenize(a4);
            var s4 = e3.requireElement("expression", o3);
            return { type: "classRefTemplate", args: [s4], op: function(e4, t5) {
              return new m2("." + t5, e4.me, true);
            }, evaluate: function(e4) {
              return t4.unifiedEval(this, e4);
            } };
          } else {
            const e4 = i3.value;
            return { type: "classRef", css: e4, evaluate: function(t5) {
              return new m2(e4, t5.me, true);
            } };
          }
        });
        class r3 extends m2 {
          constructor(e3, t4, r4) {
            super(e3, t4);
            this.templateParts = r4;
            this.elements = r4.filter((e4) => e4 instanceof Element);
          }
          get css() {
            let e3 = "", t4 = 0;
            for (const r4 of this.templateParts) {
              if (r4 instanceof Element) {
                e3 += "[data-hs-query-id='" + t4++ + "']";
              } else e3 += r4;
            }
            return e3;
          }
          [Symbol.iterator]() {
            this.elements.forEach((e4, t4) => e4.dataset.hsQueryId = t4);
            const e3 = super[Symbol.iterator]();
            this.elements.forEach((e4) => e4.removeAttribute("data-hs-query-id"));
            return e3;
          }
        }
        t3.addLeafExpression("queryRef", function(e3, t4, i3) {
          var a4 = i3.matchOpToken("<");
          if (!a4) return;
          var o3 = i3.consumeUntil("/");
          i3.requireOpToken("/");
          i3.requireOpToken(">");
          var s4 = o3.map(function(e4) {
            if (e4.type === "STRING") {
              return '"' + e4.value + '"';
            } else {
              return e4.value;
            }
          }).join("");
          var u4, l4, c4;
          if (/\$[^=]/.test(s4)) {
            u4 = true;
            l4 = n2.tokenize(s4, true);
            c4 = e3.parseStringTemplate(l4);
          }
          return { type: "queryRef", css: s4, args: c4, op: function(e4, ...t5) {
            if (u4) {
              return new r3(s4, e4.me, t5);
            } else {
              return new m2(s4, e4.me);
            }
          }, evaluate: function(e4) {
            return t4.unifiedEval(this, e4);
          } };
        });
        t3.addLeafExpression("attributeRef", function(e3, t4, r4) {
          var n3 = r4.matchTokenType("ATTRIBUTE_REF");
          if (!n3) return;
          if (!n3.value) return;
          var i3 = n3.value;
          if (i3.indexOf("[") === 0) {
            var a4 = i3.substring(2, i3.length - 1);
          } else {
            var a4 = i3.substring(1);
          }
          var o3 = "[" + a4 + "]";
          var s4 = a4.split("=");
          var u4 = s4[0];
          var l4 = s4[1];
          if (l4) {
            if (l4.indexOf('"') === 0) {
              l4 = l4.substring(1, l4.length - 1);
            }
          }
          return { type: "attributeRef", name: u4, css: o3, value: l4, op: function(e4) {
            var t5 = e4.you || e4.me;
            if (t5) {
              return t5.getAttribute(u4);
            }
          }, evaluate: function(e4) {
            return t4.unifiedEval(this, e4);
          } };
        });
        t3.addLeafExpression("styleRef", function(e3, t4, r4) {
          var n3 = r4.matchTokenType("STYLE_REF");
          if (!n3) return;
          if (!n3.value) return;
          var i3 = n3.value.substr(1);
          if (i3.startsWith("computed-")) {
            i3 = i3.substr("computed-".length);
            return { type: "computedStyleRef", name: i3, op: function(e4) {
              var r5 = e4.you || e4.me;
              if (r5) {
                return t4.resolveComputedStyle(r5, i3);
              }
            }, evaluate: function(e4) {
              return t4.unifiedEval(this, e4);
            } };
          } else {
            return { type: "styleRef", name: i3, op: function(e4) {
              var r5 = e4.you || e4.me;
              if (r5) {
                return t4.resolveStyle(r5, i3);
              }
            }, evaluate: function(e4) {
              return t4.unifiedEval(this, e4);
            } };
          }
        });
        t3.addGrammarElement("objectKey", function(e3, t4, r4) {
          var n3;
          if (n3 = r4.matchTokenType("STRING")) {
            return { type: "objectKey", key: n3.value, evaluate: function() {
              return n3.value;
            } };
          } else if (r4.matchOpToken("[")) {
            var i3 = e3.parseElement("expression", r4);
            r4.requireOpToken("]");
            return { type: "objectKey", expr: i3, args: [i3], op: function(e4, t5) {
              return t5;
            }, evaluate: function(e4) {
              return t4.unifiedEval(this, e4);
            } };
          } else {
            var a4 = "";
            do {
              n3 = r4.matchTokenType("IDENTIFIER") || r4.matchOpToken("-");
              if (n3) a4 += n3.value;
            } while (n3);
            return { type: "objectKey", key: a4, evaluate: function() {
              return a4;
            } };
          }
        });
        t3.addLeafExpression("objectLiteral", function(e3, t4, r4) {
          if (!r4.matchOpToken("{")) return;
          var n3 = [];
          var i3 = [];
          if (!r4.matchOpToken("}")) {
            do {
              var a4 = e3.requireElement("objectKey", r4);
              r4.requireOpToken(":");
              var o3 = e3.requireElement("expression", r4);
              i3.push(o3);
              n3.push(a4);
            } while (r4.matchOpToken(",") && !r4.peekToken("}", 0, "R_BRACE"));
            r4.requireOpToken("}");
          }
          return { type: "objectLiteral", args: [n3, i3], op: function(e4, t5, r5) {
            var n4 = {};
            for (var i4 = 0; i4 < t5.length; i4++) {
              n4[t5[i4]] = r5[i4];
            }
            return n4;
          }, evaluate: function(e4) {
            return t4.unifiedEval(this, e4);
          } };
        });
        t3.addGrammarElement("nakedNamedArgumentList", function(e3, t4, r4) {
          var n3 = [];
          var i3 = [];
          if (r4.currentToken().type === "IDENTIFIER") {
            do {
              var a4 = r4.requireTokenType("IDENTIFIER");
              r4.requireOpToken(":");
              var o3 = e3.requireElement("expression", r4);
              i3.push(o3);
              n3.push({ name: a4, value: o3 });
            } while (r4.matchOpToken(","));
          }
          return { type: "namedArgumentList", fields: n3, args: [i3], op: function(e4, t5) {
            var r5 = { _namedArgList_: true };
            for (var i4 = 0; i4 < t5.length; i4++) {
              var a5 = n3[i4];
              r5[a5.name.value] = t5[i4];
            }
            return r5;
          }, evaluate: function(e4) {
            return t4.unifiedEval(this, e4);
          } };
        });
        t3.addGrammarElement("namedArgumentList", function(e3, t4, r4) {
          if (!r4.matchOpToken("(")) return;
          var n3 = e3.requireElement("nakedNamedArgumentList", r4);
          r4.requireOpToken(")");
          return n3;
        });
        t3.addGrammarElement("symbol", function(e3, t4, r4) {
          var n3 = "default";
          if (r4.matchToken("global")) {
            n3 = "global";
          } else if (r4.matchToken("element") || r4.matchToken("module")) {
            n3 = "element";
            if (r4.matchOpToken("'")) {
              r4.requireToken("s");
            }
          } else if (r4.matchToken("local")) {
            n3 = "local";
          }
          let i3 = r4.matchOpToken(":");
          let a4 = r4.matchTokenType("IDENTIFIER");
          if (a4 && a4.value) {
            var o3 = a4.value;
            if (i3) {
              o3 = ":" + o3;
            }
            if (n3 === "default") {
              if (o3.indexOf("$") === 0) {
                n3 = "global";
              }
              if (o3.indexOf(":") === 0) {
                n3 = "element";
              }
            }
            return { type: "symbol", token: a4, scope: n3, name: o3, evaluate: function(e4) {
              return t4.resolveSymbol(o3, e4, n3);
            } };
          }
        });
        t3.addGrammarElement("implicitMeTarget", function(e3, t4, r4) {
          return { type: "implicitMeTarget", evaluate: function(e4) {
            return e4.you || e4.me;
          } };
        });
        t3.addLeafExpression("boolean", function(e3, t4, r4) {
          var n3 = r4.matchToken("true") || r4.matchToken("false");
          if (!n3) return;
          const i3 = n3.value === "true";
          return { type: "boolean", evaluate: function(e4) {
            return i3;
          } };
        });
        t3.addLeafExpression("null", function(e3, t4, r4) {
          if (r4.matchToken("null")) {
            return { type: "null", evaluate: function(e4) {
              return null;
            } };
          }
        });
        t3.addLeafExpression("arrayLiteral", function(e3, t4, r4) {
          if (!r4.matchOpToken("[")) return;
          var n3 = [];
          if (!r4.matchOpToken("]")) {
            do {
              var i3 = e3.requireElement("expression", r4);
              n3.push(i3);
            } while (r4.matchOpToken(","));
            r4.requireOpToken("]");
          }
          return { type: "arrayLiteral", values: n3, args: [n3], op: function(e4, t5) {
            return t5;
          }, evaluate: function(e4) {
            return t4.unifiedEval(this, e4);
          } };
        });
        t3.addLeafExpression("blockLiteral", function(e3, t4, r4) {
          if (!r4.matchOpToken("\\")) return;
          var n3 = [];
          var i3 = r4.matchTokenType("IDENTIFIER");
          if (i3) {
            n3.push(i3);
            while (r4.matchOpToken(",")) {
              n3.push(r4.requireTokenType("IDENTIFIER"));
            }
          }
          r4.requireOpToken("-");
          r4.requireOpToken(">");
          var a4 = e3.requireElement("expression", r4);
          return { type: "blockLiteral", args: n3, expr: a4, evaluate: function(e4) {
            var t5 = function() {
              for (var t6 = 0; t6 < n3.length; t6++) {
                e4.locals[n3[t6].value] = arguments[t6];
              }
              return a4.evaluate(e4);
            };
            return t5;
          } };
        });
        t3.addIndirectExpression("propertyAccess", function(e3, t4, r4, n3) {
          if (!r4.matchOpToken(".")) return;
          var i3 = r4.requireTokenType("IDENTIFIER");
          var a4 = { type: "propertyAccess", root: n3, prop: i3, args: [n3], op: function(e4, r5) {
            var n4 = t4.resolveProperty(r5, i3.value);
            return n4;
          }, evaluate: function(e4) {
            return t4.unifiedEval(this, e4);
          } };
          return e3.parseElement("indirectExpression", r4, a4);
        });
        t3.addIndirectExpression("of", function(e3, t4, r4, n3) {
          if (!r4.matchToken("of")) return;
          var i3 = e3.requireElement("unaryExpression", r4);
          var a4 = null;
          var o3 = n3;
          while (o3.root) {
            a4 = o3;
            o3 = o3.root;
          }
          if (o3.type !== "symbol" && o3.type !== "attributeRef" && o3.type !== "styleRef" && o3.type !== "computedStyleRef") {
            e3.raiseParseError(r4, "Cannot take a property of a non-symbol: " + o3.type);
          }
          var s4 = o3.type === "attributeRef";
          var u4 = o3.type === "styleRef" || o3.type === "computedStyleRef";
          if (s4 || u4) {
            var l4 = o3;
          }
          var c4 = o3.name;
          var f4 = { type: "ofExpression", prop: o3.token, root: i3, attribute: l4, expression: n3, args: [i3], op: function(e4, r5) {
            if (s4) {
              return t4.resolveAttribute(r5, c4);
            } else if (u4) {
              if (o3.type === "computedStyleRef") {
                return t4.resolveComputedStyle(r5, c4);
              } else {
                return t4.resolveStyle(r5, c4);
              }
            } else {
              return t4.resolveProperty(r5, c4);
            }
          }, evaluate: function(e4) {
            return t4.unifiedEval(this, e4);
          } };
          if (o3.type === "attributeRef") {
            f4.attribute = o3;
          }
          if (a4) {
            a4.root = f4;
            a4.args = [f4];
          } else {
            n3 = f4;
          }
          return e3.parseElement("indirectExpression", r4, n3);
        });
        t3.addIndirectExpression("possessive", function(e3, t4, r4, n3) {
          if (e3.possessivesDisabled) {
            return;
          }
          var i3 = r4.matchOpToken("'");
          if (i3 || n3.type === "symbol" && (n3.name === "my" || n3.name === "its" || n3.name === "your") && (r4.currentToken().type === "IDENTIFIER" || r4.currentToken().type === "ATTRIBUTE_REF" || r4.currentToken().type === "STYLE_REF")) {
            if (i3) {
              r4.requireToken("s");
            }
            var a4, o3, s4;
            a4 = e3.parseElement("attributeRef", r4);
            if (a4 == null) {
              o3 = e3.parseElement("styleRef", r4);
              if (o3 == null) {
                s4 = r4.requireTokenType("IDENTIFIER");
              }
            }
            var u4 = { type: "possessive", root: n3, attribute: a4 || o3, prop: s4, args: [n3], op: function(e4, r5) {
              if (a4) {
                var n4 = t4.resolveAttribute(r5, a4.name);
              } else if (o3) {
                var n4;
                if (o3.type === "computedStyleRef") {
                  n4 = t4.resolveComputedStyle(r5, o3["name"]);
                } else {
                  n4 = t4.resolveStyle(r5, o3["name"]);
                }
              } else {
                var n4 = t4.resolveProperty(r5, s4.value);
              }
              return n4;
            }, evaluate: function(e4) {
              return t4.unifiedEval(this, e4);
            } };
            return e3.parseElement("indirectExpression", r4, u4);
          }
        });
        t3.addIndirectExpression("inExpression", function(e3, t4, r4, n3) {
          if (!r4.matchToken("in")) return;
          var i3 = e3.requireElement("unaryExpression", r4);
          var a4 = { type: "inExpression", root: n3, args: [n3, i3], op: function(e4, r5, n4) {
            var i4 = [];
            if (r5.css) {
              t4.implicitLoop(n4, function(e5) {
                var t5 = e5.querySelectorAll(r5.css);
                for (var n5 = 0; n5 < t5.length; n5++) {
                  i4.push(t5[n5]);
                }
              });
            } else if (r5 instanceof Element) {
              var a5 = false;
              t4.implicitLoop(n4, function(e5) {
                if (e5.contains(r5)) {
                  a5 = true;
                }
              });
              if (a5) {
                return r5;
              }
            } else {
              t4.implicitLoop(r5, function(e5) {
                t4.implicitLoop(n4, function(t5) {
                  if (e5 === t5) {
                    i4.push(e5);
                  }
                });
              });
            }
            return i4;
          }, evaluate: function(e4) {
            return t4.unifiedEval(this, e4);
          } };
          return e3.parseElement("indirectExpression", r4, a4);
        });
        t3.addIndirectExpression("asExpression", function(e3, t4, r4, n3) {
          if (!r4.matchToken("as")) return;
          r4.matchToken("a") || r4.matchToken("an");
          var i3 = e3.requireElement("dotOrColonPath", r4).evaluate();
          var a4 = { type: "asExpression", root: n3, args: [n3], op: function(e4, r5) {
            return t4.convertValue(r5, i3);
          }, evaluate: function(e4) {
            return t4.unifiedEval(this, e4);
          } };
          return e3.parseElement("indirectExpression", r4, a4);
        });
        t3.addIndirectExpression("functionCall", function(e3, t4, r4, n3) {
          if (!r4.matchOpToken("(")) return;
          var i3 = [];
          if (!r4.matchOpToken(")")) {
            do {
              i3.push(e3.requireElement("expression", r4));
            } while (r4.matchOpToken(","));
            r4.requireOpToken(")");
          }
          if (n3.root) {
            var a4 = { type: "functionCall", root: n3, argExressions: i3, args: [n3.root, i3], op: function(e4, r5, i4) {
              t4.nullCheck(r5, n3.root);
              var a5 = r5[n3.prop.value];
              t4.nullCheck(a5, n3);
              if (a5.hyperfunc) {
                i4.push(e4);
              }
              return a5.apply(r5, i4);
            }, evaluate: function(e4) {
              return t4.unifiedEval(this, e4);
            } };
          } else {
            var a4 = { type: "functionCall", root: n3, argExressions: i3, args: [n3, i3], op: function(e4, r5, i4) {
              t4.nullCheck(r5, n3);
              if (r5.hyperfunc) {
                i4.push(e4);
              }
              var a5 = r5.apply(null, i4);
              return a5;
            }, evaluate: function(e4) {
              return t4.unifiedEval(this, e4);
            } };
          }
          return e3.parseElement("indirectExpression", r4, a4);
        });
        t3.addIndirectExpression("attributeRefAccess", function(e3, t4, r4, n3) {
          var i3 = e3.parseElement("attributeRef", r4);
          if (!i3) return;
          var a4 = { type: "attributeRefAccess", root: n3, attribute: i3, args: [n3], op: function(e4, r5) {
            var n4 = t4.resolveAttribute(r5, i3.name);
            return n4;
          }, evaluate: function(e4) {
            return t4.unifiedEval(this, e4);
          } };
          return a4;
        });
        t3.addIndirectExpression("arrayIndex", function(e3, t4, r4, n3) {
          if (!r4.matchOpToken("[")) return;
          var i3 = false;
          var a4 = false;
          var o3 = null;
          var s4 = null;
          if (r4.matchOpToken("..")) {
            i3 = true;
            o3 = e3.requireElement("expression", r4);
          } else {
            o3 = e3.requireElement("expression", r4);
            if (r4.matchOpToken("..")) {
              a4 = true;
              var u4 = r4.currentToken();
              if (u4.type !== "R_BRACKET") {
                s4 = e3.parseElement("expression", r4);
              }
            }
          }
          r4.requireOpToken("]");
          var l4 = { type: "arrayIndex", root: n3, prop: o3, firstIndex: o3, secondIndex: s4, args: [n3, o3, s4], op: function(e4, t5, r5, n4) {
            if (t5 == null) {
              return null;
            }
            if (i3) {
              if (r5 < 0) {
                r5 = t5.length + r5;
              }
              return t5.slice(0, r5 + 1);
            } else if (a4) {
              if (n4 != null) {
                if (n4 < 0) {
                  n4 = t5.length + n4;
                }
                return t5.slice(r5, n4 + 1);
              } else {
                return t5.slice(r5);
              }
            } else {
              return t5[r5];
            }
          }, evaluate: function(e4) {
            return t4.unifiedEval(this, e4);
          } };
          return e3.parseElement("indirectExpression", r4, l4);
        });
        var a3 = ["em", "ex", "cap", "ch", "ic", "rem", "lh", "rlh", "vw", "vh", "vi", "vb", "vmin", "vmax", "cm", "mm", "Q", "pc", "pt", "px"];
        t3.addGrammarElement("postfixExpression", function(e3, t4, r4) {
          var n3 = e3.parseElement("negativeNumber", r4);
          let i3 = r4.matchAnyToken.apply(r4, a3) || r4.matchOpToken("%");
          if (i3) {
            return { type: "stringPostfix", postfix: i3.value, args: [n3], op: function(e4, t5) {
              return "" + t5 + i3.value;
            }, evaluate: function(e4) {
              return t4.unifiedEval(this, e4);
            } };
          }
          var o3 = null;
          if (r4.matchToken("s") || r4.matchToken("seconds")) {
            o3 = 1e3;
          } else if (r4.matchToken("ms") || r4.matchToken("milliseconds")) {
            o3 = 1;
          }
          if (o3) {
            return { type: "timeExpression", time: n3, factor: o3, args: [n3], op: function(e4, t5) {
              return t5 * o3;
            }, evaluate: function(e4) {
              return t4.unifiedEval(this, e4);
            } };
          }
          if (r4.matchOpToken(":")) {
            var s4 = r4.requireTokenType("IDENTIFIER");
            if (!s4.value) return;
            var u4 = !r4.matchOpToken("!");
            return { type: "typeCheck", typeName: s4, nullOk: u4, args: [n3], op: function(e4, r5) {
              var n4 = t4.typeCheck(r5, this.typeName.value, u4);
              if (n4) {
                return r5;
              } else {
                throw new Error("Typecheck failed!  Expected: " + s4.value);
              }
            }, evaluate: function(e4) {
              return t4.unifiedEval(this, e4);
            } };
          } else {
            return n3;
          }
        });
        t3.addGrammarElement("logicalNot", function(e3, t4, r4) {
          if (!r4.matchToken("not")) return;
          var n3 = e3.requireElement("unaryExpression", r4);
          return { type: "logicalNot", root: n3, args: [n3], op: function(e4, t5) {
            return !t5;
          }, evaluate: function(e4) {
            return t4.unifiedEval(this, e4);
          } };
        });
        t3.addGrammarElement("noExpression", function(e3, t4, r4) {
          if (!r4.matchToken("no")) return;
          var n3 = e3.requireElement("unaryExpression", r4);
          return { type: "noExpression", root: n3, args: [n3], op: function(e4, r5) {
            return t4.isEmpty(r5);
          }, evaluate: function(e4) {
            return t4.unifiedEval(this, e4);
          } };
        });
        t3.addLeafExpression("some", function(e3, t4, r4) {
          if (!r4.matchToken("some")) return;
          var n3 = e3.requireElement("expression", r4);
          return { type: "noExpression", root: n3, args: [n3], op: function(e4, r5) {
            return !t4.isEmpty(r5);
          }, evaluate(e4) {
            return t4.unifiedEval(this, e4);
          } };
        });
        t3.addGrammarElement("negativeNumber", function(e3, t4, r4) {
          if (r4.matchOpToken("-")) {
            var n3 = e3.requireElement("negativeNumber", r4);
            return { type: "negativeNumber", root: n3, args: [n3], op: function(e4, t5) {
              return -1 * t5;
            }, evaluate: function(e4) {
              return t4.unifiedEval(this, e4);
            } };
          } else {
            return e3.requireElement("primaryExpression", r4);
          }
        });
        t3.addGrammarElement("unaryExpression", function(e3, t4, r4) {
          r4.matchToken("the");
          return e3.parseAnyOf(["beepExpression", "logicalNot", "relativePositionalExpression", "positionalExpression", "noExpression", "postfixExpression"], r4);
        });
        t3.addGrammarElement("beepExpression", function(e3, t4, r4) {
          if (!r4.matchToken("beep!")) return;
          var n3 = e3.parseElement("unaryExpression", r4);
          if (n3) {
            n3["booped"] = true;
            var i3 = n3.evaluate;
            n3.evaluate = function(e4) {
              let r5 = i3.apply(n3, arguments);
              let a4 = e4.me;
              t4.beepValueToConsole(a4, n3, r5);
              return r5;
            };
            return n3;
          }
        });
        var s3 = function(e3, t4, r4, n3) {
          var i3 = t4.querySelectorAll(r4);
          for (var a4 = 0; a4 < i3.length; a4++) {
            var o3 = i3[a4];
            if (o3.compareDocumentPosition(e3) === Node.DOCUMENT_POSITION_PRECEDING) {
              return o3;
            }
          }
          if (n3) {
            return i3[0];
          }
        };
        var u3 = function(e3, t4, r4, n3) {
          var i3 = t4.querySelectorAll(r4);
          for (var a4 = i3.length - 1; a4 >= 0; a4--) {
            var o3 = i3[a4];
            if (o3.compareDocumentPosition(e3) === Node.DOCUMENT_POSITION_FOLLOWING) {
              return o3;
            }
          }
          if (n3) {
            return i3[i3.length - 1];
          }
        };
        var l3 = function(e3, t4, r4, n3) {
          var i3 = [];
          o2.prototype.forEach(t4, function(t5) {
            if (t5.matches(r4) || t5 === e3) {
              i3.push(t5);
            }
          });
          for (var a4 = 0; a4 < i3.length - 1; a4++) {
            var s4 = i3[a4];
            if (s4 === e3) {
              return i3[a4 + 1];
            }
          }
          if (n3) {
            var u4 = i3[0];
            if (u4 && u4.matches(r4)) {
              return u4;
            }
          }
        };
        var c3 = function(e3, t4, r4, n3) {
          return l3(e3, Array.from(t4).reverse(), r4, n3);
        };
        t3.addGrammarElement("relativePositionalExpression", function(e3, t4, r4) {
          var n3 = r4.matchAnyToken("next", "previous");
          if (!n3) return;
          var a4 = n3.value === "next";
          var o3 = e3.parseElement("expression", r4);
          if (r4.matchToken("from")) {
            r4.pushFollow("in");
            try {
              var f4 = e3.requireElement("unaryExpression", r4);
            } finally {
              r4.popFollow();
            }
          } else {
            var f4 = e3.requireElement("implicitMeTarget", r4);
          }
          var m3 = false;
          var p4;
          if (r4.matchToken("in")) {
            m3 = true;
            var h3 = e3.requireElement("unaryExpression", r4);
          } else if (r4.matchToken("within")) {
            p4 = e3.requireElement("unaryExpression", r4);
          } else {
            p4 = document.body;
          }
          var v4 = false;
          if (r4.matchToken("with")) {
            r4.requireToken("wrapping");
            v4 = true;
          }
          return { type: "relativePositionalExpression", from: f4, forwardSearch: a4, inSearch: m3, wrapping: v4, inElt: h3, withinElt: p4, operator: n3.value, args: [o3, f4, h3, p4], op: function(e4, t5, r5, n4, f5) {
            var p5 = t5.css;
            if (p5 == null) {
              throw "Expected a CSS value to be returned by " + i2.sourceFor.apply(o3);
            }
            if (m3) {
              if (n4) {
                if (a4) {
                  return l3(r5, n4, p5, v4);
                } else {
                  return c3(r5, n4, p5, v4);
                }
              }
            } else {
              if (f5) {
                if (a4) {
                  return s3(r5, f5, p5, v4);
                } else {
                  return u3(r5, f5, p5, v4);
                }
              }
            }
          }, evaluate: function(e4) {
            return t4.unifiedEval(this, e4);
          } };
        });
        t3.addGrammarElement("positionalExpression", function(e3, t4, r4) {
          var n3 = r4.matchAnyToken("first", "last", "random");
          if (!n3) return;
          r4.matchAnyToken("in", "from", "of");
          var i3 = e3.requireElement("unaryExpression", r4);
          const a4 = n3.value;
          return { type: "positionalExpression", rhs: i3, operator: n3.value, args: [i3], op: function(e4, t5) {
            if (t5 && !Array.isArray(t5)) {
              if (t5.children) {
                t5 = t5.children;
              } else {
                t5 = Array.from(t5);
              }
            }
            if (t5) {
              if (a4 === "first") {
                return t5[0];
              } else if (a4 === "last") {
                return t5[t5.length - 1];
              } else if (a4 === "random") {
                return t5[Math.floor(Math.random() * t5.length)];
              }
            }
          }, evaluate: function(e4) {
            return t4.unifiedEval(this, e4);
          } };
        });
        t3.addGrammarElement("mathOperator", function(e3, t4, r4) {
          var n3 = e3.parseElement("unaryExpression", r4);
          var i3, a4 = null;
          i3 = r4.matchAnyOpToken("+", "-", "*", "/") || r4.matchToken("mod");
          while (i3) {
            a4 = a4 || i3;
            var o3 = i3.value;
            if (a4.value !== o3) {
              e3.raiseParseError(r4, "You must parenthesize math operations with different operators");
            }
            var s4 = e3.parseElement("unaryExpression", r4);
            n3 = { type: "mathOperator", lhs: n3, rhs: s4, operator: o3, args: [n3, s4], op: function(e4, t5, r5) {
              if (o3 === "+") {
                return t5 + r5;
              } else if (o3 === "-") {
                return t5 - r5;
              } else if (o3 === "*") {
                return t5 * r5;
              } else if (o3 === "/") {
                return t5 / r5;
              } else if (o3 === "mod") {
                return t5 % r5;
              }
            }, evaluate: function(e4) {
              return t4.unifiedEval(this, e4);
            } };
            i3 = r4.matchAnyOpToken("+", "-", "*", "/") || r4.matchToken("mod");
          }
          return n3;
        });
        t3.addGrammarElement("mathExpression", function(e3, t4, r4) {
          return e3.parseAnyOf(["mathOperator", "unaryExpression"], r4);
        });
        function f3(e3, t4, r4) {
          if (t4["contains"]) {
            return t4.contains(r4);
          } else if (t4["includes"]) {
            return t4.includes(r4);
          } else {
            throw Error("The value of " + e3.sourceFor() + " does not have a contains or includes method on it");
          }
        }
        function p3(e3, t4, r4) {
          if (t4["match"]) {
            return !!t4.match(r4);
          } else if (t4["matches"]) {
            return t4.matches(r4);
          } else {
            throw Error("The value of " + e3.sourceFor() + " does not have a match or matches method on it");
          }
        }
        t3.addGrammarElement("comparisonOperator", function(e3, t4, r4) {
          var n3 = e3.parseElement("mathExpression", r4);
          var i3 = r4.matchAnyOpToken("<", ">", "<=", ">=", "==", "===", "!=", "!==");
          var a4 = i3 ? i3.value : null;
          var o3 = true;
          var s4 = false;
          if (a4 == null) {
            if (r4.matchToken("is") || r4.matchToken("am")) {
              if (r4.matchToken("not")) {
                if (r4.matchToken("in")) {
                  a4 = "not in";
                } else if (r4.matchToken("a") || r4.matchToken("an")) {
                  a4 = "not a";
                  s4 = true;
                } else if (r4.matchToken("empty")) {
                  a4 = "not empty";
                  o3 = false;
                } else {
                  if (r4.matchToken("really")) {
                    a4 = "!==";
                  } else {
                    a4 = "!=";
                  }
                  if (r4.matchToken("equal")) {
                    r4.matchToken("to");
                  }
                }
              } else if (r4.matchToken("in")) {
                a4 = "in";
              } else if (r4.matchToken("a") || r4.matchToken("an")) {
                a4 = "a";
                s4 = true;
              } else if (r4.matchToken("empty")) {
                a4 = "empty";
                o3 = false;
              } else if (r4.matchToken("less")) {
                r4.requireToken("than");
                if (r4.matchToken("or")) {
                  r4.requireToken("equal");
                  r4.requireToken("to");
                  a4 = "<=";
                } else {
                  a4 = "<";
                }
              } else if (r4.matchToken("greater")) {
                r4.requireToken("than");
                if (r4.matchToken("or")) {
                  r4.requireToken("equal");
                  r4.requireToken("to");
                  a4 = ">=";
                } else {
                  a4 = ">";
                }
              } else {
                if (r4.matchToken("really")) {
                  a4 = "===";
                } else {
                  a4 = "==";
                }
                if (r4.matchToken("equal")) {
                  r4.matchToken("to");
                }
              }
            } else if (r4.matchToken("equals")) {
              a4 = "==";
            } else if (r4.matchToken("really")) {
              r4.requireToken("equals");
              a4 = "===";
            } else if (r4.matchToken("exist") || r4.matchToken("exists")) {
              a4 = "exist";
              o3 = false;
            } else if (r4.matchToken("matches") || r4.matchToken("match")) {
              a4 = "match";
            } else if (r4.matchToken("contains") || r4.matchToken("contain")) {
              a4 = "contain";
            } else if (r4.matchToken("includes") || r4.matchToken("include")) {
              a4 = "include";
            } else if (r4.matchToken("do") || r4.matchToken("does")) {
              r4.requireToken("not");
              if (r4.matchToken("matches") || r4.matchToken("match")) {
                a4 = "not match";
              } else if (r4.matchToken("contains") || r4.matchToken("contain")) {
                a4 = "not contain";
              } else if (r4.matchToken("exist") || r4.matchToken("exist")) {
                a4 = "not exist";
                o3 = false;
              } else if (r4.matchToken("include")) {
                a4 = "not include";
              } else {
                e3.raiseParseError(r4, "Expected matches or contains");
              }
            }
          }
          if (a4) {
            var u4, l4, c4;
            if (s4) {
              u4 = r4.requireTokenType("IDENTIFIER");
              l4 = !r4.matchOpToken("!");
            } else if (o3) {
              c4 = e3.requireElement("mathExpression", r4);
              if (a4 === "match" || a4 === "not match") {
                c4 = c4.css ? c4.css : c4;
              }
            }
            var m3 = n3;
            n3 = { type: "comparisonOperator", operator: a4, typeName: u4, nullOk: l4, lhs: n3, rhs: c4, args: [n3, c4], op: function(e4, r5, n4) {
              if (a4 === "==") {
                return r5 == n4;
              } else if (a4 === "!=") {
                return r5 != n4;
              }
              if (a4 === "===") {
                return r5 === n4;
              } else if (a4 === "!==") {
                return r5 !== n4;
              }
              if (a4 === "match") {
                return r5 != null && p3(m3, r5, n4);
              }
              if (a4 === "not match") {
                return r5 == null || !p3(m3, r5, n4);
              }
              if (a4 === "in") {
                return n4 != null && f3(c4, n4, r5);
              }
              if (a4 === "not in") {
                return n4 == null || !f3(c4, n4, r5);
              }
              if (a4 === "contain") {
                return r5 != null && f3(m3, r5, n4);
              }
              if (a4 === "not contain") {
                return r5 == null || !f3(m3, r5, n4);
              }
              if (a4 === "include") {
                return r5 != null && f3(m3, r5, n4);
              }
              if (a4 === "not include") {
                return r5 == null || !f3(m3, r5, n4);
              }
              if (a4 === "===") {
                return r5 === n4;
              } else if (a4 === "!==") {
                return r5 !== n4;
              } else if (a4 === "<") {
                return r5 < n4;
              } else if (a4 === ">") {
                return r5 > n4;
              } else if (a4 === "<=") {
                return r5 <= n4;
              } else if (a4 === ">=") {
                return r5 >= n4;
              } else if (a4 === "empty") {
                return t4.isEmpty(r5);
              } else if (a4 === "not empty") {
                return !t4.isEmpty(r5);
              } else if (a4 === "exist") {
                return t4.doesExist(r5);
              } else if (a4 === "not exist") {
                return !t4.doesExist(r5);
              } else if (a4 === "a") {
                return t4.typeCheck(r5, u4.value, l4);
              } else if (a4 === "not a") {
                return !t4.typeCheck(r5, u4.value, l4);
              } else {
                throw "Unknown comparison : " + a4;
              }
            }, evaluate: function(e4) {
              return t4.unifiedEval(this, e4);
            } };
          }
          return n3;
        });
        t3.addGrammarElement("comparisonExpression", function(e3, t4, r4) {
          return e3.parseAnyOf(["comparisonOperator", "mathExpression"], r4);
        });
        t3.addGrammarElement("logicalOperator", function(e3, t4, r4) {
          var n3 = e3.parseElement("comparisonExpression", r4);
          var i3, a4 = null;
          i3 = r4.matchToken("and") || r4.matchToken("or");
          while (i3) {
            a4 = a4 || i3;
            if (a4.value !== i3.value) {
              e3.raiseParseError(r4, "You must parenthesize logical operations with different operators");
            }
            var o3 = e3.requireElement("comparisonExpression", r4);
            const s4 = i3.value;
            n3 = { type: "logicalOperator", operator: s4, lhs: n3, rhs: o3, args: [n3, o3], op: function(e4, t5, r5) {
              if (s4 === "and") {
                return t5 && r5;
              } else {
                return t5 || r5;
              }
            }, evaluate: function(e4) {
              return t4.unifiedEval(this, e4, s4 === "or");
            } };
            i3 = r4.matchToken("and") || r4.matchToken("or");
          }
          return n3;
        });
        t3.addGrammarElement("logicalExpression", function(e3, t4, r4) {
          return e3.parseAnyOf(["logicalOperator", "mathExpression"], r4);
        });
        t3.addGrammarElement("asyncExpression", function(e3, t4, r4) {
          if (r4.matchToken("async")) {
            var n3 = e3.requireElement("logicalExpression", r4);
            var i3 = { type: "asyncExpression", value: n3, evaluate: function(e4) {
              return { asyncWrapper: true, value: this.value.evaluate(e4) };
            } };
            return i3;
          } else {
            return e3.parseElement("logicalExpression", r4);
          }
        });
        t3.addGrammarElement("expression", function(e3, t4, r4) {
          r4.matchToken("the");
          return e3.parseElement("asyncExpression", r4);
        });
        t3.addGrammarElement("assignableExpression", function(e3, t4, r4) {
          r4.matchToken("the");
          var n3 = e3.parseElement("primaryExpression", r4);
          if (n3 && (n3.type === "symbol" || n3.type === "ofExpression" || n3.type === "propertyAccess" || n3.type === "attributeRefAccess" || n3.type === "attributeRef" || n3.type === "styleRef" || n3.type === "arrayIndex" || n3.type === "possessive")) {
            return n3;
          } else {
            e3.raiseParseError(r4, "A target expression must be writable.  The expression type '" + (n3 && n3.type) + "' is not.");
          }
          return n3;
        });
        t3.addGrammarElement("hyperscript", function(e3, t4, r4) {
          var n3 = [];
          if (r4.hasMore()) {
            while (e3.featureStart(r4.currentToken()) || r4.currentToken().value === "(") {
              var i3 = e3.requireElement("feature", r4);
              n3.push(i3);
              r4.matchToken("end");
            }
          }
          return { type: "hyperscript", features: n3, apply: function(e4, t5, r5) {
            for (const i4 of n3) {
              i4.install(e4, t5, r5);
            }
          } };
        });
        var v3 = function(e3) {
          var t4 = [];
          if (e3.token(0).value === "(" && (e3.token(1).value === ")" || e3.token(2).value === "," || e3.token(2).value === ")")) {
            e3.matchOpToken("(");
            do {
              t4.push(e3.requireTokenType("IDENTIFIER"));
            } while (e3.matchOpToken(","));
            e3.requireOpToken(")");
          }
          return t4;
        };
        t3.addFeature("on", function(e3, t4, r4) {
          if (!r4.matchToken("on")) return;
          var n3 = false;
          if (r4.matchToken("every")) {
            n3 = true;
          }
          var i3 = [];
          var a4 = null;
          do {
            var o3 = e3.requireElement("eventName", r4, "Expected event name");
            var s4 = o3.evaluate();
            if (a4) {
              a4 = a4 + " or " + s4;
            } else {
              a4 = "on " + s4;
            }
            var u4 = v3(r4);
            var l4 = null;
            if (r4.matchOpToken("[")) {
              l4 = e3.requireElement("expression", r4);
              r4.requireOpToken("]");
            }
            var c4, f4, m3;
            if (r4.currentToken().type === "NUMBER") {
              var p4 = r4.consumeToken();
              if (!p4.value) return;
              c4 = parseInt(p4.value);
              if (r4.matchToken("to")) {
                var h3 = r4.consumeToken();
                if (!h3.value) return;
                f4 = parseInt(h3.value);
              } else if (r4.matchToken("and")) {
                m3 = true;
                r4.requireToken("on");
              }
            }
            var d4, E3;
            if (s4 === "intersection") {
              d4 = {};
              if (r4.matchToken("with")) {
                d4["with"] = e3.requireElement("expression", r4).evaluate();
              }
              if (r4.matchToken("having")) {
                do {
                  if (r4.matchToken("margin")) {
                    d4["rootMargin"] = e3.requireElement("stringLike", r4).evaluate();
                  } else if (r4.matchToken("threshold")) {
                    d4["threshold"] = e3.requireElement("expression", r4).evaluate();
                  } else {
                    e3.raiseParseError(r4, "Unknown intersection config specification");
                  }
                } while (r4.matchToken("and"));
              }
            } else if (s4 === "mutation") {
              E3 = {};
              if (r4.matchToken("of")) {
                do {
                  if (r4.matchToken("anything")) {
                    E3["attributes"] = true;
                    E3["subtree"] = true;
                    E3["characterData"] = true;
                    E3["childList"] = true;
                  } else if (r4.matchToken("childList")) {
                    E3["childList"] = true;
                  } else if (r4.matchToken("attributes")) {
                    E3["attributes"] = true;
                    E3["attributeOldValue"] = true;
                  } else if (r4.matchToken("subtree")) {
                    E3["subtree"] = true;
                  } else if (r4.matchToken("characterData")) {
                    E3["characterData"] = true;
                    E3["characterDataOldValue"] = true;
                  } else if (r4.currentToken().type === "ATTRIBUTE_REF") {
                    var T4 = r4.consumeToken();
                    if (E3["attributeFilter"] == null) {
                      E3["attributeFilter"] = [];
                    }
                    if (T4.value.indexOf("@") == 0) {
                      E3["attributeFilter"].push(T4.value.substring(1));
                    } else {
                      e3.raiseParseError(r4, "Only shorthand attribute references are allowed here");
                    }
                  } else {
                    e3.raiseParseError(r4, "Unknown mutation config specification");
                  }
                } while (r4.matchToken("or"));
              } else {
                E3["attributes"] = true;
                E3["characterData"] = true;
                E3["childList"] = true;
              }
            }
            var y4 = null;
            var k4 = false;
            if (r4.matchToken("from")) {
              if (r4.matchToken("elsewhere")) {
                k4 = true;
              } else {
                r4.pushFollow("or");
                try {
                  y4 = e3.requireElement("expression", r4);
                } finally {
                  r4.popFollow();
                }
                if (!y4) {
                  e3.raiseParseError(r4, 'Expected either target value or "elsewhere".');
                }
              }
            }
            if (y4 === null && k4 === false && r4.matchToken("elsewhere")) {
              k4 = true;
            }
            if (r4.matchToken("in")) {
              var x4 = e3.parseElement("unaryExpression", r4);
            }
            if (r4.matchToken("debounced")) {
              r4.requireToken("at");
              var g5 = e3.requireElement("unaryExpression", r4);
              var b4 = g5.evaluate({});
            } else if (r4.matchToken("throttled")) {
              r4.requireToken("at");
              var g5 = e3.requireElement("unaryExpression", r4);
              var w4 = g5.evaluate({});
            }
            i3.push({ execCount: 0, every: n3, on: s4, args: u4, filter: l4, from: y4, inExpr: x4, elsewhere: k4, startCount: c4, endCount: f4, unbounded: m3, debounceTime: b4, throttleTime: w4, mutationSpec: E3, intersectionSpec: d4, debounced: void 0, lastExec: void 0 });
          } while (r4.matchToken("or"));
          var S4 = true;
          if (!n3) {
            if (r4.matchToken("queue")) {
              if (r4.matchToken("all")) {
                var N2 = true;
                var S4 = false;
              } else if (r4.matchToken("first")) {
                var q2 = true;
              } else if (r4.matchToken("none")) {
                var I2 = true;
              } else {
                r4.requireToken("last");
              }
            }
          }
          var C2 = e3.requireElement("commandList", r4);
          e3.ensureTerminated(C2);
          var R2, A2;
          if (r4.matchToken("catch")) {
            R2 = r4.requireTokenType("IDENTIFIER").value;
            A2 = e3.requireElement("commandList", r4);
            e3.ensureTerminated(A2);
          }
          if (r4.matchToken("finally")) {
            var L2 = e3.requireElement("commandList", r4);
            e3.ensureTerminated(L2);
          }
          var O2 = { displayName: a4, events: i3, start: C2, every: n3, execCount: 0, errorHandler: A2, errorSymbol: R2, execute: function(e4) {
            let r5 = t4.getEventQueueFor(e4.me, O2);
            if (r5.executing && n3 === false) {
              if (I2 || q2 && r5.queue.length > 0) {
                return;
              }
              if (S4) {
                r5.queue.length = 0;
              }
              r5.queue.push(e4);
              return;
            }
            O2.execCount++;
            r5.executing = true;
            e4.meta.onHalt = function() {
              r5.executing = false;
              var e5 = r5.queue.shift();
              if (e5) {
                setTimeout(function() {
                  O2.execute(e5);
                }, 1);
              }
            };
            e4.meta.reject = function(r6) {
              console.error(r6.message ? r6.message : r6);
              var n4 = t4.getHyperTrace(e4, r6);
              if (n4) {
                n4.print();
              }
              t4.triggerEvent(e4.me, "exception", { error: r6 });
            };
            C2.execute(e4);
          }, install: function(e4, r5) {
            for (const r6 of O2.events) {
              var n4;
              if (r6.elsewhere) {
                n4 = [document];
              } else if (r6.from) {
                n4 = r6.from.evaluate(t4.makeContext(e4, O2, e4, null));
              } else {
                n4 = [e4];
              }
              t4.implicitLoop(n4, function(n5) {
                var i4 = r6.on;
                if (n5 == null) {
                  console.warn("'%s' feature ignored because target does not exists:", a4, e4);
                  return;
                }
                if (r6.mutationSpec) {
                  i4 = "hyperscript:mutation";
                  const e5 = new MutationObserver(function(e6, r7) {
                    if (!O2.executing) {
                      t4.triggerEvent(n5, i4, { mutationList: e6, observer: r7 });
                    }
                  });
                  e5.observe(n5, r6.mutationSpec);
                }
                if (r6.intersectionSpec) {
                  i4 = "hyperscript:intersection";
                  const e5 = new IntersectionObserver(function(r7) {
                    for (const o5 of r7) {
                      var a5 = { observer: e5 };
                      a5 = Object.assign(a5, o5);
                      a5["intersecting"] = o5.isIntersecting;
                      t4.triggerEvent(n5, i4, a5);
                    }
                  }, r6.intersectionSpec);
                  e5.observe(n5);
                }
                var o4 = n5.addEventListener || n5.on;
                o4.call(n5, i4, function a5(o5) {
                  if (typeof Node !== "undefined" && e4 instanceof Node && n5 !== e4 && !e4.isConnected) {
                    n5.removeEventListener(i4, a5);
                    return;
                  }
                  var s5 = t4.makeContext(e4, O2, e4, o5);
                  if (r6.elsewhere && e4.contains(o5.target)) {
                    return;
                  }
                  if (r6.from) {
                    s5.result = n5;
                  }
                  for (const e5 of r6.args) {
                    let t5 = s5.event[e5.value];
                    if (t5 !== void 0) {
                      s5.locals[e5.value] = t5;
                    } else if ("detail" in s5.event) {
                      s5.locals[e5.value] = s5.event["detail"][e5.value];
                    }
                  }
                  s5.meta.errorHandler = A2;
                  s5.meta.errorSymbol = R2;
                  s5.meta.finallyHandler = L2;
                  if (r6.filter) {
                    var u5 = s5.meta.context;
                    s5.meta.context = s5.event;
                    try {
                      var l5 = r6.filter.evaluate(s5);
                      if (l5) {
                      } else {
                        return;
                      }
                    } finally {
                      s5.meta.context = u5;
                    }
                  }
                  if (r6.inExpr) {
                    var c5 = o5.target;
                    while (true) {
                      if (c5.matches && c5.matches(r6.inExpr.css)) {
                        s5.result = c5;
                        break;
                      } else {
                        c5 = c5.parentElement;
                        if (c5 == null) {
                          return;
                        }
                      }
                    }
                  }
                  r6.execCount++;
                  if (r6.startCount) {
                    if (r6.endCount) {
                      if (r6.execCount < r6.startCount || r6.execCount > r6.endCount) {
                        return;
                      }
                    } else if (r6.unbounded) {
                      if (r6.execCount < r6.startCount) {
                        return;
                      }
                    } else if (r6.execCount !== r6.startCount) {
                      return;
                    }
                  }
                  if (r6.debounceTime) {
                    if (r6.debounced) {
                      clearTimeout(r6.debounced);
                    }
                    r6.debounced = setTimeout(function() {
                      O2.execute(s5);
                    }, r6.debounceTime);
                    return;
                  }
                  if (r6.throttleTime) {
                    if (r6.lastExec && Date.now() < r6.lastExec + r6.throttleTime) {
                      return;
                    } else {
                      r6.lastExec = Date.now();
                    }
                  }
                  O2.execute(s5);
                });
              });
            }
          } };
          e3.setParent(C2, O2);
          return O2;
        });
        t3.addFeature("def", function(e3, t4, r4) {
          if (!r4.matchToken("def")) return;
          var n3 = e3.requireElement("dotOrColonPath", r4);
          var i3 = n3.evaluate();
          var a4 = i3.split(".");
          var o3 = a4.pop();
          var s4 = [];
          if (r4.matchOpToken("(")) {
            if (r4.matchOpToken(")")) {
            } else {
              do {
                s4.push(r4.requireTokenType("IDENTIFIER"));
              } while (r4.matchOpToken(","));
              r4.requireOpToken(")");
            }
          }
          var u4 = e3.requireElement("commandList", r4);
          var l4, c4;
          if (r4.matchToken("catch")) {
            l4 = r4.requireTokenType("IDENTIFIER").value;
            c4 = e3.parseElement("commandList", r4);
          }
          if (r4.matchToken("finally")) {
            var f4 = e3.requireElement("commandList", r4);
            e3.ensureTerminated(f4);
          }
          var m3 = { displayName: o3 + "(" + s4.map(function(e4) {
            return e4.value;
          }).join(", ") + ")", name: o3, args: s4, start: u4, errorHandler: c4, errorSymbol: l4, finallyHandler: f4, install: function(e4, r5) {
            var n4 = function() {
              var n5 = t4.makeContext(r5, m3, e4, null);
              n5.meta.errorHandler = c4;
              n5.meta.errorSymbol = l4;
              n5.meta.finallyHandler = f4;
              for (var i4 = 0; i4 < s4.length; i4++) {
                var a5 = s4[i4];
                var o4 = arguments[i4];
                if (a5) {
                  n5.locals[a5.value] = o4;
                }
              }
              n5.meta.caller = arguments[s4.length];
              if (n5.meta.caller) {
                n5.meta.callingCommand = n5.meta.caller.meta.command;
              }
              var p4, h3 = null;
              var v4 = new Promise(function(e5, t5) {
                p4 = e5;
                h3 = t5;
              });
              u4.execute(n5);
              if (n5.meta.returned) {
                return n5.meta.returnValue;
              } else {
                n5.meta.resolve = p4;
                n5.meta.reject = h3;
                return v4;
              }
            };
            n4.hyperfunc = true;
            n4.hypername = i3;
            t4.assignToNamespace(e4, a4, o3, n4);
          } };
          e3.ensureTerminated(u4);
          if (c4) {
            e3.ensureTerminated(c4);
          }
          e3.setParent(u4, m3);
          return m3;
        });
        t3.addFeature("set", function(e3, t4, r4) {
          let n3 = e3.parseElement("setCommand", r4);
          if (n3) {
            if (n3.target.scope !== "element") {
              e3.raiseParseError(r4, "variables declared at the feature level must be element scoped.");
            }
            let i3 = { start: n3, install: function(e4, r5) {
              n3 && n3.execute(t4.makeContext(e4, i3, e4, null));
            } };
            e3.ensureTerminated(n3);
            return i3;
          }
        });
        t3.addFeature("init", function(e3, t4, r4) {
          if (!r4.matchToken("init")) return;
          var n3 = r4.matchToken("immediately");
          var i3 = e3.requireElement("commandList", r4);
          var a4 = { start: i3, install: function(e4, r5) {
            let o3 = function() {
              i3 && i3.execute(t4.makeContext(e4, a4, e4, null));
            };
            if (n3) {
              o3();
            } else {
              setTimeout(o3, 0);
            }
          } };
          e3.ensureTerminated(i3);
          e3.setParent(i3, a4);
          return a4;
        });
        t3.addFeature("worker", function(e3, t4, r4) {
          if (r4.matchToken("worker")) {
            e3.raiseParseError(r4, "In order to use the 'worker' feature, include the _hyperscript worker plugin. See https://hyperscript.org/features/worker/ for more info.");
            return void 0;
          }
        });
        t3.addFeature("behavior", function(t4, r4, n3) {
          if (!n3.matchToken("behavior")) return;
          var i3 = t4.requireElement("dotOrColonPath", n3).evaluate();
          var a4 = i3.split(".");
          var o3 = a4.pop();
          var s4 = [];
          if (n3.matchOpToken("(") && !n3.matchOpToken(")")) {
            do {
              s4.push(n3.requireTokenType("IDENTIFIER").value);
            } while (n3.matchOpToken(","));
            n3.requireOpToken(")");
          }
          var u4 = t4.requireElement("hyperscript", n3);
          for (var l4 = 0; l4 < u4.features.length; l4++) {
            var c4 = u4.features[l4];
            c4.behavior = i3;
          }
          return { install: function(t5, n4) {
            r4.assignToNamespace(e2.document && e2.document.body, a4, o3, function(e3, t6, n5) {
              var a5 = r4.getInternalData(e3);
              var o4 = h2(a5, i3 + "Scope");
              for (var l5 = 0; l5 < s4.length; l5++) {
                o4[s4[l5]] = n5[s4[l5]];
              }
              u4.apply(e3, t6);
            });
          } };
        });
        t3.addFeature("install", function(t4, r4, n3) {
          if (!n3.matchToken("install")) return;
          var i3 = t4.requireElement("dotOrColonPath", n3).evaluate();
          var a4 = i3.split(".");
          var o3 = t4.parseElement("namedArgumentList", n3);
          var s4;
          return s4 = { install: function(t5, n4) {
            r4.unifiedEval({ args: [o3], op: function(r5, o4) {
              var s5 = e2;
              for (var u4 = 0; u4 < a4.length; u4++) {
                s5 = s5[a4[u4]];
                if (typeof s5 !== "object" && typeof s5 !== "function") throw new Error("No such behavior defined as " + i3);
              }
              if (!(s5 instanceof Function)) throw new Error(i3 + " is not a behavior");
              s5(t5, n4, o4);
            } }, r4.makeContext(t5, s4, t5, null));
          } };
        });
        t3.addGrammarElement("jsBody", function(e3, t4, r4) {
          var n3 = r4.currentToken().start;
          var i3 = r4.currentToken();
          var a4 = [];
          var o3 = "";
          var s4 = false;
          while (r4.hasMore()) {
            i3 = r4.consumeToken();
            var u4 = r4.token(0, true);
            if (u4.type === "IDENTIFIER" && u4.value === "end") {
              break;
            }
            if (s4) {
              if (i3.type === "IDENTIFIER" || i3.type === "NUMBER") {
                o3 += i3.value;
              } else {
                if (o3 !== "") a4.push(o3);
                o3 = "";
                s4 = false;
              }
            } else if (i3.type === "IDENTIFIER" && i3.value === "function") {
              s4 = true;
            }
          }
          var l4 = i3.end + 1;
          return { type: "jsBody", exposedFunctionNames: a4, jsSource: r4.source.substring(n3, l4) };
        });
        t3.addFeature("js", function(t4, r4, n3) {
          if (!n3.matchToken("js")) return;
          var i3 = t4.requireElement("jsBody", n3);
          var a4 = i3.jsSource + "\nreturn { " + i3.exposedFunctionNames.map(function(e3) {
            return e3 + ":" + e3;
          }).join(",") + " } ";
          var o3 = new Function(a4);
          return { jsSource: a4, function: o3, exposedFunctionNames: i3.exposedFunctionNames, install: function() {
            Object.assign(e2, o3());
          } };
        });
        t3.addCommand("js", function(t4, r4, n3) {
          if (!n3.matchToken("js")) return;
          var i3 = [];
          if (n3.matchOpToken("(")) {
            if (n3.matchOpToken(")")) {
            } else {
              do {
                var a4 = n3.requireTokenType("IDENTIFIER");
                i3.push(a4.value);
              } while (n3.matchOpToken(","));
              n3.requireOpToken(")");
            }
          }
          var o3 = t4.requireElement("jsBody", n3);
          n3.matchToken("end");
          var s4 = E2(Function, i3.concat([o3.jsSource]));
          var u4 = { jsSource: o3.jsSource, function: s4, inputs: i3, op: function(t5) {
            var n4 = [];
            i3.forEach(function(e3) {
              n4.push(r4.resolveSymbol(e3, t5, "default"));
            });
            var a5 = s4.apply(e2, n4);
            if (a5 && typeof a5.then === "function") {
              return new Promise(function(e3) {
                a5.then(function(n5) {
                  t5.result = n5;
                  e3(r4.findNext(this, t5));
                });
              });
            } else {
              t5.result = a5;
              return r4.findNext(this, t5);
            }
          } };
          return u4;
        });
        t3.addCommand("async", function(e3, t4, r4) {
          if (!r4.matchToken("async")) return;
          if (r4.matchToken("do")) {
            var n3 = e3.requireElement("commandList", r4);
            var i3 = n3;
            while (i3.next) i3 = i3.next;
            i3.next = t4.HALT;
            r4.requireToken("end");
          } else {
            var n3 = e3.requireElement("command", r4);
          }
          var a4 = { body: n3, op: function(e4) {
            setTimeout(function() {
              n3.execute(e4);
            });
            return t4.findNext(this, e4);
          } };
          e3.setParent(n3, a4);
          return a4;
        });
        t3.addCommand("tell", function(e3, t4, r4) {
          var n3 = r4.currentToken();
          if (!r4.matchToken("tell")) return;
          var i3 = e3.requireElement("expression", r4);
          var a4 = e3.requireElement("commandList", r4);
          if (r4.hasMore() && !e3.featureStart(r4.currentToken())) {
            r4.requireToken("end");
          }
          var o3 = "tell_" + n3.start;
          var s4 = { value: i3, body: a4, args: [i3], resolveNext: function(e4) {
            var r5 = e4.meta.iterators[o3];
            if (r5.index < r5.value.length) {
              e4.you = r5.value[r5.index++];
              return a4;
            } else {
              e4.you = r5.originalYou;
              if (this.next) {
                return this.next;
              } else {
                return t4.findNext(this.parent, e4);
              }
            }
          }, op: function(e4, t5) {
            if (t5 == null) {
              t5 = [];
            } else if (!(Array.isArray(t5) || t5 instanceof NodeList)) {
              t5 = [t5];
            }
            e4.meta.iterators[o3] = { originalYou: e4.you, index: 0, value: t5 };
            return this.resolveNext(e4);
          } };
          e3.setParent(a4, s4);
          return s4;
        });
        t3.addCommand("wait", function(e3, t4, r4) {
          if (!r4.matchToken("wait")) return;
          var n3;
          if (r4.matchToken("for")) {
            r4.matchToken("a");
            var i3 = [];
            do {
              var a4 = r4.token(0);
              if (a4.type === "NUMBER" || a4.type === "L_PAREN") {
                i3.push({ time: e3.requireElement("expression", r4).evaluate() });
              } else {
                i3.push({ name: e3.requireElement("dotOrColonPath", r4, "Expected event name").evaluate(), args: v3(r4) });
              }
            } while (r4.matchToken("or"));
            if (r4.matchToken("from")) {
              var o3 = e3.requireElement("expression", r4);
            }
            n3 = { event: i3, on: o3, args: [o3], op: function(e4, r5) {
              var n4 = r5 ? r5 : e4.me;
              if (!(n4 instanceof EventTarget)) throw new Error("Not a valid event target: " + this.on.sourceFor());
              return new Promise((r6) => {
                var a5 = false;
                for (const s5 of i3) {
                  var o4 = (n5) => {
                    e4.result = n5;
                    if (s5.args) {
                      for (const t5 of s5.args) {
                        e4.locals[t5.value] = n5[t5.value] || (n5.detail ? n5.detail[t5.value] : null);
                      }
                    }
                    if (!a5) {
                      a5 = true;
                      r6(t4.findNext(this, e4));
                    }
                  };
                  if (s5.name) {
                    n4.addEventListener(s5.name, o4, { once: true });
                  } else if (s5.time != null) {
                    setTimeout(o4, s5.time, s5.time);
                  }
                }
              });
            } };
            return n3;
          } else {
            var s4;
            if (r4.matchToken("a")) {
              r4.requireToken("tick");
              s4 = 0;
            } else {
              s4 = e3.requireElement("expression", r4);
            }
            n3 = { type: "waitCmd", time: s4, args: [s4], op: function(e4, r5) {
              return new Promise((n4) => {
                setTimeout(() => {
                  n4(t4.findNext(this, e4));
                }, r5);
              });
            }, execute: function(e4) {
              return t4.unifiedExec(this, e4);
            } };
            return n3;
          }
        });
        t3.addGrammarElement("dotOrColonPath", function(e3, t4, r4) {
          var n3 = r4.matchTokenType("IDENTIFIER");
          if (n3) {
            var i3 = [n3.value];
            var a4 = r4.matchOpToken(".") || r4.matchOpToken(":");
            if (a4) {
              do {
                i3.push(r4.requireTokenType("IDENTIFIER", "NUMBER").value);
              } while (r4.matchOpToken(a4.value));
            }
            return { type: "dotOrColonPath", path: i3, evaluate: function() {
              return i3.join(a4 ? a4.value : "");
            } };
          }
        });
        t3.addGrammarElement("eventName", function(e3, t4, r4) {
          var n3;
          if (n3 = r4.matchTokenType("STRING")) {
            return { evaluate: function() {
              return n3.value;
            } };
          }
          return e3.parseElement("dotOrColonPath", r4);
        });
        function d3(e3, t4, r4, n3) {
          var i3 = t4.requireElement("eventName", n3);
          var a4 = t4.parseElement("namedArgumentList", n3);
          if (e3 === "send" && n3.matchToken("to") || e3 === "trigger" && n3.matchToken("on")) {
            var o3 = t4.requireElement("expression", n3);
          } else {
            var o3 = t4.requireElement("implicitMeTarget", n3);
          }
          var s4 = { eventName: i3, details: a4, to: o3, args: [o3, i3, a4], op: function(e4, t5, n4, i4) {
            r4.nullCheck(t5, o3);
            r4.implicitLoop(t5, function(t6) {
              r4.triggerEvent(t6, n4, i4, e4.me);
            });
            return r4.findNext(s4, e4);
          } };
          return s4;
        }
        t3.addCommand("trigger", function(e3, t4, r4) {
          if (r4.matchToken("trigger")) {
            return d3("trigger", e3, t4, r4);
          }
        });
        t3.addCommand("send", function(e3, t4, r4) {
          if (r4.matchToken("send")) {
            return d3("send", e3, t4, r4);
          }
        });
        var T3 = function(e3, t4, r4, n3) {
          if (n3) {
            if (e3.commandBoundary(r4.currentToken())) {
              e3.raiseParseError(r4, "'return' commands must return a value.  If you do not wish to return a value, use 'exit' instead.");
            } else {
              var i3 = e3.requireElement("expression", r4);
            }
          }
          var a4 = { value: i3, args: [i3], op: function(e4, r5) {
            var n4 = e4.meta.resolve;
            e4.meta.returned = true;
            e4.meta.returnValue = r5;
            if (n4) {
              if (r5) {
                n4(r5);
              } else {
                n4();
              }
            }
            return t4.HALT;
          } };
          return a4;
        };
        t3.addCommand("return", function(e3, t4, r4) {
          if (r4.matchToken("return")) {
            return T3(e3, t4, r4, true);
          }
        });
        t3.addCommand("exit", function(e3, t4, r4) {
          if (r4.matchToken("exit")) {
            return T3(e3, t4, r4, false);
          }
        });
        t3.addCommand("halt", function(e3, t4, r4) {
          if (r4.matchToken("halt")) {
            if (r4.matchToken("the")) {
              r4.requireToken("event");
              if (r4.matchOpToken("'")) {
                r4.requireToken("s");
              }
              var n3 = true;
            }
            if (r4.matchToken("bubbling")) {
              var i3 = true;
            } else if (r4.matchToken("default")) {
              var a4 = true;
            }
            var o3 = T3(e3, t4, r4, false);
            var s4 = { keepExecuting: true, bubbling: i3, haltDefault: a4, exit: o3, op: function(e4) {
              if (e4.event) {
                if (i3) {
                  e4.event.stopPropagation();
                } else if (a4) {
                  e4.event.preventDefault();
                } else {
                  e4.event.stopPropagation();
                  e4.event.preventDefault();
                }
                if (n3) {
                  return t4.findNext(this, e4);
                } else {
                  return o3;
                }
              }
            } };
            return s4;
          }
        });
        t3.addCommand("log", function(e3, t4, r4) {
          if (!r4.matchToken("log")) return;
          var n3 = [e3.parseElement("expression", r4)];
          while (r4.matchOpToken(",")) {
            n3.push(e3.requireElement("expression", r4));
          }
          if (r4.matchToken("with")) {
            var i3 = e3.requireElement("expression", r4);
          }
          var a4 = { exprs: n3, withExpr: i3, args: [i3, n3], op: function(e4, r5, n4) {
            if (r5) {
              r5.apply(null, n4);
            } else {
              console.log.apply(null, n4);
            }
            return t4.findNext(this, e4);
          } };
          return a4;
        });
        t3.addCommand("beep!", function(e3, t4, r4) {
          if (!r4.matchToken("beep!")) return;
          var n3 = [e3.parseElement("expression", r4)];
          while (r4.matchOpToken(",")) {
            n3.push(e3.requireElement("expression", r4));
          }
          var i3 = { exprs: n3, args: [n3], op: function(e4, r5) {
            for (let i4 = 0; i4 < n3.length; i4++) {
              const a4 = n3[i4];
              const o3 = r5[i4];
              t4.beepValueToConsole(e4.me, a4, o3);
            }
            return t4.findNext(this, e4);
          } };
          return i3;
        });
        t3.addCommand("throw", function(e3, t4, r4) {
          if (!r4.matchToken("throw")) return;
          var n3 = e3.requireElement("expression", r4);
          var i3 = { expr: n3, args: [n3], op: function(e4, r5) {
            t4.registerHyperTrace(e4, r5);
            throw r5;
          } };
          return i3;
        });
        var y3 = function(e3, t4, r4) {
          var n3 = e3.requireElement("expression", r4);
          var i3 = { expr: n3, args: [n3], op: function(e4, r5) {
            e4.result = r5;
            return t4.findNext(i3, e4);
          } };
          return i3;
        };
        t3.addCommand("call", function(e3, t4, r4) {
          if (!r4.matchToken("call")) return;
          var n3 = y3(e3, t4, r4);
          if (n3.expr && n3.expr.type !== "functionCall") {
            e3.raiseParseError(r4, "Must be a function invocation");
          }
          return n3;
        });
        t3.addCommand("get", function(e3, t4, r4) {
          if (r4.matchToken("get")) {
            return y3(e3, t4, r4);
          }
        });
        t3.addCommand("make", function(e3, t4, r4) {
          if (!r4.matchToken("make")) return;
          r4.matchToken("a") || r4.matchToken("an");
          var n3 = e3.requireElement("expression", r4);
          var i3 = [];
          if (n3.type !== "queryRef" && r4.matchToken("from")) {
            do {
              i3.push(e3.requireElement("expression", r4));
            } while (r4.matchOpToken(","));
          }
          if (r4.matchToken("called")) {
            var a4 = e3.requireElement("symbol", r4);
          }
          var o3;
          if (n3.type === "queryRef") {
            o3 = { op: function(e4) {
              var r5, i4 = "div", o4, s4 = [];
              var u4 = /(?:(^|#|\.)([^#\. ]+))/g;
              while (r5 = u4.exec(n3.css)) {
                if (r5[1] === "") i4 = r5[2].trim();
                else if (r5[1] === "#") o4 = r5[2].trim();
                else s4.push(r5[2].trim());
              }
              var l4 = document.createElement(i4);
              if (o4 !== void 0) l4.id = o4;
              for (var c4 = 0; c4 < s4.length; c4++) {
                var f4 = s4[c4];
                l4.classList.add(f4);
              }
              e4.result = l4;
              if (a4) {
                t4.setSymbol(a4.name, e4, a4.scope, l4);
              }
              return t4.findNext(this, e4);
            } };
            return o3;
          } else {
            o3 = { args: [n3, i3], op: function(e4, r5, n4) {
              e4.result = E2(r5, n4);
              if (a4) {
                t4.setSymbol(a4.name, e4, a4.scope, e4.result);
              }
              return t4.findNext(this, e4);
            } };
            return o3;
          }
        });
        t3.addGrammarElement("pseudoCommand", function(e3, t4, r4) {
          let n3 = r4.token(1);
          if (!(n3 && n3.op && (n3.value === "." || n3.value === "("))) {
            return null;
          }
          var i3 = e3.requireElement("primaryExpression", r4);
          var a4 = i3.root;
          var o3 = i3;
          while (a4.root != null) {
            o3 = o3.root;
            a4 = a4.root;
          }
          if (i3.type !== "functionCall") {
            e3.raiseParseError(r4, "Pseudo-commands must be function calls");
          }
          if (o3.type === "functionCall" && o3.root.root == null) {
            if (r4.matchAnyToken("the", "to", "on", "with", "into", "from", "at")) {
              var s4 = e3.requireElement("expression", r4);
            } else if (r4.matchToken("me")) {
              var s4 = e3.requireElement("implicitMeTarget", r4);
            }
          }
          var u4;
          if (s4) {
            u4 = { type: "pseudoCommand", root: s4, argExressions: o3.argExressions, args: [s4, o3.argExressions], op: function(e4, r5, n4) {
              t4.nullCheck(r5, s4);
              var i4 = r5[o3.root.name];
              t4.nullCheck(i4, o3);
              if (i4.hyperfunc) {
                n4.push(e4);
              }
              e4.result = i4.apply(r5, n4);
              return t4.findNext(u4, e4);
            }, execute: function(e4) {
              return t4.unifiedExec(this, e4);
            } };
          } else {
            u4 = { type: "pseudoCommand", expr: i3, args: [i3], op: function(e4, r5) {
              e4.result = r5;
              return t4.findNext(u4, e4);
            }, execute: function(e4) {
              return t4.unifiedExec(this, e4);
            } };
          }
          return u4;
        });
        var k3 = function(e3, t4, r4, n3, i3) {
          var a4 = n3.type === "symbol";
          var o3 = n3.type === "attributeRef";
          var s4 = n3.type === "styleRef";
          var u4 = n3.type === "arrayIndex";
          if (!(o3 || s4 || a4) && n3.root == null) {
            e3.raiseParseError(r4, "Can only put directly into symbols, not references");
          }
          var l4 = null;
          var c4 = null;
          if (a4) {
          } else if (o3 || s4) {
            l4 = e3.requireElement("implicitMeTarget", r4);
            var f4 = n3;
          } else if (u4) {
            c4 = n3.firstIndex;
            l4 = n3.root;
          } else {
            c4 = n3.prop ? n3.prop.value : null;
            var f4 = n3.attribute;
            l4 = n3.root;
          }
          var m3 = { target: n3, symbolWrite: a4, value: i3, args: [l4, c4, i3], op: function(e4, r5, i4, o4) {
            if (a4) {
              t4.setSymbol(n3.name, e4, n3.scope, o4);
            } else {
              t4.nullCheck(r5, l4);
              if (u4) {
                r5[i4] = o4;
              } else {
                t4.implicitLoop(r5, function(e5) {
                  if (f4) {
                    if (f4.type === "attributeRef") {
                      if (o4 == null) {
                        e5.removeAttribute(f4.name);
                      } else {
                        e5.setAttribute(f4.name, o4);
                      }
                    } else {
                      e5.style[f4.name] = o4;
                    }
                  } else {
                    e5[i4] = o4;
                  }
                });
              }
            }
            return t4.findNext(this, e4);
          } };
          return m3;
        };
        t3.addCommand("default", function(e3, t4, r4) {
          if (!r4.matchToken("default")) return;
          var n3 = e3.requireElement("assignableExpression", r4);
          r4.requireToken("to");
          var i3 = e3.requireElement("expression", r4);
          var a4 = k3(e3, t4, r4, n3, i3);
          var o3 = { target: n3, value: i3, setter: a4, args: [n3], op: function(e4, r5) {
            if (r5) {
              return t4.findNext(this, e4);
            } else {
              return a4;
            }
          } };
          a4.parent = o3;
          return o3;
        });
        t3.addCommand("set", function(e3, t4, r4) {
          if (!r4.matchToken("set")) return;
          if (r4.currentToken().type === "L_BRACE") {
            var n3 = e3.requireElement("objectLiteral", r4);
            r4.requireToken("on");
            var i3 = e3.requireElement("expression", r4);
            var a4 = { objectLiteral: n3, target: i3, args: [n3, i3], op: function(e4, r5, n4) {
              Object.assign(n4, r5);
              return t4.findNext(this, e4);
            } };
            return a4;
          }
          try {
            r4.pushFollow("to");
            var i3 = e3.requireElement("assignableExpression", r4);
          } finally {
            r4.popFollow();
          }
          r4.requireToken("to");
          var o3 = e3.requireElement("expression", r4);
          return k3(e3, t4, r4, i3, o3);
        });
        t3.addCommand("if", function(e3, t4, r4) {
          if (!r4.matchToken("if")) return;
          var n3 = e3.requireElement("expression", r4);
          r4.matchToken("then");
          var i3 = e3.parseElement("commandList", r4);
          var a4 = false;
          let o3 = r4.matchToken("else") || r4.matchToken("otherwise");
          if (o3) {
            let t5 = r4.peekToken("if");
            a4 = t5 != null && t5.line === o3.line;
            if (a4) {
              var s4 = e3.parseElement("command", r4);
            } else {
              var s4 = e3.parseElement("commandList", r4);
            }
          }
          if (r4.hasMore() && !a4) {
            r4.requireToken("end");
          }
          var u4 = { expr: n3, trueBranch: i3, falseBranch: s4, args: [n3], op: function(e4, r5) {
            if (r5) {
              return i3;
            } else if (s4) {
              return s4;
            } else {
              return t4.findNext(this, e4);
            }
          } };
          e3.setParent(i3, u4);
          e3.setParent(s4, u4);
          return u4;
        });
        var x3 = function(e3, t4, r4, n3) {
          var i3 = t4.currentToken();
          var a4;
          if (t4.matchToken("for") || n3) {
            var o3 = t4.requireTokenType("IDENTIFIER");
            a4 = o3.value;
            t4.requireToken("in");
            var s4 = e3.requireElement("expression", t4);
          } else if (t4.matchToken("in")) {
            a4 = "it";
            var s4 = e3.requireElement("expression", t4);
          } else if (t4.matchToken("while")) {
            var u4 = e3.requireElement("expression", t4);
          } else if (t4.matchToken("until")) {
            var l4 = true;
            if (t4.matchToken("event")) {
              var c4 = e3.requireElement("dotOrColonPath", t4, "Expected event name");
              if (t4.matchToken("from")) {
                var f4 = e3.requireElement("expression", t4);
              }
            } else {
              var u4 = e3.requireElement("expression", t4);
            }
          } else {
            if (!e3.commandBoundary(t4.currentToken()) && t4.currentToken().value !== "forever") {
              var m3 = e3.requireElement("expression", t4);
              t4.requireToken("times");
            } else {
              t4.matchToken("forever");
              var p4 = true;
            }
          }
          if (t4.matchToken("index")) {
            var o3 = t4.requireTokenType("IDENTIFIER");
            var h3 = o3.value;
          } else if (t4.matchToken("indexed")) {
            t4.requireToken("by");
            var o3 = t4.requireTokenType("IDENTIFIER");
            var h3 = o3.value;
          }
          var v4 = e3.parseElement("commandList", t4);
          if (v4 && c4) {
            var d4 = v4;
            while (d4.next) {
              d4 = d4.next;
            }
            var E3 = { type: "waitATick", op: function() {
              return new Promise(function(e4) {
                setTimeout(function() {
                  e4(r4.findNext(E3));
                }, 0);
              });
            } };
            d4.next = E3;
          }
          if (t4.hasMore()) {
            t4.requireToken("end");
          }
          if (a4 == null) {
            a4 = "_implicit_repeat_" + i3.start;
            var T4 = a4;
          } else {
            var T4 = a4 + "_" + i3.start;
          }
          var y4 = { identifier: a4, indexIdentifier: h3, slot: T4, expression: s4, forever: p4, times: m3, until: l4, event: c4, on: f4, whileExpr: u4, resolveNext: function() {
            return this;
          }, loop: v4, args: [u4, m3], op: function(e4, t5, n4) {
            var i4 = e4.meta.iterators[T4];
            var o4 = false;
            var s5 = null;
            if (this.forever) {
              o4 = true;
            } else if (this.until) {
              if (c4) {
                o4 = e4.meta.iterators[T4].eventFired === false;
              } else {
                o4 = t5 !== true;
              }
            } else if (u4) {
              o4 = t5;
            } else if (n4) {
              o4 = i4.index < n4;
            } else {
              var l5 = i4.iterator.next();
              o4 = !l5.done;
              s5 = l5.value;
            }
            if (o4) {
              if (i4.value) {
                e4.result = e4.locals[a4] = s5;
              } else {
                e4.result = i4.index;
              }
              if (h3) {
                e4.locals[h3] = i4.index;
              }
              i4.index++;
              return v4;
            } else {
              e4.meta.iterators[T4] = null;
              return r4.findNext(this.parent, e4);
            }
          } };
          e3.setParent(v4, y4);
          var k4 = { name: "repeatInit", args: [s4, c4, f4], op: function(e4, t5, r5, n4) {
            var i4 = { index: 0, value: t5, eventFired: false };
            e4.meta.iterators[T4] = i4;
            if (t5 && t5[Symbol.iterator]) {
              i4.iterator = t5[Symbol.iterator]();
            }
            if (c4) {
              var a5 = n4 || e4.me;
              a5.addEventListener(r5, function(t6) {
                e4.meta.iterators[T4].eventFired = true;
              }, { once: true });
            }
            return y4;
          }, execute: function(e4) {
            return r4.unifiedExec(this, e4);
          } };
          e3.setParent(y4, k4);
          return k4;
        };
        t3.addCommand("repeat", function(e3, t4, r4) {
          if (r4.matchToken("repeat")) {
            return x3(e3, r4, t4, false);
          }
        });
        t3.addCommand("for", function(e3, t4, r4) {
          if (r4.matchToken("for")) {
            return x3(e3, r4, t4, true);
          }
        });
        t3.addCommand("continue", function(e3, t4, r4) {
          if (!r4.matchToken("continue")) return;
          var n3 = { op: function(t5) {
            for (var n4 = this.parent; true; n4 = n4.parent) {
              if (n4 == void 0) {
                e3.raiseParseError(r4, "Command `continue` cannot be used outside of a `repeat` loop.");
              }
              if (n4.loop != void 0) {
                return n4.resolveNext(t5);
              }
            }
          } };
          return n3;
        });
        t3.addCommand("break", function(e3, t4, r4) {
          if (!r4.matchToken("break")) return;
          var n3 = { op: function(n4) {
            for (var i3 = this.parent; true; i3 = i3.parent) {
              if (i3 == void 0) {
                e3.raiseParseError(r4, "Command `continue` cannot be used outside of a `repeat` loop.");
              }
              if (i3.loop != void 0) {
                return t4.findNext(i3.parent, n4);
              }
            }
          } };
          return n3;
        });
        t3.addGrammarElement("stringLike", function(e3, t4, r4) {
          return e3.parseAnyOf(["string", "nakedString"], r4);
        });
        t3.addCommand("append", function(e3, t4, r4) {
          if (!r4.matchToken("append")) return;
          var n3 = null;
          var i3 = e3.requireElement("expression", r4);
          var a4 = { type: "symbol", evaluate: function(e4) {
            return t4.resolveSymbol("result", e4);
          } };
          if (r4.matchToken("to")) {
            n3 = e3.requireElement("expression", r4);
          } else {
            n3 = a4;
          }
          var o3 = null;
          if (n3.type === "symbol" || n3.type === "attributeRef" || n3.root != null) {
            o3 = k3(e3, t4, r4, n3, a4);
          }
          var s4 = { value: i3, target: n3, args: [n3, i3], op: function(e4, r5, n4) {
            if (Array.isArray(r5)) {
              r5.push(n4);
              return t4.findNext(this, e4);
            } else if (r5 instanceof Element) {
              if (n4 instanceof Element) {
                r5.insertAdjacentElement("beforeend", n4);
              } else {
                r5.insertAdjacentHTML("beforeend", n4);
              }
              t4.processNode(r5);
              return t4.findNext(this, e4);
            } else if (o3) {
              e4.result = (r5 || "") + n4;
              return o3;
            } else {
              throw Error("Unable to append a value!");
            }
          }, execute: function(e4) {
            return t4.unifiedExec(this, e4);
          } };
          if (o3 != null) {
            o3.parent = s4;
          }
          return s4;
        });
        function g4(e3, t4, r4) {
          r4.matchToken("at") || r4.matchToken("from");
          const n3 = { includeStart: true, includeEnd: false };
          n3.from = r4.matchToken("start") ? 0 : e3.requireElement("expression", r4);
          if (r4.matchToken("to") || r4.matchOpToken("..")) {
            if (r4.matchToken("end")) {
              n3.toEnd = true;
            } else {
              n3.to = e3.requireElement("expression", r4);
            }
          }
          if (r4.matchToken("inclusive")) n3.includeEnd = true;
          else if (r4.matchToken("exclusive")) n3.includeStart = false;
          return n3;
        }
        class b3 {
          constructor(e3, t4) {
            this.re = e3;
            this.str = t4;
          }
          next() {
            const e3 = this.re.exec(this.str);
            if (e3 === null) return { done: true };
            else return { value: e3 };
          }
        }
        class w3 {
          constructor(e3, t4, r4) {
            this.re = e3;
            this.flags = t4;
            this.str = r4;
          }
          [Symbol.iterator]() {
            return new b3(new RegExp(this.re, this.flags), this.str);
          }
        }
        t3.addCommand("pick", (e3, t4, r4) => {
          if (!r4.matchToken("pick")) return;
          r4.matchToken("the");
          if (r4.matchToken("item") || r4.matchToken("items") || r4.matchToken("character") || r4.matchToken("characters")) {
            const n3 = g4(e3, t4, r4);
            r4.requireToken("from");
            const i3 = e3.requireElement("expression", r4);
            return { args: [i3, n3.from, n3.to], op(e4, r5, i4, a4) {
              if (n3.toEnd) a4 = r5.length;
              if (!n3.includeStart) i4++;
              if (n3.includeEnd) a4++;
              if (a4 == null || a4 == void 0) a4 = i4 + 1;
              e4.result = r5.slice(i4, a4);
              return t4.findNext(this, e4);
            } };
          }
          if (r4.matchToken("match")) {
            r4.matchToken("of");
            const n3 = e3.parseElement("expression", r4);
            let i3 = "";
            if (r4.matchOpToken("|")) {
              i3 = r4.requireTokenType("IDENTIFIER").value;
            }
            r4.requireToken("from");
            const a4 = e3.parseElement("expression", r4);
            return { args: [a4, n3], op(e4, r5, n4) {
              e4.result = new RegExp(n4, i3).exec(r5);
              return t4.findNext(this, e4);
            } };
          }
          if (r4.matchToken("matches")) {
            r4.matchToken("of");
            const n3 = e3.parseElement("expression", r4);
            let i3 = "gu";
            if (r4.matchOpToken("|")) {
              i3 = "g" + r4.requireTokenType("IDENTIFIER").value.replace("g", "");
            }
            r4.requireToken("from");
            const a4 = e3.parseElement("expression", r4);
            return { args: [a4, n3], op(e4, r5, n4) {
              e4.result = new w3(n4, i3, r5);
              return t4.findNext(this, e4);
            } };
          }
        });
        t3.addCommand("increment", function(e3, t4, r4) {
          if (!r4.matchToken("increment")) return;
          var n3;
          var i3 = e3.parseElement("assignableExpression", r4);
          if (r4.matchToken("by")) {
            n3 = e3.requireElement("expression", r4);
          }
          var a4 = { type: "implicitIncrementOp", target: i3, args: [i3, n3], op: function(e4, t5, r5) {
            t5 = t5 ? parseFloat(t5) : 0;
            r5 = n3 ? parseFloat(r5) : 1;
            var i4 = t5 + r5;
            e4.result = i4;
            return i4;
          }, evaluate: function(e4) {
            return t4.unifiedEval(this, e4);
          } };
          return k3(e3, t4, r4, i3, a4);
        });
        t3.addCommand("decrement", function(e3, t4, r4) {
          if (!r4.matchToken("decrement")) return;
          var n3;
          var i3 = e3.parseElement("assignableExpression", r4);
          if (r4.matchToken("by")) {
            n3 = e3.requireElement("expression", r4);
          }
          var a4 = { type: "implicitDecrementOp", target: i3, args: [i3, n3], op: function(e4, t5, r5) {
            t5 = t5 ? parseFloat(t5) : 0;
            r5 = n3 ? parseFloat(r5) : 1;
            var i4 = t5 - r5;
            e4.result = i4;
            return i4;
          }, evaluate: function(e4) {
            return t4.unifiedEval(this, e4);
          } };
          return k3(e3, t4, r4, i3, a4);
        });
        function S3(e3, t4) {
          var r4 = "text";
          var n3;
          e3.matchToken("a") || e3.matchToken("an");
          if (e3.matchToken("json") || e3.matchToken("Object")) {
            r4 = "json";
          } else if (e3.matchToken("response")) {
            r4 = "response";
          } else if (e3.matchToken("html")) {
            r4 = "html";
          } else if (e3.matchToken("text")) {
          } else {
            n3 = t4.requireElement("dotOrColonPath", e3).evaluate();
          }
          return { type: r4, conversion: n3 };
        }
        t3.addCommand("fetch", function(e3, t4, r4) {
          if (!r4.matchToken("fetch")) return;
          var n3 = e3.requireElement("stringLike", r4);
          if (r4.matchToken("as")) {
            var i3 = S3(r4, e3);
          }
          if (r4.matchToken("with") && r4.currentToken().value !== "{") {
            var a4 = e3.parseElement("nakedNamedArgumentList", r4);
          } else {
            var a4 = e3.parseElement("objectLiteral", r4);
          }
          if (i3 == null && r4.matchToken("as")) {
            i3 = S3(r4, e3);
          }
          var o3 = i3 ? i3.type : "text";
          var s4 = i3 ? i3.conversion : null;
          var u4 = { url: n3, argExpressions: a4, args: [n3, a4], op: function(e4, r5, n4) {
            var i4 = n4 || {};
            i4["sender"] = e4.me;
            i4["headers"] = i4["headers"] || {};
            var a5 = new AbortController();
            let l4 = e4.me.addEventListener("fetch:abort", function() {
              a5.abort();
            }, { once: true });
            i4["signal"] = a5.signal;
            t4.triggerEvent(e4.me, "hyperscript:beforeFetch", i4);
            t4.triggerEvent(e4.me, "fetch:beforeRequest", i4);
            n4 = i4;
            var c4 = false;
            if (n4.timeout) {
              setTimeout(function() {
                if (!c4) {
                  a5.abort();
                }
              }, n4.timeout);
            }
            return fetch(r5, n4).then(function(r6) {
              let n5 = { response: r6 };
              t4.triggerEvent(e4.me, "fetch:afterResponse", n5);
              r6 = n5.response;
              if (o3 === "response") {
                e4.result = r6;
                t4.triggerEvent(e4.me, "fetch:afterRequest", { result: r6 });
                c4 = true;
                return t4.findNext(u4, e4);
              }
              if (o3 === "json") {
                return r6.json().then(function(r7) {
                  e4.result = r7;
                  t4.triggerEvent(e4.me, "fetch:afterRequest", { result: r7 });
                  c4 = true;
                  return t4.findNext(u4, e4);
                });
              }
              return r6.text().then(function(r7) {
                if (s4) r7 = t4.convertValue(r7, s4);
                if (o3 === "html") r7 = t4.convertValue(r7, "Fragment");
                e4.result = r7;
                t4.triggerEvent(e4.me, "fetch:afterRequest", { result: r7 });
                c4 = true;
                return t4.findNext(u4, e4);
              });
            }).catch(function(r6) {
              t4.triggerEvent(e4.me, "fetch:error", { reason: r6 });
              throw r6;
            }).finally(function() {
              e4.me.removeEventListener("fetch:abort", l4);
            });
          } };
          return u4;
        });
      }
      function y2(e3) {
        e3.addCommand("settle", function(e4, t4, r3) {
          if (r3.matchToken("settle")) {
            if (!e4.commandBoundary(r3.currentToken())) {
              var n4 = e4.requireElement("expression", r3);
            } else {
              var n4 = e4.requireElement("implicitMeTarget", r3);
            }
            var i4 = { type: "settleCmd", args: [n4], op: function(e5, r4) {
              t4.nullCheck(r4, n4);
              var a4 = null;
              var o4 = false;
              var s3 = false;
              var u3 = new Promise(function(e6) {
                a4 = e6;
              });
              r4.addEventListener("transitionstart", function() {
                s3 = true;
              }, { once: true });
              setTimeout(function() {
                if (!s3 && !o4) {
                  a4(t4.findNext(i4, e5));
                }
              }, 500);
              r4.addEventListener("transitionend", function() {
                if (!o4) {
                  a4(t4.findNext(i4, e5));
                }
              }, { once: true });
              return u3;
            }, execute: function(e5) {
              return t4.unifiedExec(this, e5);
            } };
            return i4;
          }
        });
        e3.addCommand("add", function(e4, t4, r3) {
          if (r3.matchToken("add")) {
            var n4 = e4.parseElement("classRef", r3);
            var i4 = null;
            var a4 = null;
            if (n4 == null) {
              i4 = e4.parseElement("attributeRef", r3);
              if (i4 == null) {
                a4 = e4.parseElement("styleLiteral", r3);
                if (a4 == null) {
                  e4.raiseParseError(r3, "Expected either a class reference or attribute expression");
                }
              }
            } else {
              var o4 = [n4];
              while (n4 = e4.parseElement("classRef", r3)) {
                o4.push(n4);
              }
            }
            if (r3.matchToken("to")) {
              var s3 = e4.requireElement("expression", r3);
            } else {
              var s3 = e4.requireElement("implicitMeTarget", r3);
            }
            if (r3.matchToken("when")) {
              if (a4) {
                e4.raiseParseError(r3, "Only class and properties are supported with a when clause");
              }
              var u3 = e4.requireElement("expression", r3);
            }
            if (o4) {
              return { classRefs: o4, to: s3, args: [s3, o4], op: function(e5, r4, n5) {
                t4.nullCheck(r4, s3);
                t4.forEach(n5, function(n6) {
                  t4.implicitLoop(r4, function(r5) {
                    if (u3) {
                      e5.result = r5;
                      let i5 = t4.evaluateNoPromise(u3, e5);
                      if (i5) {
                        if (r5 instanceof Element) r5.classList.add(n6.className);
                      } else {
                        if (r5 instanceof Element) r5.classList.remove(n6.className);
                      }
                      e5.result = null;
                    } else {
                      if (r5 instanceof Element) r5.classList.add(n6.className);
                    }
                  });
                });
                return t4.findNext(this, e5);
              } };
            } else if (i4) {
              return { type: "addCmd", attributeRef: i4, to: s3, args: [s3], op: function(e5, r4, n5) {
                t4.nullCheck(r4, s3);
                t4.implicitLoop(r4, function(r5) {
                  if (u3) {
                    e5.result = r5;
                    let n6 = t4.evaluateNoPromise(u3, e5);
                    if (n6) {
                      r5.setAttribute(i4.name, i4.value);
                    } else {
                      r5.removeAttribute(i4.name);
                    }
                    e5.result = null;
                  } else {
                    r5.setAttribute(i4.name, i4.value);
                  }
                });
                return t4.findNext(this, e5);
              }, execute: function(e5) {
                return t4.unifiedExec(this, e5);
              } };
            } else {
              return { type: "addCmd", cssDeclaration: a4, to: s3, args: [s3, a4], op: function(e5, r4, n5) {
                t4.nullCheck(r4, s3);
                t4.implicitLoop(r4, function(e6) {
                  e6.style.cssText += n5;
                });
                return t4.findNext(this, e5);
              }, execute: function(e5) {
                return t4.unifiedExec(this, e5);
              } };
            }
          }
        });
        e3.addGrammarElement("styleLiteral", function(e4, t4, r3) {
          if (!r3.matchOpToken("{")) return;
          var n4 = [""];
          var i4 = [];
          while (r3.hasMore()) {
            if (r3.matchOpToken("\\")) {
              r3.consumeToken();
            } else if (r3.matchOpToken("}")) {
              break;
            } else if (r3.matchToken("$")) {
              var a4 = r3.matchOpToken("{");
              var o4 = e4.parseElement("expression", r3);
              if (a4) r3.requireOpToken("}");
              i4.push(o4);
              n4.push("");
            } else {
              var s3 = r3.consumeToken();
              n4[n4.length - 1] += r3.source.substring(s3.start, s3.end);
            }
            n4[n4.length - 1] += r3.lastWhitespace();
          }
          return { type: "styleLiteral", args: [i4], op: function(e5, t5) {
            var r4 = "";
            n4.forEach(function(e6, n5) {
              r4 += e6;
              if (n5 in t5) r4 += t5[n5];
            });
            return r4;
          }, evaluate: function(e5) {
            return t4.unifiedEval(this, e5);
          } };
        });
        e3.addCommand("remove", function(e4, t4, r3) {
          if (r3.matchToken("remove")) {
            var n4 = e4.parseElement("classRef", r3);
            var i4 = null;
            var a4 = null;
            if (n4 == null) {
              i4 = e4.parseElement("attributeRef", r3);
              if (i4 == null) {
                a4 = e4.parseElement("expression", r3);
                if (a4 == null) {
                  e4.raiseParseError(r3, "Expected either a class reference, attribute expression or value expression");
                }
              }
            } else {
              var o4 = [n4];
              while (n4 = e4.parseElement("classRef", r3)) {
                o4.push(n4);
              }
            }
            if (r3.matchToken("from")) {
              var s3 = e4.requireElement("expression", r3);
            } else {
              if (a4 == null) {
                var s3 = e4.requireElement("implicitMeTarget", r3);
              }
            }
            if (a4) {
              return { elementExpr: a4, from: s3, args: [a4, s3], op: function(e5, r4, n5) {
                t4.nullCheck(r4, a4);
                t4.implicitLoop(r4, function(e6) {
                  if (e6.parentElement && (n5 == null || n5.contains(e6))) {
                    e6.parentElement.removeChild(e6);
                  }
                });
                return t4.findNext(this, e5);
              } };
            } else {
              return { classRefs: o4, attributeRef: i4, elementExpr: a4, from: s3, args: [o4, s3], op: function(e5, r4, n5) {
                t4.nullCheck(n5, s3);
                if (r4) {
                  t4.forEach(r4, function(e6) {
                    t4.implicitLoop(n5, function(t5) {
                      t5.classList.remove(e6.className);
                    });
                  });
                } else {
                  t4.implicitLoop(n5, function(e6) {
                    e6.removeAttribute(i4.name);
                  });
                }
                return t4.findNext(this, e5);
              } };
            }
          }
        });
        e3.addCommand("toggle", function(e4, t4, r3) {
          if (r3.matchToken("toggle")) {
            r3.matchAnyToken("the", "my");
            if (r3.currentToken().type === "STYLE_REF") {
              let t5 = r3.consumeToken();
              var n4 = t5.value.substr(1);
              var a4 = true;
              var o4 = i3(e4, r3, n4);
              if (r3.matchToken("of")) {
                r3.pushFollow("with");
                try {
                  var s3 = e4.requireElement("expression", r3);
                } finally {
                  r3.popFollow();
                }
              } else {
                var s3 = e4.requireElement("implicitMeTarget", r3);
              }
            } else if (r3.matchToken("between")) {
              var u3 = true;
              var l3 = e4.parseElement("classRef", r3);
              r3.requireToken("and");
              var c3 = e4.requireElement("classRef", r3);
            } else {
              var l3 = e4.parseElement("classRef", r3);
              var f3 = null;
              if (l3 == null) {
                f3 = e4.parseElement("attributeRef", r3);
                if (f3 == null) {
                  e4.raiseParseError(r3, "Expected either a class reference or attribute expression");
                }
              } else {
                var m3 = [l3];
                while (l3 = e4.parseElement("classRef", r3)) {
                  m3.push(l3);
                }
              }
            }
            if (a4 !== true) {
              if (r3.matchToken("on")) {
                var s3 = e4.requireElement("expression", r3);
              } else {
                var s3 = e4.requireElement("implicitMeTarget", r3);
              }
            }
            if (r3.matchToken("for")) {
              var p3 = e4.requireElement("expression", r3);
            } else if (r3.matchToken("until")) {
              var h3 = e4.requireElement("dotOrColonPath", r3, "Expected event name");
              if (r3.matchToken("from")) {
                var v3 = e4.requireElement("expression", r3);
              }
            }
            var d3 = { classRef: l3, classRef2: c3, classRefs: m3, attributeRef: f3, on: s3, time: p3, evt: h3, from: v3, toggle: function(e5, r4, n5, i4) {
              t4.nullCheck(e5, s3);
              if (a4) {
                t4.implicitLoop(e5, function(e6) {
                  o4("toggle", e6);
                });
              } else if (u3) {
                t4.implicitLoop(e5, function(e6) {
                  if (e6.classList.contains(r4.className)) {
                    e6.classList.remove(r4.className);
                    e6.classList.add(n5.className);
                  } else {
                    e6.classList.add(r4.className);
                    e6.classList.remove(n5.className);
                  }
                });
              } else if (i4) {
                t4.forEach(i4, function(r5) {
                  t4.implicitLoop(e5, function(e6) {
                    e6.classList.toggle(r5.className);
                  });
                });
              } else {
                t4.implicitLoop(e5, function(e6) {
                  if (e6.hasAttribute(f3.name)) {
                    e6.removeAttribute(f3.name);
                  } else {
                    e6.setAttribute(f3.name, f3.value);
                  }
                });
              }
            }, args: [s3, p3, h3, v3, l3, c3, m3], op: function(e5, r4, n5, i4, a5, o5, s4, u4) {
              if (n5) {
                return new Promise(function(i5) {
                  d3.toggle(r4, o5, s4, u4);
                  setTimeout(function() {
                    d3.toggle(r4, o5, s4, u4);
                    i5(t4.findNext(d3, e5));
                  }, n5);
                });
              } else if (i4) {
                return new Promise(function(n6) {
                  var l4 = a5 || e5.me;
                  l4.addEventListener(i4, function() {
                    d3.toggle(r4, o5, s4, u4);
                    n6(t4.findNext(d3, e5));
                  }, { once: true });
                  d3.toggle(r4, o5, s4, u4);
                });
              } else {
                this.toggle(r4, o5, s4, u4);
                return t4.findNext(d3, e5);
              }
            } };
            return d3;
          }
        });
        var t3 = { display: function(r3, n4, i4) {
          if (i4) {
            n4.style.display = i4;
          } else if (r3 === "toggle") {
            if (getComputedStyle(n4).display === "none") {
              t3.display("show", n4, i4);
            } else {
              t3.display("hide", n4, i4);
            }
          } else if (r3 === "hide") {
            const t4 = e3.runtime.getInternalData(n4);
            if (t4.originalDisplay == null) {
              t4.originalDisplay = n4.style.display;
            }
            n4.style.display = "none";
          } else {
            const t4 = e3.runtime.getInternalData(n4);
            if (t4.originalDisplay && t4.originalDisplay !== "none") {
              n4.style.display = t4.originalDisplay;
            } else {
              n4.style.removeProperty("display");
            }
          }
        }, visibility: function(e4, r3, n4) {
          if (n4) {
            r3.style.visibility = n4;
          } else if (e4 === "toggle") {
            if (getComputedStyle(r3).visibility === "hidden") {
              t3.visibility("show", r3, n4);
            } else {
              t3.visibility("hide", r3, n4);
            }
          } else if (e4 === "hide") {
            r3.style.visibility = "hidden";
          } else {
            r3.style.visibility = "visible";
          }
        }, opacity: function(e4, r3, n4) {
          if (n4) {
            r3.style.opacity = n4;
          } else if (e4 === "toggle") {
            if (getComputedStyle(r3).opacity === "0") {
              t3.opacity("show", r3, n4);
            } else {
              t3.opacity("hide", r3, n4);
            }
          } else if (e4 === "hide") {
            r3.style.opacity = "0";
          } else {
            r3.style.opacity = "1";
          }
        } };
        var n3 = function(e4, t4, r3) {
          var n4;
          var i4 = r3.currentToken();
          if (i4.value === "when" || i4.value === "with" || e4.commandBoundary(i4)) {
            n4 = e4.parseElement("implicitMeTarget", r3);
          } else {
            n4 = e4.parseElement("expression", r3);
          }
          return n4;
        };
        var i3 = function(e4, n4, i4) {
          var a4 = r2.defaultHideShowStrategy;
          var o4 = t3;
          if (r2.hideShowStrategies) {
            o4 = Object.assign(o4, r2.hideShowStrategies);
          }
          i4 = i4 || a4 || "display";
          var s3 = o4[i4];
          if (s3 == null) {
            e4.raiseParseError(n4, "Unknown show/hide strategy : " + i4);
          }
          return s3;
        };
        e3.addCommand("hide", function(e4, t4, r3) {
          if (r3.matchToken("hide")) {
            var a4 = n3(e4, t4, r3);
            var o4 = null;
            if (r3.matchToken("with")) {
              o4 = r3.requireTokenType("IDENTIFIER", "STYLE_REF").value;
              if (o4.indexOf("*") === 0) {
                o4 = o4.substr(1);
              }
            }
            var s3 = i3(e4, r3, o4);
            return { target: a4, args: [a4], op: function(e5, r4) {
              t4.nullCheck(r4, a4);
              t4.implicitLoop(r4, function(e6) {
                s3("hide", e6);
              });
              return t4.findNext(this, e5);
            } };
          }
        });
        e3.addCommand("show", function(e4, t4, r3) {
          if (r3.matchToken("show")) {
            var a4 = n3(e4, t4, r3);
            var o4 = null;
            if (r3.matchToken("with")) {
              o4 = r3.requireTokenType("IDENTIFIER", "STYLE_REF").value;
              if (o4.indexOf("*") === 0) {
                o4 = o4.substr(1);
              }
            }
            var s3 = null;
            if (r3.matchOpToken(":")) {
              var u3 = r3.consumeUntilWhitespace();
              r3.matchTokenType("WHITESPACE");
              s3 = u3.map(function(e5) {
                return e5.value;
              }).join("");
            }
            if (r3.matchToken("when")) {
              var l3 = e4.requireElement("expression", r3);
            }
            var c3 = i3(e4, r3, o4);
            return { target: a4, when: l3, args: [a4], op: function(e5, r4) {
              t4.nullCheck(r4, a4);
              t4.implicitLoop(r4, function(r5) {
                if (l3) {
                  e5.result = r5;
                  let n4 = t4.evaluateNoPromise(l3, e5);
                  if (n4) {
                    c3("show", r5, s3);
                  } else {
                    c3("hide", r5);
                  }
                  e5.result = null;
                } else {
                  c3("show", r5, s3);
                }
              });
              return t4.findNext(this, e5);
            } };
          }
        });
        e3.addCommand("take", function(e4, t4, r3) {
          if (r3.matchToken("take")) {
            let u3 = null;
            let l3 = [];
            while (u3 = e4.parseElement("classRef", r3)) {
              l3.push(u3);
            }
            var n4 = null;
            var i4 = null;
            let c3 = l3.length > 0;
            if (!c3) {
              n4 = e4.parseElement("attributeRef", r3);
              if (n4 == null) {
                e4.raiseParseError(r3, "Expected either a class reference or attribute expression");
              }
              if (r3.matchToken("with")) {
                i4 = e4.requireElement("expression", r3);
              }
            }
            if (r3.matchToken("from")) {
              var a4 = e4.requireElement("expression", r3);
            }
            if (r3.matchToken("for")) {
              var o4 = e4.requireElement("expression", r3);
            } else {
              var o4 = e4.requireElement("implicitMeTarget", r3);
            }
            if (c3) {
              var s3 = { classRefs: l3, from: a4, forElt: o4, args: [l3, a4, o4], op: function(e5, r4, n5, i5) {
                t4.nullCheck(i5, o4);
                t4.implicitLoop(r4, function(e6) {
                  var r5 = e6.className;
                  if (n5) {
                    t4.implicitLoop(n5, function(e7) {
                      e7.classList.remove(r5);
                    });
                  } else {
                    t4.implicitLoop(e6, function(e7) {
                      e7.classList.remove(r5);
                    });
                  }
                  t4.implicitLoop(i5, function(e7) {
                    e7.classList.add(r5);
                  });
                });
                return t4.findNext(this, e5);
              } };
              return s3;
            } else {
              var s3 = { attributeRef: n4, from: a4, forElt: o4, args: [a4, o4, i4], op: function(e5, r4, i5, s4) {
                t4.nullCheck(r4, a4);
                t4.nullCheck(i5, o4);
                t4.implicitLoop(r4, function(e6) {
                  if (!s4) {
                    e6.removeAttribute(n4.name);
                  } else {
                    e6.setAttribute(n4.name, s4);
                  }
                });
                t4.implicitLoop(i5, function(e6) {
                  e6.setAttribute(n4.name, n4.value || "");
                });
                return t4.findNext(this, e5);
              } };
              return s3;
            }
          }
        });
        function a3(t4, r3, n4, i4) {
          if (n4 != null) {
            var a4 = t4.resolveSymbol(n4, r3);
          } else {
            var a4 = r3;
          }
          if (a4 instanceof Element || a4 instanceof HTMLDocument) {
            while (a4.firstChild) a4.removeChild(a4.firstChild);
            a4.append(e3.runtime.convertValue(i4, "Fragment"));
            t4.processNode(a4);
          } else {
            if (n4 != null) {
              t4.setSymbol(n4, r3, null, i4);
            } else {
              throw "Don't know how to put a value into " + typeof r3;
            }
          }
        }
        e3.addCommand("put", function(e4, t4, r3) {
          if (r3.matchToken("put")) {
            var n4 = e4.requireElement("expression", r3);
            var i4 = r3.matchAnyToken("into", "before", "after");
            if (i4 == null && r3.matchToken("at")) {
              r3.matchToken("the");
              i4 = r3.matchAnyToken("start", "end");
              r3.requireToken("of");
            }
            if (i4 == null) {
              e4.raiseParseError(r3, "Expected one of 'into', 'before', 'at start of', 'at end of', 'after'");
            }
            var o4 = e4.requireElement("expression", r3);
            var s3 = i4.value;
            var u3 = false;
            var l3 = false;
            var c3 = null;
            var f3 = null;
            if (o4.type === "arrayIndex" && s3 === "into") {
              u3 = true;
              f3 = o4.prop;
              c3 = o4.root;
            } else if (o4.prop && o4.root && s3 === "into") {
              f3 = o4.prop.value;
              c3 = o4.root;
            } else if (o4.type === "symbol" && s3 === "into") {
              l3 = true;
              f3 = o4.name;
            } else if (o4.type === "attributeRef" && s3 === "into") {
              var m3 = true;
              f3 = o4.name;
              c3 = e4.requireElement("implicitMeTarget", r3);
            } else if (o4.type === "styleRef" && s3 === "into") {
              var p3 = true;
              f3 = o4.name;
              c3 = e4.requireElement("implicitMeTarget", r3);
            } else if (o4.attribute && s3 === "into") {
              var m3 = o4.attribute.type === "attributeRef";
              var p3 = o4.attribute.type === "styleRef";
              f3 = o4.attribute.name;
              c3 = o4.root;
            } else {
              c3 = o4;
            }
            var h3 = { target: o4, operation: s3, symbolWrite: l3, value: n4, args: [c3, f3, n4], op: function(e5, r4, n5, i5) {
              if (l3) {
                a3(t4, e5, n5, i5);
              } else {
                t4.nullCheck(r4, c3);
                if (s3 === "into") {
                  if (m3) {
                    t4.implicitLoop(r4, function(e6) {
                      e6.setAttribute(n5, i5);
                    });
                  } else if (p3) {
                    t4.implicitLoop(r4, function(e6) {
                      e6.style[n5] = i5;
                    });
                  } else if (u3) {
                    r4[n5] = i5;
                  } else {
                    t4.implicitLoop(r4, function(e6) {
                      a3(t4, e6, n5, i5);
                    });
                  }
                } else {
                  var o5 = s3 === "before" ? Element.prototype.before : s3 === "after" ? Element.prototype.after : s3 === "start" ? Element.prototype.prepend : s3 === "end" ? Element.prototype.append : Element.prototype.append;
                  t4.implicitLoop(r4, function(e6) {
                    o5.call(e6, i5 instanceof Node ? i5 : t4.convertValue(i5, "Fragment"));
                    if (e6.parentElement) {
                      t4.processNode(e6.parentElement);
                    } else {
                      t4.processNode(e6);
                    }
                  });
                }
              }
              return t4.findNext(this, e5);
            } };
            return h3;
          }
        });
        function o3(e4, t4, r3) {
          var n4;
          if (r3.matchToken("the") || r3.matchToken("element") || r3.matchToken("elements") || r3.currentToken().type === "CLASS_REF" || r3.currentToken().type === "ID_REF" || r3.currentToken().op && r3.currentToken().value === "<") {
            e4.possessivesDisabled = true;
            try {
              n4 = e4.parseElement("expression", r3);
            } finally {
              delete e4.possessivesDisabled;
            }
            if (r3.matchOpToken("'")) {
              r3.requireToken("s");
            }
          } else if (r3.currentToken().type === "IDENTIFIER" && r3.currentToken().value === "its") {
            var i4 = r3.matchToken("its");
            n4 = { type: "pseudopossessiveIts", token: i4, name: i4.value, evaluate: function(e5) {
              return t4.resolveSymbol("it", e5);
            } };
          } else {
            r3.matchToken("my") || r3.matchToken("me");
            n4 = e4.parseElement("implicitMeTarget", r3);
          }
          return n4;
        }
        e3.addCommand("transition", function(e4, t4, n4) {
          if (n4.matchToken("transition")) {
            var i4 = o3(e4, t4, n4);
            var a4 = [];
            var s3 = [];
            var u3 = [];
            var l3 = n4.currentToken();
            while (!e4.commandBoundary(l3) && l3.value !== "over" && l3.value !== "using") {
              if (n4.currentToken().type === "STYLE_REF") {
                let e5 = n4.consumeToken();
                let t5 = e5.value.substr(1);
                a4.push({ type: "styleRefValue", evaluate: function() {
                  return t5;
                } });
              } else {
                a4.push(e4.requireElement("stringLike", n4));
              }
              if (n4.matchToken("from")) {
                s3.push(e4.requireElement("expression", n4));
              } else {
                s3.push(null);
              }
              n4.requireToken("to");
              if (n4.matchToken("initial")) {
                u3.push({ type: "initial_literal", evaluate: function() {
                  return "initial";
                } });
              } else {
                u3.push(e4.requireElement("expression", n4));
              }
              l3 = n4.currentToken();
            }
            if (n4.matchToken("over")) {
              var c3 = e4.requireElement("expression", n4);
            } else if (n4.matchToken("using")) {
              var f3 = e4.requireElement("expression", n4);
            }
            var m3 = { to: u3, args: [i4, a4, s3, u3, f3, c3], op: function(e5, n5, a5, o4, s4, u4, l4) {
              t4.nullCheck(n5, i4);
              var c4 = [];
              t4.implicitLoop(n5, function(e6) {
                var n6 = new Promise(function(n7, i5) {
                  var c5 = e6.style.transition;
                  if (l4) {
                    e6.style.transition = "all " + l4 + "ms ease-in";
                  } else if (u4) {
                    e6.style.transition = u4;
                  } else {
                    e6.style.transition = r2.defaultTransition;
                  }
                  var f4 = t4.getInternalData(e6);
                  var m4 = getComputedStyle(e6);
                  var p3 = {};
                  for (var h3 = 0; h3 < m4.length; h3++) {
                    var v3 = m4[h3];
                    var d3 = m4[v3];
                    p3[v3] = d3;
                  }
                  if (!f4.initialStyles) {
                    f4.initialStyles = p3;
                  }
                  for (var h3 = 0; h3 < a5.length; h3++) {
                    var E3 = a5[h3];
                    var T3 = o4[h3];
                    if (T3 === "computed" || T3 == null) {
                      e6.style[E3] = p3[E3];
                    } else {
                      e6.style[E3] = T3;
                    }
                  }
                  var y3 = false;
                  var k3 = false;
                  e6.addEventListener("transitionend", function() {
                    if (!k3) {
                      e6.style.transition = c5;
                      k3 = true;
                      n7();
                    }
                  }, { once: true });
                  e6.addEventListener("transitionstart", function() {
                    y3 = true;
                  }, { once: true });
                  setTimeout(function() {
                    if (!k3 && !y3) {
                      e6.style.transition = c5;
                      k3 = true;
                      n7();
                    }
                  }, 100);
                  setTimeout(function() {
                    var t5 = [];
                    for (var r3 = 0; r3 < a5.length; r3++) {
                      var n8 = a5[r3];
                      var i6 = s4[r3];
                      if (i6 === "initial") {
                        var o5 = f4.initialStyles[n8];
                        e6.style[n8] = o5;
                      } else {
                        e6.style[n8] = i6;
                      }
                    }
                  }, 0);
                });
                c4.push(n6);
              });
              return Promise.all(c4).then(function() {
                return t4.findNext(m3, e5);
              });
            } };
            return m3;
          }
        });
        e3.addCommand("measure", function(e4, t4, r3) {
          if (!r3.matchToken("measure")) return;
          var n4 = o3(e4, t4, r3);
          var i4 = [];
          if (!e4.commandBoundary(r3.currentToken())) do {
            i4.push(r3.matchTokenType("IDENTIFIER").value);
          } while (r3.matchOpToken(","));
          return { properties: i4, args: [n4], op: function(e5, r4) {
            t4.nullCheck(r4, n4);
            if (0 in r4) r4 = r4[0];
            var a4 = r4.getBoundingClientRect();
            var o4 = { top: r4.scrollTop, left: r4.scrollLeft, topMax: r4.scrollTopMax, leftMax: r4.scrollLeftMax, height: r4.scrollHeight, width: r4.scrollWidth };
            e5.result = { x: a4.x, y: a4.y, left: a4.left, top: a4.top, right: a4.right, bottom: a4.bottom, width: a4.width, height: a4.height, bounds: a4, scrollLeft: o4.left, scrollTop: o4.top, scrollLeftMax: o4.leftMax, scrollTopMax: o4.topMax, scrollWidth: o4.width, scrollHeight: o4.height, scroll: o4 };
            t4.forEach(i4, function(t5) {
              if (t5 in e5.result) e5.locals[t5] = e5.result[t5];
              else throw "No such measurement as " + t5;
            });
            return t4.findNext(this, e5);
          } };
        });
        e3.addLeafExpression("closestExpr", function(e4, t4, r3) {
          if (r3.matchToken("closest")) {
            if (r3.matchToken("parent")) {
              var n4 = true;
            }
            var i4 = null;
            if (r3.currentToken().type === "ATTRIBUTE_REF") {
              var a4 = e4.requireElement("attributeRefAccess", r3, null);
              i4 = "[" + a4.attribute.name + "]";
            }
            if (i4 == null) {
              var o4 = e4.requireElement("expression", r3);
              if (o4.css == null) {
                e4.raiseParseError(r3, "Expected a CSS expression");
              } else {
                i4 = o4.css;
              }
            }
            if (r3.matchToken("to")) {
              var s3 = e4.parseElement("expression", r3);
            } else {
              var s3 = e4.parseElement("implicitMeTarget", r3);
            }
            var u3 = { type: "closestExpr", parentSearch: n4, expr: o4, css: i4, to: s3, args: [s3], op: function(e5, r4) {
              if (r4 == null) {
                return null;
              } else {
                let e6 = [];
                t4.implicitLoop(r4, function(t5) {
                  if (n4) {
                    e6.push(t5.parentElement ? t5.parentElement.closest(i4) : null);
                  } else {
                    e6.push(t5.closest(i4));
                  }
                });
                if (t4.shouldAutoIterate(r4)) {
                  return e6;
                } else {
                  return e6[0];
                }
              }
            }, evaluate: function(e5) {
              return t4.unifiedEval(this, e5);
            } };
            if (a4) {
              a4.root = u3;
              a4.args = [u3];
              return a4;
            } else {
              return u3;
            }
          }
        });
        e3.addCommand("go", function(e4, t4, r3) {
          if (r3.matchToken("go")) {
            if (r3.matchToken("back")) {
              var n4 = true;
            } else {
              r3.matchToken("to");
              if (r3.matchToken("url")) {
                var i4 = e4.requireElement("stringLike", r3);
                var a4 = true;
                if (r3.matchToken("in")) {
                  r3.requireToken("new");
                  r3.requireToken("window");
                  var o4 = true;
                }
              } else {
                r3.matchToken("the");
                var s3 = r3.matchAnyToken("top", "middle", "bottom");
                var u3 = r3.matchAnyToken("left", "center", "right");
                if (s3 || u3) {
                  r3.requireToken("of");
                }
                var i4 = e4.requireElement("unaryExpression", r3);
                var l3 = r3.matchAnyOpToken("+", "-");
                if (l3) {
                  r3.pushFollow("px");
                  try {
                    var c3 = e4.requireElement("expression", r3);
                  } finally {
                    r3.popFollow();
                  }
                }
                r3.matchToken("px");
                var f3 = r3.matchAnyToken("smoothly", "instantly");
                var m3 = { block: "start", inline: "nearest" };
                if (s3) {
                  if (s3.value === "top") {
                    m3.block = "start";
                  } else if (s3.value === "bottom") {
                    m3.block = "end";
                  } else if (s3.value === "middle") {
                    m3.block = "center";
                  }
                }
                if (u3) {
                  if (u3.value === "left") {
                    m3.inline = "start";
                  } else if (u3.value === "center") {
                    m3.inline = "center";
                  } else if (u3.value === "right") {
                    m3.inline = "end";
                  }
                }
                if (f3) {
                  if (f3.value === "smoothly") {
                    m3.behavior = "smooth";
                  } else if (f3.value === "instantly") {
                    m3.behavior = "instant";
                  }
                }
              }
            }
            var p3 = { target: i4, args: [i4, c3], op: function(e5, r4, i5) {
              if (n4) {
                window.history.back();
              } else if (a4) {
                if (r4) {
                  if (o4) {
                    window.open(r4);
                  } else {
                    window.location.href = r4;
                  }
                }
              } else {
                t4.implicitLoop(r4, function(e6) {
                  if (e6 === window) {
                    e6 = document.body;
                  }
                  if (l3) {
                    let t5 = e6.getBoundingClientRect();
                    let r5 = document.createElement("div");
                    let n5 = l3.value === "+" ? i5 : i5 * -1;
                    let a5 = m3.inline == "start" || m3.inline == "end" ? n5 : 0;
                    let o5 = m3.block == "start" || m3.block == "end" ? n5 : 0;
                    r5.style.position = "absolute";
                    r5.style.top = t5.top + window.scrollY + o5 + "px";
                    r5.style.left = t5.left + window.scrollX + a5 + "px";
                    r5.style.height = t5.height + "px";
                    r5.style.width = t5.width + "px";
                    r5.style.zIndex = "" + Number.MIN_SAFE_INTEGER;
                    r5.style.opacity = "0";
                    document.body.appendChild(r5);
                    setTimeout(function() {
                      document.body.removeChild(r5);
                    }, 100);
                    e6 = r5;
                  }
                  e6.scrollIntoView(m3);
                });
              }
              return t4.findNext(p3, e5);
            } };
            return p3;
          }
        });
        r2.conversions.dynamicResolvers.push(function(t4, r3) {
          if (!(t4 === "Values" || t4.indexOf("Values:") === 0)) {
            return;
          }
          var n4 = t4.split(":")[1];
          var i4 = {};
          var a4 = e3.runtime.implicitLoop.bind(e3.runtime);
          a4(r3, function(e4) {
            var t5 = s3(e4);
            if (t5 !== void 0) {
              i4[t5.name] = t5.value;
              return;
            }
            if (e4.querySelectorAll != void 0) {
              var r4 = e4.querySelectorAll("input,select,textarea");
              r4.forEach(o4);
            }
          });
          if (n4) {
            if (n4 === "JSON") {
              return JSON.stringify(i4);
            } else if (n4 === "Form") {
              return new URLSearchParams(i4).toString();
            } else {
              throw "Unknown conversion: " + n4;
            }
          } else {
            return i4;
          }
          function o4(e4) {
            var t5 = s3(e4);
            if (t5 == void 0) {
              return;
            }
            if (i4[t5.name] == void 0) {
              i4[t5.name] = t5.value;
              return;
            }
            if (Array.isArray(i4[t5.name]) && Array.isArray(t5.value)) {
              i4[t5.name] = [].concat(i4[t5.name], t5.value);
              return;
            }
          }
          function s3(e4) {
            try {
              var t5 = { name: e4.name, value: e4.value };
              if (t5.name == void 0 || t5.value == void 0) {
                return void 0;
              }
              if (e4.type == "radio" && e4.checked == false) {
                return void 0;
              }
              if (e4.type == "checkbox") {
                if (e4.checked == false) {
                  t5.value = void 0;
                } else if (typeof t5.value === "string") {
                  t5.value = [t5.value];
                }
              }
              if (e4.type == "select-multiple") {
                var r4 = e4.querySelectorAll("option[selected]");
                t5.value = [];
                for (var n5 = 0; n5 < r4.length; n5++) {
                  t5.value.push(r4[n5].value);
                }
              }
              return t5;
            } catch (e5) {
              return void 0;
            }
          }
        });
        r2.conversions["HTML"] = function(e4) {
          var t4 = function(e5) {
            if (e5 instanceof Array) {
              return e5.map(function(e6) {
                return t4(e6);
              }).join("");
            }
            if (e5 instanceof HTMLElement) {
              return e5.outerHTML;
            }
            if (e5 instanceof NodeList) {
              var r3 = "";
              for (var n4 = 0; n4 < e5.length; n4++) {
                var i4 = e5[n4];
                if (i4 instanceof HTMLElement) {
                  r3 += i4.outerHTML;
                }
              }
              return r3;
            }
            if (e5.toString) {
              return e5.toString();
            }
            return "";
          };
          return t4(e4);
        };
        r2.conversions["Fragment"] = function(t4) {
          var r3 = document.createDocumentFragment();
          e3.runtime.implicitLoop(t4, function(e4) {
            if (e4 instanceof Node) r3.append(e4);
            else {
              var t5 = document.createElement("template");
              t5.innerHTML = e4;
              r3.append(t5.content);
            }
          });
          return r3;
        };
      }
      const k2 = new o2(), x2 = k2.lexer, g3 = k2.parser;
      function b2(e3, t3) {
        return k2.evaluate(e3, t3);
      }
      function w2() {
        var t3 = Array.from(e2.document.querySelectorAll("script[type='text/hyperscript'][src]"));
        Promise.all(t3.map(function(e3) {
          return fetch(e3.src).then(function(e4) {
            return e4.text();
          });
        })).then((e3) => e3.forEach((e4) => S2(e4))).then(() => n3(function() {
          a3();
          k2.processNode(document.documentElement);
          document.dispatchEvent(new Event("hyperscript:ready"));
          e2.document.addEventListener("htmx:load", function(e3) {
            k2.processNode(e3.detail.elt);
          });
        }));
        function n3(e3) {
          if (document.readyState !== "loading") {
            setTimeout(e3);
          } else {
            document.addEventListener("DOMContentLoaded", e3);
          }
        }
        function i3() {
          var e3 = document.querySelector('meta[name="htmx-config"]');
          if (e3) {
            return v2(e3.content);
          } else {
            return null;
          }
        }
        function a3() {
          var e3 = i3();
          if (e3) {
            Object.assign(r2, e3);
          }
        }
      }
      const S2 = Object.assign(b2, { config: r2, use(e3) {
        e3(S2);
      }, internals: { lexer: x2, parser: g3, runtime: k2, Lexer: n2, Tokens: i2, Parser: a2, Runtime: o2 }, ElementCollection: m2, addFeature: g3.addFeature.bind(g3), addCommand: g3.addCommand.bind(g3), addLeafExpression: g3.addLeafExpression.bind(g3), addIndirectExpression: g3.addIndirectExpression.bind(g3), evaluate: k2.evaluate.bind(k2), parse: k2.parse.bind(k2), processNode: k2.processNode.bind(k2), version: "0.9.14", browserInit: w2 });
      return S2;
    });
  }
});

// src/static/mod.ts
var import_htmx3 = __toESM(require_htmx_min());
var import_hyperscript = __toESM(require_hyperscript_min());

// node_modules/.deno/sortablejs@1.15.6/node_modules/sortablejs/modular/sortable.esm.js
function ownKeys(object, enumerableOnly) {
  var keys = Object.keys(object);
  if (Object.getOwnPropertySymbols) {
    var symbols = Object.getOwnPropertySymbols(object);
    if (enumerableOnly) {
      symbols = symbols.filter(function(sym) {
        return Object.getOwnPropertyDescriptor(object, sym).enumerable;
      });
    }
    keys.push.apply(keys, symbols);
  }
  return keys;
}
function _objectSpread2(target) {
  for (var i2 = 1; i2 < arguments.length; i2++) {
    var source = arguments[i2] != null ? arguments[i2] : {};
    if (i2 % 2) {
      ownKeys(Object(source), true).forEach(function(key) {
        _defineProperty(target, key, source[key]);
      });
    } else if (Object.getOwnPropertyDescriptors) {
      Object.defineProperties(target, Object.getOwnPropertyDescriptors(source));
    } else {
      ownKeys(Object(source)).forEach(function(key) {
        Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key));
      });
    }
  }
  return target;
}
function _typeof(obj) {
  "@babel/helpers - typeof";
  if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") {
    _typeof = function(obj2) {
      return typeof obj2;
    };
  } else {
    _typeof = function(obj2) {
      return obj2 && typeof Symbol === "function" && obj2.constructor === Symbol && obj2 !== Symbol.prototype ? "symbol" : typeof obj2;
    };
  }
  return _typeof(obj);
}
function _defineProperty(obj, key, value) {
  if (key in obj) {
    Object.defineProperty(obj, key, {
      value,
      enumerable: true,
      configurable: true,
      writable: true
    });
  } else {
    obj[key] = value;
  }
  return obj;
}
function _extends() {
  _extends = Object.assign || function(target) {
    for (var i2 = 1; i2 < arguments.length; i2++) {
      var source = arguments[i2];
      for (var key in source) {
        if (Object.prototype.hasOwnProperty.call(source, key)) {
          target[key] = source[key];
        }
      }
    }
    return target;
  };
  return _extends.apply(this, arguments);
}
function _objectWithoutPropertiesLoose(source, excluded) {
  if (source == null) return {};
  var target = {};
  var sourceKeys = Object.keys(source);
  var key, i2;
  for (i2 = 0; i2 < sourceKeys.length; i2++) {
    key = sourceKeys[i2];
    if (excluded.indexOf(key) >= 0) continue;
    target[key] = source[key];
  }
  return target;
}
function _objectWithoutProperties(source, excluded) {
  if (source == null) return {};
  var target = _objectWithoutPropertiesLoose(source, excluded);
  var key, i2;
  if (Object.getOwnPropertySymbols) {
    var sourceSymbolKeys = Object.getOwnPropertySymbols(source);
    for (i2 = 0; i2 < sourceSymbolKeys.length; i2++) {
      key = sourceSymbolKeys[i2];
      if (excluded.indexOf(key) >= 0) continue;
      if (!Object.prototype.propertyIsEnumerable.call(source, key)) continue;
      target[key] = source[key];
    }
  }
  return target;
}
var version = "1.15.6";
function userAgent(pattern) {
  if (typeof window !== "undefined" && window.navigator) {
    return !!/* @__PURE__ */ navigator.userAgent.match(pattern);
  }
}
var IE11OrLess = userAgent(/(?:Trident.*rv[ :]?11\.|msie|iemobile|Windows Phone)/i);
var Edge = userAgent(/Edge/i);
var FireFox = userAgent(/firefox/i);
var Safari = userAgent(/safari/i) && !userAgent(/chrome/i) && !userAgent(/android/i);
var IOS = userAgent(/iP(ad|od|hone)/i);
var ChromeForAndroid = userAgent(/chrome/i) && userAgent(/android/i);
var captureMode = {
  capture: false,
  passive: false
};
function on(el, event, fn) {
  el.addEventListener(event, fn, !IE11OrLess && captureMode);
}
function off(el, event, fn) {
  el.removeEventListener(event, fn, !IE11OrLess && captureMode);
}
function matches(el, selector) {
  if (!selector) return;
  selector[0] === ">" && (selector = selector.substring(1));
  if (el) {
    try {
      if (el.matches) {
        return el.matches(selector);
      } else if (el.msMatchesSelector) {
        return el.msMatchesSelector(selector);
      } else if (el.webkitMatchesSelector) {
        return el.webkitMatchesSelector(selector);
      }
    } catch (_2) {
      return false;
    }
  }
  return false;
}
function getParentOrHost(el) {
  return el.host && el !== document && el.host.nodeType ? el.host : el.parentNode;
}
function closest(el, selector, ctx, includeCTX) {
  if (el) {
    ctx = ctx || document;
    do {
      if (selector != null && (selector[0] === ">" ? el.parentNode === ctx && matches(el, selector) : matches(el, selector)) || includeCTX && el === ctx) {
        return el;
      }
      if (el === ctx) break;
    } while (el = getParentOrHost(el));
  }
  return null;
}
var R_SPACE = /\s+/g;
function toggleClass(el, name, state) {
  if (el && name) {
    if (el.classList) {
      el.classList[state ? "add" : "remove"](name);
    } else {
      var className = (" " + el.className + " ").replace(R_SPACE, " ").replace(" " + name + " ", " ");
      el.className = (className + (state ? " " + name : "")).replace(R_SPACE, " ");
    }
  }
}
function css(el, prop, val) {
  var style = el && el.style;
  if (style) {
    if (val === void 0) {
      if (document.defaultView && document.defaultView.getComputedStyle) {
        val = document.defaultView.getComputedStyle(el, "");
      } else if (el.currentStyle) {
        val = el.currentStyle;
      }
      return prop === void 0 ? val : val[prop];
    } else {
      if (!(prop in style) && prop.indexOf("webkit") === -1) {
        prop = "-webkit-" + prop;
      }
      style[prop] = val + (typeof val === "string" ? "" : "px");
    }
  }
}
function matrix(el, selfOnly) {
  var appliedTransforms = "";
  if (typeof el === "string") {
    appliedTransforms = el;
  } else {
    do {
      var transform = css(el, "transform");
      if (transform && transform !== "none") {
        appliedTransforms = transform + " " + appliedTransforms;
      }
    } while (!selfOnly && (el = el.parentNode));
  }
  var matrixFn = window.DOMMatrix || window.WebKitCSSMatrix || window.CSSMatrix || window.MSCSSMatrix;
  return matrixFn && new matrixFn(appliedTransforms);
}
function find(ctx, tagName, iterator) {
  if (ctx) {
    var list = ctx.getElementsByTagName(tagName), i2 = 0, n2 = list.length;
    if (iterator) {
      for (; i2 < n2; i2++) {
        iterator(list[i2], i2);
      }
    }
    return list;
  }
  return [];
}
function getWindowScrollingElement() {
  var scrollingElement = document.scrollingElement;
  if (scrollingElement) {
    return scrollingElement;
  } else {
    return document.documentElement;
  }
}
function getRect(el, relativeToContainingBlock, relativeToNonStaticParent, undoScale, container) {
  if (!el.getBoundingClientRect && el !== window) return;
  var elRect, top, left, bottom, right, height, width;
  if (el !== window && el.parentNode && el !== getWindowScrollingElement()) {
    elRect = el.getBoundingClientRect();
    top = elRect.top;
    left = elRect.left;
    bottom = elRect.bottom;
    right = elRect.right;
    height = elRect.height;
    width = elRect.width;
  } else {
    top = 0;
    left = 0;
    bottom = window.innerHeight;
    right = window.innerWidth;
    height = window.innerHeight;
    width = window.innerWidth;
  }
  if ((relativeToContainingBlock || relativeToNonStaticParent) && el !== window) {
    container = container || el.parentNode;
    if (!IE11OrLess) {
      do {
        if (container && container.getBoundingClientRect && (css(container, "transform") !== "none" || relativeToNonStaticParent && css(container, "position") !== "static")) {
          var containerRect = container.getBoundingClientRect();
          top -= containerRect.top + parseInt(css(container, "border-top-width"));
          left -= containerRect.left + parseInt(css(container, "border-left-width"));
          bottom = top + elRect.height;
          right = left + elRect.width;
          break;
        }
      } while (container = container.parentNode);
    }
  }
  if (undoScale && el !== window) {
    var elMatrix = matrix(container || el), scaleX = elMatrix && elMatrix.a, scaleY = elMatrix && elMatrix.d;
    if (elMatrix) {
      top /= scaleY;
      left /= scaleX;
      width /= scaleX;
      height /= scaleY;
      bottom = top + height;
      right = left + width;
    }
  }
  return {
    top,
    left,
    bottom,
    right,
    width,
    height
  };
}
function isScrolledPast(el, elSide, parentSide) {
  var parent = getParentAutoScrollElement(el, true), elSideVal = getRect(el)[elSide];
  while (parent) {
    var parentSideVal = getRect(parent)[parentSide], visible = void 0;
    if (parentSide === "top" || parentSide === "left") {
      visible = elSideVal >= parentSideVal;
    } else {
      visible = elSideVal <= parentSideVal;
    }
    if (!visible) return parent;
    if (parent === getWindowScrollingElement()) break;
    parent = getParentAutoScrollElement(parent, false);
  }
  return false;
}
function getChild(el, childNum, options, includeDragEl) {
  var currentChild = 0, i2 = 0, children = el.children;
  while (i2 < children.length) {
    if (children[i2].style.display !== "none" && children[i2] !== Sortable.ghost && (includeDragEl || children[i2] !== Sortable.dragged) && closest(children[i2], options.draggable, el, false)) {
      if (currentChild === childNum) {
        return children[i2];
      }
      currentChild++;
    }
    i2++;
  }
  return null;
}
function lastChild(el, selector) {
  var last = el.lastElementChild;
  while (last && (last === Sortable.ghost || css(last, "display") === "none" || selector && !matches(last, selector))) {
    last = last.previousElementSibling;
  }
  return last || null;
}
function index(el, selector) {
  var index2 = 0;
  if (!el || !el.parentNode) {
    return -1;
  }
  while (el = el.previousElementSibling) {
    if (el.nodeName.toUpperCase() !== "TEMPLATE" && el !== Sortable.clone && (!selector || matches(el, selector))) {
      index2++;
    }
  }
  return index2;
}
function getRelativeScrollOffset(el) {
  var offsetLeft = 0, offsetTop = 0, winScroller = getWindowScrollingElement();
  if (el) {
    do {
      var elMatrix = matrix(el), scaleX = elMatrix.a, scaleY = elMatrix.d;
      offsetLeft += el.scrollLeft * scaleX;
      offsetTop += el.scrollTop * scaleY;
    } while (el !== winScroller && (el = el.parentNode));
  }
  return [offsetLeft, offsetTop];
}
function indexOfObject(arr, obj) {
  for (var i2 in arr) {
    if (!arr.hasOwnProperty(i2)) continue;
    for (var key in obj) {
      if (obj.hasOwnProperty(key) && obj[key] === arr[i2][key]) return Number(i2);
    }
  }
  return -1;
}
function getParentAutoScrollElement(el, includeSelf) {
  if (!el || !el.getBoundingClientRect) return getWindowScrollingElement();
  var elem = el;
  var gotSelf = false;
  do {
    if (elem.clientWidth < elem.scrollWidth || elem.clientHeight < elem.scrollHeight) {
      var elemCSS = css(elem);
      if (elem.clientWidth < elem.scrollWidth && (elemCSS.overflowX == "auto" || elemCSS.overflowX == "scroll") || elem.clientHeight < elem.scrollHeight && (elemCSS.overflowY == "auto" || elemCSS.overflowY == "scroll")) {
        if (!elem.getBoundingClientRect || elem === document.body) return getWindowScrollingElement();
        if (gotSelf || includeSelf) return elem;
        gotSelf = true;
      }
    }
  } while (elem = elem.parentNode);
  return getWindowScrollingElement();
}
function extend(dst, src) {
  if (dst && src) {
    for (var key in src) {
      if (src.hasOwnProperty(key)) {
        dst[key] = src[key];
      }
    }
  }
  return dst;
}
function isRectEqual(rect1, rect2) {
  return Math.round(rect1.top) === Math.round(rect2.top) && Math.round(rect1.left) === Math.round(rect2.left) && Math.round(rect1.height) === Math.round(rect2.height) && Math.round(rect1.width) === Math.round(rect2.width);
}
var _throttleTimeout;
function throttle(callback, ms) {
  return function() {
    if (!_throttleTimeout) {
      var args = arguments, _this = this;
      if (args.length === 1) {
        callback.call(_this, args[0]);
      } else {
        callback.apply(_this, args);
      }
      _throttleTimeout = setTimeout(function() {
        _throttleTimeout = void 0;
      }, ms);
    }
  };
}
function cancelThrottle() {
  clearTimeout(_throttleTimeout);
  _throttleTimeout = void 0;
}
function scrollBy(el, x2, y2) {
  el.scrollLeft += x2;
  el.scrollTop += y2;
}
function clone(el) {
  var Polymer = window.Polymer;
  var $2 = window.jQuery || window.Zepto;
  if (Polymer && Polymer.dom) {
    return Polymer.dom(el).cloneNode(true);
  } else if ($2) {
    return $2(el).clone(true)[0];
  } else {
    return el.cloneNode(true);
  }
}
function getChildContainingRectFromElement(container, options, ghostEl2) {
  var rect = {};
  Array.from(container.children).forEach(function(child) {
    var _rect$left, _rect$top, _rect$right, _rect$bottom;
    if (!closest(child, options.draggable, container, false) || child.animated || child === ghostEl2) return;
    var childRect = getRect(child);
    rect.left = Math.min((_rect$left = rect.left) !== null && _rect$left !== void 0 ? _rect$left : Infinity, childRect.left);
    rect.top = Math.min((_rect$top = rect.top) !== null && _rect$top !== void 0 ? _rect$top : Infinity, childRect.top);
    rect.right = Math.max((_rect$right = rect.right) !== null && _rect$right !== void 0 ? _rect$right : -Infinity, childRect.right);
    rect.bottom = Math.max((_rect$bottom = rect.bottom) !== null && _rect$bottom !== void 0 ? _rect$bottom : -Infinity, childRect.bottom);
  });
  rect.width = rect.right - rect.left;
  rect.height = rect.bottom - rect.top;
  rect.x = rect.left;
  rect.y = rect.top;
  return rect;
}
var expando = "Sortable" + (/* @__PURE__ */ new Date()).getTime();
function AnimationStateManager() {
  var animationStates = [], animationCallbackId;
  return {
    captureAnimationState: function captureAnimationState() {
      animationStates = [];
      if (!this.options.animation) return;
      var children = [].slice.call(this.el.children);
      children.forEach(function(child) {
        if (css(child, "display") === "none" || child === Sortable.ghost) return;
        animationStates.push({
          target: child,
          rect: getRect(child)
        });
        var fromRect = _objectSpread2({}, animationStates[animationStates.length - 1].rect);
        if (child.thisAnimationDuration) {
          var childMatrix = matrix(child, true);
          if (childMatrix) {
            fromRect.top -= childMatrix.f;
            fromRect.left -= childMatrix.e;
          }
        }
        child.fromRect = fromRect;
      });
    },
    addAnimationState: function addAnimationState(state) {
      animationStates.push(state);
    },
    removeAnimationState: function removeAnimationState(target) {
      animationStates.splice(indexOfObject(animationStates, {
        target
      }), 1);
    },
    animateAll: function animateAll(callback) {
      var _this = this;
      if (!this.options.animation) {
        clearTimeout(animationCallbackId);
        if (typeof callback === "function") callback();
        return;
      }
      var animating = false, animationTime = 0;
      animationStates.forEach(function(state) {
        var time = 0, target = state.target, fromRect = target.fromRect, toRect = getRect(target), prevFromRect = target.prevFromRect, prevToRect = target.prevToRect, animatingRect = state.rect, targetMatrix = matrix(target, true);
        if (targetMatrix) {
          toRect.top -= targetMatrix.f;
          toRect.left -= targetMatrix.e;
        }
        target.toRect = toRect;
        if (target.thisAnimationDuration) {
          if (isRectEqual(prevFromRect, toRect) && !isRectEqual(fromRect, toRect) && // Make sure animatingRect is on line between toRect & fromRect
          (animatingRect.top - toRect.top) / (animatingRect.left - toRect.left) === (fromRect.top - toRect.top) / (fromRect.left - toRect.left)) {
            time = calculateRealTime(animatingRect, prevFromRect, prevToRect, _this.options);
          }
        }
        if (!isRectEqual(toRect, fromRect)) {
          target.prevFromRect = fromRect;
          target.prevToRect = toRect;
          if (!time) {
            time = _this.options.animation;
          }
          _this.animate(target, animatingRect, toRect, time);
        }
        if (time) {
          animating = true;
          animationTime = Math.max(animationTime, time);
          clearTimeout(target.animationResetTimer);
          target.animationResetTimer = setTimeout(function() {
            target.animationTime = 0;
            target.prevFromRect = null;
            target.fromRect = null;
            target.prevToRect = null;
            target.thisAnimationDuration = null;
          }, time);
          target.thisAnimationDuration = time;
        }
      });
      clearTimeout(animationCallbackId);
      if (!animating) {
        if (typeof callback === "function") callback();
      } else {
        animationCallbackId = setTimeout(function() {
          if (typeof callback === "function") callback();
        }, animationTime);
      }
      animationStates = [];
    },
    animate: function animate(target, currentRect, toRect, duration) {
      if (duration) {
        css(target, "transition", "");
        css(target, "transform", "");
        var elMatrix = matrix(this.el), scaleX = elMatrix && elMatrix.a, scaleY = elMatrix && elMatrix.d, translateX = (currentRect.left - toRect.left) / (scaleX || 1), translateY = (currentRect.top - toRect.top) / (scaleY || 1);
        target.animatingX = !!translateX;
        target.animatingY = !!translateY;
        css(target, "transform", "translate3d(" + translateX + "px," + translateY + "px,0)");
        this.forRepaintDummy = repaint(target);
        css(target, "transition", "transform " + duration + "ms" + (this.options.easing ? " " + this.options.easing : ""));
        css(target, "transform", "translate3d(0,0,0)");
        typeof target.animated === "number" && clearTimeout(target.animated);
        target.animated = setTimeout(function() {
          css(target, "transition", "");
          css(target, "transform", "");
          target.animated = false;
          target.animatingX = false;
          target.animatingY = false;
        }, duration);
      }
    }
  };
}
function repaint(target) {
  return target.offsetWidth;
}
function calculateRealTime(animatingRect, fromRect, toRect, options) {
  return Math.sqrt(Math.pow(fromRect.top - animatingRect.top, 2) + Math.pow(fromRect.left - animatingRect.left, 2)) / Math.sqrt(Math.pow(fromRect.top - toRect.top, 2) + Math.pow(fromRect.left - toRect.left, 2)) * options.animation;
}
var plugins = [];
var defaults = {
  initializeByDefault: true
};
var PluginManager = {
  mount: function mount(plugin) {
    for (var option2 in defaults) {
      if (defaults.hasOwnProperty(option2) && !(option2 in plugin)) {
        plugin[option2] = defaults[option2];
      }
    }
    plugins.forEach(function(p2) {
      if (p2.pluginName === plugin.pluginName) {
        throw "Sortable: Cannot mount plugin ".concat(plugin.pluginName, " more than once");
      }
    });
    plugins.push(plugin);
  },
  pluginEvent: function pluginEvent(eventName, sortable, evt) {
    var _this = this;
    this.eventCanceled = false;
    evt.cancel = function() {
      _this.eventCanceled = true;
    };
    var eventNameGlobal = eventName + "Global";
    plugins.forEach(function(plugin) {
      if (!sortable[plugin.pluginName]) return;
      if (sortable[plugin.pluginName][eventNameGlobal]) {
        sortable[plugin.pluginName][eventNameGlobal](_objectSpread2({
          sortable
        }, evt));
      }
      if (sortable.options[plugin.pluginName] && sortable[plugin.pluginName][eventName]) {
        sortable[plugin.pluginName][eventName](_objectSpread2({
          sortable
        }, evt));
      }
    });
  },
  initializePlugins: function initializePlugins(sortable, el, defaults2, options) {
    plugins.forEach(function(plugin) {
      var pluginName = plugin.pluginName;
      if (!sortable.options[pluginName] && !plugin.initializeByDefault) return;
      var initialized = new plugin(sortable, el, sortable.options);
      initialized.sortable = sortable;
      initialized.options = sortable.options;
      sortable[pluginName] = initialized;
      _extends(defaults2, initialized.defaults);
    });
    for (var option2 in sortable.options) {
      if (!sortable.options.hasOwnProperty(option2)) continue;
      var modified = this.modifyOption(sortable, option2, sortable.options[option2]);
      if (typeof modified !== "undefined") {
        sortable.options[option2] = modified;
      }
    }
  },
  getEventProperties: function getEventProperties(name, sortable) {
    var eventProperties = {};
    plugins.forEach(function(plugin) {
      if (typeof plugin.eventProperties !== "function") return;
      _extends(eventProperties, plugin.eventProperties.call(sortable[plugin.pluginName], name));
    });
    return eventProperties;
  },
  modifyOption: function modifyOption(sortable, name, value) {
    var modifiedValue;
    plugins.forEach(function(plugin) {
      if (!sortable[plugin.pluginName]) return;
      if (plugin.optionListeners && typeof plugin.optionListeners[name] === "function") {
        modifiedValue = plugin.optionListeners[name].call(sortable[plugin.pluginName], value);
      }
    });
    return modifiedValue;
  }
};
function dispatchEvent(_ref) {
  var sortable = _ref.sortable, rootEl2 = _ref.rootEl, name = _ref.name, targetEl = _ref.targetEl, cloneEl2 = _ref.cloneEl, toEl = _ref.toEl, fromEl = _ref.fromEl, oldIndex2 = _ref.oldIndex, newIndex2 = _ref.newIndex, oldDraggableIndex2 = _ref.oldDraggableIndex, newDraggableIndex2 = _ref.newDraggableIndex, originalEvent = _ref.originalEvent, putSortable2 = _ref.putSortable, extraEventProperties = _ref.extraEventProperties;
  sortable = sortable || rootEl2 && rootEl2[expando];
  if (!sortable) return;
  var evt, options = sortable.options, onName = "on" + name.charAt(0).toUpperCase() + name.substr(1);
  if (window.CustomEvent && !IE11OrLess && !Edge) {
    evt = new CustomEvent(name, {
      bubbles: true,
      cancelable: true
    });
  } else {
    evt = document.createEvent("Event");
    evt.initEvent(name, true, true);
  }
  evt.to = toEl || rootEl2;
  evt.from = fromEl || rootEl2;
  evt.item = targetEl || rootEl2;
  evt.clone = cloneEl2;
  evt.oldIndex = oldIndex2;
  evt.newIndex = newIndex2;
  evt.oldDraggableIndex = oldDraggableIndex2;
  evt.newDraggableIndex = newDraggableIndex2;
  evt.originalEvent = originalEvent;
  evt.pullMode = putSortable2 ? putSortable2.lastPutMode : void 0;
  var allEventProperties = _objectSpread2(_objectSpread2({}, extraEventProperties), PluginManager.getEventProperties(name, sortable));
  for (var option2 in allEventProperties) {
    evt[option2] = allEventProperties[option2];
  }
  if (rootEl2) {
    rootEl2.dispatchEvent(evt);
  }
  if (options[onName]) {
    options[onName].call(sortable, evt);
  }
}
var _excluded = ["evt"];
var pluginEvent2 = function pluginEvent3(eventName, sortable) {
  var _ref = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : {}, originalEvent = _ref.evt, data = _objectWithoutProperties(_ref, _excluded);
  PluginManager.pluginEvent.bind(Sortable)(eventName, sortable, _objectSpread2({
    dragEl,
    parentEl,
    ghostEl,
    rootEl,
    nextEl,
    lastDownEl,
    cloneEl,
    cloneHidden,
    dragStarted: moved,
    putSortable,
    activeSortable: Sortable.active,
    originalEvent,
    oldIndex,
    oldDraggableIndex,
    newIndex,
    newDraggableIndex,
    hideGhostForTarget: _hideGhostForTarget,
    unhideGhostForTarget: _unhideGhostForTarget,
    cloneNowHidden: function cloneNowHidden() {
      cloneHidden = true;
    },
    cloneNowShown: function cloneNowShown() {
      cloneHidden = false;
    },
    dispatchSortableEvent: function dispatchSortableEvent(name) {
      _dispatchEvent({
        sortable,
        name,
        originalEvent
      });
    }
  }, data));
};
function _dispatchEvent(info) {
  dispatchEvent(_objectSpread2({
    putSortable,
    cloneEl,
    targetEl: dragEl,
    rootEl,
    oldIndex,
    oldDraggableIndex,
    newIndex,
    newDraggableIndex
  }, info));
}
var dragEl;
var parentEl;
var ghostEl;
var rootEl;
var nextEl;
var lastDownEl;
var cloneEl;
var cloneHidden;
var oldIndex;
var newIndex;
var oldDraggableIndex;
var newDraggableIndex;
var activeGroup;
var putSortable;
var awaitingDragStarted = false;
var ignoreNextClick = false;
var sortables = [];
var tapEvt;
var touchEvt;
var lastDx;
var lastDy;
var tapDistanceLeft;
var tapDistanceTop;
var moved;
var lastTarget;
var lastDirection;
var pastFirstInvertThresh = false;
var isCircumstantialInvert = false;
var targetMoveDistance;
var ghostRelativeParent;
var ghostRelativeParentInitialScroll = [];
var _silent = false;
var savedInputChecked = [];
var documentExists = typeof document !== "undefined";
var PositionGhostAbsolutely = IOS;
var CSSFloatProperty = Edge || IE11OrLess ? "cssFloat" : "float";
var supportDraggable = documentExists && !ChromeForAndroid && !IOS && "draggable" in document.createElement("div");
var supportCssPointerEvents = function() {
  if (!documentExists) return;
  if (IE11OrLess) {
    return false;
  }
  var el = document.createElement("x");
  el.style.cssText = "pointer-events:auto";
  return el.style.pointerEvents === "auto";
}();
var _detectDirection = function _detectDirection2(el, options) {
  var elCSS = css(el), elWidth = parseInt(elCSS.width) - parseInt(elCSS.paddingLeft) - parseInt(elCSS.paddingRight) - parseInt(elCSS.borderLeftWidth) - parseInt(elCSS.borderRightWidth), child1 = getChild(el, 0, options), child2 = getChild(el, 1, options), firstChildCSS = child1 && css(child1), secondChildCSS = child2 && css(child2), firstChildWidth = firstChildCSS && parseInt(firstChildCSS.marginLeft) + parseInt(firstChildCSS.marginRight) + getRect(child1).width, secondChildWidth = secondChildCSS && parseInt(secondChildCSS.marginLeft) + parseInt(secondChildCSS.marginRight) + getRect(child2).width;
  if (elCSS.display === "flex") {
    return elCSS.flexDirection === "column" || elCSS.flexDirection === "column-reverse" ? "vertical" : "horizontal";
  }
  if (elCSS.display === "grid") {
    return elCSS.gridTemplateColumns.split(" ").length <= 1 ? "vertical" : "horizontal";
  }
  if (child1 && firstChildCSS["float"] && firstChildCSS["float"] !== "none") {
    var touchingSideChild2 = firstChildCSS["float"] === "left" ? "left" : "right";
    return child2 && (secondChildCSS.clear === "both" || secondChildCSS.clear === touchingSideChild2) ? "vertical" : "horizontal";
  }
  return child1 && (firstChildCSS.display === "block" || firstChildCSS.display === "flex" || firstChildCSS.display === "table" || firstChildCSS.display === "grid" || firstChildWidth >= elWidth && elCSS[CSSFloatProperty] === "none" || child2 && elCSS[CSSFloatProperty] === "none" && firstChildWidth + secondChildWidth > elWidth) ? "vertical" : "horizontal";
};
var _dragElInRowColumn = function _dragElInRowColumn2(dragRect, targetRect, vertical) {
  var dragElS1Opp = vertical ? dragRect.left : dragRect.top, dragElS2Opp = vertical ? dragRect.right : dragRect.bottom, dragElOppLength = vertical ? dragRect.width : dragRect.height, targetS1Opp = vertical ? targetRect.left : targetRect.top, targetS2Opp = vertical ? targetRect.right : targetRect.bottom, targetOppLength = vertical ? targetRect.width : targetRect.height;
  return dragElS1Opp === targetS1Opp || dragElS2Opp === targetS2Opp || dragElS1Opp + dragElOppLength / 2 === targetS1Opp + targetOppLength / 2;
};
var _detectNearestEmptySortable = function _detectNearestEmptySortable2(x2, y2) {
  var ret;
  sortables.some(function(sortable) {
    var threshold = sortable[expando].options.emptyInsertThreshold;
    if (!threshold || lastChild(sortable)) return;
    var rect = getRect(sortable), insideHorizontally = x2 >= rect.left - threshold && x2 <= rect.right + threshold, insideVertically = y2 >= rect.top - threshold && y2 <= rect.bottom + threshold;
    if (insideHorizontally && insideVertically) {
      return ret = sortable;
    }
  });
  return ret;
};
var _prepareGroup = function _prepareGroup2(options) {
  function toFn(value, pull) {
    return function(to, from, dragEl2, evt) {
      var sameGroup = to.options.group.name && from.options.group.name && to.options.group.name === from.options.group.name;
      if (value == null && (pull || sameGroup)) {
        return true;
      } else if (value == null || value === false) {
        return false;
      } else if (pull && value === "clone") {
        return value;
      } else if (typeof value === "function") {
        return toFn(value(to, from, dragEl2, evt), pull)(to, from, dragEl2, evt);
      } else {
        var otherGroup = (pull ? to : from).options.group.name;
        return value === true || typeof value === "string" && value === otherGroup || value.join && value.indexOf(otherGroup) > -1;
      }
    };
  }
  var group = {};
  var originalGroup = options.group;
  if (!originalGroup || _typeof(originalGroup) != "object") {
    originalGroup = {
      name: originalGroup
    };
  }
  group.name = originalGroup.name;
  group.checkPull = toFn(originalGroup.pull, true);
  group.checkPut = toFn(originalGroup.put);
  group.revertClone = originalGroup.revertClone;
  options.group = group;
};
var _hideGhostForTarget = function _hideGhostForTarget2() {
  if (!supportCssPointerEvents && ghostEl) {
    css(ghostEl, "display", "none");
  }
};
var _unhideGhostForTarget = function _unhideGhostForTarget2() {
  if (!supportCssPointerEvents && ghostEl) {
    css(ghostEl, "display", "");
  }
};
if (documentExists && !ChromeForAndroid) {
  document.addEventListener("click", function(evt) {
    if (ignoreNextClick) {
      evt.preventDefault();
      evt.stopPropagation && evt.stopPropagation();
      evt.stopImmediatePropagation && evt.stopImmediatePropagation();
      ignoreNextClick = false;
      return false;
    }
  }, true);
}
var nearestEmptyInsertDetectEvent = function nearestEmptyInsertDetectEvent2(evt) {
  if (dragEl) {
    evt = evt.touches ? evt.touches[0] : evt;
    var nearest = _detectNearestEmptySortable(evt.clientX, evt.clientY);
    if (nearest) {
      var event = {};
      for (var i2 in evt) {
        if (evt.hasOwnProperty(i2)) {
          event[i2] = evt[i2];
        }
      }
      event.target = event.rootEl = nearest;
      event.preventDefault = void 0;
      event.stopPropagation = void 0;
      nearest[expando]._onDragOver(event);
    }
  }
};
var _checkOutsideTargetEl = function _checkOutsideTargetEl2(evt) {
  if (dragEl) {
    dragEl.parentNode[expando]._isOutsideThisEl(evt.target);
  }
};
function Sortable(el, options) {
  if (!(el && el.nodeType && el.nodeType === 1)) {
    throw "Sortable: `el` must be an HTMLElement, not ".concat({}.toString.call(el));
  }
  this.el = el;
  this.options = options = _extends({}, options);
  el[expando] = this;
  var defaults2 = {
    group: null,
    sort: true,
    disabled: false,
    store: null,
    handle: null,
    draggable: /^[uo]l$/i.test(el.nodeName) ? ">li" : ">*",
    swapThreshold: 1,
    // percentage; 0 <= x <= 1
    invertSwap: false,
    // invert always
    invertedSwapThreshold: null,
    // will be set to same as swapThreshold if default
    removeCloneOnHide: true,
    direction: function direction() {
      return _detectDirection(el, this.options);
    },
    ghostClass: "sortable-ghost",
    chosenClass: "sortable-chosen",
    dragClass: "sortable-drag",
    ignore: "a, img",
    filter: null,
    preventOnFilter: true,
    animation: 0,
    easing: null,
    setData: function setData(dataTransfer, dragEl2) {
      dataTransfer.setData("Text", dragEl2.textContent);
    },
    dropBubble: false,
    dragoverBubble: false,
    dataIdAttr: "data-id",
    delay: 0,
    delayOnTouchOnly: false,
    touchStartThreshold: (Number.parseInt ? Number : window).parseInt(window.devicePixelRatio, 10) || 1,
    forceFallback: false,
    fallbackClass: "sortable-fallback",
    fallbackOnBody: false,
    fallbackTolerance: 0,
    fallbackOffset: {
      x: 0,
      y: 0
    },
    // Disabled on Safari: #1571; Enabled on Safari IOS: #2244
    supportPointer: Sortable.supportPointer !== false && "PointerEvent" in window && (!Safari || IOS),
    emptyInsertThreshold: 5
  };
  PluginManager.initializePlugins(this, el, defaults2);
  for (var name in defaults2) {
    !(name in options) && (options[name] = defaults2[name]);
  }
  _prepareGroup(options);
  for (var fn in this) {
    if (fn.charAt(0) === "_" && typeof this[fn] === "function") {
      this[fn] = this[fn].bind(this);
    }
  }
  this.nativeDraggable = options.forceFallback ? false : supportDraggable;
  if (this.nativeDraggable) {
    this.options.touchStartThreshold = 1;
  }
  if (options.supportPointer) {
    on(el, "pointerdown", this._onTapStart);
  } else {
    on(el, "mousedown", this._onTapStart);
    on(el, "touchstart", this._onTapStart);
  }
  if (this.nativeDraggable) {
    on(el, "dragover", this);
    on(el, "dragenter", this);
  }
  sortables.push(this.el);
  options.store && options.store.get && this.sort(options.store.get(this) || []);
  _extends(this, AnimationStateManager());
}
Sortable.prototype = /** @lends Sortable.prototype */
{
  constructor: Sortable,
  _isOutsideThisEl: function _isOutsideThisEl(target) {
    if (!this.el.contains(target) && target !== this.el) {
      lastTarget = null;
    }
  },
  _getDirection: function _getDirection(evt, target) {
    return typeof this.options.direction === "function" ? this.options.direction.call(this, evt, target, dragEl) : this.options.direction;
  },
  _onTapStart: function _onTapStart(evt) {
    if (!evt.cancelable) return;
    var _this = this, el = this.el, options = this.options, preventOnFilter = options.preventOnFilter, type = evt.type, touch = evt.touches && evt.touches[0] || evt.pointerType && evt.pointerType === "touch" && evt, target = (touch || evt).target, originalTarget = evt.target.shadowRoot && (evt.path && evt.path[0] || evt.composedPath && evt.composedPath()[0]) || target, filter = options.filter;
    _saveInputCheckedState(el);
    if (dragEl) {
      return;
    }
    if (/mousedown|pointerdown/.test(type) && evt.button !== 0 || options.disabled) {
      return;
    }
    if (originalTarget.isContentEditable) {
      return;
    }
    if (!this.nativeDraggable && Safari && target && target.tagName.toUpperCase() === "SELECT") {
      return;
    }
    target = closest(target, options.draggable, el, false);
    if (target && target.animated) {
      return;
    }
    if (lastDownEl === target) {
      return;
    }
    oldIndex = index(target);
    oldDraggableIndex = index(target, options.draggable);
    if (typeof filter === "function") {
      if (filter.call(this, evt, target, this)) {
        _dispatchEvent({
          sortable: _this,
          rootEl: originalTarget,
          name: "filter",
          targetEl: target,
          toEl: el,
          fromEl: el
        });
        pluginEvent2("filter", _this, {
          evt
        });
        preventOnFilter && evt.preventDefault();
        return;
      }
    } else if (filter) {
      filter = filter.split(",").some(function(criteria) {
        criteria = closest(originalTarget, criteria.trim(), el, false);
        if (criteria) {
          _dispatchEvent({
            sortable: _this,
            rootEl: criteria,
            name: "filter",
            targetEl: target,
            fromEl: el,
            toEl: el
          });
          pluginEvent2("filter", _this, {
            evt
          });
          return true;
        }
      });
      if (filter) {
        preventOnFilter && evt.preventDefault();
        return;
      }
    }
    if (options.handle && !closest(originalTarget, options.handle, el, false)) {
      return;
    }
    this._prepareDragStart(evt, touch, target);
  },
  _prepareDragStart: function _prepareDragStart(evt, touch, target) {
    var _this = this, el = _this.el, options = _this.options, ownerDocument = el.ownerDocument, dragStartFn;
    if (target && !dragEl && target.parentNode === el) {
      var dragRect = getRect(target);
      rootEl = el;
      dragEl = target;
      parentEl = dragEl.parentNode;
      nextEl = dragEl.nextSibling;
      lastDownEl = target;
      activeGroup = options.group;
      Sortable.dragged = dragEl;
      tapEvt = {
        target: dragEl,
        clientX: (touch || evt).clientX,
        clientY: (touch || evt).clientY
      };
      tapDistanceLeft = tapEvt.clientX - dragRect.left;
      tapDistanceTop = tapEvt.clientY - dragRect.top;
      this._lastX = (touch || evt).clientX;
      this._lastY = (touch || evt).clientY;
      dragEl.style["will-change"] = "all";
      dragStartFn = function dragStartFn2() {
        pluginEvent2("delayEnded", _this, {
          evt
        });
        if (Sortable.eventCanceled) {
          _this._onDrop();
          return;
        }
        _this._disableDelayedDragEvents();
        if (!FireFox && _this.nativeDraggable) {
          dragEl.draggable = true;
        }
        _this._triggerDragStart(evt, touch);
        _dispatchEvent({
          sortable: _this,
          name: "choose",
          originalEvent: evt
        });
        toggleClass(dragEl, options.chosenClass, true);
      };
      options.ignore.split(",").forEach(function(criteria) {
        find(dragEl, criteria.trim(), _disableDraggable);
      });
      on(ownerDocument, "dragover", nearestEmptyInsertDetectEvent);
      on(ownerDocument, "mousemove", nearestEmptyInsertDetectEvent);
      on(ownerDocument, "touchmove", nearestEmptyInsertDetectEvent);
      if (options.supportPointer) {
        on(ownerDocument, "pointerup", _this._onDrop);
        !this.nativeDraggable && on(ownerDocument, "pointercancel", _this._onDrop);
      } else {
        on(ownerDocument, "mouseup", _this._onDrop);
        on(ownerDocument, "touchend", _this._onDrop);
        on(ownerDocument, "touchcancel", _this._onDrop);
      }
      if (FireFox && this.nativeDraggable) {
        this.options.touchStartThreshold = 4;
        dragEl.draggable = true;
      }
      pluginEvent2("delayStart", this, {
        evt
      });
      if (options.delay && (!options.delayOnTouchOnly || touch) && (!this.nativeDraggable || !(Edge || IE11OrLess))) {
        if (Sortable.eventCanceled) {
          this._onDrop();
          return;
        }
        if (options.supportPointer) {
          on(ownerDocument, "pointerup", _this._disableDelayedDrag);
          on(ownerDocument, "pointercancel", _this._disableDelayedDrag);
        } else {
          on(ownerDocument, "mouseup", _this._disableDelayedDrag);
          on(ownerDocument, "touchend", _this._disableDelayedDrag);
          on(ownerDocument, "touchcancel", _this._disableDelayedDrag);
        }
        on(ownerDocument, "mousemove", _this._delayedDragTouchMoveHandler);
        on(ownerDocument, "touchmove", _this._delayedDragTouchMoveHandler);
        options.supportPointer && on(ownerDocument, "pointermove", _this._delayedDragTouchMoveHandler);
        _this._dragStartTimer = setTimeout(dragStartFn, options.delay);
      } else {
        dragStartFn();
      }
    }
  },
  _delayedDragTouchMoveHandler: function _delayedDragTouchMoveHandler(e2) {
    var touch = e2.touches ? e2.touches[0] : e2;
    if (Math.max(Math.abs(touch.clientX - this._lastX), Math.abs(touch.clientY - this._lastY)) >= Math.floor(this.options.touchStartThreshold / (this.nativeDraggable && window.devicePixelRatio || 1))) {
      this._disableDelayedDrag();
    }
  },
  _disableDelayedDrag: function _disableDelayedDrag() {
    dragEl && _disableDraggable(dragEl);
    clearTimeout(this._dragStartTimer);
    this._disableDelayedDragEvents();
  },
  _disableDelayedDragEvents: function _disableDelayedDragEvents() {
    var ownerDocument = this.el.ownerDocument;
    off(ownerDocument, "mouseup", this._disableDelayedDrag);
    off(ownerDocument, "touchend", this._disableDelayedDrag);
    off(ownerDocument, "touchcancel", this._disableDelayedDrag);
    off(ownerDocument, "pointerup", this._disableDelayedDrag);
    off(ownerDocument, "pointercancel", this._disableDelayedDrag);
    off(ownerDocument, "mousemove", this._delayedDragTouchMoveHandler);
    off(ownerDocument, "touchmove", this._delayedDragTouchMoveHandler);
    off(ownerDocument, "pointermove", this._delayedDragTouchMoveHandler);
  },
  _triggerDragStart: function _triggerDragStart(evt, touch) {
    touch = touch || evt.pointerType == "touch" && evt;
    if (!this.nativeDraggable || touch) {
      if (this.options.supportPointer) {
        on(document, "pointermove", this._onTouchMove);
      } else if (touch) {
        on(document, "touchmove", this._onTouchMove);
      } else {
        on(document, "mousemove", this._onTouchMove);
      }
    } else {
      on(dragEl, "dragend", this);
      on(rootEl, "dragstart", this._onDragStart);
    }
    try {
      if (document.selection) {
        _nextTick(function() {
          document.selection.empty();
        });
      } else {
        window.getSelection().removeAllRanges();
      }
    } catch (err) {
    }
  },
  _dragStarted: function _dragStarted(fallback, evt) {
    awaitingDragStarted = false;
    if (rootEl && dragEl) {
      pluginEvent2("dragStarted", this, {
        evt
      });
      if (this.nativeDraggable) {
        on(document, "dragover", _checkOutsideTargetEl);
      }
      var options = this.options;
      !fallback && toggleClass(dragEl, options.dragClass, false);
      toggleClass(dragEl, options.ghostClass, true);
      Sortable.active = this;
      fallback && this._appendGhost();
      _dispatchEvent({
        sortable: this,
        name: "start",
        originalEvent: evt
      });
    } else {
      this._nulling();
    }
  },
  _emulateDragOver: function _emulateDragOver() {
    if (touchEvt) {
      this._lastX = touchEvt.clientX;
      this._lastY = touchEvt.clientY;
      _hideGhostForTarget();
      var target = document.elementFromPoint(touchEvt.clientX, touchEvt.clientY);
      var parent = target;
      while (target && target.shadowRoot) {
        target = target.shadowRoot.elementFromPoint(touchEvt.clientX, touchEvt.clientY);
        if (target === parent) break;
        parent = target;
      }
      dragEl.parentNode[expando]._isOutsideThisEl(target);
      if (parent) {
        do {
          if (parent[expando]) {
            var inserted = void 0;
            inserted = parent[expando]._onDragOver({
              clientX: touchEvt.clientX,
              clientY: touchEvt.clientY,
              target,
              rootEl: parent
            });
            if (inserted && !this.options.dragoverBubble) {
              break;
            }
          }
          target = parent;
        } while (parent = getParentOrHost(parent));
      }
      _unhideGhostForTarget();
    }
  },
  _onTouchMove: function _onTouchMove(evt) {
    if (tapEvt) {
      var options = this.options, fallbackTolerance = options.fallbackTolerance, fallbackOffset = options.fallbackOffset, touch = evt.touches ? evt.touches[0] : evt, ghostMatrix = ghostEl && matrix(ghostEl, true), scaleX = ghostEl && ghostMatrix && ghostMatrix.a, scaleY = ghostEl && ghostMatrix && ghostMatrix.d, relativeScrollOffset = PositionGhostAbsolutely && ghostRelativeParent && getRelativeScrollOffset(ghostRelativeParent), dx = (touch.clientX - tapEvt.clientX + fallbackOffset.x) / (scaleX || 1) + (relativeScrollOffset ? relativeScrollOffset[0] - ghostRelativeParentInitialScroll[0] : 0) / (scaleX || 1), dy = (touch.clientY - tapEvt.clientY + fallbackOffset.y) / (scaleY || 1) + (relativeScrollOffset ? relativeScrollOffset[1] - ghostRelativeParentInitialScroll[1] : 0) / (scaleY || 1);
      if (!Sortable.active && !awaitingDragStarted) {
        if (fallbackTolerance && Math.max(Math.abs(touch.clientX - this._lastX), Math.abs(touch.clientY - this._lastY)) < fallbackTolerance) {
          return;
        }
        this._onDragStart(evt, true);
      }
      if (ghostEl) {
        if (ghostMatrix) {
          ghostMatrix.e += dx - (lastDx || 0);
          ghostMatrix.f += dy - (lastDy || 0);
        } else {
          ghostMatrix = {
            a: 1,
            b: 0,
            c: 0,
            d: 1,
            e: dx,
            f: dy
          };
        }
        var cssMatrix = "matrix(".concat(ghostMatrix.a, ",").concat(ghostMatrix.b, ",").concat(ghostMatrix.c, ",").concat(ghostMatrix.d, ",").concat(ghostMatrix.e, ",").concat(ghostMatrix.f, ")");
        css(ghostEl, "webkitTransform", cssMatrix);
        css(ghostEl, "mozTransform", cssMatrix);
        css(ghostEl, "msTransform", cssMatrix);
        css(ghostEl, "transform", cssMatrix);
        lastDx = dx;
        lastDy = dy;
        touchEvt = touch;
      }
      evt.cancelable && evt.preventDefault();
    }
  },
  _appendGhost: function _appendGhost() {
    if (!ghostEl) {
      var container = this.options.fallbackOnBody ? document.body : rootEl, rect = getRect(dragEl, true, PositionGhostAbsolutely, true, container), options = this.options;
      if (PositionGhostAbsolutely) {
        ghostRelativeParent = container;
        while (css(ghostRelativeParent, "position") === "static" && css(ghostRelativeParent, "transform") === "none" && ghostRelativeParent !== document) {
          ghostRelativeParent = ghostRelativeParent.parentNode;
        }
        if (ghostRelativeParent !== document.body && ghostRelativeParent !== document.documentElement) {
          if (ghostRelativeParent === document) ghostRelativeParent = getWindowScrollingElement();
          rect.top += ghostRelativeParent.scrollTop;
          rect.left += ghostRelativeParent.scrollLeft;
        } else {
          ghostRelativeParent = getWindowScrollingElement();
        }
        ghostRelativeParentInitialScroll = getRelativeScrollOffset(ghostRelativeParent);
      }
      ghostEl = dragEl.cloneNode(true);
      toggleClass(ghostEl, options.ghostClass, false);
      toggleClass(ghostEl, options.fallbackClass, true);
      toggleClass(ghostEl, options.dragClass, true);
      css(ghostEl, "transition", "");
      css(ghostEl, "transform", "");
      css(ghostEl, "box-sizing", "border-box");
      css(ghostEl, "margin", 0);
      css(ghostEl, "top", rect.top);
      css(ghostEl, "left", rect.left);
      css(ghostEl, "width", rect.width);
      css(ghostEl, "height", rect.height);
      css(ghostEl, "opacity", "0.8");
      css(ghostEl, "position", PositionGhostAbsolutely ? "absolute" : "fixed");
      css(ghostEl, "zIndex", "100000");
      css(ghostEl, "pointerEvents", "none");
      Sortable.ghost = ghostEl;
      container.appendChild(ghostEl);
      css(ghostEl, "transform-origin", tapDistanceLeft / parseInt(ghostEl.style.width) * 100 + "% " + tapDistanceTop / parseInt(ghostEl.style.height) * 100 + "%");
    }
  },
  _onDragStart: function _onDragStart(evt, fallback) {
    var _this = this;
    var dataTransfer = evt.dataTransfer;
    var options = _this.options;
    pluginEvent2("dragStart", this, {
      evt
    });
    if (Sortable.eventCanceled) {
      this._onDrop();
      return;
    }
    pluginEvent2("setupClone", this);
    if (!Sortable.eventCanceled) {
      cloneEl = clone(dragEl);
      cloneEl.removeAttribute("id");
      cloneEl.draggable = false;
      cloneEl.style["will-change"] = "";
      this._hideClone();
      toggleClass(cloneEl, this.options.chosenClass, false);
      Sortable.clone = cloneEl;
    }
    _this.cloneId = _nextTick(function() {
      pluginEvent2("clone", _this);
      if (Sortable.eventCanceled) return;
      if (!_this.options.removeCloneOnHide) {
        rootEl.insertBefore(cloneEl, dragEl);
      }
      _this._hideClone();
      _dispatchEvent({
        sortable: _this,
        name: "clone"
      });
    });
    !fallback && toggleClass(dragEl, options.dragClass, true);
    if (fallback) {
      ignoreNextClick = true;
      _this._loopId = setInterval(_this._emulateDragOver, 50);
    } else {
      off(document, "mouseup", _this._onDrop);
      off(document, "touchend", _this._onDrop);
      off(document, "touchcancel", _this._onDrop);
      if (dataTransfer) {
        dataTransfer.effectAllowed = "move";
        options.setData && options.setData.call(_this, dataTransfer, dragEl);
      }
      on(document, "drop", _this);
      css(dragEl, "transform", "translateZ(0)");
    }
    awaitingDragStarted = true;
    _this._dragStartId = _nextTick(_this._dragStarted.bind(_this, fallback, evt));
    on(document, "selectstart", _this);
    moved = true;
    window.getSelection().removeAllRanges();
    if (Safari) {
      css(document.body, "user-select", "none");
    }
  },
  // Returns true - if no further action is needed (either inserted or another condition)
  _onDragOver: function _onDragOver(evt) {
    var el = this.el, target = evt.target, dragRect, targetRect, revert, options = this.options, group = options.group, activeSortable = Sortable.active, isOwner = activeGroup === group, canSort = options.sort, fromSortable = putSortable || activeSortable, vertical, _this = this, completedFired = false;
    if (_silent) return;
    function dragOverEvent(name, extra) {
      pluginEvent2(name, _this, _objectSpread2({
        evt,
        isOwner,
        axis: vertical ? "vertical" : "horizontal",
        revert,
        dragRect,
        targetRect,
        canSort,
        fromSortable,
        target,
        completed,
        onMove: function onMove(target2, after2) {
          return _onMove(rootEl, el, dragEl, dragRect, target2, getRect(target2), evt, after2);
        },
        changed
      }, extra));
    }
    function capture() {
      dragOverEvent("dragOverAnimationCapture");
      _this.captureAnimationState();
      if (_this !== fromSortable) {
        fromSortable.captureAnimationState();
      }
    }
    function completed(insertion) {
      dragOverEvent("dragOverCompleted", {
        insertion
      });
      if (insertion) {
        if (isOwner) {
          activeSortable._hideClone();
        } else {
          activeSortable._showClone(_this);
        }
        if (_this !== fromSortable) {
          toggleClass(dragEl, putSortable ? putSortable.options.ghostClass : activeSortable.options.ghostClass, false);
          toggleClass(dragEl, options.ghostClass, true);
        }
        if (putSortable !== _this && _this !== Sortable.active) {
          putSortable = _this;
        } else if (_this === Sortable.active && putSortable) {
          putSortable = null;
        }
        if (fromSortable === _this) {
          _this._ignoreWhileAnimating = target;
        }
        _this.animateAll(function() {
          dragOverEvent("dragOverAnimationComplete");
          _this._ignoreWhileAnimating = null;
        });
        if (_this !== fromSortable) {
          fromSortable.animateAll();
          fromSortable._ignoreWhileAnimating = null;
        }
      }
      if (target === dragEl && !dragEl.animated || target === el && !target.animated) {
        lastTarget = null;
      }
      if (!options.dragoverBubble && !evt.rootEl && target !== document) {
        dragEl.parentNode[expando]._isOutsideThisEl(evt.target);
        !insertion && nearestEmptyInsertDetectEvent(evt);
      }
      !options.dragoverBubble && evt.stopPropagation && evt.stopPropagation();
      return completedFired = true;
    }
    function changed() {
      newIndex = index(dragEl);
      newDraggableIndex = index(dragEl, options.draggable);
      _dispatchEvent({
        sortable: _this,
        name: "change",
        toEl: el,
        newIndex,
        newDraggableIndex,
        originalEvent: evt
      });
    }
    if (evt.preventDefault !== void 0) {
      evt.cancelable && evt.preventDefault();
    }
    target = closest(target, options.draggable, el, true);
    dragOverEvent("dragOver");
    if (Sortable.eventCanceled) return completedFired;
    if (dragEl.contains(evt.target) || target.animated && target.animatingX && target.animatingY || _this._ignoreWhileAnimating === target) {
      return completed(false);
    }
    ignoreNextClick = false;
    if (activeSortable && !options.disabled && (isOwner ? canSort || (revert = parentEl !== rootEl) : putSortable === this || (this.lastPutMode = activeGroup.checkPull(this, activeSortable, dragEl, evt)) && group.checkPut(this, activeSortable, dragEl, evt))) {
      vertical = this._getDirection(evt, target) === "vertical";
      dragRect = getRect(dragEl);
      dragOverEvent("dragOverValid");
      if (Sortable.eventCanceled) return completedFired;
      if (revert) {
        parentEl = rootEl;
        capture();
        this._hideClone();
        dragOverEvent("revert");
        if (!Sortable.eventCanceled) {
          if (nextEl) {
            rootEl.insertBefore(dragEl, nextEl);
          } else {
            rootEl.appendChild(dragEl);
          }
        }
        return completed(true);
      }
      var elLastChild = lastChild(el, options.draggable);
      if (!elLastChild || _ghostIsLast(evt, vertical, this) && !elLastChild.animated) {
        if (elLastChild === dragEl) {
          return completed(false);
        }
        if (elLastChild && el === evt.target) {
          target = elLastChild;
        }
        if (target) {
          targetRect = getRect(target);
        }
        if (_onMove(rootEl, el, dragEl, dragRect, target, targetRect, evt, !!target) !== false) {
          capture();
          if (elLastChild && elLastChild.nextSibling) {
            el.insertBefore(dragEl, elLastChild.nextSibling);
          } else {
            el.appendChild(dragEl);
          }
          parentEl = el;
          changed();
          return completed(true);
        }
      } else if (elLastChild && _ghostIsFirst(evt, vertical, this)) {
        var firstChild = getChild(el, 0, options, true);
        if (firstChild === dragEl) {
          return completed(false);
        }
        target = firstChild;
        targetRect = getRect(target);
        if (_onMove(rootEl, el, dragEl, dragRect, target, targetRect, evt, false) !== false) {
          capture();
          el.insertBefore(dragEl, firstChild);
          parentEl = el;
          changed();
          return completed(true);
        }
      } else if (target.parentNode === el) {
        targetRect = getRect(target);
        var direction = 0, targetBeforeFirstSwap, differentLevel = dragEl.parentNode !== el, differentRowCol = !_dragElInRowColumn(dragEl.animated && dragEl.toRect || dragRect, target.animated && target.toRect || targetRect, vertical), side1 = vertical ? "top" : "left", scrolledPastTop = isScrolledPast(target, "top", "top") || isScrolledPast(dragEl, "top", "top"), scrollBefore = scrolledPastTop ? scrolledPastTop.scrollTop : void 0;
        if (lastTarget !== target) {
          targetBeforeFirstSwap = targetRect[side1];
          pastFirstInvertThresh = false;
          isCircumstantialInvert = !differentRowCol && options.invertSwap || differentLevel;
        }
        direction = _getSwapDirection(evt, target, targetRect, vertical, differentRowCol ? 1 : options.swapThreshold, options.invertedSwapThreshold == null ? options.swapThreshold : options.invertedSwapThreshold, isCircumstantialInvert, lastTarget === target);
        var sibling;
        if (direction !== 0) {
          var dragIndex = index(dragEl);
          do {
            dragIndex -= direction;
            sibling = parentEl.children[dragIndex];
          } while (sibling && (css(sibling, "display") === "none" || sibling === ghostEl));
        }
        if (direction === 0 || sibling === target) {
          return completed(false);
        }
        lastTarget = target;
        lastDirection = direction;
        var nextSibling = target.nextElementSibling, after = false;
        after = direction === 1;
        var moveVector = _onMove(rootEl, el, dragEl, dragRect, target, targetRect, evt, after);
        if (moveVector !== false) {
          if (moveVector === 1 || moveVector === -1) {
            after = moveVector === 1;
          }
          _silent = true;
          setTimeout(_unsilent, 30);
          capture();
          if (after && !nextSibling) {
            el.appendChild(dragEl);
          } else {
            target.parentNode.insertBefore(dragEl, after ? nextSibling : target);
          }
          if (scrolledPastTop) {
            scrollBy(scrolledPastTop, 0, scrollBefore - scrolledPastTop.scrollTop);
          }
          parentEl = dragEl.parentNode;
          if (targetBeforeFirstSwap !== void 0 && !isCircumstantialInvert) {
            targetMoveDistance = Math.abs(targetBeforeFirstSwap - getRect(target)[side1]);
          }
          changed();
          return completed(true);
        }
      }
      if (el.contains(dragEl)) {
        return completed(false);
      }
    }
    return false;
  },
  _ignoreWhileAnimating: null,
  _offMoveEvents: function _offMoveEvents() {
    off(document, "mousemove", this._onTouchMove);
    off(document, "touchmove", this._onTouchMove);
    off(document, "pointermove", this._onTouchMove);
    off(document, "dragover", nearestEmptyInsertDetectEvent);
    off(document, "mousemove", nearestEmptyInsertDetectEvent);
    off(document, "touchmove", nearestEmptyInsertDetectEvent);
  },
  _offUpEvents: function _offUpEvents() {
    var ownerDocument = this.el.ownerDocument;
    off(ownerDocument, "mouseup", this._onDrop);
    off(ownerDocument, "touchend", this._onDrop);
    off(ownerDocument, "pointerup", this._onDrop);
    off(ownerDocument, "pointercancel", this._onDrop);
    off(ownerDocument, "touchcancel", this._onDrop);
    off(document, "selectstart", this);
  },
  _onDrop: function _onDrop(evt) {
    var el = this.el, options = this.options;
    newIndex = index(dragEl);
    newDraggableIndex = index(dragEl, options.draggable);
    pluginEvent2("drop", this, {
      evt
    });
    parentEl = dragEl && dragEl.parentNode;
    newIndex = index(dragEl);
    newDraggableIndex = index(dragEl, options.draggable);
    if (Sortable.eventCanceled) {
      this._nulling();
      return;
    }
    awaitingDragStarted = false;
    isCircumstantialInvert = false;
    pastFirstInvertThresh = false;
    clearInterval(this._loopId);
    clearTimeout(this._dragStartTimer);
    _cancelNextTick(this.cloneId);
    _cancelNextTick(this._dragStartId);
    if (this.nativeDraggable) {
      off(document, "drop", this);
      off(el, "dragstart", this._onDragStart);
    }
    this._offMoveEvents();
    this._offUpEvents();
    if (Safari) {
      css(document.body, "user-select", "");
    }
    css(dragEl, "transform", "");
    if (evt) {
      if (moved) {
        evt.cancelable && evt.preventDefault();
        !options.dropBubble && evt.stopPropagation();
      }
      ghostEl && ghostEl.parentNode && ghostEl.parentNode.removeChild(ghostEl);
      if (rootEl === parentEl || putSortable && putSortable.lastPutMode !== "clone") {
        cloneEl && cloneEl.parentNode && cloneEl.parentNode.removeChild(cloneEl);
      }
      if (dragEl) {
        if (this.nativeDraggable) {
          off(dragEl, "dragend", this);
        }
        _disableDraggable(dragEl);
        dragEl.style["will-change"] = "";
        if (moved && !awaitingDragStarted) {
          toggleClass(dragEl, putSortable ? putSortable.options.ghostClass : this.options.ghostClass, false);
        }
        toggleClass(dragEl, this.options.chosenClass, false);
        _dispatchEvent({
          sortable: this,
          name: "unchoose",
          toEl: parentEl,
          newIndex: null,
          newDraggableIndex: null,
          originalEvent: evt
        });
        if (rootEl !== parentEl) {
          if (newIndex >= 0) {
            _dispatchEvent({
              rootEl: parentEl,
              name: "add",
              toEl: parentEl,
              fromEl: rootEl,
              originalEvent: evt
            });
            _dispatchEvent({
              sortable: this,
              name: "remove",
              toEl: parentEl,
              originalEvent: evt
            });
            _dispatchEvent({
              rootEl: parentEl,
              name: "sort",
              toEl: parentEl,
              fromEl: rootEl,
              originalEvent: evt
            });
            _dispatchEvent({
              sortable: this,
              name: "sort",
              toEl: parentEl,
              originalEvent: evt
            });
          }
          putSortable && putSortable.save();
        } else {
          if (newIndex !== oldIndex) {
            if (newIndex >= 0) {
              _dispatchEvent({
                sortable: this,
                name: "update",
                toEl: parentEl,
                originalEvent: evt
              });
              _dispatchEvent({
                sortable: this,
                name: "sort",
                toEl: parentEl,
                originalEvent: evt
              });
            }
          }
        }
        if (Sortable.active) {
          if (newIndex == null || newIndex === -1) {
            newIndex = oldIndex;
            newDraggableIndex = oldDraggableIndex;
          }
          _dispatchEvent({
            sortable: this,
            name: "end",
            toEl: parentEl,
            originalEvent: evt
          });
          this.save();
        }
      }
    }
    this._nulling();
  },
  _nulling: function _nulling() {
    pluginEvent2("nulling", this);
    rootEl = dragEl = parentEl = ghostEl = nextEl = cloneEl = lastDownEl = cloneHidden = tapEvt = touchEvt = moved = newIndex = newDraggableIndex = oldIndex = oldDraggableIndex = lastTarget = lastDirection = putSortable = activeGroup = Sortable.dragged = Sortable.ghost = Sortable.clone = Sortable.active = null;
    savedInputChecked.forEach(function(el) {
      el.checked = true;
    });
    savedInputChecked.length = lastDx = lastDy = 0;
  },
  handleEvent: function handleEvent(evt) {
    switch (evt.type) {
      case "drop":
      case "dragend":
        this._onDrop(evt);
        break;
      case "dragenter":
      case "dragover":
        if (dragEl) {
          this._onDragOver(evt);
          _globalDragOver(evt);
        }
        break;
      case "selectstart":
        evt.preventDefault();
        break;
    }
  },
  /**
   * Serializes the item into an array of string.
   * @returns {String[]}
   */
  toArray: function toArray() {
    var order = [], el, children = this.el.children, i2 = 0, n2 = children.length, options = this.options;
    for (; i2 < n2; i2++) {
      el = children[i2];
      if (closest(el, options.draggable, this.el, false)) {
        order.push(el.getAttribute(options.dataIdAttr) || _generateId(el));
      }
    }
    return order;
  },
  /**
   * Sorts the elements according to the array.
   * @param  {String[]}  order  order of the items
   */
  sort: function sort(order, useAnimation) {
    var items = {}, rootEl2 = this.el;
    this.toArray().forEach(function(id, i2) {
      var el = rootEl2.children[i2];
      if (closest(el, this.options.draggable, rootEl2, false)) {
        items[id] = el;
      }
    }, this);
    useAnimation && this.captureAnimationState();
    order.forEach(function(id) {
      if (items[id]) {
        rootEl2.removeChild(items[id]);
        rootEl2.appendChild(items[id]);
      }
    });
    useAnimation && this.animateAll();
  },
  /**
   * Save the current sorting
   */
  save: function save() {
    var store = this.options.store;
    store && store.set && store.set(this);
  },
  /**
   * For each element in the set, get the first element that matches the selector by testing the element itself and traversing up through its ancestors in the DOM tree.
   * @param   {HTMLElement}  el
   * @param   {String}       [selector]  default: `options.draggable`
   * @returns {HTMLElement|null}
   */
  closest: function closest$1(el, selector) {
    return closest(el, selector || this.options.draggable, this.el, false);
  },
  /**
   * Set/get option
   * @param   {string} name
   * @param   {*}      [value]
   * @returns {*}
   */
  option: function option(name, value) {
    var options = this.options;
    if (value === void 0) {
      return options[name];
    } else {
      var modifiedValue = PluginManager.modifyOption(this, name, value);
      if (typeof modifiedValue !== "undefined") {
        options[name] = modifiedValue;
      } else {
        options[name] = value;
      }
      if (name === "group") {
        _prepareGroup(options);
      }
    }
  },
  /**
   * Destroy
   */
  destroy: function destroy() {
    pluginEvent2("destroy", this);
    var el = this.el;
    el[expando] = null;
    off(el, "mousedown", this._onTapStart);
    off(el, "touchstart", this._onTapStart);
    off(el, "pointerdown", this._onTapStart);
    if (this.nativeDraggable) {
      off(el, "dragover", this);
      off(el, "dragenter", this);
    }
    Array.prototype.forEach.call(el.querySelectorAll("[draggable]"), function(el2) {
      el2.removeAttribute("draggable");
    });
    this._onDrop();
    this._disableDelayedDragEvents();
    sortables.splice(sortables.indexOf(this.el), 1);
    this.el = el = null;
  },
  _hideClone: function _hideClone() {
    if (!cloneHidden) {
      pluginEvent2("hideClone", this);
      if (Sortable.eventCanceled) return;
      css(cloneEl, "display", "none");
      if (this.options.removeCloneOnHide && cloneEl.parentNode) {
        cloneEl.parentNode.removeChild(cloneEl);
      }
      cloneHidden = true;
    }
  },
  _showClone: function _showClone(putSortable2) {
    if (putSortable2.lastPutMode !== "clone") {
      this._hideClone();
      return;
    }
    if (cloneHidden) {
      pluginEvent2("showClone", this);
      if (Sortable.eventCanceled) return;
      if (dragEl.parentNode == rootEl && !this.options.group.revertClone) {
        rootEl.insertBefore(cloneEl, dragEl);
      } else if (nextEl) {
        rootEl.insertBefore(cloneEl, nextEl);
      } else {
        rootEl.appendChild(cloneEl);
      }
      if (this.options.group.revertClone) {
        this.animate(dragEl, cloneEl);
      }
      css(cloneEl, "display", "");
      cloneHidden = false;
    }
  }
};
function _globalDragOver(evt) {
  if (evt.dataTransfer) {
    evt.dataTransfer.dropEffect = "move";
  }
  evt.cancelable && evt.preventDefault();
}
function _onMove(fromEl, toEl, dragEl2, dragRect, targetEl, targetRect, originalEvent, willInsertAfter) {
  var evt, sortable = fromEl[expando], onMoveFn = sortable.options.onMove, retVal;
  if (window.CustomEvent && !IE11OrLess && !Edge) {
    evt = new CustomEvent("move", {
      bubbles: true,
      cancelable: true
    });
  } else {
    evt = document.createEvent("Event");
    evt.initEvent("move", true, true);
  }
  evt.to = toEl;
  evt.from = fromEl;
  evt.dragged = dragEl2;
  evt.draggedRect = dragRect;
  evt.related = targetEl || toEl;
  evt.relatedRect = targetRect || getRect(toEl);
  evt.willInsertAfter = willInsertAfter;
  evt.originalEvent = originalEvent;
  fromEl.dispatchEvent(evt);
  if (onMoveFn) {
    retVal = onMoveFn.call(sortable, evt, originalEvent);
  }
  return retVal;
}
function _disableDraggable(el) {
  el.draggable = false;
}
function _unsilent() {
  _silent = false;
}
function _ghostIsFirst(evt, vertical, sortable) {
  var firstElRect = getRect(getChild(sortable.el, 0, sortable.options, true));
  var childContainingRect = getChildContainingRectFromElement(sortable.el, sortable.options, ghostEl);
  var spacer = 10;
  return vertical ? evt.clientX < childContainingRect.left - spacer || evt.clientY < firstElRect.top && evt.clientX < firstElRect.right : evt.clientY < childContainingRect.top - spacer || evt.clientY < firstElRect.bottom && evt.clientX < firstElRect.left;
}
function _ghostIsLast(evt, vertical, sortable) {
  var lastElRect = getRect(lastChild(sortable.el, sortable.options.draggable));
  var childContainingRect = getChildContainingRectFromElement(sortable.el, sortable.options, ghostEl);
  var spacer = 10;
  return vertical ? evt.clientX > childContainingRect.right + spacer || evt.clientY > lastElRect.bottom && evt.clientX > lastElRect.left : evt.clientY > childContainingRect.bottom + spacer || evt.clientX > lastElRect.right && evt.clientY > lastElRect.top;
}
function _getSwapDirection(evt, target, targetRect, vertical, swapThreshold, invertedSwapThreshold, invertSwap, isLastTarget) {
  var mouseOnAxis = vertical ? evt.clientY : evt.clientX, targetLength = vertical ? targetRect.height : targetRect.width, targetS1 = vertical ? targetRect.top : targetRect.left, targetS2 = vertical ? targetRect.bottom : targetRect.right, invert = false;
  if (!invertSwap) {
    if (isLastTarget && targetMoveDistance < targetLength * swapThreshold) {
      if (!pastFirstInvertThresh && (lastDirection === 1 ? mouseOnAxis > targetS1 + targetLength * invertedSwapThreshold / 2 : mouseOnAxis < targetS2 - targetLength * invertedSwapThreshold / 2)) {
        pastFirstInvertThresh = true;
      }
      if (!pastFirstInvertThresh) {
        if (lastDirection === 1 ? mouseOnAxis < targetS1 + targetMoveDistance : mouseOnAxis > targetS2 - targetMoveDistance) {
          return -lastDirection;
        }
      } else {
        invert = true;
      }
    } else {
      if (mouseOnAxis > targetS1 + targetLength * (1 - swapThreshold) / 2 && mouseOnAxis < targetS2 - targetLength * (1 - swapThreshold) / 2) {
        return _getInsertDirection(target);
      }
    }
  }
  invert = invert || invertSwap;
  if (invert) {
    if (mouseOnAxis < targetS1 + targetLength * invertedSwapThreshold / 2 || mouseOnAxis > targetS2 - targetLength * invertedSwapThreshold / 2) {
      return mouseOnAxis > targetS1 + targetLength / 2 ? 1 : -1;
    }
  }
  return 0;
}
function _getInsertDirection(target) {
  if (index(dragEl) < index(target)) {
    return 1;
  } else {
    return -1;
  }
}
function _generateId(el) {
  var str = el.tagName + el.className + el.src + el.href + el.textContent, i2 = str.length, sum = 0;
  while (i2--) {
    sum += str.charCodeAt(i2);
  }
  return sum.toString(36);
}
function _saveInputCheckedState(root) {
  savedInputChecked.length = 0;
  var inputs = root.getElementsByTagName("input");
  var idx = inputs.length;
  while (idx--) {
    var el = inputs[idx];
    el.checked && savedInputChecked.push(el);
  }
}
function _nextTick(fn) {
  return setTimeout(fn, 0);
}
function _cancelNextTick(id) {
  return clearTimeout(id);
}
if (documentExists) {
  on(document, "touchmove", function(evt) {
    if ((Sortable.active || awaitingDragStarted) && evt.cancelable) {
      evt.preventDefault();
    }
  });
}
Sortable.utils = {
  on,
  off,
  css,
  find,
  is: function is(el, selector) {
    return !!closest(el, selector, el, false);
  },
  extend,
  throttle,
  closest,
  toggleClass,
  clone,
  index,
  nextTick: _nextTick,
  cancelNextTick: _cancelNextTick,
  detectDirection: _detectDirection,
  getChild,
  expando
};
Sortable.get = function(element) {
  return element[expando];
};
Sortable.mount = function() {
  for (var _len = arguments.length, plugins2 = new Array(_len), _key = 0; _key < _len; _key++) {
    plugins2[_key] = arguments[_key];
  }
  if (plugins2[0].constructor === Array) plugins2 = plugins2[0];
  plugins2.forEach(function(plugin) {
    if (!plugin.prototype || !plugin.prototype.constructor) {
      throw "Sortable: Mounted plugin must be a constructor function, not ".concat({}.toString.call(plugin));
    }
    if (plugin.utils) Sortable.utils = _objectSpread2(_objectSpread2({}, Sortable.utils), plugin.utils);
    PluginManager.mount(plugin);
  });
};
Sortable.create = function(el, options) {
  return new Sortable(el, options);
};
Sortable.version = version;
var autoScrolls = [];
var scrollEl;
var scrollRootEl;
var scrolling = false;
var lastAutoScrollX;
var lastAutoScrollY;
var touchEvt$1;
var pointerElemChangedInterval;
function AutoScrollPlugin() {
  function AutoScroll() {
    this.defaults = {
      scroll: true,
      forceAutoScrollFallback: false,
      scrollSensitivity: 30,
      scrollSpeed: 10,
      bubbleScroll: true
    };
    for (var fn in this) {
      if (fn.charAt(0) === "_" && typeof this[fn] === "function") {
        this[fn] = this[fn].bind(this);
      }
    }
  }
  AutoScroll.prototype = {
    dragStarted: function dragStarted(_ref) {
      var originalEvent = _ref.originalEvent;
      if (this.sortable.nativeDraggable) {
        on(document, "dragover", this._handleAutoScroll);
      } else {
        if (this.options.supportPointer) {
          on(document, "pointermove", this._handleFallbackAutoScroll);
        } else if (originalEvent.touches) {
          on(document, "touchmove", this._handleFallbackAutoScroll);
        } else {
          on(document, "mousemove", this._handleFallbackAutoScroll);
        }
      }
    },
    dragOverCompleted: function dragOverCompleted(_ref2) {
      var originalEvent = _ref2.originalEvent;
      if (!this.options.dragOverBubble && !originalEvent.rootEl) {
        this._handleAutoScroll(originalEvent);
      }
    },
    drop: function drop3() {
      if (this.sortable.nativeDraggable) {
        off(document, "dragover", this._handleAutoScroll);
      } else {
        off(document, "pointermove", this._handleFallbackAutoScroll);
        off(document, "touchmove", this._handleFallbackAutoScroll);
        off(document, "mousemove", this._handleFallbackAutoScroll);
      }
      clearPointerElemChangedInterval();
      clearAutoScrolls();
      cancelThrottle();
    },
    nulling: function nulling() {
      touchEvt$1 = scrollRootEl = scrollEl = scrolling = pointerElemChangedInterval = lastAutoScrollX = lastAutoScrollY = null;
      autoScrolls.length = 0;
    },
    _handleFallbackAutoScroll: function _handleFallbackAutoScroll(evt) {
      this._handleAutoScroll(evt, true);
    },
    _handleAutoScroll: function _handleAutoScroll(evt, fallback) {
      var _this = this;
      var x2 = (evt.touches ? evt.touches[0] : evt).clientX, y2 = (evt.touches ? evt.touches[0] : evt).clientY, elem = document.elementFromPoint(x2, y2);
      touchEvt$1 = evt;
      if (fallback || this.options.forceAutoScrollFallback || Edge || IE11OrLess || Safari) {
        autoScroll(evt, this.options, elem, fallback);
        var ogElemScroller = getParentAutoScrollElement(elem, true);
        if (scrolling && (!pointerElemChangedInterval || x2 !== lastAutoScrollX || y2 !== lastAutoScrollY)) {
          pointerElemChangedInterval && clearPointerElemChangedInterval();
          pointerElemChangedInterval = setInterval(function() {
            var newElem = getParentAutoScrollElement(document.elementFromPoint(x2, y2), true);
            if (newElem !== ogElemScroller) {
              ogElemScroller = newElem;
              clearAutoScrolls();
            }
            autoScroll(evt, _this.options, newElem, fallback);
          }, 10);
          lastAutoScrollX = x2;
          lastAutoScrollY = y2;
        }
      } else {
        if (!this.options.bubbleScroll || getParentAutoScrollElement(elem, true) === getWindowScrollingElement()) {
          clearAutoScrolls();
          return;
        }
        autoScroll(evt, this.options, getParentAutoScrollElement(elem, false), false);
      }
    }
  };
  return _extends(AutoScroll, {
    pluginName: "scroll",
    initializeByDefault: true
  });
}
function clearAutoScrolls() {
  autoScrolls.forEach(function(autoScroll2) {
    clearInterval(autoScroll2.pid);
  });
  autoScrolls = [];
}
function clearPointerElemChangedInterval() {
  clearInterval(pointerElemChangedInterval);
}
var autoScroll = throttle(function(evt, options, rootEl2, isFallback) {
  if (!options.scroll) return;
  var x2 = (evt.touches ? evt.touches[0] : evt).clientX, y2 = (evt.touches ? evt.touches[0] : evt).clientY, sens = options.scrollSensitivity, speed = options.scrollSpeed, winScroller = getWindowScrollingElement();
  var scrollThisInstance = false, scrollCustomFn;
  if (scrollRootEl !== rootEl2) {
    scrollRootEl = rootEl2;
    clearAutoScrolls();
    scrollEl = options.scroll;
    scrollCustomFn = options.scrollFn;
    if (scrollEl === true) {
      scrollEl = getParentAutoScrollElement(rootEl2, true);
    }
  }
  var layersOut = 0;
  var currentParent = scrollEl;
  do {
    var el = currentParent, rect = getRect(el), top = rect.top, bottom = rect.bottom, left = rect.left, right = rect.right, width = rect.width, height = rect.height, canScrollX = void 0, canScrollY = void 0, scrollWidth = el.scrollWidth, scrollHeight = el.scrollHeight, elCSS = css(el), scrollPosX = el.scrollLeft, scrollPosY = el.scrollTop;
    if (el === winScroller) {
      canScrollX = width < scrollWidth && (elCSS.overflowX === "auto" || elCSS.overflowX === "scroll" || elCSS.overflowX === "visible");
      canScrollY = height < scrollHeight && (elCSS.overflowY === "auto" || elCSS.overflowY === "scroll" || elCSS.overflowY === "visible");
    } else {
      canScrollX = width < scrollWidth && (elCSS.overflowX === "auto" || elCSS.overflowX === "scroll");
      canScrollY = height < scrollHeight && (elCSS.overflowY === "auto" || elCSS.overflowY === "scroll");
    }
    var vx = canScrollX && (Math.abs(right - x2) <= sens && scrollPosX + width < scrollWidth) - (Math.abs(left - x2) <= sens && !!scrollPosX);
    var vy = canScrollY && (Math.abs(bottom - y2) <= sens && scrollPosY + height < scrollHeight) - (Math.abs(top - y2) <= sens && !!scrollPosY);
    if (!autoScrolls[layersOut]) {
      for (var i2 = 0; i2 <= layersOut; i2++) {
        if (!autoScrolls[i2]) {
          autoScrolls[i2] = {};
        }
      }
    }
    if (autoScrolls[layersOut].vx != vx || autoScrolls[layersOut].vy != vy || autoScrolls[layersOut].el !== el) {
      autoScrolls[layersOut].el = el;
      autoScrolls[layersOut].vx = vx;
      autoScrolls[layersOut].vy = vy;
      clearInterval(autoScrolls[layersOut].pid);
      if (vx != 0 || vy != 0) {
        scrollThisInstance = true;
        autoScrolls[layersOut].pid = setInterval(function() {
          if (isFallback && this.layer === 0) {
            Sortable.active._onTouchMove(touchEvt$1);
          }
          var scrollOffsetY = autoScrolls[this.layer].vy ? autoScrolls[this.layer].vy * speed : 0;
          var scrollOffsetX = autoScrolls[this.layer].vx ? autoScrolls[this.layer].vx * speed : 0;
          if (typeof scrollCustomFn === "function") {
            if (scrollCustomFn.call(Sortable.dragged.parentNode[expando], scrollOffsetX, scrollOffsetY, evt, touchEvt$1, autoScrolls[this.layer].el) !== "continue") {
              return;
            }
          }
          scrollBy(autoScrolls[this.layer].el, scrollOffsetX, scrollOffsetY);
        }.bind({
          layer: layersOut
        }), 24);
      }
    }
    layersOut++;
  } while (options.bubbleScroll && currentParent !== winScroller && (currentParent = getParentAutoScrollElement(currentParent, false)));
  scrolling = scrollThisInstance;
}, 30);
var drop = function drop2(_ref) {
  var originalEvent = _ref.originalEvent, putSortable2 = _ref.putSortable, dragEl2 = _ref.dragEl, activeSortable = _ref.activeSortable, dispatchSortableEvent = _ref.dispatchSortableEvent, hideGhostForTarget = _ref.hideGhostForTarget, unhideGhostForTarget = _ref.unhideGhostForTarget;
  if (!originalEvent) return;
  var toSortable = putSortable2 || activeSortable;
  hideGhostForTarget();
  var touch = originalEvent.changedTouches && originalEvent.changedTouches.length ? originalEvent.changedTouches[0] : originalEvent;
  var target = document.elementFromPoint(touch.clientX, touch.clientY);
  unhideGhostForTarget();
  if (toSortable && !toSortable.el.contains(target)) {
    dispatchSortableEvent("spill");
    this.onSpill({
      dragEl: dragEl2,
      putSortable: putSortable2
    });
  }
};
function Revert() {
}
Revert.prototype = {
  startIndex: null,
  dragStart: function dragStart(_ref2) {
    var oldDraggableIndex2 = _ref2.oldDraggableIndex;
    this.startIndex = oldDraggableIndex2;
  },
  onSpill: function onSpill(_ref3) {
    var dragEl2 = _ref3.dragEl, putSortable2 = _ref3.putSortable;
    this.sortable.captureAnimationState();
    if (putSortable2) {
      putSortable2.captureAnimationState();
    }
    var nextSibling = getChild(this.sortable.el, this.startIndex, this.options);
    if (nextSibling) {
      this.sortable.el.insertBefore(dragEl2, nextSibling);
    } else {
      this.sortable.el.appendChild(dragEl2);
    }
    this.sortable.animateAll();
    if (putSortable2) {
      putSortable2.animateAll();
    }
  },
  drop
};
_extends(Revert, {
  pluginName: "revertOnSpill"
});
function Remove() {
}
Remove.prototype = {
  onSpill: function onSpill2(_ref4) {
    var dragEl2 = _ref4.dragEl, putSortable2 = _ref4.putSortable;
    var parentSortable = putSortable2 || this.sortable;
    parentSortable.captureAnimationState();
    dragEl2.parentNode && dragEl2.parentNode.removeChild(dragEl2);
    parentSortable.animateAll();
  },
  drop
};
_extends(Remove, {
  pluginName: "removeOnSpill"
});
Sortable.mount(new AutoScrollPlugin());
Sortable.mount(Remove, Revert);
var sortable_esm_default = Sortable;

// src/static/gallery_layout.ts
var GalleryLayout = class {
  observerInitialized = false;
  layoutMode;
  containerSelector;
  spacing;
  masonryBreakpoint;
  constructor(options = {}) {
    this.layoutMode = options.layoutMode ?? "justified";
    this.containerSelector = options.containerSelector ?? "#gallery-container";
    this.spacing = options.spacing ?? 8;
    this.masonryBreakpoint = options.masonryBreakpoint ?? 640;
  }
  setLayoutMode(mode) {
    console.log(
      `Setting layout mode to: ${mode} (current: ${this.layoutMode})`
    );
    this.layoutMode = mode;
    this.computeLayout();
  }
  computeLayout() {
    if (this.layoutMode === "masonry") {
      this.computeMasonry();
    } else {
      this.computeJustified();
    }
  }
  computeMasonry() {
    const container = document.querySelector(
      this.containerSelector
    );
    if (!container) return;
    const spacing = this.spacing;
    const containerWidth = container.offsetWidth;
    if (containerWidth === 0) {
      requestAnimationFrame(() => this.computeMasonry());
      return;
    }
    const columns = containerWidth < this.masonryBreakpoint ? 1 : 3;
    const columnWidth = (containerWidth + spacing) / columns - spacing;
    const columnHeights = new Array(columns).fill(0);
    const tiles = container.querySelectorAll(".gallery-item");
    tiles.forEach((tile) => {
      const imgW = parseFloat(tile.dataset.width);
      const imgH = parseFloat(tile.dataset.height);
      if (!imgW || !imgH) return;
      const aspectRatio = imgH / imgW;
      const renderedHeight = aspectRatio * columnWidth;
      let shortestIndex = 0;
      for (let i2 = 1; i2 < columns; i2++) {
        if (columnHeights[i2] < columnHeights[shortestIndex]) {
          shortestIndex = i2;
        }
      }
      const left = (columnWidth + spacing) * shortestIndex;
      const top = columnHeights[shortestIndex];
      Object.assign(tile.style, {
        position: "absolute",
        width: `${columnWidth}px`,
        height: `${renderedHeight}px`,
        left: `${left}px`,
        top: `${top}px`
      });
      columnHeights[shortestIndex] = top + renderedHeight + spacing;
    });
    container.style.height = `${Math.max(...columnHeights)}px`;
  }
  computeJustified() {
    const container = document.querySelector(
      this.containerSelector
    );
    if (!container) return;
    const spacing = this.spacing;
    const containerWidth = container.offsetWidth;
    if (containerWidth === 0) {
      requestAnimationFrame(() => this.computeJustified());
      return;
    }
    const tiles = Array.from(
      container.querySelectorAll(".gallery-item")
    );
    let currentRow = [];
    let rowAspectRatioSum = 0;
    let yOffset = 0;
    tiles.forEach((tile) => {
      Object.assign(tile.style, {
        position: "absolute",
        left: "0px",
        top: "0px",
        width: "auto",
        height: "auto"
      });
    });
    for (let i2 = 0; i2 < tiles.length; i2++) {
      const tile = tiles[i2];
      const imgW = parseFloat(tile.dataset.width);
      const imgH = parseFloat(tile.dataset.height);
      if (!imgW || !imgH) continue;
      const aspectRatio = imgW / imgH;
      currentRow.push({ tile, aspectRatio, imgW, imgH });
      rowAspectRatioSum += aspectRatio;
      const estimatedRowHeight = (containerWidth - (currentRow.length - 1) * spacing) / rowAspectRatioSum;
      if (estimatedRowHeight < 300 || i2 === tiles.length - 1) {
        let xOffset = 0;
        for (const item of currentRow) {
          const width = estimatedRowHeight * item.aspectRatio;
          Object.assign(item.tile.style, {
            position: "absolute",
            top: `${yOffset}px`,
            left: `${xOffset}px`,
            width: `${width}px`,
            height: `${estimatedRowHeight}px`
          });
          xOffset += width + spacing;
        }
        yOffset += estimatedRowHeight + spacing;
        currentRow = [];
        rowAspectRatioSum = 0;
      }
    }
    container.style.position = "relative";
    container.style.height = `${yOffset}px`;
  }
  observe() {
    if (this.observerInitialized) return;
    this.observerInitialized = true;
    const container = document.querySelector(
      this.containerSelector
    );
    if (!container) return;
    if (typeof ResizeObserver !== "undefined") {
      const resizeObserver = new ResizeObserver(() => this.computeLayout());
      if (container.parentElement) {
        resizeObserver.observe(container.parentElement);
      }
    }
    const mutationObserver = new MutationObserver(() => {
      this.computeLayout();
    });
    mutationObserver.observe(container, {
      childList: true,
      subtree: true
    });
  }
  init(options = {}) {
    document.addEventListener("DOMContentLoaded", () => {
      const container = document.querySelector(
        options.containerSelector ?? "#gallery-container"
      );
      console.log("Initializing GalleryLayout for container:", container);
      if (container) {
        this.computeLayout();
        this.observe();
      }
    });
  }
};

// src/static/photo_dialog.ts
var PhotoDialog = class _PhotoDialog {
  startX = 0;
  threshold = 50;
  observer;
  static initialized = false;
  static id = "photo-dialog";
  constructor() {
    this.observer = new MutationObserver(this.handleMutation.bind(this));
  }
  connect() {
    this.onTouchStart = this.onTouchStart.bind(this);
    this.onTouchEnd = this.onTouchEnd.bind(this);
    console.log("PhotoDialog: Connected touch event handlers.");
  }
  static maybeInitForElement(element) {
    if (element.id !== _PhotoDialog.id) return;
    if (_PhotoDialog.initialized) return;
    const dialog = new _PhotoDialog();
    dialog.connect();
    if (document && document.body) {
      document.body.addEventListener("touchstart", dialog.onTouchStart);
      document.body.addEventListener("touchend", dialog.onTouchEnd);
      dialog.observe();
      _PhotoDialog.initialized = true;
    } else {
      console.warn(
        "document.body not available for PhotoDialog event listeners"
      );
    }
  }
  onTouchStart(e2) {
    this.startX = e2.touches[0].clientX;
  }
  onTouchEnd(e2) {
    const endX = e2.changedTouches[0].clientX;
    const diffX = endX - this.startX;
    if (Math.abs(diffX) > this.threshold) {
      const direction = diffX > 0 ? "swiperight" : "swipeleft";
      e2.target.dispatchEvent(
        new CustomEvent(direction, { bubbles: true })
      );
    }
  }
  observe() {
    this.observer.observe(document.body, { childList: true, subtree: true });
  }
  disconnect() {
    this.observer.disconnect();
    document.body.removeEventListener("touchstart", this.onTouchStart);
    document.body.removeEventListener("touchend", this.onTouchEnd);
    _PhotoDialog.initialized = false;
  }
  handleMutation() {
    const modal = document.getElementById(_PhotoDialog.id);
    if (!modal) {
      console.log("PhotoDialog not found, removing event listeners");
      this.disconnect();
    }
  }
};

// src/static/photo_manip.ts
var photo_manip_exports = {};
__export(photo_manip_exports, {
  dataURLToBlob: () => dataURLToBlob,
  doResize: () => doResize,
  readFileAsDataURL: () => readFileAsDataURL
});
function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
function dataURLToBlob(dataUrl) {
  const [meta, base64] = dataUrl.split(",");
  const mimeMatch = /:(.*?);/.exec(meta);
  if (!mimeMatch) throw new Error("Invalid data URL");
  const mime = mimeMatch[1];
  const binary = atob(base64);
  const array = new Uint8Array(binary.length);
  for (let i2 = 0; i2 < binary.length; i2++) {
    array[i2] = binary.charCodeAt(i2);
  }
  return new Blob([array], { type: mime });
}
function getDataUriSize(dataUri) {
  const base64 = dataUri.split(",")[1];
  return Math.ceil(base64.length * 3 / 4);
}
function createResizedImage(dataUri, options) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let scale;
      if (options.mode === "cover") {
        scale = Math.max(
          options.width / img.width,
          options.height / img.height
        );
      } else if (options.mode === "contain") {
        scale = Math.min(
          options.width / img.width,
          options.height / img.height
        );
      } else {
        scale = 1;
      }
      const w2 = Math.round(img.width * scale);
      const h2 = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w2;
      canvas.height = h2;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Failed to get canvas context"));
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, w2, h2);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, w2, h2);
      resolve({
        dataUrl: canvas.toDataURL("image/jpeg", options.quality),
        width: w2,
        height: h2
      });
    };
    img.onerror = (e2) => reject(e2);
    img.src = dataUri;
  });
}
async function doResize(dataUri, opts) {
  let bestResult = null;
  let minQuality = 0;
  let maxQuality = 101;
  while (maxQuality - minQuality > 1) {
    const quality = Math.round((minQuality + maxQuality) / 2);
    const result = await createResizedImage(dataUri, {
      width: opts.width,
      height: opts.height,
      quality: quality / 100,
      mode: opts.mode
    });
    const size = getDataUriSize(result.dataUrl);
    if (size < opts.maxSize) {
      minQuality = quality;
      bestResult = result;
    } else {
      maxQuality = quality;
    }
  }
  if (!bestResult) {
    throw new Error("Failed to compress image");
  }
  return {
    path: bestResult.dataUrl,
    mime: "image/jpeg",
    size: getDataUriSize(bestResult.dataUrl),
    width: bestResult.width,
    height: bestResult.height
  };
}

// src/static/profile_dialog.ts
var import_htmx = __toESM(require_htmx_min());
var ProfileDialog = class {
  handleAvatarImageSelect(fileInput) {
    const file = fileInput.files?.[0];
    if (file) {
      readFileAsDataURL(file).then((dataUrl) => {
        const previewImg = document.createElement("img");
        if (typeof dataUrl === "string") {
          previewImg.src = dataUrl;
        } else {
          console.error(
            "Expected dataUrl to be a string, got:",
            typeof dataUrl
          );
          previewImg.src = "";
        }
        previewImg.className = "rounded-full w-full h-full object-cover";
        previewImg.alt = "Avatar preview";
        const imagePreview = fileInput.closest("form")?.querySelector(
          "#image-preview"
        );
        if (imagePreview) {
          imagePreview.innerHTML = "";
          imagePreview.appendChild(previewImg);
        }
      });
    }
  }
  async updateProfile(formElement) {
    const formData = new FormData(formElement);
    const avatarFile = formData.get("file");
    if (avatarFile instanceof File && avatarFile?.type?.startsWith?.("image/")) {
      try {
        const dataUrl = await readFileAsDataURL(avatarFile);
        if (!dataUrl || typeof dataUrl !== "string") {
          console.error("Failed to read file as data URL");
          return;
        }
        const resized = await doResize(dataUrl, {
          width: 2e3,
          height: 2e3,
          maxSize: 1e3 * 1e3,
          // 1MB
          mode: "contain"
        });
        const blob = dataURLToBlob(resized.path);
        formData.set("file", blob, avatarFile.name);
      } catch (err) {
        console.error("Error resizing image:", err);
        formData.delete("file");
      }
    }
    import_htmx.default.ajax("PUT", "/actions/profile", {
      swap: "none",
      values: Object.fromEntries(formData),
      source: formElement
    });
  }
};

// src/static/upload_page.ts
var import_htmx2 = __toESM(require_htmx_min());
var UploadPage = class {
  async uploadPhotos(inputElement) {
    const fileList = Array.from(inputElement.files ?? []);
    if (fileList.length > 10) {
      alert("You can only upload 10 photos at a time");
      return;
    }
    const uploadPromises = fileList.map(async (file) => {
      try {
        const dataUrl = await readFileAsDataURL(file);
        if (!dataUrl || typeof dataUrl !== "string") {
          console.error("Failed to read file as data URL");
          return;
        }
        const resized = await doResize(dataUrl, {
          width: 2e3,
          height: 2e3,
          maxSize: 1e3 * 1e3,
          // 1MB
          mode: "contain"
        });
        const blob = dataURLToBlob(resized.path);
        const fd = new FormData();
        fd.append("file", blob, file.name);
        fd.append("width", String(resized.width));
        fd.append("height", String(resized.height));
        import_htmx2.default.ajax("POST", "/actions/photo", {
          "swap": "afterbegin",
          "target": "#image-preview",
          "values": Object.fromEntries(fd),
          "source": inputElement
        });
      } catch (err) {
        console.error("Error uploading photo:", err);
        alert("Error uploading photo");
      }
    });
    await Promise.all(uploadPromises);
    inputElement.value = "";
  }
};

// src/static/mod.ts
var galleryLayout = new GalleryLayout({ layoutMode: "justified" });
galleryLayout.init();
import_htmx3.default.onLoad(function(element) {
  PhotoDialog.maybeInitForElement(element);
  if (element.id === "gallery-sort-dialog") {
    const sortables2 = element.querySelectorAll(".sortable");
    for (const sortable of Array.from(sortables2)) {
      new sortable_esm_default(sortable, {
        animation: 150
      });
    }
  }
});
import_hyperscript.default.browserInit();
var g2 = globalThis;
g2.htmx = g2.htmx ?? import_htmx3.default;
g2._hyperscript = g2._hyperscript ?? import_hyperscript.default;
g2.Grain = g2.Grain ?? {};
g2.Grain.uploadPage = new UploadPage();
g2.Grain.profileDialog = new ProfileDialog();
g2.Grain.galleryLayout = galleryLayout;
g2.Grain.photoManip = photo_manip_exports;
/*! Bundled license information:

sortablejs/modular/sortable.esm.js:
  (**!
   * Sortable 1.15.6
   * @author	RubaXa   <trash@rubaxa.org>
   * @author	owenm    <owen23355@gmail.com>
   * @license MIT
   *)
*/
