export interface ExifData {
	make?: string;
	model?: string;
	lensMake?: string;
	lensModel?: string;
	exposureTime?: number;
	fNumber?: number;
	iSO?: number;
	focalLengthIn35mmFormat?: number;
	flash?: string;
	dateTimeOriginal?: string;
}

export interface ExifMetaData {
	alt?: string;
	description?: string;
	keywords?: string[];
	title?: string;
}

export interface GpsData {
	latitude: number;
	longitude: number;
}

const SCALE = 1_000_000;

export async function extractExif(
	file: File,
): Promise<{ exif?: ExifData; gps?: GpsData; meta?: ExifMetaData }> {
	try {
		const exifr = await import("exifr");
		const raw = await exifr.parse(file, true);

		if (!raw) return {};

		const exif: ExifData = {};

		if (raw.Make) exif.make = String(raw.Make).trim();
		if (raw.Model) exif.model = String(raw.Model).trim();
		if (raw.LensMake) exif.lensMake = String(raw.LensMake).trim();
		if (raw.LensModel) exif.lensModel = String(raw.LensModel).trim();
		if (raw.ExposureTime)
			exif.exposureTime = Math.round(raw.ExposureTime * SCALE);
		if (raw.FNumber) exif.fNumber = Math.round(raw.FNumber * SCALE);
		if (raw.ISO) exif.iSO = Math.round(raw.ISO * SCALE);
		if (raw.FocalLengthIn35mmFormat)
			exif.focalLengthIn35mmFormat = Math.round(
				raw.FocalLengthIn35mmFormat * SCALE,
			);
		if (raw.Flash != null) exif.flash = String(raw.Flash);
		if (raw.DateTimeOriginal instanceof Date)
			exif.dateTimeOriginal = raw.DateTimeOriginal.toISOString();

		let meta: ExifMetaData = {};
		meta.title = (raw.title?.value || raw.ObjectName)?.trim() ?? undefined;
		meta.description =
			(raw.ImageDescription || raw.Caption)?.trim() ?? undefined;
		meta.alt = raw.AltTextAccessibility?.value ?? undefined;
		meta.keywords = raw.Keywords || raw.subject || raw.weightedFlatSubject;

		let gps: GpsData | undefined;
		try {
			const coords = await exifr.gps(file);
			if (
				coords &&
				typeof coords.latitude === "number" &&
				typeof coords.longitude === "number"
			) {
				gps = {
					latitude: coords.latitude,
					longitude: coords.longitude,
				};
			}
		} catch {
			// GPS extraction failed, continue without it
		}

		return {
			exif: Object.keys(exif).length > 0 ? exif : undefined,
			gps,
			meta,
		};
	} catch {
		return {};
	}
}
