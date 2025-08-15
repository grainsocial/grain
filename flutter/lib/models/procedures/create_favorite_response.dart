import 'package:freezed_annotation/freezed_annotation.dart';

part 'create_favorite_response.freezed.dart';
part 'create_favorite_response.g.dart';

/// Response model for creating a favorite.
/// See lexicon: social.grain.favorite.createFavorite
@freezed
class CreateFavoriteResponse with _$CreateFavoriteResponse {
  const factory CreateFavoriteResponse({required String favoriteUri}) = _CreateFavoriteResponse;

  factory CreateFavoriteResponse.fromJson(Map<String, dynamic> json) =>
      _$CreateFavoriteResponseFromJson(json);
}
