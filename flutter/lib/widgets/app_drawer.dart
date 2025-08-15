import 'package:flutter/material.dart';
import 'package:grain/api.dart';
import 'package:grain/app_icons.dart';
import 'package:grain/screens/log_page.dart';
import 'package:grain/screens/photo_library_page.dart';
import 'package:grain/widgets/app_version_text.dart';

class AppDrawer extends StatelessWidget {
  final ThemeData theme;
  final String? avatarUrl;
  final int activeIndex; // 0: Home, 1: Explore, 2: Notifications, 3: Profile
  final VoidCallback onHome;
  final VoidCallback onExplore;
  final VoidCallback onNotifications;
  final VoidCallback onProfile;

  const AppDrawer({
    super.key,
    required this.theme,
    required this.avatarUrl,
    required this.activeIndex,
    required this.onHome,
    required this.onExplore,
    required this.onNotifications,
    required this.onProfile,
  });

  @override
  Widget build(BuildContext context) {
    return Drawer(
      child: ListView(
        padding: EdgeInsets.zero,
        children: [
          Container(
            height: 250,
            decoration: BoxDecoration(
              color: theme.colorScheme.surface,
              border: Border(bottom: BorderSide(color: theme.dividerColor, width: 1)),
            ),
            padding: const EdgeInsets.fromLTRB(16, 115, 16, 16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                CircleAvatar(
                  radius: 22,
                  backgroundColor: theme.scaffoldBackgroundColor,
                  backgroundImage: (avatarUrl?.isNotEmpty ?? false)
                      ? NetworkImage(avatarUrl!)
                      : null,
                  child: (avatarUrl?.isEmpty ?? true)
                      ? Icon(AppIcons.person, size: 44, color: theme.hintColor)
                      : null,
                ),
                const SizedBox(height: 6),
                Text(
                  apiService.currentUser?.displayName ?? '',
                  style: theme.textTheme.bodyLarge?.copyWith(
                    fontWeight: FontWeight.bold,
                    color: theme.colorScheme.onSurface,
                  ),
                ),
                if (apiService.currentUser?.handle != null)
                  Text(
                    '@${apiService.currentUser!.handle}',
                    style: theme.textTheme.bodySmall?.copyWith(color: theme.hintColor),
                  ),
                const SizedBox(height: 6),
                Row(
                  mainAxisAlignment: MainAxisAlignment.start,
                  children: [
                    Text(
                      (apiService.currentUser?.followersCount ?? 0).toString(),
                      style: theme.textTheme.bodyMedium?.copyWith(
                        fontWeight: FontWeight.bold,
                        color: theme.colorScheme.onSurface,
                      ),
                    ),
                    const SizedBox(width: 4),
                    Text(
                      'Followers',
                      style: theme.textTheme.bodySmall?.copyWith(color: theme.hintColor),
                    ),
                    const SizedBox(width: 16),
                    Text(
                      (apiService.currentUser?.followsCount ?? 0).toString(),
                      style: theme.textTheme.bodyMedium?.copyWith(
                        fontWeight: FontWeight.bold,
                        color: theme.colorScheme.onSurface,
                      ),
                    ),
                    const SizedBox(width: 4),
                    Text(
                      'Following',
                      style: theme.textTheme.bodySmall?.copyWith(color: theme.hintColor),
                    ),
                  ],
                ),
              ],
            ),
          ),
          ListTile(
            leading: Icon(
              AppIcons.house,
              size: 18,
              color: activeIndex == 0 ? theme.colorScheme.primary : theme.iconTheme.color,
            ),
            title: Text(
              'Home',
              style: TextStyle(
                color: activeIndex == 0
                    ? theme.colorScheme.primary
                    : theme.textTheme.bodyLarge?.color,
                fontWeight: activeIndex == 0 ? FontWeight.bold : FontWeight.normal,
              ),
            ),
            onTap: () {
              Navigator.pop(context);
              onHome();
            },
          ),
          ListTile(
            leading: Icon(
              AppIcons.magnifyingGlass,
              size: 18,
              color: activeIndex == 1 ? theme.colorScheme.primary : theme.iconTheme.color,
            ),
            title: Text(
              'Explore',
              style: TextStyle(
                color: activeIndex == 1
                    ? theme.colorScheme.primary
                    : theme.textTheme.bodyLarge?.color,
                fontWeight: activeIndex == 1 ? FontWeight.bold : FontWeight.normal,
              ),
            ),
            onTap: () {
              Navigator.pop(context);
              onExplore();
            },
          ),
          ListTile(
            leading: Icon(
              AppIcons.solidBell,
              size: 18,
              color: activeIndex == 2 ? theme.colorScheme.primary : theme.iconTheme.color,
            ),
            title: Text(
              'Notifications',
              style: TextStyle(
                color: activeIndex == 2
                    ? theme.colorScheme.primary
                    : theme.textTheme.bodyLarge?.color,
                fontWeight: activeIndex == 2 ? FontWeight.bold : FontWeight.normal,
              ),
            ),
            onTap: () {
              Navigator.pop(context);
              onNotifications();
            },
          ),
          ListTile(
            leading: Icon(
              AppIcons.user,
              size: 18,
              color: activeIndex == 3 ? theme.colorScheme.primary : theme.iconTheme.color,
            ),
            title: Text(
              'Profile',
              style: TextStyle(
                color: activeIndex == 3
                    ? theme.colorScheme.primary
                    : theme.textTheme.bodyLarge?.color,
                fontWeight: activeIndex == 3 ? FontWeight.bold : FontWeight.normal,
              ),
            ),
            onTap: () {
              Navigator.pop(context);
              onProfile();
            },
          ),
          ListTile(
            leading: Icon(
              AppIcons.photoLibrary,
              size: 18,
              color: activeIndex == 4 ? theme.colorScheme.primary : theme.iconTheme.color,
            ),
            title: const Text('Photo Library'),
            onTap: () {
              Navigator.pop(context);
              Navigator.of(
                context,
              ).push(MaterialPageRoute(builder: (context) => const PhotoLibraryPage()));
            },
          ),
          ListTile(
            leading: const Icon(AppIcons.list, size: 18),
            title: const Text('Logs'),
            onTap: () {
              Navigator.pop(context);
              Navigator.of(context).push(MaterialPageRoute(builder: (context) => const LogPage()));
            },
          ),
          const SizedBox(height: 16),
          Padding(
            padding: const EdgeInsets.only(bottom: 16.0),
            child: Center(child: AppVersionText()),
          ),
        ],
      ),
    );
  }
}
