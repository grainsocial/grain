import 'package:freezed_annotation/freezed_annotation.dart';

part 'delete_favorite_response.freezed.dart';
part 'delete_favorite_response.g.dart';

/// Response model for deleting a favorite.
/// See lexicon: social.grain.favorite.deleteFavorite
@freezed
class DeleteFavoriteResponse with _$DeleteFavoriteResponse {
  const factory DeleteFavoriteResponse({required bool success}) = _DeleteFavoriteResponse;

  factory DeleteFavoriteResponse.fromJson(Map<String, dynamic> json) =>
      _$DeleteFavoriteResponseFromJson(json);
}
