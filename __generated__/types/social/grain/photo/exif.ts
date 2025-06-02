/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { type ValidationResult, BlobRef } from "npm:@atproto/lexicon"
import { CID } from "npm:multiformats/cid"
import { validate as _validate } from '../../../../lexicons.ts'
import {
  type $Typed,
  is$typed as _is$typed,
  type OmitKey,
} from '../../../../util.ts'

const is$typed = _is$typed,
  validate = _validate
const id = 'social.grain.photo.exif'

export interface Record {
  $type: 'social.grain.photo.exif'
  photo: string
  createdAt: string
  apertureValue?: number
  brightnessValue?: number
  colorSpace?: number
  contrast?: 'Normal' | 'Soft' | 'Hard'
  createDate?: string
  customRendered?: string
  dateTimeOriginal?: string
  digitalZoomRatio?: number
  exifVersion?: string
  exposureCompensation?: number
  exposureMode?: string
  exposureProgram?: string
  exposureTime?: number
  fNumber?: number
  fileSource?: string
  flash?: string
  focalLength?: number
  focalLengthIn35mmFormat?: number
  focalPlaneResolutionUnit?: string
  focalPlaneXResolution?: number
  focalPlaneYResolution?: number
  iSO?: number
  lensInfo?: number[]
  lensModel?: string
  lightSource?: string
  make?: string
  maxApertureValue?: number
  meteringMode?: string
  model?: string
  modifyDate?: string
  recommendedExposureIndex?: number
  resolutionUnit?: string
  saturation?: string
  sceneCaptureType?: string
  sceneType?: string
  sensitivityType?: number
  sharpness?: string
  shutterSpeedValue?: number
  software?: string
  whiteBalance?: string
  xResolution?: number
  yResolution?: number
  [k: string]: unknown
}

const hashRecord = 'main'

export function isRecord<V>(v: V) {
  return is$typed(v, id, hashRecord)
}

export function validateRecord<V>(v: V) {
  return validate<Record & V>(v, id, hashRecord, true)
}
