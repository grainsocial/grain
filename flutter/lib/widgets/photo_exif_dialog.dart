import 'package:flutter/material.dart';
import 'package:grain/models/photo_exif.dart';

class PhotoExifDialog extends StatelessWidget {
  final PhotoExif exif;
  const PhotoExifDialog({super.key, required this.exif});

  @override
  Widget build(BuildContext context) {
    return Dialog(
      backgroundColor: Colors.black45,
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Camera Settings',
                style: TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 16),
              if (exif.make != null)
                RichText(
                  text: TextSpan(
                    children: [
                      TextSpan(
                        text: 'Make: ',
                        style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                      ),
                      TextSpan(
                        text: exif.make!,
                        style: TextStyle(color: Colors.white),
                      ),
                    ],
                  ),
                ),
              if (exif.model != null)
                RichText(
                  text: TextSpan(
                    children: [
                      TextSpan(
                        text: 'Model: ',
                        style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                      ),
                      TextSpan(
                        text: exif.model!,
                        style: TextStyle(color: Colors.white),
                      ),
                    ],
                  ),
                ),
              if (exif.lensMake != null)
                RichText(
                  text: TextSpan(
                    children: [
                      TextSpan(
                        text: 'Lens Make: ',
                        style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                      ),
                      TextSpan(
                        text: exif.lensMake!,
                        style: TextStyle(color: Colors.white),
                      ),
                    ],
                  ),
                ),
              if (exif.lensModel != null)
                RichText(
                  text: TextSpan(
                    children: [
                      TextSpan(
                        text: 'Lens Model: ',
                        style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                      ),
                      TextSpan(
                        text: exif.lensModel!,
                        style: TextStyle(color: Colors.white),
                      ),
                    ],
                  ),
                ),
              if (exif.fNumber != null)
                RichText(
                  text: TextSpan(
                    children: [
                      TextSpan(
                        text: 'F Number: ',
                        style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                      ),
                      TextSpan(
                        text: exif.fNumber!,
                        style: TextStyle(color: Colors.white),
                      ),
                    ],
                  ),
                ),
              if (exif.focalLengthIn35mmFormat != null)
                RichText(
                  text: TextSpan(
                    children: [
                      TextSpan(
                        text: 'Focal Length (35mm): ',
                        style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                      ),
                      TextSpan(
                        text: exif.focalLengthIn35mmFormat!,
                        style: TextStyle(color: Colors.white),
                      ),
                    ],
                  ),
                ),
              if (exif.exposureTime != null)
                RichText(
                  text: TextSpan(
                    children: [
                      TextSpan(
                        text: 'Exposure Time: ',
                        style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                      ),
                      TextSpan(
                        text: exif.exposureTime!,
                        style: TextStyle(color: Colors.white),
                      ),
                    ],
                  ),
                ),
              if (exif.iSO != null)
                RichText(
                  text: TextSpan(
                    children: [
                      TextSpan(
                        text: 'ISO: ',
                        style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                      ),
                      TextSpan(
                        text: exif.iSO.toString(),
                        style: TextStyle(color: Colors.white),
                      ),
                    ],
                  ),
                ),
              if (exif.flash != null)
                RichText(
                  text: TextSpan(
                    children: [
                      TextSpan(
                        text: 'Flash: ',
                        style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                      ),
                      TextSpan(
                        text: exif.flash!,
                        style: TextStyle(color: Colors.white),
                      ),
                    ],
                  ),
                ),
              if (exif.dateTimeOriginal != null)
                RichText(
                  text: TextSpan(
                    children: [
                      TextSpan(
                        text: 'DateTime Original: ',
                        style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                      ),
                      TextSpan(
                        text: exif.dateTimeOriginal!,
                        style: TextStyle(color: Colors.white),
                      ),
                    ],
                  ),
                ),
              const SizedBox(height: 20),
              Align(
                alignment: Alignment.centerRight,
                child: TextButton(
                  onPressed: () => Navigator.of(context).pop(),
                  child: Text('Close', style: TextStyle(color: Colors.white)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
