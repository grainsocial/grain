import 'dart:io';

import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:grain/app_icons.dart';
import 'package:grain/widgets/faceted_text_field.dart';
import 'package:grain/widgets/plain_text_field.dart';
import 'package:image_picker/image_picker.dart';

Future<void> showEditProfileSheet(
  BuildContext context, {
  required String? initialDisplayName,
  required String? initialDescription,
  required String? initialAvatarUrl,
  required Future<void> Function(String, String, dynamic) onSave,
  required VoidCallback onCancel,
}) async {
  final theme = Theme.of(context);
  await showCupertinoSheet(
    context: context,
    useNestedNavigation: false,
    pageBuilder: (context) => Material(
      type: MaterialType.transparency,
      child: EditProfileSheet(
        initialDisplayName: initialDisplayName,
        initialDescription: initialDescription,
        initialAvatarUrl: initialAvatarUrl,
        onSave: onSave,
        onCancel: onCancel,
      ),
    ),
  );
  // Restore status bar style or any other cleanup
  SystemChrome.setSystemUIOverlayStyle(
    theme.brightness == Brightness.dark ? SystemUiOverlayStyle.light : SystemUiOverlayStyle.dark,
  );
}

class EditProfileSheet extends StatefulWidget {
  final String? initialDisplayName;
  final String? initialDescription;
  final String? initialAvatarUrl;
  final Future<void> Function(String displayName, String description, XFile? avatar)? onSave;
  final VoidCallback? onCancel;

  const EditProfileSheet({
    super.key,
    this.initialDisplayName,
    this.initialDescription,
    this.initialAvatarUrl,
    this.onSave,
    this.onCancel,
  });

  @override
  State<EditProfileSheet> createState() => _EditProfileSheetState();
}

class _EditProfileSheetState extends State<EditProfileSheet> {
  late TextEditingController _displayNameController;
  late TextEditingController _descriptionController;
  XFile? _selectedAvatar;
  bool _saving = false;
  static const int maxDisplayNameGraphemes = 64;
  static const int maxDescriptionGraphemes = 256;

  @override
  void initState() {
    super.initState();
    _displayNameController = TextEditingController(text: widget.initialDisplayName ?? '');
    _descriptionController = TextEditingController(text: widget.initialDescription ?? '');
    _displayNameController.addListener(_onInputChanged);
    _descriptionController.addListener(_onDescriptionChanged);
  }

  void _onDescriptionChanged() {
    setState(() {}); // For character count
  }

  void _onInputChanged() {
    setState(() {
      // Trigger rebuild to update character counts
    });
  }

  @override
  void dispose() {
    _displayNameController.dispose();
    _descriptionController.dispose();
    super.dispose();
  }

  Future<void> _pickAvatar() async {
    final picker = ImagePicker();
    final picked = await picker.pickImage(source: ImageSource.gallery, imageQuality: 85);
    if (picked != null) {
      setState(() {
        _selectedAvatar = picked;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final avatarRadius = 44.0;
    final displayNameGraphemes = _displayNameController.text.characters.length;
    final descriptionGraphemes = _descriptionController.text.characters.length;
    return CupertinoPageScaffold(
      backgroundColor: theme.colorScheme.surface,
      navigationBar: CupertinoNavigationBar(
        backgroundColor: theme.colorScheme.surface,
        border: Border(bottom: BorderSide(color: theme.dividerColor, width: 1)),
        middle: Text(
          'Edit profile',
          style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w600),
        ),
        leading: CupertinoButton(
          padding: EdgeInsets.zero,
          onPressed: _saving ? null : widget.onCancel,
          child: Text(
            'Cancel',
            style: TextStyle(color: theme.colorScheme.primary, fontWeight: FontWeight.w600),
          ),
        ),
        trailing: CupertinoButton(
          padding: EdgeInsets.zero,
          onPressed: _saving
              ? null
              : () async {
                  if (displayNameGraphemes > maxDisplayNameGraphemes ||
                      descriptionGraphemes > maxDescriptionGraphemes) {
                    await showDialog(
                      context: context,
                      builder: (context) => AlertDialog(
                        title: const Text('Character Limit Exceeded'),
                        content: Text(
                          displayNameGraphemes > maxDisplayNameGraphemes
                              ? 'Display Name must be $maxDisplayNameGraphemes characters or fewer.'
                              : 'Description must be $maxDescriptionGraphemes characters or fewer.',
                        ),
                        actions: [
                          TextButton(
                            child: const Text('OK'),
                            onPressed: () => Navigator.of(context).pop(),
                          ),
                        ],
                      ),
                    );
                    return;
                  }
                  if (widget.onSave != null) {
                    setState(() {
                      _saving = true;
                    });
                    await widget.onSave!(
                      _displayNameController.text.trim(),
                      _descriptionController.text.trim(),
                      _selectedAvatar,
                    );
                    setState(() {
                      _saving = false;
                    });
                  }
                },
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                'Save',
                style: TextStyle(
                  color: _saving ? theme.disabledColor : theme.colorScheme.primary,
                  fontWeight: FontWeight.w600,
                ),
              ),
              if (_saving) ...[
                const SizedBox(width: 8),
                SizedBox(
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    valueColor: AlwaysStoppedAnimation<Color>(theme.colorScheme.primary),
                    semanticsLabel: 'Saving',
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
              const SizedBox(height: 8),
              GestureDetector(
                onTap: _pickAvatar,
                child: Stack(
                  alignment: Alignment.center,
                  children: [
                    CircleAvatar(
                      radius: avatarRadius,
                      backgroundColor: theme.colorScheme.surfaceVariant,
                      backgroundImage: _selectedAvatar != null
                          ? FileImage(File(_selectedAvatar!.path))
                          : (widget.initialAvatarUrl != null && widget.initialAvatarUrl!.isNotEmpty)
                          ? NetworkImage(widget.initialAvatarUrl!)
                          : null as ImageProvider<Object>?,
                      child:
                          (_selectedAvatar == null &&
                              (widget.initialAvatarUrl == null || widget.initialAvatarUrl!.isEmpty))
                          ? Icon(
                              AppIcons.accountCircle,
                              size: avatarRadius * 2,
                              color: theme.colorScheme.onSurfaceVariant,
                            )
                          : null,
                    ),
                    Positioned(
                      bottom: 0,
                      right: 0,
                      child: Container(
                        decoration: BoxDecoration(
                          color: theme.colorScheme.primary,
                          shape: BoxShape.circle,
                        ),
                        padding: const EdgeInsets.all(6),
                        child: Icon(AppIcons.camera, color: Colors.white, size: 12),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              Expanded(
                child: SingleChildScrollView(
                  padding: EdgeInsets.zero,
                  child: Column(
                    children: [
                      PlainTextField(
                        label: 'Display Name',
                        controller: _displayNameController,
                        maxLines: 1,
                      ),
                      Padding(
                        padding: const EdgeInsets.only(top: 4),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            const SizedBox(),
                            Text(
                              '$displayNameGraphemes/$maxDisplayNameGraphemes',
                              style: theme.textTheme.bodySmall?.copyWith(
                                color: displayNameGraphemes > maxDisplayNameGraphemes
                                    ? theme.colorScheme.error
                                    : theme.textTheme.bodySmall?.color,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 12),
                      FacetedTextField(
                        label: 'Description',
                        controller: _descriptionController,
                        maxLines: 6,
                      ),
                      Padding(
                        padding: const EdgeInsets.only(top: 4),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            const SizedBox(),
                            Text(
                              '$descriptionGraphemes/$maxDescriptionGraphemes',
                              style: theme.textTheme.bodySmall?.copyWith(
                                color: descriptionGraphemes > maxDescriptionGraphemes
                                    ? theme.colorScheme.error
                                    : theme.textTheme.bodySmall?.color,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
