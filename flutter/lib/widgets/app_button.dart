import 'package:flutter/material.dart';

enum AppButtonVariant { primary, secondary, text }

enum AppButtonSize { normal, small }

class AppButton extends StatelessWidget {
  final String label;
  final VoidCallback? onPressed;
  final bool loading;
  final bool disabled;
  final AppButtonVariant variant;
  final AppButtonSize size;
  final IconData? icon;
  final double height;
  final double borderRadius;
  final double fontSize;
  final EdgeInsetsGeometry? padding;

  const AppButton({
    super.key,
    required this.label,
    this.onPressed,
    this.loading = false,
    this.disabled = false,
    this.variant = AppButtonVariant.primary,
    this.size = AppButtonSize.normal,
    this.icon,
    this.height = 44,
    this.borderRadius = 6,
    this.fontSize = 16,
    this.padding,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final Color primaryColor = theme.colorScheme.primary;
    final Color secondaryColor = theme.colorScheme.surfaceContainerHighest;
    final Color secondaryText = theme.colorScheme.onSurface;
    final Color primaryText = theme.colorScheme.onPrimary;
    final bool isPrimary = variant == AppButtonVariant.primary;
    final bool isText = variant == AppButtonVariant.text;

    final double resolvedHeight = size == AppButtonSize.small ? 32 : height;
    final double resolvedFontSize = size == AppButtonSize.small ? 14 : fontSize;
    final double resolvedBorderRadius = size == AppButtonSize.small ? 5 : borderRadius;
    final EdgeInsetsGeometry resolvedPadding =
        padding ??
        (size == AppButtonSize.small
            ? const EdgeInsets.symmetric(horizontal: 14, vertical: 0)
            : const EdgeInsets.symmetric(horizontal: 16));

    if (isText) {
      return SizedBox(
        height: resolvedHeight,
        child: TextButton(
          onPressed: (loading || disabled) ? null : onPressed,
          style: TextButton.styleFrom(
            padding: resolvedPadding,
            foregroundColor: disabled ? secondaryText.withOpacity(0.5) : secondaryText,
            textStyle: theme.textTheme.labelLarge?.copyWith(
              fontWeight: FontWeight.w600,
              fontSize: resolvedFontSize,
            ),
          ),
          child: Text(
            label,
            style: theme.textTheme.labelLarge?.copyWith(
              color: disabled ? primaryColor.withOpacity(0.5) : primaryColor,
              fontWeight: FontWeight.w600,
              fontSize: resolvedFontSize,
            ),
          ),
        ),
      );
    }

    return SizedBox(
      height: resolvedHeight,
      child: ElevatedButton(
        onPressed: (loading || disabled) ? null : onPressed,
        style: ElevatedButton.styleFrom(
          backgroundColor: isPrimary
              ? (disabled ? primaryColor.withOpacity(0.5) : primaryColor)
              : (disabled ? secondaryColor.withOpacity(0.5) : secondaryColor),
          foregroundColor: isPrimary ? primaryText : secondaryText,
          elevation: 0,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(resolvedBorderRadius)),
          padding: resolvedPadding,
          textStyle: theme.textTheme.labelLarge?.copyWith(
            fontWeight: FontWeight.w600,
            fontSize: resolvedFontSize,
          ),
        ),
        child: loading
            ? SizedBox(
                width: 22,
                height: 22,
                child: CircularProgressIndicator(
                  color: isPrimary ? primaryColor : secondaryColor,
                  strokeWidth: 2,
                ),
              )
            : Row(
                mainAxisSize: MainAxisSize.min,
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  if (icon != null) ...[
                    Icon(icon, size: 20, color: isPrimary ? primaryText : secondaryText),
                    const SizedBox(width: 8),
                  ],
                  Text(
                    label,
                    style: theme.textTheme.labelLarge?.copyWith(
                      color: isPrimary ? primaryText : secondaryText,
                      fontWeight: FontWeight.w700,
                      fontSize: resolvedFontSize,
                    ),
                  ),
                ],
              ),
      ),
    );
  }
}
