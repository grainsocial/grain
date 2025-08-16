import 'package:flutter/material.dart';

class CameraPills extends StatelessWidget {
  final List<String> cameras;
  final EdgeInsetsGeometry? padding;
  const CameraPills({super.key, required this.cameras, this.padding});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    if (cameras.isEmpty) return SizedBox.shrink();
    return Padding(
      padding: padding ?? EdgeInsets.zero,
      child: Wrap(
        spacing: 8,
        runSpacing: 4,
        children: cameras
            .map(
              (camera) => Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                decoration: BoxDecoration(
                  color: theme.colorScheme.surface,
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text(
                  '📷 $camera',
                  style: TextStyle(
                    color: theme.colorScheme.onSurface,
                    fontWeight: FontWeight.w500,
                    fontSize: 12,
                  ),
                ),
              ),
            )
            .toList(),
      ),
    );
  }
}
