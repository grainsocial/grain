import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:grain/api.dart';
import 'package:grain/app_icons.dart';
import 'package:grain/models/comment.dart';
import 'package:grain/models/gallery_photo.dart';
import 'package:grain/providers/gallery_thread_cache_provider.dart';
import 'package:grain/screens/hashtag_page.dart';
import 'package:grain/screens/profile_page.dart';
import 'package:grain/utils.dart';
import 'package:grain/widgets/add_comment_button.dart';
import 'package:grain/widgets/add_comment_sheet.dart';
import 'package:grain/widgets/app_image.dart';
import 'package:grain/widgets/faceted_text.dart';
import 'package:grain/widgets/gallery_photo_view.dart';
import 'package:url_launcher/url_launcher.dart';

class CommentsPage extends ConsumerStatefulWidget {
  final String galleryUri;
  const CommentsPage({super.key, required this.galleryUri});

  @override
  ConsumerState<CommentsPage> createState() => _CommentsPageState();
}

class _CommentsPageState extends ConsumerState<CommentsPage> {
  GalleryPhoto? _selectedPhoto;

  void _showCommentInputSheet(BuildContext context, WidgetRef ref, {Comment? replyToComment}) {
    final threadState = ref.read(galleryThreadProvider(widget.galleryUri));
    // Pass replyTo as a Map for compatibility with add_comment_sheet
    final replyTo = replyToComment != null
        ? {
            'author': replyToComment.author,
            'focus': replyToComment.focus,
            'text': replyToComment.text,
          }
        : null;
    showAddCommentSheet(
      context,
      initialText: '', // Always blank
      onSubmit: (text) async {
        await ref
            .read(galleryThreadProvider(widget.galleryUri).notifier)
            .createComment(text: text.trim(), replyTo: replyToComment?.uri);
      },
      onCancel: () => Navigator.of(context).maybePop(),
      gallery: threadState.gallery,
      replyTo: replyTo,
    );
  }

  @override
  Widget build(BuildContext context) {
    final threadState = ref.watch(galleryThreadProvider(widget.galleryUri));
    final theme = Theme.of(context);
    return Stack(
      children: [
        Scaffold(
          backgroundColor: theme.scaffoldBackgroundColor,
          appBar: AppBar(
            backgroundColor: theme.appBarTheme.backgroundColor,
            surfaceTintColor: theme.appBarTheme.backgroundColor,
            title: Text('Comments'),
          ),
          body: GestureDetector(
            behavior: HitTestBehavior.translucent,
            child: threadState.loading
                ? Center(
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: theme.colorScheme.primary,
                    ),
                  )
                : threadState.error
                ? Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text('Failed to load comments.', style: theme.textTheme.bodyMedium),
                        if (threadState.errorMessage != null)
                          Padding(
                            padding: const EdgeInsets.only(top: 8.0),
                            child: Text(
                              threadState.errorMessage!,
                              style: theme.textTheme.bodySmall?.copyWith(
                                color: theme.colorScheme.error,
                              ),
                              textAlign: TextAlign.center,
                            ),
                          ),
                        const SizedBox(height: 16),
                        ElevatedButton(
                          onPressed: () => ref
                              .read(galleryThreadProvider(widget.galleryUri).notifier)
                              .fetchThread(),
                          child: const Text('Retry'),
                        ),
                      ],
                    ),
                  )
                : RefreshIndicator(
                    onRefresh: () async {
                      await ref
                          .read(galleryThreadProvider(widget.galleryUri).notifier)
                          .fetchThread();
                    },
                    child: ListView(
                      padding: const EdgeInsets.fromLTRB(12, 12, 12, 100),
                      children: [
                        if (threadState.gallery != null)
                          Text(
                            threadState.gallery!.title ?? '',
                            style: theme.textTheme.titleMedium,
                          ),
                        const SizedBox(height: 12),
                        _CommentsList(
                          comments: threadState.comments,
                          onPhotoTap: (photo) {
                            setState(() => _selectedPhoto = photo);
                          },
                          onReply: (comment, {mention}) =>
                              _showCommentInputSheet(context, ref, replyToComment: comment),
                          onDelete: (comment) async {
                            final confirmed = await showDialog<bool>(
                              context: context,
                              builder: (ctx) => AlertDialog(
                                title: const Text('Delete Comment'),
                                content: const Text(
                                  'Are you sure you want to delete this comment?',
                                ),
                                actions: [
                                  TextButton(
                                    onPressed: () => Navigator.of(ctx).pop(false),
                                    child: const Text('Cancel'),
                                  ),
                                  TextButton(
                                    onPressed: () => Navigator.of(ctx).pop(true),
                                    child: const Text('Delete'),
                                  ),
                                ],
                              ),
                            );
                            if (confirmed != true) return;
                            if (!context.mounted) return;
                            // Inline loading SnackBar
                            ScaffoldMessenger.of(context).removeCurrentSnackBar();
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(
                                content: Row(
                                  children: [
                                    const SizedBox(
                                      width: 18,
                                      height: 18,
                                      child: CircularProgressIndicator(strokeWidth: 2),
                                    ),
                                    const SizedBox(width: 16),
                                    const Text('Deleting comment...'),
                                  ],
                                ),
                                duration: const Duration(minutes: 1),
                              ),
                            );

                            final deleted = await ref
                                .read(galleryThreadProvider(widget.galleryUri).notifier)
                                .deleteComment(comment);

                            if (!context.mounted) return;
                            ScaffoldMessenger.of(context).removeCurrentSnackBar();
                            await Future.delayed(const Duration(milliseconds: 120));
                            if (!context.mounted) return;
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(
                                content: Text(
                                  deleted ? 'Comment deleted.' : 'Failed to delete comment.',
                                ),
                              ),
                            );
                          },
                        ),
                      ],
                    ),
                  ),
          ),
          bottomNavigationBar: Container(
            color: theme.scaffoldBackgroundColor,
            child: SafeArea(
              child: Padding(
                padding: const EdgeInsets.only(top: 8, left: 16, right: 16, bottom: 8),
                child: AddCommentButton(onPressed: () => _showCommentInputSheet(context, ref)),
              ),
            ),
          ),
          extendBody: true,
          extendBodyBehindAppBar: false,
        ),
        if (_selectedPhoto != null)
          Positioned.fill(
            child: GalleryPhotoView(
              photos: [_selectedPhoto!],
              initialIndex: 0,
              onClose: () => setState(() => _selectedPhoto = null),
              showAddCommentButton: false,
            ),
          ),
      ],
    );
  }
}

class _CommentsList extends StatelessWidget {
  final List<Comment> comments;
  final void Function(GalleryPhoto photo) onPhotoTap;
  final void Function(Comment replyToComment, {String? mention}) onReply;
  final void Function(Comment comment) onDelete;
  const _CommentsList({
    required this.comments,
    required this.onPhotoTap,
    required this.onReply,
    required this.onDelete,
  });

  Map<String, List<Comment>> _groupReplies(List<Comment> comments) {
    final repliesByParent = <String, List<Comment>>{};
    for (final comment in comments) {
      if (comment.replyTo != null) {
        repliesByParent.putIfAbsent(comment.replyTo!, () => []).add(comment);
      }
    }
    return repliesByParent;
  }

  List<Comment> _topLevel(List<Comment> comments) {
    return comments.where((c) => c.replyTo == null).toList();
  }

  /// Returns the top-level parent for a comment (itself if already top-level)
  Comment _findTopLevelParent(Comment comment, Map<String, Comment> byUri) {
    var current = comment;
    while (current.replyTo != null && byUri[current.replyTo!] != null) {
      final parent = byUri[current.replyTo!];
      if (parent == null) break;
      if (parent.replyTo == null) return parent;
      current = parent;
    }
    return current.replyTo == null ? current : byUri[current.replyTo!] ?? current;
  }

  Widget _buildCommentTree(
    Comment comment,
    Map<String, List<Comment>> repliesByParent,
    int depth,
    Map<String, Comment> byUri,
  ) {
    return Padding(
      padding: EdgeInsets.only(left: depth * 18.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _CommentTile(
            comment: comment,
            onPhotoTap: onPhotoTap,
            onReply: (c, {mention}) => onReply(comment, mention: mention),
            onDelete: onDelete,
          ),
          if (repliesByParent[comment.uri] != null)
            ...repliesByParent[comment.uri]!.map(
              (reply) => _buildCommentTree(reply, repliesByParent, depth + 1, byUri),
            ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final repliesByParent = _groupReplies(comments);
    final topLevel = _topLevel(comments);
    final byUri = {for (final c in comments) c.uri: c};
    if (comments.isEmpty) {
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 32),
        child: Center(
          child: Text(
            'No comments yet',
            style: theme.textTheme.bodyMedium?.copyWith(color: theme.hintColor),
          ),
        ),
      );
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (final comment in topLevel) _buildCommentTree(comment, repliesByParent, 0, byUri),
      ],
    );
  }
}

class _CommentTile extends StatelessWidget {
  final Comment comment;
  final void Function(GalleryPhoto photo)? onPhotoTap;
  final void Function(Comment replyToComment, {String? mention})? onReply;
  final void Function(Comment comment)? onDelete;
  const _CommentTile({required this.comment, this.onPhotoTap, this.onReply, this.onDelete});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final author = comment.author;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (author.avatar != null)
            ClipOval(
              child: AppImage(url: author.avatar, width: 32, height: 32, fit: BoxFit.cover),
            )
          else
            CircleAvatar(
              radius: 16,
              backgroundColor: theme.colorScheme.surfaceContainerHighest,
              child: Icon(AppIcons.person, size: 16, color: theme.iconTheme.color),
            ),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  author.displayName ?? '@${author.handle ?? ''}',
                  style: theme.textTheme.bodyLarge?.copyWith(fontWeight: FontWeight.bold),
                ),
                FacetedText(
                  text: comment.text,
                  facets: comment.facets,
                  style: theme.textTheme.bodyMedium,
                  linkStyle: theme.textTheme.bodyMedium?.copyWith(
                    color: theme.colorScheme.primary,
                    fontWeight: FontWeight.w600,
                  ),
                  onMentionTap: (did) {
                    Navigator.of(
                      context,
                    ).push(MaterialPageRoute(builder: (context) => ProfilePage(did: did)));
                  },
                  onLinkTap: (url) async {
                    final uri = Uri.parse(url);
                    if (!await launchUrl(uri)) {
                      throw Exception('Could not launch $url');
                    }
                  },
                  onTagTap: (tag) => Navigator.push(
                    context,
                    MaterialPageRoute(builder: (_) => HashtagPage(hashtag: tag)),
                  ),
                ),
                if (comment.focus != null &&
                    ((comment.focus!.thumb?.isNotEmpty ?? false) ||
                        (comment.focus!.fullsize?.isNotEmpty ?? false)))
                  Padding(
                    padding: const EdgeInsets.only(top: 8.0),
                    child: Align(
                      alignment: Alignment.centerLeft,
                      child: ConstrainedBox(
                        constraints: const BoxConstraints(maxWidth: 180, maxHeight: 180),
                        child: AspectRatio(
                          aspectRatio:
                              (comment.focus!.aspectRatio != null &&
                                  (comment.focus!.aspectRatio!.width > 0 &&
                                      comment.focus!.aspectRatio!.height > 0))
                              ? comment.focus!.aspectRatio!.width /
                                    comment.focus!.aspectRatio!.height
                              : 1.0,
                          child: ClipRRect(
                            borderRadius: BorderRadius.circular(8),
                            child: GestureDetector(
                              onTap: onPhotoTap != null
                                  ? () => onPhotoTap!(
                                      GalleryPhoto(
                                        uri: comment.focus!.uri,
                                        cid: comment.focus!.cid,
                                        thumb: comment.focus!.thumb,
                                        fullsize: comment.focus!.fullsize,
                                        alt: comment.focus!.alt,
                                        aspectRatio: comment.focus!.aspectRatio,
                                      ),
                                    )
                                  : null,
                              child: AppImage(
                                url: (comment.focus!.thumb?.isNotEmpty ?? false)
                                    ? comment.focus!.thumb
                                    : comment.focus!.fullsize,
                                fit: BoxFit.cover,
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                if (comment.createdAt != null)
                  Text(
                    formatRelativeTime(comment.createdAt!),
                    style: theme.textTheme.bodySmall?.copyWith(color: theme.hintColor),
                  ),
                const SizedBox(height: 4), // Add vertical spacing above the buttons
                Row(
                  children: [
                    if (comment.replyTo == null)
                      TextButton(
                        style: TextButton.styleFrom(
                          padding: EdgeInsets.zero,
                          minimumSize: Size(0, 0),
                          tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                        ),
                        onPressed: () {
                          final handle = comment.author.handle;
                          final mention = handle.isNotEmpty ? '@$handle ' : '';
                          if (onReply != null) onReply!(comment, mention: mention);
                        },
                        child: Text(
                          'Reply',
                          style: theme.textTheme.bodyMedium?.copyWith(
                            fontWeight: FontWeight.w600,
                            decoration: TextDecoration.none,
                          ),
                        ),
                      ),
                    if (comment.replyTo == null &&
                        comment.author.did == (apiService.currentUser?.did ?? ''))
                      const SizedBox(width: 16),
                    if (comment.author.did == (apiService.currentUser?.did ?? ''))
                      TextButton(
                        style: TextButton.styleFrom(
                          padding: EdgeInsets.zero,
                          minimumSize: Size(0, 0),
                          tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                        ),
                        onPressed: () {
                          if (onDelete != null) onDelete!(comment);
                        },
                        child: Text(
                          'Delete',
                          style: theme.textTheme.bodyMedium?.copyWith(
                            fontWeight: FontWeight.w600,
                            decoration: TextDecoration.none,
                          ),
                        ),
                      ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
