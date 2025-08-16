import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:grain/api.dart';
import 'package:grain/app_icons.dart';
import 'package:grain/screens/create_gallery_page.dart';
import 'package:grain/widgets/app_drawer.dart';
import 'package:grain/widgets/bottom_nav_bar.dart';
import 'package:grain/widgets/skeleton_timeline.dart';
import 'package:grain/widgets/timeline_item.dart';

import '../providers/gallery_cache_provider.dart';
import 'explore_page.dart';
import 'notifications_page.dart';
import 'profile_page.dart';

class HomePage extends StatefulWidget {
  final String title;
  final int initialTab; // 0: Home, 1: Explore, 2: Notifications, 3: Profile
  final String? did;
  final VoidCallback? onSignOut;
  const HomePage({super.key, required this.title, this.initialTab = 0, this.did, this.onSignOut});

  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> with TickerProviderStateMixin {
  PreferredSizeWidget _buildAppBar(ThemeData theme, {required String title}) {
    return AppBar(
      backgroundColor: theme.appBarTheme.backgroundColor,
      surfaceTintColor: theme.appBarTheme.backgroundColor,
      elevation: 0.5,
      title: Text(title, style: theme.appBarTheme.titleTextStyle),
      leading: Builder(
        builder: (context) => IconButton(
          color: theme.colorScheme.onSurfaceVariant,
          iconSize: 20,
          icon: const Icon(AppIcons.bars),
          onPressed: () => Scaffold.of(context).openDrawer(),
        ),
      ),
      actions: [
        IconButton(
          color: theme.colorScheme.onSurfaceVariant,
          iconSize: 20,
          icon: const Icon(AppIcons.arrowRightFromBracket),
          tooltip: 'Sign Out',
          onPressed: widget.onSignOut,
        ),
      ],
    );
  }

  bool showProfile = false;
  bool showNotifications = false;
  bool showExplore = false;
  List<String> _timelineUris = [];
  bool _timelineLoading = true;

  @override
  void initState() {
    super.initState();
    // Set tab state based on initialTab
    showProfile = widget.initialTab == 3;
    showExplore = widget.initialTab == 1;
    showNotifications = widget.initialTab == 2;
    _fetchTimeline();
  }

  Future<void> _fetchTimeline({String? algorithm}) async {
    final container = ProviderScope.containerOf(context, listen: false);
    setState(() {
      _timelineLoading = true;
    });
    try {
      final galleries = await container.read(galleryCacheProvider.notifier).fetchTimeline();
      setState(() {
        _timelineUris = galleries.map((g) => g.uri).toList();
        _timelineLoading = false;
      });
    } catch (e) {
      setState(() {
        _timelineUris = [];
        _timelineLoading = false;
      });
    }
  }

  @override
  void didUpdateWidget(covariant HomePage oldWidget) {
    super.didUpdateWidget(oldWidget);
  }

  @override
  void dispose() {
    super.dispose();
  }

  int get _navIndex {
    if (showProfile) return 3;
    if (showNotifications) return 2;
    if (showExplore) return 1;
    return 0;
  }

  Widget _buildTimelineSliver(BuildContext context, {bool following = false}) {
    final loading = _timelineLoading;
    final uris = _timelineUris;
    return RefreshIndicator(
      onRefresh: () async {
        await _fetchTimeline();
      },
      child: CustomScrollView(
        key: const PageStorageKey('timeline'),
        slivers: [
          if (uris.isEmpty && loading) const SkeletonTimeline(useSliver: true),
          if (uris.isEmpty && !loading)
            SliverFillRemaining(
              hasScrollBody: false,
              child: Center(child: Text('No timeline items.')),
            ),
          if (uris.isNotEmpty)
            SliverList(
              delegate: SliverChildBuilderDelegate((context, index) {
                final uri = uris[index];
                return TimelineItemWidget(galleryUri: uri);
              }, childCount: uris.length),
            ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final avatarUrl = apiService.currentUser?.avatar;
    // Home page: show default timeline only
    if (!showProfile && !showNotifications && !showExplore) {
      return Scaffold(
        onDrawerChanged: (isOpen) {
          setState(() {});
        },
        drawer: AppDrawer(
          theme: theme,
          avatarUrl: avatarUrl,
          activeIndex: _navIndex,
          onHome: () {
            setState(() {
              showProfile = false;
              showNotifications = false;
              showExplore = false;
            });
          },
          onExplore: () {
            setState(() {
              showProfile = false;
              showNotifications = false;
              showExplore = true;
            });
          },
          onNotifications: () {
            setState(() {
              showProfile = false;
              showNotifications = true;
              showExplore = false;
            });
          },
          onProfile: () {
            setState(() {
              showProfile = true;
              showNotifications = false;
              showExplore = false;
            });
          },
        ),
        appBar: _buildAppBar(theme, title: widget.title),
        body: _buildTimelineSliver(context),
        bottomNavigationBar: BottomNavBar(
          navIndex: _navIndex,
          onHome: () {
            setState(() {
              showProfile = false;
              showNotifications = false;
              showExplore = false;
            });
          },
          onExplore: () {
            setState(() {
              showProfile = false;
              showNotifications = false;
              showExplore = true;
            });
          },
          onNotifications: () {
            setState(() {
              showProfile = false;
              showNotifications = true;
              showExplore = false;
            });
          },
          onProfile: () {
            setState(() {
              showProfile = true;
              showNotifications = false;
              showExplore = false;
            });
          },
        ),
        floatingActionButton: (!showNotifications && !showExplore)
            ? FloatingActionButton(
                shape: const CircleBorder(),
                onPressed: () async {
                  HapticFeedback.mediumImpact();
                  final createdGalleryUri = await showCreateGallerySheet(context);
                  if (createdGalleryUri != null) {
                    _fetchTimeline();
                  }
                },
                backgroundColor: theme.colorScheme.primary,
                foregroundColor: Colors.white,
                tooltip: 'Create Gallery',
                child: Icon(AppIcons.addAPhoto),
              )
            : null,
      );
    }
    // Explore, Notifications, Profile: no tabs, no TabController
    String pageTitle = showExplore
        ? 'Explore'
        : showNotifications
        ? 'Notifications'
        : '';
    return Scaffold(
      drawer: AppDrawer(
        theme: theme,
        avatarUrl: avatarUrl,
        activeIndex: _navIndex,
        onHome: () {
          setState(() {
            showProfile = false;
            showNotifications = false;
            showExplore = false;
          });
        },
        onExplore: () {
          setState(() {
            showProfile = false;
            showNotifications = false;
            showExplore = true;
          });
        },
        onNotifications: () {
          setState(() {
            showProfile = false;
            showNotifications = true;
            showExplore = false;
          });
        },
        onProfile: () {
          setState(() {
            showProfile = true;
            showNotifications = false;
            showExplore = false;
          });
        },
      ),
      appBar: (showExplore || showNotifications) ? _buildAppBar(theme, title: pageTitle) : null,
      body: Stack(
        children: [
          if (showExplore)
            Positioned.fill(
              child: Material(
                color: theme.scaffoldBackgroundColor.withOpacity(0.98),
                child: SafeArea(child: Stack(children: [ExplorePage()])),
              ),
            ),
          if (showNotifications)
            Positioned.fill(
              child: Material(
                color: theme.scaffoldBackgroundColor.withOpacity(0.98),
                child: SafeArea(child: Stack(children: [NotificationsPage()])),
              ),
            ),
          if (showProfile)
            Positioned.fill(
              child: Material(
                color: theme.scaffoldBackgroundColor.withOpacity(0.98),
                child: SafeArea(
                  child: Stack(
                    children: [ProfilePage(did: apiService.currentUser?.did, showAppBar: false)],
                  ),
                ),
              ),
            ),
        ],
      ),
      bottomNavigationBar: BottomNavBar(
        navIndex: _navIndex,
        onHome: () {
          setState(() {
            showProfile = false;
            showNotifications = false;
            showExplore = false;
          });
        },
        onExplore: () {
          setState(() {
            showProfile = false;
            showNotifications = false;
            showExplore = true;
          });
        },
        onNotifications: () {
          setState(() {
            showProfile = false;
            showNotifications = true;
            showExplore = false;
          });
        },
        onProfile: () {
          setState(() {
            showProfile = true;
            showNotifications = false;
            showExplore = false;
          });
        },
      ),
    );
  }
} // End of _HomePageState and file
