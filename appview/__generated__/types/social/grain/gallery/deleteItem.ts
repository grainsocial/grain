/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HandlerAuth, HandlerPipeThrough } from "npm:@atproto/xrpc-server";
import express from "npm:express";
import { validate as _validate } from "../../../../lexicons.ts";
import { is$typed as _is$typed } from "../../../../util.ts";

const is$typed = _is$typed,
  validate = _validate;
const id = "social.grain.gallery.deleteItem";

export interface QueryParams {}

export interface InputSchema {
  /** AT URI of the gallery to create the item in */
  uri: string;
}

export interface OutputSchema {
  /** True if the gallery item was deleted */
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
