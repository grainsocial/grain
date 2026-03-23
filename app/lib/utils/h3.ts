import { latLngToCell, cellToParent, getResolution } from "h3-js";

export function latLonToH3(lat: number, lon: number, resolution: number = 10): string {
  return latLngToCell(lat, lon, resolution);
}

export function h3ToCity(h3Index: string): string {
  return getResolution(h3Index) <= 5 ? h3Index : cellToParent(h3Index, 5);
}

export function getH3Resolution(h3Index: string): number {
  return getResolution(h3Index);
}
