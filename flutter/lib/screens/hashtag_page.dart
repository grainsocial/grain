import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:grain/api.dart';
import 'package:grain/widgets/timeline_item.dart';

import '../providers/gallery_cache_provider.dart';

class HashtagPage extends ConsumerStatefulWidget {
  final String hashtag;
  const HashtagPage({super.key, required this.hashtag});

  @override
  ConsumerState<HashtagPage> createState() => _HashtagPageState();
}

class _HashtagPageState extends ConsumerState<HashtagPage> {
  List<String> _uris = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _fetchGalleries();
  }

  Future<void> _fetchGalleries() async {
    setState(() {
      _loading = true;
    });
    final galleries = await apiService.getTimeline(algorithm: 'hashtag_${widget.hashtag}');
    ref.read(galleryCacheProvider.notifier).setGalleries(galleries);
    setState(() {
      _uris = galleries.map((g) => g.uri).toList();
      _loading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(
        backgroundColor: theme.appBarTheme.backgroundColor,
        surfaceTintColor: theme.appBarTheme.backgroundColor,
        elevation: 0.5,
        title: Text('#${widget.hashtag}'),
      ),
      body: _loading
          ? Center(
              child: CircularProgressIndicator(strokeWidth: 2, color: theme.colorScheme.primary),
            )
          : _uris.isEmpty
          ? Center(child: Text('No galleries found for #${widget.hashtag}'))
          : ListView.builder(
              padding: const EdgeInsets.only(top: 8, bottom: 80),
              itemCount: _uris.length,
              itemBuilder: (context, index) {
                return TimelineItemWidget(galleryUri: _uris[index]);
              },
            ),
    );
  }
}
