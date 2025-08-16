import 'package:flutter/material.dart';
import 'package:grain/api.dart';
import 'package:grain/app_icons.dart';
import 'package:grain/models/gallery_photo.dart';
import 'package:grain/widgets/app_image.dart';
import 'package:grain/widgets/gallery_photo_view.dart';

class PhotoGroup {
  final String title;
  final List<GalleryPhoto> photos;
  final DateTime? sortDate;

  PhotoGroup({required this.title, required this.photos, this.sortDate});
}

class PhotoLibraryPage extends StatefulWidget {
  const PhotoLibraryPage({super.key});

  @override
  State<PhotoLibraryPage> createState() => _PhotoLibraryPageState();
}

class _PhotoLibraryPageState extends State<PhotoLibraryPage> {
  List<GalleryPhoto> _photos = [];
  List<PhotoGroup> _photoGroups = [];
  bool _isLoading = true;
  String? _error;
  final ScrollController _scrollController = ScrollController();
  double _scrollPosition = 0.0;

  @override
  void initState() {
    super.initState();
    _loadPhotos();
    _scrollController.addListener(_onScroll);
  }

  @override
  void dispose() {
    _scrollController.removeListener(_onScroll);
    _scrollController.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (_scrollController.hasClients) {
      setState(() {
        _scrollPosition = _scrollController.offset;
      });
    }
  }

  // Calculate which group is currently in view based on scroll position
  int _getCurrentGroupIndex() {
    if (!_scrollController.hasClients || _photoGroups.isEmpty) return 0;

    final scrollOffset = _scrollController.offset;
    final padding = 16.0; // ListView padding
    double currentOffset = padding;

    for (int i = 0; i < _photoGroups.length; i++) {
      final group = _photoGroups[i];

      // Add space for group title
      final titleHeight = 24.0 + 12.0 + (i == 0 ? 0 : 24.0); // title + padding + top margin
      currentOffset += titleHeight;

      // Calculate grid height for this group
      final photos = group.photos;
      final crossAxisCount = photos.length == 1 ? 1 : (photos.length == 2 ? 2 : 3);
      final aspectRatio = photos.length <= 2 ? 1.5 : 1.0;
      final rows = (photos.length / crossAxisCount).ceil();

      // Estimate grid item size based on screen width
      final screenWidth = MediaQuery.of(context).size.width;
      final gridPadding = 30.0 + 32.0; // right padding + left/right margins
      final availableWidth = screenWidth - gridPadding;
      final itemWidth = (availableWidth - (crossAxisCount - 1) * 4) / crossAxisCount;
      final itemHeight = itemWidth / aspectRatio;
      final gridHeight = rows * itemHeight + (rows - 1) * 4; // include spacing

      currentOffset += gridHeight;

      // Check if we're currently viewing this group
      if (scrollOffset < currentOffset) {
        return i;
      }
    }

    return _photoGroups.length - 1; // Return last group if we're at the bottom
  }

  Future<void> _loadPhotos() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final currentUser = apiService.currentUser;
      if (currentUser == null || currentUser.did.isEmpty) {
        setState(() {
          _error = 'No current user found';
          _isLoading = false;
        });
        return;
      }

      final photos = await apiService.fetchActorPhotos(did: currentUser.did);

      if (mounted) {
        setState(() {
          _photos = photos;
          _photoGroups = _groupPhotosByDate(photos);
          _isLoading = false;
        });

        // Force update scroll indicator after layout is complete
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (_scrollController.hasClients && mounted) {
            setState(() {
              _scrollPosition = _scrollController.offset;
            });
          }
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = 'Failed to load photos: $e';
          _isLoading = false;
        });
      }
    }
  }

  List<PhotoGroup> _groupPhotosByDate(List<GalleryPhoto> photos) {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final yesterday = today.subtract(const Duration(days: 1));

    final Map<String, List<GalleryPhoto>> groupedPhotos = {};
    final List<GalleryPhoto> noExifPhotos = [];

    for (final photo in photos) {
      DateTime? photoDate;
      // Try to parse the dateTimeOriginal from EXIF record data
      if (photo.exif?.record?['dateTimeOriginal'] != null) {
        try {
          final dateTimeOriginal = photo.exif!.record!['dateTimeOriginal'] as String;
          photoDate = DateTime.parse(dateTimeOriginal);
        } catch (e) {
          // If parsing fails, add to no EXIF group
          noExifPhotos.add(photo);
          continue;
        }
      } else {
        noExifPhotos.add(photo);
        continue;
      }

      final photoDay = DateTime(photoDate.year, photoDate.month, photoDate.day);
      String groupKey;

      if (photoDay.isAtSameMomentAs(today)) {
        groupKey = 'Today';
      } else if (photoDay.isAtSameMomentAs(yesterday)) {
        groupKey = 'Yesterday';
      } else {
        final daysDifference = today.difference(photoDay).inDays;

        if (daysDifference <= 30) {
          // Group by week for last 30 days
          final weekStart = photoDay.subtract(Duration(days: photoDay.weekday - 1));
          groupKey = 'Week of ${_formatDate(weekStart)}';
        } else {
          // Group by month for older photos
          groupKey = '${_getMonthName(photoDate.month)} ${photoDate.year}';
        }
      }

      groupedPhotos.putIfAbsent(groupKey, () => []).add(photo);
    }

    final List<PhotoGroup> groups = [];

    // Sort and create PhotoGroup objects
    final sortedEntries = groupedPhotos.entries.toList()
      ..sort((a, b) {
        final aDate = _getGroupSortDate(a.key, a.value);
        final bDate = _getGroupSortDate(b.key, b.value);
        return bDate.compareTo(aDate); // Most recent first
      });

    for (final entry in sortedEntries) {
      final sortedPhotos = entry.value
        ..sort((a, b) {
          final aDate = _getPhotoDate(a);
          final bDate = _getPhotoDate(b);
          return bDate.compareTo(aDate); // Most recent first within group
        });

      groups.add(
        PhotoGroup(
          title: entry.key,
          photos: sortedPhotos,
          sortDate: _getGroupSortDate(entry.key, entry.value),
        ),
      );
    }

    // Add photos without EXIF data at the end
    if (noExifPhotos.isNotEmpty) {
      groups.add(
        PhotoGroup(
          title: 'Photos without date info',
          photos: noExifPhotos,
          sortDate: DateTime(1970), // Very old date to sort at bottom
        ),
      );
    }

    return groups;
  }

  DateTime _getGroupSortDate(String groupKey, List<GalleryPhoto> photos) {
    if (groupKey == 'Today') return DateTime.now();
    if (groupKey == 'Yesterday') return DateTime.now().subtract(const Duration(days: 1));

    // For other groups, use the most recent photo date in the group
    DateTime? latestDate;
    for (final photo in photos) {
      final photoDate = _getPhotoDate(photo);
      if (latestDate == null || photoDate.isAfter(latestDate)) {
        latestDate = photoDate;
      }
    }
    return latestDate ?? DateTime(1970);
  }

  DateTime _getPhotoDate(GalleryPhoto photo) {
    if (photo.exif?.record?['dateTimeOriginal'] != null) {
      try {
        final dateTimeOriginal = photo.exif!.record!['dateTimeOriginal'] as String;
        return DateTime.parse(dateTimeOriginal);
      } catch (e) {
        // Fall back to a very old date if parsing fails
        return DateTime(1970);
      }
    }
    return DateTime(1970);
  }

  String _formatDate(DateTime date) {
    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    return '${months[date.month - 1]} ${date.day}';
  }

  String _getMonthName(int month) {
    const months = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ];
    return months[month - 1];
  }

  Future<void> _onRefresh() async {
    await _loadPhotos();
  }

  void _showPhotoDetail(GalleryPhoto photo) {
    // Create a flattened list of photos in the same order they appear on the page
    final List<GalleryPhoto> orderedPhotos = [];
    for (final group in _photoGroups) {
      orderedPhotos.addAll(group.photos);
    }

    // Find the index of the photo in the ordered list
    final photoIndex = orderedPhotos.indexOf(photo);
    if (photoIndex == -1) return; // Photo not found, shouldn't happen

    Navigator.of(context).push(
      PageRouteBuilder(
        pageBuilder: (context, animation, secondaryAnimation) => GalleryPhotoView(
          photos: orderedPhotos,
          initialIndex: photoIndex,
          showAddCommentButton: false,
          onClose: () => Navigator.of(context).pop(),
          onPhotoDeleted: (deletedPhoto) {
            // Remove the photo from the local state
            setState(() {
              _photos.removeWhere((p) => p.uri == deletedPhoto.uri);
              _photoGroups = _groupPhotosByDate(_photos);
            });
          },
        ),
        transitionDuration: const Duration(milliseconds: 200),
        reverseTransitionDuration: const Duration(milliseconds: 200),
        transitionsBuilder: (context, animation, secondaryAnimation, child) {
          return FadeTransition(opacity: animation, child: child);
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      backgroundColor: theme.scaffoldBackgroundColor,
      appBar: AppBar(
        title: const Text('Photo Library'),
        backgroundColor: theme.appBarTheme.backgroundColor,
        surfaceTintColor: theme.appBarTheme.backgroundColor,
        elevation: 0,
      ),
      body: RefreshIndicator(onRefresh: _onRefresh, child: _buildBodyWithScrollbar(theme)),
    );
  }

  Widget _buildBodyWithScrollbar(ThemeData theme) {
    return Stack(
      children: [
        Padding(
          padding: const EdgeInsets.only(right: 30), // Make room for scroll indicator
          child: _buildBody(theme),
        ),
        if (!_isLoading && _error == null && _photos.isNotEmpty) _buildScrollIndicator(theme),
      ],
    );
  }

  Widget _buildScrollIndicator(ThemeData theme) {
    return Positioned(
      right: 4,
      top: 0,
      bottom: 0,
      child: GestureDetector(
        onPanUpdate: (details) {
          if (_scrollController.hasClients) {
            final RenderBox renderBox = context.findRenderObject() as RenderBox;
            final localPosition = renderBox.globalToLocal(details.globalPosition);
            final screenHeight = renderBox.size.height;
            final maxScrollExtent = _scrollController.position.maxScrollExtent;
            final relativePosition = (localPosition.dy / screenHeight).clamp(0.0, 1.0);
            final newPosition = relativePosition * maxScrollExtent;
            _scrollController.jumpTo(newPosition.clamp(0.0, maxScrollExtent));
          }
        },
        onTapDown: (details) {
          if (_scrollController.hasClients) {
            final RenderBox renderBox = context.findRenderObject() as RenderBox;
            final localPosition = renderBox.globalToLocal(details.globalPosition);
            final screenHeight = renderBox.size.height;
            final maxScrollExtent = _scrollController.position.maxScrollExtent;
            final relativePosition = (localPosition.dy / screenHeight).clamp(0.0, 1.0);
            final newPosition = relativePosition * maxScrollExtent;
            _scrollController.animateTo(
              newPosition.clamp(0.0, maxScrollExtent),
              duration: const Duration(milliseconds: 200),
              curve: Curves.easeInOut,
            );
          }
        },
        child: Container(
          width: 24,
          decoration: BoxDecoration(
            color: theme.scaffoldBackgroundColor.withValues(alpha: 0.8),
            borderRadius: BorderRadius.circular(12),
          ),
          child: CustomPaint(
            painter: ScrollIndicatorPainter(
              scrollPosition: _scrollPosition,
              maxScrollExtent: _scrollController.hasClients
                  ? _scrollController.position.maxScrollExtent
                  : 0,
              viewportHeight: _scrollController.hasClients
                  ? _scrollController.position.viewportDimension
                  : 0,
              color: theme.colorScheme.onSurface.withValues(alpha: 0.4),
              activeColor: theme.colorScheme.primary,
              currentGroupIndex: _getCurrentGroupIndex(),
              totalGroups: _photoGroups.length,
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildBody(ThemeData theme) {
    if (_isLoading) {
      return const Center(child: CircularProgressIndicator());
    }

    if (_error != null) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(AppIcons.brokenImage, size: 64, color: theme.hintColor),
            const SizedBox(height: 16),
            Text(
              _error!,
              style: theme.textTheme.bodyLarge?.copyWith(color: theme.hintColor),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 16),
            ElevatedButton(onPressed: _loadPhotos, child: const Text('Retry')),
          ],
        ),
      );
    }

    if (_photos.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(AppIcons.photoLibrary, size: 64, color: theme.hintColor),
            const SizedBox(height: 16),
            Text(
              'No photos yet',
              style: theme.textTheme.headlineSmall?.copyWith(color: theme.hintColor),
            ),
            const SizedBox(height: 8),
            Text(
              'Upload some photos to see them here',
              style: theme.textTheme.bodyLarge?.copyWith(color: theme.hintColor),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      );
    }

    return ListView.builder(
      controller: _scrollController,
      padding: const EdgeInsets.all(16),
      itemCount: _photoGroups.length,
      itemBuilder: (context, index) {
        final group = _photoGroups[index];
        return _buildPhotoGroup(group, theme, index);
      },
    );
  }

  Widget _buildPhotoGroup(PhotoGroup group, ThemeData theme, int index) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: EdgeInsets.only(bottom: 12, top: index == 0 ? 0 : 24),
          child: Text(
            group.title,
            style: theme.textTheme.headlineSmall?.copyWith(
              fontWeight: FontWeight.bold,
              color: theme.colorScheme.onSurface,
            ),
          ),
        ),
        _buildPhotoGrid(group.photos, theme),
      ],
    );
  }

  Widget _buildPhotoGrid(List<GalleryPhoto> photos, ThemeData theme) {
    final crossAxisCount = photos.length == 1 ? 1 : (photos.length == 2 ? 2 : 3);
    final aspectRatio = photos.length <= 2 ? 1.5 : 1.0;

    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: crossAxisCount,
        crossAxisSpacing: 4,
        mainAxisSpacing: 4,
        childAspectRatio: aspectRatio,
      ),
      itemCount: photos.length,
      itemBuilder: (context, index) {
        final photo = photos[index];
        return _buildPhotoTile(photo, theme);
      },
    );
  }

  Widget _buildPhotoTile(GalleryPhoto photo, ThemeData theme) {
    return GestureDetector(
      onTap: () => _showPhotoDetail(photo),
      child: Hero(
        tag: 'photo-${photo.uri}',
        child: Container(
          decoration: BoxDecoration(borderRadius: BorderRadius.circular(8), color: theme.cardColor),
          clipBehavior: Clip.antiAlias,
          child: AppImage(
            url: photo.thumb ?? photo.fullsize,
            fit: BoxFit.cover,
            width: double.infinity,
            height: double.infinity,
            placeholder: Container(
              color: theme.hintColor.withValues(alpha: 0.1),
              child: Icon(AppIcons.photo, color: theme.hintColor, size: 32),
            ),
            errorWidget: Container(
              color: theme.hintColor.withValues(alpha: 0.1),
              child: Icon(AppIcons.brokenImage, color: theme.hintColor, size: 32),
            ),
          ),
        ),
      ),
    );
  }
}

class ScrollIndicatorPainter extends CustomPainter {
  final double scrollPosition;
  final double maxScrollExtent;
  final double viewportHeight;
  final Color color;
  final Color activeColor;
  final int currentGroupIndex;
  final int totalGroups;

  ScrollIndicatorPainter({
    required this.scrollPosition,
    required this.maxScrollExtent,
    required this.viewportHeight,
    required this.color,
    required this.activeColor,
    required this.currentGroupIndex,
    required this.totalGroups,
  });

  @override
  void paint(Canvas canvas, Size size) {
    const dashCount = 60; // Number of dashes to show (doubled from 30)
    const dashHeight = 2.0; // Height when vertical (now width)
    const dashWidth = 12.0; // Width when vertical (now height)

    // Calculate spacing to fill the full height
    final availableHeight = size.height;
    final totalDashHeight = dashCount * dashHeight;
    final totalSpacing = availableHeight - totalDashHeight;
    final dashSpacing = totalSpacing / (dashCount - 1);

    // Calculate which dash should be active based on current group and total groups
    int activeDashIndex;
    if (totalGroups > 0) {
      // Map current group to dash index (more accurate than scroll position)
      final groupProgress = currentGroupIndex / (totalGroups - 1).clamp(1, totalGroups);
      activeDashIndex = (groupProgress * (dashCount - 1)).round().clamp(0, dashCount - 1);
    } else {
      // Fallback to scroll position if no groups
      final scrollProgress = maxScrollExtent > 0
          ? (scrollPosition / maxScrollExtent).clamp(0.0, 1.0)
          : 0.0;
      activeDashIndex = (scrollProgress * (dashCount - 1)).round();
    }

    for (int i = 0; i < dashCount; i++) {
      final y = i * (dashHeight + dashSpacing);
      final isActive = i == activeDashIndex;

      final paint = Paint()
        ..color = isActive ? activeColor : color
        ..style = PaintingStyle.fill;

      // Create vertical dashes (rotated 90 degrees)
      final rect = Rect.fromLTWH((size.width - dashWidth) / 2, y, dashWidth, dashHeight);

      canvas.drawRRect(RRect.fromRectAndRadius(rect, const Radius.circular(1)), paint);
    }
  }

  @override
  bool shouldRepaint(ScrollIndicatorPainter oldDelegate) {
    return scrollPosition != oldDelegate.scrollPosition ||
        maxScrollExtent != oldDelegate.maxScrollExtent ||
        viewportHeight != oldDelegate.viewportHeight ||
        currentGroupIndex != oldDelegate.currentGroupIndex ||
        totalGroups != oldDelegate.totalGroups;
  }
}
