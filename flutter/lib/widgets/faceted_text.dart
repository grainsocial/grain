import 'package:flutter/material.dart';

import '../utils/facet_utils.dart';

class FacetedText extends StatelessWidget {
  final String text;
  final List<Map<String, dynamic>>? facets;
  final TextStyle? style;
  final TextStyle? linkStyle;
  final void Function(String did)? onMentionTap;
  final void Function(String url)? onLinkTap;
  final void Function(String tag)? onTagTap;

  const FacetedText({
    super.key,
    required this.text,
    this.facets,
    this.style,
    this.linkStyle,
    this.onMentionTap,
    this.onLinkTap,
    this.onTagTap,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final defaultStyle = style ?? theme.textTheme.bodyMedium;
    final defaultLinkStyle =
        linkStyle ??
        defaultStyle?.copyWith(
          color: theme.colorScheme.primary,
          fontWeight: FontWeight.w600,
          decoration: TextDecoration.underline,
        );

    if (facets == null || facets!.isEmpty) {
      return Text(text, style: defaultStyle);
    }

    final spans = FacetUtils.processFacets(
      text: text,
      facets: facets,
      defaultStyle: defaultStyle,
      linkStyle: defaultLinkStyle,
      onMentionTap: onMentionTap,
      onLinkTap: onLinkTap,
      onTagTap: onTagTap,
    );

    return RichText(text: TextSpan(children: spans));
  }
}
