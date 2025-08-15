import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:grain/api.dart';
import 'package:grain/app_icons.dart';
import 'package:grain/widgets/app_image.dart';
import 'package:grain/widgets/gallery_preview.dart';
import 'package:grain/widgets/faceted_text_field.dart';

Future<void> showAddCommentSheet(
  BuildContext context, {
  String initialText = '',
  required Future<void> Function(String text) onSubmit,
  VoidCallback? onCancel,
  dynamic gallery, // Pass gallery object
  dynamic replyTo, // Pass comment/user object if replying to a comment
}) async {
  final theme = Theme.of(context);
  final controller = TextEditingController(text: initialText);
  await showCupertinoSheet(
    context: context,
    useNestedNavigation: false,
    pageBuilder: (context) => Material(
      type: MaterialType.transparency,
      child: _AddCommentSheet(
        controller: controller,
        onSubmit: onSubmit,
        onCancel: onCancel,
        gallery: gallery,
        replyTo: replyTo,
      ),
    ),
  );
  SystemChrome.setSystemUIOverlayStyle(
    theme.brightness == Brightness.dark ? SystemUiOverlayStyle.light : SystemUiOverlayStyle.dark,
  );
}

class _AddCommentSheet extends StatefulWidget {
  final TextEditingController controller;
  final Future<void> Function(String text) onSubmit;
  final VoidCallback? onCancel;
  final dynamic gallery;
  final dynamic replyTo;
  const _AddCommentSheet({
    required this.controller,
    required this.onSubmit,
    this.onCancel,
    this.gallery,
    this.replyTo,
  });

  @override
  State<_AddCommentSheet> createState() => _AddCommentSheetState();
}

class _AddCommentSheetState extends State<_AddCommentSheet> {
  bool _posting = false;
  String _currentText = '';
  final FocusNode _focusNode = FocusNode();

  @override
  void initState() {
    super.initState();
    _currentText = widget.controller.text;
    widget.controller.addListener(_onTextChanged);
    // Request focus after build
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _focusNode.requestFocus();
    });
  }

  void _onTextChanged() {
    if (_currentText != widget.controller.text) {
      setState(() {
        _currentText = widget.controller.text;
      });
    }
  }

  @override
  void dispose() {
    widget.controller.removeListener(_onTextChanged);
    widget.controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final gallery = widget.gallery;
    final replyTo = widget.replyTo;
    final creator = replyTo != null
        ? (replyTo is Map && replyTo['author'] != null ? replyTo['author'] : null)
        : gallery?.creator;
    final focusPhoto = replyTo != null
        ? (replyTo is Map && replyTo['focus'] != null ? replyTo['focus'] : null)
        : null;
    return CupertinoPageScaffold(
      backgroundColor: theme.colorScheme.surface,
      navigationBar: CupertinoNavigationBar(
        backgroundColor: theme.colorScheme.surface,
        border: Border(bottom: BorderSide(color: theme.dividerColor, width: 1)),
        middle: Text(
          replyTo != null ? 'Reply' : 'Add comment',
          style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w600),
        ),
        leading: CupertinoButton(
          padding: EdgeInsets.zero,
          onPressed: _posting ? null : widget.onCancel ?? () => Navigator.of(context).maybePop(),
          child: Text(
            'Cancel',
            style: TextStyle(color: theme.colorScheme.primary, fontWeight: FontWeight.w600),
          ),
        ),
        trailing: CupertinoButton(
          padding: EdgeInsets.zero,
          onPressed: _posting || _currentText.trim().isEmpty
              ? null
              : () async {
                  setState(() => _posting = true);
                  await widget.onSubmit(_currentText.trim());
                  if (mounted) Navigator.of(context).pop();
                  setState(() => _posting = false);
                },
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                'Post',
                style: TextStyle(
                  color: _posting || _currentText.trim().isEmpty
                      ? theme.disabledColor
                      : theme.colorScheme.primary,
                  fontWeight: FontWeight.w600,
                ),
              ),
              if (_posting) ...[
                const SizedBox(width: 8),
                SizedBox(
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    valueColor: AlwaysStoppedAnimation<Color>(theme.colorScheme.primary),
                    semanticsLabel: 'Posting',
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
      child: SafeArea(
        bottom: false,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
          child: Column(
            children: [
              if ((gallery != null && creator != null && replyTo == null) ||
                  (replyTo != null && creator != null)) ...[
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if ((creator is Map &&
                            creator['avatar'] != null &&
                            creator['avatar'].isNotEmpty) ||
                        (creator is! Map && creator.avatar != null && creator.avatar.isNotEmpty))
                      ClipOval(
                        child: AppImage(
                          url: creator is Map ? creator['avatar'] : creator.avatar,
                          width: 40,
                          height: 40,
                          fit: BoxFit.cover,
                        ),
                      )
                    else
                      CircleAvatar(
                        radius: 20,
                        backgroundColor: theme.colorScheme.surfaceContainerHighest,
                        child: Icon(AppIcons.person, size: 20, color: theme.iconTheme.color),
                      ),
                    Expanded(
                      child: Padding(
                        padding: const EdgeInsets.only(left: 20.0),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  creator is Map
                                      ? (creator['displayName'] ?? '')
                                      : (creator.displayName ?? ''),
                                  style: theme.textTheme.bodyMedium?.copyWith(
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                                if ((creator is Map
                                        ? (creator['handle'] ?? '')
                                        : (creator.handle ?? ''))
                                    .isNotEmpty) ...[
                                  const SizedBox(height: 1),
                                  Text(
                                    '@${creator is Map ? creator['handle'] : creator.handle}',
                                    style: theme.textTheme.bodySmall?.copyWith(
                                      color: theme.hintColor,
                                    ),
                                  ),
                                ],
                              ],
                            ),
                            const SizedBox(height: 8),
                            if (replyTo != null &&
                                replyTo is Map &&
                                replyTo['text'] != null &&
                                (replyTo['text'] as String).isNotEmpty) ...[
                              Padding(
                                padding: const EdgeInsets.only(bottom: 8.0),
                                child: Text(
                                  replyTo['text'],
                                  style: theme.textTheme.bodySmall?.copyWith(
                                    color: theme.hintColor,
                                  ),
                                  maxLines: 3,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                            ],
                            if (replyTo != null && focusPhoto != null) ...[
                              SizedBox(
                                height: 64,
                                child: AspectRatio(
                                  aspectRatio:
                                      (focusPhoto.aspectRatio != null &&
                                          focusPhoto.aspectRatio.width > 0 &&
                                          focusPhoto.aspectRatio.height > 0)
                                      ? focusPhoto.aspectRatio.width / focusPhoto.aspectRatio.height
                                      : 1.0,
                                  child: AppImage(
                                    url: focusPhoto.thumb?.isNotEmpty == true
                                        ? focusPhoto.thumb
                                        : focusPhoto.fullsize,
                                    fit: BoxFit.cover,
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                ),
                              ),
                            ] else if (replyTo == null) ...[
                              Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    children: [
                                      Text(
                                        gallery.title ?? '',
                                        style: theme.textTheme.bodyMedium?.copyWith(
                                          fontWeight: FontWeight.w600,
                                        ),
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 4),
                                  Row(
                                    children: [
                                      Align(
                                        alignment: Alignment.centerLeft,
                                        child: SizedBox(
                                          height: 64,
                                          child: GalleryPreview(gallery: gallery),
                                        ),
                                      ),
                                    ],
                                  ),
                                ],
                              ),
                            ],
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                Divider(height: 1, thickness: 1, color: theme.dividerColor),
                const SizedBox(height: 16),
              ],
              Expanded(
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Current user avatar
                    if (apiService.currentUser?.avatar != null &&
                        (apiService.currentUser?.avatar?.isNotEmpty ?? false))
                      Padding(
                        padding: const EdgeInsets.only(right: 8.0, top: 4.0),
                        child: ClipOval(
                          child: AppImage(
                            url: apiService.currentUser!.avatar!,
                            width: 40,
                            height: 40,
                            fit: BoxFit.cover,
                          ),
                        ),
                      )
                    else
                      Padding(
                        padding: const EdgeInsets.only(right: 8.0, top: 4.0),
                        child: CircleAvatar(
                          radius: 20,
                          backgroundColor: theme.colorScheme.surfaceContainerHighest,
                          child: Icon(AppIcons.person, size: 20, color: theme.iconTheme.color),
                        ),
                      ),
                    // Text input
                    Expanded(
                      child: Padding(
                        padding: const EdgeInsets.only(left: 10),
                        child: FacetedTextField(
                          controller: widget.controller,
                          maxLines: 6,
                          enabled: true,
                          keyboardType: TextInputType.multiline,
                          hintText: 'Add a comment',
                          // The FacetedTextField handles its own style and padding internally
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),
            ],
          ),
        ),
      ),
    );
  }
}
