import 'package:flutter/material.dart';
import 'package:grain/api.dart';
import 'package:grain/models/profile.dart';
import 'package:grain/screens/profile_page.dart';

class FollowersPage extends StatefulWidget {
  final String actorDid;
  const FollowersPage({super.key, required this.actorDid});

  @override
  State<FollowersPage> createState() => _FollowersPageState();
}

class _FollowersPageState extends State<FollowersPage> {
  List<Profile> followers = [];
  bool loading = true;
  String? cursor;
  bool hasMore = true;

  @override
  void initState() {
    super.initState();
    fetchFollowers();
  }

  Future<void> fetchFollowers() async {
    if (!hasMore) return;
    setState(() => loading = true);
    final result = await apiService.getFollowers(actor: widget.actorDid, cursor: cursor);
    setState(() {
      followers.addAll(result.followers);
      cursor = result.cursor;
      hasMore = result.cursor != null;
      loading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(
        title: const Text('Followers'),
        backgroundColor: theme.appBarTheme.backgroundColor,
        surfaceTintColor: theme.appBarTheme.backgroundColor,
      ),
      body: ListView.builder(
        itemCount: followers.length + (hasMore ? 1 : 0),
        itemBuilder: (context, index) {
          if (index < followers.length) {
            final user = followers[index];
            return ListTile(
              leading: user.avatar != null
                  ? CircleAvatar(
                      backgroundColor: theme.colorScheme.surfaceContainerHighest,
                      backgroundImage: NetworkImage(user.avatar!),
                    )
                  : null,
              title: Text(user.displayName ?? user.handle),
              subtitle: Text('@${user.handle}'),
              onTap: () {
                Navigator.of(context).push(
                  MaterialPageRoute(builder: (_) => ProfilePage(did: user.did, showAppBar: true)),
                );
              },
            );
          } else {
            WidgetsBinding.instance.addPostFrameCallback((_) {
              if (!loading && hasMore) fetchFollowers();
            });
            return const Center(
              child: Padding(padding: EdgeInsets.all(16), child: CircularProgressIndicator()),
            );
          }
        },
      ),
    );
  }
}
