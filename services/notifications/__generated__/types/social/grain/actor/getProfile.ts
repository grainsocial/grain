/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HandlerAuth, HandlerPipeThrough } from "npm:@atproto/xrpc-server";
import express from "npm:express";
import { validate as _validate } from "../../../../lexicons.ts";
import { is$typed as _is$typed } from "../../../../util.ts";
import type * as SocialGrainActorDefs from "./defs.ts";

const is$typed = _is$typed,
  validate = _validate;
const id = "social.grain.actor.getProfile";

export interface QueryParams {
  /** Handle or DID of account to fetch profile of. */
  actor: string;
}

export type InputSchema = undefined;
export type OutputSchema = SocialGrainActorDefs.ProfileViewDetailed;
export type HandlerInput = undefined;

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
