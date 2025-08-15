import 'package:flutter/material.dart';
import 'package:grain/api.dart';
import 'package:grain/app_icons.dart';
import 'package:grain/widgets/app_image.dart';

class AddCommentButton extends StatelessWidget {
  final VoidCallback onPressed;
  final Color? backgroundColor;
  final Color? foregroundColor;
  const AddCommentButton({
    super.key,
    required this.onPressed,
    this.backgroundColor,
    this.foregroundColor,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final bgColor =
        backgroundColor ??
        (theme.brightness == Brightness.light ? Colors.grey[200] : Colors.grey[900]);
    final fgColor =
        foregroundColor ?? (theme.brightness == Brightness.light ? Colors.black : Colors.white);
    return SizedBox(
      width: double.infinity,
      child: ElevatedButton(
        style: ElevatedButton.styleFrom(
          backgroundColor: bgColor,
          foregroundColor: fgColor,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
          padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 16),
          textStyle: const TextStyle(fontWeight: FontWeight.w600, fontSize: 16),
          elevation: 0,
        ),
        onPressed: onPressed,
        child: Row(
          mainAxisAlignment: MainAxisAlignment.start,
          children: [
            if (apiService.currentUser?.avatar != null &&
                (apiService.currentUser?.avatar?.isNotEmpty ?? false))
              ClipOval(
                child: AppImage(
                  url: apiService.currentUser!.avatar!,
                  width: 32,
                  height: 32,
                  fit: BoxFit.cover,
                ),
              )
            else
              CircleAvatar(
                radius: 16,
                backgroundColor: Colors.grey[800],
                child: Icon(AppIcons.person, size: 16, color: Colors.white),
              ),
            const SizedBox(width: 12),
            const Text(
              'Add a comment',
              style: TextStyle(fontWeight: FontWeight.w600, fontSize: 16),
            ),
          ],
        ),
      ),
    );
  }
}
