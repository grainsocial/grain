import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:grain/api.dart';
import 'package:grain/app_icons.dart';
import 'package:grain/models/profile.dart';
import 'package:grain/providers/profile_provider.dart';
import 'package:grain/screens/profile_page.dart';
import 'package:grain/widgets/app_image.dart';
import 'package:grain/widgets/plain_text_field.dart';
import 'package:shared_preferences/shared_preferences.dart';

class ExplorePage extends ConsumerStatefulWidget {
  const ExplorePage({super.key});

  @override
  ConsumerState<ExplorePage> createState() => _ExplorePageState();
}

class _ExplorePageState extends ConsumerState<ExplorePage> {
  final TextEditingController _controller = TextEditingController();
  List<Profile> _results = [];
  List<Profile> _recentlySearched = [];
  static const String _recentlySearchedKey = 'recently_searched_dids';
  bool _loading = false;
  bool _searched = false;
  Timer? _debounce;

  @override
  void initState() {
    super.initState();
    _loadRecentlySearched();
  }

  Future<void> _loadRecentlySearched() async {
    final prefs = await SharedPreferences.getInstance();
    final dids = prefs.getStringList(_recentlySearchedKey) ?? [];
    if (dids.isNotEmpty) {
      final profiles = <Profile>[];
      for (final did in dids) {
        try {
          final profileWithGalleries = await ref.read(profileNotifierProvider(did).future);
          if (profileWithGalleries != null) {
            profiles.add(profileWithGalleries.profile);
          }
        } catch (_) {}
      }
      if (mounted) {
        setState(() {
          _recentlySearched = profiles;
        });
      }
    }
  }

  Future<void> _saveRecentlySearched() async {
    final prefs = await SharedPreferences.getInstance();
    final dids = _recentlySearched.map((p) => p.did).toList();
    await prefs.setStringList(_recentlySearchedKey, dids);
  }

  void _onSearchChanged(String value) {
    if (_debounce?.isActive ?? false) _debounce!.cancel();
    if (value.isEmpty) {
      setState(() {
        _results = [];
        _searched = false;
        _loading = false;
      });
      return;
    }
    setState(() {
      _loading = true;
      _searched = true;
    });
    _debounce = Timer(const Duration(milliseconds: 500), () async {
      try {
        final results = await apiService.searchActors(value);
        if (mounted) {
          setState(() {
            _results = results;
            _loading = false;
          });
        }
      } catch (e) {
        if (mounted) {
          setState(() {
            _results = [];
            _loading = false;
          });
        }
      }
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    _debounce?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 8),
          child: PlainTextField(
            label: '',
            controller: _controller,
            hintText: 'Search for users',
            onChanged: _onSearchChanged,
            enabled: true,
            prefixIcon: Icon(AppIcons.search, color: theme.iconTheme.color, size: 24),
            suffixIcon: _controller.text.isNotEmpty
                ? GestureDetector(
                    onTap: () {
                      _controller.clear();
                      _onSearchChanged('');
                    },
                    child: Icon(Icons.clear, color: theme.iconTheme.color, size: 22),
                  )
                : null,
          ),
        ),
        if (_controller.text.isEmpty && _recentlySearched.isNotEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 8.0, vertical: 4),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Padding(
                  padding: const EdgeInsets.only(left: 4.0, bottom: 4.0),
                  child: Text(
                    'Recent Searches',
                    style: theme.textTheme.titleSmall?.copyWith(
                      fontWeight: FontWeight.bold,
                      color: theme.textTheme.bodyMedium?.color,
                    ),
                  ),
                ),
                SizedBox(
                  height: 96,
                  child: ListView.separated(
                    scrollDirection: Axis.horizontal,
                    itemCount: _recentlySearched.length,
                    separatorBuilder: (context, index) => SizedBox(width: 16),
                    itemBuilder: (context, index) {
                      final profile = _recentlySearched[index];
                      return SizedBox(
                        width: 80,
                        child: Stack(
                          children: [
                            SizedBox(
                              width: 80,
                              height: 96,
                              child: Column(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Expanded(
                                    child: GestureDetector(
                                      onTap: () async {
                                        FocusScope.of(context).unfocus();
                                        _debounce?.cancel();
                                        setState(() {
                                          _searched = false;
                                          _loading = false;
                                        });
                                        if (context.mounted) {
                                          Navigator.of(context).push(
                                            MaterialPageRoute(
                                              builder: (context) =>
                                                  ProfilePage(did: profile.did, showAppBar: true),
                                            ),
                                          );
                                        }
                                      },
                                      child: CircleAvatar(
                                        radius: 32,
                                        backgroundColor: theme.colorScheme.surfaceContainerHighest,
                                        backgroundImage: profile.avatar?.isNotEmpty == true
                                            ? NetworkImage(profile.avatar!)
                                            : null,
                                        child: profile.avatar?.isNotEmpty == true
                                            ? null
                                            : Icon(
                                                AppIcons.accountCircle,
                                                color: theme.iconTheme.color,
                                                size: 40,
                                              ),
                                      ),
                                    ),
                                  ),
                                  SizedBox(height: 4),
                                  SizedBox(
                                    width: 80,
                                    child: Text(
                                      profile.displayName?.isNotEmpty == true
                                          ? profile.displayName!
                                          : '@${profile.handle}',
                                      style: theme.textTheme.bodyMedium,
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      textAlign: TextAlign.center,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            Positioned(
                              top: 4,
                              right: 4,
                              child: GestureDetector(
                                onTap: () async {
                                  setState(() {
                                    _recentlySearched.removeAt(index);
                                  });
                                  await _saveRecentlySearched();
                                },
                                child: Container(
                                  padding: const EdgeInsets.all(2),
                                  decoration: BoxDecoration(
                                    color: theme.colorScheme.surface,
                                    shape: BoxShape.circle,
                                    boxShadow: [BoxShadow(color: Colors.black26, blurRadius: 2)],
                                  ),
                                  child: Icon(Icons.close, size: 18, color: theme.iconTheme.color),
                                ),
                              ),
                            ),
                          ],
                        ),
                      );
                    },
                  ),
                ),
              ],
            ),
          ),
        if (_controller.text.isNotEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 4),
            child: Align(
              alignment: Alignment.centerLeft,
              child: Text(
                'Search for "${_controller.text}"',
                style: theme.textTheme.bodyMedium?.copyWith(
                  color: theme.hintColor,
                  fontWeight: FontWeight.w500,
                  fontSize: 16,
                ),
              ),
            ),
          ),
        Expanded(child: _buildResultsList(_results, theme)),
      ],
    );
  }

  Widget _buildResultsList(List<Profile> results, ThemeData theme) {
    if (_loading) {
      return ListTile(
        title: Text('Searching...', style: theme.textTheme.bodyMedium),
        leading: SizedBox(
          width: 20,
          height: 20,
          child: CircularProgressIndicator(strokeWidth: 2, color: theme.colorScheme.primary),
        ),
      );
    } else if (_searched && results.isEmpty) {
      return ListTile(title: Text('No users found', style: theme.textTheme.bodyMedium));
    }
    return ListView.separated(
      itemCount: results.length,
      separatorBuilder: (context, index) =>
          Divider(height: 1, thickness: 1, color: theme.dividerColor),
      itemBuilder: (context, index) {
        final profile = results[index];
        return ListTile(
          leading: profile.avatar?.isNotEmpty == true
              ? ClipOval(
                  child: AppImage(url: profile.avatar, width: 32, height: 32, fit: BoxFit.cover),
                )
              : CircleAvatar(
                  radius: 16,
                  backgroundColor: theme.colorScheme.surfaceContainerHighest,
                  child: Icon(AppIcons.accountCircle, color: theme.iconTheme.color),
                ),
          title: Text(
            profile.displayName?.isNotEmpty == true ? profile.displayName! : '@${profile.handle}',
            style: theme.textTheme.bodyLarge,
          ),
          subtitle: profile.handle.isNotEmpty
              ? Text(
                  '@${profile.handle}',
                  style: theme.textTheme.bodyMedium?.copyWith(color: theme.hintColor),
                )
              : null,
          onTap: () async {
            FocusScope.of(context).unfocus();
            _debounce?.cancel();
            setState(() {
              _searched = false;
              _loading = false;
              // Move to front if already present, else add to front
              final existingIndex = _recentlySearched.indexWhere((p) => p.did == profile.did);
              if (existingIndex != -1) {
                _recentlySearched.removeAt(existingIndex);
              }
              _recentlySearched.insert(0, profile);
              // Limit to 10 recent users
              if (_recentlySearched.length > 10) {
                _recentlySearched.removeLast();
              }
            });
            await _saveRecentlySearched();
            if (context.mounted) {
              Navigator.of(context).push(
                MaterialPageRoute(
                  builder: (context) => ProfilePage(did: profile.did, showAppBar: true),
                ),
              );
            }
          },
        );
      },
    );
  }
}
