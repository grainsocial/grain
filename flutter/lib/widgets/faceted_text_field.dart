import 'dart:async';

import 'package:bluesky_text/bluesky_text.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/profile.dart';
import '../providers/actor_search_provider.dart';
import '../utils/facet_utils.dart';

class FacetedTextField extends ConsumerStatefulWidget {
  final String? label;
  final TextEditingController controller;
  final int maxLines;
  final bool enabled;
  final TextInputType? keyboardType;
  final String? hintText;
  final void Function(String)? onChanged;
  final Widget? prefixIcon;
  final Widget? suffixIcon;
  final List<Map<String, dynamic>>? facets;

  const FacetedTextField({
    super.key,
    this.label,
    required this.controller,
    this.maxLines = 1,
    this.enabled = true,
    this.keyboardType,
    this.hintText,
    this.onChanged,
    this.prefixIcon,
    this.suffixIcon,
    this.facets,
  });

  @override
  ConsumerState<FacetedTextField> createState() => _FacetedTextFieldState();
}

class _FacetedTextFieldState extends ConsumerState<FacetedTextField> {
  // Track which handles have been inserted via overlay selection
  final Set<String> _insertedHandles = {};
  OverlayEntry? _overlayEntry;
  final GlobalKey _fieldKey = GlobalKey();
  List<Profile> _actorResults = [];
  Timer? _debounceTimer;

  @override
  void initState() {
    super.initState();
    widget.controller.addListener(_onTextChanged);
  }

  @override
  void dispose() {
    widget.controller.removeListener(_onTextChanged);
    _debounceTimer?.cancel();
    _removeOverlay();
    super.dispose();
  }

  void _onTextChanged() async {
    final text = widget.controller.text;
    final selection = widget.controller.selection;
    final cursorPos = selection.baseOffset;
    if (cursorPos < 0) {
      _removeOverlay();
      return;
    }
    // If the last character typed is a space, always close overlay
    if (cursorPos > 0 && text[cursorPos - 1] == ' ') {
      _removeOverlay();
      return;
    }
    // Find the @mention match that contains the cursor
    final regex = RegExp(r'@([\w.]+)');
    final matches = regex.allMatches(text);
    String? query;
    for (final match in matches) {
      final start = match.start;
      final end = match.end;
      if (cursorPos > start && cursorPos <= end) {
        query = match.group(1);
        break;
      }
    }
    if (query != null && query.isNotEmpty) {
      _debounceTimer?.cancel();
      _debounceTimer = Timer(const Duration(milliseconds: 500), () async {
        final results = await ref.read(actorSearchProvider.notifier).search(query!);
        if (mounted) {
          setState(() {
            _actorResults = results;
          });
          _showOverlay();
        }
      });
      return;
    }
    _debounceTimer?.cancel();
    _removeOverlay();
  }

  void _showOverlay() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _removeOverlay();
      final overlay = Overlay.of(context);
      final caretOffset = _getCaretPosition();
      if (caretOffset == null) return;

      // Show only the first 5 results, no scroll, use simple rows
      final double rowHeight = 44.0;
      final int maxItems = 5;
      final resultsToShow = _actorResults.take(maxItems).toList();
      final double overlayHeight = resultsToShow.length * rowHeight;
      final double overlayWidth = 300.0;

      // Get screen size
      final mediaQuery = MediaQuery.of(context);
      final screenWidth = mediaQuery.size.width;

      // Default to left of caret, but if it would overflow, switch to right
      double left = caretOffset.dx;
      if (left + overlayWidth > screenWidth - 8) {
        // Try to align right edge of overlay with caret, but don't go off left edge
        left = (caretOffset.dx - overlayWidth).clamp(8.0, screenWidth - overlayWidth - 8.0);
      }

      _overlayEntry = OverlayEntry(
        builder: (context) => Positioned(
          left: left,
          top: caretOffset.dy,
          width: overlayWidth,
          height: overlayHeight,
          child: Material(
            elevation: 4,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: resultsToShow.map((actor) {
                return Material(
                  color: Colors.transparent,
                  child: InkWell(
                    onTap: () => _insertActor(actor.handle),
                    child: Container(
                      height: rowHeight,
                      width: double.infinity,
                      alignment: Alignment.centerLeft,
                      padding: const EdgeInsets.symmetric(horizontal: 12.0),
                      child: Row(
                        children: [
                          if (actor.avatar != null && actor.avatar!.isNotEmpty)
                            CircleAvatar(radius: 16, backgroundImage: NetworkImage(actor.avatar!))
                          else
                            CircleAvatar(radius: 16, child: Icon(Icons.person, size: 16)),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Text(
                              actor.displayName ?? actor.handle,
                              style: Theme.of(context).textTheme.bodyMedium,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          const SizedBox(width: 8),
                          Text(
                            '@${actor.handle}',
                            style: Theme.of(
                              context,
                            ).textTheme.bodySmall?.copyWith(color: Colors.grey[600]),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ],
                      ),
                    ),
                  ),
                );
              }).toList(),
            ),
          ),
        ),
      );
      overlay.insert(_overlayEntry!);
    });
  }

  void _removeOverlay() {
    if (_overlayEntry != null) {
      _overlayEntry?.remove();
      _overlayEntry = null;
    }
  }

  Offset? _getCaretPosition() {
    final renderBox = _fieldKey.currentContext?.findRenderObject() as RenderBox?;
    if (renderBox == null) return null;

    final controller = widget.controller;
    final selection = controller.selection;
    if (!selection.isValid) return null;

    // Get the text up to the caret
    final text = controller.text.substring(0, selection.baseOffset);
    final textStyle =
        Theme.of(context).textTheme.bodyMedium?.copyWith(fontSize: 15) ??
        const TextStyle(fontSize: 15);
    final textPainter = TextPainter(
      text: TextSpan(text: text, style: textStyle),
      textDirection: TextDirection.ltr,
      maxLines: widget.maxLines,
    );
    textPainter.layout(minWidth: 0, maxWidth: renderBox.size.width);

    final caretOffset = textPainter.getOffsetForCaret(TextPosition(offset: text.length), Rect.zero);

    // Convert caret offset to global coordinates
    final fieldOffset = renderBox.localToGlobal(Offset.zero);
    // Add vertical padding to position below the caret
    return fieldOffset + Offset(caretOffset.dx, caretOffset.dy + textPainter.preferredLineHeight);
  }

  void _insertActor(String actorName) {
    final text = widget.controller.text;
    final selection = widget.controller.selection;
    final cursorPos = selection.baseOffset;
    // Find the @mention match that contains the cursor (not just before it)
    final regex = RegExp(r'@([\w.]+)');
    final matches = regex.allMatches(text);
    Match? matchToReplace;
    for (final match in matches) {
      if (cursorPos > match.start && cursorPos <= match.end) {
        matchToReplace = match;
        break;
      }
    }
    if (matchToReplace != null) {
      final start = matchToReplace.start;
      final end = matchToReplace.end;
      final newText = text.replaceRange(start, end, '@$actorName ');
      setState(() {
        _insertedHandles.add(actorName);
      });
      widget.controller.value = TextEditingValue(
        text: newText,
        selection: TextSelection.collapsed(offset: start + actorName.length + 2),
      );
    }
    _removeOverlay();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (widget.label != null && widget.label!.isNotEmpty) ...[
          Text(
            widget.label!,
            style: theme.textTheme.bodyMedium?.copyWith(
              fontWeight: FontWeight.w500,
              color: theme.colorScheme.onSurface,
            ),
          ),
          const SizedBox(height: 6),
        ],
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
                    _MentionHighlightTextField(
                      key: _fieldKey,
                      controller: widget.controller,
                      maxLines: widget.maxLines,
                      enabled: widget.enabled,
                      keyboardType: widget.keyboardType,
                      onChanged: widget.onChanged,
                      hintText: widget.hintText,
                      prefixIcon: widget.prefixIcon,
                      suffixIcon: widget.suffixIcon,
                      insertedHandles: _insertedHandles,
                      facets: widget.facets,
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

class _MentionHighlightTextField extends StatefulWidget {
  final Set<String>? insertedHandles;
  final TextEditingController controller;
  final int maxLines;
  final bool enabled;
  final TextInputType? keyboardType;
  final String? hintText;
  final void Function(String)? onChanged;
  final Widget? prefixIcon;
  final Widget? suffixIcon;
  final List<Map<String, dynamic>>? facets;

  const _MentionHighlightTextField({
    super.key,
    required this.controller,
    required this.maxLines,
    required this.enabled,
    this.keyboardType,
    this.hintText,
    this.onChanged,
    this.prefixIcon,
    this.suffixIcon,
    this.insertedHandles,
    this.facets,
  });

  @override
  State<_MentionHighlightTextField> createState() => _MentionHighlightTextFieldState();
}

class _MentionHighlightTextFieldState extends State<_MentionHighlightTextField> {
  final ScrollController _richTextScrollController = ScrollController();
  final ScrollController _textFieldScrollController = ScrollController();

  void _onMentionTap(String did) {
    // Show overlay for this mention (simulate as if user is typing @mention)
    final parent = context.findAncestorStateOfType<_FacetedTextFieldState>();
    if (parent != null) {
      parent._showOverlay();
    }
  }

  List<Map<String, dynamic>> _parsedFacets = [];
  Timer? _facetDebounce;

  @override
  void initState() {
    super.initState();
    _parseFacets();
    widget.controller.addListener(_parseFacets);

    // Sync scroll controllers
    _textFieldScrollController.addListener(() {
      if (_richTextScrollController.hasClients && _textFieldScrollController.hasClients) {
        _richTextScrollController.jumpTo(_textFieldScrollController.offset);
      }
    });
  }

  @override
  void dispose() {
    widget.controller.removeListener(_parseFacets);
    _facetDebounce?.cancel();
    _richTextScrollController.dispose();
    _textFieldScrollController.dispose();
    super.dispose();
  }

  void _parseFacets() {
    _facetDebounce?.cancel();
    _facetDebounce = Timer(const Duration(milliseconds: 100), () async {
      final text = widget.controller.text;
      if (widget.facets != null && widget.facets!.isNotEmpty) {
        setState(() => _parsedFacets = widget.facets!);
      } else {
        try {
          final blueskyText = BlueskyText(text);
          final entities = blueskyText.entities;
          final facets = await entities.toFacets();
          if (mounted) setState(() => _parsedFacets = List<Map<String, dynamic>>.from(facets));
        } catch (_) {
          if (mounted) setState(() => _parsedFacets = []);
        }
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final text = widget.controller.text;
    final baseStyle = theme.textTheme.bodyMedium?.copyWith(fontSize: 15);
    final linkStyle = baseStyle?.copyWith(color: theme.colorScheme.primary);

    // Use the same facet processing logic as FacetedText
    final spans = FacetUtils.processFacets(
      text: text,
      facets: _parsedFacets,
      defaultStyle: baseStyle,
      linkStyle: linkStyle,
      onMentionTap: _onMentionTap,
      onLinkTap: null, // No link tap in text field
      onTagTap: null, // No tag tap in text field
    );
    return LayoutBuilder(
      builder: (context, constraints) {
        return SizedBox(
          width: double.infinity, // Make it full width
          height: widget.maxLines == 1
              ? null
              : (baseStyle?.fontSize ?? 15) * 1.4 * widget.maxLines +
                    24, // Line height * maxLines + padding
          child: Stack(
            children: [
              // RichText for highlight wrapped in SingleChildScrollView
              SingleChildScrollView(
                controller: _richTextScrollController,
                physics: const NeverScrollableScrollPhysics(), // Disable direct interaction
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                  child: RichText(
                    text: TextSpan(children: spans),
                    maxLines: null, // Allow unlimited lines for scrolling
                    overflow: TextOverflow.visible,
                  ),
                ),
              ),
              // Editable TextField for input, but with transparent text so only RichText is visible
              Positioned.fill(
                child: TextField(
                  controller: widget.controller,
                  scrollController: _textFieldScrollController,
                  maxLines: null, // Allow unlimited lines for scrolling
                  enabled: widget.enabled,
                  keyboardType: widget.keyboardType,
                  onChanged: widget.onChanged,
                  style: baseStyle?.copyWith(color: const Color(0x01000000)),
                  cursorColor: theme.colorScheme.primary,
                  showCursor: true,
                  enableInteractiveSelection: true,
                  decoration: InputDecoration(
                    hintText: widget.hintText,
                    hintStyle: baseStyle?.copyWith(color: theme.hintColor),
                    border: InputBorder.none,
                    contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                    isDense: true,
                    prefixIcon: widget.prefixIcon,
                    suffixIcon: widget.suffixIcon,
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}
