import 'package:flutter/material.dart';
import 'package:grain/api.dart';
import 'package:grain/models/profile.dart';
import 'package:grain/screens/profile_page.dart';

class FollowsPage extends StatefulWidget {
  final String actorDid;
  const FollowsPage({super.key, required this.actorDid});

  @override
  State<FollowsPage> createState() => _FollowsPageState();
}

class _FollowsPageState extends State<FollowsPage> {
  List<Profile> follows = [];
  bool loading = true;
  String? cursor;
  bool hasMore = true;

  @override
  void initState() {
    super.initState();
    fetchFollows();
  }

  Future<void> fetchFollows() async {
    if (!hasMore) return;
    setState(() => loading = true);
    final result = await apiService.getFollows(actor: widget.actorDid, cursor: cursor);
    setState(() {
      follows.addAll(result.follows);
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
        title: const Text('Following'),
        backgroundColor: theme.appBarTheme.backgroundColor,
        surfaceTintColor: theme.appBarTheme.backgroundColor,
      ),
      body: ListView.builder(
        itemCount: follows.length + (hasMore ? 1 : 0),
        itemBuilder: (context, index) {
          if (index < follows.length) {
            final user = follows[index];
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
              if (!loading && hasMore) fetchFollows();
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
