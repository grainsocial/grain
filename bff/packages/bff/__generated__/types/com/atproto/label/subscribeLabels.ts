/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { IncomingMessage } from "node:http";
import { ErrorFrame, HandlerAuth } from "npm:@atproto/xrpc-server@0.7.19";
import { validate as _validate } from "../../../../lexicons.ts";
import { type $Typed, is$typed as _is$typed } from "../../../../util.ts";
import type * as ComAtprotoLabelDefs from "./defs.ts";

const is$typed = _is$typed,
  validate = _validate;
const id = "com.atproto.label.subscribeLabels";

export interface Info {
  $type?: "com.atproto.label.subscribeLabels#info";
  name: "OutdatedCursor" | (string & {});
  message?: string;
}

const hashInfo = "info";

export function isInfo<V>(v: V) {
  return is$typed(v, id, hashInfo);
}

export function validateInfo<V>(v: V) {
  return validate<Info & V>(v, id, hashInfo);
}

export interface QueryParams {
  /** The last known event seq number to backfill from. */
  cursor?: number;
}

export type OutputSchema = $Typed<Labels> | $Typed<Info> | { $type: string };
export type HandlerError = ErrorFrame<"FutureCursor">;
export type HandlerOutput = HandlerError | OutputSchema;
export type HandlerReqCtx<HA extends HandlerAuth = never> = {
  auth: HA;
  params: QueryParams;
  req: IncomingMessage;
  signal: AbortSignal;
};
export type Handler<HA extends HandlerAuth = never> = (
  ctx: HandlerReqCtx<HA>,
) => AsyncIterable<HandlerOutput>;

export interface Labels {
  $type?: "com.atproto.label.subscribeLabels#labels";
  seq: number;
  labels: ComAtprotoLabelDefs.Label[];
}

const hashLabels = "labels";

export function isLabels<V>(v: V) {
  return is$typed(v, id, hashLabels);
}

export function validateLabels<V>(v: V) {
  return validate<Labels & V>(v, id, hashLabels);
}
