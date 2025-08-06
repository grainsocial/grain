/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HandlerAuth, HandlerPipeThrough } from "npm:@atproto/xrpc-server";
import express from "npm:express";
import { validate as _validate } from "../../../../lexicons.ts";
import { is$typed as _is$typed } from "../../../../util.ts";

const is$typed = _is$typed,
  validate = _validate;
const id = "social.grain.gallery.applySort";

export interface QueryParams {}

export interface InputSchema {
  writes: Update[];
}

export interface OutputSchema {
  /** True if the writes were successfully applied */
  success?: boolean;
}

export interface HandlerInput {
  encoding: "application/json";
  body: InputSchema;
}

export interface HandlerSuccess {
  encoding: "application/json";
  body: OutputSchema;
  headers?: { [key: string]: string };
}

export interface HandlerError {
  status: number;
  message?: string;
}

export type HandlerOutput = HandlerError | HandlerSuccess | HandlerPipeThrough;
export type HandlerReqCtx<HA extends HandlerAuth = never> = {
  auth: HA;
  params: QueryParams;
  input: HandlerInput;
  req: express.Request;
  res: express.Response;
  resetRouteRateLimits: () => Promise<void>;
};
export type Handler<HA extends HandlerAuth = never> = (
  ctx: HandlerReqCtx<HA>,
) => Promise<HandlerOutput> | HandlerOutput;

export interface Update {
  $type?: "social.grain.gallery.applySort#update";
  /** AT URI of the item to update */
  itemUri: string;
  /** The position of the item in the gallery, used for ordering */
  position: number;
}

const hashUpdate = "update";

export function isUpdate<V>(v: V) {
  return is$typed(v, id, hashUpdate);
}

export function validateUpdate<V>(v: V) {
  return validate<Update & V>(v, id, hashUpdate);
}
