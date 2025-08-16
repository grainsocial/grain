import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api.dart';
import '../models/profile.dart';

final actorSearchProvider = StateNotifierProvider<ActorSearchNotifier, Map<String, List<Profile>>>(
  (ref) => ActorSearchNotifier(),
);

class ActorSearchNotifier extends StateNotifier<Map<String, List<Profile>>> {
  ActorSearchNotifier() : super({});

  Future<List<Profile>> search(String query) async {
    if (query.isEmpty) return [];
    if (state.containsKey(query)) {
      return state[query]!;
    }
    final results = await apiService.searchActors(query);
    state = {...state, query: results};
    return results;
  }
}
