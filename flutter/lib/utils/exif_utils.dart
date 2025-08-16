import 'dart:io';

import 'package:exif/exif.dart';

import '../app_logger.dart';

const List<String> exifTags = [
  'DateTimeOriginal',
  'ExposureTime',
  'FNumber',
  'Flash',
  'FocalLengthIn35mmFilm',
  'ISOSpeedRatings',
  'LensMake',
  'LensModel',
  'Make',
  'Model',
];

const int scaleFactor = 1000000;

Future<Map<String, dynamic>?> parseAndNormalizeExif({required File file}) async {
  try {
    final Map<String, IfdTag> exifData = await readExifFromBytes(await file.readAsBytes());
    appLogger.i('Parsed EXIF data: $exifData');

    if (exifData.isEmpty) return null;
    final Map<String, dynamic> normalized = {};

    for (final entry in exifData.entries) {
      final fullTag = entry.key;
      String tag;
      if (fullTag.contains(' ')) {
        tag = fullTag.split(' ').last.trim();
      } else {
        tag = fullTag.trim();
      }
      final value = entry.value.printable;
      final camelKey = tag.isNotEmpty ? tag[0].toLowerCase() + tag.substring(1) : tag;
      switch (tag) {
        case 'DateTimeOriginal':
          normalized[camelKey] = _exifDateToIso(value);
          break;
        case 'ExposureTime':
          normalized[camelKey] = _parseScaledInt(value);
          break;
        case 'FNumber':
          normalized[camelKey] = _parseScaledInt(value);
          break;
        case 'Flash':
          normalized[camelKey] = value;
          break;
        case 'FocalLengthIn35mmFilm':
          normalized[camelKey] = _parseScaledInt(value);
          break;
        case 'ISOSpeedRatings':
          normalized[camelKey] = _parseInt(value);
          break;
        case 'LensMake':
          normalized[camelKey] = value;
          break;
        case 'LensModel':
          normalized[camelKey] = value;
          break;
        case 'Make':
          normalized[camelKey] = value;
          break;
        case 'Model':
          normalized[camelKey] = value;
          break;
      }
    }

    return normalized;
  } catch (e) {
    return null;
  }
}

int? _parseScaledInt(String? value) {
  if (value == null) return null;
  // Handle fraction like "1/40"
  if (value.contains('/')) {
    final parts = value.split('/');
    if (parts.length == 2) {
      final numerator = double.tryParse(parts[0].trim());
      final denominator = double.tryParse(parts[1].trim());
      if (numerator != null && denominator != null && denominator != 0) {
        return (numerator / denominator * scaleFactor).round();
      }
    }
  }
  final numVal = double.tryParse(value.replaceAll(RegExp(r'[^0-9.]'), ''));
  if (numVal == null) return null;
  return (numVal * scaleFactor).round();
}

int? _parseInt(String? value) {
  if (value == null) return null;
  final intVal = int.tryParse(value.replaceAll(RegExp(r'[^0-9]'), ''));
  if (intVal == null) return null;
  return intVal * scaleFactor;
}

String? _exifDateToIso(String? exifDate) {
  if (exifDate == null) return null;
  // EXIF format: yyyy:MM:dd HH:mm:ss
  final match = RegExp(r'^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})$').firstMatch(exifDate);
  if (match == null) return null;
  final formatted =
      '${match.group(1)}-${match.group(2)}-${match.group(3)}T${match.group(4)}:${match.group(5)}:${match.group(6)}';
  return formatted;
}
