import 'package:flutter/material.dart';

class PlainTextField extends StatelessWidget {
  final String label;
  final TextEditingController controller;
  final int maxLines;
  final bool enabled;
  final TextInputType? keyboardType;
  final String? hintText;
  final void Function(String)? onChanged;
  final Widget? prefixIcon;
  final Widget? suffixIcon;

  const PlainTextField({
    super.key,
    required this.label,
    required this.controller,
    this.maxLines = 1,
    this.enabled = true,
    this.keyboardType,
    this.hintText,
    this.onChanged,
    this.prefixIcon,
    this.suffixIcon,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: theme.textTheme.bodyMedium?.copyWith(
            fontWeight: FontWeight.w500,
            color: theme.colorScheme.onSurface,
          ),
        ),
        const SizedBox(height: 6),
        Container(
          decoration: BoxDecoration(
            color: theme.brightness == Brightness.dark ? Colors.grey[850] : Colors.grey[300],
            borderRadius: BorderRadius.circular(8),
          ),
          child: Focus(
            child: Builder(
              builder: (context) {
                final isFocused = Focus.of(context).hasFocus;
                return Stack(
                  children: [
                    TextField(
                      controller: controller,
                      maxLines: maxLines,
                      enabled: enabled,
                      keyboardType: keyboardType,
                      onChanged: onChanged,
                      style: theme.textTheme.bodyMedium?.copyWith(fontSize: 15),
                      decoration: InputDecoration(
                        hintText: hintText,
                        hintStyle: theme.textTheme.bodyMedium?.copyWith(color: theme.hintColor),
                        border: InputBorder.none,
                        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                        isDense: true,
                        prefixIcon: prefixIcon,
                        suffixIcon: suffixIcon,
                      ),
                    ),
                    // Border overlay
                    Positioned.fill(
                      child: IgnorePointer(
                        child: AnimatedContainer(
                          duration: const Duration(milliseconds: 150),
                          decoration: BoxDecoration(
                            border: Border.all(
                              color: isFocused ? theme.colorScheme.primary : theme.dividerColor,
                              width: isFocused ? 2 : 0,
                            ),
                            borderRadius: BorderRadius.circular(8),
                          ),
                        ),
                      ),
                    ),
                  ],
                );
              },
            ),
          ),
        ),
      ],
    );
  }
}
